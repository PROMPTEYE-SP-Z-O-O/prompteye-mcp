import { PromptEyeApi } from "./api/index.js";
import { createFixturesClient } from "./client/fixtures-client.js";
import { createLiveClient } from "./client/live-client.js";
import type { PromptEyeClient } from "./client/prompteye-client.js";

export const serverName = process.env.MCP_SERVER_NAME ?? "prompteye-mcp";
export const serverVersion = process.env.MCP_SERVER_VERSION ?? "1.0.0";

// Extension settings can pass an empty string for a field left blank; treat it as unset.
const readSetting = (name: string): string | undefined => process.env[name]?.trim() || undefined;

/**
 * The deployment to talk to and the key for it. Both are required — there is
 * no default deployment, and nothing answers without a key.
 */
export function requireSettings(): { token: string; baseUrl: string } {
  const baseUrl = readSetting("PROMPTEYE_API_BASE_URL");
  const token = readSetting("PROMPTEYE_API_KEY");

  if (!baseUrl || !token) {
    const missing = !baseUrl
      ? token
        ? "PROMPTEYE_API_BASE_URL is"
        : "PROMPTEYE_API_BASE_URL and PROMPTEYE_API_KEY are"
      : "PROMPTEYE_API_KEY is";

    throw new Error(
      `${missing} not set. The API URL and the API key are both at https://app.prompteye.com/integrations.`
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
export const describeDataSource = (baseUrl: string): string => `using the PromptEye API at ${baseUrl}`;
