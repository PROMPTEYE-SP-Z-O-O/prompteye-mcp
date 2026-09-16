import { PromptEyeApi } from "./api/index.js";
import { createFixturesClient } from "./client/fixtures-client.js";
import { createLiveClient } from "./client/live-client.js";
import type { PromptEyeClient } from "./client/prompteye-client.js";

export const serverName = process.env.MCP_SERVER_NAME ?? "prompteye-mcp";
export const serverVersion = process.env.MCP_SERVER_VERSION ?? "1.0.0";

// Extension settings can pass an empty string for a field left blank; treat it as unset.
const readSetting = (name: string): string | undefined => process.env[name]?.trim() || undefined;

/**
 * The key and the deployment to talk to. Both are required — there is no
 * default deployment, and nothing answers without a key.
 */
export function requireSettings(): { token: string; baseUrl: string } {
  const token = readSetting("PROMPTEYE_API_KEY");
  const baseUrl = readSetting("PROMPTEYE_API_BASE_URL");

  if (!token || !baseUrl) {
    const missing = !token
      ? baseUrl
        ? "PROMPTEYE_API_KEY is"
        : "PROMPTEYE_API_KEY and PROMPTEYE_API_BASE_URL are"
      : "PROMPTEYE_API_BASE_URL is";

    throw new Error(
      `${missing} not set. The API key and the API URL are both at https://app.prompteye.com/integrations.`
    );
  }

  return { token, baseUrl };
}

/**
 * Builds the client the tools talk to: the PromptEye API for everything it
 * serves, and the sample data in `src/fixtures` for the endpoints it does not
 * have yet.
 */
export function createClient(): PromptEyeClient {
  const { token, baseUrl } = requireSettings();

  const api = new PromptEyeApi({
    token,
    baseUrl,
    headers: { "User-Agent": `${serverName}/${serverVersion}` },
  });
  return createLiveClient(api, createFixturesClient());
}

/** Where the answers come from, for startup logs. Never includes the key. */
export const describeDataSource = (baseUrl: string): string =>
  `live data from ${baseUrl} for account, projects, knowledge base, prompts, prompt groups, ` +
  "categories and prompt suggestions; sample data for visibility, competitors, answers and sources.";
