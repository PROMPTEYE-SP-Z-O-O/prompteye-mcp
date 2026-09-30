import type { PromptEyeClient } from "../../client/prompteye-client.js";
import type { Account, Project, Prompt } from "../../schemas/prompteye.js";
import { ProjectSession } from "../../session.js";
import { nextSteps, phaseOf, readStanding, renderPhases, whatNext, type Standing } from "../journey.js";
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

const standing = (overrides: Partial<Standing> = {}): Standing => ({
  account: ACCOUNT,
  project: PROJECT,
  projectCount: 1,
  knowledgeBase: true,
  prompts: 3,
  more: false,
  asked: 3,
  measured: 3,
  neverNamed: 0,
  awaitingFirstRun: 0,
  groups: 1,
  suggestions: 0,
  promptList: [],
  groupList: [],
  suggestionList: [],
  briefed: false,
  reports: null,
  ...overrides,
});

const prompt = (visibility: number | null, status = "active"): Prompt =>
  ({ id: `t${visibility}`, prompt: "q", status, metrics: { visibility, reachIndex: null, averagePosition: null } }) as Prompt;

function clientWith({ knowledgeBase = "Acme sells CRM.", prompts = [] as Prompt[] } = {}): PromptEyeClient {
  return {
    getAccount: async () => ACCOUNT,
    listProjects: async () => ({ data: [PROJECT] }),
    listReports: async () => {
      throw new Error("no reports scope");
    },
    getKnowledgeBase: async () => ({ text: knowledgeBase, updatedAt: null }),
    listPrompts: async () => ({ data: prompts, nextCursor: null }),
    listPromptGroups: async () => ({ data: [], nextCursor: null }),
    listPromptSuggestions: async () => ({ data: [] }),
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
    expect(phaseOf(standing({ prompts: 0, asked: 0, measured: 0 }))).toBe("prompts");
    expect(phaseOf(standing({ measured: 0, awaitingFirstRun: 3 }))).toBe("content");
    expect(phaseOf(standing({ measured: 0, awaitingFirstRun: 3, briefed: true }))).toBe("waiting");
    expect(phaseOf(standing({ measured: 2, awaitingFirstRun: 1 }))).toBe("results");
  });

  it("sends a project whose prompts are all paused back to prompts, not to waiting", () => {
    expect(phaseOf(standing({ asked: 0, measured: 3 }))).toBe("prompts");
    expect(nextSteps(standing({ asked: 0, measured: 3 }))[0]).toMatch(/All 3 prompt\(s\) are paused/);
  });

  it("asks for the knowledge base before prompts even when prompts exist", () => {
    expect(phaseOf(standing({ knowledgeBase: false, prompts: 0 }))).toBe("knowledge_base");
  });
});

describe("nextSteps", () => {
  it("says suggestions come from the app when there are none", () => {
    const [step] = nextSteps(standing({ prompts: 0, asked: 0, measured: 0, suggestions: 0 }));
    expect(step).toMatch(/no suggestions/);
    expect(step).toMatch(/PromptEye app/);
  });

  it("points at the suggestions when there are some", () => {
    const [step] = nextSteps(standing({ prompts: 0, asked: 0, measured: 0, suggestions: 4 }));
    expect(step).toMatch(/4 suggestion\(s\)/);
  });

  it("offers articles and names the next run while nothing is measured", () => {
    const steps = nextSteps(standing({ measured: 0, awaitingFirstRun: 3 }));
    expect(steps[0]).toMatch(/create_content_brief/);
    expect(steps[1]).toMatch(ACCOUNT.nextScanAt);
  });

  it("keeps a measured project's work in view while the knowledge base is missing", () => {
    const steps = nextSteps(standing({ knowledgeBase: false, neverNamed: 2 }));
    expect(steps[0]).toMatch(/Fill in the knowledge base/);
    expect(steps.some((step) => /2 prompt\(s\) that were never named/.test(step))).toBe(true);
  });

  it("puts a waiting lead first", () => {
    const steps = nextSteps(
      standing({ reports: { total: 1, more: false, waiting: 1, processing: 0, unconverted: 0 } })
    );
    expect(steps[0]).toMatch(/asking to be contacted/);
  });
});

describe("renderPhases", () => {
  it("marks what is done and where the project is", () => {
    expect(renderPhases(standing({ prompts: 0, asked: 0, measured: 0 }))).toBe(
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
    const context = contextWith(clientWith({ prompts: [prompt(null), prompt(0), prompt(40)] }));
    const read = await readStanding(context, PROJECT);

    expect(read.reports).toBeNull();
    expect(read.prompts).toBe(3);
    expect(read.awaitingFirstRun).toBe(1);
    expect(read.neverNamed).toBe(1);
  });

  it("does not count a paused prompt as waiting for its first run", async () => {
    const read = await readStanding(contextWith(clientWith({ prompts: [prompt(null, "paused"), prompt(40)] })), PROJECT);

    expect(read.asked).toBe(1);
    expect(read.awaitingFirstRun).toBe(0);
    expect(phaseOf(read)).toBe("results");
  });

  it("hands over the API's prompt, group and suggestion lists untouched", async () => {
    const prompts = [prompt(null, "paused"), prompt(40)];
    const read = await readStanding(contextWith(clientWith({ prompts })), PROJECT);

    expect(read.promptList).toBe(prompts);
    expect(read.groupList).toEqual([]);
    expect(read.suggestionList).toEqual([]);
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
