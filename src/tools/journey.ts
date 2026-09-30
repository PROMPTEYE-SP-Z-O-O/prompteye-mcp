import { resolveDateRange } from "../schemas/common.js";
import type { Account, List, Project } from "../schemas/prompteye.js";
import {
  LISTED,
  THIN_GROUP,
  countPrompts,
  describeGroup,
  groupStandings,
  isAsked,
  named,
  thinGroups,
  toRef,
  type GroupStanding,
  type PromptCounts,
  type PromptRef,
} from "./prompt-counts.js";
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
  prompts: PromptCounts;
  measured: number;
  neverNamed: PromptRef[];
  awaitingFirstRun: PromptRef[];
  paused: PromptRef[];
  groups: GroupStanding[];
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
    prompts: countPrompts([], false),
    measured: 0,
    neverNamed: [],
    awaitingFirstRun: [],
    paused: [],
    groups: [],
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
    standing.prompts = countPrompts(prompts.data, prompts.nextCursor !== null);
    standing.measured = prompts.data.filter((prompt) => prompt.metrics.visibility !== null).length;
    standing.neverNamed = prompts.data.filter((prompt) => prompt.metrics.visibility === 0).map(toRef);
    standing.awaitingFirstRun = prompts.data
      .filter((prompt) => isAsked(prompt) && prompt.metrics.visibility === null)
      .map(toRef);
    standing.paused = prompts.data.filter((prompt) => !isAsked(prompt)).map(toRef);
    standing.groups = groupStandings(groups.data, prompts.data, suggestions.data);
    standing.suggestions = suggestions.data.length;
  }

  return standing;
}

function trackingPhase(standing: Standing): Phase {
  if (standing.prompts.active === 0) return "prompts";

  if (standing.measured === 0) return standing.briefed ? "waiting" : "content";
  return "results";
}

export function phaseOf(standing: Standing): Phase {
  if (!standing.project) return "project";
  if (!standing.knowledgeBase) return "knowledge_base";
  return trackingPhase(standing);
}

const DONE: Record<Phase, (standing: Standing) => boolean> = {
  project: (standing) => standing.project !== null,
  knowledge_base: (standing) => standing.knowledgeBase,
  prompts: (standing) => standing.prompts.active > 0,
  content: (standing) => standing.briefed || standing.measured > 0,
  waiting: (standing) => standing.measured > 0,
  results: () => false,
};

const firstRun = (account: Account): string =>
  `The next run starts ${account.nextScanAt} and takes tens of minutes to finish; the first figures arrive after it.`;

const promptSteps = (standing: Standing): string[] => {
  if (standing.prompts.total > 0) {
    return [
      `All ${standing.prompts.paused} prompt(s) are paused, so the next run asks nothing. Resume the ones worth ` +
        `tracking with update_prompt (${named(standing.paused)}), or pick new ones from list_prompt_suggestions.`,
    ];
  }
  return [
    standing.suggestions > 0
      ? `Pick the first prompts from the ${standing.suggestions} suggestion(s) list_prompt_suggestions returns; accepting them happens in the PromptEye app.`
      : "PromptEye has no suggestions for this project yet — they are generated inside a prompt group, " +
        "from the PromptEye app. Start the first prompts there. If the user already has prompts of their " +
        "own that must be tracked verbatim, add_prompts tracks them, after the user has chosen that.",
  ];
};

const groupStep = (standing: Standing): string[] => {
  const thin = thinGroups(standing.groups);
  if (thin.length === 0) return [];

  const shown = thin.slice(0, LISTED).map(describeGroup).join("; ");
  const rest = thin.length > LISTED ? ` and ${thin.length - LISTED} more` : "";
  return [
    `${thin.length} prompt group(s) have fewer than ${THIN_GROUP} active prompts: ${shown}${rest}. A group is the unit ` +
      "analysis happens in, so fill them: list_prompt_suggestions with that groupId shows what is waiting, " +
      "accepting happens in the PromptEye app.",
  ];
};

const awaitingStep = (standing: Standing): string[] =>
  standing.awaitingFirstRun.length > 0
    ? [
        `${standing.awaitingFirstRun.length} active prompt(s) have not been measured yet: ` +
          `${named(standing.awaitingFirstRun)}. ${firstRun(standing.account)}`,
      ]
    : [];

const pausedStep = (standing: Standing): string[] =>
  standing.paused.length > 0
    ? [
        `${standing.paused.length} prompt(s) are paused and not asked: ${named(standing.paused)}. Resume any ` +
          "still worth tracking with update_prompt; while paused they do not count against the plan.",
      ]
    : [];

const resultSteps = (standing: Standing): string[] => {
  const steps: string[] = [];
  if (standing.neverNamed.length > 0) {
    steps.push(
      `Look into the ${standing.neverNamed.length} prompt(s) that were never named (${named(standing.neverNamed)}): ` +
        "list_sources shows whose pages the assistants read instead, list_competitors who they named, and " +
        "create_content_brief outlines an article to answer that question."
    );
  }
  steps.push(...groupStep(standing));
  steps.push(
    `Read the standing of the ${standing.measured} measured prompt(s): list_prompts for what each question earns, ` +
      "list_competitors for share of voice, list_sources for the pages behind the answers."
  );
  if (standing.suggestions > 0) {
    steps.push(
      `Review the ${standing.suggestions} suggestion(s) waiting with list_prompt_suggestions — each says which funnel stage it fills and how well it fits the brand.`
    );
  }
  steps.push(...awaitingStep(standing));
  steps.push(...pausedStep(standing));
  return steps;
};

const STEPS: Record<Phase, (standing: Standing) => string[]> = {
  project: (standing) => [
    standing.projectCount === 0
      ? "Create the first project with create_project — one brand in one market. Nothing is measured until a project exists."
      : `Pick which of the ${standing.projectCount} project(s) to work on with select_project; every other tool reports on the active one.`,
  ],
  knowledge_base: () => [
    "Fill in the knowledge base. Show the user what the project knows with get_knowledge_base, ask them " +
      "for what is missing — industry, product category, target audience, ICP, operating area and a " +
      "description of what the brand does — and save it with update_knowledge_base. Every prompt " +
      "PromptEye proposes is written from it, so this comes before prompts.",
  ],
  prompts: promptSteps,
  content: (standing) => [
    `While the first run is pending for ${named(standing.awaitingFirstRun)}, order article outlines for the ` +
      "prompts that matter most: create_content_brief with that promptId, highest business priority first. " +
      "Each brief is the title and H2/H3 structure of an article written to be quoted for that question. " +
      "Optional — if the user does not publish content, go straight to waiting for the run.",
    firstRun(standing.account),
    ...groupStep(standing),
    ...pausedStep(standing),
  ],
  waiting: (standing) => [
    `Wait for the first measurement of ${named(standing.awaitingFirstRun)}. ${firstRun(standing.account)} ` +
      "Call get_started again once it has run.",
    "Meanwhile get_content_brief reads the outlines that were ordered.",
    ...pausedStep(standing),
  ],
  results: resultSteps,
};

const phaseSteps = (standing: Standing, phase: Phase): string[] => STEPS[phase](standing);

export function nextSteps(standing: Standing, phase: Phase = phaseOf(standing)): string[] {
  const steps: string[] = [];

  if (standing.reports && standing.reports.waiting > 0) {
    steps.push(
      `${standing.reports.waiting} report(s) have someone asking to be contacted and no closed lead — get_report names who asked, how to reach them and what their report said.`
    );
  }

  steps.push(...phaseSteps(standing, phase));

  if (phase === "knowledge_base" && standing.prompts.total > 0) {
    steps.push(...phaseSteps(standing, trackingPhase(standing)));
  }

  if (standing.reports && standing.reports.unconverted > 0) {
    steps.push(
      `${standing.reports.unconverted} finished report(s) are still only samples. Converting one into a tracked project — done in the app — is what turns a free report into ongoing monitoring.`
    );
  }

  return steps;
}

export function renderPhases(standing: Standing, phase: Phase = phaseOf(standing)): string {
  return PHASES.map((name) => (name === phase ? `→ ${name}` : DONE[name](standing) ? `✓ ${name}` : name)).join(
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
