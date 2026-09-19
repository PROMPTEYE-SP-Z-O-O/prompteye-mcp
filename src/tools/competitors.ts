import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { MAX_LIMIT, dateRangeShape, modelFilterShape, resolveDateRange } from "../schemas/common.js";
import { CompetitorExclusionSchema, CompetitorSchema } from "../schemas/prompteye.js";
import { widgetMeta, widgetUri } from "../widgets.js";
import { SHARE_OF_VOICE, VISIBILITY } from "./glossary.js";
import { READ_ONLY, WRITES, handled, num, ok, signed, type ToolContext } from "./result.js";

export const COMPETITORS_WIDGET = "competitors";

export function registerCompetitorTools(server: McpServer, { client, session }: ToolContext): void {
  registerAppTool(
    server,
    "list_competitors",
    {
      title: "Rank the brands answering alongside yours",
      description:
        "Every brand the assistants named on the active project's prompts, measured the same way the " +
        "project's own brand is and ranked by share of voice. Call this for 'who are we losing to' " +
        "and for how a market splits between brands.\n\n" +
        `${SHARE_OF_VOICE}\n\n${VISIBILITY}\n\n` +
        "The ranking answers with the strongest brands rather than a list to walk to the end of, so " +
        "raise `limit` to see further down. `model` narrows it to one assistant, which is how to tell " +
        "a brand that dominates everywhere from one that owns a single assistant.",
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        ...modelFilterShape,
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .optional()
          .describe(`How many brands to return, at most ${MAX_LIMIT}.`),
      },
      outputSchema: {
        data: z.array(CompetitorSchema),
        nextCursor: z.string().nullable(),
        projectName: z.string(),
        brand: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        model: z.string().nullable(),
      },
      _meta: widgetMeta(widgetUri(COMPETITORS_WIDGET), "Ranking the brands…", "Ranked the brands"),
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const page = await client.listCompetitors(project.id, { ...args, ...range });

        const lines = page.data.map((competitor, index) => {
          const mark = competitor.ownBrand ? " ← this project" : "";
          return (
            `${index + 1}. ${competitor.brand}${mark} — share of voice ${num(competitor.shareOfVoice, "%")}, ` +
            `visibility ${num(competitor.metrics.visibility, "%")} (${signed(competitor.change?.visibility ?? null, " pp")}), ` +
            `${num(competitor.citations)} citation(s)`
          );
        });

        return ok(
          page.data.length === 0
            ? `No brands were named on ${project.brand}'s prompts between ${range.startDate} and ${range.endDate}.`
            : `Brands answering alongside ${project.brand}, ${range.startDate} to ${range.endDate}:\n${lines.join("\n")}`,
          {
            ...page,
            projectName: project.name,
            brand: project.brand,
            ...range,
            model: args.model ?? null,
          }
        );
      })
  );

  server.registerTool(
    "list_competitor_exclusions",
    {
      title: "List brands excluded from competitor rankings",
      description:
        "The brands the active project keeps out of its competitor rankings. Everything the assistants name is " +
        "a candidate competitor, so the ranking picks up resellers, marketplaces, directories, and the client's own " +
        "agency until they are excluded here.\n\n" +
        "Excluding a brand drops it from competitor rankings and share-of-voice calculations across historical data.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: { data: z.array(CompetitorExclusionSchema) },
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const list = await client.listCompetitorExclusions(project.id);
        const lines = list.data.map((ex) => {
          const aliases = ex.aliases.length > 0 ? ` (aliases: ${ex.aliases.join(", ")})` : "";
          return `- ${ex.name}${aliases}`;
        });

        return ok(
          list.data.length === 0
            ? `No competitor exclusions configured for ${project.name}.`
            : `Excluded competitors for ${project.name} (${list.data.length}):\n${lines.join("\n")}`,
          list
        );
      })
  );

  server.registerTool(
    "set_competitor_exclusions",
    {
      title: "Set brands excluded from competitor rankings",
      description:
        "Replaces the complete exclusion list for the active project with the one provided. Read the current list " +
        "with list_competitor_exclusions first if you want to add to existing exclusions rather than replace them.\n\n" +
        "Excluding a brand drops it from the competitor rankings, share of voice, and citations across all historical measurements. " +
        "Accepts up to 50 excluded brands, each with optional alternative spellings/aliases.",
      annotations: WRITES,
      inputSchema: {
        exclusions: z
          .array(
            z.object({
              name: z.string().min(1).max(120).describe("The brand to keep out of competitor rankings."),
              aliases: z
                .array(z.string().min(1).max(120))
                .max(20)
                .optional()
                .describe("Other spellings or aliases excluded alongside it."),
            })
          )
          .max(50)
          .describe("Complete list of excluded brands. Sending an empty array excludes nobody."),
      },
      outputSchema: { data: z.array(CompetitorExclusionSchema) },
    },
    async ({ exclusions }) =>
      handled(async () => {
        const project = await session.require();
        const result = await client.replaceCompetitorExclusions(project.id, exclusions);
        const lines = result.data.map((ex) => {
          const aliases = ex.aliases.length > 0 ? ` (aliases: ${ex.aliases.join(", ")})` : "";
          return `- ${ex.name}${aliases}`;
        });

        return ok(
          result.data.length === 0
            ? `Cleared all competitor exclusions for ${project.name}.`
            : `Updated competitor exclusions for ${project.name} (${result.data.length}):\n${lines.join("\n")}`,
          result
        );
      })
  );
}
