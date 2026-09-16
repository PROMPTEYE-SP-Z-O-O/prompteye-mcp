import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KnowledgeBaseSchema, ProjectSchema } from "../schemas/prompteye.js";
import type { Project } from "../schemas/prompteye.js";
import { READ_ONLY, fail, handled, ok, type ToolContext } from "./result.js";

const describe = (project: Project): string =>
  `${project.name} — brand ${project.brand} (${project.domain}) tracked in ${project.country}, ` +
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
        "prompts or sources.",
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
    "get_knowledge_base",
    {
      title: "Read what the project knows about the brand",
      description:
        "The description of the brand the project measures against — what the company sells and to " +
        "whom. Useful for judging whether a prompt or a competitor genuinely belongs to this brand.",
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
}
