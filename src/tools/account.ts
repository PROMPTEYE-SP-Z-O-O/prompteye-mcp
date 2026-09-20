import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccountSchema } from "../schemas/prompteye.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

export function registerAccountTools(server: McpServer, { client }: ToolContext): void {
  server.registerTool(
    "get_account",
    {
      title: "Read the account behind the key",
      description:
        "Who the configured PromptEye API key belongs to, which plan the workspace is on, how many " +
        "prompts it tracks against its limit, which assistants those prompts are asked on, and when " +
        "the next run starts. Call this to diagnose a key, to check whether a plan covers a feature " +
        "before promising it, or to answer when fresh figures will arrive.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: AccountSchema.shape,
    },
    async () =>
      handled(async () => {
        const account = await client.getAccount();
        const left = account.promptLimit - account.promptCount;

        return ok(
          [
            `Account ${account.email} on the ${account.plan?.name ?? "unknown"} plan.`,
            `Prompts: ${account.promptCount} of ${account.promptLimit} tracked` +
              `${left > 0 ? `, room for ${left} more` : ", the plan's limit is reached"}.`,
            `Asked on: ${account.models.join(", ") || "no assistants"} — ${account.scanFrequency}.`,
            `Next run: ${account.nextScanAt}. Answers land over the hours that follow.`,
            `Addons: ${account.addons.join(", ") || "none"}.`,
            `Scopes: ${account.scopes.join(", ") || "none"}.`,
          ].join("\n"),
          account
        );
      })
  );
}
