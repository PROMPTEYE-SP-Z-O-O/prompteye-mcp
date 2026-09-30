import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ContentBriefSchema } from "../schemas/prompteye.js";
import type { ContentBrief, ContentBriefOutlineItem, ContentBriefSeparateArticle } from "../schemas/prompteye.js";
import { CONTENT_APP_URL, CONTENT_GENERATION } from "./glossary.js";
import { READ_ONLY, WRITES, handled, ok, type ToolContext } from "./result.js";

const OUTLINE_INDENT: Record<string, string> = { H2: "  ", H3: "    " };

const PENDING_BRIEF: Record<string, (brief: ContentBrief) => string> = {
  processing: () =>
    "Still being written: the fan-out and the outline take a little while. Call get_content_brief again " +
    "in a moment rather than promising the outline straight away.",
  error: (brief) =>
    `Generation failed: ${brief.error ?? "no reason given"}. Order a new one with create_content_brief, ` +
    "or rephrase the prompt first if it is not a question someone would put to an assistant.",
};

const WRITE_IN_APP =
  `Next: the article is written from this brief in the PromptEye app, under Content (${CONTENT_APP_URL}), ` +
  "where the brief is saved in the library. Once it is published on the site, its URL is saved there " +
  "so indexing and citations are followed, and the linked prompt's visibility in list_prompts and " +
  "get_prompt is how its impact is measured.";

function outlineLines(item: ContentBriefOutlineItem): string[] {
  const indent = OUTLINE_INDENT[item.level] ?? "  ";

  return [
    `${indent}${item.level} ${item.text}${item.includesBrand ? " (names the brand)" : ""}` +
      `${item.annotation ? ` — ${item.annotation}` : ""}`,
    ...(item.faqQuestions ?? []).map((question) => `${indent}  FAQ: ${question}`),
  ];
}

const separateArticleLine = (article: ContentBriefSeparateArticle): string =>
  `  - ${article.articleTitle ?? article.keyword} — phrase "${article.keyword}", ` +
  `priority ${article.priority}, ${article.reason}`;

function readyBriefLines(brief: ContentBrief): string[] {
  const phrases = brief.phrasesForArticle ?? [];
  const separateArticles = [...(brief.separateArticles ?? [])].sort((a, b) => a.priority - b.priority);
  const lines = [`Title: ${brief.title ?? "—"}`];

  if (brief.originalTitle) {
    lines.push(
      `Original title: ${brief.originalTitle}` +
        `${brief.titleChangeAnnotation ? ` — changed because ${brief.titleChangeAnnotation}` : ""}`
    );
  }

  lines.push(
    `Phrases for this article: ${phrases.length} of ${(brief.fanoutVariants ?? []).length} found by the fan-out` +
      `${brief.fanoutSource ? ` (${brief.fanoutSource})` : ""}` +
      `${phrases.length > 0 ? `: ${phrases.map((phrase) => phrase.keyword).join(", ")}` : ""}.`
  );

  if (brief.fanoutError) {
    lines.push(`The fan-out partly failed (${brief.fanoutError}); the brief was built from what it had.`);
  }
  if (brief.sourceTextMatchPercentage !== null) {
    lines.push(`The existing article already covered ${brief.sourceTextMatchPercentage}% of the fan-out phrases.`);
  }

  lines.push("Outline:", ...(brief.outline ?? []).flatMap(outlineLines));

  if (separateArticles.length > 0) {
    lines.push(
      "Deserve an article of their own (priority 1 highest; each can get its own brief with create_content_brief):",
      ...separateArticles.map(separateArticleLine)
    );
  }

  return lines;
}

function renderBrief(brief: ContentBrief): string {
  const header =
    `Content brief for "${brief.prompt}" — ${brief.status} [id: ${brief.id}]` +
    `${brief.trackerId ? `, linked to tracked prompt ${brief.trackerId}` : ", not linked to a tracked prompt"}.`;
  const pending = PENDING_BRIEF[brief.status];

  if (pending) return [header, pending(brief)].join("\n");
  return [header, ...readyBriefLines(brief), "", WRITE_IN_APP].join("\n");
}

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

        return ok(
          [
            `Content brief ordered for "${brief.prompt}" in ${project.name}; it is ${brief.status}.`,
            `Brief id: ${brief.id}`,
            "Read the title and outline with get_content_brief once it is ready — it usually takes " +
              "several seconds to a minute.",
            WRITE_IN_APP,
          ].join("\n"),
          brief
        );
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
        return ok(renderBrief(brief), brief);
      })
  );
}
