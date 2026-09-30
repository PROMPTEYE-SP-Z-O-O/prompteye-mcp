import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { PromptEyeApiError } from "../../api/index.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import type { Account, Project, Prompt, PromptGroup, Report } from "../../schemas/prompteye.js";
import { ProjectSession } from "../../session.js";
import { registerGettingStartedTools } from "../getting-started.js";

const ACCOUNT: Account = {
  id: "a1",
  email: "anna@prompteye.com",
  plan: { key: "3", name: "Pro" },
  addons: [],
  scopes: ["api_access"],
  promptCount: 2,
  promptLimit: 200,
  models: ["gpt"],
  scanFrequency: "daily",
  nextScanAt: "2026-09-30T02:00:00.000Z",
};

const PROJECT: Project = {
  id: "p1",
  name: "Acme",
  brand: "Acme",
  domain: "acme.example",
  country: "PL",
  label: null,
  alternativeBrandNames: [],
  alternativeDomains: [],
  excludedCompetitors: [],
  accessRole: "OWNER",
  createdAt: "2026-09-01T10:00:00.000Z",
};

const PROMPTS = {
  data: [
    {
      id: "t1",
      prompt: "best crm",
      keyword: "",
      status: "paused",
      categories: [],
      subcategories: [],
      groupId: "g1",
      createdAt: "2026-09-01T10:00:00.000Z",
      aiTraffic: null,
      businessPriority: null,
      businessPriorityReason: null,
      metrics: { visibility: null, reachIndex: null, averagePosition: null },
      change: null,
    },
  ] as Prompt[],
  nextCursor: "c2",
};

const GROUPS = {
  data: [
    {
      id: "g1",
      name: "Comparisons",
      description: null,
      order: 1,
      promptCount: 1,
      aiTrafficTotal: null,
      metrics: { visibility: null, reachIndex: null, averagePosition: null },
    },
  ] as PromptGroup[],
  nextCursor: null,
};

const REPORTS = {
  data: [
    {
      id: "r1",
      brand: "Rival",
      domain: "rival.example",
      email: "lead@rival.example",
      status: "ready",
      score: 40,
      reach: "national",
      country: "pl",
      language: "pl",
      utm: null,
      leadStatus: "new",
      projectId: null,
      contactCount: 2,
      createdAt: "2026-09-20T10:00:00.000Z",
      readyAt: "2026-09-20T10:05:00.000Z",
      url: "https://reports.test/r1",
    },
  ] as Report[],
  nextCursor: null,
};

function clientWith(overrides: Partial<PromptEyeClient> = {}): PromptEyeClient {
  return {
    getAccount: async () => ACCOUNT,
    listProjects: async () => ({ data: [PROJECT] }),
    getProject: async () => PROJECT,
    listReports: async () => REPORTS,
    getKnowledgeBase: async () => ({ text: "Acme sells CRM.", updatedAt: null }),
    listPrompts: async () => PROMPTS,
    listPromptGroups: async () => GROUPS,
    listPromptSuggestions: async () => ({ data: [] }),
    ...overrides,
  } as unknown as PromptEyeClient;
}

async function callGetStarted(client: PromptEyeClient) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerGettingStartedTools(server, { client, session: new ProjectSession(client), baseUrl: "https://api.test" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);

  const result = await mcp.callTool({ name: "get_started", arguments: {} });
  const text = (result.content as Array<{ type: string; text: string }>).map((part) => part.text).join("\n");
  return { result, text };
}

describe("get_started", () => {
  it("hands over what the API returned, untouched", async () => {
    const { result } = await callGetStarted(clientWith());

    expect(result.structuredContent).toEqual({
      account: ACCOUNT,
      projects: { data: [PROJECT] },
      project: PROJECT,
      knowledgeBase: { text: "Acme sells CRM.", updatedAt: null },
      prompts: PROMPTS,
      groups: GROUPS,
      suggestions: { data: [] },
      reports: REPORTS,
    });
  });

  it("renders every entry the API listed", async () => {
    const { text } = await callGetStarted(clientWith());

    expect(text).toContain("Active project: Acme");
    expect(text).toContain("Acme sells CRM.");
    expect(text).toContain('- "best crm" (paused)');
    expect(text).toContain("- Comparisons (order 1)");
    expect(text).toContain("Pending suggestions:\nnone");
    expect(text).toContain("- Rival (rival.example) — ready, score 40%, lead new, 2 contact request(s)");
  });

  it("passes on why the reports could not be read and still reports the rest", async () => {
    const forbidden = new PromptEyeApiError(403, {
      error: { code: "forbidden", message: "The key lacks the reports scope." },
    });
    const { result, text } = await callGetStarted(
      clientWith({ listReports: async () => Promise.reject(forbidden) })
    );

    expect(result.isError).toBeFalsy();
    expect(text).toContain("Public reports could not be read: PromptEye API error 403");
    expect(text).toContain('- "best crm" (paused)');
  });
});
