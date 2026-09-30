# prompteye-mcp

An MCP server for [PromptEye](https://prompteye.com) — how visible a brand is inside the
answers AI assistants give, and the content that changes it.

A client picks a project, then works with the prompts it is tracked on: which questions are
being asked, how they are grouped and filed, and which ones PromptEye suggests adding next. For
the prompts where the brand is weak, it starts content generation, so the whole visibility loop
is reachable from here: track, generate content, measure.

The server needs the API URL of the deployment, and every call needs a PromptEye API key.
Both are at [app.prompteye.com/integrations](https://app.prompteye.com/integrations). Over
stdio the key comes from the environment, one key per process; over HTTP each request carries
its own key, so one hosted server serves many users (see [Hosted / HTTP mode](#hosted--http-mode)).

## Knowing what to do with it

"I connected it — now what?" is the first question a user asks, and a list of sixteen tools does
not answer it. Three things answer it instead:

- **Server instructions** (`src/instructions.ts`) reach the host at connection time, before any
  call. They lay out the order the product works in — project, brand description, prompts,
  measurement, content — and say plainly what cannot be done through the API, so nobody is
  promised a button that is not there, and nobody is told PromptEye cannot generate content.
- **`get_started`** answers from the workspace rather than from a brochure: it reads the account,
  the project, whether the brand description exists, how many prompts are tracked, how many were
  never named and how many suggestions are waiting, then names the first rung that is missing.
- **The help center** (`src/help/`, `src/tools/help.ts`) is PromptEye's knowledge base of guides
  on how the product works. Its complete corpus is `https://app.prompteye.com/help/llms-full.txt`;
  `read_full_help_knowledge_base` exposes it to hosts, while `list_help_articles` and
  `read_help_article` locate and retrieve individual Markdown guides. Server instructions tell the
  model to check relevant articles in the full corpus before answering, cite their titles and avoid
  guessing. The host is fixed in `src/help/help.ts`, and `read_help_article` only accepts Markdown
  paths under `/help/raw/` on it.
- **Prompts** (`src/prompts.ts`) are the workflows, surfaced by hosts as slash commands:
  `visibility_review`, `what_to_track_next`, `own_the_narrative` and `onboard_brand`.

## Tools

Every one of these calls the PromptEye API.

| Tool | Endpoint |
|---|---|
| `get_started` | several, read together |
| `get_account` | `GET /v1/me` |
| `list_projects` | `GET /v1/projects` |
| `select_project`, `get_active_project` | `GET /v1/projects/{projectId}` |
| `create_project` | `POST /v1/projects` |
| `get_knowledge_base` | `GET /v1/projects/{projectId}/knowledge-base` |
| `list_categories` | `GET /v1/projects/{projectId}/categories` |
| `list_prompts` | `GET /v1/projects/{projectId}/prompts` |
| `get_prompt` | `GET /v1/projects/{projectId}/prompts/{promptId}` |
| `list_prompt_groups` | `GET /v1/projects/{projectId}/prompt-groups` |
| `list_prompt_suggestions` | `GET /v1/projects/{projectId}/prompt-suggestions` |
| `add_prompts` | `POST /v1/projects/{projectId}/prompts` |
| `create_report` | `POST /v1/reports` — **public, no key**, identified by `agencyId` |
| `get_report_integration` | `GET /v1/me` — the agency id and endpoint to post a form to |
| `list_reports` | `GET /v1/reports` |
| `get_report` | `GET /v1/reports/{reportId}` |
| `list_sources` | `GET /v1/projects/{projectId}/sources` |
| `list_competitors` | `GET /v1/projects/{projectId}/competitors` |
| `create_content_brief` | `POST /v1/content/briefs` |
| `get_content_brief` | `GET /v1/content/briefs/{briefId}` |
| `get_google_status` | `GET /v1/projects/{projectId}/traffic/google/status` |
| `get_search_performance` | `GET /v1/projects/{projectId}/traffic/google/search`, `…/search/queries`, `…/search/pages` |
| `get_ai_traffic` | `GET /v1/projects/{projectId}/traffic/google/analytics`, `…/analytics/sources`, `…/analytics/pages` |
| `list_bot_visits` | `GET /v1/projects/{projectId}/traffic/events` |
| `count_bot_visits` | `GET /v1/projects/{projectId}/traffic/events/count` |
| `list_crawls` | `GET /v1/projects/{projectId}/traffic/crawls` |
| `get_sitemap` | `GET /v1/projects/{projectId}/traffic/sitemap` |

Periods default to the last 30 days and are capped at 366 — except the bot traffic, which the API
reads a month at a time, so `list_bot_visits` and `count_bot_visits` cap theirs at 31 days.

### The bot traffic

One tool per endpoint: `list_bot_visits` is the evidence, `count_bot_visits` the totals the API
computed, `list_crawls` what each bot has ever fetched, `get_sitemap` what the site offers for
reading. Paths in the last two are in the same form, so comparing them is the caller's job — the
tools do not join anything.

Every request carries `verified`, which says whether the origin checked out as the bot it names. A
`User-Agent` is free text and the API has no filter for it, so `list_bot_visits` prints the flag on
every row and both descriptions say a count is an upper bound. No tool drops a row or adjusts a
figure on its own.

### Google's own figures

`get_search_performance` and `get_ai_traffic` report the period's totals, and `by` ranks it
instead: `query` or `page` for Search Console, `source` or `page` for the sessions Analytics
attributes to AI assistants. One tool per pair of endpoints rather than one per endpoint, so the
tool list stays readable.

These count people who arrived, where visibility counts answers that named the brand — and they
undercount by design, since an assistant that names a brand without linking it sends nobody. Both
integrations are bound to the project in the PromptEye app, and a project with nothing bound
answers with zeros and empty lists, which reads exactly like a site nobody visits. So an empty
reading makes one extra call to `…/traffic/google/status` and says which of the two it was.

### Content generation

PromptEye generates content as well as measuring visibility, and the two make one loop: track the
prompts, generate an article for the ones where the brand is weak, then read whether that
prompt's visibility and citations move.

`create_content_brief` starts it for the active project. It orders a brief — a title and an H2/H3
outline — for an article that targets one prompt; passing `promptId` links the brief to a tracked
prompt, which is what later measures the article. The brief comes back `processing`, and
`get_content_brief` reads it until it is `ready`: the outline, the fan-out phrases it covers and the
phrases that deserve an article of their own.

The API stops at the brief. Writing the article from it, saving its published URL, requesting
indexing and following citations are done in the PromptEye app under
[Content](https://app.prompteye.com/content), and the server instructions say so.

### Public reports

Next to tracking sits PromptEye's lead magnet, sold to agencies white-label: a prospect fills in
a form, gets a visibility report branded as the agency, and becomes a lead. `create_report`
generates one — it is the **only call that sends no API key**, because that endpoint is public
and books the report to the account named by `agencyId`, spending that account's quota. That id is
the id of the account the configured key belongs to, so nothing is asked for: `create_report`
reads it from the account itself. A report for the same domain within 30 days is re-sent rather
than rebuilt, and the tool says which happened. `list_reports` and `get_report` read them back
with the key, including every request to be contacted from the report page.

`get_report_integration` answers the other half of it — how an agency posts its own form straight
to the endpoint. It returns the agency id, `POST {base URL}/v1/reports`, a filled-in example body,
a cURL line and the request typed out, ready to hand to a developer. The snippet carries no API
key, which is what makes it safe in a browser.

`list_prompt_suggestions` is the way to add prompts: PromptEye generates them from real
demand and from how people actually put questions to assistants. `add_prompts` tracks
hand-written prompts instead, skipping that, so it says as much in its own description and
requires `confirmBypassPromptIntelligence: true`.

### The tools that are switched off

Visibility, answers and citation quality are not wired to the API yet. Their
tools, their sample data in `src/fixtures/` and the widget are still in the repository but
are **not registered**, so no client can call them and nothing reports a figure that was
never measured. The switch is one constant:

```ts
// src/server.ts
const SAMPLE_TOOLS = false;   // true to demo them from sample data
```

When the API serves those endpoints: add them to the client in `src/api/`, move the methods
from `src/client/fixtures-client.ts` to `src/client/live-client.ts`, then delete the
constant and the fixtures.

## The branded pages

`list_prompts`, `list_competitors` and `list_sources` are MCP App tools: a host that
supports UI renders a PromptEye-branded page beside the text — the mark, the orange the
mark is drawn in, warm neutrals, and ranked bars with the project's own brand or domain
picked out. The prompts page adds headline tiles and a chip per prompt for its status,
business priority and categories.

One shell carries the brand and both handshakes, and each widget contributes only its
`render()`; `src/widgets.ts` composes them, so the brand lives in one file rather than
copied into each page.

| Host | How the page gets its data |
|---|---|
| Claude | The MCP Apps handshake over `postMessage`: `ui/initialize`, then `ui/notifications/tool-result` |
| ChatGPT | The Apps SDK: `window.openai.toolOutput`, refreshed by the `openai:set_globals` event |

Both paths call the same `render()`, so a widget is written once. Tools carry the resource
uri under `_meta.ui.resourceUri` for Claude and `_meta["openai/outputTemplate"]` for the
Apps SDK, and the resource is served as `text/html;profile=mcp-app`. ChatGPT also expects
its own `text/html+skybridge` mime, which would be a second registration of the same page —
worth adding only once the server is actually reachable as a ChatGPT connector.

## Running it

```bash
npm install
cp .env.example .env      # put the API URL in it; the key too, for stdio
npm run build

npm start                 # stdio — Claude Desktop, Cursor; key from PROMPTEYE_API_KEY
npm run start:http        # Streamable HTTP on http://localhost:3000/mcp; key per request
npm test
```

`npm run start:http` needs only `PROMPTEYE_API_BASE_URL` (and `PORT`, optionally). It never
reads `PROMPTEYE_API_KEY`.

During development, `npm run dev` and `npm run dev:http` watch and reload.

### Hosted / HTTP mode

The HTTP server holds no key of its own. Each request brings the caller's PromptEye API key in
one of two headers — `Authorization` wins when both are present:

```http
Authorization: Bearer pe_live_…
X-PromptEye-Key: pe_live_…
```

What happens with it:

- **Verified at initialize.** The first request of a session (`initialize`) is answered only
  after `GET /v1/me` on the PromptEye API accepts the key. A key PromptEye rejects gets `401`
  with a `WWW-Authenticate: Bearer` challenge; a PromptEye API that cannot be reached gets `503`
  with `Retry-After`. A request without a key gets `401` before anything else is looked at.
- **Sessions are bound to the key.** The `Mcp-Session-Id` the server hands out is usable only
  with the key that opened it; with any other key it is `404 Session not found`, as if it never
  existed. Each session has its own `McpServer`, its own API client and its own project
  selection, so nothing leaks between users. Sessions idle for `MCP_SESSION_IDLE_MINUTES` are
  closed, and a key holds at most `MCP_MAX_SESSIONS_PER_KEY` at a time — the oldest goes first.
- **Rate limits.** `MCP_RATE_LIMIT_PER_KEY` requests a minute per key and
  `MCP_RATE_LIMIT_PER_IP` per client address, answered with `429` and `Retry-After` when
  exceeded. `Retry-After` from the PromptEye API itself is passed on to the model in the tool
  error text.
- **Logs** are one JSON line per request on stdout — method, path, status, duration, the
  JSON-RPC method and the tool name for `tools/call`, and a SHA-256 fingerprint of the key.
  Never the key, never headers, never arguments. `LOG_LEVEL=error` keeps only failures.
- **`GET /healthz`** (and `GET /`) answer `{ "status": "ok", "server": { "name", "version" } }`
  and nothing about the deployment or the sessions.

Pointing a client at it:

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "prompteye": {
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer pe_live_…" }
    }
  }
}
```

```bash
claude mcp add --transport http prompteye http://localhost:3000/mcp \
  --header "Authorization: Bearer pe_live_…"
```

Claude.ai and ChatGPT connectors authenticate with OAuth rather than a pasted header; that is
not in this version, so they cannot use the hosted server yet.

Set `MCP_PUBLIC_HOSTS` to the `Host` values the server is reachable under when it faces the
internet directly, so a browser cannot be tricked into talking to it through DNS rebinding.
Behind a proxy that terminates TLS, the proxy is the place to enforce that, and the proxy's
client address is what the per-IP limit sees.

### Claude Desktop

`npm run bundle` packs the server into `build/prompteye-mcp.mcpb`. Install it by
double-clicking the file, dragging it onto the Claude Desktop window, or through Settings →
Extensions → Advanced settings → Install Extension. The install form asks for both settings:

- **PromptEye API key** — `pe_live_…`, with the `api_access` scope. Kept in the operating
  system's keychain.
- **API base URL** — the API URL of the deployment that key belongs to.

Both are at [app.prompteye.com/integrations](https://app.prompteye.com/integrations).

After changing either, disable and re-enable the extension so the server restarts with them.
The server logs which deployment it talks to — never the key — to
`~/Library/Logs/Claude/mcp-server-PromptEye.log`.

Pushing a `v*` tag builds the bundle in CI and attaches it to the GitHub release
(`.github/workflows/bundle.yml`); the workflow also runs on demand.

Configured by hand instead of as a bundle:

```json
{
  "mcpServers": {
    "prompteye": {
      "command": "node",
      "args": ["/absolute/path/to/prompteye-mcp/dist/index.js"],
      "env": {
        "PROMPTEYE_API_BASE_URL": "https://…",
        "PROMPTEYE_API_KEY": "pe_live_…"
      }
    }
  }
}
```

## The API client

`src/api/` is a client for the PromptEye API that knows nothing about MCP and depends on
`zod` alone, so it can be published as its own package.

```ts
import { PromptEyeApi, PromptEyeApiError } from "./api/index.js";

const api = new PromptEyeApi({
  baseUrl: process.env.PROMPTEYE_API_BASE_URL!,
  token: process.env.PROMPTEYE_API_KEY!,
});

const account = await api.account.get();
const { data: projects } = await api.projects.list();
const project = await api.projects.get(projects[0].id);
const { data: prompts } = await api.prompts.list(project.id, { startDate: "2026-08-01" });
const { data: suggestions } = await api.promptSuggestions.list(project.id);
await api.prompts.create(project.id, [{ prompt: "best crm for agencies", groupName: "Comparisons" }]);
```

| Option | Default | |
|---|---|---|
| `token` | required | The API key, sent as `Authorization: Bearer …` |
| `baseUrl` | required | API root of the deployment the token belongs to |
| `timeoutMs` | `30000` | Request timeout |
| `fetch` | global `fetch` | Any compatible implementation |
| `headers` | `{}` | Sent with every request |

Every method also takes `{ signal }` as its last argument.

Responses are validated with `zod`: unknown fields are dropped and enumeration values added
later are accepted, while a field that changed shape throws a `ZodError`.

A non-2xx answer throws `PromptEyeApiError` with the `status` and the response `body`;
`code` and `details` are read from that body, and `message` comes from `API_ERROR_MESSAGES`,
which maps every documented error code to a human message.

## How a conversation goes

Every tool but `list_projects`, `create_project`, `select_project` and `get_account` reports
on **the active project**, and takes no project argument. So a session starts by choosing one:

```
list_projects                  → the projects, with their ids
select_project(projectId: …)   → that project is now active
list_prompt_suggestions()
list_prompts(by group or category)
```

Calling a project-scoped tool before selecting returns a recoverable error telling the
model to list and select first — except when the key reaches exactly one project, which is
then selected automatically. `create_project` also makes what it created active.

## Layout

```
src/
  api/                PromptEye API client — no MCP in it, publishable on its own
  index.ts            stdio entry point — key and API URL from the environment
  index-http.ts       Streamable HTTP entry point — reads the environment, wires src/http/
  http/
    app.ts            the express app: key per request, verify at initialize, route to sessions
    credentials.ts    reads the key from Authorization / X-PromptEye-Key, fingerprints it
    sessions.ts       SessionRegistry — sessions bound to a key, idle sweep, per-key cap
    rate-limit.ts     RequestBudget — requests per minute, per key and per client address
    logging.ts        one JSON line per event, never a key or a header
  server.ts           builds one server from a ToolContext: session, tools, SAMPLE_TOOLS switch
  session.ts          ProjectSession — which project the tools report on
  config.ts           environment, credentials, and the client factory
  client/             PromptEyeClient interface; live (API) and fixture implementations
  schemas/            zod mirrors of the models the API does not serve yet
  tools/              one module per group of tools, plus the glossary they quote
  fixtures/           sample data, for the switched-off tools only
  widgets.ts          composes and registers the branded pages tools render
public/
  widget-shell.html        the brand: mark, palette, and both host handshakes
  widgets/*.js             one render() per widget, dropped into that shell
manifest.json         MCPB manifest — entry point, and the settings users fill in
scripts/bundle.mjs    stages dist/, public/ and production deps, then packs the .mcpb
```

## Environment

| Variable | Default | Mode | Purpose |
|---|---|---|---|
| `PROMPTEYE_API_BASE_URL` | required | both | API root of the deployment |
| `PROMPTEYE_API_KEY` | required for stdio | stdio | The API key; HTTP takes it from each request instead |
| `MCP_SERVER_NAME` | `prompteye-mcp` | both | Name reported to clients |
| `MCP_SERVER_VERSION` | `1.0.0` | both | Version reported to clients |
| `PORT` | `3000` | HTTP | Port to listen on |
| `LOG_LEVEL` | `info` | HTTP | `info` logs every request, `error` only failures |
| `MCP_SESSION_IDLE_MINUTES` | `30` | HTTP | Sessions idle this long are closed |
| `MCP_MAX_SESSIONS_PER_KEY` | `20` | HTTP | Open sessions one key may hold; the oldest is closed first |
| `MCP_RATE_LIMIT_PER_KEY` | `120` | HTTP | Requests a minute per key |
| `MCP_RATE_LIMIT_PER_IP` | `600` | HTTP | Requests a minute per client address |
| `MCP_PUBLIC_HOSTS` | unset | HTTP | Comma-separated `Host` values to accept; unset accepts any |

Both the API URL and the key are at
[app.prompteye.com/integrations](https://app.prompteye.com/integrations).
