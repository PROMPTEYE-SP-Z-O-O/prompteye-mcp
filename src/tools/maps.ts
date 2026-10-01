import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TopicalMapSchema, TopicalMapSummarySchema } from "../schemas/prompteye.js";
import { READ_ONLY, WRITES, handled, ok, type ToolContext } from "./result.js";

const mapIdShape = {
  mapId: z.string().min(1).describe("Id of the map, as create_topical_map or list_topical_maps reports it."),
};

export function registerTopicalMapTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "create_topical_map",
    {
      title: "Build a topical authority map for a topic",
      description:
        "Builds a pillar-and-clusters content plan for a topic in the active project: one compendium " +
        "page and the supporting article titles underneath it, grouped by category, meant to make the " +
        "site the topic's most complete source for both search engines and AI models.\n\n" +
        "Building one takes a little while, since it asks a model to plan the whole structure. The map " +
        "comes back `processing` and turns `ready` once that finishes, or `error` if it fails — read it " +
        "with get_topical_map until it does.\n\n" +
        "Every call starts a new map; there is no limit on how many a project can have.",
      annotations: WRITES,
      inputSchema: {
        topic: z.string().min(1).describe("The topic to build a map for, e.g. 'cloud backup for small teams'."),
        language: z.string().min(1).describe("Language to write the map in, as a two-letter code such as en or pl."),
      },
      outputSchema: TopicalMapSchema.shape,
    },
    async (input) =>
      handled(async () => {
        const project = await session.require();
        const map = await client.createTopicalMap(project.id, input);
        return ok(map);
      })
  );

  server.registerTool(
    "list_topical_maps",
    {
      title: "List the topical maps of the project",
      description:
        "Every map built for the active project, newest first, without their clusters — read one with " +
        "get_topical_map.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: { data: z.array(TopicalMapSummarySchema) },
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const list = await client.listTopicalMaps(project.id);
        return ok(list);
      })
  );

  server.registerTool(
    "get_topical_map",
    {
      title: "Read one topical map",
      description:
        "One map in full: its pillar page and every cluster article, grouped by category. Call it after " +
        "create_topical_map until `status` is `ready` — `pillar` is null and `clusters` is empty until " +
        "then, and `errorMessage` is set instead if generation failed.",
      annotations: READ_ONLY,
      inputSchema: mapIdShape,
      outputSchema: TopicalMapSchema.shape,
    },
    async ({ mapId }) =>
      handled(async () => {
        const project = await session.require();
        const map = await client.getTopicalMap(project.id, mapId);
        return ok(map);
      })
  );

  server.registerTool(
    "regenerate_topical_map_cluster",
    {
      title: "Regenerate one category of a topical map",
      description:
        "Replaces every article currently filed under one category of a map with a fresh set, without " +
        "touching the rest of the map or its pillar page. The categories are the `category` values the " +
        "map's clusters carry.",
      annotations: WRITES,
      inputSchema: {
        ...mapIdShape,
        category: z.string().min(1).describe("The category to regenerate; every existing article under it is replaced."),
      },
      outputSchema: TopicalMapSchema.shape,
    },
    async ({ mapId, category }) =>
      handled(async () => {
        const project = await session.require();
        const map = await client.regenerateTopicalMapCluster(project.id, mapId, { category });
        return ok(map);
      })
  );
}
