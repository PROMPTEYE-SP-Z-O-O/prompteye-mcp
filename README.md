# prompteye-mcp

An MCP server for [PromptEye](https://prompteye.com) — how visible a brand is inside the
answers AI assistants give.

A client picks a project, then asks about its visibility, the competitors answering
alongside it, the prompts being tracked, and the answers and sources behind the numbers.

The server needs an API key and the API URL of the deployment it belongs to. Both are at
[app.prompteye.com/integrations](https://app.prompteye.com/integrations), and it refuses to
start without them.

## Where the answers come from

Every tool whose endpoint the PromptEye API already serves calls the API. The rest answer
from the sample data in `src/fixtures/`, and say so in their text, so the model does not
pass illustrative figures off as measurements.

| Tool | Endpoint | Source |
|---|---|---|
| `get_account` | `GET /v1/me` | **API** |
| `list_projects` | `GET /v1/projects` | **API** |
| `select_project`, `get_active_project` | `GET /v1/projects/{projectId}` | **API** |
| `get_knowledge_base` | `GET /v1/projects/{projectId}/knowledge-base` | **API** |
| `list_categories` | `GET /v1/projects/{projectId}/categories` | **API** |
| `list_prompt_suggestions` | `GET /v1/projects/{projectId}/prompt-suggestions` | **API** |
| `list_prompts`, `get_prompt`, `list_prompt_groups` | — | sample data |
| `get_visibility_summary`, `get_visibility_timeseries` | — | sample data |
| `list_competitors`, `list_answers`, `list_sources`, `get_citation_quality` | — | sample data |

When the API grows an endpoint: add it to the client in `src/api/`, then move the method
from the fixtures to `src/client/live-client.ts`.

## Running it

```bash
npm install
cp .env.example .env      # put your key and API URL in it
npm run build

npm start                 # stdio — Claude Desktop, Cursor
npm run start:http        # Streamable HTTP on http://localhost:3000/mcp
npm test
```

During development, `npm run dev` and `npm run dev:http` watch and reload.

### Claude Desktop

`npm run bundle` packs the server into `build/prompteye-mcp.mcpb`. Install it by
double-clicking the file, dragging it onto the Claude Desktop window, or through Settings →
Extensions → Advanced settings → Install Extension. The install form asks for both settings:

- **PromptEye API key** — `pe_live_…`, with the `api_access` scope. Kept in the operating
  system's keychain.
- **API base URL** — the API URL of the deployment that key belongs to.

Both are at [app.prompteye.com/integrations](https://app.prompteye.com/integrations).

After changing either, disable and re-enable the extension so the server restarts with them.
The server logs where its answers come from — never the key — to
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
        "PROMPTEYE_API_KEY": "pe_live_…",
        "PROMPTEYE_API_BASE_URL": "https://…"
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
  token: process.env.PROMPTEYE_API_KEY!,
  baseUrl: process.env.PROMPTEYE_API_BASE_URL!,
});

const account = await api.account.get();
const { data: projects } = await api.projects.list();
const project = await api.projects.get(projects[0].id);
const knowledgeBase = await api.knowledgeBase.get(project.id);
const { data: categories } = await api.categories.list(project.id);
const { data: suggestions } = await api.promptSuggestions.list(project.id, { groupId: "…" });
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

Every tool but `list_projects`, `select_project` and `get_account` reports on **the active
project**, and takes no project argument. So a session starts by choosing one:

```
list_projects                  → the projects, with their ids
select_project(projectId: …)   → that project is now active
list_prompt_suggestions()
get_visibility_summary(by: "day")
```

Calling a project-scoped tool before selecting returns a recoverable error telling the
model to list and select first — except when the key reaches exactly one project, which is
then selected automatically.

Periods default to the last 30 days and are capped at 366. `model` narrows any of them to
one assistant: `gpt`, `perplexity`, `claude`, `deepSeek`, `gemini`, `grok`, `llama`,
`aiOverview`, `copilot`, `googleAiMode`.

## The widget

`get_visibility_summary` is registered as an MCP App tool: hosts that support MCP Apps
render `public/visibility-widget.html` alongside the text — the three headline figures with
their period-over-period change, a trend line when called with `by: "day"`, and per-assistant
bars when called with `by: "model"`.

It is one self-contained HTML file with no build step, so it speaks the MCP Apps
`ui/initialize` handshake over `postMessage` directly rather than importing the ext-apps
client.

## Layout

```
src/
  api/                PromptEye API client — no MCP in it, publishable on its own
  index.ts            stdio entry point
  index-http.ts       Streamable HTTP entry point, one MCP session per mcp-session-id
  server.ts           builds one server: session, tools, widget resource
  session.ts          ProjectSession — which project the tools report on
  config.ts           environment, and the client factory
  client/             PromptEyeClient interface; live (API + fallback) and fixture implementations
  schemas/            zod mirrors of the models the API does not serve yet
  tools/              one module per group of tools
  fixtures/           sample data
public/
  visibility-widget.html
manifest.json         MCPB manifest — entry point, and the settings users fill in
scripts/bundle.mjs    stages dist/, public/ and production deps, then packs the .mcpb
```

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PROMPTEYE_API_KEY` | required | The API key |
| `PROMPTEYE_API_BASE_URL` | required | API root of the deployment that key belongs to |
| `MCP_SERVER_NAME` | `prompteye-mcp` | Name reported to clients |
| `MCP_SERVER_VERSION` | `1.0.0` | Version reported to clients |
| `PORT` | `3000` | HTTP transport port |

Both the key and the API URL are at
[app.prompteye.com/integrations](https://app.prompteye.com/integrations).
