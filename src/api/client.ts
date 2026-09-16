import { HttpClient, type FetchLike } from "./http.js";
import {
  AccountResource,
  CategoriesResource,
  KnowledgeBaseResource,
  ProjectsResource,
  PromptSuggestionsResource,
} from "./resources.js";

export const DEFAULT_TIMEOUT_MS = 30_000;

export interface PromptEyeApiOptions {
  /** An API key, `pe_live_…`. */
  token: string;
  /** API root of the deployment the token belongs to. */
  baseUrl: string;
  /** Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** Sent with every request. */
  headers?: Record<string, string>;
}

/**
 * ```ts
 * const api = new PromptEyeApi({ token, baseUrl });
 * const { data: projects } = await api.projects.list();
 * ```
 *
 * Both values are at https://app.prompteye.com/integrations.
 */
export class PromptEyeApi {
  readonly account: AccountResource;
  readonly projects: ProjectsResource;
  readonly knowledgeBase: KnowledgeBaseResource;
  readonly categories: CategoriesResource;
  readonly promptSuggestions: PromptSuggestionsResource;

  constructor(options: PromptEyeApiOptions) {
    if (!options.token?.trim()) throw new TypeError("token is required.");
    if (!options.baseUrl?.trim()) throw new TypeError("baseUrl is required.");

    const http = new HttpClient({
      token: options.token.trim(),
      baseUrl: options.baseUrl.trim().replace(/\/+$/, ""),
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      fetch: options.fetch ?? ((url, init) => fetch(url, init)),
      headers: options.headers ?? {},
    });

    this.account = new AccountResource(http);
    this.projects = new ProjectsResource(http);
    this.knowledgeBase = new KnowledgeBaseResource(http);
    this.categories = new CategoriesResource(http);
    this.promptSuggestions = new PromptSuggestionsResource(http);
  }
}
