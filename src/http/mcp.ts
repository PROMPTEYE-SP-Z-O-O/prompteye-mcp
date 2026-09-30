import { randomUUID } from "crypto";
import type express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { ApiCredentials } from "../config.js";
import { buildToolContext, createMcpServer } from "../server.js";
import { firstValue, verifyApiKey } from "./credentials.js";
import type { Logger } from "./logging.js";
import type { RequestBudget } from "./rate-limit.js";
import { REJECTIONS, reject, tooManyRequests } from "./rejections.js";
import type { SessionRegistry } from "./sessions.js";
import { SESSION_HEADER, clientIp, type Handler } from "./steps.js";

export type SessionDeps = {
  registry: SessionRegistry;
  logger: Logger;
  authFailureBudget: RequestBudget;
  allowedHosts?: string[];
  allowedOrigins?: string[];
};

const dnsRebindingOptions = (allowedHosts: string[] | undefined, allowedOrigins: string[] | undefined) =>
  allowedHosts?.length || allowedOrigins?.length
    ? { enableDnsRebindingProtection: true, allowedHosts, allowedOrigins }
    : {};

async function startSession(
  deps: SessionDeps,
  credentials: ApiCredentials,
  fingerprint: string,
  req: express.Request,
  res: express.Response
): Promise<void> {
  const { registry, logger, authFailureBudget, allowedHosts, allowedOrigins } = deps;
  if (!isInitializeRequest(req.body)) return reject(res, REJECTIONS.notInitialized);

  const ip = clientIp(req, res);
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
}

async function resumeSession(
  registry: SessionRegistry,
  sessionId: string,
  fingerprint: string,
  req: express.Request,
  res: express.Response
): Promise<void> {
  const session = registry.find(sessionId, fingerprint);
  if (!session) return reject(res, REJECTIONS.sessionNotFound);

  res.locals.sessionId = sessionId;
  await session.transport.handleRequest(req, res, req.body);
}

export function routeSession(deps: SessionDeps): Handler {
  return async (req, res) => {
    const sessionId = firstValue(req.headers, SESSION_HEADER);
    const { credentials, keyFingerprint } = res.locals;
    return sessionId === undefined
      ? startSession(deps, credentials, keyFingerprint, req, res)
      : resumeSession(deps.registry, sessionId, keyFingerprint, req, res);
  };
}
