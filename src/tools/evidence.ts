import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import {
  MAX_LIMIT,
  dateRangeShape,
  modelFilterShape,
  paginationShape,
  resolveDateRange,
} from "../schemas/common.js";
import { AnswerSchema, CitationQualitySchema, CitedDomainSchema, CitedPageSchema } from "../schemas/prompteye.js";
import { widgetMeta, widgetUri } from "../widgets.js";
import { CITED_DOMAINS } from "./glossary.js";
import { READ_ONLY, handled, morePages, num, ok, sampleData, type ToolContext } from "./result.js";

export const SOURCES_WIDGET = "sources";

/** The domains behind the answers — served by the API. */
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
        "The ranking answers with the most cited domains rather than a list to walk to the end of, so " +
        "raise `limit` to see further down. `model` narrows it to one assistant, which is how to tell " +
        "a source every assistant trusts from one that only a single assistant leans on.\n\n" +
        "Narrow the count to one prompt, one prompt group, or one category — `categoryId` alone, or " +
        "`categoryId` with `subcategoryId` — the same way the app's own visibility screen narrows it. " +
        "Give at most one of `promptId` / `groupId` / `categoryId`(+`subcategoryId`); combining them fails.",
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
        promptId: z
          .string()
          .min(1)
          .optional()
          .describe("Count citations from this prompt alone instead of every prompt in the project."),
        groupId: z
          .string()
          .min(1)
          .optional()
          .describe("Count citations from this prompt group alone instead of every prompt in the project."),
        categoryId: z
          .string()
          .min(1)
          .optional()
          .describe("Count citations from only the prompts filed under this category, subcategories included."),
        subcategoryId: z
          .string()
          .min(1)
          .optional()
          .describe("Narrow categoryId further, to one of its subcategories. Needs categoryId alongside it."),
      },
      outputSchema: {
        data: z.array(CitedDomainSchema),
        nextCursor: z.string().nullable(),
        projectName: z.string(),
        brand: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        model: z.string().nullable(),
      },
      _meta: widgetMeta(widgetUri(SOURCES_WIDGET), "Reading the citations…", "Read the citations"),
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const page = await client.listSources(project.id, { ...args, ...range });

        const lines = page.data.map(
          (domain) =>
            `- ${domain.domain}${domain.ownDomain ? " ← own domain" : ""} — ${domain.citations} citation(s), ` +
            `${num(domain.share, "%")} share`
        );

        return ok(
          (page.data.length === 0
            ? `No domains were cited between ${range.startDate} and ${range.endDate}.`
            : `Domains cited on ${project.brand}'s prompts, ${range.startDate} to ${range.endDate}:\n${lines.join("\n")}`) +
            morePages(page.nextCursor),
          {
            ...page,
            projectName: project.name,
            brand: project.brand,
            ...range,
            model: args.model ?? null,
          }
        );
      })
  );

  server.registerTool(
    "list_source_pages",
    {
      title: "List the exact pages assistants cite",
      description:
        "The individual pages behind list_sources — each row here is one URL, not a domain, so a host " +
        "cited on several different pages shows up once per page instead of folded into one domain " +
        "total. Call this when the domain breakdown does not say enough for the analysis at hand, for " +
        "example to hand someone the exact page to fix or to pitch rather than just its host.\n\n" +
        `${CITED_DOMAINS}\n\n` +
        "A citation is not visibility: an answer can cite the brand's own page without naming the " +
        "brand, and it can name the brand while citing nobody. Read this beside list_prompts, not " +
        "instead of it.\n\n" +
        "The ranking answers with the most cited pages rather than a list to walk to the end of, so " +
        "raise `limit` to see further down. `model` narrows it to one assistant.",
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
      outputSchema: {
        data: z.array(CitedPageSchema),
        nextCursor: z.string().nullable(),
        projectName: z.string(),
        brand: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        model: z.string().nullable(),
      },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const page = await client.listSourcePages(project.id, { ...args, ...range });

        const lines = page.data.map(
          (citedPage) =>
            `- ${citedPage.url}${citedPage.ownDomain ? " ← own domain" : ""} — ${citedPage.citations} citation(s), ` +
            `${num(citedPage.share, "%")} share`
        );

        return ok(
          (page.data.length === 0
            ? `No pages were cited between ${range.startDate} and ${range.endDate}.`
            : `Pages cited on ${project.brand}'s prompts, ${range.startDate} to ${range.endDate}:\n${lines.join("\n")}`) +
            morePages(page.nextCursor),
          {
            ...page,
            projectName: project.name,
            brand: project.brand,
            ...range,
            model: args.model ?? null,
          }
        );
      })
  );
}

/**
 * The answers themselves and what the brand was to them. Both still come from
 * sample data, so they are registered only when `SAMPLE_TOOLS` is on.
 */
export function registerEvidenceTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "list_answers",
    {
      title: "Read the answers behind the numbers",
      description:
        "The answers the assistants actually gave on the active project's prompts, each with whether " +
        "the brand was named, in which position, and which sources the answer cited. Call this when " +
        "a visibility figure needs explaining rather than restating.",
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        ...modelFilterShape,
        ...paginationShape,
        promptId: z.string().optional().describe("Only answers to this prompt."),
        brand: z
          .enum(["named", "missing"])
          .optional()
          .describe("Only answers that named the brand, or only those that did not."),
        search: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe("Only answers whose text contains this phrase."),
      },
      outputSchema: { data: z.array(AnswerSchema), nextCursor: z.string().nullable() },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const page = await client.listAnswers(project.id, { ...args, ...range });

        const lines = page.data.map((answer) => {
          const cited = answer.sources.map((source) => source.domain).join(", ") || "no sources";
          return (
            `${answer.date} ${answer.model} on "${answer.prompt}" — brand ${answer.brand}` +
            (answer.position === null ? "" : ` at position ${answer.position}`) +
            `\n  ${answer.text}\n  Cited: ${cited}`
          );
        });

        return ok(
          sampleData(
            (page.data.length === 0
              ? `No answers recorded for ${project.brand} between ${range.startDate} and ${range.endDate}.`
              : `${page.data.length} answer(s):\n${lines.join("\n")}`) + morePages(page.nextCursor)
          ),
          page
        );
      })
  );

  server.registerTool(
    "get_citation_quality",
    {
      title: "Read how the brand is cited",
      description:
        "What the brand is to the answers that mention it — recommended, compared, cited as an expert, " +
        "or merely mentioned in passing — and with what sentiment. Visibility says how often the brand " +
        "appears; this says what appearing is worth.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: CitationQualitySchema.shape,
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const quality = await client.getCitationQuality(project.id);

        const render = (distribution: { key: string; count: number; percentage: number }[]): string[] =>
          distribution.map((entry) => `  ${entry.key}: ${entry.count} (${num(entry.percentage, "%")})`);

        return ok(
          sampleData(
            [
              `How ${project.brand} is cited (analysed ${quality.analysedOn}):`,
              `${quality.role.mentionedResponses} mention(s) across ${quality.role.totalResponses} analysed response(s).`,
              "Role:",
              ...render(quality.role.distribution),
              "Sentiment:",
              ...render(quality.sentiment.distribution),
            ].join("\n")
          ),
          quality
        );
      })
  );
}
