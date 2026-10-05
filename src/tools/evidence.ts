import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { MAX_LIMIT, dateRangeShape, modelFilterShape, promptScopeShape } from "../schemas/common.js";
import { ANSWER_BRAND_PRESENCE, AnswerSchema, CitedDomainSchema, CitedPageSchema, NextCursorSchema } from "../schemas/prompteye.js";
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
        "a source every assistant trusts from one that only a single assistant leans on.\n\n" +
        "Narrow the count to one prompt (`promptId`), one prompt group (`groupId`), or one category — " +
        "`categoryId` alone, or `categoryId` with `subcategoryId` — the same way the app's own screens " +
        "narrow it. Give at most one of these; combining them fails. list_source_pages does not take them.",
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        ...modelFilterShape,
        ...promptScopeShape("Count citations from"),
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

  server.registerTool(
    "get_prompt_answers",
    {
      title: "Read the assistants' answers",
      description:
        "The individual assistant answers behind the metrics, newest first — the answer text, whether " +
        "the brand was named and at which position, and the sources cited. Call this when a figure " +
        "needs checking: it is where a number is verified when someone asks why it moved.\n\n" +
        "Pass `resultId` with one of the sourceResultIds from get_brand_analysis_run to verify the " +
        "evidence for a gap; the date range is then ignored. Pass `promptId` with `model` to read how " +
        "a given assistant answers a prompt. `brand` narrows to the answers that named the brand " +
        "(`named`) or did not (`missing`), and `search` to the answers containing a phrase in the answer, prompt, brands or sources.\n\n" +
        "Without a date range the last 30 days are read; a range is at most one year. A page ends on a " +
        "whole collection run, so it can hold slightly more than `limit` answers. Pass nextCursor back " +
        "as `cursor` to read the next page.",
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        ...modelFilterShape,
        resultId: z
          .string()
          .min(1)
          .optional()
          .describe("Only the answers of this one collection run, a sourceResultIds entry of a brand analysis."),
        promptId: z.string().min(1).optional().describe("Only the answers to this prompt."),
        brand: z
          .enum(ANSWER_BRAND_PRESENCE)
          .optional()
          .describe("named = only answers that named the brand, missing = only those that did not."),
        search: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe("Only the answers containing this phrase in the answer text, prompt, brands or sources."),
        limit: z.number().int().min(1).max(50).optional().describe("How many answers to aim for, at most 50. Defaults to 25."),
        cursor: z
          .string()
          .min(1)
          .optional()
          .describe("The nextCursor of the previous page, passed back unchanged. Omit it to start from the newest answer."),
      },
      outputSchema: { data: z.array(AnswerSchema), nextCursor: NextCursorSchema },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const page = await client.listAnswers(project.id, args);
        return ok(page);
      })
  );
}
