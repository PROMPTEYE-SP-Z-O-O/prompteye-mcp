# PromptEye MCP

## Working style

- Delegate small, well-specified tasks (implementing a clear spec, searches, running tests) to subagents on cheaper models (`sonnet`, or `haiku` for trivial lookups). Keep analysis and decisions in the main model and review what subagents return.

## PromptEye API — source of truth

- The public API contract lives in `../prompteye-vibe` (branch `research`): Zod routes in `api/src/<resource>/*Routes.ts`, exported to `api/openapi.json`.
- The contract documents some routes ahead of their implementation. Only routes registered in `convex/publicApi/app.ts` (`publicApi.openapi(route, handler)`) are live — check there before adding or keeping a tool.
- Contract-only today (served from fixtures, not live): `/visibility`, `/visibility/summary`, `/citation-quality`. Do not expose them as tools.
- The MCP tools are pass-throughs to the API: no business logic or validation of their own; describe API rules in the tool description instead.
