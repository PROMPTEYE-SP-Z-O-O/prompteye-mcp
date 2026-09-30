import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccountSchema } from "../schemas/prompteye.js";
import { describeUsage } from "./prompt-counts.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

export function registerAccountTools(server: McpServer, { client }: ToolContext): void {
  server.registerTool(
    "get_account",
    {
      title: "Read the account behind the key",
      description:
        "Who the configured PromptEye API key belongs to, which plan the workspace is on, how many " +
        "active prompts it tracks across all its projects against its limit (paused prompts are not " +
        "counted), which assistants those prompts are asked on, and when the next run starts. Call " +
        "this to diagnose a key, to check whether a plan covers a feature before promising it, or to " +
        "answer when fresh figures will arrive.\n\n" +
        "nextScanAt is when the run begins, not when it is done: the prompts are put to every " +
        "assistant and the answers are read back over the tens of minutes that follow, so the " +
        "figures arrive gradually after that time rather than all at once on it. Say the run " +
        "has started rather than that the numbers are ready.",
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
            `Prompts: ${describeUsage(account)}. get_started splits the selected project's prompts into active and paused.`,
            `Asked on: ${account.models.join(", ") || "no assistants"} — ${account.scanFrequency}.`,
            `Next run starts ${account.nextScanAt} — that is when it begins, not when it is done.`,
            "It takes tens of minutes to ask every prompt on every assistant, and the figures move as the answers land.",
            `Addons: ${account.addons.join(", ") || "none"}.`,
            `Scopes: ${account.scopes.join(", ") || "none"}.`,
          ].join("\n"),
          account
        );
      })
  );
}
