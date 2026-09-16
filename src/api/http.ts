import type { z } from "zod";
import { PromptEyeApiError } from "./errors.js";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Query parameters; anything undefined is left out. */
export type Query = Record<string, string | number | undefined>;

export interface RequestOptions {
  /** Aborts the request. Replaces the client's timeout when given. */
  signal?: AbortSignal;
}

export interface HttpClientConfig {
  token: string;
  baseUrl: string;
  timeoutMs: number;
  fetch: FetchLike;
  headers: Record<string, string>;
}

function queryString(query: Query = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered === "" ? "" : `?${rendered}`;
}

export class HttpClient {
  constructor(private readonly config: HttpClientConfig) {}

  /** GETs `path`, throwing `PromptEyeApiError` on a non-2xx answer and validating a 2xx one. */
  get<T>(
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    options: RequestOptions & { query?: Query } = {}
  ): Promise<T> {
    return this.send(`${path}${queryString(options.query)}`, schema, { method: "GET" }, options);
  }

  /** POSTs `body` as JSON, otherwise behaving exactly as {@link get}. */
  post<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.send(
      path,
      schema,
      { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } },
      options
    );
  }

  private async send<T>(
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    init: RequestInit & { headers?: Record<string, string> },
    options: RequestOptions
  ): Promise<T> {
    const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...this.config.headers,
        ...init.headers,
        Authorization: `Bearer ${this.config.token}`,
      },
      signal: options.signal ?? AbortSignal.timeout(this.config.timeoutMs),
    });
    const body: unknown = await response.json().catch(() => undefined);

    if (!response.ok) throw new PromptEyeApiError(response.status, body);
    return schema.parse(body);
  }
}
