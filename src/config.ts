import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PromptEyeApi } from "./api/index.js";
import { createLiveClient } from "./client/live-client.js";
import type { PromptEyeClient } from "./client/prompteye-client.js";

export const serverName = process.env.MCP_SERVER_NAME ?? "prompteye-mcp";
const PACKAGE_JSON_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../package.json");

const packageVersion = (): string => JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8")).version;

export const serverVersion = process.env.MCP_SERVER_VERSION ?? packageVersion();

export const INTEGRATIONS_URL = "https://app.prompteye.com/integrations";

export type ApiCredentials = { token: string; baseUrl: string };

const BASE_URL_SETTING = "PROMPTEYE_API_BASE_URL";
const API_KEY_SETTING = "PROMPTEYE_API_KEY";

const readSetting = (name: string, env: NodeJS.ProcessEnv = process.env): string | undefined => env[name]?.trim() || undefined;

const missingSettings = (names: string[]): Error =>
  new Error(
    `${names.join(" and ")} ${names.length === 1 ? "is" : "are"} not set. ` +
      `The API URL and the API key are both at ${INTEGRATIONS_URL}.`
  );

export function requireBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const baseUrl = readSetting(BASE_URL_SETTING, env);
  if (!baseUrl) throw missingSettings([BASE_URL_SETTING]);
  return baseUrl;
}

export function readEnvCredentials(): ApiCredentials {
  const baseUrl = readSetting(BASE_URL_SETTING);
  const token = readSetting(API_KEY_SETTING);
  if (baseUrl && token) return { token, baseUrl };

  throw missingSettings([...(baseUrl ? [] : [BASE_URL_SETTING]), ...(token ? [] : [API_KEY_SETTING])]);
}

export function createClient({ token, baseUrl }: ApiCredentials): PromptEyeClient {
  const api = new PromptEyeApi({
    token,
    baseUrl,
    headers: { "User-Agent": `${serverName}/${serverVersion}` },
  });
  return createLiveClient(api);
}

export const describeDataSource = (baseUrl: string): string => `using the PromptEye API at ${baseUrl}`;
