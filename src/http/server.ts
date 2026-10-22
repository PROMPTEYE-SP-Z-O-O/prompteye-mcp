import type { Server } from "http";
import { describeDataSource, serverName } from "../config.js";
import { createHttpApp } from "./app.js";
import type { Logger } from "./logging.js";
import { RequestBudget } from "./rate-limit.js";
import { VerifiedKeys } from "./verified-keys.js";
import type { HttpSettings } from "./settings.js";

const VERIFIED_KEY_TTL_MS = 60_000;

const budgetOf = (perMinute: number): RequestBudget => new RequestBudget({ perMinute });

export function startHttpServer(settings: HttpSettings, logger: Logger): Server {
  const { port, baseUrl, rateLimits, allowedHosts, allowedOrigins, trustProxyHops, oauth } = settings;

  const app = createHttpApp({
    baseUrl,
    verifiedKeys: new VerifiedKeys({ ttlMs: VERIFIED_KEY_TTL_MS }),
    logger,
    keyBudget: budgetOf(rateLimits.perKey),
    ipBudget: budgetOf(rateLimits.perIp),
    authFailureBudget: budgetOf(rateLimits.authFailures),
    allowedHosts,
    allowedOrigins,
    trustProxyHops,
    oauth,
  });

  return app.listen(port, () => {
    logger.info("mcp.listening", {
      server: serverName,
      url: `http://localhost:${port}/mcp`,
      source: describeDataSource(baseUrl),
    });
  });
}
