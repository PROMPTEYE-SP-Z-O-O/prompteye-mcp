import { describeDataSource, requireBaseUrl, serverName } from "./config.js";
import { createHttpApp } from "./http/app.js";
import { createJsonLogger } from "./http/logging.js";
import { RequestBudget } from "./http/rate-limit.js";
import { SessionRegistry } from "./http/sessions.js";

const SWEEP_EVERY_MS = 5 * 60_000;

const numberSetting = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const listSetting = (name: string): string[] | undefined => {
  const entries = (process.env[name] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  return entries.length > 0 ? entries : undefined;
};

function main(): void {
  const baseUrl = requireBaseUrl();
  const port = numberSetting("PORT", 3000);
  const logger = createJsonLogger();
  const registry = new SessionRegistry({
    idleMs: numberSetting("MCP_SESSION_IDLE_MINUTES", 30) * 60_000,
    maxPerKey: numberSetting("MCP_MAX_SESSIONS_PER_KEY", 20),
  });

  const app = createHttpApp({
    baseUrl,
    registry,
    logger,
    keyBudget: new RequestBudget({ perMinute: numberSetting("MCP_RATE_LIMIT_PER_KEY", 120) }),
    ipBudget: new RequestBudget({ perMinute: numberSetting("MCP_RATE_LIMIT_PER_IP", 600) }),
    allowedHosts: listSetting("MCP_PUBLIC_HOSTS"),
    allowedOrigins: listSetting("MCP_ALLOWED_ORIGINS"),
    trustProxyHops: numberSetting("MCP_TRUST_PROXY_HOPS", 0),
  });

  setInterval(() => {
    const removed = registry.sweep();
    if (removed.length > 0) logger.info("mcp.sessions.swept", { removed: removed.length, remaining: registry.size });
  }, SWEEP_EVERY_MS).unref();

  app.listen(port, () => {
    logger.info("mcp.listening", {
      server: serverName,
      url: `http://localhost:${port}/mcp`,
      source: describeDataSource(baseUrl),
    });
  });
}

try {
  main();
} catch (err) {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
}
