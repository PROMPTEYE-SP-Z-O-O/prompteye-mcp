import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { PromptEyeClient } from "../client/prompteye-client.js";
import { createMcpServer } from "../server.js";
import { ProjectSession } from "../session.js";

const PROJECT = {
  id: "p1",
  name: "Acme — Germany",
  brand: "Acme",
  domain: "acme.example",
  country: "DE",
  label: null,
  alternativeBrandNames: [],
  alternativeDomains: [],
  excludedCompetitors: ["Rival Agency"],
  accessRole: "OWNER",
  createdAt: "2026-09-01T10:00:00.000Z",
};

const ACCOUNT = {
  id: "a1",
  email: "anna@acme.example",
  plan: null,
  addons: [],
  scopes: [],
  promptCount: 200,
  promptLimit: 200,
  models: [],
  scanFrequency: "daily",
  nextScanAt: "2026-10-02T02:00:00.000Z",
};

const UNMEASURED = { visibility: null, reachIndex: null, averagePosition: null };

const PROMPTS = {
  data: [
    {
      id: "pr1",
      prompt: "best crm for small teams",
      keyword: "",
      status: "active",
      categories: [],
      subcategories: [],
      groupId: null,
      createdAt: "2026-09-01T10:00:00.000Z",
      aiTraffic: null,
      aiTrafficMeasuredAt: null,
      businessPriority: null,
      businessPriorityReason: null,
      metrics: UNMEASURED,
      change: null,
    },
  ],
  nextCursor: "c2",
};

const COMPETITORS = {
  data: [
    {
      brand: "Acme",
      ownBrand: true,
      metrics: UNMEASURED,
      change: null,
      shareOfVoice: null,
      citedAnswers: null,
      citationShare: null,
    },
  ],
  nextCursor: null,
};

const SEARCH_SUMMARY = { clicks: 0, impressions: 0, ctr: 0, position: 0, timeline: [] };

const NO_SITEMAP = { sitemap: null, data: [], nextCursor: null };

const WORKSPACES = {
  data: [{ id: "w1", name: "Acme", kind: "personal", role: "OWNER", scoped: false }],
  nextCursor: null,
};

const CRAWL_HEALTH = {
  total: 0,
  success: 0,
  redirects: 0,
  clientErrors: 0,
  serverErrors: 0,
  unknown: 0,
  scanRequests: 0,
  averageResponseTimeMs: null,
  assessments: [{ key: "responseTime", level: "unknown", count: null, rate: null, averageResponseTimeMs: null }],
  issues: [],
};

const SUGGESTION_RUN = { runId: null, skipped: "nothing_to_suggest" };

const fakeClient = {
  listProjects: async () => ({ data: [PROJECT] }),
  getAccount: async () => ACCOUNT,
  listWorkspaces: async () => WORKSPACES,
  listPrompts: async () => PROMPTS,
  listCompetitors: async () => COMPETITORS,
  getSearchSummary: async () => SEARCH_SUMMARY,
  getSitemap: async () => NO_SITEMAP,
  getCrawlHealth: async () => CRAWL_HEALTH,
  generatePromptSuggestions: async () => SUGGESTION_RUN,
} as unknown as PromptEyeClient;

async function connectedClient(): Promise<Client> {
  const server = createMcpServer({
    client: fakeClient,
    session: new ProjectSession(fakeClient),
    baseUrl: "https://api.example",
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  await client.listTools();
  return client;
}

const DRAFT_07_ONLY = ["definitions", "dependencies", "additionalItems"];

const draft07Keywords = (schema: unknown): string[] => {
  if (Array.isArray(schema)) return schema.flatMap(draft07Keywords);
  if (schema === null || typeof schema !== "object") return [];

  return Object.entries(schema).flatMap(([key, value]) => [
    ...(DRAFT_07_ONLY.includes(key) || (key === "items" && Array.isArray(value)) ? [key] : []),
    ...draft07Keywords(value),
  ]);
};

describe("initialize", () => {
  it("introduces the server with the PromptEye icon", async () => {
    const client = await connectedClient();

    expect(client.getServerVersion()?.icons).toEqual([
      expect.objectContaining({ src: expect.stringMatching(/^data:image\/png;base64,iVBOR/), mimeType: "image/png" }),
    ]);
  });
});

describe("tools/list", () => {
  it("advertises an output schema in JSON Schema 2020-12 for every tool", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();

    expect(tools.length).toBeGreaterThan(0);
    tools.forEach((tool) => {
      expect(tool.outputSchema).toMatchObject({ $schema: "https://json-schema.org/draft/2020-12/schema" });
      expect(draft07Keywords(tool.outputSchema)).toEqual([]);
    });
  });
});

describe("tool results", () => {
  it.each([
    ["get_account", {}, ACCOUNT],
    ["list_prompts", {}, { ...PROMPTS, projectName: PROJECT.name, brand: PROJECT.brand }],
    ["list_competitors", {}, { ...COMPETITORS, projectName: PROJECT.name, brand: PROJECT.brand, model: null }],
    ["get_search_performance", {}, { by: null, summary: SEARCH_SUMMARY, data: null, nextCursor: null }],
    ["get_sitemap", {}, NO_SITEMAP],
    ["list_workspaces", {}, WORKSPACES],
    ["get_crawl_health", { kind: "ai" }, CRAWL_HEALTH],
    ["generate_prompt_suggestions", { groupId: "g1" }, SUGGESTION_RUN],
  ])("%s answers the API data as structured content and as its serialized JSON", async (name, args, expected) => {
    const client = await connectedClient();
    const result = (await client.callTool({ name, arguments: args })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(expected);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(expected) }]);
  });
});

const fieldOf = (schema: unknown, path: string[]): Record<string, unknown> =>
  path.reduce(
    (node, key) => (key === "[]" ? node.items : (node.properties as Record<string, unknown>)[key]) as Record<string, unknown>,
    schema as Record<string, unknown>
  );

describe("output schema descriptions", () => {
  it.each([
    ["list_prompts", ["data", "[]", "aiTraffic"], "0 = measured, below the reporting floor of 50 searches a month"],
    ["list_prompts", ["data", "[]", "aiTraffic"], "null = no figure"],
    ["list_prompts", ["data", "[]", "aiTrafficMeasuredAt"], "null = never measured"],
    ["get_prompt", ["aiTrafficMeasuredAt"], "null = never measured"],
    ["list_prompts", ["data", "[]", "metrics", "visibility"], "percent 0-100. null = not measured"],
    ["list_prompts", ["data", "[]", "change"], "null = no figure could be compared"],
    ["list_prompts", ["data", "[]", "businessPriority"], "null = not ranked yet"],
    ["list_prompts", ["nextCursor"], "null = this was the last page"],
    ["list_prompt_groups", ["data", "[]", "aiTrafficTotal"], "null = none of them has a measured figure"],
    ["list_competitors", ["data", "[]", "shareOfVoice"], "whole percent 0-100"],
    ["list_competitors", ["data", "[]", "citationShare"], "null = no answer carried sources"],
    ["list_sources", ["data", "[]", "share"], "percent 0-100"],
    ["get_report", ["score"], "null = the report is not ready yet"],
    ["get_content_brief", ["outline"], "null until ready"],
    ["get_sitemap", ["sitemap"], "null = no sitemap is connected"],
    ["list_workspaces", ["data", "[]", "role"], "VIEWER reads only"],
    ["get_crawl_health", ["assessments", "[]", "level"], "ok, warning or critical"],
    ["generate_prompt_suggestions", ["skipped"], "set exactly when runId is null"],
    ["get_brand_analysis_run", ["sentiment"], "null until ready"],
    ["get_audit", ["results", "[]", "analysis"], "null until status is success"],
    ["get_topical_map", ["pillar"], "null until ready"],
  ])("%s advertises what %j means", async (name, path, meaning) => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === name);

    expect(fieldOf(tool?.outputSchema, path).description).toContain(meaning);
  });
});
