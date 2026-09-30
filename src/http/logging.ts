import type express from "express";
import { PromptEyeApiError } from "../api/index.js";

export type LogFields = Record<string, unknown>;

export type Logger = {
  info(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
};

type Level = "info" | "error";

type RpcMessage = { method?: unknown; params?: unknown };

const LEVEL_RANK: Record<string, number> = { debug: 10, info: 20, error: 40, silent: 100 };

export function createJsonLogger(
  stream: NodeJS.WritableStream = process.stdout,
  level: string = process.env.LOG_LEVEL ?? "info"
): Logger {
  const threshold = LEVEL_RANK[level] ?? LEVEL_RANK.info;

  const write = (lineLevel: Level, event: string, fields: LogFields = {}): void => {
    if (LEVEL_RANK[lineLevel] < threshold) return;
    stream.write(`${JSON.stringify({ time: new Date().toISOString(), level: lineLevel, event, ...fields })}\n`);
  };

  return {
    info: (event, fields) => write("info", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}

export function describeError(error: unknown): LogFields {
  if (!(error instanceof Error)) return { name: "Error", message: String(error) };

  const status = error instanceof PromptEyeApiError ? error.status : undefined;
  return { name: error.name, message: error.message, ...(status === undefined ? {} : { status }) };
}

function describeRpc(body: unknown): LogFields {
  const message = (Array.isArray(body) ? body[0] : body) as RpcMessage | undefined;
  const method = message?.method;
  if (typeof method !== "string") return {};

  return {
    rpcMethod: method,
    ...(method === "tools/call" ? { tool: (message?.params as { name?: unknown } | undefined)?.name } : {}),
  };
}

export function requestLogging(logger: Logger): express.RequestHandler {
  return (req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      logger.info("mcp.request", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
        keyFingerprint: res.locals.keyFingerprint,
        sessionId: res.locals.sessionId,
        ...describeRpc(req.body),
      });
    });
    next();
  };
}
