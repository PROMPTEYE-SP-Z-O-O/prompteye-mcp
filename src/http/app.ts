import { randomUUID } from "crypto";
import cors from "cors";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { PromptEyeApiError } from "../api/index.js";
import { INTEGRATIONS_URL, createClient, serverName, serverVersion, type ApiCredentials } from "../config.js";
import { buildToolContext, createMcpServer } from "../server.js";
import { fingerprintOf, readApiKey } from "./credentials.js";
import { describeError, type LogFields, type Logger } from "./logging.js";
import type { BudgetDecision, RequestBudget } from "./rate-limit.js";
import type { SessionRegistry } from "./sessions.js";

export type HttpAppOptions = {
  baseUrl: string;
  registry: SessionRegistry;
  logger: Logger;
  keyBudget: RequestBudget;
  ipBudget: RequestBudget;
  allowedHosts?: string[];
  allowedOrigins?: string[];
  trustProxyHops?: number;
  verifyCredentials?: (credentials: ApiCredentials) => Promise<void>;
};

const WWW_AUTHENTICATE = 'Bearer realm="prompteye-mcp", error="invalid_token"';

const MESSAGES = {
  missingKey:
    "Missing PromptEye API key. Send it as Authorization: Bearer pe_live_… (or X-PromptEye-Key). " +
    `Keys: ${INTEGRATIONS_URL}`,
  rejectedKey: `PromptEye rejected this API key. Check it at ${INTEGRATIONS_URL} and send a valid one.`,
  unreachable: "PromptEye API is unreachable. Retry in a moment.",
  tooManyRequests: "Too many requests. Wait for the Retry-After delay before retrying.",
  sessionNotFound: "Session not found. Initialize a new session.",
  notInitialized: "Bad request. Send an initialize request first, then reuse its Mcp-Session-Id.",
  badBody: "Bad request. Body must be JSON under 1 MB.",
  internal: "Internal server error.",
};

const RPC_CODES = {
  unauthorized: -32001,
  sessionNotFound: -32001,
  tooManyRequests: -32000,
  unreachable: -32000,
  badRequest: -32600,
  internal: -32603,
};

type Rejection = { status: number; code: number; message: string; headers: Record<string, string> };

const REJECTIONS = {
  missingKey: { status: 401, code: RPC_CODES.unauthorized, message: MESSAGES.missingKey, headers: { "WWW-Authenticate": WWW_AUTHENTICATE } },
  rejectedKey: { status: 401, code: RPC_CODES.unauthorized, message: MESSAGES.rejectedKey, headers: { "WWW-Authenticate": WWW_AUTHENTICATE } },
  unreachable: { status: 503, code: RPC_CODES.unreachable, message: MESSAGES.unreachable, headers: { "Retry-After": "5" } },
  sessionNotFound: { status: 404, code: RPC_CODES.sessionNotFound, message: MESSAGES.sessionNotFound, headers: {} },
  notInitialized: { status: 400, code: RPC_CODES.badRequest, message: MESSAGES.notInitialized, headers: {} },
  badBody: { status: 400, code: RPC_CODES.badRequest, message: MESSAGES.badBody, headers: {} },
  internal: { status: 500, code: RPC_CODES.internal, message: MESSAGES.internal, headers: {} },
} satisfies Record<string, Rejection>;

const tooManyRequests = (decision: BudgetDecision): Rejection => ({
  status: 429,
  code: RPC_CODES.tooManyRequests,
  message: MESSAGES.tooManyRequests,
  headers: { "Retry-After": String(decision.retryAfterSeconds) },
});

const KEY_REJECTING_STATUSES = new Set([401, 403]);

const CORS_OPTIONS: cors.CorsOptions = {
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-PromptEye-Key", "Mcp-Session-Id", "MCP-Protocol-Version", "Last-Event-ID"],
  exposedHeaders: ["Mcp-Session-Id"],
};

const RPC_DETAILS_BY_METHOD: Record<string, (params: unknown) => LogFields> = {
  "tools/call": (params) => ({ tool: (params as { name?: unknown } | undefined)?.name }),
};

type RpcMessage = { method?: unknown; params?: unknown };

function describeRpc(body: unknown): LogFields {
  const message = (Array.isArray(body) ? body[0] : body) as RpcMessage | undefined;
  const method = message?.method;
  if (typeof method !== "string") return {};

  return { rpcMethod: method, ...(RPC_DETAILS_BY_METHOD[method]?.(message?.params) ?? {}) };
}

const headerValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const dnsRebindingOptions = (allowedHosts: string[] | undefined, allowedOrigins: string[] | undefined) =>
  allowedHosts?.length || allowedOrigins?.length
    ? { enableDnsRebindingProtection: true, allowedHosts, allowedOrigins }
    : {};

async function verifyWithAccount(credentials: ApiCredentials): Promise<void> {
  await createClient(credentials).getAccount();
}

function reject(res: express.Response, rejection: Rejection): void {
  res.set(rejection.headers);
  res.status(rejection.status).json({ jsonrpc: "2.0", error: { code: rejection.code, message: rejection.message }, id: null });
}

function rejectBadBody(error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction): void {
  reject(res, { ...REJECTIONS.badBody, status: error.status ?? 400 });
}

function requestLogging(logger: Logger): express.RequestHandler {
  return (req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      logger.info("mcp.request", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
        ...res.locals,
        ...describeRpc(req.body),
      });
    });
    next();
  };
}

function health(_req: express.Request, res: express.Response): void {
  res.json({ status: "ok", server: { name: serverName, version: serverVersion } });
}

export function createHttpApp(options: HttpAppOptions): express.Express {
  const { baseUrl, registry, logger, keyBudget, ipBudget, allowedHosts, allowedOrigins, trustProxyHops } = options;
  const verifyCredentials = options.verifyCredentials ?? verifyWithAccount;

  const credentialRejection = async (credentials: ApiCredentials): Promise<Rejection | undefined> => {
    try {
      await verifyCredentials(credentials);
      return undefined;
    } catch (error) {
      if (error instanceof PromptEyeApiError && KEY_REJECTING_STATUSES.has(error.status)) return REJECTIONS.rejectedKey;
      if (error instanceof PromptEyeApiError && error.status === 429) {
        return tooManyRequests({ allowed: false, retryAfterSeconds: error.retryAfterSeconds ?? 5 });
      }

      logger.error("mcp.credentials.unverifiable", describeError(error));
      return REJECTIONS.unreachable;
    }
  };

  const startSession = async (
    credentials: ApiCredentials,
    fingerprint: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> => {
    if (!isInitializeRequest(req.body)) return reject(res, REJECTIONS.notInitialized);

    const rejection = await credentialRejection(credentials);
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

    const token = readApiKey(req.headers);
    if (!token) return reject(res, REJECTIONS.missingKey);

    const fingerprint = fingerprintOf(token);
    res.locals.keyFingerprint = fingerprint;

    const keyDecision = keyBudget.take(fingerprint);
    if (!keyDecision.allowed) return reject(res, tooManyRequests(keyDecision));

    const sessionId = headerValue(req.headers["mcp-session-id"]);
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
