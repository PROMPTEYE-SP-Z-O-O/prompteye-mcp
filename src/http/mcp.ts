import type express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ApiCredentials } from "../config.js";
import { buildToolContext, createMcpServer } from "../server.js";
import { verifyApiKey } from "./credentials.js";
import type { Logger } from "./logging.js";
import type { RequestBudget } from "./rate-limit.js";
import { REJECTIONS, reject, tooManyRequests, type Rejection } from "./rejections.js";
import { clientIp, type Handler } from "./steps.js";
import type { VerifiedKeys } from "./verified-keys.js";

export type McpRequestDeps = {
  verifiedKeys: VerifiedKeys;
  logger: Logger;
  authFailureBudget: RequestBudget;
  allowedHosts?: string[];
  allowedOrigins?: string[];
};

const dnsRebindingOptions = (allowedHosts: string[] | undefined, allowedOrigins: string[] | undefined) =>
  allowedHosts?.length || allowedOrigins?.length
    ? { enableDnsRebindingProtection: true, allowedHosts, allowedOrigins }
    : {};

async function rejectionOf(
  deps: McpRequestDeps,
  credentials: ApiCredentials,
  fingerprint: string,
  req: express.Request,
  res: express.Response
): Promise<Rejection | undefined> {
  const { verifiedKeys, logger, authFailureBudget } = deps;
  if (verifiedKeys.has(fingerprint)) return undefined;

  const ip = clientIp(req, res);
  const failureDecision = authFailureBudget.peek(ip);
  if (!failureDecision.allowed) return tooManyRequests(failureDecision);

  const rejection = await verifyApiKey(credentials, logger);
  if (rejection === REJECTIONS.rejectedKey || rejection === REJECTIONS.insufficientScope) authFailureBudget.take(ip);
  if (!rejection) verifiedKeys.add(fingerprint);
  return rejection;
}

export function serveMcpRequest(deps: McpRequestDeps): Handler {
  return async (req, res) => {
    const { credentials, keyFingerprint } = res.locals;
    const rejection = await rejectionOf(deps, credentials, keyFingerprint, req, res);
    if (rejection) return reject(res, rejection);

    const server = createMcpServer(buildToolContext(credentials, () => deps.verifiedKeys.forget(keyFingerprint)));
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      ...dnsRebindingOptions(deps.allowedHosts, deps.allowedOrigins),
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };
}
