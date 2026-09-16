import { PromptEyeApiError } from "../api/index.js";

/** Raised when a tool needs an active project and the session has none. */
export class NoActiveProjectError extends Error {
  constructor() {
    super(
      "No project is selected. Call list_projects to see the projects this API key reaches, " +
        "then select_project with the id of the one to work on."
    );
    this.name = "NoActiveProjectError";
  }
}

/** The message a tool hands the model for a failure it can act on, or undefined for a bug. */
export function toolMessageFor(error: unknown): string | undefined {
  if (error instanceof PromptEyeApiError) {
    return [
      `PromptEye API error ${error.status}${error.code ? ` (${error.code})` : ""}: ${error.message}`,
      ...error.details.map((detail) => `  - ${detail.field}: ${detail.message}`),
    ].join("\n");
  }

  if (error instanceof NoActiveProjectError || error instanceof RangeError) return error.message;

  return undefined;
}
