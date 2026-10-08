import cors from "cors";
import express from "express";
import { serverName, serverVersion } from "../config.js";
import { requestLogging, type Logger } from "./logging.js";
import { routeSession } from "./mcp.js";
import type { RequestBudget } from "./rate-limit.js";
import { API_SCOPE, rejectBadBody } from "./rejections.js";
import type { OAuthSettings } from "./settings.js";
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
  oauth?: OAuthSettings;
};

const CORS_OPTIONS: cors.CorsOptions = {
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-PromptEye-Key", "X-API-Key", "Mcp-Session-Id", "MCP-Protocol-Version", "Last-Event-ID"],
  exposedHeaders: ["Mcp-Session-Id", "WWW-Authenticate"],
};

const WELL_KNOWN_PATH = "/.well-known/oauth-protected-resource";

function health(_req: express.Request, res: express.Response): void {
  res.json({ status: "ok", server: { name: serverName, version: serverVersion } });
}

export function createHttpApp(options: HttpAppOptions): express.Express {
  const { baseUrl, registry, logger, keyBudget, ipBudget, authFailureBudget, allowedHosts, allowedOrigins, trustProxyHops, oauth } = options;

  const app = express();
  app.set("trust proxy", trustProxyHops ?? 0);
  app.use(cors({ ...CORS_OPTIONS, origin: allowedOrigins ?? "*" }));
  app.use(requestLogging(logger));
  app.use(express.json({ limit: "1mb" }));

  app.get(["/", "/healthz"], health);

  if (oauth) {
    const { origin, pathname } = new URL(oauth.resource);
    const metadataUrl = `${origin}${WELL_KNOWN_PATH}${pathname}`;
    const metadata = {
      resource: oauth.resource,
      authorization_servers: [oauth.authorizationServer],
      bearer_methods_supported: ["header"],
      scopes_supported: [API_SCOPE],
    };
    app.get([WELL_KNOWN_PATH, `${WELL_KNOWN_PATH}${pathname}`], (_req, res) => {
      res.set("Cache-Control", "public, max-age=3600").json(metadata);
    });
    app.use("/mcp", (_req, res, next) => {
      res.locals.resourceMetadata = metadataUrl;
      next();
    });
  }

  app.all(
    "/mcp",
    limitBy(ipBudget, clientIp),
    requireApiKey(baseUrl),
    requirePostForNewSessions,
    limitBy(keyBudget, keyFingerprint),
    guarded(logger, routeSession({ registry, logger, authFailureBudget, allowedHosts, allowedOrigins }))
  );

  app.use(rejectBadBody);

  return app;
}
