import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import type { Project } from "../../schemas/prompteye.js";
import { ProjectSession } from "../../session.js";
import { registerProjectTools } from "../projects.js";

const PROJECT_OUTPUT = {
  id: "k9project",
  name: "Acme — Germany",
  brand: "Acme",
  domain: "acme.example",
  country: "DE",
  label: null,
  alternativeBrandNames: [],
  alternativeDomains: [],
  accessRole: "OWNER",
  createdAt: "2026-09-01T10:00:00.000Z",
};

const PROJECT: Project = {
  ...PROJECT_OUTPUT,
  excludedCompetitors: ["Rival Agency", "Rival", "Rival Agency GmbH", "Marketplace"],
};

const fakeClient = {
  listProjects: async () => ({ data: [PROJECT] }),
  getProject: async () => PROJECT,
  createProject: async () => PROJECT,
  updateProject: async () => PROJECT,
} as unknown as PromptEyeClient;

async function connectedClient(): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerProjectTools(server, {
    client: fakeClient,
    session: new ProjectSession(fakeClient),
    baseUrl: "https://api.example",
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("project tools keep competitor exclusions to list_competitor_exclusions", () => {
  it.each([
    ["select_project", { projectId: PROJECT.id }],
    ["update_project", { name: "Acme DE" }],
    ["create_project", { brand: "Acme", domain: "acme.example", country: "DE" }],
  ])("%s answers the project without the flattened exclusion list", async (tool, args) => {
    const client = await connectedClient();
    const result = await client.callTool({ name: tool, arguments: args });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(PROJECT_OUTPUT);
  });

  it("get_active_project answers the project without the flattened exclusion list", async () => {
    const client = await connectedClient();
    await client.callTool({ name: "select_project", arguments: { projectId: PROJECT.id } });
    const result = await client.callTool({ name: "get_active_project", arguments: {} });

    expect(result.structuredContent).toEqual(PROJECT_OUTPUT);
  });

  it("list_projects answers every project without the flattened exclusion list", async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: "list_projects", arguments: {} });

    expect(result.structuredContent).toEqual({ data: [PROJECT_OUTPUT] });
  });

  it("points select_project and update_project at list_competitor_exclusions", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    const described = (name: string) => tools.find((tool) => tool.name === name)?.description ?? "";

    expect(described("select_project")).toContain("list_competitor_exclusions");
    expect(described("update_project")).toContain("list_competitor_exclusions");
  });
});
