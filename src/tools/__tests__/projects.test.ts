import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import type { Project } from "../../schemas/prompteye.js";
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

const PUBLIC_LINK = { isPublic: true, url: "https://app.prompteye.com/public/project/3f9a1c7e5b2d" };

const publicLinkCalls: Array<{ projectId: string; enabled: boolean }> = [];

const fakeClient = {
  listProjects: async () => ({ data: [PROJECT] }),
  getProject: async () => PROJECT,
  createProject: async () => PROJECT,
  updateProject: async () => PROJECT,
  setProjectPublicLink: async (projectId: string, enabled: boolean) => {
    publicLinkCalls.push({ projectId, enabled });
    return enabled ? PUBLIC_LINK : { isPublic: false, url: null };
  },
} as unknown as PromptEyeClient;

async function connectedClient(): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerProjectTools(server, {
    client: fakeClient,
    baseUrl: "https://api.example",
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("project tools keep competitor exclusions to list_competitor_exclusions", () => {
  it.each([
    ["update_project", { projectId: PROJECT.id, name: "Acme DE" }],
    ["create_project", { brand: "Acme", domain: "acme.example", country: "DE" }],
  ])("%s answers the project without the flattened exclusion list", async (tool, args) => {
    const client = await connectedClient();
    const result = await client.callTool({ name: tool, arguments: args });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(PROJECT_OUTPUT);
  });

  it("list_projects answers every project without the flattened exclusion list", async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: "list_projects", arguments: {} });

    expect(result.structuredContent).toEqual({ data: [PROJECT_OUTPUT] });
  });

  it("list_projects keeps the workspace each project lives in", async () => {
    const inClientWorkspace = { ...PROJECT, workspaceId: "m976client", workspaceName: "Client Co" };
    const listProjects = fakeClient.listProjects;
    fakeClient.listProjects = async () => ({ data: [inClientWorkspace] });
    const client = await connectedClient();
    const result = await client.callTool({ name: "list_projects", arguments: {} });
    fakeClient.listProjects = listProjects;

    expect(result.structuredContent).toEqual({
      data: [{ ...PROJECT_OUTPUT, workspaceId: "m976client", workspaceName: "Client Co" }],
    });
  });

  it("points update_project at list_competitor_exclusions", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    const described = (name: string) => tools.find((tool) => tool.name === name)?.description ?? "";

    expect(described("update_project")).toContain("list_competitor_exclusions");
  });
});

describe("set_project_public_link", () => {
  beforeEach(() => {
    publicLinkCalls.length = 0;
  });

  it("publishes the given project and answers its link", async () => {
    const client = await connectedClient();

    const result = await client.callTool({
      name: "set_project_public_link",
      arguments: { projectId: PROJECT.id, enabled: true },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(PUBLIC_LINK);
    expect(publicLinkCalls).toEqual([{ projectId: PROJECT.id, enabled: true }]);
  });

  it("takes the link of the given project down", async () => {
    const client = await connectedClient();

    const result = await client.callTool({
      name: "set_project_public_link",
      arguments: { projectId: PROJECT.id, enabled: false },
    });

    expect(result.structuredContent).toEqual({ isPublic: false, url: null });
    expect(publicLinkCalls).toEqual([{ projectId: PROJECT.id, enabled: false }]);
  });

  it("refuses a change that names no project", async () => {
    const client = await connectedClient();

    const result = await client.callTool({ name: "set_project_public_link", arguments: { enabled: true } });

    expect(result.isError).toBe(true);
    expect(publicLinkCalls).toEqual([]);
  });
});
