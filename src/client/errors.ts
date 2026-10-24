import { PromptEyeApiError, REBUILD_REASON_MESSAGES } from "../api/index.js";
import { HelpError } from "../help/help.js";

const retryAdvice = (error: PromptEyeApiError): string =>
  error.retryAfterSeconds === undefined ? "" : ` Retry after ${error.retryAfterSeconds} s.`;

const reasonLine = (error: PromptEyeApiError): string[] =>
  error.reason === undefined
    ? []
    : [`Reason: ${error.reason} (${REBUILD_REASON_MESSAGES[error.reason] ?? "no description for this reason"}).`];

/** The message a tool hands the model for a failure it can act on, or undefined for a bug. */
export function toolMessageFor(error: unknown): string | undefined {
  if (error instanceof PromptEyeApiError) {
    return [
      `PromptEye API error ${error.status}${error.code ? ` (${error.code})` : ""}: ${error.message}${retryAdvice(error)}`,
      ...reasonLine(error),
      ...error.details.map((detail) => `  - ${detail.field}: ${detail.message}`),
    ].join("\n");
  }

  if (error instanceof HelpError) {
    return error.message;
  }

  return undefined;
}
