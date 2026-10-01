import type { Server } from "http";
import { describeDataSource, serverName } from "../config.js";
import { createHttpApp } from "./app.js";
import type { Logger } from "./logging.js";
import { RequestBudget } from "./rate-limit.js";
import { SessionRegistry } from "./sessions.js";
import type { HttpSettings } from "./settings.js";

const SWEEP_EVERY_MS = 5 * 60_000;

const budgetOf = (perMinute: number): RequestBudget => new RequestBudget({ perMinute });

export function startHttpServer(settings: HttpSettings, logger: Logger): Server {
  const { port, baseUrl, sessions, rateLimits, allowedHosts, allowedOrigins, trustProxyHops } = settings;
  const registry = new SessionRegistry(sessions);

  const app = createHttpApp({
    baseUrl,
    registry,
    logger,
    keyBudget: budgetOf(rateLimits.perKey),
    ipBudget: budgetOf(rateLimits.perIp),
    authFailureBudget: budgetOf(rateLimits.authFailures),
    allowedHosts,
    allowedOrigins,
    trustProxyHops,
  });

  setInterval(() => {
    const removed = registry.sweep();
    if (removed.length > 0) logger.info("mcp.sessions.swept", { removed: removed.length, remaining: registry.size });
  }, SWEEP_EVERY_MS).unref();

  return app.listen(port, () => {
    logger.info("mcp.listening", {
      server: serverName,
      url: `http://localhost:${port}/mcp`,
      source: describeDataSource(baseUrl),
    });
  });
}
