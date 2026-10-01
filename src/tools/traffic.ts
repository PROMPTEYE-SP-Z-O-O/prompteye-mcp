import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_LIMIT, MAX_TRAFFIC_RANGE_DAYS, paginationShape } from "../schemas/common.js";
import {
  NextCursorSchema,
  TrafficCountPageSchema,
  TrafficCrawlSchema,
  TrafficEventSchema,
  TrafficGroupSchema,
  TrafficKindSchema,
  TrafficSitemapPageSchema,
} from "../schemas/prompteye.js";
import { BOT_TRAFFIC, INTEGRATION_STATE, VERIFIED } from "./glossary.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

const trafficRangeShape = {
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("First day to report on, inclusive. Defaults to 30 days before today."),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      `Last day to report on, inclusive. Defaults to today, and must be within ${MAX_TRAFFIC_RANGE_DAYS} days of startDate — ` +
        "these endpoints read a month at a time, not a year."
    ),
};

const kindShape = {
  kind: TrafficKindSchema.optional().describe(
    "`ai` for AI assistants and their bots, `seo` for search engines and SEO tools. Omit it for both."
  ),
};

const botShape = {
  vendor: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Only bots run by this company, spelled as the API spells it: OpenAI, Anthropic, Google, " +
        "Perplexity, Meta, Amazon, Apple, Microsoft, ByteDance, Yandex, DuckDuckGo, Ahrefs, Semrush, " +
        "Moz, CommonCrawl, Mistral, Cohere and others. This is not the `assistant` of get_ai_traffic, " +
        "which matches a referrer instead."
    ),
  botId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Only this one bot, by the id the other traffic tools report — `chatgpt-user`, `gptbot`, " +
        "`googlebot` and so on. An unknown id is rejected by the API rather than ignored."
    ),
};

const pathShape = {
  path: z
    .string()
    .min(1)
    .optional()
    .describe("Only this exact path, without the domain and starting with `/`, e.g. `/pricing`."),
};

const statusShape = {
  status: z
    .string()
    .regex(/^([1-5]\d\d|[1-5]xx)$/)
    .optional()
    .describe("An exact HTTP status code, or a class such as `4xx` to see only the failures."),
};

export function registerTrafficTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "list_bot_visits",
    {
      title: "List the requests bots made to the site",
      description:
        "The individual requests AI assistants and search engines made to the active project's site, " +
        "newest first — which bot, which path, what the site answered and how long it took.\n\n" +
        "This is the evidence layer: call it to show what actually happened, or to see what a bot got " +
        "when a page moved. For totals call count_bot_visits instead — paging through this to add " +
        "requests up gives a wrong number, because only the newest 4 000 requests of the period are " +
        "searched and a rarely matching filter comes back short of what the period held.\n\n" +
        `${BOT_TRAFFIC}\n\n${VERIFIED}\n\n${INTEGRATION_STATE}`,
      annotations: READ_ONLY,
      inputSchema: {
        ...trafficRangeShape,
        ...kindShape,
        ...botShape,
        ...pathShape,
        ...statusShape,
        ...paginationShape,
      },
      outputSchema: { data: z.array(TrafficEventSchema), nextCursor: NextCursorSchema },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const page = await client.listBotVisits(project.id, args);
        return ok(page);
      })
  );

  server.registerTool(
    "count_bot_visits",
    {
      title: "Count the requests bots made, grouped",
      description:
        "The same requests as list_bot_visits, counted by the API rather than listed. `groupBy` picks " +
        "the question:\n\n" +
        "- `bot` — which assistants read the site, and which never turn up\n" +
        "- `path` — what they read, the nearest thing to knowing what they can quote\n" +
        "- `status` — crawl health: every 4xx and 5xx is a page an assistant tried to read and could not\n" +
        "- `day` — whether the attention is growing or fading\n" +
        "- `category` — bots fetching for a waiting user against those building an index\n\n" +
        "A failing status is worth more than its count suggests: an assistant that cannot fetch a page " +
        "does not retry it for the person waiting, it answers from something else. Each one is a " +
        "citation that went elsewhere.\n\n" +
        "`botId=chatgpt-user` with `groupBy=path` is the sharpest reading here — that bot fetches " +
        "because somebody has just asked ChatGPT something, so those paths are being read into " +
        "answers as they are requested.\n\n" +
        "The answer is ranked, not paged: the `limit` largest groups come back and there is no cursor. " +
        "`partial` is true when the period held more requests than could be read, so the counts then " +
        "describe the newest ones only.\n\n" +
        `${BOT_TRAFFIC}\n\n${VERIFIED}\n\n${INTEGRATION_STATE}`,
      annotations: READ_ONLY,
      inputSchema: {
        groupBy: TrafficGroupSchema.describe("What to count by."),
        ...trafficRangeShape,
        ...kindShape,
        ...botShape,
        ...pathShape,
        ...statusShape,
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .optional()
          .describe(`How many groups to return, at most ${MAX_LIMIT}.`),
      },
      outputSchema: TrafficCountPageSchema.shape,
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const counts = await client.countBotVisits(project.id, args);
        return ok(counts);
      })
  );

  server.registerTool(
    "list_crawls",
    {
      title: "List which bot asked for which page",
      description:
        "One row per path and bot: when that bot first and last asked for the path, how many times, " +
        "and the status it got the last time. Unlike list_bot_visits this covers everything since " +
        "tracking began rather than a period, and is ordered by the last visit.\n\n" +
        "Coverage rather than volume. A page a bot has never fetched does not appear here at all, and " +
        "cannot be quoted by that bot however well it answers the question. A `lastStatusCode` outside " +
        "the 2xx range is worse than silence: the last thing that bot recorded about the page is that " +
        "it was broken, and it carries that until it comes back.\n\n" +
        "Paths are in the same form get_sitemap reports, so an address listed there with no row here " +
        "is a page nothing has ever come for.\n\n" +
        "Only the 3 000 most recently visited rows are searched, unless `path` names one page, which " +
        "reads all of its rows.\n\n" +
        `${BOT_TRAFFIC}\n\n${INTEGRATION_STATE}`,
      annotations: READ_ONLY,
      inputSchema: { ...kindShape, ...botShape, ...pathShape, ...paginationShape },
      outputSchema: { data: z.array(TrafficCrawlSchema), nextCursor: NextCursorSchema },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const page = await client.listCrawls(project.id, args);
        return ok(page);
      })
  );

  server.registerTool(
    "get_sitemap",
    {
      title: "List the addresses in the connected sitemap",
      description:
        "The sitemap connected to the active project, how its last sync went, and the addresses it " +
        "found — what the site says it wants read.\n\n" +
        "Each address carries `path` in the same form list_crawls reports, so the two can be compared: " +
        "an address here with no crawl row is a page published into silence. `active` is false for an " +
        "address that has dropped out of the sitemap while bots may still be asking for it.\n\n" +
        "`sitemap` is null when none is connected, and the list is then empty — a missing integration " +
        "rather than an empty site. Sitemaps are connected in the PromptEye app. The first 5 000 " +
        "addresses can be paged to.",
      annotations: READ_ONLY,
      inputSchema: {
        active: z
          .enum(["true", "false"])
          .optional()
          .describe("Only the addresses the sitemap still lists, or only those that dropped out of it."),
        ...paginationShape,
      },
      outputSchema: TrafficSitemapPageSchema.shape,
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const result = await client.getSitemap(project.id, args);
        return ok(result);
      })
  );
}
