import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import type { CreatedReport } from "../../schemas/prompteye.js";
import { registerReportTools } from "../reports.js";

const CREATED_REPORT: CreatedReport = {
  id: "r1",
  brand: "Test Brand",
  domain: "test.example",
  email: "lead@test.example",
  status: "processing",
  score: null,
  reach: "national",
  country: "PL",
  language: "pl",
  createdAt: "2026-11-20T12:00:00.000Z",
  readyAt: null,
  url: "https://app.prompteye.com/public/report/r1",
  place: null,
};

async function connectedClient(calls: unknown[]): Promise<Client> {
  const fakeClient = {
    getAccount: async () => ({ id: "a1", email: "agency@example.com" }),
    createReport: async (input: unknown) => {
      calls.push(input);
      return { report: CREATED_REPORT, reused: false };
    },
  } as unknown as PromptEyeClient;

  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerReportTools(server, {
    client: fakeClient,
    baseUrl: "https://api.example",
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("create_report place field input schema", () => {
  it("accepts place with 500 characters", async () => {
    const calls: unknown[] = [];
    const client = await connectedClient(calls);
    const place500 = "x".repeat(500);

    const result = await client.callTool({
      name: "create_report",
      arguments: {
        brand: "Test Brand",
        email: "lead@test.example",
        website: "test.example",
        country: "PL",
        place: place500,
      },
    });

    expect(result.isError).toBeFalsy();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ place: place500 });
  });

  it("rejects place with 501 characters", async () => {
    const calls: unknown[] = [];
    const client = await connectedClient(calls);
    const place501 = "x".repeat(501);

    const result = await client.callTool({
      name: "create_report",
      arguments: {
        brand: "Test Brand",
        email: "lead@test.example",
        website: "test.example",
        country: "PL",
        place: place501,
      },
    });

    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("accepts omitted place", async () => {
    const calls: unknown[] = [];
    const client = await connectedClient(calls);

    const result = await client.callTool({
      name: "create_report",
      arguments: {
        brand: "Test Brand",
        email: "lead@test.example",
        website: "test.example",
        country: "PL",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(calls).toHaveLength(1);
  });
});
