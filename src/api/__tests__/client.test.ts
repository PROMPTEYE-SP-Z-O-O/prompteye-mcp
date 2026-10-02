import { ZodError } from "zod";
import { PromptEyeApi } from "../client.js";
import { PromptEyeApiError } from "../errors.js";
import type { FetchLike } from "../http.js";

const TOKEN = "pe_live_test_token";
const BASE_URL = "https://example.convex.site";

/** A fetch that answers with `response` and records what it was asked for. */
function stubFetch(response: Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return response;
  };
  return { api: new PromptEyeApi({ token: TOKEN, baseUrl: BASE_URL, fetch }), calls };
}

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status });

const account = {
  id: "k17f4b2c9d8e6a5b3c1d0e9f",
  email: "anna@prompteye.com",
  plan: { key: "3", name: "Pro" },
  addons: ["claude"],
  scopes: ["api_access"],
  promptCount: 128,
  promptLimit: 200,
  models: ["gpt", "perplexity", "claude"],
  scanFrequency: "daily",
  nextScanAt: "2026-09-21T02:00:00.000Z",
};

describe("PromptEyeApi", () => {
  it("requires a token and a base URL", () => {
    expect(() => new PromptEyeApi({ token: " ", baseUrl: BASE_URL })).toThrow(TypeError);
    expect(() => new PromptEyeApi({ token: TOKEN, baseUrl: " " })).toThrow(TypeError);
  });

  it("sends the token as a Bearer credential", async () => {
    const { api, calls } = stubFetch(json(200, account));

    await expect(api.account.get()).resolves.toEqual(account);

    expect(calls[0].url).toBe(`${BASE_URL}/v1/me`);
    expect(calls[0].init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it("builds project paths and the group filter", async () => {
    const { api, calls } = stubFetch(json(200, { data: [] }));

    await api.promptSuggestions.list("a/b", { groupId: "g 1" });

    expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/a%2Fb/prompt-suggestions?groupId=g+1`);
  });

  it("drops unknown fields and accepts enumeration values added later", async () => {
    const { api } = stubFetch(json(200, { ...account, addons: ["gemini"], addedLater: true }));

    const result = await api.account.get();

    expect(result.addons).toEqual(["gemini"]);
    expect(result).not.toHaveProperty("addedLater");
  });

  it("rejects a response of the wrong shape", async () => {
    const { api } = stubFetch(json(200, { ...account, promptCount: "many" }));

    await expect(api.account.get()).rejects.toBeInstanceOf(ZodError);
  });

  it("throws the error body with a human message", async () => {
    const body = { error: { code: "not_found", message: "No project with this identifier exists." } };
    const { api } = stubFetch(json(404, body));

    const error = await api.projects.get("missing").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PromptEyeApiError);
    expect(error).toMatchObject({
      status: 404,
      code: "not_found",
      body,
      message: "The resource does not exist, or the API key does not reach it.",
    });
  });

  it("reads a bare error code", async () => {
    const { api } = stubFetch(json(401, { error: "UNAUTHORIZED" }));

    await expect(api.account.get()).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
      message: "The API key is missing, malformed or revoked.",
    });
  });

  it("throws on a non-JSON failure too", async () => {
    const { api } = stubFetch(new Response("<html>Bad gateway</html>", { status: 502 }));

    await expect(api.account.get()).rejects.toMatchObject({ status: 502, code: undefined, body: undefined });
  });

  it("creates a project in a given workspace", async () => {
    const project = {
      id: "p2",
      name: "Fresh Co",
      brand: "Fresh Co",
      domain: "freshco.com",
      country: "PL",
      label: null,
      alternativeBrandNames: [],
      alternativeDomains: [],
      excludedCompetitors: [],
      accessRole: "OWNER",
      organisationId: "o2",
      organisationName: "Agency",
      createdAt: "2026-09-10T09:24:11.000Z",
    };
    const { api, calls } = stubFetch(json(201, project));

    const result = await api.projects.create({
      brand: "Fresh Co",
      domain: "freshco.com",
      country: "PL",
      organisationId: "o2",
    });

    expect(result).toEqual(project);
    expect(calls[0].url).toBe(`${BASE_URL}/v1/projects`);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      brand: "Fresh Co",
      domain: "freshco.com",
      country: "PL",
      organisationId: "o2",
    });
  });

  it("patches a project and returns updated project", async () => {
    const project = {
      id: "p1",
      name: "Acme",
      brand: "Acme",
      domain: "acme.com",
      country: "PL",
      label: null,
      alternativeBrandNames: ["Acme Corp"],
      alternativeDomains: ["acme.io"],
      excludedCompetitors: [],
      accessRole: "OWNER",
      organisationId: "o1",
      organisationName: "Acme Agency",
      createdAt: "2026-09-10T09:24:11.000Z",
    };
    const { api, calls } = stubFetch(json(200, project));

    const result = await api.projects.update("p1", { name: "Acme New" });

    expect(result).toEqual(project);
    expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1`);
    expect(calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: "Acme New" });
  });

  it("patches knowledge base and returns updated knowledge base", async () => {
    const kb = {
      text: "Industry: Tech",
      profile: {
        industry: "Tech",
        productCategory: null,
        targetAudience: null,
        icp: null,
        operatingArea: null,
        description: null,
      },
      updatedAt: "2026-09-10T09:24:11.000Z",
    };
    const { api, calls } = stubFetch(json(200, kb));

    const result = await api.knowledgeBase.update("p1", { industry: "Tech" });

    expect(result).toEqual(kb);
    expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/knowledge-base`);
    expect(calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ industry: "Tech" });
  });

  it("patches a prompt and returns settings", async () => {
    const settings = {
      id: "prompt1",
      prompt: "test prompt",
      keyword: "",
      status: "paused",
      categories: [],
      subcategories: [],
      groupId: null,
      createdAt: "2026-09-10T09:24:11.000Z",
      aiTraffic: null,
      businessPriority: "high",
      businessPriorityReason: "Important",
    };
    const { api, calls } = stubFetch(json(200, settings));

    const result = await api.prompts.update("p1", "prompt1", { status: "paused" });

    expect(result).toEqual(settings);
    expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/prompts/prompt1`);
    expect(calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ status: "paused" });
  });

  it("gets competitor exclusions", async () => {
    const exclusions = [{ name: "Competitor A", aliases: ["CompA"] }];
    const { api, calls } = stubFetch(json(200, { data: exclusions }));

    const list = await api.competitors.listExclusions("p1");
    expect(list).toEqual({ data: exclusions });
    expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/competitors/exclusions`);
    expect(calls[0].init.method).toBe("GET");
  });

  it("replaces competitor exclusions via PUT", async () => {
    const exclusions = [{ name: "Competitor A", aliases: ["CompA"] }];
    const { api, calls } = stubFetch(json(200, { data: exclusions }));

    const result = await api.competitors.replaceExclusions("p1", exclusions);
    expect(result).toEqual({ data: exclusions });
    expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/competitors/exclusions`);
    expect(calls[0].init.method).toBe("PUT");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ exclusions });
  });

  describe("public reports", () => {
    const report = {
      id: "r1",
      brand: "Acme",
      domain: "acme.example",
      email: "lead@acme.example",
      status: "processing",
      score: null,
      reach: "national",
      country: "PL",
      language: "pl",
      utm: null,
      leadStatus: "new",
      projectId: null,
      contactCount: 0,
      createdAt: "2026-09-20T09:00:00.000Z",
      readyAt: null,
      url: "https://reports.example/r1",
    };

    it("creates a report without sending the API key", async () => {
      const { api, calls } = stubFetch(json(201, report));

      const result = await api.reports.create({
        agencyId: "a1",
        brand: "Acme",
        email: "lead@acme.example",
        website: "acme.example",
      });

      expect(result).toEqual({ report, reused: false });
      expect(calls[0].url).toBe(`${BASE_URL}/v1/reports`);
      expect(calls[0].init.method).toBe("POST");
      // The endpoint is public: a key would be handed over for nothing.
      expect(calls[0].init.headers).not.toHaveProperty("Authorization");
      expect(JSON.parse(calls[0].init.body as string)).toEqual({
        agencyId: "a1",
        brand: "Acme",
        email: "lead@acme.example",
        website: "acme.example",
      });
    });

    it("reports a 200 as a report that was sent again rather than rebuilt", async () => {
      const { api } = stubFetch(json(200, { ...report, status: "ready", score: 42 }));

      const result = await api.reports.create({ agencyId: "a1", brand: "Acme", email: "lead@acme.example" });

      expect(result.reused).toBe(true);
      expect(result.report.score).toBe(42);
    });

    it("lists reports with the key and the page window", async () => {
      const { api, calls } = stubFetch(json(200, { data: [report], nextCursor: "50" }));

      const page = await api.reports.list({ limit: 50, cursor: "0" });

      expect(page).toEqual({ data: [report], nextCursor: "50" });
      expect(calls[0].url).toBe(`${BASE_URL}/v1/reports?limit=50&cursor=0`);
      expect(calls[0].init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
    });

    it("reads one report by id", async () => {
      const detail = {
        ...report,
        status: "ready",
        score: 42,
        industry: "SaaS",
        monthlySearches: 1900,
        prompts: ["best crm for agencies"],
        rankingPhrases: ["crm for agencies"],
        competitors: [{ name: "Rival", score: 61 }],
        models: [{ model: "gpt", score: 42, answers: 3, averagePosition: 2.5 }],
        examples: [
          {
            prompt: "best crm for agencies",
            response: "…",
            model: "gpt",
            sources: [{ url: "https://g2.com/x", title: null }],
          },
        ],
        contacts: [
          {
            type: "calendly",
            createdAt: "2026-09-20T10:00:00.000Z",
            email: null,
            phone: null,
            meetingAt: "2026-09-22T09:00:00.000Z",
            inviteeEmail: "lead@acme.example",
          },
        ],
      };
      const { api, calls } = stubFetch(json(200, detail));

      await expect(api.reports.get("r 1")).resolves.toEqual(detail);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/reports/r%201`);
    });
  });

  describe("traffic", () => {
    it("sends every bot filter the API takes", async () => {
      const { api, calls } = stubFetch(json(200, { data: [], nextCursor: null }));

      await api.traffic.events("p1", {
        startDate: "2026-08-16",
        endDate: "2026-09-15",
        kind: "ai",
        vendor: "OpenAI",
        botId: "chatgpt-user",
        status: "4xx",
        path: "/pricing",
        limit: 20,
        cursor: "50",
      });

      expect(calls[0].url).toBe(
        `${BASE_URL}/v1/projects/p1/traffic/events?startDate=2026-08-16&endDate=2026-09-15` +
          "&kind=ai&vendor=OpenAI&botId=chatgpt-user&status=4xx&path=%2Fpricing&limit=20&cursor=50"
      );
    });

    it("reads a count with its partial flag", async () => {
      const counts = {
        data: [
          {
            key: "chatgpt-user",
            label: "ChatGPT-User",
            count: 412,
            uniquePaths: 38,
            lastAt: "2026-09-20T14:03:12.000Z",
          },
        ],
        nextCursor: null,
        partial: true,
      };
      const { api, calls } = stubFetch(json(200, counts));

      await expect(api.traffic.countEvents("p1", { groupBy: "bot", kind: "ai" })).resolves.toEqual(counts);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/traffic/events/count?groupBy=bot&kind=ai`);
    });

    it("reads a sitemap that was never connected", async () => {
      const { api, calls } = stubFetch(json(200, { sitemap: null, data: [], nextCursor: null }));

      await expect(api.traffic.sitemap("p1", { active: "true" })).resolves.toEqual({
        sitemap: null,
        data: [],
        nextCursor: null,
      });
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/traffic/sitemap?active=true`);
    });

    it("reads the crawl rows of one path", async () => {
      const crawl = {
        path: "/pricing",
        botId: "googlebot",
        name: "Googlebot",
        vendor: "Google",
        botType: "search-engine",
        kind: "seo",
        firstVisitAt: "2026-07-02T03:11:09.000Z",
        lastVisitAt: "2026-09-20T02:40:51.000Z",
        visitCount: 27,
        lastStatusCode: 200,
      };
      const { api, calls } = stubFetch(json(200, { data: [crawl], nextCursor: null }));

      await expect(api.traffic.crawls("p1", { path: "/pricing" })).resolves.toEqual({
        data: [crawl],
        nextCursor: null,
      });
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/traffic/crawls?path=%2Fpricing`);
    });

    it("reads the health verdict for one kind", async () => {
      const health = {
        total: 8,
        success: 5,
        redirects: 1,
        clientErrors: 1,
        serverErrors: 1,
        unknown: 0,
        scanRequests: 0,
        averageResponseTimeMs: 210,
        assessments: [
          { key: "5xx", level: "critical", count: 1, rate: 0.125, averageResponseTimeMs: null },
          { key: "4xx", level: "warning", count: 1, rate: 0.125, averageResponseTimeMs: null },
          { key: "3xx", level: "ok", count: 1, rate: 0.125, averageResponseTimeMs: null },
          { key: "responseTime", level: "ok", count: null, rate: null, averageResponseTimeMs: 210 },
        ],
        issues: [
          {
            botId: "gptbot",
            botName: "GPTBot",
            path: "/old",
            statusCode: 500,
            redirectLocation: null,
            count: 1,
            lastSeenAt: "2026-09-20T14:03:12.000Z",
            averageResponseTimeMs: 900,
          },
        ],
      };
      const { api, calls } = stubFetch(json(200, health));

      await expect(
        api.traffic.crawlHealth("p1", { kind: "ai", vendor: "OpenAI", startDate: "2026-08-16", endDate: "2026-09-15" })
      ).resolves.toEqual(health);
      expect(calls[0].url).toBe(
        `${BASE_URL}/v1/projects/p1/traffic/health?kind=ai&vendor=OpenAI&startDate=2026-08-16&endDate=2026-09-15`
      );
    });
  });

  describe("google", () => {
    it("reads a project with nothing bound", async () => {
      const status = {
        searchConsole: { connected: false, siteUrl: null, permissionLevel: null, sync: null },
        analytics: {
          connected: true,
          propertyId: "412345678",
          propertyName: "example.com",
          accountName: "Example",
          sync: { lastSyncedAt: null, failedSince: "2026-09-18T04:00:00.000Z", error: "permission_denied" },
        },
      };
      const { api, calls } = stubFetch(json(200, status));

      await expect(api.google.status("p1")).resolves.toEqual(status);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/traffic/google/status`);
    });

    it("sends the period to the Search Console summary", async () => {
      const summary = { clicks: 0, impressions: 0, ctr: 0, position: 0, timeline: [] };
      const { api, calls } = stubFetch(json(200, summary));

      await expect(
        api.google.search("p1", { startDate: "2026-08-16", endDate: "2026-09-15" })
      ).resolves.toEqual(summary);
      expect(calls[0].url).toBe(
        `${BASE_URL}/v1/projects/p1/traffic/google/search?startDate=2026-08-16&endDate=2026-09-15`
      );
    });

    it("narrows the AI sessions to one assistant", async () => {
      const { api, calls } = stubFetch(json(200, { data: [], nextCursor: null }));

      await api.google.analyticsSources("p1", { assistant: "openai", limit: 10 });

      expect(calls[0].url).toBe(
        `${BASE_URL}/v1/projects/p1/traffic/google/analytics/sources?assistant=openai&limit=10`
      );
    });
  });

  it("creates a category, optionally under a parent", async () => {
    const category = { id: "c2", name: "Pricing tiers", parentId: "c1", source: "manual" };
    const { api, calls } = stubFetch(json(201, category));

    const result = await api.categories.create("p1", { name: "Pricing tiers", parentCategoryId: "c1" });

    expect(result).toEqual(category);
    expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/categories`);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: "Pricing tiers", parentCategoryId: "c1" });
  });

  it("accepts a prompt suggestion", async () => {
    const { api, calls } = stubFetch(json(200, { trackerId: "m1" }));

    const result = await api.promptSuggestions.accept("p1", "s1", { promptText: "best crm" });

    expect(result).toEqual({ trackerId: "m1" });
    expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/prompt-suggestions/s1/accept`);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ promptText: "best crm" });
  });

  it("creates and updates a prompt group", async () => {
    const settings = { id: "g1", name: "Comparisons", order: 1, promptCount: 0, aiTrafficTotal: 0 };
    const { api, calls } = stubFetch(json(201, settings));

    const created = await api.promptGroups.create("p1", { name: "Comparisons", order: 1 });
    expect(created).toEqual(settings);
    expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/prompt-groups`);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: "Comparisons", order: 1 });

    const { api: patchApi, calls: patchCalls } = stubFetch(json(200, { ...settings, name: "Comparison queries" }));
    const updated = await patchApi.promptGroups.update("p1", "g1", { name: "Comparison queries" });
    expect(updated.name).toBe("Comparison queries");
    expect(patchCalls[0].url).toBe(`${BASE_URL}/v1/projects/p1/prompt-groups/g1`);
    expect(patchCalls[0].init.method).toBe("PATCH");
  });

  describe("prompt suggestion generation", () => {
    it("schedules a run without sending a body", async () => {
      const run = { runId: "u1", skipped: null };
      const { api, calls } = stubFetch(json(201, run));

      const result = await api.promptSuggestions.generate("p1", "g1");

      expect(result).toEqual(run);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/prompt-groups/g1/suggestions/generate`);
      expect(calls[0].init.method).toBe("POST");
      expect(calls[0].init.body).toBeUndefined();
    });

    it("reports a skip reason when nothing was scheduled", async () => {
      const run = { runId: null, skipped: "cooldown" };
      const { api } = stubFetch(json(200, run));

      await expect(api.promptSuggestions.generate("p1", "g1")).resolves.toEqual(run);
    });

    it("reads availability", async () => {
      const availability = {
        canRun: false,
        reason: "cooldown",
        pendingSuggestionCount: 2,
        availableSlots: 5,
        lastRun: { status: "completed", startedAt: "2026-09-08T06:31:00.000Z", finishedAt: "2026-09-08T06:33:40.000Z" },
      };
      const { api, calls } = stubFetch(json(200, availability));

      await expect(api.promptSuggestions.getAvailability("p1", "g1")).resolves.toEqual(availability);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/prompt-groups/g1/suggestions/availability`);
    });
  });

  describe("brand analysis", () => {
    const run = {
      id: "r1",
      projectId: "p1",
      status: "processing",
      createdAt: "2026-09-28T09:24:11.000Z",
      updatedAt: "2026-09-28T09:24:11.000Z",
      activePromptCount: 12,
      usedResultCount: 10,
      maxContextGaps: 5,
      gaps: [],
      sentiment: null,
      totalCost: null,
      error: null,
    };

    it("starts a run without sending a body", async () => {
      const { api, calls } = stubFetch(json(201, run));

      const result = await api.brandAnalysis.createRun("p1");

      expect(result).toEqual(run);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/analysis/runs`);
      expect(calls[0].init.method).toBe("POST");
      expect(calls[0].init.body).toBeUndefined();
    });

    it("reads availability", async () => {
      const availability = {
        canRun: true,
        reason: "ready",
        activePromptCount: 12,
        usedResultCount: 10,
        latestTrackScoreResultTimestamp: "2026-09-28T09:00:00.000Z",
      };
      const { api, calls } = stubFetch(json(200, availability));

      await expect(api.brandAnalysis.getAvailability("p1")).resolves.toEqual(availability);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/analysis/availability`);
    });

    it("reads one run", async () => {
      const { api, calls } = stubFetch(json(200, { ...run, status: "ready" }));

      await expect(api.brandAnalysis.getRun("p1", "r1")).resolves.toMatchObject({ status: "ready" });
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/analysis/runs/r1`);
    });
  });

  describe("audits", () => {
    const audit = {
      id: "a1",
      projectId: "p1",
      status: "pending",
      startDate: "2026-09-28T09:24:11.000Z",
      endDate: null,
      duration: null,
      numberOfUrls: 1,
      results: [{ url: "https://example.com/pricing", status: "pending", error: null, totalCost: null, analysis: null }],
    };

    it("creates an audit", async () => {
      const { api, calls } = stubFetch(json(201, audit));

      const result = await api.audits.create({ urls: ["https://example.com/pricing"], projectId: "p1" });

      expect(result).toEqual(audit);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/audits`);
      expect(calls[0].init.method).toBe("POST");
      expect(JSON.parse(calls[0].init.body as string)).toEqual({
        urls: ["https://example.com/pricing"],
        projectId: "p1",
      });
    });

    it("reads one audit", async () => {
      const { api, calls } = stubFetch(json(200, { ...audit, status: "success" }));

      await expect(api.audits.get("a1")).resolves.toMatchObject({ status: "success" });
      expect(calls[0].url).toBe(`${BASE_URL}/v1/audits/a1`);
    });

    it("reads usage, scoped to a project", async () => {
      const usage = { limit: 100, used: 12, remaining: 88 };
      const { api, calls } = stubFetch(json(200, usage));

      await expect(api.audits.usage({ projectId: "p1" })).resolves.toEqual(usage);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/audits/usage?projectId=p1`);
    });
  });

  describe("topical maps", () => {
    const map = {
      id: "m1",
      projectId: "p1",
      topic: "cloud backup for small teams",
      language: "en",
      status: "processing",
      createdAt: "2026-09-28T09:24:11.000Z",
      generationCost: null,
      pillar: null,
      clusters: [],
      errorMessage: null,
    };

    it("creates a topical map", async () => {
      const { api, calls } = stubFetch(json(201, map));

      const result = await api.topicalMaps.create("p1", { topic: map.topic, language: "en" });

      expect(result).toEqual(map);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/maps`);
      expect(calls[0].init.method).toBe("POST");
      expect(JSON.parse(calls[0].init.body as string)).toEqual({ topic: map.topic, language: "en" });
    });

    it("lists topical map summaries", async () => {
      const summary = { ...map, status: "ready" };
      delete (summary as Record<string, unknown>).pillar;
      delete (summary as Record<string, unknown>).clusters;
      delete (summary as Record<string, unknown>).errorMessage;
      const { api, calls } = stubFetch(json(200, { data: [summary] }));

      await expect(api.topicalMaps.list("p1")).resolves.toEqual({ data: [summary] });
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/maps`);
    });

    it("reads one topical map", async () => {
      const ready = {
        ...map,
        status: "ready",
        pillar: { title: "The Complete Guide", description: "…" },
        clusters: [{ id: "c1", title: "How much does it cost?", category: "Pricing", intent: "Informational" }],
      };
      const { api, calls } = stubFetch(json(200, ready));

      await expect(api.topicalMaps.get("p1", "m1")).resolves.toEqual(ready);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/maps/m1`);
    });

    it("regenerates one cluster category", async () => {
      const { api, calls } = stubFetch(json(200, map));

      await api.topicalMaps.regenerateCluster("p1", "m1", { category: "Pricing" });

      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/maps/m1/regenerate`);
      expect(calls[0].init.method).toBe("POST");
      expect(JSON.parse(calls[0].init.body as string)).toEqual({ category: "Pricing" });
    });
  });
});
