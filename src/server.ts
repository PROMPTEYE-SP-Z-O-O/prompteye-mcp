import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { createClient, serverName, serverVersion } from "./config.js";
import { ProjectSession } from "./session.js";
import { registerAccountTools } from "./tools/account.js";
import { registerCompetitorTools } from "./tools/competitors.js";
import { registerEvidenceTools } from "./tools/evidence.js";
import { registerPromptTools } from "./tools/prompts.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerVisibilityTools, VISIBILITY_WIDGET_URI } from "./tools/visibility.js";
import type { ToolContext } from "./tools/result.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIDGET_HTML_PATH = path.resolve(__dirname, "../public/visibility-widget.html");

/**
 * The SDK's Zod v3 converter emits draft-07 output schemas. Claude Desktop
 * accepts draft 2020-12 only, so omit the optional output schemas rather than
 * advertising a dialect the client rejects. Tool results still include their
 * structured content.
 */
function withoutOutputSchemas(server: McpServer): McpServer {
  const originalRegisterTool = server.registerTool.bind(server) as (
    name: string,
    config: Record<string, unknown>,
    handler: unknown
  ) => unknown;

  return new Proxy(server, {
    get(target, property, receiver) {
      if (property !== "registerTool") return Reflect.get(target, property, receiver);

      return (name: string, config: Record<string, unknown>, handler: unknown) => {
        const compatibleConfig = { ...config };
        delete compatibleConfig.outputSchema;
        return originalRegisterTool(name, compatibleConfig, handler);
      };
    },
  }) as McpServer;
}

function loadWidgetHtml(): string {
  try {
    return fs.readFileSync(WIDGET_HTML_PATH, "utf-8");
  } catch {
    return "<html><body>Visibility widget unavailable</body></html>";
  }
}

/**
 * Builds one MCP server, and with it one project selection.
 *
 * Callers create a server per session — one per process over stdio, one per
 * `mcp-session-id` over HTTP — so the active project never leaks between clients.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: serverName, version: serverVersion },
    { capabilities: { resources: {} } }
  );

  const client = createClient();
  const context: ToolContext = { client, session: new ProjectSession(client) };
  const toolServer = withoutOutputSchemas(server);

  const widgetHtml = loadWidgetHtml();
  registerAppResource(
    server,
    "PromptEye Visibility",
    VISIBILITY_WIDGET_URI,
    { description: "Visibility totals, period-over-period change and breakdown for a project" },
    async () => ({
      contents: [{ uri: VISIBILITY_WIDGET_URI, mimeType: RESOURCE_MIME_TYPE, text: widgetHtml }],
    })
  );

  registerAccountTools(toolServer, context);
  registerProjectTools(toolServer, context);
  registerPromptTools(toolServer, context);
  registerVisibilityTools(toolServer, context);
  registerCompetitorTools(toolServer, context);
  registerEvidenceTools(toolServer, context);

  return server;
}
