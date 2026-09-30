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

const textOf = (result: CallToolResult) => (result.content[0] as { text: string }).text;

describe("get_integrations_status", () => {
  it("lists every integration of the active project", async () => {
    const status = {
      searchConsole: { connected: true, reason: null },
      analytics: { connected: true, reason: "sync_failing" },
      botLogs: NOT_CONNECTED,
      sitemap: NOT_CONNECTED,
    };
    const call = registeredTool({ getIntegrationsStatus: async () => status });

    const result = await call("get_integrations_status");

    expect(textOf(result).split("\n")).toEqual([
      "Integrations of Acme — Germany — Acme (acme.example):",
      "- Search Console: connected",
      "- Google Analytics: connected, but its last sync failed",
      "- Bot tracker: not connected",
      "- Sitemap: not connected",
    ]);
    expect(result.structuredContent).toEqual(status);
  });

  it("names a reason it has never seen rather than hiding it", async () => {
    const call = registeredTool({
      getIntegrationsStatus: async () => ({
        searchConsole: { connected: true, reason: "quota_exceeded" },
        analytics: NOT_CONNECTED,
        botLogs: NOT_CONNECTED,
        sitemap: NOT_CONNECTED,
      }),
    });

    const result = await call("get_integrations_status");

    expect(textOf(result)).toContain("- Search Console: quota_exceeded");
  });
});
