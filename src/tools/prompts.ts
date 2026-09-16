import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dateRangeShape, paginationShape, resolveDateRange } from "../schemas/common.js";
import {
  CategorySchema,
  PromptDetailSchema,
  PromptGroupSchema,
  PromptSchema,
  PromptSuggestionSchema,
  type Category,
  type PromptSuggestion,
} from "../schemas/prompteye.js";
import { READ_ONLY, handled, morePages, num, ok, sampleData, signed, type ToolContext } from "./result.js";

const PURCHASE_INTENT: Record<number, string> = {
  1: "educational",
  2: "solution-seeking",
  3: "comparison",
  4: "decision",
};

/**
 * Top-level categories, each followed by its subcategories. A subcategory whose
 * parent is not in the list is shown at the top level rather than dropped.
 */
function renderCategoryTree(categories: Category[]): string[] {
  const ids = new Set(categories.map((category) => category.id));
  const children = new Map<string, Category[]>();
  const roots: Category[] = [];

  for (const category of categories) {
    if (category.parentId !== null && ids.has(category.parentId)) {
      children.set(category.parentId, [...(children.get(category.parentId) ?? []), category]);
    } else {
      roots.push(category);
    }
  }

  const line = (category: Category, indent: string): string =>
    `${indent}- ${category.name} (added by ${category.source}) [id: ${category.id}]`;

  return roots.flatMap((root) => [
    line(root, ""),
    ...(children.get(root.id) ?? []).map((child) => line(child, "  ")),
  ]);
}

function renderSuggestion(suggestion: PromptSuggestion): string {
  const intent = PURCHASE_INTENT[suggestion.purchaseIntentLevel] ?? "unknown stage";

  return [
    `- "${suggestion.prompt}" (${suggestion.mode}) [id: ${suggestion.id}]`,
    `  ${suggestion.whyText}`,
    `  Group: ${suggestion.groupName ?? "—"} [id: ${suggestion.groupId}]. ` +
      `Source phrase: "${suggestion.sourcePhrase}", ${num(suggestion.sourcePhraseVolume)} searches/month.`,
    `  AI traffic: ${num(suggestion.aiTraffic)}. Demand in group: ${suggestion.relativeVolumeLabel} ` +
      `(${suggestion.relativeVolumeScore}). Purchase intent: ${suggestion.purchaseIntentLevel} (${intent}).`,
    `  Fit: ${suggestion.companyFitScore} — ${suggestion.companyFitReason}`,
    `  Expires ${suggestion.expiresAt}.`,
  ].join("\n");
}

export function registerPromptTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "list_prompts",
    {
      title: "List the prompts of the project",
      description:
        "The questions the active project puts to the assistants, with the visibility each one earns. " +
        "Every measurement PromptEye reports is taken on the answers to these prompts, so this is where " +
        "to look for which questions carry the brand and which do not.",
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        ...paginationShape,
        groupId: z.string().optional().describe("Only prompts in this prompt group."),
        categoryId: z.string().optional().describe("Only prompts filed under this category."),
      },
      outputSchema: { data: z.array(PromptSchema), nextCursor: z.string().nullable() },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const page = await client.listPrompts(project.id, { ...args, ...range });

        const lines = page.data.map(
          (prompt) =>
            `- "${prompt.prompt}" — visibility ${num(prompt.metrics.visibility, "%")} ` +
            `(${signed(prompt.change?.visibility ?? null, " pp")}), position ${num(prompt.metrics.averagePosition)} ` +
            `[id: ${prompt.id}]`
        );

        return ok(
          sampleData(
            (page.data.length === 0
              ? `${project.name} tracks no prompts matching that.`
              : `${page.data.length} prompt(s) in ${project.name}:\n${lines.join("\n")}`) +
              morePages(page.nextCursor)
          ),
          page
        );
      })
  );

  server.registerTool(
    "get_prompt",
    {
      title: "Read one prompt",
      description:
        "One prompt of the active project, with its visibility broken down per assistant. Call this to " +
        "see which assistant is carrying a prompt and which is dropping the brand from it.",
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        promptId: z.string().min(1).describe("Id of the prompt, as list_prompts reports it."),
      },
      outputSchema: PromptDetailSchema.shape,
    },
    async ({ promptId, ...range }) =>
      handled(async () => {
        const project = await session.require();
        const prompt = await client.getPrompt(project.id, promptId, resolveDateRange(range));

        const perModel = prompt.byModel.map(
          (entry) =>
            `  ${entry.model}: ${num(entry.metrics.visibility, "%")}, position ${num(entry.metrics.averagePosition)}`
        );

        return ok(
          sampleData(
            [
              `"${prompt.prompt}" (${prompt.status})`,
              `Keyword: ${prompt.keyword ?? "—"}. Categories: ${prompt.categories.join(", ") || "—"}.`,
              `Visibility ${num(prompt.metrics.visibility, "%")} (${signed(prompt.change?.visibility ?? null, " pp")}), ` +
                `reach index ${num(prompt.metrics.reachIndex)}, position ${num(prompt.metrics.averagePosition)}.`,
              `AI traffic: ${num(prompt.aiTraffic)}.`,
              "By assistant:",
              ...perModel,
            ].join("\n")
          ),
          prompt
        );
      })
  );

  server.registerTool(
    "list_prompt_groups",
    {
      title: "List the prompt groups of the project",
      description:
        "How the active project's prompts are grouped, with the visibility and business priority of " +
        "each group. Use a group id to narrow list_prompts.",
      annotations: READ_ONLY,
      inputSchema: { ...dateRangeShape, ...paginationShape },
      outputSchema: { data: z.array(PromptGroupSchema), nextCursor: z.string().nullable() },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const page = await client.listPromptGroups(project.id, { ...args, ...resolveDateRange(args) });

        const lines = page.data.map(
          (group) =>
            `- ${group.name} — ${group.promptCount} prompt(s), visibility ${num(group.metrics.visibility, "%")}, ` +
            `priority ${num(group.businessPriority)} [id: ${group.id}]`
        );

        return ok(
          sampleData(
            (page.data.length === 0
              ? `${project.name} has no prompt groups.`
              : `${page.data.length} prompt group(s):\n${lines.join("\n")}`) + morePages(page.nextCursor)
          ),
          page
        );
      })
  );

  server.registerTool(
    "list_categories",
    {
      title: "List the categories the project files prompts under",
      description:
        "Every category of the active project, two levels deep: top-level categories with their " +
        "subcategories beneath, and whether PromptEye proposed each one or it was written by hand.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: { data: z.array(CategorySchema) },
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const list = await client.listCategories(project.id);

        return ok(
          list.data.length === 0
            ? `${project.name} files prompts under no categories.`
            : `${list.data.length} ${list.data.length === 1 ? "category" : "categories"} in ${project.name}:\n` +
                renderCategoryTree(list.data).join("\n"),
          list
        );
      })
  );

  server.registerTool(
    "list_prompt_suggestions",
    {
      title: "List the prompts worth adding next",
      description:
        "Prompts PromptEye suggests the active project start tracking, still awaiting a decision. Each " +
        "carries why it was suggested — a gap in the funnel, or a theme close to prompts that already " +
        "perform — with the search demand behind it, how close to a purchase it is asked and how well it " +
        "fits the brand. Grouped by the prompt group each would join, strongest demand first. Call this " +
        "when asked what to monitor next.",
      annotations: READ_ONLY,
      inputSchema: {
        groupId: z
          .string()
          .min(1)
          .optional()
          .describe("Only suggestions for this prompt group, by the group id the suggestions carry."),
      },
      outputSchema: { data: z.array(PromptSuggestionSchema) },
    },
    async ({ groupId }) =>
      handled(async () => {
        const project = await session.require();
        const list = await client.listPromptSuggestions(project.id, { groupId });

        return ok(
          list.data.length === 0
            ? `PromptEye suggests nothing new for ${project.name} right now.`
            : `${list.data.length} suggestion(s) for ${project.name}:\n${list.data.map(renderSuggestion).join("\n")}`,
          list
        );
      })
  );
}
