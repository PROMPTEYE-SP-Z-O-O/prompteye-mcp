import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * The workflows PromptEye runs on its own data, written out for whoever is
 * driving the tools.
 *
 * A tool description says what one call returns; these say what to do with
 * several of them at once — which figure to act on first, and what a number
 * means for the brand. Hosts surface them as slash commands, so a user reaches
 * a full review without knowing the tool names.
 */

const message = (text: string) => ({
  messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
});

const ORIENT =
  "Start from the active project. If none is selected, call list_projects and select_project — " +
  "with a single project this happens on its own.";

export function registerPromptWorkflows(server: McpServer): void {
  server.registerPrompt(
    "visibility_review",
    {
      title: "Review how the brand stands",
      description:
        "Read the prompts, the competitors and the cited sources for a period, and say what to fix first.",
      argsSchema: {
        period: z
          .string()
          .optional()
          .describe("Period to report on, e.g. 'last 30 days' or '2026-08-01 to 2026-08-31'."),
      },
    },
    ({ period }) =>
      message(
        `Review how this brand stands inside AI answers${period ? ` for ${period}` : ""}.\n\n` +
          `${ORIENT}\n\n` +
          "Then gather, in this order: list_prompts, list_competitors, list_sources.\n\n" +
          "Read them together rather than one at a time:\n" +
          "- Prompts that were never named are the work. A prompt at 0% is not proof the brand is " +
          "invisible — first check whether it is a question anyone would actually put to an " +
          "assistant, because a prompt phrased like a search query measures nothing.\n" +
          "- Compare the brand's share of voice against the leader, not against 100. Visibility can " +
          "be high for everyone at once; share of voice is what was taken from the others.\n" +
          "- If the brand's own domain holds a small slice of the citations, the assistants are " +
          "describing it from other people's pages. Name those pages.\n\n" +
          "Finish with at most three things to do next, each tied to the figure that argues for it. " +
          "Say plainly when the data does not support a recommendation."
      )
  );

  server.registerPrompt(
    "what_to_track_next",
    {
      title: "Decide which prompts to add next",
      description:
        "Work through PromptEye's suggestions and the gaps in the funnel, and decide what is worth tracking.",
      argsSchema: {
        group: z.string().optional().describe("Limit the review to one prompt group, by name."),
      },
    },
    ({ group }) =>
      message(
        `Decide which prompts this project should start tracking${group ? `, within the group ${group}` : ""}.\n\n` +
          `${ORIENT}\n\n` +
          "Call list_prompt_groups, then list_prompts, then list_prompt_suggestions.\n\n" +
          "A group is the unit of analysis: funnel coverage, the demand ranking behind a prompt and " +
          "the suggestions themselves are all computed inside it. Every prompt sits at one of four " +
          "stages — awareness, consideration, comparison, decision — and a stage with no prompts is a " +
          "blind spot: customers are asking there and nobody knows what the assistants answer.\n\n" +
          "Work from the suggestions. Each carries why it was proposed, the demand behind it, how " +
          "close to a purchase it is asked and how well it fits what the brand sells. Recommend the " +
          "ones that close a missing stage in a group that matters, and say which to skip.\n\n" +
          "Do not write prompts by hand for this. add_prompts exists for prompts the user already " +
          "has and must track verbatim; it skips the demand, duplicate and fit checks, so only reach " +
          "for it if the user asks."
      )
  );

  server.registerPrompt(
    "own_the_narrative",
    {
      title: "Find where the brand's story is written",
      description:
        "Read the cited domains and the competitors, and turn them into where to publish, pitch or correct.",
      argsSchema: {
        model: z
          .string()
          .optional()
          .describe("Narrow to one assistant, e.g. gpt, perplexity, claude, gemini."),
      },
    },
    ({ model }) =>
      message(
        `Work out where this brand's story is being written${model ? `, on ${model} alone` : ""}, and what to do about it.\n\n` +
          `${ORIENT}\n\n` +
          "Call list_sources, then list_competitors.\n\n" +
          "The cited domains are the pages the assistants lean on. Sort them into the kinds they are: " +
          "review sites and directories, forums and communities, press, and the brand's own pages. " +
          "Each kind is acted on differently — a listing is claimed and corrected, a forum thread is " +
          "answered, a review page is earned, an own page is written.\n\n" +
          "Then check whether the brands ahead on share of voice are the ones those domains name. A " +
          "competitor that leads because one review site ranks it first is a different problem from " +
          "one that leads everywhere.\n\n" +
          "Finish with the specific domains worth working on, and what the work is on each."
      )
  );

  server.registerPrompt(
    "onboard_brand",
    {
      title: "Set up a new brand",
      description: "Create a project for one brand in one market and get its first prompts in place.",
      argsSchema: {
        brand: z.string().describe("The brand name as it is written in answers."),
        domain: z.string().describe("Primary domain, without protocol or path."),
        country: z.string().describe("Market as an ISO 3166-1 alpha-2 code, or GLOB for the global answer set."),
      },
    },
    ({ brand, domain, country }) =>
      message(
        `Set up PromptEye tracking for ${brand} (${domain}) in ${country}.\n\n` +
          "First call list_projects: a brand already tracked in that market must not be created twice.\n\n" +
          "Then create_project. Before you do, ask the user for the two things that quietly decide " +
          "whether the numbers are right:\n" +
          "- other spellings of the brand that should count as a mention, since answers using them " +
          "otherwise read as the brand being absent;\n" +
          "- brands to keep out of the competitor set, such as agencies or resellers, which would " +
          "otherwise dilute share of voice.\n\n" +
          "Then read get_knowledge_base. Everything PromptEye writes for the project starts there, so " +
          "if it is empty or wrong, say so — the prompts it proposes will inherit the mistake.\n\n" +
          "Finally call list_prompt_suggestions and walk the user through the first set. Nothing is " +
          "measured until the project has prompts, and the suggestions are the path meant for that."
      )
  );
}
