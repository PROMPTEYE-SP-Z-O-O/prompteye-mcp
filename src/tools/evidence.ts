import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { MAX_LIMIT, dateRangeShape, modelFilterShape } from "../schemas/common.js";
import { CitedDomainSchema, CitedPageSchema, NextCursorSchema } from "../schemas/prompteye.js";
import { widgetMeta, widgetUri } from "../widgets.js";
import { CITED_DOMAINS } from "./glossary.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

export const SOURCES_WIDGET = "sources";

export function registerSourceTools(server: McpServer, { client, session }: ToolContext): void {
  registerAppTool(
    server,
    "list_sources",
    {
      title: "List the domains assistants cite",
      description:
        "The domains the assistants leaned on when answering the active project's prompts, ranked by " +
        "how often they were cited. Call this to see which pages shape what the assistants say about " +
        "the brand, and where to go to change it.\n\n" +
        `${CITED_DOMAINS}\n\n` +
        "When the own domain holds a small share, create_content_brief starts an article of the " +
        "brand's own for the assistants to cite on the prompt it targets.\n\n" +
        "The ranking answers with the most cited domains rather than a list to walk to the end of, so " +
        "raise `limit` to see further down. `model` narrows it to one assistant, which is how to tell " +
        "a source every assistant trusts from one that only a single assistant leans on.",
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        ...modelFilterShape,
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .optional()
          .describe(`How many domains to return, at most ${MAX_LIMIT}.`),
      },
      outputSchema: {
        data: z.array(CitedDomainSchema),
        nextCursor: NextCursorSchema,
        projectName: z.string(),
        brand: z.string(),
        model: z.string().nullable().describe("The assistant the ranking is narrowed to. null = all assistants."),
      },
      _meta: widgetMeta(widgetUri(SOURCES_WIDGET), "Reading the citations…", "Read the citations"),
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const page = await client.listSources(project.id, args);

        return ok({
          ...page,
          projectName: project.name,
          brand: project.brand,
          model: args.model ?? null,
        });
      })
  );

  server.registerTool(
    "list_source_pages",
    {
      title: "List the exact pages assistants cite",
      description:
        "The individual pages behind list_sources — each row is one URL, not a domain, so a host cited " +
        "on several different pages shows up once per page instead of folded into one domain total. " +
        "Call this when the domain ranking does not say enough: which page of a review site carries " +
        "the brand, or which own page the assistants actually quote.\n\n" +
        "A citation is not visibility: an answer can cite the brand's own domain without naming the " +
        "brand, and name the brand while citing nobody. Read this beside list_prompts and " +
        "list_competitors, not instead of them.\n\n" +
        "The ranking is built by adding up the period, so it answers with the `limit` most cited pages " +
        "rather than a list to walk to the end of; `share` is each page's slice of the occurrences across " +
        "the pages reported. `model` narrows it to one assistant.",
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        ...modelFilterShape,
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .optional()
          .describe(`How many pages to return, at most ${MAX_LIMIT}.`),
      },
      outputSchema: { data: z.array(CitedPageSchema), nextCursor: NextCursorSchema },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const page = await client.listSourcePages(project.id, args);
        return ok(page);
      })
  );
}
