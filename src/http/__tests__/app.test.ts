import { readFileSync } from "fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import { Writable } from "stream";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHttpApp, type HttpAppOptions } from "../app.js";
import { createJsonLogger } from "../logging.js";
import { RequestBudget } from "../rate-limit.js";
import { VerifiedKeys } from "../verified-keys.js";

const KEY_A = "pe_live_aaaaaaaaaaaaaaaaaaaaaaaa";
const KEY_B = "pe_live_bbbbbbbbbbbbbbbbbbbbbbbb";
const KEY_UNKNOWN = "pe_live_cccccccccccccccccccccccc";
const KEY_THROTTLED = "pe_live_dddddddddddddddddddddddd";
const JWT_A = "h.p.s";
const JWT_A_REFRESHED = "h2.p2.s2";
const JWT_EXPIRING = "h3.p3.s3";
const JWT_NO_SCOPE = "h4.p4.s4";

const ACCOUNT = {
  id: "acc_1",
  email: "owner@acme.example",
  plan: { key: "pro", name: "Pro" },
  addons: [],
  scopes: ["api_access"],
  promptCount: 12,
  promptLimit: 100,
  models: ["gpt", "gemini"],
  scanFrequency: "daily",
  nextScanAt: "2026-10-01T02:00:00.000Z",
};

const project = (id: string, name: string) => ({
  id,
  name,
  brand: name,
  domain: `${id}.example`,
  country: "DE",
  label: null,
  alternativeBrandNames: [],
  alternativeDomains: [],
  excludedCompetitors: [],
  accessRole: "OWNER",
  createdAt: "2026-09-01T10:00:00.000Z",
});

const PROJECTS_BY_KEY: Record<string, ReturnType<typeof project>[]> = {
  [KEY_A]: [project("a1", "Acme"), project("a2", "Acme UK")],
  [KEY_B]: [project("b1", "Beta")],
  [JWT_A]: [project("j1", "Jwt")],
  [JWT_A_REFRESHED]: [project("j1", "Jwt")],
  [JWT_EXPIRING]: [project("j1", "Jwt")],
};

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "raw", version: "0" } },
};

type Listening = { url: string; close: () => Promise<void> };

const listen = (server: Server): Promise<Listening> =>
  new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });

let meCalls = 0;
const tokensSeen: string[] = [];
const expired = new Set<string>();

const answer = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

function stubApi(req: IncomingMessage, res: ServerResponse): void {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (token === KEY_THROTTLED) {
    res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "17" });
    return res.end(JSON.stringify({ error: { code: "rate_limited", message: "Slow down." } }));
  }
  if (token === JWT_NO_SCOPE) return answer(res, 403, { error: { code: "insufficient_scope", message: "No api_access." } });
  if (token !== undefined) tokensSeen.push(token);
  if (token !== undefined && expired.has(token)) return answer(res, 401, { error: { code: "unauthorized", message: "Expired." } });
  const projects = token === undefined ? undefined : PROJECTS_BY_KEY[token];
  if (!projects) return answer(res, 401, { error: { code: "unauthorized", message: "Unknown key." } });

  const path = req.url ?? "";
  if (path === "/v1/me") {
    meCalls += 1;
    return answer(res, 200, ACCOUNT);
  }
  if (path === "/v1/projects") return answer(res, 200, { data: projects });

  const wanted = projects.find((candidate) => path === `/v1/projects/${candidate.id}`);
  return wanted
    ? answer(res, 200, wanted)
    : answer(res, 404, { error: { code: "not_found", message: "No such project." } });
}

function startApp(baseUrl: string, overrides: Partial<HttpAppOptions> = {}) {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  const app = createHttpApp({
    baseUrl,
    verifiedKeys: new VerifiedKeys({ ttlMs: 60_000 }),
    logger: createJsonLogger(sink),
    keyBudget: new RequestBudget({ perMinute: 1_000 }),
    ipBudget: new RequestBudget({ perMinute: 1_000 }),
    authFailureBudget: new RequestBudget({ perMinute: 1_000 }),
    ...overrides,
  });
  return { listening: listen(createServer(app)), lines };
}

const rawPost = (url: string, headers: Record<string, string>, body: unknown = INITIALIZE) =>
  fetch(`${url}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(body),
  });

async function connect(url: string, headers: Record<string, string>) {
  const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers } });
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(transport);
  return { client, transport };
}

const textOf = (result: Awaited<ReturnType<Client["callTool"]>>): string =>
  (result.content as Array<{ type: string; text?: string }>)
    .map((item) => item.text ?? "")
    .join("\n");

describe("createHttpApp", () => {
  let api: Listening;
  let app: Listening;
  let logLines: string[];
  const clients: Client[] = [];

  beforeAll(async () => {
    api = await listen(createServer(stubApi));
    const started = startApp(api.url);
    app = await started.listening;
    logLines = started.lines;
  });

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.close().catch(() => undefined)));
    await app.close();
    await api.close();
  });

  it("refuses an initialize without a key with 401 and a challenge", async () => {
    const response = await rawPost(app.url, {});
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe('Bearer realm="prompteye-mcp"');
    expect(body.error.message).toContain("Missing PromptEye API key");
  });

  it("refuses a key PromptEye rejects with 401", async () => {
    const response = await rawPost(app.url, { Authorization: `Bearer ${KEY_UNKNOWN}` });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe('Bearer realm="prompteye-mcp", error="invalid_token"');
    expect(body.error.message).toContain("PromptEye rejected this API key");
  });

  it("answers a tools/list sent without an initialize first", async () => {
    const response = await rawPost(
      app.url,
      { Authorization: `Bearer ${KEY_A}` },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("list_projects");
  });

  it("verifies a key once for requests that follow each other closely", async () => {
    const before = meCalls;

    await rawPost(app.url, { Authorization: `Bearer ${KEY_B}` });
    await rawPost(app.url, { Authorization: `Bearer ${KEY_B}` }, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

    expect(meCalls - before).toBeLessThanOrEqual(1);
  });

  it("answers each key with its own data", async () => {
    const a = await connect(app.url, { Authorization: `Bearer ${KEY_A}` });
    const b = await connect(app.url, { Authorization: `Bearer ${KEY_B}` });
    clients.push(a.client, b.client);

    const listedByA = await a.client.callTool({ name: "list_projects", arguments: {} });
    const listedByB = await b.client.callTool({ name: "list_projects", arguments: {} });

    expect(textOf(listedByA)).toContain("Acme UK");
    expect(textOf(listedByB)).toContain("Beta");
    expect(textOf(listedByB)).not.toContain("Acme");
  });

  it("accepts the key from X-PromptEye-Key", async () => {
    const { client } = await connect(app.url, { "X-PromptEye-Key": KEY_B });
    clients.push(client);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain("list_projects");
  });

  it("accepts the key from X-API-Key", async () => {
    const { client } = await connect(app.url, { "X-API-Key": KEY_B });
    clients.push(client);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain("list_projects");
  });

  it("prefers X-API-Key over a bearer token that is not a PromptEye key", async () => {
    const { client } = await connect(app.url, { Authorization: "Bearer oauth-token-from-the-client", "X-API-Key": KEY_B });
    clients.push(client);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain("list_projects");
  });

  it("answers /healthz without the data source", async () => {
    const response = await fetch(`${app.url}/healthz`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.server.name).toBeDefined();
    expect(body).not.toHaveProperty("source");
    expect(body).not.toHaveProperty("sessions");
  });

  it("serves a widget script without credentials and refuses an unknown one", async () => {
    const script = await fetch(`${app.url}/widgets/prompts.js`);
    const unknown = await fetch(`${app.url}/widgets/nope.js`);

    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toContain("javascript");
    expect(await script.text()).toContain("function render(data)");
    expect(unknown.status).toBe(404);
  });

  it("reports the version from package.json", async () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf-8"));

    const response = await fetch(`${app.url}/`);
    const body = await response.json();

    expect(body.server.version).toBe(version);
  });

  it("serves the PromptEye icon as the favicon, without credentials", async () => {
    for (const path of ["/favicon.ico", "/icon.png"]) {
      const response = await fetch(`${app.url}${path}`);
      const body = Buffer.from(await response.arrayBuffer());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(body.subarray(1, 4).toString()).toBe("PNG");
    }
  });

  it("never writes a key into the log", () => {
    const logged = logLines.join("");
    expect(logged).toContain('"event":"mcp.request"');
    expect(logged).toContain('"tool":"list_projects"');
    expect(logged).not.toContain(KEY_A);
    expect(logged).not.toContain(KEY_B);
  });

  it("rate limits a key past its budget with 429 and Retry-After", async () => {
    const started = startApp(api.url, { keyBudget: new RequestBudget({ perMinute: 2 }) });
    const limited = await started.listening;

    const first = await rawPost(limited.url, { Authorization: `Bearer ${KEY_UNKNOWN}` });
    const second = await rawPost(limited.url, { Authorization: `Bearer ${KEY_UNKNOWN}` });
    const third = await rawPost(limited.url, { Authorization: `Bearer ${KEY_UNKNOWN}` });

    expect([first.status, second.status]).toEqual([401, 401]);
    expect(third.status).toBe(429);
    expect(Number(third.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await third.json()).error.message).toContain("Too many requests");

    await limited.close();
  });

  it("rate limits a client address even when its requests carry no key", async () => {
    const started = startApp(api.url, { ipBudget: new RequestBudget({ perMinute: 1 }) });
    const limited = await started.listening;

    const first = await rawPost(limited.url, {});
    const second = await rawPost(limited.url, {});

    expect(first.status).toBe(401);
    expect(second.status).toBe(429);
    expect(Number(second.headers.get("retry-after"))).toBeGreaterThan(0);

    await limited.close();
  });

  it("ignores X-Forwarded-For unless trustProxyHops says how many hops to trust", async () => {
    const direct = await startApp(api.url, { ipBudget: new RequestBudget({ perMinute: 1 }) }).listening;
    const proxied = await startApp(api.url, { ipBudget: new RequestBudget({ perMinute: 1 }), trustProxyHops: 1 })
      .listening;

    const directFirst = await rawPost(direct.url, { "X-Forwarded-For": "1.1.1.1" });
    const directSecond = await rawPost(direct.url, { "X-Forwarded-For": "2.2.2.2" });
    const proxiedFirst = await rawPost(proxied.url, { "X-Forwarded-For": "1.1.1.1" });
    const proxiedSecond = await rawPost(proxied.url, { "X-Forwarded-For": "2.2.2.2" });
    const proxiedRepeat = await rawPost(proxied.url, { "X-Forwarded-For": "2.2.2.2" });

    expect([directFirst.status, directSecond.status]).toEqual([401, 429]);
    expect([proxiedFirst.status, proxiedSecond.status, proxiedRepeat.status]).toEqual([401, 401, 429]);

    await direct.close();
    await proxied.close();
  });

  it("refuses a non-POST with 405 before the key is verified", async () => {
    const before = meCalls;

    for (const method of ["PUT", "PATCH"]) {
      const response = await fetch(`${app.url}/mcp`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY_A}` },
        body: JSON.stringify(INITIALIZE),
      });

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
      expect((await response.json()).error.message).toContain("Method not allowed");
    }

    expect(meCalls).toBe(before);
  });

  it("rate limits failed key checks per client address and then refuses even a valid key", async () => {
    const started = startApp(api.url, { authFailureBudget: new RequestBudget({ perMinute: 10 }) });
    const limited = await started.listening;
    const before = meCalls;

    const guesses: number[] = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await rawPost(limited.url, { Authorization: `Bearer pe_live_guess${attempt}` });
      guesses.push(response.status);
    }
    const eleventh = await rawPost(limited.url, { Authorization: `Bearer pe_live_guess10` });
    const valid = await rawPost(limited.url, { Authorization: `Bearer ${KEY_A}` });

    expect(guesses).toEqual(Array(10).fill(401));
    expect(eleventh.status).toBe(429);
    expect(Number(eleventh.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await eleventh.json()).error.message).toContain("Too many requests");
    expect(valid.status).toBe(429);
    expect(meCalls).toBe(before);

    await limited.close();
  });

  it("keeps serving a key verified before its client address ran out of failed key checks", async () => {
    const started = startApp(api.url, { authFailureBudget: new RequestBudget({ perMinute: 1 }) });
    const limited = await started.listening;

    const verified = await rawPost(limited.url, { Authorization: `Bearer ${KEY_A}` });
    const guess = await rawPost(limited.url, { Authorization: `Bearer ${KEY_UNKNOWN}` });
    const again = await rawPost(limited.url, { Authorization: `Bearer ${KEY_A}` });
    const anotherGuess = await rawPost(limited.url, { Authorization: `Bearer pe_live_guess_next` });

    expect([verified.status, guess.status, again.status, anotherGuess.status]).toEqual([200, 401, 200, 429]);

    await limited.close();
  });

  it("keeps the failed key budget of one client address away from another", async () => {
    const started = startApp(api.url, { authFailureBudget: new RequestBudget({ perMinute: 1 }), trustProxyHops: 1 });
    const proxied = await started.listening;

    const first = await rawPost(proxied.url, { Authorization: `Bearer ${KEY_UNKNOWN}`, "X-Forwarded-For": "1.1.1.1" });
    const repeat = await rawPost(proxied.url, { Authorization: `Bearer ${KEY_UNKNOWN}`, "X-Forwarded-For": "1.1.1.1" });
    const other = await rawPost(proxied.url, { Authorization: `Bearer ${KEY_UNKNOWN}`, "X-Forwarded-For": "2.2.2.2" });
    const otherValid = await rawPost(proxied.url, { Authorization: `Bearer ${KEY_A}`, "X-Forwarded-For": "3.3.3.3" });

    expect([first.status, repeat.status, other.status, otherValid.status]).toEqual([401, 429, 401, 200]);

    await proxied.close();
  });

  it("answers a malformed body with a JSON-RPC 400 and no stack trace", async () => {
    const response = await fetch(`${app.url}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY_A}` },
      body: "{not json",
    });
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(JSON.parse(text).error.message).toContain("Body must be JSON");
    expect(text).not.toContain(" at ");
  });

  it("answers a body over the limit with a JSON-RPC 413", async () => {
    const response = await rawPost(app.url, { Authorization: `Bearer ${KEY_A}` }, { ...INITIALIZE, padding: "x".repeat(1_100_000) });
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error.code).toBe(-32600);
    expect(body.error.message).toContain("under 1 MB");
  });

  it("refuses an Origin outside the allowlist and still serves requests without one", async () => {
    const started = startApp(api.url, { allowedOrigins: ["https://app.example"] });
    const guarded = await started.listening;

    const evil = await rawPost(guarded.url, { Authorization: `Bearer ${KEY_A}`, Origin: "https://evil.example" });
    const allowed = await rawPost(guarded.url, { Authorization: `Bearer ${KEY_A}`, Origin: "https://app.example" });
    const headless = await rawPost(guarded.url, { Authorization: `Bearer ${KEY_A}` });

    expect(evil.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(headless.status).toBe(200);

    await guarded.close();
  });

  it("passes a PromptEye 429 on as 429 with its Retry-After", async () => {
    const response = await rawPost(app.url, { Authorization: `Bearer ${KEY_THROTTLED}` });
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(body.error.message).toContain("Too many requests");
  });

  it("serves OAuth protected resource metadata at both well-known paths when configured", async () => {
    const oauth = { resource: "https://mcp.example.com/mcp", authorizationServer: "https://auth.example.com" };
    const started = startApp(api.url, { oauth });
    const configured = await started.listening;

    for (const path of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"]) {
      const response = await fetch(`${configured.url}${path}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        resource: oauth.resource,
        authorization_servers: [oauth.authorizationServer],
        bearer_methods_supported: ["header"],
        scopes_supported: ["api_access"],
      });
    }

    await configured.close();
  });

  it("challenges with resource_metadata and scope, adding invalid_token only for a rejected credential", async () => {
    const started = startApp(api.url, { oauth: { resource: "https://mcp.example.com/mcp", authorizationServer: "https://auth.example.com" } });
    const configured = await started.listening;
    const metadata = "https://mcp.example.com/.well-known/oauth-protected-resource/mcp";

    const missing = await rawPost(configured.url, {});
    const rejected = await rawPost(configured.url, { Authorization: `Bearer ${KEY_UNKNOWN}` });

    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toBe(
      `Bearer realm="prompteye-mcp", scope="api_access", resource_metadata="${metadata}"`
    );
    expect(rejected.status).toBe(401);
    expect(rejected.headers.get("www-authenticate")).toBe(
      `Bearer realm="prompteye-mcp", error="invalid_token", scope="api_access", resource_metadata="${metadata}"`
    );

    await configured.close();
  });

  it("serves the metadata without credentials or host and origin checks, and caches it", async () => {
    const started = startApp(api.url, {
      oauth: { resource: "https://mcp.example.com/mcp", authorizationServer: "https://auth.example.com" },
      allowedHosts: ["mcp.example.com"],
      allowedOrigins: ["https://app.example"],
    });
    const configured = await started.listening;

    const response = await fetch(`${configured.url}/.well-known/oauth-protected-resource/mcp`);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");

    await configured.close();
  });

  it("ignores a client's Mcp-Session-Id and keeps answering after its bearer is refreshed", async () => {
    const first = await connect(app.url, { Authorization: `Bearer ${JWT_A}` });
    clients.push(first.client);

    const refreshed = await rawPost(
      app.url,
      { Authorization: `Bearer ${JWT_A_REFRESHED}`, "Mcp-Session-Id": first.transport.sessionId ?? "stale-session" },
      { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} }
    );

    expect(refreshed.status).toBe(200);
    expect(await refreshed.text()).toContain("list_projects");
  });

  it("accepts a JWT-shaped bearer and forwards exactly that bearer on tool calls", async () => {
    const { client } = await connect(app.url, { Authorization: `Bearer ${JWT_A}` });
    clients.push(client);
    tokensSeen.length = 0;

    const projects = await client.callTool({ name: "list_projects", arguments: {} });

    expect(projects.isError).toBeFalsy();
    expect(textOf(projects)).toContain("Jwt");
    expect(tokensSeen.length).toBeGreaterThan(0);
    expect(new Set(tokensSeen)).toEqual(new Set([JWT_A]));
  });

  it("challenges an unauthenticated GET, while an authenticated one is 405", async () => {
    const started = startApp(api.url, { oauth: { resource: "https://mcp.example.com/mcp", authorizationServer: "https://auth.example.com" } });
    const configured = await started.listening;

    const anonymous = await fetch(`${configured.url}/mcp`);
    const authenticated = await fetch(`${configured.url}/mcp`, { headers: { Authorization: `Bearer ${KEY_A}` } });

    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get("www-authenticate")).toContain(
      'resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp"'
    );
    expect(authenticated.status).toBe(405);

    await configured.close();
  });

  it("answers 403 insufficient_scope when the API refuses the token", async () => {
    const started = startApp(api.url, { oauth: { resource: "https://mcp.example.com/mcp", authorizationServer: "https://auth.example.com" } });
    const configured = await started.listening;

    const response = await rawPost(configured.url, { Authorization: `Bearer ${JWT_NO_SCOPE}` });

    expect(response.status).toBe(403);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer realm="prompteye-mcp", error="insufficient_scope", scope="api_access", resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp"'
    );

    await configured.close();
  });

  it("answers 403 insufficient_scope without resource_metadata when OAuth is off", async () => {
    const response = await rawPost(app.url, { Authorization: `Bearer ${JWT_NO_SCOPE}` });

    expect(response.status).toBe(403);
    expect(response.headers.get("www-authenticate")).toBe('Bearer realm="prompteye-mcp", error="insufficient_scope", scope="api_access"');
  });

  it("counts insufficient_scope toward the auth-failure budget", async () => {
    const started = startApp(api.url, { authFailureBudget: new RequestBudget({ perMinute: 1 }) });
    const limited = await started.listening;

    const first = await rawPost(limited.url, { Authorization: `Bearer ${JWT_NO_SCOPE}` });
    const second = await rawPost(limited.url, { Authorization: `Bearer ${JWT_NO_SCOPE}` });

    expect(first.status).toBe(403);
    expect(second.status).toBe(429);

    await limited.close();
  });

  it("challenges the next request once the API answers 401 to a tool call, so the client re-authenticates", async () => {
    const { client } = await connect(app.url, { Authorization: `Bearer ${JWT_EXPIRING}` });
    clients.push(client);
    expired.add(JWT_EXPIRING);

    const call = await client.callTool({ name: "list_projects", arguments: {} });
    expect(call.isError).toBe(true);

    const next = await rawPost(
      app.url,
      { Authorization: `Bearer ${JWT_EXPIRING}` },
      { jsonrpc: "2.0", id: 4, method: "tools/list", params: {} }
    );
    expect(next.status).toBe(401);
    expect(next.headers.get("www-authenticate")).toContain('error="invalid_token"');
    expired.delete(JWT_EXPIRING);
  });

  it("serves no OAuth metadata when not configured", async () => {
    const response = await fetch(`${app.url}/.well-known/oauth-protected-resource`);

    expect(response.status).toBe(404);
  });
});
