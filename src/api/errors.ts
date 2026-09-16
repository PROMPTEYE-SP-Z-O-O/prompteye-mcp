/** A human message for every error code the PromptEye API documents. */
export const API_ERROR_MESSAGES: Record<string, string> = {
  invalid_request: "The request failed validation.",
  unauthorized: "The API key is missing, malformed or revoked.",
  insufficient_scope: "The API key is valid but not allowed to do this.",
  plan_limit_exceeded: "The workspace plan does not allow this.",
  not_found: "The resource does not exist, or the API key does not reach it.",
  method_not_allowed: "The endpoint does not accept this method.",
  project_already_exists: "The workspace already tracks this brand in this market.",
  unsupported_media_type: "The request body is not JSON.",
  payload_too_large: "The request body is too large.",
  rate_limited: "Too many requests for this API key.",
  internal_error: "PromptEye failed on its side. Retrying a moment later is safe.",
};

export type ApiErrorDetail = { field: string; message: string };

type ErrorBody = { error?: string | { code?: string; message?: string; details?: ApiErrorDetail[] } };

/** The API answered with a non-2xx status. `body` is the response as received. */
export class PromptEyeApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly code: string | undefined;
  readonly details: ApiErrorDetail[];

  constructor(status: number, body: unknown) {
    // `{ error: { code, message } }`, or a bare `{ error: "UNAUTHORIZED" }`.
    const error = (body as ErrorBody | undefined)?.error;
    const envelope = typeof error === "object" ? error : undefined;
    const code = (typeof error === "string" ? error : envelope?.code)?.toLowerCase();

    super(
      (code && API_ERROR_MESSAGES[code]) ?? envelope?.message ?? `The PromptEye API responded with HTTP ${status}.`
    );
    this.name = "PromptEyeApiError";
    this.status = status;
    this.body = body;
    this.code = code;
    this.details = envelope?.details ?? [];
  }
}
