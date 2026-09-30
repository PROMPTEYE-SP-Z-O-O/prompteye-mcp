import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { toolMessageFor } from "../client/errors.js";
import type { PromptEyeClient } from "../client/prompteye-client.js";
import type { Page } from "../schemas/common.js";
import {
  AccountSchema,
  KnowledgeBaseSchema,
  ProjectListSchema,
  ProjectSchema,
  PromptGroupPageSchema,
  PromptPageSchema,
  PromptSuggestionListSchema,
  ReportPageSchema,
  type Account,
  type Project,
  type Report,
} from "../schemas/prompteye.js";
import { CONTENT_APP_URL } from "./glossary.js";
import { describeProject } from "./projects.js";
import { promptGroupLine, promptLine, renderSuggestion } from "./prompts.js";
import { reportLine } from "./reports.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

type Unreadable = { error: string };

const accountLine = (account: Account): string =>
  `Account ${account.email} on the ${account.plan?.name ?? "—"} plan: ` +
  `${account.promptCount} of ${account.promptLimit} prompt(s) tracked, asked on ` +
  `${account.models.join(", ") || "no assistants"} ${account.scanFrequency}. ` +
  `Next run starts ${account.nextScanAt} and takes tens of minutes to finish.`;

const section = (heading: string, entries: string[], nextCursor: string | null = null): string[] => [
  "",
  heading,
  ...(entries.length > 0 ? entries : ["none"]),
  ...(nextCursor === null ? [] : ["More follow on the next page."]),
];

const readReports = (client: PromptEyeClient): Promise<Page<Report> | Unreadable> =>
  client.listReports({ limit: 200 }).catch((error: unknown) => {
    const message = toolMessageFor(error);
    if (message === undefined) throw error;
    return { error: message };
  });

async function readProject(client: PromptEyeClient, project: Project) {
  const [knowledgeBase, prompts, groups, suggestions] = await Promise.all([
    client.getKnowledgeBase(project.id),
    client.listPrompts(project.id, { limit: 200 }),
    client.listPromptGroups(project.id, { limit: 200 }),
    client.listPromptSuggestions(project.id, {}),
  ]);

  return { knowledgeBase, prompts, groups, suggestions };
}

export function registerGettingStartedTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "get_started",
    {
      title: "Where this workspace stands, and what to do next",
      description:
        "Call this when the user asks what they can do with PromptEye, where to begin, where they " +
        "stand, or what to do next — and at the start of a session before guessing at any of that. " +
        "It reads the account, the projects, and for the active project its knowledge base, prompts, " +
        "prompt groups and pending suggestions, plus the public reports the account has generated, and " +
        "hands them over as the API returns them. Work out from that data where the project stands " +
        "and which step comes next.\n\n" +
        "The workflow runs in order:\n" +
        "1. The project — one brand in one market, created with create_project and picked with " +
        "select_project. Nothing is measured until a project exists.\n" +
        "2. The knowledge base — industry, product category, target audience, ICP, operating area and " +
        "a description of what the brand does, saved with update_knowledge_base. Every prompt " +
        "PromptEye proposes is written from it, so it comes before prompts.\n" +
        "3. The prompts — picked from list_prompt_suggestions and accepted in the PromptEye app. " +
        "Suggestions are generated inside a prompt group from the app. add_prompts only for prompts " +
        "the user must track verbatim, after the user has chosen that. A paused prompt is not asked.\n" +
        "4. The content — while the first run is pending, create_content_brief with a promptId from " +
        "list_prompts orders the outline of an article for that prompt. Optional.\n" +
        "5. The wait — a prompt carries no figures until the run after it was added. The run starts " +
        "at the account's nextScanAt and takes tens of minutes.\n" +
        "6. The results — list_prompts for what each question earns, list_competitors for the brands " +
        "answering alongside, list_sources for the pages behind the answers, and create_content_brief " +
        "for the prompts the brand is rarely or never named on.\n\n" +
        "A public report whose contactCount is above zero and whose leadStatus is not `done` is a " +
        "prospect waiting to be contacted; " +
        "get_report names who asked and how to reach them. A report with no projectId is still a " +
        "sample, and converting it into a tracked project is done in the app.\n\n" +
        "PromptEye covers the full visibility loop — track prompts, generate content for the weak " +
        "ones, measure the result — so the next steps include content generation.",
      annotations: READ_ONLY,
      inputSchema: {
        projectId: z
          .string()
          .min(1)
          .optional()
          .describe("Report on this project instead of the active one, and make it active."),
      },
      outputSchema: {
        account: AccountSchema,
        projects: ProjectListSchema,
        project: ProjectSchema.nullable(),
        knowledgeBase: KnowledgeBaseSchema.optional(),
        prompts: PromptPageSchema.optional(),
        groups: PromptGroupPageSchema.optional(),
        suggestions: PromptSuggestionListSchema.optional(),
        reports: z.union([ReportPageSchema, z.object({ error: z.string() })]),
      },
    },
    async ({ projectId }) =>
      handled(async () => {
        const projects = await client.listProjects();

        if (projectId) await session.select(projectId);
        const active =
          session.current() ?? (projects.data.length === 1 ? await session.select(projects.data[0].id) : null);

        const [account, reports, workspace] = await Promise.all([
          client.getAccount(),
          readReports(client),
          active ? readProject(client, active) : null,
        ]);

        const lines = [
          accountLine(account),
          ...section("Projects:", projects.data.map((project) => `- ${describeProject(project)}`)),
          "",
          active ? `Active project: ${describeProject(active)}.` : "No project is selected.",
        ];

        if (workspace) {
          lines.push(
            "",
            `Knowledge base (updated ${workspace.knowledgeBase.updatedAt ?? "—"}):`,
            workspace.knowledgeBase.text ?? "none",
            ...section("Prompts:", workspace.prompts.data.map(promptLine), workspace.prompts.nextCursor),
            ...section("Prompt groups:", workspace.groups.data.map(promptGroupLine), workspace.groups.nextCursor),
            ...section("Pending suggestions:", workspace.suggestions.data.map(renderSuggestion))
          );
        }

        lines.push(
          ...("error" in reports
            ? ["", `Public reports could not be read: ${reports.error}`]
            : section("Public reports:", reports.data.map(reportLine), reports.nextCursor))
        );

        lines.push(
          "",
          "Help center: guides on how PromptEye works are at https://app.prompteye.com/help — " +
            "list_help_articles and read_help_article read them, so use those for any 'how does X work' " +
            "question, and point the user to that address."
        );
        lines.push(
          "",
          "Done in the PromptEye app, not here: accepting a suggestion, deleting a prompt, " +
            "converting a report into a tracked project, and writing the article from a content brief " +
            `(${CONTENT_APP_URL}). Prompt generation cannot be triggered through the API. What can be ` +
            "done here: update_knowledge_base for the brand description, update_prompt to pause a " +
            "prompt, move it between groups or set its priority, and create_content_brief to start " +
            "generating an article for a prompt."
        );

        return ok(lines.join("\n"), { account, projects, project: active, ...workspace, reports });
      })
  );
}
