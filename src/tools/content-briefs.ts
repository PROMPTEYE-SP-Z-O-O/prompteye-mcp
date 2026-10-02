import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ContentBriefSchema } from "../schemas/prompteye.js";
import type { ContentBrief } from "../schemas/prompteye.js";
import { READ_ONLY, WRITES, handled, num, ok, type ToolContext } from "./result.js";

const describe = (brief: ContentBrief): string => {
  const lines = [
    `Brief for "${brief.prompt}" — ${brief.status}` +
      `${brief.trackerId ? `, linked to prompt ${brief.trackerId}` : ""} [id: ${brief.id}]`,
  ];

  if (brief.status === "error") {
    lines.push(`Error: ${brief.error ?? "unknown"}`);
    return lines.join("\n");
  }

  if (brief.status === "processing") {
    lines.push("Still generating — call get_content_brief again in a moment.");
    return lines.join("\n");
  }

  lines.push(`Title: ${brief.title ?? "—"}`);
  if (brief.originalTitle) {
    lines.push(
      `Was: ${brief.originalTitle}${brief.titleChangeAnnotation ? ` (${brief.titleChangeAnnotation})` : ""}`
    );
  }
  lines.push(`Fan-out: ${brief.fanoutSource ?? "—"}${brief.fanoutError ? `, error: ${brief.fanoutError}` : ""}`);
  if (brief.sourceTextMatchPercentage !== null) {
    lines.push(
      `The existing article already covered ${num(brief.sourceTextMatchPercentage, "%")} of the fan-out phrases.`
    );
  }

  const outline = brief.outline ?? [];
  if (outline.length > 0) {
    lines.push(
      "Outline:",
      ...outline.map((item) => `  ${item.level} ${item.text}${item.includesBrand ? " (names the brand)" : ""}`)
    );
  }

  const separateArticles = brief.separateArticles ?? [];
  if (separateArticles.length > 0) {
    lines.push(
      "Deserves a separate article instead of a section here:",
      ...separateArticles.map(
        (article) => `  ${article.keyword} — ${article.articleTitle ?? "no title yet"} (priority ${article.priority})`
      )
    );
  }

  return lines.join("\n");
};

export function registerContentBriefTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "create_content_brief",
    {
      title: "Request a content brief for a prompt",
      description:
        "Requests a title and an H2/H3 outline for an article that targets a prompt: PromptEye fans " +
        "the prompt out into the phrases people actually ask around it, works out which belong in this " +
        "article, and writes the structure from them.\n\n" +
        "Requesting one is instant; writing the outline takes a little while, since it fans the prompt " +
        "out and asks a model to build the structure. The brief comes back `processing` and turns " +
        "`ready` once that finishes, or `error` if it fails — poll get_content_brief with the returned " +
        "id until it does.\n\n" +
        "Every call starts a fresh brief; asking twice for the same prompt orders two of them. There is " +
        "no dedup the way create_report reuses a report generated in the last 30 days — the app itself " +
        "may still show a cached one, this always starts a fresh generation.",
      annotations: WRITES,
      inputSchema: {
        prompt: z.string().min(1).describe("The target prompt to write the article for."),
        projectId: z
          .string()
          .min(1)
          .optional()
          .describe("Project to request the brief for. Defaults to the active project, and makes it active."),
        trackerId: z.string().min(1).optional().describe("Link the brief to an existing tracked prompt."),
      },
      outputSchema: ContentBriefSchema.shape,
    },
    async ({ prompt, projectId, trackerId }) =>
      handled(async () => {
        const project = projectId ? await session.select(projectId) : await session.require();
        const brief = await client.createContentBrief({ projectId: project.id, prompt, trackerId });

        return ok(
          `Brief for "${brief.prompt}" started on ${project.brand}; it is ${brief.status} — poll ` +
            `get_content_brief with id ${brief.id} until it turns ready or error.`,
          brief
        );
      })
  );

  server.registerTool(
    "get_content_brief",
    {
      title: "Read one content brief",
      description:
        "One content brief in full: its title, its H2/H3 outline, the fan-out phrases behind it and the " +
        "phrases that deserve a separate article instead.\n\n" +
        "Call this after create_content_brief to see whether it finished, and to read what it found. " +
        "Everything but status, projectId, trackerId and prompt is null until status is ready, and " +
        "error is set instead if generation failed.",
      annotations: READ_ONLY,
      inputSchema: {
        briefId: z.string().min(1).describe("Id of the brief, as create_content_brief reports it."),
      },
      outputSchema: ContentBriefSchema.shape,
    },
    async ({ briefId }) =>
      handled(async () => {
        const brief = await client.getContentBrief(briefId);
        return ok(describe(brief), brief);
      })
  );
}
