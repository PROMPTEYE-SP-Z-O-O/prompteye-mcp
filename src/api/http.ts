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

export type Schema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface SendRequest<T> {
  method: HttpMethod;
  path: string;
  schema: Schema<T>;
  body?: unknown;
  options?: RequestOptions;
}

export type HttpMethodWithBody = <T>(
  path: string,
  body: unknown,
  schema: Schema<T>,
  options?: RequestOptions
) => Promise<T>;

export class HttpClient {
  constructor(private readonly config: HttpClientConfig) {}

  get<T>(
    path: string,
    schema: Schema<T>,
    options: RequestOptions & { query?: Query } = {}
  ): Promise<T> {
    return this.send({ method: "GET", path: `${path}${queryString(options.query)}`, schema, options });
  }

  post: HttpMethodWithBody = (path, body, schema, options) =>
    this.send({ method: "POST", path, schema, body, options });

  patch: HttpMethodWithBody = (path, body, schema, options) =>
    this.send({ method: "PATCH", path, schema, body, options });

  put: HttpMethodWithBody = (path, body, schema, options) =>
    this.send({ method: "PUT", path, schema, body, options });

  private async send<T>({ method, path, schema, body, options = {} }: SendRequest<T>): Promise<T> {
    const hasBody = body !== undefined;
    const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...this.config.headers,
        Authorization: `Bearer ${this.config.token}`,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: options.signal ?? AbortSignal.timeout(this.config.timeoutMs),
    });
    const responseBody: unknown = await response.json().catch(() => undefined);

    if (!response.ok) throw new PromptEyeApiError(response.status, responseBody);
    return schema.parse(responseBody);
  }
}
