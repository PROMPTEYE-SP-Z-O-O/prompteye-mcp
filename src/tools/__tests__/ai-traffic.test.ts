import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import type { PromptDetail } from "../../schemas/prompteye.js";
import { createMcpServer } from "../../server.js";
import { ProjectSession } from "../../session.js";

const PROJECT = {
  id: "p1",
  name: "Acme — Germany",
  brand: "Acme",
  domain: "acme.example",
  country: "DE",
  label: null,
  alternativeBrandNames: [],
  alternativeDomains: [],
  excludedCompetitors: [],
  accessRole: "OWNER",
  createdAt: "2026-09-01T10:00:00.000Z",
};

const PROMPT: PromptDetail = {
  id: "pr1",
  prompt: "best crm for small teams",
  keyword: "crm",
  status: "active",
  categories: [],
  subcategories: [],
  groupId: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  aiTraffic: null,
  aiTrafficMeasuredAt: null,
  businessPriority: null,
  businessPriorityReason: null,
  metrics: { visibility: null, reachIndex: null, averagePosition: null },
  change: null,
  byModel: [],
};

async function getPrompt(prompt: PromptDetail): Promise<CallToolResult> {
  const client = {
    listProjects: async () => ({ data: [PROJECT] }),
    getPrompt: async () => prompt,
  } as unknown as PromptEyeClient;
  const server = createMcpServer({ client, session: new ProjectSession(client), baseUrl: "https://api.example" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);
  await mcp.listTools();

  return (await mcp.callTool({ name: "get_prompt", arguments: { promptId: prompt.id } })) as CallToolResult;
}

describe("get_prompt passes aiTraffic through as the API returns it", () => {
  it.each([
    ["never measured", { aiTraffic: null, aiTrafficMeasuredAt: null }],
    ["measured below the reporting floor", { aiTraffic: 0, aiTrafficMeasuredAt: "2026-09-29T10:00:00.000Z" }],
    ["measured without a volume", { aiTraffic: null, aiTrafficMeasuredAt: "2026-09-29T10:00:00.000Z" }],
    ["measured", { aiTraffic: 70, aiTrafficMeasuredAt: "2026-09-29T10:00:00.000Z" }],
  ])("%s", async (_case, figures) => {
    const prompt = { ...PROMPT, ...figures };

    const result = await getPrompt(prompt);

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(prompt);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(prompt) }]);
  });

  it("accepts an API that does not report aiTrafficMeasuredAt yet", async () => {
    const prompt = { ...PROMPT, aiTraffic: 70 };
    delete prompt.aiTrafficMeasuredAt;

    const result = await getPrompt(prompt);

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(prompt);
  });
});
