import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toolMessageFor } from "../client/errors.js";
import type { PromptEyeClient } from "../client/prompteye-client.js";
import type { ProjectSession } from "../session.js";

/**
 * Every tool here reads and nothing writes, and each one reaches an external
 * API whose contents are not a closed set. Hosts surface this to the user, and
 * the Connectors Directory requires it on submission.
 */
export const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

/**
 * A tool that changes the workspace. Nothing here deletes or replaces a whole
 * set, but calling one twice adds twice, so hosts are told to confirm rather
 * than repeat.
 */
export const WRITES = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

export const DELETES = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** Overwrites a whole set with the one sent, so whatever was there before is gone. */
export const REPLACES = DELETES;

/** Throws a set away and generates a fresh one, so two calls give two different results. */
export const REGENERATES = { ...DELETES, idempotentHint: false } as const;

/** What every tool module is handed when it registers itself. */
export type ToolContext = {
  client: PromptEyeClient;
  session: ProjectSession;
  /**
   * The API root the client talks to. Tools that hand out a request for
   * somebody else to make — the public reports endpoint an agency's own site
   * posts to — need the URL in what they return.
   */
  baseUrl: string;
};

/**
 * A successful result: the structured payload the widget and any downstream
 * tool call read, and the same payload serialized for the model.
 */
export function ok(structuredContent: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
}

/** A failure the model can act on rather than an exception that ends the turn. */
export function fail(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/**
 * Runs a tool handler, turning the failures a caller can do something about —
 * an unselected project, a rejected period, an API or connection error — into
 * `isError` results carrying the remedy.
 */
export async function handled(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    const message = toolMessageFor(error);
    if (message === undefined) throw error;
    return fail(message);
  }
}
