import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { MAX_LIMIT, dateRangeShape, modelFilterShape, paginationShape } from "../schemas/common.js";
import {
  BreakdownSchema,
  VisibilityRowSchema,
  VisibilitySummarySchema,
} from "../schemas/prompteye.js";
import { widgetMeta, widgetUri } from "../widgets.js";
import { READ_ONLY, handled, sampleData, type ToolContext } from "./result.js";

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
        "Changes are signed so that positive always means improvement. For average position that means the brand was named earlier in the answer, so a positive change goes with a lower position number.\n\n" +
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
        const summary = await client.getVisibilitySummary(project.id, args);

        return sampleData({
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
        const page = await client.getVisibility(project.id, args);
        return sampleData(page);
      })
  );
}
