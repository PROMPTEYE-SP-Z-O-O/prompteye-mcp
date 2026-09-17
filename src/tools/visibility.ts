import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import {
  MAX_LIMIT,
  dateRangeShape,
  modelFilterShape,
  paginationShape,
  resolveDateRange,
} from "../schemas/common.js";
import {
  BreakdownSchema,
  VisibilityRowSchema,
  VisibilitySummarySchema,
} from "../schemas/prompteye.js";
import { widgetMeta, widgetUri } from "../widgets.js";
import { READ_ONLY, handled, morePages, num, ok, sampleData, signed, type ToolContext } from "./result.js";

export const VISIBILITY_WIDGET = "visibility";

export function registerVisibilityTools(server: McpServer, { client, session }: ToolContext): void {
  registerAppTool(
    server,
    "get_visibility_summary",
    {
      title: "Summarise visibility for a period",
      description:
        "The headline visibility figures for the active project over a period, and how they moved " +
        "against the period before it. This is the tool to call for 'how visible are we' — use " +
        "get_visibility_timeseries only when the individual measurements behind the number are needed.\n\n" +
        "Pass `by` to split the same figures along an axis: `day` for a trend line, `model` to compare " +
        "assistants, `prompt` to rank the prompts carrying the brand.",
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        ...modelFilterShape,
        by: BreakdownSchema.optional().describe(
          "Split the period along this axis as well as reporting its totals."
        ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .optional()
          .describe(`How many breakdown entries to return, at most ${MAX_LIMIT}. Ignored without \`by\`.`),
        promptId: z
          .string()
          .optional()
          .describe("Report on this prompt alone instead of every prompt in the project."),
      },
      outputSchema: VisibilitySummarySchema.extend({
        projectName: z.string(),
        brand: z.string(),
        by: BreakdownSchema.nullable(),
      }).shape,
      _meta: widgetMeta(widgetUri(VISIBILITY_WIDGET), "Measuring visibility…", "Measured visibility"),
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const summary = await client.getVisibilitySummary(project.id, { ...args, ...range });

        const headline = [
          `${project.brand} — ${range.startDate} to ${range.endDate}`,
          `Visibility ${num(summary.totals.visibility, "%")} (${signed(summary.change?.visibility ?? null, " pp")})`,
          `Reach index ${num(summary.totals.reachIndex)} (${signed(summary.change?.reachIndex ?? null)})`,
          `Average position ${num(summary.totals.averagePosition)} (${signed(summary.change?.averagePosition ?? null)})`,
          `Assistants: ${summary.models.join(", ")}`,
        ];

        if (summary.breakdown.length > 0) {
          headline.push("", `Breakdown by ${args.by}:`);
          for (const entry of summary.breakdown) {
            headline.push(`  ${entry.label}: ${num(entry.metrics.visibility, "%")}`);
          }
          if (summary.breakdownTruncated) {
            headline.push("  (truncated — raise `limit` to see more)");
          }
        }

        return ok(sampleData(headline.join("\n")), {
          ...summary,
          projectName: project.name,
          brand: project.brand,
          by: args.by ?? null,
        });
      })
  );

  server.registerTool(
    "get_visibility_timeseries",
    {
      title: "Read visibility over time",
      description:
        "The individual measurements behind the summary: one row per day, prompt and assistant, saying " +
        "whether the brand was named and in which position. Call this to inspect the raw record; call " +
        "get_visibility_summary for a headline number.",
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        ...modelFilterShape,
        ...paginationShape,
        promptId: z.string().optional().describe("Report on this prompt alone."),
      },
      outputSchema: {
        data: z.array(VisibilityRowSchema),
        nextCursor: z.string().nullable(),
      },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const page = await client.getVisibility(project.id, { ...args, ...range });

        const lines = page.data.map(
          (row) =>
            `${row.date} ${row.model} "${row.prompt}" → ${num(row.visibility, "%")}` +
            (row.position === null ? " (not named)" : ` at position ${row.position}`)
        );

        return ok(
          sampleData(
            (page.data.length === 0
              ? `No measurements for ${project.brand} between ${range.startDate} and ${range.endDate}.`
              : `${page.data.length} measurement(s):\n${lines.join("\n")}`) + morePages(page.nextCursor)
          ),
          page
        );
      })
  );
}
