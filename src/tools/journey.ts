import { resolveDateRange } from "../schemas/common.js";
import type { Account, List, Project } from "../schemas/prompteye.js";
import type { ToolContext } from "./result.js";

/**
 * The order PromptEye works in, one phase at a time: a project, the brand
 * description everything is written from, the prompts, articles written to be
 * quoted for them, the wait for the first run, and then its results.
 *
 * A host that reads `phase` can walk the user through the product one step at
 * a time instead of handing over a list of everything at once.
 */
export const PHASES = ["project", "knowledge_base", "prompts", "content", "waiting", "results"] as const;

export type Phase = (typeof PHASES)[number];

/** The lead pipeline, or null when this account cannot read reports at all. */
export type Reports = {
  total: number;
  more: boolean;
  waiting: number;
  processing: number;
  unconverted: number;
};

/** The state the answer is built from, so the model reports facts rather than guesses. */
export type Standing = {
  account: Account;
  project: Project | null;
  projectCount: number;
  knowledgeBase: boolean;
  prompts: number;
  more: boolean;
  /** Prompts not paused, so asked on the next run. */
  asked: number;
  /** Prompts that carry a figure in the period: something has been measured. */
  measured: number;
  neverNamed: number;
  /** Prompts still asked that have no figure yet. Paused prompts are not waiting for anything. */
  awaitingFirstRun: number;
  groups: number;
  suggestions: number;
  /** Whether an article brief was ordered for the project in this session. */
  briefed: boolean;
  reports: Reports | null;
};

/**
 * Reads the workspace. `active` is the project to report on; null reports on
 * the account alone. `projects` saves a second listing when the caller already has one.
 */
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

  // An account that cannot reach reports still deserves the rest of the answer.
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

/** Where the prompts, articles and runs have got to, the knowledge base aside. */
function trackingPhase(standing: Standing): Phase {
  if (standing.asked === 0) return "prompts";

  // Nothing measured yet: articles can be written while the first run is pending.
  if (standing.measured === 0) return standing.briefed ? "waiting" : "content";
  return "results";
}

/**
 * The first phase that is not done yet. A missing knowledge base comes first
 * even on a project that is already measured: it is the highest-leverage fix.
 */
export function phaseOf(standing: Standing): Phase {
  if (!standing.project) return "project";
  if (!standing.knowledgeBase) return "knowledge_base";
  return trackingPhase(standing);
}

/** Whether each phase is behind the project, read from the state rather than from the order. */
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

/** What the current phase asks for, first step first. */
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

/**
 * What to do next: the current phase's steps, with the lead pipeline around
 * them. A prospect waiting to be contacted jumps the queue: it is the only
 * thing here that goes cold while nobody looks at it.
 */
export function nextSteps(standing: Standing, phase: Phase = phaseOf(standing)): string[] {
  const steps: string[] = [];

  if (standing.reports && standing.reports.waiting > 0) {
    steps.push(
      `${standing.reports.waiting} report(s) have someone asking to be contacted and no closed lead — get_report names who asked, how to reach them and what their report said.`
    );
  }

  steps.push(...phaseSteps(standing, phase));

  // A measured project with a blank knowledge base keeps the rest of its work in view.
  if (phase === "knowledge_base" && standing.prompts > 0) steps.push(...phaseSteps(standing, trackingPhase(standing)));

  if (standing.reports && standing.reports.unconverted > 0) {
    steps.push(
      `${standing.reports.unconverted} finished report(s) are still only samples. Converting one into a tracked project — done in the app — is what turns a free report into ongoing monitoring.`
    );
  }

  return steps;
}

/** One line for the phase list: ✓ what is done, → where the project is. */
export function renderPhases(standing: Standing, phase: Phase = phaseOf(standing)): string {
  return PHASES.map((name) => (name === phase ? `→ ${name}` : isDone(standing, name) ? `✓ ${name}` : name)).join(
    " · "
  );
}

/**
 * The closing paragraph of a tool that moved the project along: which phase it
 * is in now, and the first thing that phase asks for. The write already
 * happened, so a failure to read the state drops the paragraph rather than the
 * result.
 */
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
