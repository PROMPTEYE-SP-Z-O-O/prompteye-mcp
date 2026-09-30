import { PromptEyeApiError } from "../api/index.js";

export type LogFields = Record<string, unknown>;

export type Logger = {
  info(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
};

type Level = "info" | "error";

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
