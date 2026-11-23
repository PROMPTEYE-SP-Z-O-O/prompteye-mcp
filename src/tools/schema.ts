import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArticleSchemaMarkupSchema } from "../schemas/prompteye.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

const faqPairShape = z.object({
  question: z.string().min(1).describe("The question exactly as it reads on the published page, in plain text."),
  answer: z
    .string()
    .min(1)
    .describe("The answer exactly as it reads on the published page, in plain text without Markdown."),
});

const authorShape = z.object({
  name: z.string().min(1).describe("The person who wrote the article."),
  url: z.string().optional().describe("An http(s) page about the author, such as a team or profile page."),
});

export function registerSchemaTools(server: McpServer, { client }: ToolContext): void {
  server.registerTool(
    "generate_article_schema",
    {
      title: "Build schema markup for an article",
      description:
        "schema.org JSON-LD structured data (not a JSON Schema) for a PromptEye article: a FAQPage and, " +
        "when it can be built, an Article. Call this when the user wants schema markup or structured data " +
        "for an article. Take the FAQ questions and answers from the article text get_article returns, as " +
        "plain text with the Markdown stripped, exactly as they read on the published page — never invent " +
        "them — and pass the real author; never invent one either. The Article is only built for a " +
        "published article with an author; otherwise `skipped` lists every reason that applies: " +
        "`not_published` — publish the article first, record its URL with record_published_article, then call this again; " +
        "`author_missing` — ask the user who wrote it. Nothing is stored. Tell the objects in `jsonLd` " +
        "apart by their `@type`, not their position, and place each in its own " +
        '<script type="application/ld+json"> tag on the page.\n\n' +
        "For a homepage or a whole project — Organization, SoftwareApplication, or Product with an Offer — " +
        "point the user to the Schema Generator module in the PromptEye app " +
        "(https://app.prompteye.com/help/schema-generator/).",
      annotations: READ_ONLY,
      inputSchema: {
        articleId: z
          .string()
          .min(1)
          .describe("Id of the article, as create_article or list_articles reports it."),
        faq: z
          .array(faqPairShape)
          .min(1)
          .describe("The questions and answers of the article's FAQ section, in page order. At least one."),
        author: authorShape
          .optional()
          .describe("The article's author. Left out, no Article is built."),
      },
      outputSchema: ArticleSchemaMarkupSchema.shape,
    },
    async ({ articleId, ...input }) =>
      handled(async () => {
        const markup = await client.generateArticleSchema(articleId, input);
        return ok(markup);
      })
  );
}
