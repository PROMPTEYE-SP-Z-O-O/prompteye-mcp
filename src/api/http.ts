import type { z } from "zod";
import { PromptEyeApiError } from "./errors.js";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Query parameters; anything undefined is left out. */
export type Query = Record<string, string | number | undefined>;

export interface RequestOptions {
  /** Aborts the request. Replaces the client's timeout when given. */
  signal?: AbortSignal;
  /**
   * Whether to send the API key. Defaults to true; set false for the endpoints
   * documented as public, so a key is never handed to a call that has no use
   * for it.
   */
  auth?: boolean;
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

/** The validated body, and the status that carried it. */
export type Answered<T> = { data: T; status: number };

export type HttpMethodWithBody = <T>(
  path: string,
  body: unknown,
  schema: Schema<T>,
  options?: RequestOptions
) => Promise<T>;

export class HttpClient {
  constructor(private readonly config: HttpClientConfig) {}

  async get<T>(
    path: string,
    schema: Schema<T>,
    options: RequestOptions & { query?: Query } = {}
  ): Promise<T> {
    const { data } = await this.send({
      method: "GET",
      path: `${path}${queryString(options.query)}`,
      schema,
      options,
    });
    return data;
  }

  post: HttpMethodWithBody = async (path, body, schema, options) =>
    (await this.send({ method: "POST", path, schema, body, options })).data;

  patch: HttpMethodWithBody = async (path, body, schema, options) =>
    (await this.send({ method: "PATCH", path, schema, body, options })).data;

  put: HttpMethodWithBody = async (path, body, schema, options) =>
    (await this.send({ method: "PUT", path, schema, body, options })).data;

  /** Like {@link post}, for the endpoints whose status carries meaning of its own. */
  postAnswered<T>(
    path: string,
    body: unknown,
    schema: Schema<T>,
    options?: RequestOptions
  ): Promise<Answered<T>> {
    return this.send({ method: "POST", path, schema, body, options });
  }

  private async send<T>({
    method,
    path,
    schema,
    body,
    options = {},
  }: SendRequest<T>): Promise<Answered<T>> {
    const hasBody = body !== undefined;
    const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...this.config.headers,
        ...(options.auth === false ? {} : { Authorization: `Bearer ${this.config.token}` }),
      },
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: options.signal ?? AbortSignal.timeout(this.config.timeoutMs),
    });
    const responseBody: unknown = await response.json().catch(() => undefined);

    if (!response.ok) throw new PromptEyeApiError(response.status, responseBody);
    return { data: schema.parse(responseBody), status: response.status };
  }
}
