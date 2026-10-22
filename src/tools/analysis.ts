import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BrandAnalysisAvailabilitySchema, BrandAnalysisRunSchema } from "../schemas/prompteye.js";
import { READ_ONLY, WRITES, handled, ok, type ToolContext } from "./result.js";
import { projectIdShape } from "./project-id.js";

export function registerBrandAnalysisTools(server: McpServer, { client }: ToolContext): void {
  server.registerTool(
    "create_brand_analysis_run",
    {
      title: "Start a brand analysis run",
      description:
        "Starts a brand analysis run for the project: PromptEye looks at what the tracked prompts " +
        "most recently found, works out the topics where a competitor answers better than this brand, " +
        "and scores how big each gap is.\n\n" +
        "Starting one is instant; the analysis itself takes a little while. The run comes back " +
        "`processing` and turns `ready` once it finishes, or `error` / `corrupted_response` if it fails " +
        "— read it with get_brand_analysis_run until it does.\n\n" +
        "A run cannot always be started: one already in progress blocks another, and a run that already " +
        "used the project's current tracking results is not repeated until they change. Call " +
        "get_brand_analysis_availability first to know whether — and why — one can run; this call is " +
        "refused for exactly the same reasons. Running an analysis also counts against the workspace's " +
        "monthly plan quota for brand analyses.",
      annotations: WRITES,
      inputSchema: { ...projectIdShape },
      outputSchema: BrandAnalysisRunSchema.shape,
    },
    async ({ projectId }) =>
      handled(async () => {
        const run = await client.createBrandAnalysisRun(projectId);
        return ok(run);
      })
  );

  server.registerTool(
    "get_brand_analysis_availability",
    {
      title: "Check whether a brand analysis run can be started",
      description:
        "Whether create_brand_analysis_run would start a new run for the project right now, and " +
        "if not, why — the same check that tool runs itself, without starting anything.",
      annotations: READ_ONLY,
      inputSchema: { ...projectIdShape },
      outputSchema: BrandAnalysisAvailabilitySchema.shape,
    },
    async ({ projectId }) =>
      handled(async () => {
        const availability = await client.getBrandAnalysisAvailability(projectId);
        return ok(availability);
      })
  );

  server.registerTool(
    "get_brand_analysis_run",
    {
      title: "Read one brand analysis run",
      description:
        "One run in full: its gaps, the ranking evidence behind each one, and the sentiment behind how " +
        "the assistants talk about the brand. Call it after create_brand_analysis_run until `status` " +
        "is `ready` — `gaps` is empty and `sentiment` is null until then, and `error` is set instead " +
        "if it failed.",
      annotations: READ_ONLY,
      inputSchema: {
        ...projectIdShape,
        runId: z.string().min(1).describe("Id of the run, as create_brand_analysis_run reports it."),
      },
      outputSchema: BrandAnalysisRunSchema.shape,
    },
    async ({ projectId, runId }) =>
      handled(async () => {
        const run = await client.getBrandAnalysisRun(projectId, runId);
        return ok(run);
      })
  );
}
