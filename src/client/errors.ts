import { PromptEyeApiError } from "../api/index.js";
import { HelpError } from "../help/help.js";

const retryAdvice = (error: PromptEyeApiError): string =>
  error.retryAfterSeconds === undefined ? "" : ` Retry after ${error.retryAfterSeconds} s.`;

/** The message a tool hands the model for a failure it can act on, or undefined for a bug. */
export function toolMessageFor(error: unknown): string | undefined {
  if (error instanceof PromptEyeApiError) {
    return [
      `PromptEye API error ${error.status}${error.code ? ` (${error.code})` : ""}: ${error.message}${retryAdvice(error)}`,
      ...error.details.map((detail) => `  - ${detail.field}: ${detail.message}`),
    ].join("\n");
  }

  if (error instanceof HelpError) {
    return error.message;
  }

  return undefined;
}
