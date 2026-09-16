import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccountSchema } from "../schemas/prompteye.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

export function registerAccountTools(server: McpServer, { client }: ToolContext): void {
  server.registerTool(
    "get_account",
    {
      title: "Read the account behind the key",
      description:
        "Who the configured PromptEye API key belongs to, which plan the workspace is on, which " +
        "addons and scopes it has, and how many prompts it tracks. Call this to diagnose a key or " +
        "to check whether a plan covers a feature before promising it.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: AccountSchema.shape,
    },
    async () =>
      handled(async () => {
        const account = await client.getAccount();

        return ok(
          [
            `Account ${account.email} on the ${account.plan?.name ?? "unknown"} plan.`,
            `Prompts tracked: ${account.promptCount}.`,
            `Addons: ${account.addons.join(", ") || "none"}.`,
            `Scopes: ${account.scopes.join(", ") || "none"}.`,
          ].join("\n"),
          account
        );
      })
  );
}
