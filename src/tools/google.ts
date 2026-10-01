import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_LIMIT, dateRangeShape } from "../schemas/common.js";
import {
  AnalyticsPageSchema,
  AnalyticsSourceSchema,
  AnalyticsSummarySchema,
  GoogleStatusSchema,
  SearchPageSchema,
  SearchQuerySchema,
  SearchSummarySchema,
} from "../schemas/prompteye.js";
import { GOOGLE_BINDING, GOOGLE_DATA, INTEGRATION_STATE } from "./glossary.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

/** Which axis a Search Console reading is split along, or the totals when omitted. */
const SearchBreakdownSchema = z.enum(["query", "page"]);

/** The same, for the sessions Analytics attributes to assistants. */
const AiTrafficBreakdownSchema = z.enum(["source", "page"]);

const limitShape = (what: string) => ({
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(`How many ${what} to return, at most ${MAX_LIMIT}. Ignored without \`by\`.`),
});

const assistantShape = {
  assistant: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Only sessions from this AI assistant, matched without regard to case against the referrer: " +
        "`openai` also matches chatgpt, `anthropic` matches claude, `google` matches gemini, and " +
        "`microsoft` matches copilot and bing."
    ),
};

/** What Google reports for the project's own site — bound to the project in the app. */
export function registerGoogleTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "get_google_status",
    {
      title: "Check which Google data the project has",
      description:
        "Whether Search Console and Google Analytics are bound to the active project, and how their " +
        "last sync went. Call this when a Google figure looks wrong or empty, or before promising a " +
        "report built on one. get_integrations_status answers the same question for the bot tracker " +
        "and the sitemap as well.\n\n" +
        GOOGLE_BINDING,
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: GoogleStatusSchema.shape,
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const status = await client.getGoogleStatus(project.id);
        return ok(status);
      })
  );

  server.registerTool(
    "get_search_performance",
    {
      title: "Read how the site does in Google Search",
      description:
        "Clicks, impressions, click-through rate and average position of the active project's site " +
        "in ordinary Google results, with the daily timeline behind them.\n\n" +
        "Pass `by` to rank the period instead of totalling it: `query` for the phrases people found " +
        "the site with, `page` for the pages Google sends them to. A ranking is built by adding the " +
        "period up, so it answers with the strongest entries rather than a list to walk to the end " +
        "of — raise `limit` to see further down.\n\n" +
        GOOGLE_DATA +
        "\n\n" +
        INTEGRATION_STATE,
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        by: SearchBreakdownSchema.optional().describe(
          "Rank the period along this axis instead of reporting its totals."
        ),
        ...limitShape("entries"),
      },
      outputSchema: {
        by: SearchBreakdownSchema.nullable(),
        summary: SearchSummarySchema.nullable(),
        data: z.array(z.union([SearchQuerySchema, SearchPageSchema])).nullable(),
        nextCursor: z.string().nullable(),
      },
    },
    async ({ by, limit, ...range }) =>
      handled(async () => {
        const project = await session.require();

        if (by === undefined) {
          const summary = await client.getSearchSummary(project.id, range);
          return ok({ by: null, summary, data: null, nextCursor: null });
        }

        const page =
          by === "query"
            ? await client.listSearchQueries(project.id, { ...range, limit })
            : await client.listSearchPages(project.id, { ...range, limit });

        return ok({ by, summary: null, ...page });
      })
  );

  server.registerTool(
    "get_ai_traffic",
    {
      title: "Read the visits that came from AI assistants",
      description:
        "The sessions Google Analytics attributes to AI assistants for the active project's site: " +
        "how many arrived, how engaged they were, and how many key events they triggered. This is " +
        "the tool for 'is any of this visibility turning into visits'.\n\n" +
        "Pass `by` to rank the period instead of totalling it: `source` for the assistants that sent " +
        "the visitors, `page` for the pages they land on. `assistant` narrows any of the three to one " +
        "assistant. A ranking answers with the strongest entries rather than a list to walk to the " +
        "end of.\n\n" +
        GOOGLE_DATA +
        "\n\n" +
        INTEGRATION_STATE,
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        ...assistantShape,
        by: AiTrafficBreakdownSchema.optional().describe(
          "Rank the period along this axis instead of reporting its totals."
        ),
        ...limitShape("entries"),
      },
      outputSchema: {
        assistant: z.string().nullable(),
        by: AiTrafficBreakdownSchema.nullable(),
        summary: AnalyticsSummarySchema.nullable(),
        data: z.array(z.union([AnalyticsSourceSchema, AnalyticsPageSchema])).nullable(),
        nextCursor: z.string().nullable(),
      },
    },
    async ({ by, limit, assistant, ...range }) =>
      handled(async () => {
        const project = await session.require();

        if (by === undefined) {
          const summary = await client.getAiTrafficSummary(project.id, { ...range, assistant });
          return ok({ assistant: assistant ?? null, by: null, summary, data: null, nextCursor: null });
        }

        const query = { ...range, assistant, limit };
        const page =
          by === "source"
            ? await client.listAiTrafficSources(project.id, query)
            : await client.listAiTrafficPages(project.id, query);

        return ok({ assistant: assistant ?? null, by, summary: null, ...page });
      })
  );
}
