import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { describeDataSource, requireSettings, serverName } from "./config.js";
import { createMcpServer } from "./server.js";

async function main(): Promise<void> {
  // Fail here rather than on the first tool call, so a missing setting is
  // obvious in the host's log. stdout carries the protocol; this goes to stderr.
  const { baseUrl } = requireSettings();
  console.error(`${serverName}: ${describeDataSource(baseUrl)}`);

  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
  console.error(`${serverName} running on stdio`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
