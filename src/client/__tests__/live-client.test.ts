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
  businessPriorityReason: null,
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

const LIVE_DOMAIN = { domain: "acme.example", citations: 18, share: 5, ownDomain: true };

const LIVE_COMPETITOR = {
  brand: "Rival",
  ownBrand: false,
  metrics: { visibility: 48.1, reachIndex: 45, averagePosition: 3.1 },
  change: null,
  shareOfVoice: 18,
  citations: 31,
  citationShare: 10,
};

const RANGE = { startDate: "2026-08-16", endDate: "2026-09-15" };

type Call = { path: string; method: string; body: unknown };

/** An API that knows one project and one prompt, recording what it is asked for. */
function liveClient() {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const { pathname, search } = new URL(url);
    calls.push({
      path: pathname + search,
      method: init.method ?? "GET",
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    });

    if (init.method === "POST") {
      const created =
        pathname === "/v1/projects"
          ? LIVE_PROJECT
          : { data: [{ id: "p2", prompt: "how much does acme cost", groupName: "Pricing" }] };
      return new Response(JSON.stringify(created), { status: 201 });
    }

    if (init.method === "PATCH") {
      const patched =
        pathname === `/v1/projects/${LIVE_PROJECT.id}`
          ? LIVE_PROJECT
          : pathname === `/v1/projects/${LIVE_PROJECT.id}/knowledge-base`
            ? { text: "KB text", updatedAt: null }
            : pathname === `/v1/projects/${LIVE_PROJECT.id}/prompts/${LIVE_PROMPT.id}`
              ? LIVE_PROMPT
              : undefined;
      return patched === undefined
        ? new Response(JSON.stringify({ error: { code: "not_found", message: "No endpoint matches this path." } }), {
            status: 404,
          })
        : new Response(JSON.stringify(patched), { status: 200 });
    }

    if (init.method === "PUT") {
      const putRes =
        pathname === `/v1/projects/${LIVE_PROJECT.id}/competitors/exclusions`
          ? { data: [{ name: "Rival Agency", aliases: [] }] }
          : undefined;
      return putRes === undefined
        ? new Response(JSON.stringify({ error: { code: "not_found", message: "No endpoint matches this path." } }), {
            status: 404,
          })
        : new Response(JSON.stringify(putRes), { status: 200 });
    }

    const body =
      pathname === "/v1/projects"
        ? { data: [LIVE_PROJECT] }
        : pathname === `/v1/projects/${LIVE_PROJECT.id}`
          ? LIVE_PROJECT
          : pathname.endsWith("/knowledge-base")
            ? { text: "KB text", updatedAt: null }
            : pathname.endsWith("/categories")
            ? { data: [{ id: "c1", name: "Pricing", parentId: null, source: "manual" }] }
            : pathname.endsWith("/prompt-suggestions")
              ? { data: [] }
              : pathname.endsWith("/prompt-groups")
                ? { data: [LIVE_GROUP], nextCursor: null }
                : pathname.endsWith("/sources")
                  ? { data: [LIVE_DOMAIN], nextCursor: null }
                  : pathname.endsWith("/competitors/exclusions")
                    ? { data: [{ name: "Rival Agency", aliases: [] }] }
                    : pathname.endsWith("/competitors")
                    ? { data: [LIVE_COMPETITOR], nextCursor: null }
                    : pathname.endsWith("/prompts")
                      ? { data: [LIVE_PROMPT], nextCursor: "next" }
                      : pathname.endsWith(`/prompts/${LIVE_PROMPT.id}`)
                        ? {
                            ...LIVE_PROMPT,
                            byModel: [{ model: "gpt", metrics: { visibility: 100, averagePosition: 2 } }],
                          }
                        : undefined;

    return body === undefined
      ? new Response(JSON.stringify({ error: { code: "not_found", message: "No endpoint matches this path." } }), {
          status: 404,
        })
      : new Response(JSON.stringify(body), { status: 200 });
  };

  const api = new PromptEyeApi({ token: "pe_live_test", baseUrl: "https://example.convex.site", fetch });
  return { client: createLiveClient(api, createFixturesClient()), calls };
}

describe("createLiveClient", () => {
  it("serves what the API has from the API", async () => {
    const { client, calls } = liveClient();

    await expect(client.listProjects()).resolves.toEqual({ data: [LIVE_PROJECT] });
    await expect(client.getProject(LIVE_PROJECT.id)).resolves.toEqual(LIVE_PROJECT);
    await client.listCategories(LIVE_PROJECT.id);
    await client.listPromptSuggestions(LIVE_PROJECT.id, { groupId: "g1" });

    expect(calls.map((call) => call.path)).toEqual([
      "/v1/projects",
      `/v1/projects/${LIVE_PROJECT.id}`,
      `/v1/projects/${LIVE_PROJECT.id}/categories`,
      `/v1/projects/${LIVE_PROJECT.id}/prompt-suggestions?groupId=g1`,
    ]);
  });

  it("passes the period and filters of a prompt listing to the API", async () => {
    const { client, calls } = liveClient();

    const page = await client.listPrompts(LIVE_PROJECT.id, { ...RANGE, groupId: "g1", limit: 10 });

    expect(page).toEqual({ data: [LIVE_PROMPT], nextCursor: "next" });
    expect(calls[0].path).toBe(
      `/v1/projects/${LIVE_PROJECT.id}/prompts?startDate=2026-08-16&endDate=2026-09-15&groupId=g1&limit=10`
    );
  });

  it("reads one prompt with its per-assistant breakdown", async () => {
    const { client, calls } = liveClient();

    const prompt = await client.getPrompt(LIVE_PROJECT.id, LIVE_PROMPT.id, RANGE);

    expect(prompt.byModel).toEqual([{ model: "gpt", metrics: { visibility: 100, averagePosition: 2 } }]);
    expect(calls[0].path).toBe(
      `/v1/projects/${LIVE_PROJECT.id}/prompts/${LIVE_PROMPT.id}?startDate=2026-08-16&endDate=2026-09-15`
    );
  });

  it("lists prompt groups for the period", async () => {
    const { client, calls } = liveClient();

    await expect(client.listPromptGroups(LIVE_PROJECT.id, RANGE)).resolves.toEqual({
      data: [LIVE_GROUP],
      nextCursor: null,
    });
    expect(calls[0].path).toBe(`/v1/projects/${LIVE_PROJECT.id}/prompt-groups?startDate=2026-08-16&endDate=2026-09-15`);
  });

  it("ranks cited domains, narrowed to one assistant", async () => {
    const { client, calls } = liveClient();

    await expect(client.listSources(LIVE_PROJECT.id, { ...RANGE, model: "gpt", limit: 5 })).resolves.toEqual({
      data: [LIVE_DOMAIN],
      nextCursor: null,
    });
    expect(calls[0].path).toBe(
      `/v1/projects/${LIVE_PROJECT.id}/sources?startDate=2026-08-16&endDate=2026-09-15&model=gpt&limit=5`
    );
  });

  it("ranks competitors for the period", async () => {
    const { client, calls } = liveClient();

    const page = await client.listCompetitors(LIVE_PROJECT.id, { ...RANGE, limit: 20 });

    expect(page.data[0].shareOfVoice).toBe(18);
    expect(calls[0].path).toBe(
      `/v1/projects/${LIVE_PROJECT.id}/competitors?startDate=2026-08-16&endDate=2026-09-15&limit=20`
    );
  });

  it("posts a new project", async () => {
    const { client, calls } = liveClient();

    await expect(client.createProject({ brand: "Acme", domain: "acme.example", country: "DE" })).resolves.toEqual(
      LIVE_PROJECT
    );

    expect(calls[0]).toEqual({
      path: "/v1/projects",
      method: "POST",
      body: { brand: "Acme", domain: "acme.example", country: "DE" },
    });
  });

  it("posts hand-written prompts in one call", async () => {
    const { client, calls } = liveClient();

    const added = await client.addPrompts(LIVE_PROJECT.id, [
      { prompt: "how much does acme cost", groupName: "Pricing" },
    ]);

    expect(added.data[0].groupName).toBe("Pricing");
    expect(calls[0]).toEqual({
      path: `/v1/projects/${LIVE_PROJECT.id}/prompts`,
      method: "POST",
      body: { prompts: [{ prompt: "how much does acme cost", groupName: "Pricing" }] },
    });
  });

  it("serves what has no endpoint from sample data, without calling the API", async () => {
    const { client, calls } = liveClient();

    const summary = await client.getVisibilitySummary(LIVE_PROJECT.id, RANGE);
    const answers = await client.listAnswers(LIVE_PROJECT.id, RANGE);
    const quality = await client.getCitationQuality(LIVE_PROJECT.id);

    expect(summary.totals.visibility).not.toBeNull();
    expect(answers.data.length).toBeGreaterThan(0);
    expect(quality.role.distribution.length).toBeGreaterThan(0);
    expect(calls).toEqual([]);
  });

  it("lets the session select the only project the key reaches", async () => {
    const { client } = liveClient();

    await expect(new ProjectSession(client).require()).resolves.toEqual(LIVE_PROJECT);
  });

  it("updates a project via PATCH", async () => {
    const { client, calls } = liveClient();

    await expect(client.updateProject(LIVE_PROJECT.id, { name: "New Name" })).resolves.toEqual(LIVE_PROJECT);
    expect(calls[0]).toEqual({
      path: `/v1/projects/${LIVE_PROJECT.id}`,
      method: "PATCH",
      body: { name: "New Name" },
    });
  });

  it("updates knowledge base via PATCH", async () => {
    const { client, calls } = liveClient();

    await expect(client.updateKnowledgeBase(LIVE_PROJECT.id, { industry: "SaaS" })).resolves.toEqual({
      text: "KB text",
      updatedAt: null,
    });
    expect(calls[0]).toEqual({
      path: `/v1/projects/${LIVE_PROJECT.id}/knowledge-base`,
      method: "PATCH",
      body: { industry: "SaaS" },
    });
  });

  it("updates a prompt via PATCH", async () => {
    const { client, calls } = liveClient();
    const settings = { ...LIVE_PROMPT } as Record<string, unknown>;
    delete settings.metrics;
    delete settings.change;

    await expect(client.updatePrompt(LIVE_PROJECT.id, LIVE_PROMPT.id, { status: "paused" })).resolves.toEqual(
      settings
    );
    expect(calls[0]).toEqual({
      path: `/v1/projects/${LIVE_PROJECT.id}/prompts/${LIVE_PROMPT.id}`,
      method: "PATCH",
      body: { status: "paused" },
    });
  });

  it("lists and replaces competitor exclusions", async () => {
    const { client, calls } = liveClient();

    await expect(client.listCompetitorExclusions(LIVE_PROJECT.id)).resolves.toEqual({
      data: [{ name: "Rival Agency", aliases: [] }],
    });
    expect(calls[0]).toEqual({
      path: `/v1/projects/${LIVE_PROJECT.id}/competitors/exclusions`,
      method: "GET",
      body: undefined,
    });

    await expect(
      client.replaceCompetitorExclusions(LIVE_PROJECT.id, [{ name: "Rival Agency", aliases: [] }])
    ).resolves.toEqual({
      data: [{ name: "Rival Agency", aliases: [] }],
    });
    expect(calls[1]).toEqual({
      path: `/v1/projects/${LIVE_PROJECT.id}/competitors/exclusions`,
      method: "PUT",
      body: { exclusions: [{ name: "Rival Agency", aliases: [] }] },
    });
  });
});
