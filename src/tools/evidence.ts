import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  MAX_LIMIT,
  dateRangeShape,
  modelFilterShape,
  paginationShape,
  resolveDateRange,
} from "../schemas/common.js";
import { AnswerSchema, CitationQualitySchema, CitedDomainSchema } from "../schemas/prompteye.js";
import { READ_ONLY, handled, morePages, num, ok, sampleData, type ToolContext } from "./result.js";

/**
 * The three tools that answer "why is the number what it is": the answers
 * themselves, the pages the assistants leaned on, and what the brand was to
 * those answers.
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
    "list_sources",
    {
      title: "List the domains assistants cite",
      description:
        "The domains the assistants leaned on when answering the active project's prompts, ranked by " +
        "how often they were cited. The project's own domain is marked. Call this to see which pages " +
        "shape what the assistants say about the brand.",
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
      outputSchema: { data: z.array(CitedDomainSchema), nextCursor: z.string().nullable() },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const page = await client.listSources(project.id, { ...args, ...range });

        const lines = page.data.map(
          (domain) =>
            `- ${domain.domain}${domain.ownDomain ? " ← own domain" : ""} — ${domain.citations} citation(s), ` +
            `${num(domain.share, "%")} share, last cited ${domain.lastCitedOn}`
        );

        return ok(
          sampleData(
            (page.data.length === 0
              ? `No domains were cited between ${range.startDate} and ${range.endDate}.`
              : `Domains cited on ${project.brand}'s prompts, ${range.startDate} to ${range.endDate}:\n${lines.join("\n")}`) +
              morePages(page.nextCursor)
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
