import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PromptEyeClient } from "../client/prompteye-client.js";
import { MAX_LIMIT, dateRangeShape, resolveDateRange } from "../schemas/common.js";
import {
  AnalyticsPageSchema,
  AnalyticsSourceSchema,
  AnalyticsSummarySchema,
  GoogleStatusSchema,
  SearchPageSchema,
  SearchQuerySchema,
  SearchSummarySchema,
  type AnalyticsPage,
  type AnalyticsSource,
  type GoogleSync,
  type SearchPage,
  type SearchQuery,
} from "../schemas/prompteye.js";
import { GOOGLE_BINDING, GOOGLE_DATA } from "./glossary.js";
import { READ_ONLY, handled, morePages, ok, type ToolContext } from "./result.js";

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

/** A rate between 0 and 1, as the percentage a reader expects. */
const rate = (value: number): string => `${(value * 100).toFixed(2)}%`;

/** How a failing sync reads, so a stale figure is never passed off as a fresh one. */
const staleness = (sync: GoogleSync | null): string =>
  sync?.failedSince
    ? ` Syncing has been failing since ${sync.failedSince}${sync.error ? ` (${sync.error})` : ""}, so these figures are stale.`
    : "";

/**
 * Zeros from these endpoints are ambiguous: a project with nothing bound
 * answers exactly like a site nobody visits. So when a reading comes back
 * empty, ask status and say which of the two it was.
 *
 * A status call that fails takes nothing down — the empty reading still stands.
 */
async function explainEmpty(
  client: PromptEyeClient,
  projectId: string,
  integration: "searchConsole" | "analytics"
): Promise<string> {
  const name = integration === "searchConsole" ? "Search Console" : "Google Analytics";

  try {
    const bound = (await client.getGoogleStatus(projectId))[integration];

    return bound.connected
      ? `\n\n${name} is connected, so this is a period with nothing in it rather than a missing integration.${staleness(bound.sync)}`
      : `\n\n${name} is not connected to this project, so there is nothing to report rather than nothing to show. Bind it in the PromptEye app.`;
  } catch {
    return `\n\nWhether ${name} is connected could not be read, so an empty period and a missing integration cannot be told apart here.`;
  }
}

/** The label a Search Console row is ranked under, whichever axis it came from. */
const searchLabel = (row: SearchQuery | SearchPage): string =>
  "query" in row ? `"${row.query}"` : row.page;

const trafficLabel = (row: AnalyticsSource | AnalyticsPage): string =>
  "source" in row ? row.source : row.page;

/** What Google reports for the project's own site — bound to the project in the app. */
export function registerGoogleTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "get_google_status",
    {
      title: "Check which Google data the project has",
      description:
        "Whether Search Console and Google Analytics are bound to the active project, and how their " +
        "last sync went. Call this when a Google figure looks wrong or empty, or before promising a " +
        "report built on one.\n\n" +
        GOOGLE_BINDING,
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: GoogleStatusSchema.shape,
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const status = await client.getGoogleStatus(project.id);

        const { searchConsole, analytics } = status;
        const lines = [
          `Google data for ${project.name} — ${project.brand} (${project.domain}):`,
          searchConsole.connected
            ? `Search Console: ${searchConsole.siteUrl ?? "a property"}` +
              `${searchConsole.permissionLevel ? ` as ${searchConsole.permissionLevel}` : ""}, ` +
              `last synced ${searchConsole.sync?.lastSyncedAt ?? "never"}.${staleness(searchConsole.sync)}`
            : "Search Console: not connected — get_search_performance can only answer with zeros.",
          analytics.connected
            ? `Analytics: ${analytics.propertyName ?? analytics.propertyId ?? "a property"}` +
              `${analytics.accountName ? ` on ${analytics.accountName}` : ""}, ` +
              `last synced ${analytics.sync?.lastSyncedAt ?? "never"}.${staleness(analytics.sync)}`
            : "Analytics: not connected — get_ai_traffic can only answer with zeros.",
        ];

        if (!searchConsole.connected || !analytics.connected) {
          lines.push("", "Both are bound to the project in the PromptEye app, not from here.");
        }

        return ok(lines.join("\n"), status);
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
        GOOGLE_DATA,
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        by: SearchBreakdownSchema.optional().describe(
          "Rank the period along this axis instead of reporting its totals."
        ),
        ...limitShape("entries"),
      },
      outputSchema: {
        startDate: z.string(),
        endDate: z.string(),
        by: SearchBreakdownSchema.nullable(),
        summary: SearchSummarySchema.nullable(),
        data: z.array(z.union([SearchQuerySchema, SearchPageSchema])).nullable(),
        nextCursor: z.string().nullable(),
      },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const period = `${range.startDate} to ${range.endDate}`;

        if (args.by === undefined) {
          const summary = await client.getSearchSummary(project.id, range);
          const text =
            `${project.domain} in Google Search, ${period}:\n` +
            `${summary.clicks} click(s) from ${summary.impressions} impression(s) — ` +
            `CTR ${rate(summary.ctr)}, average position ${summary.position}.\n` +
            `${summary.timeline.length} day(s) of the timeline are in the structured output.` +
            (summary.impressions === 0 ? await explainEmpty(client, project.id, "searchConsole") : "");

          return ok(text, { ...range, by: null, summary, data: null, nextCursor: null });
        }

        const page =
          args.by === "query"
            ? await client.listSearchQueries(project.id, { ...range, limit: args.limit })
            : await client.listSearchPages(project.id, { ...range, limit: args.limit });

        const lines = page.data.map(
          (row) =>
            `- ${searchLabel(row)} — ${row.clicks} click(s), ${row.impressions} impression(s), ` +
            `CTR ${rate(row.ctr)}, position ${row.position}`
        );
        const heading =
          args.by === "query"
            ? `Phrases people found ${project.domain} with`
            : `Pages Google sends visitors to on ${project.domain}`;

        return ok(
          (page.data.length === 0
            ? `Google Search recorded nothing for ${project.domain} between ${range.startDate} and ${range.endDate}.` +
              (await explainEmpty(client, project.id, "searchConsole"))
            : `${heading}, ${period}, most clicked first:\n${lines.join("\n")}` +
              morePages(page.nextCursor)),
          { ...range, by: args.by, summary: null, ...page }
        );
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
        GOOGLE_DATA,
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
        startDate: z.string(),
        endDate: z.string(),
        assistant: z.string().nullable(),
        by: AiTrafficBreakdownSchema.nullable(),
        summary: AnalyticsSummarySchema.nullable(),
        data: z.array(z.union([AnalyticsSourceSchema, AnalyticsPageSchema])).nullable(),
        nextCursor: z.string().nullable(),
      },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const period = `${range.startDate} to ${range.endDate}`;
        const only = args.assistant ? ` via ${args.assistant}` : "";
        const common = { ...range, assistant: args.assistant ?? null };

        if (args.by === undefined) {
          const summary = await client.getAiTrafficSummary(project.id, { ...range, assistant: args.assistant });
          const text =
            `Visits to ${project.domain} from AI assistants${only}, ${period}:\n` +
            `${summary.sessions} session(s), ${summary.engagedSessions} engaged ` +
            `(${rate(summary.engagementRate)}), average ${summary.averageSessionDuration}s, ` +
            `${summary.keyEvents} key event(s).` +
            (summary.sessions === 0 ? await explainEmpty(client, project.id, "analytics") : "");

          return ok(text, { ...common, by: null, summary, data: null, nextCursor: null });
        }

        const query = { ...range, assistant: args.assistant, limit: args.limit };
        const page =
          args.by === "source"
            ? await client.listAiTrafficSources(project.id, query)
            : await client.listAiTrafficPages(project.id, query);

        const lines = page.data.map(
          (row) => `- ${trafficLabel(row)} — ${row.sessions} session(s), ${row.keyEvents} key event(s)`
        );
        const heading =
          args.by === "source"
            ? `Assistants that sent visitors to ${project.domain}${only}`
            : `Pages AI visitors land on at ${project.domain}${only}`;

        return ok(
          (page.data.length === 0
            ? `No AI sessions${only} were recorded for ${project.domain} between ${range.startDate} and ${range.endDate}.` +
              (await explainEmpty(client, project.id, "analytics"))
            : `${heading}, ${period}, most sessions first:\n${lines.join("\n")}` +
              morePages(page.nextCursor)),
          { ...common, by: args.by, summary: null, ...page }
        );
      })
  );
}
