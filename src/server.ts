import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, requireSettings, serverName, serverVersion } from "./config.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { registerPromptWorkflows } from "./prompts.js";
import { ProjectSession } from "./session.js";
import { registerWidget } from "./widgets.js";
import { registerAccountTools } from "./tools/account.js";
import { registerGettingStartedTools } from "./tools/getting-started.js";
import { COMPETITORS_WIDGET, registerCompetitorTools } from "./tools/competitors.js";
import { registerHelpTools } from "./tools/help.js";
import { registerGoogleTools } from "./tools/google.js";
import { registerTrafficTools } from "./tools/traffic.js";
import { SOURCES_WIDGET, registerEvidenceTools, registerSourceTools } from "./tools/evidence.js";
import { PROMPTS_WIDGET, registerPromptTools } from "./tools/prompts.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerReportTools } from "./tools/reports.js";
import { VISIBILITY_WIDGET, registerVisibilityTools } from "./tools/visibility.js";
import type { ToolContext } from "./tools/result.js";

/**
 * Whether to register the tools the PromptEye API does not serve yet —
 * visibility, answers and citation quality — which answer from the sample data
 * in `src/fixtures`.
 *
 * Off, so nothing offers a figure that was not measured for the user's project.
 * Flip it to true to demo those tools; delete it, with the fixtures, once the
 * API serves them and the methods move to `live-client.ts`.
 */
const SAMPLE_TOOLS = false;

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

/**
 * Builds one MCP server, and with it one project selection.
 *
 * Callers create a server per session — one per process over stdio, one per
 * `mcp-session-id` over HTTP — so the active project never leaks between clients.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: serverName, version: serverVersion },
    { capabilities: { resources: {}, prompts: {} }, instructions: SERVER_INSTRUCTIONS }
  );

  const client = createClient();
  const { baseUrl } = requireSettings();
  const context: ToolContext = { client, session: new ProjectSession(client), baseUrl };
  const toolServer = withoutOutputSchemas(server);

  // First, so a host reading the tool list meets the orientation tool before the rest.
  registerGettingStartedTools(toolServer, context);
  registerPromptWorkflows(server);

  registerAccountTools(toolServer, context);
  registerProjectTools(toolServer, context);

  registerWidget(
    server,
    PROMPTS_WIDGET,
    "PromptEye Prompts",
    "The prompts a project is tracked on, with the visibility each earned in the period"
  );
  registerPromptTools(toolServer, context);

  // Each page is registered next to the tool that renders it.
  registerWidget(
    server,
    SOURCES_WIDGET,
    "PromptEye Sources",
    "The domains the assistants cite on a project's prompts, ranked by share of citations"
  );
  registerSourceTools(toolServer, context);

  registerWidget(
    server,
    COMPETITORS_WIDGET,
    "PromptEye Competitors",
    "The brands answering alongside a project's own, ranked by share of voice"
  );
  registerCompetitorTools(toolServer, context);
  registerGoogleTools(toolServer, context);
  registerTrafficTools(toolServer, context);
  registerReportTools(toolServer, context);
  registerHelpTools(toolServer);

  if (SAMPLE_TOOLS) {
    registerWidget(
      server,
      VISIBILITY_WIDGET,
      "PromptEye Visibility",
      "Visibility totals, period-over-period change and breakdown for a project"
    );
    registerVisibilityTools(toolServer, context);
    registerEvidenceTools(toolServer, context);
  }

  return server;
}
