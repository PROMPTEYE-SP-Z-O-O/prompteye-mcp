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
  organisationId: "o1live",
  organisationName: "Acme GmbH",
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

const LIVE_CITED_PAGE = {
  url: "https://acme.example/blog/pricing-guide",
  domain: "acme.example",
  citations: 4,
  share: 9,
  ownDomain: true,
};

const LIVE_CONTENT_BRIEF = {
  id: "cb1-ready",
  status: "ready",
  projectId: LIVE_PROJECT.id,
  trackerId: null,
  prompt: "best crm for agencies",
  error: null,
  title: "Best CRM for Agencies in 2026",
  originalTitle: null,
  titleChangeAnnotation: null,
  fanoutSource: "nodeshub",
  fanoutError: null,
  fanoutVariants: [{ keyword: "crm pricing", type: "comparison", confidence: 0.82 }],
  phrasesForArticle: [{ keyword: "crm pricing", type: "comparison", confidence: 0.82 }],
  separateArticles: [],
  outline: [
    {
      level: "H2",
      text: "What does a CRM cost?",
      annotation: "Cover the free tier.",
      sourcePhrases: ["crm pricing"],
      includesBrand: false,
      faqQuestions: null,
      origin: null,
      originalHeading: null,
      originalHasDirectAnswer: null,
    },
  ],
  sourceTextMatchPercentage: null,
  requestedAt: "2026-09-28T09:24:11.000Z",
  readyAt: "2026-09-28T09:26:48.000Z",
};

const LIVE_CONTENT_BRIEF_CREATED = {
  ...LIVE_CONTENT_BRIEF,
  id: "cb2-processing",
  status: "processing",
  title: null,
  fanoutSource: null,
  fanoutVariants: null,
  phrasesForArticle: null,
  separateArticles: null,
  outline: null,
  readyAt: null,
};

const LIVE_COMPETITOR = {
  brand: "Rival",
  ownBrand: false,
  metrics: { visibility: 48.1, reachIndex: 45, averagePosition: 3.1 },
  change: null,
  shareOfVoice: 18,
  citations: 31,
  citationShare: 10,
};

const LIVE_GOOGLE_STATUS = {
  searchConsole: {
    connected: true,
    siteUrl: "sc-domain:acme.example",
    permissionLevel: "siteOwner",
    sync: { lastSyncedAt: "2026-09-20T04:12:31.000Z", failedSince: null, error: null },
  },
  analytics: { connected: false, propertyId: null, propertyName: null, accountName: null, sync: null },
};

const LIVE_SEARCH = {
  clicks: 320,
  impressions: 8400,
  ctr: 0.0381,
  position: 8.4,
  timeline: [{ date: "2026-09-19", clicks: 11, impressions: 290 }],
};

const LIVE_SEARCH_QUERY = {
  query: "best crm for agencies",
  clicks: 42,
  impressions: 910,
  ctr: 0.0462,
  position: 6.1,
};

const LIVE_SEARCH_PAGE = {
  page: "https://acme.example/pricing",
  clicks: 31,
  impressions: 960,
  ctr: 0.0323,
  position: 5.4,
};

const LIVE_ANALYTICS = {
  sessions: 120,
  engagedSessions: 84,
  engagementRate: 0.7,
  averageSessionDuration: 96.4,
  keyEvents: 9,
};

const LIVE_ANALYTICS_SOURCE = { source: "chatgpt.com", sessions: 78, keyEvents: 6 };
const LIVE_ANALYTICS_PAGE = { page: "/pricing", sessions: 22, keyEvents: 3 };

const LIVE_CATEGORY_CREATED = { id: "c2", name: "Pricing tiers", parentId: "c1", source: "manual" };

const LIVE_ACCEPTED_SUGGESTION = { trackerId: "m1" };

const LIVE_GROUP_SETTINGS = { id: "g2", name: "Problem queries", order: 2, promptCount: 0, aiTrafficTotal: 0 };

const LIVE_BRAND_ANALYSIS_RUN = {
  id: "r1",
  projectId: LIVE_PROJECT.id,
  status: "ready",
  createdAt: "2026-09-28T09:24:11.000Z",
  updatedAt: "2026-09-28T09:26:48.000Z",
  activePromptCount: 12,
  usedResultCount: 10,
  maxContextGaps: 5,
  gaps: [],
  sentiment: null,
  totalCost: 0.04,
  error: null,
};

const LIVE_BRAND_ANALYSIS_AVAILABILITY = {
  canRun: true,
  reason: "ready",
  activePromptCount: 12,
  usedResultCount: 10,
  latestTrackScoreResultTimestamp: "2026-09-28T09:00:00.000Z",
};

const LIVE_SUGGESTION_RUN = { runId: "u1", skipped: null };

const LIVE_SUGGESTION_AVAILABILITY = {
  canRun: true,
  reason: "ready",
  pendingSuggestionCount: 0,
  availableSlots: 5,
  lastRun: null,
};

const LIVE_AUDIT = {
  id: "a1",
  projectId: LIVE_PROJECT.id,
  status: "pending",
  startDate: "2026-09-28T09:24:11.000Z",
  endDate: null,
  duration: null,
  numberOfUrls: 1,
  results: [
    { url: "https://acme.example/pricing", status: "pending", error: null, totalCost: null, analysis: null },
  ],
};

const LIVE_AUDIT_USAGE = { limit: 100, used: 12, remaining: 88 };

const LIVE_TOPICAL_MAP = {
  id: "m1",
  projectId: LIVE_PROJECT.id,
  topic: "cloud backup for small teams",
  language: "en",
  status: "ready",
  createdAt: "2026-09-28T09:24:11.000Z",
  generationCost: 0.03,
  pillar: { title: "The Complete Guide to Cloud Backup", description: "…" },
  clusters: [{ id: "cl1", title: "How much does cloud backup cost?", category: "Pricing", intent: "Informational" }],
  errorMessage: null,
};

/**
 * The Google endpoints, matched on the segment after `/google/` and tried
 * before the rest: `/traffic/google/analytics/sources` ends exactly like `/sources`.
 */
function googleBody(pathname: string): unknown {
  const endpoint = pathname.split("/google/")[1];
  if (endpoint === undefined) return undefined;

  return {
    status: LIVE_GOOGLE_STATUS,
    search: LIVE_SEARCH,
    "search/queries": { data: [LIVE_SEARCH_QUERY], nextCursor: null },
    "search/pages": { data: [LIVE_SEARCH_PAGE], nextCursor: null },
    analytics: LIVE_ANALYTICS,
    "analytics/sources": { data: [LIVE_ANALYTICS_SOURCE], nextCursor: null },
    "analytics/pages": { data: [LIVE_ANALYTICS_PAGE], nextCursor: null },
  }[endpoint];
}

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
      if (pathname === `/v1/projects/${LIVE_PROJECT.id}/prompt-suggestions/s1/accept`) {
        return new Response(JSON.stringify(LIVE_ACCEPTED_SUGGESTION), { status: 200 });
      }
      if (pathname === `/v1/projects/${LIVE_PROJECT.id}/maps/${LIVE_TOPICAL_MAP.id}/regenerate`) {
        return new Response(JSON.stringify(LIVE_TOPICAL_MAP), { status: 200 });
      }
      if (pathname === `/v1/projects/${LIVE_PROJECT.id}/prompt-groups/${LIVE_GROUP_SETTINGS.id}/suggestions/generate`) {
        return new Response(JSON.stringify(LIVE_SUGGESTION_RUN), { status: 201 });
      }

      const created =
        pathname === "/v1/projects"
          ? LIVE_PROJECT
          : pathname === "/v1/content/briefs"
            ? LIVE_CONTENT_BRIEF_CREATED
            : pathname === `/v1/projects/${LIVE_PROJECT.id}/categories`
              ? LIVE_CATEGORY_CREATED
              : pathname === `/v1/projects/${LIVE_PROJECT.id}/prompt-groups`
                ? LIVE_GROUP_SETTINGS
                : pathname === `/v1/projects/${LIVE_PROJECT.id}/analysis/runs`
                  ? LIVE_BRAND_ANALYSIS_RUN
                  : pathname === "/v1/audits"
                    ? LIVE_AUDIT
                    : pathname === `/v1/projects/${LIVE_PROJECT.id}/maps`
                      ? LIVE_TOPICAL_MAP
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
              : pathname === `/v1/projects/${LIVE_PROJECT.id}/prompt-groups/${LIVE_GROUP_SETTINGS.id}`
                ? { ...LIVE_GROUP_SETTINGS, name: "Comparison queries" }
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
      googleBody(pathname) ??
      (pathname === "/v1/projects"
        ? { data: [LIVE_PROJECT] }
        : pathname === `/v1/projects/${LIVE_PROJECT.id}`
          ? LIVE_PROJECT
          : pathname === `/v1/content/briefs/${LIVE_CONTENT_BRIEF.id}`
            ? LIVE_CONTENT_BRIEF
            : pathname === `/v1/projects/${LIVE_PROJECT.id}/analysis/availability`
              ? LIVE_BRAND_ANALYSIS_AVAILABILITY
              : pathname === `/v1/projects/${LIVE_PROJECT.id}/analysis/runs/${LIVE_BRAND_ANALYSIS_RUN.id}`
                ? LIVE_BRAND_ANALYSIS_RUN
                : pathname === `/v1/projects/${LIVE_PROJECT.id}/prompt-groups/${LIVE_GROUP_SETTINGS.id}/suggestions/availability`
                  ? LIVE_SUGGESTION_AVAILABILITY
                  : pathname === `/v1/audits/${LIVE_AUDIT.id}`
                  ? LIVE_AUDIT
                  : pathname === "/v1/audits/usage"
                    ? LIVE_AUDIT_USAGE
                    : pathname === `/v1/projects/${LIVE_PROJECT.id}/maps`
                      ? { data: [LIVE_TOPICAL_MAP] }
                      : pathname === `/v1/projects/${LIVE_PROJECT.id}/maps/${LIVE_TOPICAL_MAP.id}`
                        ? LIVE_TOPICAL_MAP
                        : pathname.endsWith("/knowledge-base")
            ? { text: "KB text", updatedAt: null }
            : pathname.endsWith("/categories")
            ? { data: [{ id: "c1", name: "Pricing", parentId: null, source: "manual" }] }
            : pathname.endsWith("/prompt-suggestions")
              ? { data: [] }
              : pathname.endsWith("/prompt-groups")
                ? { data: [LIVE_GROUP], nextCursor: null }
                : pathname.endsWith("/sources/pages")
                  ? { data: [LIVE_CITED_PAGE], nextCursor: null }
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
                        : undefined);

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

  it("reads Google's own figures for the project's site", async () => {
    const { client, calls } = liveClient();

    await expect(client.getGoogleStatus(LIVE_PROJECT.id)).resolves.toEqual(LIVE_GOOGLE_STATUS);
    await expect(client.getSearchSummary(LIVE_PROJECT.id, RANGE)).resolves.toEqual(LIVE_SEARCH);
    await expect(
      client.getAiTrafficSummary(LIVE_PROJECT.id, { ...RANGE, assistant: "openai" })
    ).resolves.toEqual(LIVE_ANALYTICS);

    expect(calls.map((call) => call.path)).toEqual([
      `/v1/projects/${LIVE_PROJECT.id}/traffic/google/status`,
      `/v1/projects/${LIVE_PROJECT.id}/traffic/google/search?startDate=2026-08-16&endDate=2026-09-15`,
      `/v1/projects/${LIVE_PROJECT.id}/traffic/google/analytics?startDate=2026-08-16&endDate=2026-09-15&assistant=openai`,
    ]);
  });

  it("ranks Search Console rows and the AI sessions apart", async () => {
    const { client, calls } = liveClient();

    await expect(client.listSearchQueries(LIVE_PROJECT.id, { ...RANGE, limit: 5 })).resolves.toEqual({
      data: [LIVE_SEARCH_QUERY],
      nextCursor: null,
    });
    await expect(client.listSearchPages(LIVE_PROJECT.id, RANGE)).resolves.toEqual({
      data: [LIVE_SEARCH_PAGE],
      nextCursor: null,
    });
    await expect(
      client.listAiTrafficSources(LIVE_PROJECT.id, { ...RANGE, assistant: "anthropic", limit: 5 })
    ).resolves.toEqual({ data: [LIVE_ANALYTICS_SOURCE], nextCursor: null });
    await expect(client.listAiTrafficPages(LIVE_PROJECT.id, RANGE)).resolves.toEqual({
      data: [LIVE_ANALYTICS_PAGE],
      nextCursor: null,
    });

    expect(calls.map((call) => call.path)).toEqual([
      `/v1/projects/${LIVE_PROJECT.id}/traffic/google/search/queries?startDate=2026-08-16&endDate=2026-09-15&limit=5`,
      `/v1/projects/${LIVE_PROJECT.id}/traffic/google/search/pages?startDate=2026-08-16&endDate=2026-09-15`,
      `/v1/projects/${LIVE_PROJECT.id}/traffic/google/analytics/sources?startDate=2026-08-16&endDate=2026-09-15&assistant=anthropic&limit=5`,
      `/v1/projects/${LIVE_PROJECT.id}/traffic/google/analytics/pages?startDate=2026-08-16&endDate=2026-09-15`,
    ]);
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

  it("ranks cited pages, narrowed to one assistant", async () => {
    const { client, calls } = liveClient();

    await expect(client.listSourcePages(LIVE_PROJECT.id, { ...RANGE, model: "gpt", limit: 5 })).resolves.toEqual({
      data: [LIVE_CITED_PAGE],
      nextCursor: null,
    });
    expect(calls[0].path).toBe(
      `/v1/projects/${LIVE_PROJECT.id}/sources/pages?startDate=2026-08-16&endDate=2026-09-15&model=gpt&limit=5`
    );
  });

  it("starts a fresh content brief", async () => {
    const { client, calls } = liveClient();

    await expect(
      client.createContentBrief({ projectId: LIVE_PROJECT.id, prompt: "best crm for agencies" })
    ).resolves.toEqual(LIVE_CONTENT_BRIEF_CREATED);

    expect(calls[0]).toEqual({
      path: "/v1/content/briefs",
      method: "POST",
      body: { projectId: LIVE_PROJECT.id, prompt: "best crm for agencies" },
    });
  });

  it("reads one content brief in full", async () => {
    const { client, calls } = liveClient();

    await expect(client.getContentBrief(LIVE_CONTENT_BRIEF.id)).resolves.toEqual(LIVE_CONTENT_BRIEF);
    expect(calls[0]).toEqual({
      path: `/v1/content/briefs/${LIVE_CONTENT_BRIEF.id}`,
      method: "GET",
      body: undefined,
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

  it("creates a category", async () => {
    const { client, calls } = liveClient();

    await expect(
      client.createCategory(LIVE_PROJECT.id, { name: "Pricing tiers", parentCategoryId: "c1" })
    ).resolves.toEqual(LIVE_CATEGORY_CREATED);
    expect(calls[0]).toEqual({
      path: `/v1/projects/${LIVE_PROJECT.id}/categories`,
      method: "POST",
      body: { name: "Pricing tiers", parentCategoryId: "c1" },
    });
  });

  it("accepts a prompt suggestion", async () => {
    const { client, calls } = liveClient();

    await expect(
      client.acceptPromptSuggestion(LIVE_PROJECT.id, "s1", { promptText: "best crm" })
    ).resolves.toEqual(LIVE_ACCEPTED_SUGGESTION);
    expect(calls[0]).toEqual({
      path: `/v1/projects/${LIVE_PROJECT.id}/prompt-suggestions/s1/accept`,
      method: "POST",
      body: { promptText: "best crm" },
    });
  });

  it("creates and renames a prompt group", async () => {
    const { client, calls } = liveClient();

    await expect(client.createPromptGroup(LIVE_PROJECT.id, { name: "Problem queries" })).resolves.toEqual(
      LIVE_GROUP_SETTINGS
    );
    expect(calls[0]).toEqual({
      path: `/v1/projects/${LIVE_PROJECT.id}/prompt-groups`,
      method: "POST",
      body: { name: "Problem queries" },
    });

    await expect(
      client.updatePromptGroup(LIVE_PROJECT.id, LIVE_GROUP_SETTINGS.id, { name: "Comparison queries" })
    ).resolves.toEqual({ ...LIVE_GROUP_SETTINGS, name: "Comparison queries" });
    expect(calls[1]).toEqual({
      path: `/v1/projects/${LIVE_PROJECT.id}/prompt-groups/${LIVE_GROUP_SETTINGS.id}`,
      method: "PATCH",
      body: { name: "Comparison queries" },
    });
  });

  it("generates suggestions for a group and checks whether one can run", async () => {
    const { client, calls } = liveClient();

    await expect(
      client.generateGroupSuggestions(LIVE_PROJECT.id, LIVE_GROUP_SETTINGS.id)
    ).resolves.toEqual(LIVE_SUGGESTION_RUN);
    await expect(
      client.getPromptSuggestionAvailability(LIVE_PROJECT.id, LIVE_GROUP_SETTINGS.id)
    ).resolves.toEqual(LIVE_SUGGESTION_AVAILABILITY);

    expect(calls.map((call) => call.path)).toEqual([
      `/v1/projects/${LIVE_PROJECT.id}/prompt-groups/${LIVE_GROUP_SETTINGS.id}/suggestions/generate`,
      `/v1/projects/${LIVE_PROJECT.id}/prompt-groups/${LIVE_GROUP_SETTINGS.id}/suggestions/availability`,
    ]);
    expect(calls[0].body).toBeUndefined();
  });

  it("starts, checks and reads a brand analysis run", async () => {
    const { client, calls } = liveClient();

    await expect(client.startBrandAnalysisRun(LIVE_PROJECT.id)).resolves.toEqual(LIVE_BRAND_ANALYSIS_RUN);
    await expect(client.getBrandAnalysisAvailability(LIVE_PROJECT.id)).resolves.toEqual(
      LIVE_BRAND_ANALYSIS_AVAILABILITY
    );
    await expect(client.getBrandAnalysisRun(LIVE_PROJECT.id, LIVE_BRAND_ANALYSIS_RUN.id)).resolves.toEqual(
      LIVE_BRAND_ANALYSIS_RUN
    );

    expect(calls.map((call) => call.path)).toEqual([
      `/v1/projects/${LIVE_PROJECT.id}/analysis/runs`,
      `/v1/projects/${LIVE_PROJECT.id}/analysis/availability`,
      `/v1/projects/${LIVE_PROJECT.id}/analysis/runs/${LIVE_BRAND_ANALYSIS_RUN.id}`,
    ]);
    expect(calls[0].body).toBeUndefined();
  });

  it("creates, reads and checks the usage of a WWW audit", async () => {
    const { client, calls } = liveClient();

    await expect(client.createAudit({ urls: ["https://acme.example/pricing"], projectId: LIVE_PROJECT.id })).resolves.toEqual(
      LIVE_AUDIT
    );
    await expect(client.getAudit(LIVE_AUDIT.id)).resolves.toEqual(LIVE_AUDIT);
    await expect(client.getAuditUsage({ projectId: LIVE_PROJECT.id })).resolves.toEqual(LIVE_AUDIT_USAGE);

    expect(calls.map((call) => call.path)).toEqual([
      "/v1/audits",
      `/v1/audits/${LIVE_AUDIT.id}`,
      `/v1/audits/usage?projectId=${LIVE_PROJECT.id}`,
    ]);
  });

  it("creates, lists, reads and regenerates a topical map", async () => {
    const { client, calls } = liveClient();

    await expect(
      client.createTopicalMap(LIVE_PROJECT.id, { topic: LIVE_TOPICAL_MAP.topic, language: "en" })
    ).resolves.toEqual(LIVE_TOPICAL_MAP);
    const { id, projectId, topic, language, status, createdAt, generationCost } = LIVE_TOPICAL_MAP;
    await expect(client.listTopicalMaps(LIVE_PROJECT.id)).resolves.toEqual({
      data: [{ id, projectId, topic, language, status, createdAt, generationCost }],
    });
    await expect(client.getTopicalMap(LIVE_PROJECT.id, LIVE_TOPICAL_MAP.id)).resolves.toEqual(LIVE_TOPICAL_MAP);
    await expect(
      client.regenerateTopicalMapCluster(LIVE_PROJECT.id, LIVE_TOPICAL_MAP.id, { category: "Pricing" })
    ).resolves.toEqual(LIVE_TOPICAL_MAP);

    expect(calls.map((call) => call.path)).toEqual([
      `/v1/projects/${LIVE_PROJECT.id}/maps`,
      `/v1/projects/${LIVE_PROJECT.id}/maps`,
      `/v1/projects/${LIVE_PROJECT.id}/maps/${LIVE_TOPICAL_MAP.id}`,
      `/v1/projects/${LIVE_PROJECT.id}/maps/${LIVE_TOPICAL_MAP.id}/regenerate`,
    ]);
  });
});
