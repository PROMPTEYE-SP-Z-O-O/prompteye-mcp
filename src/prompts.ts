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
          "PromptEye closes the loop by generating content: for a prompt worth winning where the brand " +
          "is missing, one of the next steps can be create_content_brief, which orders the brief the " +
          "article is written from in the PromptEye app.\n\n" +
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
          "answered, a review page is earned, an own page is written — and PromptEye generates that " +
          "one: create_content_brief starts the article for the prompt it should answer.\n\n" +
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
      description:
        "Walk one brand from nothing to its first measurement: project, knowledge base, prompts, " +
        "article outlines, and the wait for the first run.",
      argsSchema: {
        brand: z.string().describe("The brand name as it is written in answers."),
        domain: z.string().describe("Primary domain, without protocol or path."),
        country: z.string().describe("Market as an ISO 3166-1 alpha-2 code, or GLOB for the global answer set."),
      },
    },
    ({ brand, domain, country }) =>
      message(
        `Set up PromptEye tracking for ${brand} (${domain}) in ${country}, one step at a time. ` +
          "Finish each step with the user before starting the next, and tell them which step they are on.\n\n" +
          "1. The project. Call list_projects first: a brand already tracked in that market must not be " +
          "created twice. Before create_project, ask the user for the two things that quietly decide " +
          "whether the numbers are right:\n" +
          "- other spellings of the brand that should count as a mention, since answers using them " +
          "otherwise read as the brand being absent;\n" +
          "- brands to keep out of the competitor set, such as agencies or resellers, which would " +
          "otherwise dilute share of voice.\n\n" +
          "2. The knowledge base. Call get_knowledge_base and show the user what the project knows about " +
          "the brand. Everything PromptEye writes for the project starts there, so a thin or wrong " +
          "description is inherited by every prompt it proposes. Ask the user for whatever is missing or " +
          "wrong — industry, product category, target audience, ICP, operating area, and a description of " +
          "what the brand does — and save their answers with update_knowledge_base. Write down what they " +
          "tell you; do not research the brand yourself or fill a field they left blank.\n\n" +
          "3. The prompts. Call list_prompt_suggestions and walk the user through the first set; accepting " +
          "them happens in the PromptEye app. A new project often has none yet, because suggestions are " +
          "generated inside a prompt group from the app — say so plainly and point the user there. Only " +
          "if the user already has prompts of their own that must be tracked verbatim, and says so, use " +
          "add_prompts.\n\n" +
          "4. The articles. Once prompts are tracked, offer to outline articles for the ones that matter " +
          "most: create_content_brief with a promptId from list_prompts, then get_content_brief when it " +
          "is ready. This is optional — skip it if the user does not publish content.\n\n" +
          "5. The wait. Nothing is measured until the next run: get_account says when it starts, and it " +
          "takes tens of minutes. Tell the user when to come back.\n\n" +
          "Call get_started at the end and check from what it returns that nothing is still missing."
      )
  );
}
