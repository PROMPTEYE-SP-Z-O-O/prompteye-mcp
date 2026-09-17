import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { widgetMeta, widgetUri } from "../widgets.js";
import { dateRangeShape, paginationShape, resolveDateRange } from "../schemas/common.js";
import {
  CategorySchema,
  NewPromptSchema,
  PromptDetailSchema,
  PromptGroupSchema,
  PromptSchema,
  PromptSuggestionSchema,
  type Category,
  type PromptSuggestion,
} from "../schemas/prompteye.js";
import {
  AI_TRAFFIC,
  BUSINESS_PRIORITY,
  COMPANY_FIT,
  PROMPT_GENERATION,
  PURCHASE_INTENT,
  RELATIVE_VOLUME,
  VISIBILITY,
} from "./glossary.js";
import { READ_ONLY, WRITES, handled, morePages, num, ok, signed, type ToolContext } from "./result.js";

const PURCHASE_INTENT_STAGE: Record<number, string> = {
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
  const stage = PURCHASE_INTENT_STAGE[suggestion.purchaseIntentLevel] ?? "unknown stage";

  return [
    `- "${suggestion.prompt}" (${suggestion.mode}) [id: ${suggestion.id}]`,
    `  ${suggestion.whyText}`,
    `  Group: ${suggestion.groupName ?? "—"} [id: ${suggestion.groupId}]. ` +
      `Source phrase: "${suggestion.sourcePhrase}", demand ${num(suggestion.sourcePhraseVolume)}/month.`,
    `  AI traffic: ${num(suggestion.aiTraffic)}. Demand in group: ${suggestion.relativeVolumeLabel} ` +
      `(${suggestion.relativeVolumeScore}). Purchase intent: ${suggestion.purchaseIntentLevel} (${stage}).`,
    `  Fit: ${suggestion.companyFitScore} — ${suggestion.companyFitReason}`,
    `  Expires ${suggestion.expiresAt}.`,
  ].join("\n");
}

export const PROMPTS_WIDGET = "prompts";

export function registerPromptTools(server: McpServer, { client, session }: ToolContext): void {
  registerAppTool(
    server,
    "list_prompts",
    {
      title: "List the prompts of the project",
      description:
        "The questions the active project puts to the assistants, with the visibility each one earns " +
        "over the period and how it moved against the period before. Every measurement PromptEye " +
        "reports is taken on the answers to these prompts, so this is where to look for which " +
        "questions carry the brand and which do not. Paused prompts are listed too, newest first.\n\n" +
        `${VISIBILITY}\n\n${AI_TRAFFIC}\n\n${BUSINESS_PRIORITY}`,
      annotations: READ_ONLY,
      inputSchema: {
        ...dateRangeShape,
        ...paginationShape,
        groupId: z.string().optional().describe("Only prompts in this prompt group."),
        categoryId: z
          .string()
          .optional()
          .describe("Only prompts filed under this category or one of its subcategories."),
      },
      outputSchema: {
        data: z.array(PromptSchema),
        nextCursor: z.string().nullable(),
        projectName: z.string(),
        brand: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      },
      _meta: widgetMeta(widgetUri(PROMPTS_WIDGET), "Reading the prompts…", "Read the prompts"),
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const page = await client.listPrompts(project.id, { ...args, ...range });

        const lines = page.data.map(
          (prompt) =>
            `- "${prompt.prompt}" (${prompt.status}) — visibility ${num(prompt.metrics.visibility, "%")} ` +
            `(${signed(prompt.change?.visibility ?? null, " pp")}), position ${num(prompt.metrics.averagePosition)}, ` +
            `priority ${prompt.businessPriority ?? "—"} [id: ${prompt.id}]`
        );

        return ok(
          (page.data.length === 0
            ? `${project.name} tracks no prompts matching that.`
            : `${page.data.length} prompt(s) in ${project.name}, ${range.startDate} to ${range.endDate}:\n` +
              lines.join("\n")) + morePages(page.nextCursor),
          { ...page, projectName: project.name, brand: project.brand, ...range }
        );
      })
  );

  server.registerTool(
    "get_prompt",
    {
      title: "Read one prompt",
      description:
        "One prompt of the active project, with its visibility broken down per assistant — only the " +
        "assistants that actually answered are listed. Call this to see which assistant is carrying a " +
        "prompt and which is dropping the brand from it.\n\n" +
        `${VISIBILITY}\n\n${AI_TRAFFIC}\n\n${BUSINESS_PRIORITY}`,
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
          [
            `"${prompt.prompt}" (${prompt.status})`,
            `Keyword: ${prompt.keyword || "—"}. Categories: ${prompt.categories.join(", ") || "—"}.`,
            `Visibility ${num(prompt.metrics.visibility, "%")} (${signed(prompt.change?.visibility ?? null, " pp")}), ` +
              `reach index ${num(prompt.metrics.reachIndex)}, position ${num(prompt.metrics.averagePosition)}.`,
            `AI traffic: ${num(prompt.aiTraffic)}. Business priority: ${prompt.businessPriority ?? "—"}.`,
            "By assistant:",
            ...perModel,
          ].join("\n"),
          prompt
        );
      })
  );

  server.registerTool(
    "list_prompt_groups",
    {
      title: "List the prompt groups of the project",
      description:
        "How the active project's prompts are grouped — comparison queries, problem queries, brand " +
        "queries — with the visibility of each group over the period. A group is the unit a strategy " +
        "is judged by. Use a group id to narrow list_prompts. Ungrouped prompts have no row here; " +
        "they show up in list_prompts with groupId null.\n\n" +
        "aiTrafficTotal adds up the demand behind the prompts of the group that are still being asked, " +
        "so a paused prompt contributes nothing.",
      annotations: READ_ONLY,
      inputSchema: { ...dateRangeShape, ...paginationShape },
      outputSchema: { data: z.array(PromptGroupSchema), nextCursor: z.string().nullable() },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const range = resolveDateRange(args);
        const page = await client.listPromptGroups(project.id, { ...args, ...range });

        const lines = page.data.map(
          (group) =>
            `- ${group.name} — ${group.promptCount} prompt(s), visibility ${num(group.metrics.visibility, "%")}, ` +
            `position ${num(group.metrics.averagePosition)}, AI traffic ${num(group.aiTrafficTotal)} [id: ${group.id}]`
        );

        return ok(
          (page.data.length === 0
            ? `${project.name} has no prompt groups.`
            : `${page.data.length} prompt group(s), ${range.startDate} to ${range.endDate}:\n${lines.join("\n")}`) +
            morePages(page.nextCursor),
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
        "The prompts PromptEye proposes the active project start tracking, still awaiting a decision. " +
        "**This is the recommended way to add prompts** — each suggestion is generated from real " +
        "demand and carries why it was proposed: a gap in the funnel, or a theme close to prompts that " +
        "already perform. Grouped by the prompt group each would join, strongest demand first. Call " +
        "this when asked what to monitor next, and before ever writing prompts by hand.\n\n" +
        `${AI_TRAFFIC}\n\n${RELATIVE_VOLUME}\n\n${PURCHASE_INTENT}\n\n${COMPANY_FIT}\n\n` +
        "Accepting a suggestion is done in the PromptEye app; this tool only reads them.",
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

  server.registerTool(
    "add_prompts",
    {
      title: "Add prompts by hand (not the recommended way)",
      description:
        "Tracks prompts written by hand in the active project, in one call.\n\n" +
        "**This is not the recommended way to add prompts, and it should not be the first thing you " +
        "reach for.** " +
        PROMPT_GENERATION +
        " Call list_prompt_suggestions and work from what it returns.\n\n" +
        "A prompt added here skips all of that. It is not weighed against what the project already " +
        "tracks, so it can duplicate an existing prompt; it carries no demand, priority, purchase " +
        "intent or fit until PromptEye computes them; and a question phrased the way a person writes " +
        "rather than the way people actually ask assistants will quietly measure nothing — it will sit " +
        "in the project at 0% visibility and look like a brand problem when it is a prompt problem. " +
        "Every prompt also counts against the workspace plan.\n\n" +
        "Groups are handled by name: a groupName that does not exist yet is created, and one that " +
        "does is reused, so there is no separate group-creation step.\n\n" +
        "Use it only when the user has prompts of their own that must be tracked verbatim — migrating " +
        "from another tool, or a list a client insists on — and has said as much. If the user simply " +
        "wants more prompts, or better coverage, use list_prompt_suggestions instead. When unsure, " +
        "ask the user before calling this; do not decide on their behalf.",
      annotations: WRITES,
      inputSchema: {
        prompts: z
          .array(
            z.object({
              prompt: z
                .string()
                .min(1)
                .max(500)
                .describe(
                  "The question to put to the assistants, verbatim and in the market's own language. " +
                    "Write it the way someone would actually ask an assistant, not as a keyword."
                ),
              groupName: z
                .string()
                .min(1)
                .optional()
                .describe(
                  "Name of the group the prompt joins. The group is created when it does not exist " +
                    "yet and reused when it does — there is no separate group-creation step — so " +
                    "match the spelling reported by list_prompt_groups to land in an existing group. " +
                    "Left out, the prompt is ungrouped and appears in no group's figures."
                ),
            })
          )
          .min(1)
          .max(200)
          .describe(
            "The prompts to track, at most 200. Send them in one call rather than one call per prompt."
          ),
        confirmBypassPromptIntelligence: z
          .literal(true)
          .describe(
            "Must be true, and only set it once the user has knowingly chosen hand-written prompts " +
              "over the ones PromptEye would generate. It is an acknowledgement that this call skips " +
              "the demand, duplicate and fit checks behind list_prompt_suggestions."
          ),
      },
      outputSchema: { data: z.array(NewPromptSchema) },
    },
    async ({ prompts }) =>
      handled(async () => {
        const project = await session.require();
        const list = await client.addPrompts(project.id, prompts);

        const lines = list.data.map(
          (prompt) =>
            `- "${prompt.prompt}"${prompt.groupName ? ` → group ${prompt.groupName}` : " (ungrouped)"} ` +
            `[id: ${prompt.id}]`
        );

        return ok(
          `Added ${list.data.length} prompt(s) to ${project.name}:\n${lines.join("\n")}\n\n` +
            "They carry no demand, priority or fit yet — PromptEye computes those, and the first " +
            "figures arrive after the next run. Check list_prompt_suggestions for the prompts it " +
            "would have proposed instead.",
          list
        );
      })
  );
}
