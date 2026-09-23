import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { COUNTRY_CODES, KnowledgeBaseSchema, ProjectSchema } from "../schemas/prompteye.js";
import type { Project } from "../schemas/prompteye.js";
import { PROMPT_GENERATION } from "./glossary.js";
import { READ_ONLY, WRITES, fail, handled, ok, type ToolContext } from "./result.js";

const describe = (project: Project): string =>
  `${project.name} — label ${project.label ?? "—"}, brand ${project.brand} (${project.domain}) tracked in ${project.country}, ` +
  `access ${project.accessRole} [id: ${project.id}]`;

export function registerProjectTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "Every project the API key reaches, newest first, with the access the key has to each. A " +
        "project is one brand tracked in one market, and it is the root of everything else PromptEye " +
        "measures. Call this first, then select_project, before asking about visibility, competitors, " +
        "prompts or sources. Each row includes its label, brand/name and domain; use these fields together " +
        "to identify a project. Projects with different labels are distinct: do not call them duplicates " +
        "based only on similar brand names. When unsure which one the user means, ask using the labels " +
        "and domains shown, and use the project id to select the confirmed one.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: { data: z.array(ProjectSchema) },
    },
    async () =>
      handled(async () => {
        const list = await client.listProjects();
        const lines = list.data.map((project) => `- ${describe(project)}`);

        return ok(
          list.data.length === 0
            ? "This API key reaches no projects."
            : `${list.data.length} project(s):\n${lines.join("\n")}`,
          list
        );
      })
  );

  server.registerTool(
    "select_project",
    {
      title: "Select the project to work on",
      description:
        "Makes one project the active one. Every other tool reports on the active project and takes " +
        "no project argument, so call this once before asking about visibility, competitors, prompts, " +
        "answers or sources. Call it again to switch projects mid-conversation.",
      annotations: READ_ONLY,
      inputSchema: {
        projectId: z
          .string()
          .min(1)
          .describe("Id of the project to make active, as list_projects reports it."),
      },
      outputSchema: ProjectSchema.shape,
    },
    async ({ projectId }) =>
      handled(async () => {
        const project = await session.select(projectId);

        return ok(
          `Active project is now ${describe(project)}.\n` +
            "Every following tool call reports on this project until select_project is called again.",
          project
        );
      })
  );

  server.registerTool(
    "get_active_project",
    {
      title: "Read the active project",
      description:
        "The project every other tool is currently reporting on. Call this when unsure which project " +
        "the numbers in this conversation refer to.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: ProjectSchema.shape,
    },
    async () =>
      handled(async () => {
        const project = session.current();
        if (!project) {
          return fail(
            "No project is selected. Call list_projects to see the projects this API key reaches, " +
              "then select_project with the id of the one to work on."
          );
        }

        return ok(`Active project: ${describe(project)}.`, project);
      })
  );

  server.registerTool(
    "create_project",
    {
      title: "Create a project",
      description:
        "Starts tracking one brand in one market. The project is the unit everything else hangs off — " +
        "prompts, answers, competitors and the visibility computed from them — and it becomes the " +
        "active project, so the following tools report on it without another call.\n\n" +
        "A brand tracked in several markets needs one project per market: the same `brand` with a " +
        "different `country`. Check list_projects first; creating a second project for a brand and " +
        "market already tracked is refused.\n\n" +
        "Creating a project counts against the workspace plan. Nothing is asked of the assistants " +
        "until the project has prompts — " +
        PROMPT_GENERATION,
      annotations: WRITES,
      inputSchema: {
        brand: z
          .string()
          .min(1)
          .max(120)
          .describe(
            "The brand name as it is written in answers. Visibility is measured against this name, so " +
              "write it the way an assistant would, not as a legal entity."
          ),
        domain: z
          .string()
          .min(3)
          .max(253)
          .describe("Primary domain of the brand, without protocol or path, e.g. prompteye.com."),
        country: z
          .enum(COUNTRY_CODES)
          .describe(
            "Market to track the brand in, as an ISO 3166-1 alpha-2 code such as PL, DE or US. GLOB " +
              "stands for the global answer set rather than one country."
          ),
        name: z
          .string()
          .min(1)
          .max(120)
          .optional()
          .describe("Display name of the project. Defaults to the brand name."),
        label: z.string().min(1).max(40).optional().describe("Short label used to group projects in listings."),
        alternativeBrandNames: z
          .array(z.string().min(1).max(120))
          .max(20)
          .optional()
          .describe(
            "Other spellings that count as naming the brand — a space, a suffix, a common misspelling. " +
              "Without these, answers using them read as the brand being absent."
          ),
        alternativeDomains: z
          .array(z.string().min(3).max(253))
          .max(20)
          .optional()
          .describe("Further domains owned by the brand; citations of them count as its own."),
        excludedCompetitors: z
          .array(z.string().min(1).max(120))
          .max(50)
          .optional()
          .describe(
            "Brands to keep out of the competitor set — agencies, resellers or anything that is not a " +
              "rival, so share of voice is not diluted by them."
          ),
      },
      outputSchema: ProjectSchema.shape,
    },
    async (args) =>
      handled(async () => {
        const project = await client.createProject(args);
        await session.select(project.id);

        return ok(`Created ${describe(project)}.\nIt is now the active project.`, project);
      })
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project settings",
      description:
        "Correct what the active project tracks: change the display name, grouping label, primary domain, " +
        "alternative brand spellings, and alternative domains.\n\n" +
        "Note: alternativeBrandNames and alternativeDomains are replaced as a whole rather than appended to, " +
        "so pass the complete list. Neither the brand name nor the market country can be changed here because " +
        "historical measurements depend on them (a different brand/market is a separate project).\n\n" +
        "Before changing alternativeBrandNames, warn the user that historical visibility metrics will be rebuilt. " +
        "The rebuild may take up to an hour. During that time, aggregated reads such as list_competitors and " +
        "list_prompt_groups may be temporarily unavailable.",
      annotations: WRITES,
      inputSchema: {
        name: z.string().min(1).max(120).optional().describe("Display name of the project. Defaults to the brand name."),
        label: z.string().min(1).max(40).optional().describe("Short label used to group projects in listings."),
        domain: z.string().min(3).max(253).optional().describe("Primary domain of the brand, without protocol or path, e.g. prompteye.com."),
        alternativeBrandNames: z
          .array(z.string().min(1).max(120))
          .max(20)
          .optional()
          .describe(
            "Other spellings that count as naming the brand. Replaces the existing list and triggers a rebuild " +
              "of historical visibility metrics that may take up to an hour; warn the user that aggregate reads " +
              "may be temporarily unavailable during the rebuild."
          ),
        alternativeDomains: z
          .array(z.string().min(3).max(253))
          .max(20)
          .optional()
          .describe("Further domains owned by the brand whose citations count as its own. Replaces the existing list."),
      },
      outputSchema: ProjectSchema.shape,
    },
    async (args) =>
      handled(async () => {
        const current = await session.require();
        const project = await client.updateProject(current.id, args);
        await session.select(project.id);

        return ok(`Updated project ${describe(project)}.`, project);
      })
  );

  server.registerTool(
    "get_knowledge_base",
    {
      title: "Read what the project knows about the brand",
      description:
        "The description of the brand the project measures against — what the company sells and to " +
        "whom. Everything PromptEye writes for the project reads this first, so it is worth knowing " +
        "what a brand is being judged against before trusting a prompt or a competitor.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: KnowledgeBaseSchema.shape,
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const knowledgeBase = await client.getKnowledgeBase(project.id);

        return ok(
          knowledgeBase.text === null
            ? `${project.name} has no description of ${project.brand} yet.`
            : `Knowledge base for ${project.brand} (updated ${knowledgeBase.updatedAt ?? "—"}):\n\n${knowledgeBase.text}`,
          knowledgeBase
        );
      })
  );

  server.registerTool(
    "update_knowledge_base",
    {
      title: "Describe the brand better in the knowledge base",
      description:
        "Updates what the project knows about the brand — who buys it, where it sells, and what makes it distinct. " +
        "Everything PromptEye generates for the project (prompts, suggestions, analyses) leans on these fields, " +
        "so keeping them accurate ensures generated content and evaluation criteria match reality.\n\n" +
        "Only provided fields are updated; omitted fields keep their current values.",
      annotations: WRITES,
      inputSchema: {
        industry: z.string().max(4000).optional().describe("The industry the brand sells into, e.g. 'AI search analytics'."),
        productCategory: z
          .string()
          .max(4000)
          .optional()
          .describe("What kind of product or service it is, in buyer words, e.g. 'Brand visibility monitoring for AI assistants'."),
        targetAudience: z.string().max(4000).optional().describe("Who buys it, e.g. 'Marketing and SEO teams at B2B software companies'."),
        icp: z.string().max(4000).optional().describe("Ideal customer profile: the target buyer persona."),
        operatingArea: z.string().max(4000).optional().describe("Where the brand sells, e.g. 'Europe, US'."),
        description: z
          .string()
          .max(4000)
          .optional()
          .describe("Full description of what the brand does. Prompt generation leans heavily on this."),
      },
      outputSchema: KnowledgeBaseSchema.shape,
    },
    async (args) =>
      handled(async () => {
        const project = await session.require();
        const knowledgeBase = await client.updateKnowledgeBase(project.id, args);

        return ok(
          `Updated knowledge base for ${project.brand} (updated ${knowledgeBase.updatedAt ?? "—"}):\n\n${knowledgeBase.text ?? "No description"}`,
          knowledgeBase
        );
      })
  );
}
