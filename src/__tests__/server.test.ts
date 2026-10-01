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

const fakeClient = {
  listProjects: async () => ({ data: [PROJECT] }),
  getAccount: async () => ACCOUNT,
  listPrompts: async () => PROMPTS,
  listCompetitors: async () => COMPETITORS,
  getSearchSummary: async () => SEARCH_SUMMARY,
  getSitemap: async () => NO_SITEMAP,
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
  ])("%s answers the API data as structured content and as its serialized JSON", async (name, args, expected) => {
    const client = await connectedClient();
    const result = (await client.callTool({ name, arguments: args })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(expected);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(expected) }]);
  });
});
