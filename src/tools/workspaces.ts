import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { paginationShape } from "../schemas/common.js";
import { NextCursorSchema, WorkspaceSchema } from "../schemas/prompteye.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

export function registerWorkspaceTools(server: McpServer, { client }: ToolContext): void {
  server.registerTool(
    "list_workspaces",
    {
      title: "List the workspaces of the account",
      description:
        "Every workspace the account behind the key belongs to — its own personal one, unless it only " +
        "ever joined through an invitation, and each team it was invited to — with the role it holds " +
        "there. A project always lives in one workspace, and that workspace's plan is what the project " +
        "counts against.\n\n" +
        "Pass an id from here as workspaceId to create_project to create the project in that workspace, " +
        "or to list_projects to list only the projects in it. Workspaces come in the order the account " +
        "joined them, the same order the workspace switcher of the app shows.",
      annotations: READ_ONLY,
      inputSchema: paginationShape,
      outputSchema: { data: z.array(WorkspaceSchema), nextCursor: NextCursorSchema },
    },
    async (args) =>
      handled(async () => {
        const page = await client.listWorkspaces(args);
        return ok(page);
      })
  );
}
