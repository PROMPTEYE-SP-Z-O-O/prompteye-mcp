import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import type { CitedDomain } from "../../schemas/prompteye.js";
import { ProjectSession } from "../../session.js";
import { registerSourceTools } from "../evidence.js";
import { percent } from "../result.js";

const PROJECT = {
  id: "k9project",
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

const DOMAINS: CitedDomain[] = [
  { domain: "wikipedia.org", sourceOccurrences: 412, share: 38.52381, ownDomain: false },
  { domain: "acme.example", sourceOccurrences: 10, share: 0.93458, ownDomain: true },
  { domain: "example.net", sourceOccurrences: 214, share: 20, ownDomain: false },
];

async function connect(domains: CitedDomain[]) {
  const client = {
    listProjects: async () => ({ data: [PROJECT] }),
    listSources: async () => ({ data: domains, nextCursor: null }),
  } as unknown as PromptEyeClient;

  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerSourceTools(server, { client, session: new ProjectSession(client), baseUrl: "https://api.test" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);

  return mcp;
}

const textOf = (result: Awaited<ReturnType<Client["callTool"]>>): string =>
  (result.content as Array<{ type: string; text: string }>).map((part) => part.text).join("\n");

describe("percent", () => {
  it("rounds a share carrying five decimals to one", () => {
    expect(percent(38.52381)).toBe("38.5%");
  });

  it("keeps a whole share whole", () => {
    expect(percent(20)).toBe("20%");
    expect(percent(0)).toBe("0%");
  });

  it("says a share below one percent is below one percent", () => {
    expect(percent(0.93458)).toBe("<1%");
  });

  it("keeps no data legible", () => {
    expect(percent(null)).toBe("—");
  });
});

describe("list_sources", () => {
  it("renders each share as a rounded percentage", async () => {
    const mcp = await connect(DOMAINS);

    const text = textOf(await mcp.callTool({ name: "list_sources", arguments: {} }));

    expect(text).toContain("wikipedia.org — 412 source occurrence(s), 38.5% share");
    expect(text).toContain("acme.example ← own domain — 10 source occurrence(s), <1% share");
    expect(text).toContain("example.net — 214 source occurrence(s), 20% share");
    expect(text).not.toContain("38.52381");
  });
});
