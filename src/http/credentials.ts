import { createHash } from "crypto";
import type { IncomingHttpHeaders } from "http";

export const CREDENTIAL_HEADERS = ["authorization", "x-prompteye-key"] as const;

const BEARER_SCHEME = /^Bearer\s+(.+)$/i;

const [AUTHORIZATION_HEADER, KEY_HEADER] = CREDENTIAL_HEADERS;

const firstValue = (headers: IncomingHttpHeaders, name: string): string | undefined => {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
};

const readBearerToken = (authorization: string | undefined): string | undefined =>
  authorization?.match(BEARER_SCHEME)?.[1]?.trim() || undefined;

export function readApiKey(headers: IncomingHttpHeaders): string | undefined {
  const bearer = readBearerToken(firstValue(headers, AUTHORIZATION_HEADER));
  return bearer ?? (firstValue(headers, KEY_HEADER)?.trim() || undefined);
}

export function fingerprintOf(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}
