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

const dnsRebindingOptions = (allowedHosts: string[] | undefined, allowedOrigins: string[] | undefined) =>
  allowedHosts?.length || allowedOrigins?.length
    ? { enableDnsRebindingProtection: true, allowedHosts, allowedOrigins }
    : {};

function health(_req: express.Request, res: express.Response): void {
  res.json({ status: "ok", server: { name: serverName, version: serverVersion } });
}

export function createHttpApp(options: HttpAppOptions): express.Express {
  const { baseUrl, registry, logger, keyBudget, ipBudget, authFailureBudget, allowedHosts, allowedOrigins, trustProxyHops } = options;

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

  const handleMcp = async (req: express.Request, res: express.Response): Promise<void> => {
    const ipDecision = ipBudget.take(req.ip ?? "unknown");
    if (!ipDecision.allowed) return reject(res, tooManyRequests(ipDecision));

    const sessionId = firstValue(req.headers, "mcp-session-id");
    if (sessionId === undefined && req.method !== "POST") return reject(res, REJECTIONS.methodNotAllowed);

    const token = readApiKey(req.headers);
    if (!token) return reject(res, REJECTIONS.missingKey);

    const fingerprint = fingerprintOf(token);
    res.locals.keyFingerprint = fingerprint;

    const keyDecision = keyBudget.take(fingerprint);
    if (!keyDecision.allowed) return reject(res, tooManyRequests(keyDecision));

    if (sessionId === undefined) return startSession({ token, baseUrl }, fingerprint, req, res);

    const session = registry.find(sessionId, fingerprint);
    if (!session) return reject(res, REJECTIONS.sessionNotFound);

    res.locals.sessionId = sessionId;
    await session.transport.handleRequest(req, res, req.body);
  };

  const app = express();
  app.set("trust proxy", trustProxyHops ?? 0);
  app.use(cors({ ...CORS_OPTIONS, origin: allowedOrigins ?? "*" }));
  app.use(requestLogging(logger));
  app.use(express.json({ limit: "1mb" }));

  app.get("/", health);
  app.get("/healthz", health);

  app.all("/mcp", async (req, res) => {
    try {
      await handleMcp(req, res);
    } catch (error) {
      logger.error("mcp.request.failed", describeError(error));
      if (!res.headersSent) reject(res, REJECTIONS.internal);
    }
  });

  app.use(rejectBadBody);

  return app;
}
