import { resolveDateRange } from "../schemas/common.js";
import type { Account, List, Project } from "../schemas/prompteye.js";
import type { ToolContext } from "./result.js";

export const PHASES = ["project", "knowledge_base", "prompts", "content", "waiting", "results"] as const;

export type Phase = (typeof PHASES)[number];

export type Reports = {
  total: number;
  more: boolean;
  waiting: number;
  processing: number;
  unconverted: number;
};

export type Standing = {
  account: Account;
  project: Project | null;
  projectCount: number;
  knowledgeBase: boolean;
  prompts: number;
  more: boolean;
  asked: number;
  measured: number;
  neverNamed: number;
  awaitingFirstRun: number;
  groups: number;
  suggestions: number;
  briefed: boolean;
  reports: Reports | null;
};

export async function readStanding(
  { client, session }: ToolContext,
  active: Project | null,
  { reports = true, projects }: { reports?: boolean; projects?: List<Project> } = {}
): Promise<Standing> {
  const [account, projectList] = await Promise.all([client.getAccount(), projects ?? client.listProjects()]);

  const standing: Standing = {
    account,
    project: active,
    projectCount: projectList.data.length,
    knowledgeBase: false,
    prompts: 0,
    more: false,
    asked: 0,
    measured: 0,
    neverNamed: 0,
    awaitingFirstRun: 0,
    groups: 0,
    suggestions: 0,
    briefed: active ? session.hasBrief(active.id) : false,
    reports: null,
  };

  if (reports) {
    try {
      const list = await client.listReports({ limit: 200 });
      standing.reports = {
        total: list.data.length,
        more: list.nextCursor !== null,
        waiting: list.data.filter((report) => report.contactCount > 0 && report.leadStatus !== "done").length,
        processing: list.data.filter((report) => report.status === "processing").length,
        unconverted: list.data.filter((report) => report.status === "ready" && report.projectId === null).length,
      };
    } catch {
      standing.reports = null;
    }
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
    const asked = prompts.data.filter((prompt) => prompt.status !== "paused");
    standing.asked = asked.length;
    standing.measured = prompts.data.filter((prompt) => prompt.metrics.visibility !== null).length;
    standing.neverNamed = prompts.data.filter((prompt) => prompt.metrics.visibility === 0).length;
    standing.awaitingFirstRun = asked.filter((prompt) => prompt.metrics.visibility === null).length;
    standing.groups = groups.data.length;
    standing.suggestions = suggestions.data.length;
  }

  return standing;
}

function trackingPhase(standing: Standing): Phase {
  if (standing.asked === 0) return "prompts";

  if (standing.measured === 0) return standing.briefed ? "waiting" : "content";
  return "results";
}

export function phaseOf(standing: Standing): Phase {
  if (!standing.project) return "project";
  if (!standing.knowledgeBase) return "knowledge_base";
  return trackingPhase(standing);
}

function isDone(standing: Standing, phase: Phase): boolean {
  switch (phase) {
    case "project":
      return standing.project !== null;
    case "knowledge_base":
      return standing.knowledgeBase;
    case "prompts":
      return standing.asked > 0;
    case "content":
      return standing.briefed || standing.measured > 0;
    case "waiting":
      return standing.measured > 0;
    case "results":
      return false;
  }
}

const firstRun = (account: Account): string =>
  `The next run starts ${account.nextScanAt} and takes tens of minutes to finish; the first figures arrive after it.`;

function phaseSteps(standing: Standing, phase: Phase): string[] {
  switch (phase) {
    case "project":
      return [
        standing.projectCount === 0
          ? "Create the first project with create_project — one brand in one market. Nothing is measured until a project exists."
          : "Pick which project to work on with select_project; every other tool reports on the active one.",
      ];

    case "knowledge_base":
      return [
        "Fill in the knowledge base. Show the user what the project knows with get_knowledge_base, ask them " +
          "for what is missing — industry, product category, target audience, ICP, operating area and a " +
          "description of what the brand does — and save it with update_knowledge_base. Every prompt " +
          "PromptEye proposes is written from it, so this comes before prompts.",
      ];

    case "prompts":
      if (standing.prompts > 0) {
        return [
          `All ${standing.prompts} prompt(s) are paused, so the next run asks nothing. Resume the ones worth ` +
            "tracking with update_prompt, or pick new ones from list_prompt_suggestions.",
        ];
      }
      return [
        standing.suggestions > 0
          ? `Pick the first prompts from the ${standing.suggestions} suggestion(s) list_prompt_suggestions returns; accepting them happens in the PromptEye app.`
          : "PromptEye has no suggestions for this project yet — they are generated inside a prompt group, " +
            "from the PromptEye app. Start the first prompts there. If the user already has prompts of their " +
            "own that must be tracked verbatim, add_prompts tracks them, after the user has chosen that.",
      ];

    case "content":
      return [
        "While the first run is pending, order article outlines for the prompts that matter most: " +
          "create_content_brief with a promptId from list_prompts, highest business priority first. Each " +
          "brief is the title and H2/H3 structure of an article written to be quoted for that question. " +
          "Optional — if the user does not publish content, go straight to waiting for the run.",
        firstRun(standing.account),
      ];

    case "waiting":
      return [
        `Wait for the first measurement. ${firstRun(standing.account)} Call get_started again once it has run.`,
        "Meanwhile get_content_brief reads the outlines that were ordered.",
      ];

    case "results": {
      const steps: string[] = [];
      if (standing.neverNamed > 0) {
        steps.push(
          `Look into the ${standing.neverNamed} prompt(s) that were never named: list_sources shows whose pages ` +
            "the assistants read instead, list_competitors who they named, and create_content_brief outlines " +
            "an article to answer that question."
        );
      }
      steps.push(
        "Read the standing: list_prompts for what each question earns, list_competitors for share of voice, list_sources for the pages behind the answers."
      );
      if (standing.suggestions > 0) {
        steps.push(
          `Review the ${standing.suggestions} suggestion(s) waiting with list_prompt_suggestions — each says which funnel stage it fills and how well it fits the brand.`
        );
      }
      if (standing.awaitingFirstRun > 0) {
        steps.push(`${standing.awaitingFirstRun} prompt(s) have not been measured yet — their figures arrive after the next run.`);
      }
      return steps;
    }
  }
}

export function nextSteps(standing: Standing, phase: Phase = phaseOf(standing)): string[] {
  const steps: string[] = [];

  if (standing.reports && standing.reports.waiting > 0) {
    steps.push(
      `${standing.reports.waiting} report(s) have someone asking to be contacted and no closed lead — get_report names who asked, how to reach them and what their report said.`
    );
  }

  steps.push(...phaseSteps(standing, phase));

  if (phase === "knowledge_base" && standing.prompts > 0) steps.push(...phaseSteps(standing, trackingPhase(standing)));

  if (standing.reports && standing.reports.unconverted > 0) {
    steps.push(
      `${standing.reports.unconverted} finished report(s) are still only samples. Converting one into a tracked project — done in the app — is what turns a free report into ongoing monitoring.`
    );
  }

  return steps;
}

export function renderPhases(standing: Standing, phase: Phase = phaseOf(standing)): string {
  return PHASES.map((name) => (name === phase ? `→ ${name}` : isDone(standing, name) ? `✓ ${name}` : name)).join(
    " · "
  );
}

export async function whatNext(context: ToolContext, project: Project): Promise<string> {
  try {
    const standing = await readStanding(context, project, { reports: false });
    const phase = phaseOf(standing);
    const [first] = phaseSteps(standing, phase);

    return `\n\nPhase: ${renderPhases(standing, phase)}\nNext: ${first}`;
  } catch {
    return "";
  }
}
