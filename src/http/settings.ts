import { requireBaseUrl } from "../config.js";

export type OAuthSettings = { resource: string; authorizationServer: string };

export type HttpSettings = {
  port: number;
  baseUrl: string;
  sessions: { idleMs: number; maxPerKey: number };
  rateLimits: { perKey: number; perIp: number; authFailures: number };
  allowedHosts?: string[];
  allowedOrigins?: string[];
  trustProxyHops: number;
  oauth?: OAuthSettings;
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

const MCP_PATH = "/mcp";

const requireAbsoluteUrl = (name: string, value: string): string => {
  const url = URL.canParse(value) ? new URL(value) : undefined;
  const local = url?.hostname === "localhost" || url?.hostname === "127.0.0.1";
  if (url && (url.protocol === "https:" || (url.protocol === "http:" && local))) return value;
  throw new Error(`${name} must be an absolute https URL (http only for localhost), got "${value}".`);
};

const requireResourceUrl = (name: string, value: string): string => {
  const url = new URL(requireAbsoluteUrl(name, value));
  if (url.search || url.hash || url.pathname !== MCP_PATH || value !== url.href) {
    throw new Error(`${name} must be the MCP endpoint URL, e.g. https://mcp.example.com${MCP_PATH}: no trailing slash, query or fragment, got "${value}".`);
  }
  return value;
};

function readOAuthSettings(env: NodeJS.ProcessEnv): OAuthSettings | undefined {
  const resource = env.MCP_PUBLIC_URL?.trim();
  const authorizationServer = env.MCP_AUTHORIZATION_SERVER?.trim();
  if (!resource && !authorizationServer) return undefined;
  if (!resource || !authorizationServer) {
    throw new Error("MCP_PUBLIC_URL and MCP_AUTHORIZATION_SERVER must be set together to enable OAuth.");
  }
  return {
    resource: requireResourceUrl("MCP_PUBLIC_URL", resource),
    authorizationServer: requireAbsoluteUrl("MCP_AUTHORIZATION_SERVER", authorizationServer),
  };
}

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
    oauth: readOAuthSettings(env),
  };
}
