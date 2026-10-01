import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import { ProjectSession } from "../../session.js";
import { registerIntegrationTools } from "../integrations.js";

type Handler = (args: Record<string, unknown>) => Promise<CallToolResult>;

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

const NOT_CONNECTED = { connected: false, reason: "not_connected" };

const registeredTool = (client: Partial<PromptEyeClient>) => {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) => handlers.set(name, handler),
  } as unknown as McpServer;
  const fullClient = { listProjects: async () => ({ data: [PROJECT] }), ...client } as PromptEyeClient;
  registerIntegrationTools(server, {
    client: fullClient,
    session: new ProjectSession(fullClient),
    baseUrl: "https://example.test",
  });
  return (name: string, args: Record<string, unknown> = {}) => handlers.get(name)!(args);
};

describe("get_integrations_status", () => {
  it("answers every integration of the active project as the API returns it", async () => {
    const status = {
      searchConsole: { connected: true, reason: null },
      analytics: { connected: true, reason: "sync_failing" },
      botLogs: NOT_CONNECTED,
      sitemap: { connected: true, reason: "quota_exceeded" },
    };
    const call = registeredTool({ getIntegrationsStatus: async () => status });

    const result = await call("get_integrations_status");

    expect(result.structuredContent).toEqual(status);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(status) }]);
  });
});
