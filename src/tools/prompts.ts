import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { widgetMeta, widgetUri } from "../widgets.js";
import { dateRangeShape, paginationShape } from "../schemas/common.js";
import {
  AcceptedPromptSuggestionSchema,
  CategorySchema,
  NewPromptSchema,
  NextCursorSchema,
  PromptDetailSchema,
  PromptGroupSchema,
  PromptGroupSettingsSchema,
  PromptSchema,
  PromptSettingsSchema,
  PromptSuggestionSchema,
  SuggestionRunAvailabilitySchema,
  SuggestionRunSchema,
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
import { DELETES, READ_ONLY, WRITES, fail, handled, ok, type ToolContext } from "./result.js";

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
        "A prompt the brand is rarely or never named on, especially one with a high business priority, " +
        "is the one to generate content for: create_content_brief with its text and id starts the " +
        "article, and this listing is where its impact shows up later.\n\n" +
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
        nextCursor: NextCursorSchema,
        projectName: z.string(),
        brand: z.string(),
      },
      _meta: widgetMeta(widgetUri(PROMPTS_WIDGET), "Reading the prompts…", "Read the prompts"),
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const page = await client.listPrompts(project.id, args);

        return ok({ ...page, projectName: project.name, brand: project.brand });
      })
  );

  server.registerTool(
    "get_prompt",
    {
      title: "Read one prompt",
      description:
        "One prompt of the active project, with its visibility broken down per assistant — only the " +
        "assistants that actually answered are listed. Call this to see which assistant is carrying a " +
        "prompt and which is dropping the brand from it. When the brand is weak here, " +
        "create_content_brief starts an article aimed at this prompt.\n\n" +
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
        const prompt = await client.getPrompt(project.id, promptId, range);
        return ok(prompt);
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
        "they show up in list_prompts with groupId null. upsert_prompt_group renames, describes or " +
        "reorders a group, and delete_prompt_group removes an empty one.\n\n" +
        "Changes are signed so that positive always means improvement. For average position that means the brand was named earlier in the answer, so a positive change goes with a lower position number.\n\n" +
        "aiTrafficTotal adds up the demand behind the prompts of the group that are still being asked, " +
        "so a paused prompt contributes nothing. It is null when none of those prompts has a measured figure.",
      annotations: READ_ONLY,
      inputSchema: { ...dateRangeShape, ...paginationShape },
      outputSchema: { data: z.array(PromptGroupSchema), nextCursor: NextCursorSchema },
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const page = await client.listPromptGroups(project.id, args);
        return ok(page);
      })
  );

  server.registerTool(
    "upsert_prompt_group",
    {
      title: "Create, rename, describe or reorder a prompt group",
      description:
        "Creates a prompt group in the active project or, given a groupId, changes the name, description " +
        "or order of an existing one. Only the fields sent are changed, and the prompts of a group keep " +
        "their history when it is renamed or moved.\n\n" +
        "Without groupId a new, empty group is created: name is required, and the group goes after the " +
        "existing ones unless order says otherwise. Prompts join a group through update_prompt (groupId) " +
        "or through a matching groupName in add_prompts.",
      annotations: WRITES,
      inputSchema: {
        groupId: z
          .string()
          .min(1)
          .optional()
          .describe("Id of the group to change, as list_prompt_groups reports it. Left out, a new group is created."),
        name: z
          .string()
          .min(1)
          .optional()
          .describe("Name of the group. Required when creating one."),
        description: z
          .string()
          .max(500)
          .nullable()
          .optional()
          .describe("What the group is for. Null clears it."),
        order: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Where the group sits in the project's ordering, lowest first."),
      },
      outputSchema: PromptGroupSettingsSchema.shape,
    },
    async ({ groupId, name, description, order }) =>
      handled(async () => {
        const project = await session.require();

        if (groupId !== undefined) {
          const updated = await client.updatePromptGroup(project.id, groupId, { name, description, order });
          return ok(updated);
        }

        if (name === undefined) {
          return fail(
            "A new prompt group needs a name. To change an existing group, pass its groupId from list_prompt_groups."
          );
        }

        const created = await client.createPromptGroup(project.id, {
          name,
          description: description ?? undefined,
          order,
        });
        return ok(created);
      })
  );

  server.registerTool(
    "delete_prompt_group",
    {
      title: "Delete an empty prompt group",
      description:
        "Deletes one prompt group of the active project, but only when it has no prompts — paused prompts " +
        "count too. A group that still has prompts is refused: move each of them with update_prompt " +
        "(groupId of another group, or null to leave it ungrouped) and then delete the group. Deleting " +
        "cannot be undone.",
      annotations: DELETES,
      inputSchema: {
        groupId: z.string().min(1).describe("Id of the group to delete, as list_prompt_groups reports it."),
      },
      outputSchema: { id: z.string() },
    },
    async ({ groupId }) =>
      handled(async () => {
        const project = await session.require();
        await client.deletePromptGroup(project.id, groupId);

        return ok({ id: groupId });
      })
  );

  server.registerTool(
    "list_categories",
    {
      title: "List the categories the project files prompts under",
      description:
        "Every category of the active project, two levels deep: a subcategory carries the id of its " +
        "top-level category in parentId, which is null on a top-level one, and source says whether " +
        "PromptEye proposed it (`ai`) or it was written by hand (`manual`).",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: { data: z.array(CategorySchema) },
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const list = await client.listCategories(project.id);
        return ok(list);
      })
  );

  server.registerTool(
    "create_category",
    {
      title: "Create a category to file prompts under",
      description:
        "Adds a category the active project can file prompts under. Pass an existing top-level category " +
        "as parentCategoryId to create a subcategory instead; only one level of nesting is supported. " +
        "Every category made this way is recorded as written by hand (source `manual`), never as one " +
        "PromptEye proposed. update_prompt with categoryId files an existing prompt under it. A category " +
        "with the same name at the same level is refused.",
      annotations: WRITES,
      inputSchema: {
        name: z.string().min(1).max(200).describe("Name for the category."),
        parentCategoryId: z
          .string()
          .min(1)
          .optional()
          .describe(
            "An existing top-level category to file this one under, as list_categories reports it, which makes it a subcategory. " +
              "Left out, a top-level category is created."
          ),
      },
      outputSchema: CategorySchema.shape,
    },
    async (input) =>
      handled(async () => {
        const project = await session.require();
        const category = await client.createCategory(project.id, input);
        return ok(category);
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
        "accept_prompt_suggestion turns one into a tracked prompt; generate_prompt_suggestions asks " +
        "PromptEye for new ones for a group.",
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
        return ok(list);
      })
  );

  server.registerTool(
    "accept_prompt_suggestion",
    {
      title: "Accept a suggested prompt",
      description:
        "Turns one suggestion from list_prompt_suggestions into a tracked prompt of the active project, " +
        "the same way accepting it in the PromptEye app does. promptText edits the wording before it " +
        "starts being asked; leave it out to accept the suggestion exactly as written.\n\n" +
        "The suggestion leaves the pending list; its siblings from the same cycle are left untouched. " +
        "The new prompt counts against the workspace plan and is measured from the next run on, like " +
        "any prompt — get_account says when that starts.",
      annotations: WRITES,
      inputSchema: {
        suggestionId: z.string().min(1).describe("Id of the suggestion, as list_prompt_suggestions reports it."),
        promptText: z
          .string()
          .min(1)
          .optional()
          .describe("Wording to track instead of the suggestion as written. Left out, the suggestion is tracked verbatim."),
      },
      outputSchema: AcceptedPromptSuggestionSchema.shape,
    },
    async ({ suggestionId, promptText }) =>
      handled(async () => {
        const project = await session.require();
        const accepted = await client.acceptPromptSuggestion(project.id, suggestionId, { promptText });
        return ok(accepted);
      })
  );

  server.registerTool(
    "get_prompt_suggestion_availability",
    {
      title: "Check whether new suggestions can be generated for a group",
      description:
        "Whether generate_prompt_suggestions would schedule a new run for one prompt group of the active " +
        "project right now, and if not, why — the same check that tool runs itself, without scheduling " +
        "anything.\n\n" +
        "After calling generate_prompt_suggestions, poll this endpoint until lastRun.status is not running. " +
        "When a run finishes with producedCount 0, read emptyReason (or error if status is failed) to see why " +
        "no suggestions were generated. list_prompt_suggestions returns only pending suggestions that have not " +
        "yet been accepted or rejected.",
      annotations: READ_ONLY,
      inputSchema: {
        groupId: z.string().min(1).describe("Id of the prompt group, as list_prompt_groups reports it."),
      },
      outputSchema: SuggestionRunAvailabilitySchema.shape,
    },
    async ({ groupId }) =>
      handled(async () => {
        const project = await session.require();
        const availability = await client.getPromptSuggestionAvailability(project.id, groupId);
        return ok(availability);
      })
  );

  server.registerTool(
    "generate_prompt_suggestions",
    {
      title: "Generate new prompt suggestions for a group",
      description:
        "Asks PromptEye to propose new prompts for one prompt group of the active project, the same " +
        "cycle the app runs when Generate is pressed on a group: it reads what the group is missing, " +
        "drafts candidate phrases, checks their demand, expands them into questions and scores each one. " +
        PROMPT_GENERATION +
        "\n\nScheduling a run is instant; the cycle itself runs in the background for a minute or more " +
        "and is not waited on here. Poll get_prompt_suggestion_availability with the groupId afterwards " +
        "to wait for the run to finish and discover what it produced. Call list_prompt_suggestions to " +
        "read the pending suggestions generated; it returns only suggestions awaiting a decision, " +
        "excluding ones that have already been accepted or rejected.\n\n" +
        "A run is not always worth scheduling — the group might already be healthy, the plan's paid " +
        "work might not currently cover it, or the last run might still have proposals awaiting a " +
        "decision. Then nothing is scheduled and runId comes back null with `skipped` saying why; that " +
        "is not an error. A run already in progress, or no free plan slots left, is refused by the API " +
        "instead — call get_prompt_suggestion_availability first to know which case applies.",
      annotations: WRITES,
      inputSchema: {
        groupId: z.string().min(1).describe("Id of the prompt group, as list_prompt_groups reports it."),
      },
      outputSchema: SuggestionRunSchema.shape,
    },
    async ({ groupId }) =>
      handled(async () => {
        const project = await session.require();
        const run = await client.generatePromptSuggestions(project.id, groupId);
        return ok(run);
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
        "Groups are handled by name: a groupName that does not exist yet is created after the existing " +
        "groups, and one that does is reused. upsert_prompt_group renames or describes a group afterwards.\n\n" +
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
                    "yet and reused when it does, ignoring case, so match the spelling reported by " +
                    "list_prompt_groups to land in an existing group. " +
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
        return ok(list);
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
        return ok(updated);
      })
  );
}
