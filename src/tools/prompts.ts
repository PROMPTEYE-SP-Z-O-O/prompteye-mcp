import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { widgetMeta, widgetUri } from "../widgets.js";
import { dateRangeShape, paginationShape, resolveDateRange } from "../schemas/common.js";
import {
  AcceptedPromptSuggestionSchema,
  CategorySchema,
  NewPromptSchema,
  PromptDetailSchema,
  PromptGroupSchema,
  PromptGroupSettingsSchema,
  PromptSchema,
  PromptSettingsSchema,
  PromptSuggestionSchema,
  SuggestionRunSchema,
  SuggestionRunAvailabilitySchema,
  type Category,
  type PromptSuggestion,
  type SuggestionRunAvailability,
  type SuggestionRunAvailabilityReason,
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

const SUGGESTION_AVAILABILITY_REASON_MEANING: Record<SuggestionRunAvailabilityReason, string> = {
  not_eligible: "this project's plan does not currently pay for background work.",
  no_slots: "no free prompt slots remain on the plan.",
  running: "a run is already in progress for this group.",
  cooldown: "the last run finished less than 7 days ago and its proposals are still awaiting a decision.",
  nothing_to_suggest: "the group is already healthy: no funnel gap to fill and nothing worth imitating.",
  ready: "nothing is blocking a new run.",
};

const describeSuggestionAvailability = (availability: SuggestionRunAvailability): string =>
  `${availability.canRun ? "can" : "cannot"} generate new suggestions right now ` +
  `(${availability.reason} — ${SUGGESTION_AVAILABILITY_REASON_MEANING[availability.reason]}). ` +
  `${availability.pendingSuggestionCount} pending suggestion(s), ${availability.availableSlots} free slot(s).` +
  (availability.lastRun
    ? ` Last run ${availability.lastRun.status}, started ${availability.lastRun.startedAt}` +
      (availability.lastRun.finishedAt ? `, finished ${availability.lastRun.finishedAt}.` : ", still running.")
    : " No run has ever started for this group.");

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
        "Changes are signed so that positive always means improvement. For average position that means the brand was named earlier in the answer, so a positive change goes with a lower position number.\n\n" +
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
        "Changes are signed so that positive always means improvement. For average position that means the brand was named earlier in the answer, so a positive change goes with a lower position number.\n\n" +
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
            `AI traffic: ${num(prompt.aiTraffic)}. Business priority: ${prompt.businessPriority ?? "—"}` +
              `${prompt.businessPriorityReason ? ` — set by hand: ${prompt.businessPriorityReason}` : ""}.`,
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
        "Changes are signed so that positive always means improvement. For average position that means the brand was named earlier in the answer, so a positive change goes with a lower position number.\n\n" +
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
    "create_prompt_group",
    {
      title: "Create a prompt group",
      description:
        "Adds a group the active project's prompts can be filed under. It starts out empty — file a " +
        "prompt into it with update_prompt.\n\n" +
        "There is no delete for a prompt group anywhere in this API; renaming or reordering one later " +
        "is update_prompt_group.",
      annotations: WRITES,
      inputSchema: {
        name: z.string().min(1).max(200).describe("Name for the group."),
        order: z
          .number()
          .int()
          .optional()
          .describe("Where the group should sit in the project's own ordering."),
      },
      outputSchema: PromptGroupSettingsSchema.shape,
    },
    async ({ name, order }) =>
      handled(async () => {
        const project = await session.require();
        const group = await client.createPromptGroup(project.id, { name, order });

        return ok(`Created prompt group "${group.name}" in ${project.name} [id: ${group.id}]`, group);
      })
  );

  server.registerTool(
    "update_prompt_group",
    {
      title: "Rename or reorder a prompt group",
      description:
        "Only the fields sent are changed; prompts already filed under the group keep their history.\n\n" +
        "There is no delete for a prompt group anywhere in this API.",
      annotations: WRITES,
      inputSchema: {
        groupId: z.string().min(1).describe("Id of the group to update, as list_prompt_groups reports it."),
        name: z.string().min(1).max(200).optional().describe("New name for the group."),
        order: z
          .number()
          .int()
          .optional()
          .describe("Where the group should sit in the project's own ordering."),
      },
      outputSchema: PromptGroupSettingsSchema.shape,
    },
    async ({ groupId, ...fields }) =>
      handled(async () => {
        const project = await session.require();
        const group = await client.updatePromptGroup(project.id, groupId, fields);

        return ok(`Updated prompt group "${group.name}" [id: ${group.id}]`, group);
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
    "create_category",
    {
      title: "Create a category",
      description:
        "Adds a category the active project can file prompts under. Give an existing top-level " +
        "category's id as parentCategoryId to file this one under it as a subcategory instead of " +
        "top-level — only one level of nesting is supported. File an existing prompt under the new " +
        "category with update_prompt.\n\n" +
        "Every category made here is recorded as written by hand, never as one PromptEye proposed.",
      annotations: WRITES,
      inputSchema: {
        name: z.string().min(1).max(200).describe("Name for the category."),
        parentCategoryId: z
          .string()
          .min(1)
          .optional()
          .describe(
            "An existing top-level category to file this one under, which makes it a subcategory. " +
              "Omit to create a top-level category."
          ),
      },
      outputSchema: CategorySchema.shape,
    },
    async ({ name, parentCategoryId }) =>
      handled(async () => {
        const project = await session.require();
        const category = await client.createCategory(project.id, { name, parentCategoryId });

        return ok(`Created category "${category.name}" in ${project.name} [id: ${category.id}]`, category);
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
        "Accept a suggestion with accept_prompt_suggestion. When a group's list is thin, generate more " +
        "with generate_group_suggestions rather than writing prompts by hand.",
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
    "accept_prompt_suggestion",
    {
      title: "Accept a suggested prompt",
      description:
        "Turns a suggestion from list_prompt_suggestions into a tracked prompt — the recommended way " +
        "to add a prompt. promptText edits the wording before it starts being asked; omit it to accept " +
        "the suggestion exactly as written.\n\n" +
        "The suggestion leaves the pending list either way it is decided, and one already decided or " +
        "expired is refused rather than accepted twice — re-read list_prompt_suggestions if that " +
        "happens. The new prompt carries no demand, priority or figures yet; those arrive after the " +
        "next run, the same as add_prompts. It counts against the workspace plan the same as any " +
        "tracked prompt.",
      annotations: WRITES,
      inputSchema: {
        suggestionId: z.string().min(1).describe("Id of the suggestion, as list_prompt_suggestions reports it."),
        promptText: z
          .string()
          .min(1)
          .optional()
          .describe("Wording to track instead of the suggestion as written. Omit to accept it verbatim."),
      },
      outputSchema: AcceptedPromptSuggestionSchema.shape,
    },
    async ({ suggestionId, promptText }) =>
      handled(async () => {
        const project = await session.require();
        const accepted = await client.acceptPromptSuggestion(project.id, suggestionId, { promptText });

        return ok(
          accepted.trackerId === null
            ? `Suggestion ${suggestionId} was accepted in ${project.name}.`
            : `Suggestion ${suggestionId} was accepted in ${project.name} as prompt ${accepted.trackerId}.`,
          accepted
        );
      })
  );

  server.registerTool(
    "generate_group_suggestions",
    {
      title: "Generate new suggestions for a prompt group",
      description:
        "Asks PromptEye to propose new prompts for one prompt group of the active project — the same " +
        "cycle the app runs when the 'Generate' button is pressed on a group: it reads what the group " +
        "is missing, drafts candidate phrases, checks their demand, expands them into questions, and " +
        "scores each one. list_prompt_suggestions is then the tool to poll for what it produced.\n\n" +
        "Starting a run is instant; the cycle itself runs in the background for a minute or more and " +
        "is not waited on here.\n\n" +
        "A run is not always worth starting — the group might already be healthy, the plan's paid work " +
        "might not currently cover it, or the last run might still have proposals awaiting a decision. " +
        "In those cases nothing is scheduled and runId comes back null with skipped explaining why; " +
        "that is not a failure. A run already in progress, or no free plan slots left, fails the call " +
        "instead. Call get_prompt_suggestion_availability first to know whether — and why — one can run " +
        "rather than guessing from a failed call.",
      annotations: WRITES,
      inputSchema: {
        groupId: z.string().min(1).describe("Id of the group, as list_prompt_groups reports it."),
      },
      outputSchema: SuggestionRunSchema.shape,
    },
    async ({ groupId }) =>
      handled(async () => {
        const project = await session.require();
        const run = await client.generateGroupSuggestions(project.id, groupId);

        return ok(
          run.runId === null
            ? `No run was scheduled for group ${groupId} in ${project.name} (${run.skipped}).`
            : `Run ${run.runId} scheduled for group ${groupId} in ${project.name} — poll ` +
              "list_prompt_suggestions in a minute or so for what it produced.",
          run
        );
      })
  );

  server.registerTool(
    "get_prompt_suggestion_availability",
    {
      title: "Check whether a prompt group can be generated for",
      description:
        "Whether generate_group_suggestions would schedule a new run for one prompt group of the " +
        "active project right now, and if not, why — the same check that tool runs itself, without " +
        "scheduling anything:\n" +
        Object.entries(SUGGESTION_AVAILABILITY_REASON_MEANING)
          .map(([reason, meaning]) => `- \`${reason}\` — ${meaning}`)
          .join("\n") +
        "\n\nCall this before generate_group_suggestions to explain a wait rather than guessing from a " +
        "failed call.",
      annotations: READ_ONLY,
      inputSchema: {
        groupId: z.string().min(1).describe("Id of the group, as list_prompt_groups reports it."),
      },
      outputSchema: SuggestionRunAvailabilitySchema.shape,
    },
    async ({ groupId }) =>
      handled(async () => {
        const project = await session.require();
        const availability = await client.getPromptSuggestionAvailability(project.id, groupId);

        return ok(`${project.name}, group ${groupId}: ${describeSuggestionAvailability(availability)}`, availability);
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

  server.registerTool(
    "update_prompt",
    {
      title: "Pause, resume, file or re-prioritise a prompt",
      description:
        "Changes what happens to one prompt from here on in the active project: whether it is asked " +
        "(status 'active' or 'paused'), which group and categories it is filed under, and how much " +
        "the project bets on it.\n\n" +
        "Note:\n" +
        "- Pausing a prompt frees capacity against the plan limit; resuming consumes capacity.\n" +
        "- The prompt text itself cannot be changed: a different question is a different measurement " +
        "(add a new prompt and pause the old one instead).\n" +
        "- Moving a prompt between groups or categories keeps its history intact.\n" +
        "- Setting businessPriority overrides the computed priority; passing null hands it back to PromptEye's computation.",
      annotations: WRITES,
      inputSchema: {
        promptId: z.string().min(1).describe("Id of the prompt to update, as list_prompts reports it."),
        status: z
          .enum(["active", "paused"])
          .optional()
          .describe("Whether the prompt is asked on the next run ('active' or 'paused')."),
        groupId: z
          .string()
          .min(1)
          .nullable()
          .optional()
          .describe("Group id to move the prompt into, or null to leave it ungrouped."),
        categoryId: z
          .string()
          .min(1)
          .nullable()
          .optional()
          .describe("Category id to file the prompt under, as listed by list_categories. Null clears all categories."),
        subcategoryId: z
          .string()
          .min(1)
          .optional()
          .describe("Subcategory id of categoryId, which must be sent together with categoryId."),
        businessPriority: z
          .enum(["very_high", "high", "medium", "low", "very_low"])
          .nullable()
          .optional()
          .describe("Sets priority manually ('very_high', 'high', 'medium', 'low', 'very_low'), or null to reset to computed."),
        businessPriorityReason: z
          .string()
          .max(500)
          .optional()
          .describe("Reason why that priority was set manually."),
      },
      outputSchema: PromptSettingsSchema.shape,
    },
    async ({ promptId, ...fields }) =>
      handled(async () => {
        const project = await session.require();
        const updated = await client.updatePrompt(project.id, promptId, fields);

        return ok(
          `Updated prompt "${updated.prompt}" [id: ${updated.id}]:\n` +
            `- Status: ${updated.status}\n` +
            `- Group: ${updated.groupId ?? "ungrouped"}\n` +
            `- Categories: ${updated.categories.join(", ") || "none"}\n` +
            `- Priority: ${updated.businessPriority ?? "computed"}` +
            (updated.businessPriorityReason ? ` (${updated.businessPriorityReason})` : ""),
          updated
        );
      })
  );
}
