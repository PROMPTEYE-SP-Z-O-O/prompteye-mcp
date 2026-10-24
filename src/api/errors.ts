/** A human message for every error code the PromptEye API documents. */
export const API_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "The API key is missing, malformed or revoked.",
  insufficient_scope: "The API key is valid but not allowed to do this.",
  plan_limit_exceeded: "The workspace plan does not allow this.",
  not_found: "The resource does not exist, or the API key does not reach it.",
  method_not_allowed: "The endpoint does not accept this method.",
  project_already_exists: "The workspace already tracks this brand in this market.",
  project_metrics_rebuilding:
    "The stored visibility metrics of this project are being recounted, so aggregate reads such as list_prompts, list_competitors and list_prompt_groups are refused until that finishes. Tell the user which reason the API gave, do not guess a date or a duration, and retry the read later instead of repeatedly retrying now.",
  unsupported_media_type: "The request body is not JSON.",
  payload_too_large: "The request body is too large.",
  rate_limited: "Too many requests for this API key.",
  internal_error: "PromptEye failed on its side. Retrying a moment later is safe.",
};

/** Why the API says a project's metrics are being rebuilt (`reason` on `project_metrics_rebuilding`). */
export const REBUILD_REASON_MESSAGES: Record<string, string> = {
  alternative_brand_names_changed: "the alternative brand names of the project changed",
  alternative_domains_changed: "the alternative domains of the project changed",
  project_domain_changed: "the domain of the project changed",
  competitor_grouping_changed: "the way competitors are grouped changed",
  brand_definition_changed: "the brand definition the stored metrics were counted under is no longer current",
  unknown: "the API did not say what changed",
};

export type ApiErrorDetail = { field: string; message: string };

type ErrorBody = {
  error?: string | { code?: string; message?: string; reason?: string; details?: ApiErrorDetail[] };
};

/** The API answered with a non-2xx status. `body` is the response as received. */
export class PromptEyeApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly code: string | undefined;
  readonly reason: string | undefined;
  readonly details: ApiErrorDetail[];
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, body: unknown, retryAfterSeconds?: number) {
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
    this.reason = envelope?.reason;
    this.details = envelope?.details ?? [];
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
