import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PromptEyeApiError } from "../../api/errors.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import { registerCompetitorGroupTools } from "../competitor-groups.js";

const PKO = {
  id: "g1",
  name: "PKO BP",
  aliases: ["PKO Bank Polski"],
  excludedNames: [],
};

const CONFLICT_MESSAGE =
  "These names already belong to different groups: “PKO Bank Polski” is in the group “PKO BP”, " +
  "“ING Bank Śląski” is in the group “ING”. Merge names from one group only, or ungroup one of the groups first.";

const calls: Array<{ method: string; args: unknown[] }> = [];

const fakeClient = {
  listCompetitorGroups: async (...args: unknown[]) => {
    calls.push({ method: "listCompetitorGroups", args });
    return { data: [PKO] };
  },
  mergeCompetitors: async (...args: unknown[]) => {
    calls.push({ method: "mergeCompetitors", args });
    const [, names] = args as [string, string[]];
    if (names.includes("ING Bank Śląski")) {
      throw new PromptEyeApiError(409, {
        error: { code: "conflict", message: CONFLICT_MESSAGE },
      });
    }
    return PKO;
  },
  ungroupCompetitors: async (...args: unknown[]) => {
    calls.push({ method: "ungroupCompetitors", args });
    return PKO;
  },
} as unknown as PromptEyeClient;

async function connectedClient(): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerCompetitorGroupTools(server, {
    client: fakeClient,
    baseUrl: "https://api.example",
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

beforeEach(() => {
  calls.length = 0;
});

describe("competitor group tools", () => {
  it("list_competitor_groups answers the project's groups", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "list_competitor_groups",
      arguments: { projectId: "p1" },
    });

    expect(result.structuredContent).toEqual({ data: [PKO] });
    expect(calls).toEqual([{ method: "listCompetitorGroups", args: ["p1"] }]);
  });

  it("merge_competitors hands the names and the group name to the API", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "merge_competitors",
      arguments: {
        projectId: "p1",
        names: ["PKO BP", "PKO Bank Polski"],
        groupName: "PKO BP",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(PKO);
    expect(calls).toEqual([
      {
        method: "mergeCompetitors",
        args: ["p1", ["PKO BP", "PKO Bank Polski"], "PKO BP"],
      },
    ]);
  });

  it("merge_competitors passes the API's reason on when names sit in two groups", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "merge_competitors",
      arguments: {
        projectId: "p1",
        names: ["PKO Bank Polski", "ING Bank Śląski"],
      },
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(
      "“PKO Bank Polski” is in the group “PKO BP”",
    );
  });

  it("ungroup_competitors takes the group apart by its id", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "ungroup_competitors",
      arguments: { projectId: "p1", groupId: "g1" },
    });

    expect(result.structuredContent).toEqual(PKO);
    expect(calls).toEqual([
      { method: "ungroupCompetitors", args: ["p1", "g1"] },
    ]);
  });

  it("neither write tool is flagged as destructive", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();

    for (const name of ["merge_competitors", "ungroup_competitors"]) {
      expect(
        tools.find((tool) => tool.name === name)?.annotations?.destructiveHint,
      ).toBe(false);
    }
  });
});
