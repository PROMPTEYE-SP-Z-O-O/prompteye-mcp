import type express from "express";
import { fingerprintOf, firstValue, readApiKey } from "./credentials.js";
import { describeError, type Logger } from "./logging.js";
import type { RequestBudget } from "./rate-limit.js";
import { REJECTIONS, reject, tooManyRequests } from "./rejections.js";

export const SESSION_HEADER = "mcp-session-id";

export type Handler = (req: express.Request, res: express.Response) => Promise<void>;

type KeySelector = (req: express.Request, res: express.Response) => string;

export const clientIp: KeySelector = (req) => req.ip ?? "unknown";

export const keyFingerprint: KeySelector = (_req, res) => res.locals.keyFingerprint;

export function limitBy(budget: RequestBudget, keyOf: KeySelector): express.RequestHandler {
  return (req, res, next) => {
    const decision = budget.take(keyOf(req, res));
    if (!decision.allowed) return reject(res, tooManyRequests(decision));
    next();
  };
}

export const requirePostForNewSessions: express.RequestHandler = (req, res, next) => {
  const isNewSession = firstValue(req.headers, SESSION_HEADER) === undefined;
  if (isNewSession && req.method !== "POST") return reject(res, REJECTIONS.methodNotAllowed);
  next();
};

export function requireApiKey(baseUrl: string): express.RequestHandler {
  return (req, res, next) => {
    const token = readApiKey(req.headers);
    if (!token) return reject(res, REJECTIONS.missingKey);
    res.locals.keyFingerprint = fingerprintOf(token);
    res.locals.credentials = { token, baseUrl };
    next();
  };
}

export function guarded(logger: Logger, handler: Handler): express.RequestHandler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      logger.error("mcp.request.failed", describeError(error));
      if (!res.headersSent) reject(res, REJECTIONS.internal);
    }
  };
}
