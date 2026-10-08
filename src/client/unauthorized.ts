import { PromptEyeApiError } from "../api/index.js";
import type { PromptEyeClient } from "./prompteye-client.js";

const isUnauthorized = (error: unknown): boolean => error instanceof PromptEyeApiError && error.status === 401;

const watching =
  (call: (...args: unknown[]) => Promise<unknown>, onUnauthorized: () => void) =>
  async (...args: unknown[]): Promise<unknown> => {
    try {
      return await call(...args);
    } catch (error) {
      if (isUnauthorized(error)) onUnauthorized();
      throw error;
    }
  };

export function notifyOnUnauthorized(client: PromptEyeClient, onUnauthorized: () => void): PromptEyeClient {
  const entries = Object.entries(client).map(([name, call]) => [name, watching(call, onUnauthorized)]);
  return Object.fromEntries(entries) as PromptEyeClient;
}
