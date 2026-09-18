import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveDateRange } from "../schemas/common.js";
import type { Project } from "../schemas/prompteye.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

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
};

/**
 * What to do next, in the order PromptEye itself works: a project, then the
 * brand description everything is written from, then prompts, then reading what
 * they measured. The first rung that is missing is the answer.
 */
function nextSteps(standing: Standing): string[] {
  if (standing.projectCount === 0) {
    return [
      "Create the first project with create_project — one brand in one market. Nothing is measured until a project exists.",
    ];
  }

  if (!standing.project) {
    return [
      "Pick which project to work on with select_project; every other tool reports on the active one.",
    ];
  }

  const steps: string[] = [];

  if (!standing.knowledgeBase) {
    steps.push(
      "Write the brand description in the PromptEye app. Every prompt PromptEye proposes is written from it, so this comes before adding prompts."
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
        "It reads the account, the project, its brand description, prompts and pending suggestions, " +
        "then names the next step from what is actually missing, which is more useful than a list of " +
        "everything this server could do. It also reports what has to be done in the PromptEye app " +
        "rather than here.",
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
        };

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
          `Account ${account.email} on the ${account.plan?.name ?? "unknown"} plan, ${account.promptCount} prompt(s) tracked across the workspace.`,
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

        lines.push("", "What to do next:", ...steps.map((step, index) => `${index + 1}. ${step}`));
        lines.push(
          "",
          "Done in the PromptEye app, not here: writing the brand description, accepting or editing a " +
            "suggestion, and pausing or deleting a prompt. Prompt generation cannot be triggered through the API."
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
          nextSteps: steps,
        });
      })
  );
}
