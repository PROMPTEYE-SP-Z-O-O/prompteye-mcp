# prompteye-mcp

An MCP server for [PromptEye](https://prompteye.com) — how visible a brand is inside the
answers AI assistants give.

A client picks a project, then works with the prompts it is tracked on: which questions are
being asked, how they are grouped and filed, and which ones PromptEye suggests adding next.

The server needs the API URL of the deployment and an API key for it. Both are at
[app.prompteye.com/integrations](https://app.prompteye.com/integrations), and it refuses to
start without them.

## Tools

Every one of these calls the PromptEye API.

| Tool | Endpoint |
|---|---|
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
| `list_sources` | `GET /v1/projects/{projectId}/sources` |
| `list_competitors` | `GET /v1/projects/{projectId}/competitors` |

Periods default to the last 30 days and are capped at 366.

`list_prompt_suggestions` is the way to add prompts: PromptEye generates them from real
demand and from how people actually put questions to assistants. `add_prompts` tracks
hand-written prompts instead, skipping that, so it says as much in its own description and
requires `confirmBypassPromptIntelligence: true`.

### The tools that are switched off

Visibility, answers and citation quality have no endpoint yet. Their
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
  index.ts            stdio entry point
  index-http.ts       Streamable HTTP entry point, one MCP session per mcp-session-id
  server.ts           builds one server: session, tools, and the SAMPLE_TOOLS switch
  session.ts          ProjectSession — which project the tools report on
  config.ts           environment, and the client factory
  client/             PromptEyeClient interface; live (API) and fixture implementations
  schemas/            zod mirrors of the models the API does not serve yet
  tools/              one module per group of tools, plus the glossary they quote
  fixtures/           sample data, for the switched-off tools only
public/
  visibility-widget.html   registered with get_visibility_summary, so only with SAMPLE_TOOLS
manifest.json         MCPB manifest — entry point, and the settings users fill in
scripts/bundle.mjs    stages dist/, public/ and production deps, then packs the .mcpb
```

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PROMPTEYE_API_BASE_URL` | required | API root of the deployment |
| `PROMPTEYE_API_KEY` | required | The API key for that deployment |
| `MCP_SERVER_NAME` | `prompteye-mcp` | Name reported to clients |
| `MCP_SERVER_VERSION` | `1.0.0` | Version reported to clients |
| `PORT` | `3000` | HTTP transport port |

Both the API URL and the key are at
[app.prompteye.com/integrations](https://app.prompteye.com/integrations).
