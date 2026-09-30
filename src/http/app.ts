import { randomUUID } from "crypto";
import cors from "cors";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { serverName, serverVersion, type ApiCredentials } from "../config.js";
import { buildToolContext, createMcpServer } from "../server.js";
import { fingerprintOf, firstValue, readApiKey, verifyApiKey } from "./credentials.js";
import { describeError, requestLogging, type Logger } from "./logging.js";
import type { RequestBudget } from "./rate-limit.js";
import { REJECTIONS, reject, rejectBadBody, tooManyRequests } from "./rejections.js";
import type { SessionRegistry } from "./sessions.js";

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
  allowedHeaders: ["Content-Type", "Authorization", "X-PromptEye-Key", "Mcp-Session-Id", "MCP-Protocol-Version", "Last-Event-ID"],
  exposedHeaders: ["Mcp-Session-Id"],
};

const SESSION_HEADER = "mcp-session-id";

type Handler = (req: express.Request, res: express.Response) => Promise<void>;

const dnsRebindingOptions = (allowedHosts: string[] | undefined, allowedOrigins: string[] | undefined) =>
  allowedHosts?.length || allowedOrigins?.length
    ? { enableDnsRebindingProtection: true, allowedHosts, allowedOrigins }
    : {};

function health(_req: express.Request, res: express.Response): void {
  res.json({ status: "ok", server: { name: serverName, version: serverVersion } });
}

export function createHttpApp(options: HttpAppOptions): express.Express {
  const { baseUrl, registry, logger, keyBudget, ipBudget, authFailureBudget, allowedHosts, allowedOrigins, trustProxyHops } = options;

  const limitPerIp: express.RequestHandler = (req, res, next) => {
    const decision = ipBudget.take(req.ip ?? "unknown");
    if (!decision.allowed) return reject(res, tooManyRequests(decision));
    next();
  };

  const requirePostForNewSessions: express.RequestHandler = (req, res, next) => {
    const isNewSession = firstValue(req.headers, SESSION_HEADER) === undefined;
    if (isNewSession && req.method !== "POST") return reject(res, REJECTIONS.methodNotAllowed);
    next();
  };

  const requireApiKey: express.RequestHandler = (req, res, next) => {
    const token = readApiKey(req.headers);
    if (!token) return reject(res, REJECTIONS.missingKey);
    res.locals.keyFingerprint = fingerprintOf(token);
    next();
  };

  const limitPerKey: express.RequestHandler = (_req, res, next) => {
    const decision = keyBudget.take(res.locals.keyFingerprint);
    if (!decision.allowed) return reject(res, tooManyRequests(decision));
    next();
  };

  const startSession = async (
    credentials: ApiCredentials,
    fingerprint: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> => {
    if (!isInitializeRequest(req.body)) return reject(res, REJECTIONS.notInitialized);

    const ip = req.ip ?? "unknown";
    const failureDecision = authFailureBudget.peek(ip);
    if (!failureDecision.allowed) return reject(res, tooManyRequests(failureDecision));

    const rejection = await verifyApiKey(credentials, logger);
    if (rejection === REJECTIONS.rejectedKey) authFailureBudget.take(ip);
    if (rejection) return reject(res, rejection);

    const server = createMcpServer(buildToolContext(credentials));
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        res.locals.sessionId = sessionId;
        registry.add(sessionId, { server, transport, fingerprint, lastSeenAt: Date.now() });
      },
      ...dnsRebindingOptions(allowedHosts, allowedOrigins),
    });
    transport.onclose = () => {
      if (transport.sessionId) registry.remove(transport.sessionId);
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };

  const resumeSession = async (
    sessionId: string,
    fingerprint: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> => {
    const session = registry.find(sessionId, fingerprint);
    if (!session) return reject(res, REJECTIONS.sessionNotFound);

    res.locals.sessionId = sessionId;
    await session.transport.handleRequest(req, res, req.body);
  };

  const routeSession: Handler = async (req, res) => {
    const token = readApiKey(req.headers);
    if (!token) return reject(res, REJECTIONS.missingKey);

    const sessionId = firstValue(req.headers, SESSION_HEADER);
    const fingerprint = res.locals.keyFingerprint;
    return sessionId === undefined
      ? startSession({ token, baseUrl }, fingerprint, req, res)
      : resumeSession(sessionId, fingerprint, req, res);
  };

  const guarded =
    (handler: Handler): express.RequestHandler =>
    async (req, res) => {
      try {
        await handler(req, res);
      } catch (error) {
        logger.error("mcp.request.failed", describeError(error));
        if (!res.headersSent) reject(res, REJECTIONS.internal);
      }
    };

  const app = express();
  app.set("trust proxy", trustProxyHops ?? 0);
  app.use(cors({ ...CORS_OPTIONS, origin: allowedOrigins ?? "*" }));
  app.use(requestLogging(logger));
  app.use(express.json({ limit: "1mb" }));

  app.get("/", health);
  app.get("/healthz", health);

  app.all("/mcp", limitPerIp, requirePostForNewSessions, requireApiKey, limitPerKey, guarded(routeSession));

  app.use(rejectBadBody);

  return app;
}
