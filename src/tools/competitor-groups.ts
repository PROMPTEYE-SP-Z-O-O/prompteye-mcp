import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CompetitorGroupSchema } from "../schemas/prompteye.js";
import { READ_ONLY, WRITES, handled, ok, type ToolContext } from "./result.js";
import { projectIdShape } from "./project-id.js";

const RANKING_CATCHES_UP =
  "list_competitors follows once the project's figures are rebuilt, usually within minutes and at the latest " +
  "after the nightly recompute; until then it still shows the previous grouping. Tell the user the ranking will " +
  "catch up rather than calling again to check.";

export function registerCompetitorGroupTools(
  server: McpServer,
  { client }: ToolContext,
): void {
  server.registerTool(
    "list_competitor_groups",
    {
      title: "List spellings counted as one competitor",
      description:
        "The groups of spellings the project counts as one competitor, such as “PKO BP” and “PKO Bank Polski”. " +
        "The ranking shows each group as one row under its name. Spellings PromptEye folds together on its own " +
        "(the same name written differently) are one row in the ranking without being listed here. " +
        "Read this before merge_competitors to see what " +
        "is already grouped, and for the `id` that ungroup_competitors takes. `excludedNames` are the spellings " +
        "kept out of the ranking (see list_competitor_exclusions).",
      annotations: READ_ONLY,
      inputSchema: { ...projectIdShape },
      outputSchema: { data: z.array(CompetitorGroupSchema) },
    },
    async ({ projectId }) =>
      handled(async () => ok(await client.listCompetitorGroups(projectId))),
  );

  server.registerTool(
    "merge_competitors",
    {
      title: "Count several spellings as one competitor",
      description:
        "Counts several spellings of the same company as one competitor, so the ranking shows one row instead " +
        "of several. Propose it when list_competitors shows the same company under more than one name (“ING” " +
        "and “ING Bank Śląski”). Before calling, show the user the exact names you are about to merge and wait " +
        "for their yes: they know which names are really one company.\n\n" +
        "When one of the names already belongs to a group, the others join that group. Names from two different " +
        "groups are refused with the groups named, and so are the project's own brand, a new group of one " +
        "spelling, and a new group's `groupName` another group already answers to; pass the reason on rather " +
        "than retrying. Names that join a group kept out of the ranking, or a new group named after an excluded " +
        "brand, are kept out with it — the answer's `excludedNames` says so; tell the user. Nothing is deleted: " +
        "every spelling stays, counted under the group's name. ungroup_competitors takes the group apart again " +
        "but leaves its spellings excluded; set_competitor_exclusions changes that.\n\n" +
        RANKING_CATCHES_UP,
      annotations: WRITES,
      inputSchema: {
        ...projectIdShape,
        names: z
          .array(z.string().min(1).max(120))
          .min(2)
          .max(20)
          .describe(
            "The spellings of one competitor, as list_competitors spells them.",
          ),
        groupName: z
          .string()
          .min(1)
          .max(120)
          .optional()
          .describe(
            "The name a new group is shown under; the first name by default. A group the names join keeps its own " +
              "name and this is not used.",
          ),
      },
      outputSchema: CompetitorGroupSchema.shape,
    },
    async ({ projectId, names, groupName }) =>
      handled(async () =>
        ok(await client.mergeCompetitors(projectId, names, groupName)),
      ),
  );

  server.registerTool(
    "ungroup_competitors",
    {
      title: "Count a group's spellings separately again",
      description:
        "Takes a competitor group apart: every spelling in it stays and is counted as a competitor of its own " +
        "again. Use it when a group joined names that are really different companies. Take the `id` from " +
        "list_competitor_groups and confirm the group with the user first. A group kept out of the ranking " +
        "stays excluded: each of its spellings is excluded on its own. Answers with the group as it was. " +
        "A group that is not found was probably changed meanwhile: read list_competitor_groups again.\n\n" +
        RANKING_CATCHES_UP,
      annotations: WRITES,
      inputSchema: {
        ...projectIdShape,
        groupId: z
          .string()
          .min(1)
          .describe(
            "The competitor group's `id` from list_competitor_groups — not a prompt group.",
          ),
      },
      outputSchema: CompetitorGroupSchema.shape,
    },
    async ({ projectId, groupId }) =>
      handled(async () =>
        ok(await client.ungroupCompetitors(projectId, groupId)),
      ),
  );
}
