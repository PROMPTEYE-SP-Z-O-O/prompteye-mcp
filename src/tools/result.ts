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

/** What every tool module is handed when it registers itself. */
export type ToolContext = {
  client: PromptEyeClient;
  session: ProjectSession;
};

/**
 * A successful result: prose the model reads, plus the structured payload the
 * widget and any downstream tool call read.
 */
export function ok(text: string, structuredContent: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text }], structuredContent };
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

/**
 * Marks the text of a tool whose endpoint the PromptEye API does not serve yet,
 * so the model never presents illustrative figures as measurements of the
 * user's project.
 */
export const sampleData = (text: string): string =>
  `${text}\n\nNote: sample data. The PromptEye API does not serve this yet, so these figures are ` +
  "illustrative and were not measured for this project. Say so when relaying them.";

/** Renders a number for the model, keeping `null` legible as "no data". */
export const num = (value: number | null, suffix = ""): string =>
  value === null ? "—" : `${value}${suffix}`;

/** Renders a change with an explicit sign, so a drop never reads as a gain. */
export const signed = (value: number | null, suffix = ""): string =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value}${suffix}`;

/** The trailing line a paginated listing adds so the model knows more exists. */
export const morePages = (nextCursor: string | null): string =>
  nextCursor === null ? "" : `\n\nMore entries follow. Pass cursor="${nextCursor}" to read the next page.`;
