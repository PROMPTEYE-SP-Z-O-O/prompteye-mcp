import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { paginationShape } from "../schemas/common.js";
import {
  ContentArticleSchema,
  ContentArticleSummarySchema,
  ContentBriefSchema,
  NextCursorSchema,
} from "../schemas/prompteye.js";
import { CONTENT_GENERATION } from "./glossary.js";
import { READ_ONLY, WRITES, handled, ok, type ToolContext } from "./result.js";

export function registerContentTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "create_content_brief",
    {
      title: "Order a content brief for an article",
      description:
        "Starts content generation for the active project: orders a brief — a title and an H2/H3 " +
        "outline — for an article that targets one prompt. Call this when the user wants PromptEye to " +
        "generate content, write an article, or close a visibility gap on a prompt where the brand is " +
        "rarely or never named.\n\n" +
        CONTENT_GENERATION +
        "\n\nPass promptId when the article targets a prompt the project already tracks, so the brief " +
        "is linked to it and that prompt's visibility is what measures the article; a prompt that is not " +
        "tracked can still get a brief, but nothing will measure its impact. Every call orders a new " +
        "brief, so asking twice for the same prompt makes two. The brief comes back `processing`; read " +
        "it with get_content_brief a little later.",
      annotations: WRITES,
      inputSchema: {
        prompt: z
          .string()
          .min(1)
          .describe(
            "The question the article should answer, phrased the way someone would put it to an " +
              "assistant. For a tracked prompt, its text as list_prompts reports it."
          ),
        promptId: z
          .string()
          .min(1)
          .optional()
          .describe("Id of the tracked prompt the article targets, as list_prompts reports it."),
      },
      outputSchema: ContentBriefSchema.shape,
    },
    async ({ prompt, promptId }) =>
      handled(async () => {
        const project = await session.require();
        const brief = await client.createContentBrief({ projectId: project.id, prompt, trackerId: promptId });
        return ok(brief);
      })
  );

  server.registerTool(
    "get_content_brief",
    {
      title: "Read one content brief",
      description:
        "One content brief in full: the article's title, its H2/H3 outline with the notes and FAQ " +
        "questions for each section, the fan-out phrases it covers, and the phrases that deserve an " +
        "article of their own. Call this after create_content_brief until `status` is `ready` or " +
        "`error`; everything but the prompt is empty while it is `processing`.\n\n" +
        CONTENT_GENERATION,
      annotations: READ_ONLY,
      inputSchema: {
        briefId: z.string().min(1).describe("Id of the brief, as create_content_brief reports it."),
      },
      outputSchema: ContentBriefSchema.shape,
    },
    async ({ briefId }) =>
      handled(async () => {
        const brief = await client.getContentBrief(briefId);
        return ok(brief);
      })
  );

  server.registerTool(
    "create_article",
    {
      title: "Write the article for a content brief",
      description:
        "Has PromptEye write the article for a content brief: the brief's title and H2/H3 outline, filled " +
        "in with the project's brand description and knowledge base, in the language of the project's " +
        "market. Call this when the user wants the article itself written, once get_content_brief reports " +
        "the brief `ready`; a brief that is still `processing` or failed is refused.\n\n" +
        CONTENT_GENERATION +
        "\n\nRequesting it is instant; writing takes a few minutes. The article comes back `processing` " +
        "— read it with get_article until `status` is no longer `processing`. A brief has one article: " +
        "calling this again for a brief whose article is already written rewrites it and replaces the " +
        "previous text, and it is refused while the article is still being written. Each written article " +
        "counts against the plan's monthly article limit.",
      annotations: WRITES,
      inputSchema: {
        briefId: z
          .string()
          .min(1)
          .describe("Id of the brief to write the article for, as create_content_brief reports it."),
      },
      outputSchema: ContentArticleSchema.shape,
    },
    async ({ briefId }) =>
      handled(async () => {
        const article = await client.createContentArticle(briefId);
        return ok(article);
      })
  );

  server.registerTool(
    "get_article",
    {
      title: "Read one article",
      description:
        "One article with its full text in Markdown. Call this after create_article until `status` is no " +
        "longer `processing`: `draft` means the text is written and in `content`, `error` means " +
        "generation failed — `error` says why. `content` is empty while it is `processing`.\n\n" +
        CONTENT_GENERATION,
      annotations: READ_ONLY,
      inputSchema: {
        articleId: z
          .string()
          .min(1)
          .describe("Id of the article, as create_article or list_articles reports it."),
      },
      outputSchema: ContentArticleSchema.shape,
    },
    async ({ articleId }) =>
      handled(async () => {
        const article = await client.getContentArticle(articleId);
        return ok(article);
      })
  );

  server.registerTool(
    "list_articles",
    {
      title: "List the articles of the project",
      description:
        "Every article of the active project, newest first, without its text — read one with get_article. " +
        "Lists the articles PromptEye wrote from a brief and the texts the team added in the app. Briefs " +
        "whose article has not been requested yet are not listed; read those with get_content_brief.\n\n" +
        CONTENT_GENERATION,
      annotations: READ_ONLY,
      inputSchema: paginationShape,
      outputSchema: { data: z.array(ContentArticleSummarySchema), nextCursor: NextCursorSchema },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const page = await client.listContentArticles(project.id, args);
        return ok(page);
      })
  );
}
