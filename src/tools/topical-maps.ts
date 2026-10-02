import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TopicalMapSchema, TopicalMapSummarySchema } from "../schemas/prompteye.js";
import type { TopicalMap, TopicalMapSummary } from "../schemas/prompteye.js";
import { READ_ONLY, WRITES, handled, ok, type ToolContext } from "./result.js";

const describeSummary = (map: TopicalMapSummary): string =>
  `- "${map.topic}" (${map.language}) — ${map.status} [id: ${map.id}]`;

const describeMap = (map: TopicalMap): string => {
  const lines = [`"${map.topic}" (${map.language}) — ${map.status} [id: ${map.id}]`];

  if (map.status === "error") {
    lines.push(`Error: ${map.errorMessage ?? "unknown"}`);
    return lines.join("\n");
  }

  if (map.status === "processing") {
    lines.push("Still generating — call get_topical_map again in a moment.");
    return lines.join("\n");
  }

  if (map.pillar) {
    lines.push(`Pillar: ${map.pillar.title}`, map.pillar.description);
  }

  const byCategory = new Map<string, typeof map.clusters>();
  for (const cluster of map.clusters) {
    byCategory.set(cluster.category, [...(byCategory.get(cluster.category) ?? []), cluster]);
  }

  lines.push(`${map.clusters.length} cluster article(s) across ${byCategory.size} categor${byCategory.size === 1 ? "y" : "ies"}:`);
  for (const [category, clusters] of byCategory) {
    lines.push(`  ${category}:`, ...clusters.map((cluster) => `    - ${cluster.title} (${cluster.intent})`));
  }

  return lines.join("\n");
};

export function registerTopicalMapTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "create_topical_map",
    {
      title: "Build a topical authority map for a topic",
      description:
        "Builds a 'pillar and clusters' content plan for a topic in the active project: one compendium " +
        "page and the supporting article titles underneath it, grouped by category, meant to make the " +
        "site the topic's most complete source for both search engines and AI models.\n\n" +
        "Building one takes a little while, since it asks a model to plan the whole structure. The map " +
        "comes back `processing` and turns `ready` once that finishes, or `error` if it fails — poll " +
        "get_topical_map with the returned id until it does.\n\n" +
        "Every call starts a new map; there is no dedup and no limit on how many a project can have — " +
        "asking for the same topic twice builds two maps.",
      annotations: WRITES,
      inputSchema: {
        topic: z.string().min(1).describe("The topic to build a map for."),
        language: z.string().min(1).describe("Language to write the map in, as a two-letter code."),
      },
      outputSchema: TopicalMapSchema.shape,
    },
    async ({ topic, language }) =>
      handled(async () => {
        const project = await session.require();
        const map = await client.createTopicalMap(project.id, { topic, language });

        return ok(
          `Topical map for "${map.topic}" started in ${project.name}; it is ${map.status} — poll ` +
            `get_topical_map with id ${map.id} until it turns ready or error.`,
          map
        );
      })
  );

  server.registerTool(
    "list_topical_maps",
    {
      title: "List the topical maps of the project",
      description:
        "Every map built for the active project, newest first, without their clusters — read one in " +
        "full with get_topical_map.",
      annotations: READ_ONLY,
      inputSchema: {},
      outputSchema: { data: z.array(TopicalMapSummarySchema) },
    },
    async () =>
      handled(async () => {
        const project = await session.require();
        const list = await client.listTopicalMaps(project.id);

        return ok(
          list.data.length === 0
            ? `${project.name} has no topical maps yet.`
            : `${list.data.length} topical map(s) for ${project.name}:\n${list.data.map(describeSummary).join("\n")}`,
          list
        );
      })
  );

  server.registerTool(
    "get_topical_map",
    {
      title: "Read one topical map",
      description:
        "One map in full: its pillar page and every cluster article, grouped by category.\n\n" +
        "This is where a map is polled until status is ready — pillar is null and clusters is empty " +
        "until then, and errorMessage is set instead if generation failed.",
      annotations: READ_ONLY,
      inputSchema: {
        mapId: z.string().min(1).describe("Id of the map, as create_topical_map or list_topical_maps reports it."),
      },
      outputSchema: TopicalMapSchema.shape,
    },
    async ({ mapId }) =>
      handled(async () => {
        const project = await session.require();
        const map = await client.getTopicalMap(project.id, mapId);

        return ok(describeMap(map), map);
      })
  );

  server.registerTool(
    "regenerate_topical_map_cluster",
    {
      title: "Regenerate one category of a topical map",
      description:
        "Replaces every article currently filed under one category of a map with a fresh set, without " +
        "touching the rest of the map or its pillar page. Read the category names off get_topical_map's " +
        "clusters.",
      annotations: WRITES,
      inputSchema: {
        mapId: z.string().min(1).describe("Id of the map to regenerate a category of."),
        category: z.string().min(1).describe("Category to regenerate, exactly as get_topical_map reports it."),
      },
      outputSchema: TopicalMapSchema.shape,
    },
    async ({ mapId, category }) =>
      handled(async () => {
        const project = await session.require();
        const map = await client.regenerateTopicalMapCluster(project.id, mapId, { category });

        return ok(`Regenerated category "${category}" of topical map ${map.id}.`, map);
      })
  );
}
