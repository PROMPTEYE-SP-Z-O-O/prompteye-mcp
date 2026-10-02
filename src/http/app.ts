import cors from "cors";
import express from "express";
import { serverName, serverVersion } from "../config.js";
import { requestLogging, type Logger } from "./logging.js";
import { routeSession } from "./mcp.js";
import type { RequestBudget } from "./rate-limit.js";
import { rejectBadBody } from "./rejections.js";
import type { SessionRegistry } from "./sessions.js";
import { clientIp, guarded, keyFingerprint, limitBy, requireApiKey, requirePostForNewSessions } from "./steps.js";

export type HttpAppOptions = {
  baseUrl: string;
  registry: SessionRegistry;
  logger: Logger;
  keyBudget: RequestBudget;
  ipBudget: RequestBudget;
  authFailureBudget: RequestBudget;
  allowedHosts?: string[];
  allowedOrigins?: string[];
  trustProxyHops?: number;
};

const CORS_OPTIONS: cors.CorsOptions = {
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-PromptEye-Key", "X-API-Key", "Mcp-Session-Id", "MCP-Protocol-Version", "Last-Event-ID"],
  exposedHeaders: ["Mcp-Session-Id"],
};

function health(_req: express.Request, res: express.Response): void {
  res.json({ status: "ok", server: { name: serverName, version: serverVersion } });
}

export function createHttpApp(options: HttpAppOptions): express.Express {
  const { baseUrl, registry, logger, keyBudget, ipBudget, authFailureBudget, allowedHosts, allowedOrigins, trustProxyHops } = options;

  const app = express();
  app.set("trust proxy", trustProxyHops ?? 0);
  app.use(cors({ ...CORS_OPTIONS, origin: allowedOrigins ?? "*" }));
  app.use(requestLogging(logger));
  app.use(express.json({ limit: "1mb" }));

  app.get(["/", "/healthz"], health);

  app.all(
    "/mcp",
    limitBy(ipBudget, clientIp),
    requirePostForNewSessions,
    requireApiKey(baseUrl),
    limitBy(keyBudget, keyFingerprint),
    guarded(logger, routeSession({ registry, logger, authFailureBudget, allowedHosts, allowedOrigins }))
  );

  app.use(rejectBadBody);

  return app;
}
