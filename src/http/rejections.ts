import type express from "express";
import { INTEGRATIONS_URL } from "../config.js";
import type { BudgetDecision } from "./rate-limit.js";

export type Rejection = { status: number; code: number; message: string; headers: Record<string, string> };

const WWW_AUTHENTICATE = 'Bearer realm="prompteye-mcp", error="invalid_token"';

export const REJECTIONS = {
  missingKey: {
    status: 401,
    code: -32001,
    message:
      "Missing PromptEye API key. Send it as Authorization: Bearer pe_live_… (or X-PromptEye-Key, or X-API-Key). " +
      `Keys: ${INTEGRATIONS_URL}`,
    headers: { "WWW-Authenticate": WWW_AUTHENTICATE },
  },
  rejectedKey: {
    status: 401,
    code: -32001,
    message: `PromptEye rejected this API key. Check it at ${INTEGRATIONS_URL} and send a valid one.`,
    headers: { "WWW-Authenticate": WWW_AUTHENTICATE },
  },
  unreachable: {
    status: 503,
    code: -32000,
    message: "PromptEye API is unreachable. Retry in a moment.",
    headers: { "Retry-After": "5" },
  },
  sessionNotFound: {
    status: 404,
    code: -32001,
    message: "Session not found. Initialize a new session.",
    headers: {},
  },
  notInitialized: {
    status: 400,
    code: -32600,
    message: "Bad request. Send an initialize request first, then reuse its Mcp-Session-Id.",
    headers: {},
  },
  methodNotAllowed: {
    status: 405,
    code: -32600,
    message: "Method not allowed. Start a session with a POST initialize request.",
    headers: { Allow: "POST" },
  },
  badBody: {
    status: 400,
    code: -32600,
    message: "Bad request. Body must be JSON under 1 MB.",
    headers: {},
  },
  internal: {
    status: 500,
    code: -32603,
    message: "Internal server error.",
    headers: {},
  },
} satisfies Record<string, Rejection>;

export const tooManyRequests = (decision: BudgetDecision): Rejection => ({
  status: 429,
  code: -32000,
  message: "Too many requests. Wait for the Retry-After delay before retrying.",
  headers: { "Retry-After": String(decision.retryAfterSeconds) },
});

export function reject(res: express.Response, rejection: Rejection): void {
  res.set(rejection.headers);
  res.status(rejection.status).json({ jsonrpc: "2.0", error: { code: rejection.code, message: rejection.message }, id: null });
}

export function rejectBadBody(error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction): void {
  reject(res, { ...REJECTIONS.badBody, status: error.status ?? 400 });
}
