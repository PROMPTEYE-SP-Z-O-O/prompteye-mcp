import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IntegrationsStatusSchema } from "../schemas/prompteye.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

export function registerIntegrationTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "get_integrations_status",
    {
      title: "Check which integrations the project has",
      description:
        "Whether Search Console, Google Analytics, the bot tracker and the sitemap are connected to the " +
        "active project, in one call. Call it before reporting a zero or an empty list from " +
        "get_search_performance, get_ai_traffic, list_bot_visits, count_bot_visits or list_crawls: a " +
        "project with nothing connected answers those with zeros and empty lists, which reads exactly " +
        "like a site nobody visits.\n\n" +
        "`connected: false` means the integration is missing, never that the site had no traffic. " +
        "`reason: sync_failing` means it is connected but its last sync failed, so its figures are " +
        "stale; get_google_status and get_sitemap say when and why. Integrations are connected in the " +
        "PromptEye app.\n\n" +
        "PromptEye has no CMS integration. The WordPress and Laravel collectors are ways of installing " +
        "the bot tracker and are reported under `botLogs`.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: IntegrationsStatusSchema.shape,
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const status = await client.getIntegrationsStatus(project.id);
        return ok(status);
      })
  );
}
