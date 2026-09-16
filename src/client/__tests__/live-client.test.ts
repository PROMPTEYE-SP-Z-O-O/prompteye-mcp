import { PromptEyeApi, type FetchLike } from "../../api/index.js";
import { ProjectSession } from "../../session.js";
import { createFixturesClient } from "../fixtures-client.js";
import { createLiveClient } from "../live-client.js";

const LIVE_PROJECT = {
  id: "k9live0project",
  name: "Acme — Germany",
  brand: "Acme",
  domain: "acme.example",
  country: "DE",
  label: null,
  alternativeBrandNames: [],
  alternativeDomains: [],
  excludedCompetitors: [],
  accessRole: "READ_ONLY",
  createdAt: "2026-09-01T10:00:00.000Z",
};

const LIVE_PROMPT = {
  id: "p1",
  prompt: "best crm for agencies",
  keyword: "",
  status: "active",
  categories: ["Comparison"],
  subcategories: [],
  groupId: null,
  createdAt: "2026-08-14T11:02:47.000Z",
  aiTraffic: 1900,
  businessPriority: "high",
  metrics: { visibility: 66.7, reachIndex: 61, averagePosition: 2.1 },
  change: { visibility: 8.3, reachIndex: 6, averagePosition: -0.4 },
};

const LIVE_GROUP = {
  id: "g1",
  name: "Comparison queries",
  order: 1,
  promptCount: 12,
  aiTrafficTotal: 8400,
  metrics: { visibility: 58.3, reachIndex: 55, averagePosition: 2.6 },
};

const RANGE = { startDate: "2026-08-16", endDate: "2026-09-15" };

/** An API that knows one project and one prompt, recording the paths it is asked for. */
function liveClient() {
  const requested: string[] = [];
  const fetch: FetchLike = async (url) => {
    const { pathname, search } = new URL(url);
    requested.push(pathname + search);

    const body =
      pathname === "/v1/projects"
        ? { data: [LIVE_PROJECT] }
        : pathname === `/v1/projects/${LIVE_PROJECT.id}`
          ? LIVE_PROJECT
          : pathname.endsWith("/categories")
            ? { data: [{ id: "c1", name: "Pricing", parentId: null, source: "manual" }] }
            : pathname.endsWith("/prompt-suggestions")
              ? { data: [] }
              : pathname.endsWith("/prompt-groups")
                ? { data: [LIVE_GROUP], nextCursor: null }
                : pathname.endsWith("/prompts")
                  ? { data: [LIVE_PROMPT], nextCursor: "next" }
                  : pathname.endsWith(`/prompts/${LIVE_PROMPT.id}`)
                    ? { ...LIVE_PROMPT, byModel: [{ model: "gpt", metrics: { visibility: 100, averagePosition: 2 } }] }
                    : undefined;

    return body === undefined
      ? new Response(JSON.stringify({ error: { code: "not_found", message: "No endpoint matches this path." } }), {
          status: 404,
        })
      : new Response(JSON.stringify(body), { status: 200 });
  };

  const api = new PromptEyeApi({ token: "pe_live_test", baseUrl: "https://example.convex.site", fetch });
  return { client: createLiveClient(api, createFixturesClient()), requested };
}

describe("createLiveClient", () => {
  it("serves what the API has from the API", async () => {
    const { client, requested } = liveClient();

    await expect(client.listProjects()).resolves.toEqual({ data: [LIVE_PROJECT] });
    await expect(client.getProject(LIVE_PROJECT.id)).resolves.toEqual(LIVE_PROJECT);
    await client.listCategories(LIVE_PROJECT.id);
    await client.listPromptSuggestions(LIVE_PROJECT.id, { groupId: "g1" });

    expect(requested).toEqual([
      "/v1/projects",
      `/v1/projects/${LIVE_PROJECT.id}`,
      `/v1/projects/${LIVE_PROJECT.id}/categories`,
      `/v1/projects/${LIVE_PROJECT.id}/prompt-suggestions?groupId=g1`,
    ]);
  });

  it("passes the period and filters of a prompt listing to the API", async () => {
    const { client, requested } = liveClient();

    const page = await client.listPrompts(LIVE_PROJECT.id, { ...RANGE, groupId: "g1", limit: 10 });

    expect(page).toEqual({ data: [LIVE_PROMPT], nextCursor: "next" });
    expect(requested[0]).toBe(
      `/v1/projects/${LIVE_PROJECT.id}/prompts?startDate=2026-08-16&endDate=2026-09-15&groupId=g1&limit=10`
    );
  });

  it("reads one prompt with its per-assistant breakdown", async () => {
    const { client, requested } = liveClient();

    const prompt = await client.getPrompt(LIVE_PROJECT.id, LIVE_PROMPT.id, RANGE);

    expect(prompt.byModel).toEqual([{ model: "gpt", metrics: { visibility: 100, averagePosition: 2 } }]);
    expect(requested[0]).toBe(
      `/v1/projects/${LIVE_PROJECT.id}/prompts/${LIVE_PROMPT.id}?startDate=2026-08-16&endDate=2026-09-15`
    );
  });

  it("lists prompt groups for the period", async () => {
    const { client, requested } = liveClient();

    await expect(client.listPromptGroups(LIVE_PROJECT.id, RANGE)).resolves.toEqual({
      data: [LIVE_GROUP],
      nextCursor: null,
    });
    expect(requested[0]).toBe(
      `/v1/projects/${LIVE_PROJECT.id}/prompt-groups?startDate=2026-08-16&endDate=2026-09-15`
    );
  });

  it("serves the rest from sample data, for a real project id, without calling the API", async () => {
    const { client, requested } = liveClient();

    const summary = await client.getVisibilitySummary(LIVE_PROJECT.id, RANGE);
    const competitors = await client.listCompetitors(LIVE_PROJECT.id, RANGE);
    const quality = await client.getCitationQuality(LIVE_PROJECT.id);

    expect(summary.totals.visibility).not.toBeNull();
    expect(competitors.data.length).toBeGreaterThan(0);
    expect(quality.role.distribution.length).toBeGreaterThan(0);
    expect(requested).toEqual([]);
  });

  it("lets the session select the only project the key reaches", async () => {
    const { client } = liveClient();

    await expect(new ProjectSession(client).require()).resolves.toEqual(LIVE_PROJECT);
  });
});
