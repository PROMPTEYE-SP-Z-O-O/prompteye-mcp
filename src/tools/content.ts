import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveDateRange } from "../schemas/common.js";
import { ContentBriefSchema, type ContentBrief } from "../schemas/prompteye.js";
import { whatNext } from "./journey.js";
import { READ_ONLY, WRITES, fail, handled, ok, type ToolContext } from "./result.js";

/** The brief as the model relays it: the title, the outline, and what deserves its own article. */
function renderBrief(brief: ContentBrief): string {
  const head = `Brief for "${brief.prompt}" [id: ${brief.id}] — ${brief.status}.`;

  if (brief.status === "processing") {
    return `${head}\nStill being written — it takes a little while. Call get_content_brief with this id again shortly.`;
  }
  if (brief.status === "error") {
    return `${head}\nGeneration failed: ${brief.error ?? "no reason given"}. create_content_brief orders a new one.`;
  }

  const lines = [head, "", `Title: ${brief.title ?? "—"}`];

  if (brief.outline && brief.outline.length > 0) {
    lines.push("", "Outline:");
    for (const section of brief.outline) {
      const indent = section.level === "H3" ? "    " : "  ";
      lines.push(`${indent}${section.level} ${section.text}${section.includesBrand ? " (names the brand)" : ""}`);
      if (section.annotation) lines.push(`${indent}  ${section.annotation}`);
      for (const question of section.faqQuestions ?? []) lines.push(`${indent}  - ${question}`);
    }
  }

  if (brief.phrasesForArticle && brief.phrasesForArticle.length > 0) {
    lines.push("", `Phrases it covers: ${brief.phrasesForArticle.map((phrase) => phrase.keyword).join(", ")}`);
  }

  if (brief.separateArticles && brief.separateArticles.length > 0) {
    lines.push("", "Deserve an article of their own (1 most worthwhile):");
    for (const article of [...brief.separateArticles].sort((a, b) => a.priority - b.priority)) {
      lines.push(`  ${article.priority}. ${article.articleTitle ?? article.keyword} — ${article.reason}`);
    }
  }

  return lines.join("\n");
}

export function registerContentTools(server: McpServer, context: ToolContext): void {
  const { client, session } = context;

  server.registerTool(
    "create_content_brief",
    {
      title: "Outline an article for a prompt",
      description:
        "Orders a content brief for one question in the active project: a title and an H2/H3 outline " +
        "for an article written to be quoted when an assistant answers it. PromptEye fans the prompt out " +
        "into the phrases people actually ask around it, decides which belong in this article, builds the " +
        "structure from them and lists the phrases that deserve an article of their own.\n\n" +
        "This is the step after the prompts are in place: while the first run is pending, outline articles " +
        "for the prompts that matter most, and later for the prompts the brand is never named on.\n\n" +
        "Writing the brief takes a little while, so this answers `processing` with an id; read it with " +
        "get_content_brief. Every call orders a new brief — do not call it twice for the same prompt.",
      annotations: WRITES,
      inputSchema: {
        promptId: z
          .string()
          .min(1)
          .optional()
          .describe("A tracked prompt to write for, as list_prompts reports it. The brief is linked to it."),
        prompt: z
          .string()
          .min(1)
          .max(500)
          .optional()
          .describe("A question to write for that is not tracked, verbatim. Use promptId instead when it is tracked."),
      },
      outputSchema: ContentBriefSchema.shape,
    },
    async ({ promptId, prompt }) =>
      handled(async () => {
        if ((promptId === undefined) === (prompt === undefined)) {
          return fail("Pass exactly one of promptId (a tracked prompt) or prompt (a question that is not tracked).");
        }

        const project = await session.require();
        const text = promptId
          ? (await client.getPrompt(project.id, promptId, resolveDateRange({}))).prompt
          : (prompt as string);

        const brief = await client.createContentBrief({ projectId: project.id, prompt: text, trackerId: promptId });
        session.noteBrief(project.id);

        return ok(
          `Ordered a brief for "${brief.prompt}" [id: ${brief.id}] in ${project.name}. It is being written — ` +
            "read it with get_content_brief in a minute or two." +
            (await whatNext(context, project)),
          brief
        );
      })
  );

  server.registerTool(
    "get_content_brief",
    {
      title: "Read an article outline",
      description:
        "One content brief ordered with create_content_brief: its status, and once `ready` the article " +
        "title, the H2/H3 outline with a note on what each section covers, the one section required to " +
        "name the brand, and the phrases that deserve an article of their own. While `processing`, call " +
        "it again a little later.",
      annotations: READ_ONLY,
      inputSchema: {
        briefId: z.string().min(1).describe("Id of the brief, as create_content_brief returned it."),
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
