import { createHash } from "crypto";
import type { IncomingHttpHeaders } from "http";
import { PromptEyeApiError } from "../api/index.js";
import { createClient, type ApiCredentials } from "../config.js";
import { describeError, type Logger } from "./logging.js";
import { REJECTIONS, tooManyRequests, type Rejection } from "./rejections.js";

const CREDENTIAL_HEADERS = ["authorization", "x-prompteye-key", "x-api-key"] as const;

const BEARER_SCHEME = /^Bearer\s+(.+)$/i;

const [AUTHORIZATION_HEADER, ...KEY_HEADERS] = CREDENTIAL_HEADERS;

export const firstValue = (headers: IncomingHttpHeaders, name: string): string | undefined => {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
};

const readBearerToken = (authorization: string | undefined): string | undefined =>
  authorization?.match(BEARER_SCHEME)?.[1]?.trim() || undefined;

const readKeyHeader = (headers: IncomingHttpHeaders): string | undefined =>
  KEY_HEADERS.map((name) => firstValue(headers, name)?.trim()).find((value) => !!value);

export function readApiKey(headers: IncomingHttpHeaders): string | undefined {
  return readKeyHeader(headers) ?? readBearerToken(firstValue(headers, AUTHORIZATION_HEADER));
}

export function fingerprintOf(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

export async function verifyApiKey(credentials: ApiCredentials, logger: Logger): Promise<Rejection | undefined> {
  try {
    await createClient(credentials).getAccount();
    return undefined;
  } catch (error) {
    if (error instanceof PromptEyeApiError && error.status === 401) return REJECTIONS.rejectedKey;
    if (error instanceof PromptEyeApiError && error.status === 403) return REJECTIONS.insufficientScope;
    if (error instanceof PromptEyeApiError && error.status === 429) {
      return tooManyRequests({ allowed: false, retryAfterSeconds: error.retryAfterSeconds ?? 5 });
    }

    logger.error("mcp.credentials.unverifiable", describeError(error));
    return REJECTIONS.unreachable;
  }
}
