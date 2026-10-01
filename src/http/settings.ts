import { requireBaseUrl } from "../config.js";

export type HttpSettings = {
  port: number;
  baseUrl: string;
  sessions: { idleMs: number; maxPerKey: number };
  rateLimits: { perKey: number; perIp: number; authFailures: number };
  allowedHosts?: string[];
  allowedOrigins?: string[];
  trustProxyHops: number;
};

const numberSetting = (env: NodeJS.ProcessEnv, name: string, fallback: number): number => {
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const listSetting = (env: NodeJS.ProcessEnv, name: string): string[] | undefined => {
  const entries = (env[name] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  return entries.length > 0 ? entries : undefined;
};

export function readHttpSettings(env: NodeJS.ProcessEnv = process.env): HttpSettings {
  return {
    port: numberSetting(env, "PORT", 3000),
    baseUrl: requireBaseUrl(env),
    sessions: {
      idleMs: numberSetting(env, "MCP_SESSION_IDLE_MINUTES", 30) * 60_000,
      maxPerKey: numberSetting(env, "MCP_MAX_SESSIONS_PER_KEY", 20),
    },
    rateLimits: {
      perKey: numberSetting(env, "MCP_RATE_LIMIT_PER_KEY", 120),
      perIp: numberSetting(env, "MCP_RATE_LIMIT_PER_IP", 600),
      authFailures: numberSetting(env, "MCP_RATE_LIMIT_AUTH_FAILURES", 10),
    },
    allowedHosts: listSetting(env, "MCP_PUBLIC_HOSTS"),
    allowedOrigins: listSetting(env, "MCP_ALLOWED_ORIGINS"),
    trustProxyHops: numberSetting(env, "MCP_TRUST_PROXY_HOPS", 0),
  };
}
