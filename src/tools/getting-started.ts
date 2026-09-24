import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveDateRange } from "../schemas/common.js";
import type { Project } from "../schemas/prompteye.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

/** The lead pipeline, or null when this account cannot read reports at all. */
type Reports = {
  total: number;
  more: boolean;
  waiting: number;
  processing: number;
  unconverted: number;
};

/** The state the answer is built from, so the model reports facts rather than guesses. */
type Standing = {
  project: Project | null;
  projectCount: number;
  knowledgeBase: boolean;
  prompts: number;
  neverNamed: number;
  awaitingFirstRun: number;
  groups: number;
  suggestions: number;
  more: boolean;
  reports: Reports | null;
};

/**
 * What to do next, in the order PromptEye itself works: a project, then the
 * brand description everything is written from, then prompts, then reading what
 * they measured. The first rung that is missing is the answer.
 *
 * A prospect waiting to be contacted jumps the queue: it is the only thing here
 * that goes cold while nobody looks at it.
 */
function nextSteps(standing: Standing): string[] {
  const steps: string[] = [];

  if (standing.reports && standing.reports.waiting > 0) {
    steps.push(
      `${standing.reports.waiting} report(s) have someone asking to be contacted and no closed lead — get_report names who asked, how to reach them and what their report said.`
    );
  }

  if (standing.projectCount === 0) {
    steps.push(
      "Create the first project with create_project — one brand in one market. Nothing is measured until a project exists."
    );
    return steps;
  }

  if (!standing.project) {
    steps.push("Pick which project to work on with select_project; every other tool reports on the active one.");
    return steps;
  }

  if (!standing.knowledgeBase) {
    steps.push(
      "Fill in the brand description with update_knowledge_base — industry, product category, audience, ICP. Every prompt PromptEye proposes is written from it, so this comes before adding prompts."
    );
  }

  if (standing.prompts === 0) {
    steps.push(
      "Get the first prompts in place: list_prompt_suggestions returns what PromptEye proposes, and accepting them happens in the app. Use add_prompts only for prompts the user already has and must track verbatim."
    );
  } else {
    if (standing.suggestions > 0) {
      steps.push(
        `Review the ${standing.suggestions} suggestion(s) waiting with list_prompt_suggestions — each says which funnel stage it fills and how well it fits the brand.`
      );
    }
    if (standing.neverNamed > 0) {
      steps.push(
        `Look into the ${standing.neverNamed} prompt(s) that were never named: list_sources shows whose pages the assistants read instead, and list_competitors who they named.`
      );
    }
    steps.push(
      "Read the standing: list_prompts for what each question earns, list_competitors for share of voice, list_sources for the pages behind the answers."
    );
  }

  if (standing.awaitingFirstRun > 0) {
    steps.push(
      `${standing.awaitingFirstRun} prompt(s) have not been measured yet — their figures arrive after the next run.`
    );
  }

  if (standing.reports && standing.reports.unconverted > 0) {
    steps.push(
      `${standing.reports.unconverted} finished report(s) are still only samples. Converting one into a tracked project — done in the app — is what turns a free report into ongoing monitoring.`
    );
  }

  return steps;
}

export function registerGettingStartedTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "get_started",
    {
      title: "Where this workspace stands, and what to do next",
      description:
        "Call this when the user asks what they can do with PromptEye, where to begin, where they " +
        "stand, or what to do next — and at the start of a session before guessing at any of that. " +
        "It reads the account, the project, its brand description, prompts, pending suggestions and " +
        "the public reports the account has generated, then names the next step from what is actually " +
        "missing, which is more useful than a list of everything this server could do. It also " +
        "reports what has to be done in the PromptEye app rather than here.",
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
        projectCount: z.number(),
        knowledgeBase: z.boolean(),
        prompts: z.number(),
        neverNamed: z.number(),
        awaitingFirstRun: z.number(),
        groups: z.number(),
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
        const account = await client.getAccount();
        const projects = await client.listProjects();

        if (projectId) await session.select(projectId);
        const active =
          session.current() ?? (projects.data.length === 1 ? await session.select(projects.data[0].id) : null);

        const standing: Standing = {
          project: active,
          projectCount: projects.data.length,
          knowledgeBase: false,
          prompts: 0,
          neverNamed: 0,
          awaitingFirstRun: 0,
          groups: 0,
          suggestions: 0,
          more: false,
          reports: null,
        };

        // An account that cannot reach reports still deserves the rest of the answer.
        try {
          const reports = await client.listReports({ limit: 200 });
          standing.reports = {
            total: reports.data.length,
            more: reports.nextCursor !== null,
            waiting: reports.data.filter(
              (report) => report.contactCount > 0 && report.leadStatus !== "done"
            ).length,
            processing: reports.data.filter((report) => report.status === "processing").length,
            unconverted: reports.data.filter(
              (report) => report.status === "ready" && report.projectId === null
            ).length,
          };
        } catch {
          standing.reports = null;
        }

        if (active) {
          const range = resolveDateRange({});
          const [knowledgeBase, prompts, groups, suggestions] = await Promise.all([
            client.getKnowledgeBase(active.id),
            client.listPrompts(active.id, { ...range, limit: 200 }),
            client.listPromptGroups(active.id, { ...range, limit: 200 }),
            client.listPromptSuggestions(active.id, {}),
          ]);

          standing.knowledgeBase = (knowledgeBase.text ?? "").trim().length > 0;
          standing.prompts = prompts.data.length;
          standing.more = prompts.nextCursor !== null;
          standing.neverNamed = prompts.data.filter((prompt) => prompt.metrics.visibility === 0).length;
          standing.awaitingFirstRun = prompts.data.filter(
            (prompt) => prompt.metrics.visibility === null
          ).length;
          standing.groups = groups.data.length;
          standing.suggestions = suggestions.data.length;
        }

        const steps = nextSteps(standing);

        const lines = [
          `Account ${account.email} on the ${account.plan?.name ?? "unknown"} plan: ` +
            `${account.promptCount} of ${account.promptLimit} prompt(s) tracked, asked on ` +
            `${account.models.join(", ") || "no assistants"} ${account.scanFrequency}. ` +
            `Next run starts ${account.nextScanAt} and takes tens of minutes to finish.`,
          standing.project
            ? `Working on ${standing.project.name} — ${standing.project.brand} (${standing.project.domain}) in ${standing.project.country}.`
            : `${standing.projectCount} project(s) reachable, none selected yet.`,
        ];

        if (standing.project) {
          lines.push(
            `Brand description: ${standing.knowledgeBase ? "written" : "missing"}. ` +
              `Prompts: ${standing.prompts}${standing.more ? "+" : ""} in ${standing.groups} group(s), ` +
              `${standing.neverNamed} never named, ${standing.awaitingFirstRun} awaiting a first run. ` +
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

        lines.push("", "What to do next:", ...steps.map((step, index) => `${index + 1}. ${step}`));
        lines.push(
          "",
          "Help center: guides on how PromptEye works are at https://research.prompteye.com/help — " +
            "list_help_articles and read_help_article read them, so use those for any 'how does X work' " +
            "question, and point the user to that address."
        );
        lines.push(
          "",
          "Done in the PromptEye app, not here: accepting a suggestion, deleting a prompt, and " +
            "converting a report into a tracked project. Prompt generation cannot be triggered through " +
            "the API. What can be done here: update_knowledge_base for the brand description, and " +
            "update_prompt to pause a prompt, move it between groups or set its priority."
        );

        return ok(lines.join("\n"), {
          account: {
            email: account.email,
            plan: account.plan?.name ?? "unknown",
            promptCount: account.promptCount,
          },
          project: standing.project?.name ?? null,
          projectCount: standing.projectCount,
          knowledgeBase: standing.knowledgeBase,
          prompts: standing.prompts,
          neverNamed: standing.neverNamed,
          awaitingFirstRun: standing.awaitingFirstRun,
          groups: standing.groups,
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
