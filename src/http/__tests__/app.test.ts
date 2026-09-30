import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import { Writable } from "stream";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHttpApp, type HttpAppOptions } from "../app.js";
import { createJsonLogger } from "../logging.js";
import { RequestBudget } from "../rate-limit.js";
import { SessionRegistry } from "../sessions.js";

const KEY_A = "pe_live_aaaaaaaaaaaaaaaaaaaaaaaa";
const KEY_B = "pe_live_bbbbbbbbbbbbbbbbbbbbbbbb";
const KEY_UNKNOWN = "pe_live_cccccccccccccccccccccccc";

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

const answer = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

function stubApi(req: IncomingMessage, res: ServerResponse): void {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const projects = token === undefined ? undefined : PROJECTS_BY_KEY[token];
  if (!projects) return answer(res, 401, { error: { code: "unauthorized", message: "Unknown key." } });

  const path = req.url ?? "";
  if (path === "/v1/me") return answer(res, 200, ACCOUNT);
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
    registry: new SessionRegistry({ idleMs: 60_000, maxPerKey: 5 }),
    logger: createJsonLogger(sink),
    keyBudget: new RequestBudget({ perMinute: 1_000 }),
    ipBudget: new RequestBudget({ perMinute: 1_000 }),
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
    expect(response.headers.get("www-authenticate")).toBe('Bearer realm="prompteye-mcp", error="invalid_token"');
    expect(body.error.message).toContain("Missing PromptEye API key");
  });

  it("refuses a key PromptEye rejects with 401", async () => {
    const response = await rawPost(app.url, { Authorization: `Bearer ${KEY_UNKNOWN}` });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("invalid_token");
    expect(body.error.message).toContain("PromptEye rejected this API key");
  });

  it("refuses a non-initialize request without a session with 400", async () => {
    const response = await rawPost(
      app.url,
      { Authorization: `Bearer ${KEY_A}` },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }
    );

    expect(response.status).toBe(400);
  });

  it("keeps the project selection of one key away from another", async () => {
    const a = await connect(app.url, { Authorization: `Bearer ${KEY_A}` });
    const b = await connect(app.url, { Authorization: `Bearer ${KEY_B}` });
    clients.push(a.client, b.client);

    const selected = await a.client.callTool({ name: "select_project", arguments: { projectId: "a2" } });
    expect(textOf(selected)).toContain("Acme UK");

    const activeInB = await b.client.callTool({ name: "get_active_project", arguments: {} });
    expect(activeInB.isError).toBe(true);
    expect(textOf(activeInB)).toContain("No project is selected");

    const activeInA = await a.client.callTool({ name: "get_active_project", arguments: {} });
    expect(activeInA.isError).toBeFalsy();
    expect(textOf(activeInA)).toContain("Acme UK");

    const stolen = await rawPost(
      app.url,
      { Authorization: `Bearer ${KEY_B}`, "Mcp-Session-Id": a.transport.sessionId ?? "" },
      { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} }
    );
    expect(stolen.status).toBe(404);
    expect((await stolen.json()).error.message).toContain("Session not found");
  });

  it("accepts the key from X-PromptEye-Key", async () => {
    const { client } = await connect(app.url, { "X-PromptEye-Key": KEY_B });
    clients.push(client);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain("select_project");
  });

  it("answers /healthz without the data source or the session count", async () => {
    const response = await fetch(`${app.url}/healthz`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.server.name).toBeDefined();
    expect(body).not.toHaveProperty("source");
    expect(body).not.toHaveProperty("sessions");
  });

  it("never writes a key into the log", () => {
    const logged = logLines.join("");
    expect(logged).toContain('"event":"mcp.request"');
    expect(logged).toContain('"tool":"select_project"');
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
});
