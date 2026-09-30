import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { describeDataSource, readEnvCredentials, serverName } from "./config.js";
import { buildToolContext, createMcpServer } from "./server.js";

async function main(): Promise<void> {
  const credentials = readEnvCredentials();
  console.error(`${serverName}: ${describeDataSource(credentials.baseUrl)}`);

  const server = createMcpServer(buildToolContext(credentials));
  await server.connect(new StdioServerTransport());
  console.error(`${serverName} running on stdio`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
