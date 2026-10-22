import cors from "cors";
import express from "express";
import { serverName, serverVersion } from "../config.js";
import { ICON_PATH } from "../icon.js";
import { widgetScript } from "../widgets.js";
import { requestLogging, type Logger } from "./logging.js";
import { serveMcpRequest } from "./mcp.js";
import type { RequestBudget } from "./rate-limit.js";
import { API_SCOPE, rejectBadBody } from "./rejections.js";
import type { OAuthSettings } from "./settings.js";
import { clientIp, guarded, keyFingerprint, limitBy, requireApiKey, requirePost } from "./steps.js";
import type { VerifiedKeys } from "./verified-keys.js";

export type HttpAppOptions = {
  baseUrl: string;
  verifiedKeys: VerifiedKeys;
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
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-PromptEye-Key", "X-API-Key", "Mcp-Session-Id", "MCP-Protocol-Version"],
  exposedHeaders: ["WWW-Authenticate"],
};

const WELL_KNOWN_PATH = "/.well-known/oauth-protected-resource";

const ICON_PATHS = ["/favicon.ico", "/icon.png"];

function icon(_req: express.Request, res: express.Response): void {
  res.set("Cache-Control", "public, max-age=86400").type("png").sendFile(ICON_PATH);
}

function widgetScriptFile(req: express.Request, res: express.Response): void {
  const script = widgetScript(String(req.params.name));
  if (script === undefined) {
    res.status(404).end();
    return;
  }
  res.set("Cache-Control", "public, max-age=300").type("text/javascript").send(script);
}

function health(_req: express.Request, res: express.Response): void {
  res.json({ status: "ok", server: { name: serverName, version: serverVersion } });
}

export function createHttpApp(options: HttpAppOptions): express.Express {
  const { baseUrl, verifiedKeys, logger, keyBudget, ipBudget, authFailureBudget, allowedHosts, allowedOrigins, trustProxyHops, oauth } = options;

  const app = express();
  app.set("trust proxy", trustProxyHops ?? 0);
  app.use(cors({ ...CORS_OPTIONS, origin: allowedOrigins ?? "*" }));
  app.use(requestLogging(logger));
  app.use(express.json({ limit: "1mb" }));

  app.get(["/", "/healthz"], health);
  app.get(ICON_PATHS, icon);
  app.get("/widgets/:name.js", widgetScriptFile);

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
    requirePost,
    limitBy(keyBudget, keyFingerprint),
    guarded(logger, serveMcpRequest({ verifiedKeys, logger, authFailureBudget, allowedHosts, allowedOrigins }))
  );

  app.use(rejectBadBody);

  return app;
}
