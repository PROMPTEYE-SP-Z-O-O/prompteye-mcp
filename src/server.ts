import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema, type ListToolsRequest, type ListToolsResult, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { createClient, serverName, serverVersion, type ApiCredentials } from "./config.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { registerPromptWorkflows } from "./prompts.js";
import { ProjectSession } from "./session.js";
import { registerWidget } from "./widgets.js";
import { registerAccountTools } from "./tools/account.js";
import { COMPETITORS_WIDGET, registerCompetitorTools } from "./tools/competitors.js";
import { registerContentTools } from "./tools/content.js";
import { registerFeedbackTools } from "./tools/feedback.js";
import { registerHelpTools } from "./tools/help.js";
import { registerGoogleTools } from "./tools/google.js";
import { registerIntegrationTools } from "./tools/integrations.js";
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

const JSON_SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema";

const withDraft202012OutputSchema = (tool: Tool): Tool =>
  tool.outputSchema === undefined ? tool : { ...tool, outputSchema: { ...tool.outputSchema, $schema: JSON_SCHEMA_2020_12 } };

type ToolListing = (request: ListToolsRequest, extra: unknown) => ListToolsResult | Promise<ListToolsResult>;

const listingDraft202012OutputSchemas =
  (listTools: ToolListing): ToolListing =>
  async (request, extra) => {
    const result = await listTools(request, extra);
    return { ...result, tools: result.tools.map(withDraft202012OutputSchema) };
  };

function advertiseDraft202012OutputSchemas(server: McpServer): void {
  const protocol = server.server;
  const setRequestHandler = protocol.setRequestHandler.bind(protocol) as (schema: object, handler: ToolListing) => void;

  protocol.setRequestHandler = ((schema: object, handler: ToolListing) =>
    setRequestHandler(
      schema,
      schema === ListToolsRequestSchema ? listingDraft202012OutputSchemas(handler) : handler
    )) as typeof protocol.setRequestHandler;
}

export function buildToolContext(credentials: ApiCredentials): ToolContext {
  const client = createClient(credentials);
  return { client, session: new ProjectSession(client), baseUrl: credentials.baseUrl };
}

export function createMcpServer(context: ToolContext): McpServer {
  const server = new McpServer(
    { name: serverName, version: serverVersion },
    { capabilities: { resources: {}, prompts: {} }, instructions: SERVER_INSTRUCTIONS }
  );

  advertiseDraft202012OutputSchemas(server);

  registerPromptWorkflows(server);

  registerAccountTools(server, context);
  registerProjectTools(server, context);

  registerWidget(
    server,
    PROMPTS_WIDGET,
    "PromptEye Prompts",
    "The prompts a project is tracked on, with the visibility each earned in the period"
  );
  registerPromptTools(server, context);

  // Each page is registered next to the tool that renders it.
  registerWidget(
    server,
    SOURCES_WIDGET,
    "PromptEye Sources",
    "The domains the assistants cite on a project's prompts, ranked by share of citations"
  );
  registerSourceTools(server, context);

  registerWidget(
    server,
    COMPETITORS_WIDGET,
    "PromptEye Competitors",
    "The brands answering alongside a project's own, ranked by visibility, then position"
  );
  registerCompetitorTools(server, context);
  registerContentTools(server, context);
  registerIntegrationTools(server, context);
  registerGoogleTools(server, context);
  registerTrafficTools(server, context);
  registerReportTools(server, context);
  registerHelpTools(server);
  registerFeedbackTools(server, context);

  if (SAMPLE_TOOLS) {
    registerWidget(
      server,
      VISIBILITY_WIDGET,
      "PromptEye Visibility",
      "Visibility totals, period-over-period change and breakdown for a project"
    );
    registerVisibilityTools(server, context);
    registerEvidenceTools(server, context);
  }

  return server;
}
