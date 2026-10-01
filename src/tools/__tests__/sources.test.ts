import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import type { CitedDomain } from "../../schemas/prompteye.js";
import { ProjectSession } from "../../session.js";
import { registerSourceTools } from "../evidence.js";

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

describe("list_sources", () => {
  it("answers each share rounded to one decimal", async () => {
    const mcp = await connect(DOMAINS);

    const result = await mcp.callTool({ name: "list_sources", arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      data: [
        { domain: "wikipedia.org", sourceOccurrences: 412, share: 38.5, ownDomain: false },
        { domain: "acme.example", sourceOccurrences: 10, share: 0.9, ownDomain: true },
        { domain: "example.net", sourceOccurrences: 214, share: 20, ownDomain: false },
      ],
      nextCursor: null,
      projectName: "Acme — Germany",
      brand: "Acme",
      model: null,
    });
    expect(textOf(result)).not.toContain("38.52381");
  });
});
