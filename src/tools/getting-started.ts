import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PHASES, nextSteps, phaseOf, readStanding, renderPhases } from "./journey.js";
import { LISTED, describeCounts, describeUsage, thinGroups } from "./prompt-counts.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

const PromptRefSchema = z.object({ id: z.string(), prompt: z.string() });

export function registerGettingStartedTools(server: McpServer, context: ToolContext): void {
  const { client, session } = context;

  server.registerTool(
    "get_started",
    {
      title: "Where this workspace stands, and what to do next",
      description:
        "Call this when the user asks what they can do with PromptEye, where to begin, where they " +
        "stand, or what to do next — and at the start of a session before guessing at any of that. " +
        "It reads the account, the project, its brand description, prompts, pending suggestions and " +
        "the public reports the account has generated, then names the phase the project is in and the " +
        "next step from what is actually missing, which is more useful than a list of everything this " +
        "server could do. The phases run in order — " + PHASES.join(" → ") + " — so walk the user " +
        "through the current one and call this again once it is done. It also reports what has to be " +
        "done in the PromptEye app rather than here.",
      annotations: READ_ONLY,
      inputSchema: {
        projectId: z
          .string()
          .min(1)
          .optional()
          .describe("Report on this project instead of the active one, and make it active."),
      },
      outputSchema: {
        account: z.object({ email: z.string(), plan: z.string(), promptCount: z.number() }),
        project: z.string().nullable(),
        phase: z.enum(PHASES),
        projectCount: z.number(),
        knowledgeBase: z.boolean(),
        prompts: z.number(),
        promptCounts: z.object({
          active: z.number(),
          paused: z.number(),
          total: z.number(),
          more: z.boolean(),
        }),
        neverNamed: z.number(),
        awaitingFirstRun: z.number(),
        awaitingFirstRunPrompts: z.array(PromptRefSchema),
        pausedPrompts: z.array(PromptRefSchema),
        groups: z.number(),
        thinGroups: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            activePrompts: z.number(),
            pausedPrompts: z.number(),
            suggestions: z.number(),
          })
        ),
        suggestions: z.number(),
        reports: z
          .object({
            total: z.number(),
            waiting: z.number(),
            processing: z.number(),
            unconverted: z.number(),
          })
          .nullable(),
        nextSteps: z.array(z.string()),
      },
    },
    async ({ projectId }) =>
      handled(async () => {
        const projects = await client.listProjects();

        if (projectId) await session.select(projectId);
        const active =
          session.current() ?? (projects.data.length === 1 ? await session.select(projects.data[0].id) : null);

        const standing = await readStanding(context, active, { projects });
        const { account } = standing;
        const phase = phaseOf(standing);
        const steps = nextSteps(standing, phase);

        const lines = [
          `Account ${account.email} on the ${account.plan?.name ?? "unknown"} plan: ` +
            `${describeUsage(account)}, asked on ` +
            `${account.models.join(", ") || "no assistants"} ${account.scanFrequency}. ` +
            `Next run starts ${account.nextScanAt} and takes tens of minutes to finish.`,
          standing.project
            ? `Working on ${standing.project.name} — ${standing.project.brand} (${standing.project.domain}) in ${standing.project.country}.`
            : `${standing.projectCount} project(s) reachable, none selected yet.`,
        ];

        if (standing.project) {
          lines.push(
            `Brand description: ${standing.knowledgeBase ? "written" : "missing"}. ` +
              `Prompts in this project: ${describeCounts(standing.prompts)}, in ${standing.groups.length} group(s); ` +
              `${standing.neverNamed.length} never named, ${standing.awaitingFirstRun.length} active awaiting a first run. ` +
              `Suggestions waiting: ${standing.suggestions}.`
          );
        }

        if (standing.reports) {
          lines.push(
            standing.reports.total === 0
              ? "Public reports: none generated yet. create_report builds one for any brand and emails it — the free sample agencies hand to a prospect."
              : `Public reports: ${standing.reports.total}${standing.reports.more ? "+" : ""} generated, ` +
                `${standing.reports.waiting} waiting to be contacted, ${standing.reports.processing} still running, ` +
                `${standing.reports.unconverted} finished but not converted into a project.`
          );
        }

        lines.push("", `Phase: ${renderPhases(standing, phase)}`);
        lines.push("", "What to do next:", ...steps.map((step, index) => `${index + 1}. ${step}`));
        lines.push(
          "",
          "Help center: guides on how PromptEye works are at https://app.prompteye.com/help — " +
            "list_help_articles and read_help_article read them, so use those for any 'how does X work' " +
            "question, and point the user to that address."
        );
        lines.push(
          "",
          "Done in the PromptEye app, not here: accepting a suggestion, deleting a prompt, and " +
            "converting a report into a tracked project. Prompt generation cannot be triggered through " +
            "the API. What can be done here: update_knowledge_base for the brand description, " +
            "update_prompt to pause a prompt, move it between groups or set its priority, and " +
            "create_content_brief to outline an article for a prompt."
        );

        return ok(lines.join("\n"), {
          account: {
            email: account.email,
            plan: account.plan?.name ?? "unknown",
            promptCount: account.promptCount,
          },
          project: standing.project?.name ?? null,
          phase,
          projectCount: standing.projectCount,
          knowledgeBase: standing.knowledgeBase,
          prompts: standing.prompts.active,
          promptCounts: standing.prompts,
          neverNamed: standing.neverNamed.length,
          awaitingFirstRun: standing.awaitingFirstRun.length,
          awaitingFirstRunPrompts: standing.awaitingFirstRun.slice(0, LISTED),
          pausedPrompts: standing.paused.slice(0, LISTED),
          groups: standing.groups.length,
          thinGroups: thinGroups(standing.groups)
            .slice(0, LISTED)
            .map((group) => ({
              id: group.id,
              name: group.name,
              activePrompts: group.active,
              pausedPrompts: group.paused,
              suggestions: group.suggestions,
            })),
          suggestions: standing.suggestions,
          reports: standing.reports
            ? {
                total: standing.reports.total,
                waiting: standing.reports.waiting,
                processing: standing.reports.processing,
                unconverted: standing.reports.unconverted,
              }
            : null,
          nextSteps: steps,
        });
      })
  );
}
