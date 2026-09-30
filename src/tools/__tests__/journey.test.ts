import type { PromptEyeClient } from "../../client/prompteye-client.js";
import type { Account, Project, Prompt, PromptGroup, PromptSuggestion } from "../../schemas/prompteye.js";
import { ProjectSession } from "../../session.js";
import { nextSteps, phaseOf, readStanding, renderPhases, whatNext, type Standing } from "../journey.js";
import { countPrompts, type PromptRef } from "../prompt-counts.js";
import type { ToolContext } from "../result.js";

const ACCOUNT: Account = {
  id: "a1",
  email: "anna@prompteye.com",
  plan: { key: "3", name: "Pro" },
  addons: [],
  scopes: ["api_access"],
  promptCount: 0,
  promptLimit: 200,
  models: ["gpt"],
  scanFrequency: "daily",
  nextScanAt: "2026-09-30T02:00:00.000Z",
};

const PROJECT = { id: "p1", name: "Acme", brand: "Acme", domain: "acme.example", country: "PL" } as Project;

const refs = (count: number, prefix = "t"): PromptRef[] =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}${index}`, prompt: `question ${prefix}${index}` }));

const counts = (active: number, paused = 0) => ({ active, paused, total: active + paused, more: false });

const standing = (overrides: Partial<Standing> = {}): Standing => ({
  account: ACCOUNT,
  project: PROJECT,
  projectCount: 1,
  knowledgeBase: true,
  prompts: counts(3),
  measured: 3,
  neverNamed: [],
  awaitingFirstRun: [],
  paused: [],
  groups: [{ id: "g1", name: "CRM", active: 3, paused: 0, suggestions: 0 }],
  suggestions: 0,
  briefed: false,
  reports: null,
  ...overrides,
});

let promptId = 0;

const prompt = (visibility: number | null, status = "active", groupId: string | null = null): Prompt =>
  ({
    id: `t${promptId++}`,
    prompt: `q${promptId}`,
    status,
    groupId,
    metrics: { visibility, reachIndex: null, averagePosition: null },
  }) as Prompt;

const group = (id: string, name: string): PromptGroup => ({ id, name }) as PromptGroup;

const suggestion = (groupId: string): PromptSuggestion => ({ id: `s-${groupId}`, groupId }) as PromptSuggestion;

function clientWith({
  knowledgeBase = "Acme sells CRM.",
  prompts = [] as Prompt[],
  groups = [] as PromptGroup[],
  suggestions = [] as PromptSuggestion[],
  account = ACCOUNT,
} = {}): PromptEyeClient {
  return {
    getAccount: async () => account,
    listProjects: async () => ({ data: [PROJECT] }),
    listReports: async () => {
      throw new Error("no reports scope");
    },
    getKnowledgeBase: async () => ({ text: knowledgeBase, updatedAt: null }),
    listPrompts: async () => ({ data: prompts, nextCursor: null }),
    listPromptGroups: async () => ({ data: groups, nextCursor: null }),
    listPromptSuggestions: async () => ({ data: suggestions }),
  } as unknown as PromptEyeClient;
}

const contextWith = (client: PromptEyeClient): ToolContext => ({
  client,
  session: new ProjectSession(client),
  baseUrl: "https://example.convex.site",
});

describe("phaseOf", () => {
  it("walks the phases in order", () => {
    expect(phaseOf(standing({ project: null, projectCount: 0 }))).toBe("project");
    expect(phaseOf(standing({ knowledgeBase: false }))).toBe("knowledge_base");
    expect(phaseOf(standing({ prompts: counts(0), measured: 0 }))).toBe("prompts");
    expect(phaseOf(standing({ measured: 0, awaitingFirstRun: refs(3) }))).toBe("content");
    expect(phaseOf(standing({ measured: 0, awaitingFirstRun: refs(3), briefed: true }))).toBe("waiting");
    expect(phaseOf(standing({ measured: 2, awaitingFirstRun: refs(1) }))).toBe("results");
  });

  it("sends a project whose prompts are all paused back to prompts, not to waiting", () => {
    const allPaused = standing({ prompts: counts(0, 3), paused: refs(3, "p") });
    expect(phaseOf(allPaused)).toBe("prompts");
    expect(nextSteps(allPaused)[0]).toMatch(/All 3 prompt\(s\) are paused/);
    expect(nextSteps(allPaused)[0]).toMatch(/"question p0" \(p0\)/);
  });

  it("asks for the knowledge base before prompts even when prompts exist", () => {
    expect(phaseOf(standing({ knowledgeBase: false, prompts: counts(0) }))).toBe("knowledge_base");
  });
});

describe("nextSteps", () => {
  it("says suggestions come from the app when there are none", () => {
    const [step] = nextSteps(standing({ prompts: counts(0), measured: 0, suggestions: 0 }));
    expect(step).toMatch(/no suggestions/);
    expect(step).toMatch(/PromptEye app/);
  });

  it("points at the suggestions when there are some", () => {
    const [step] = nextSteps(standing({ prompts: counts(0), measured: 0, suggestions: 4 }));
    expect(step).toMatch(/4 suggestion\(s\)/);
  });

  it("offers articles and names the next run while nothing is measured", () => {
    const steps = nextSteps(standing({ measured: 0, awaitingFirstRun: refs(3) }));
    expect(steps[0]).toMatch(/create_content_brief/);
    expect(steps[0]).toMatch(/"question t0" \(t0\), "question t1" \(t1\), "question t2" \(t2\)/);
    expect(steps[1]).toMatch(ACCOUNT.nextScanAt);
  });

  it("keeps a measured project's work in view while the knowledge base is missing", () => {
    const steps = nextSteps(standing({ knowledgeBase: false, neverNamed: refs(2) }));
    expect(steps[0]).toMatch(/Fill in the knowledge base/);
    expect(steps.some((step) => /2 prompt\(s\) that were never named/.test(step))).toBe(true);
  });

  it("puts a waiting lead first", () => {
    const steps = nextSteps(
      standing({ reports: { total: 1, more: false, waiting: 1, processing: 0, unconverted: 0 } })
    );
    expect(steps[0]).toMatch(/asking to be contacted/);
  });

  it("names the thin groups with their active prompts and waiting suggestions", () => {
    const steps = nextSteps(
      standing({
        groups: [
          { id: "g1", name: "CRM", active: 3, paused: 0, suggestions: 0 },
          { id: "g2", name: "Pricing", active: 1, paused: 1, suggestions: 4 },
          { id: "g3", name: "Support", active: 0, paused: 0, suggestions: 0 },
        ],
      })
    );
    const step = steps.find((line) => /prompt group\(s\)/.test(line));

    expect(step).toMatch(/^2 prompt group\(s\) have fewer than 3 active prompts/);
    expect(step).toMatch(/"Support" \(g3\): 0 active; "Pricing" \(g2\): 1 active, 1 paused, 4 suggestion\(s\) waiting/);
    expect(steps.join("\n")).not.toMatch(/"CRM"/);
  });

  it("names the active prompts awaiting a first run and the paused ones apart", () => {
    const steps = nextSteps(standing({ awaitingFirstRun: refs(1, "a"), paused: refs(1, "p"), prompts: counts(3, 1) }));

    expect(steps.find((line) => /not been measured yet/.test(line))).toMatch(/^1 active prompt\(s\).*"question a0"/);
    expect(steps.find((line) => /are paused and not asked/.test(line))).toMatch(/"question p0" \(p0\)/);
  });

  it("caps the prompts a step names", () => {
    const [step] = nextSteps(standing({ measured: 0, awaitingFirstRun: refs(8) }));

    expect(step).toMatch(/"question t4" \(t4\) and 3 more/);
    expect(step).not.toMatch(/"question t5"/);
  });
});

describe("renderPhases", () => {
  it("marks what is done and where the project is", () => {
    expect(renderPhases(standing({ prompts: counts(0), measured: 0 }))).toBe(
      "✓ project · ✓ knowledge_base · → prompts · content · waiting · results"
    );
  });

  it("reads done-ness from the state, not from the order", () => {
    expect(renderPhases(standing({ knowledgeBase: false }))).toBe(
      "✓ project · → knowledge_base · ✓ prompts · ✓ content · ✓ waiting · results"
    );
  });
});

describe("readStanding", () => {
  it("counts the prompts still waiting for their first run", async () => {
    const waiting = prompt(null);
    const context = contextWith(clientWith({ prompts: [waiting, prompt(0), prompt(40)] }));
    const read = await readStanding(context, PROJECT);

    expect(read.reports).toBeNull();
    expect(read.prompts).toEqual(counts(3));
    expect(read.awaitingFirstRun).toEqual([{ id: waiting.id, prompt: waiting.prompt }]);
    expect(read.neverNamed).toHaveLength(1);
  });

  it("does not count a paused prompt as waiting for its first run", async () => {
    const paused = prompt(null, "paused");
    const read = await readStanding(contextWith(clientWith({ prompts: [paused, prompt(40)] })), PROJECT);

    expect(read.prompts).toEqual(counts(1, 1));
    expect(read.awaitingFirstRun).toEqual([]);
    expect(read.paused).toEqual([{ id: paused.id, prompt: paused.prompt }]);
    expect(phaseOf(read)).toBe("results");
  });

  it("counts active prompts the way the account counter does, paused ones apart", async () => {
    const prompts = [...Array.from({ length: 25 }, () => prompt(20)), prompt(null, "paused")];
    const account = { ...ACCOUNT, promptCount: 25 };
    const read = await readStanding(contextWith(clientWith({ prompts, account })), PROJECT);

    expect(read.prompts).toEqual({ active: 25, paused: 1, total: 26, more: false });
    expect(read.prompts.active).toBe(read.account.promptCount);
    expect(countPrompts(prompts, false)).toEqual(read.prompts);
    expect(read.awaitingFirstRun).toEqual([]);
  });

  it("reads each group's active and paused prompts and its waiting suggestions", async () => {
    const read = await readStanding(
      contextWith(
        clientWith({
          prompts: [prompt(10, "active", "g1"), prompt(null, "paused", "g1"), prompt(10, "active", "g2")],
          groups: [group("g1", "CRM"), group("g2", "Pricing"), group("g3", "Support")],
          suggestions: [suggestion("g3"), suggestion("g3")],
        })
      ),
      PROJECT
    );

    expect(read.groups).toEqual([
      { id: "g1", name: "CRM", active: 1, paused: 1, suggestions: 0 },
      { id: "g2", name: "Pricing", active: 1, paused: 0, suggestions: 0 },
      { id: "g3", name: "Support", active: 0, paused: 0, suggestions: 2 },
    ]);
  });

  it("treats a blank knowledge base as missing", async () => {
    const read = await readStanding(contextWith(clientWith({ knowledgeBase: "  " })), PROJECT);
    expect(phaseOf(read)).toBe("knowledge_base");
  });

  it("moves to waiting once a brief was ordered in the session", async () => {
    const context = contextWith(clientWith({ prompts: [prompt(null)] }));
    expect(phaseOf(await readStanding(context, PROJECT))).toBe("content");

    context.session.noteBrief(PROJECT.id);
    expect(phaseOf(await readStanding(context, PROJECT))).toBe("waiting");
  });
});

describe("whatNext", () => {
  it("names the phase and its first step", async () => {
    const note = await whatNext(contextWith(clientWith({ knowledgeBase: "" })), PROJECT);
    expect(note).toMatch(/Phase: ✓ project · → knowledge_base/);
    expect(note).toMatch(/Next: Fill in the knowledge base/);
  });

  it("drops the note rather than the result when the state cannot be read", async () => {
    const client = { ...clientWith(), getAccount: async () => Promise.reject(new Error("down")) };
    await expect(whatNext(contextWith(client as PromptEyeClient), PROJECT)).resolves.toBe("");
  });
});
