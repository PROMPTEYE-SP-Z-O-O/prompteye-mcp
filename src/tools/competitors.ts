import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_LIMIT, dateRangeShape, modelFilterShape, resolveDateRange } from "../schemas/common.js";
import { CompetitorSchema } from "../schemas/prompteye.js";
import { SHARE_OF_VOICE, VISIBILITY } from "./glossary.js";
import { READ_ONLY, handled, num, ok, signed, type ToolContext } from "./result.js";

export function registerCompetitorTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
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
      },
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
          page
        );
      })
  );
}
