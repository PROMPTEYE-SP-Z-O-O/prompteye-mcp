import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BrandAnalysisAvailabilitySchema, BrandAnalysisRunSchema } from "../schemas/prompteye.js";
import type { BrandAnalysisAvailabilityReason, BrandAnalysisRun } from "../schemas/prompteye.js";
import { READ_ONLY, WRITES, handled, ok, type ToolContext } from "./result.js";

const AVAILABILITY_REASON_MEANING: Record<BrandAnalysisAvailabilityReason, string> = {
  no_project: "the project could not be reached.",
  no_prompts: "the project has no active tracked prompts yet.",
  no_results: "the active prompts have not produced tracking results yet.",
  processing: "a run is already in progress.",
  up_to_date: "the latest run already reflects the project's current tracking results.",
  retry_error: "the latest run failed; running again is allowed.",
  retry_corrupted_response: "the latest run's response was corrupted; running again is allowed.",
  ready: "nothing is blocking a new run.",
};

const describeRun = (run: BrandAnalysisRun): string => {
  const lines = [`Brand analysis run for project ${run.projectId} — ${run.status} [id: ${run.id}]`];

  if (run.status === "error" || run.status === "corrupted_response") {
    lines.push(`Error: ${run.error ?? "unknown"}`);
    return lines.join("\n");
  }

  if (run.status === "processing") {
    lines.push("Still analyzing — call get_brand_analysis_run again in a moment.");
    return lines.join("\n");
  }

  lines.push(
    `Built from ${run.activePromptCount} active prompt(s) and ${run.usedResultCount} tracking result(s).`
  );

  if (run.gaps.length === 0) {
    lines.push("No gaps found: no competitor was found answering a topic better than this brand.");
  } else {
    lines.push(
      `${run.gaps.length} gap(s), largest first:`,
      ...run.gaps
        .slice()
        .sort((a, b) => b.gapScore - a.gapScore)
        .map(
          (gap) =>
            `- ${gap.label} — ${gap.bestBrand} leads, gap ${gap.gapScore} [key: ${gap.key}]\n` +
            `  Why they win: ${gap.whyLeaderWins}\n  Why we miss: ${gap.whyWeMiss}`
        )
    );
  }

  if (run.sentiment) {
    lines.push(
      `Sentiment: ${run.sentiment.overallSentiment} (positive ${run.sentiment.positiveScore}, ` +
        `negative ${run.sentiment.negativeScore}, neutral ${run.sentiment.neutralScore})`,
      run.sentiment.summary
    );
  }

  return lines.join("\n");
};

export function registerBrandAnalysisTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "start_brand_analysis_run",
    {
      title: "Start a brand analysis run",
      description:
        "Starts a brand analysis run for the active project: PromptEye looks at what the tracked " +
        "prompts most recently found, works out the topics where a competitor answers better than " +
        "this brand, scores how big each gap is, and reads the sentiment behind how assistants talk " +
        "about the brand.\n\n" +
        "Starting one is instant; the analysis itself takes a little while. The run comes back " +
        "`processing` and turns `ready` once it finishes, or `error`/`corrupted_response` if it fails " +
        "— poll get_brand_analysis_run with the returned id until it does.\n\n" +
        "A run cannot always be started: one already in progress blocks another, and a run that " +
        "already used the project's current tracking results is not repeated until they change. Call " +
        "get_brand_analysis_availability first to know whether — and why — one can run; this tool " +
        "fails for exactly the same reasons rather than guessing. Running an analysis also counts " +
        "against the workspace's monthly plan quota for brand analyses.",
      annotations: WRITES,
      inputSchema: {},
      outputSchema: BrandAnalysisRunSchema.shape,
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const run = await client.startBrandAnalysisRun(project.id);

        return ok(
          `Brand analysis started for ${project.name}; it is ${run.status} — poll get_brand_analysis_run ` +
            `with id ${run.id} until it turns ready or error.`,
          run
        );
      })
  );

  server.registerTool(
    "get_brand_analysis_availability",
    {
      title: "Check whether a new brand analysis run can be started",
      description:
        "Whether start_brand_analysis_run would start a new run for the active project right now, and " +
        "if not, why — the same check that tool runs itself, without starting anything:\n" +
        Object.entries(AVAILABILITY_REASON_MEANING)
          .map(([reason, meaning]) => `- \`${reason}\` — ${meaning}`)
          .join("\n") +
        "\n\nCall this before start_brand_analysis_run to explain a wait rather than guessing from a " +
        "failed call.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: BrandAnalysisAvailabilitySchema.shape,
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const availability = await client.getBrandAnalysisAvailability(project.id);

        return ok(
          `${project.name}: ${availability.canRun ? "can" : "cannot"} start a new run right now ` +
            `(${availability.reason} — ${AVAILABILITY_REASON_MEANING[availability.reason]}). ` +
            `${availability.activePromptCount} active prompt(s), ${availability.usedResultCount} ` +
            `tracking result(s), latest result ${availability.latestTrackScoreResultTimestamp ?? "—"}.`,
          availability
        );
      })
  );

  server.registerTool(
    "get_brand_analysis_run",
    {
      title: "Read one brand analysis run",
      description:
        "One brand analysis run in full: its gaps — the topics where a competitor answers better than " +
        "this brand, with why and the ranking evidence behind it — and the sentiment behind how " +
        "assistants talk about the brand.\n\n" +
        "This is where a run is polled until status is ready — gaps is empty and sentiment is null " +
        "until then, and error is set instead if it failed.",
      annotations: READ_ONLY,
      inputSchema: {
        runId: z.string().min(1).describe("Id of the run, as start_brand_analysis_run reports it."),
      },
      outputSchema: BrandAnalysisRunSchema.shape,
    },
    async ({ runId }) =>
      handled(async () => {
        const project = await session.require();
        const run = await client.getBrandAnalysisRun(project.id, runId);

        return ok(describeRun(run), run);
      })
  );
}
