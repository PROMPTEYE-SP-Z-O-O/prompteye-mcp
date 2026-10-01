import { ZodError } from "zod";
import { PromptEyeApi } from "../client.js";
import { PromptEyeApiError } from "../errors.js";
import type { FetchLike } from "../http.js";
import { toolMessageFor } from "../../client/errors.js";

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

  it("shows the API's own message for a failed validation", async () => {
    const message = "No prompt group with this identifier is in this project.";
    const { api } = stubFetch(json(400, { error: { code: "invalid_request", message } }));

    const error = await api.projects.get("p").catch((e: unknown) => e);

    expect(toolMessageFor(error)).toContain(message);
  });

  it("throws on a non-JSON failure too", async () => {
    const { api } = stubFetch(new Response("<html>Bad gateway</html>", { status: 502 }));

    await expect(api.account.get()).rejects.toMatchObject({ status: 502, code: undefined, body: undefined });
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

  it("keeps when the AI traffic was measured, and reads an API that does not send it yet", async () => {
    const settings = {
      id: "prompt1",
      prompt: "best tools",
      keyword: "",
      status: "active",
      categories: [],
      subcategories: [],
      groupId: null,
      createdAt: "2026-09-10T09:24:11.000Z",
      aiTraffic: 0,
      aiTrafficMeasuredAt: "2026-09-29T10:00:00.000Z",
      businessPriority: null,
      businessPriorityReason: null,
    };
    const older = { ...settings, aiTrafficMeasuredAt: undefined };

    await expect(stubFetch(json(200, settings)).api.prompts.update("p1", "prompt1", {})).resolves.toEqual(settings);
    await expect(stubFetch(json(200, older)).api.prompts.update("p1", "prompt1", {})).resolves.not.toHaveProperty(
      "aiTrafficMeasuredAt"
    );
  });

  it("creates, changes and deletes a prompt group", async () => {
    const group = { id: "g1", name: "Overall", description: null, order: 2, promptCount: 0 };
    const created = stubFetch(json(201, group));

    await expect(created.api.promptGroups.create("p1", { name: "Overall" })).resolves.toEqual(group);
    expect(created.calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/groups`);
    expect(created.calls[0].init.method).toBe("POST");
    expect(JSON.parse(created.calls[0].init.body as string)).toEqual({ name: "Overall" });

    const updated = stubFetch(json(200, { ...group, description: "Broad questions." }));

    await expect(
      updated.api.promptGroups.update("p1", "g 1", { description: "Broad questions.", order: 0 })
    ).resolves.toMatchObject({ description: "Broad questions." });
    expect(updated.calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/groups/g%201`);
    expect(updated.calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(updated.calls[0].init.body as string)).toEqual({ description: "Broad questions.", order: 0 });

    const deleted = stubFetch(new Response(null, { status: 204 }));

    await expect(deleted.api.promptGroups.delete("p1", "g1")).resolves.toBeUndefined();
    expect(deleted.calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/groups/g1`);
    expect(deleted.calls[0].init.method).toBe("DELETE");
    expect(deleted.calls[0].init.body).toBeUndefined();
  });

  it("carries the reason a group with prompts cannot be deleted", async () => {
    const message =
      "The prompt group still has prompts. Move them to another group or ungroup them, then delete the group.";
    const { api } = stubFetch(json(409, { error: { code: "conflict", message } }));

    const error = await api.promptGroups.delete("p1", "g1").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PromptEyeApiError);
    expect(error).toMatchObject({ status: 409, code: "conflict", message });
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

  it("posts a missing-capability report with the key", async () => {
    const feedback = { id: "f1", receivedAt: "2026-09-29T15:40:00.000Z" };
    const { api, calls } = stubFetch(json(201, feedback));

    const result = await api.feedback.create({
      need: "Export the prompt list as CSV",
      attemptedAction: "Exporting prompts for a client deck",
    });

    expect(result).toEqual(feedback);
    expect(calls[0].url).toBe(`${BASE_URL}/v1/feedback`);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      need: "Export the prompt list as CSV",
      attemptedAction: "Exporting prompts for a client deck",
    });
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

  describe("content briefs", () => {
    const brief = {
      id: "b1",
      status: "processing",
      projectId: "j57",
      trackerId: "m42",
      prompt: "best crm for small teams",
      error: null,
      title: null,
      originalTitle: null,
      titleChangeAnnotation: null,
      fanoutSource: null,
      fanoutError: null,
      fanoutVariants: null,
      phrasesForArticle: null,
      separateArticles: null,
      outline: null,
      sourceTextMatchPercentage: null,
      requestedAt: "2026-09-28T09:24:11.000Z",
      readyAt: null,
    };

    it("requests a brief with the key and the prompt it targets", async () => {
      const { api, calls } = stubFetch(json(201, brief));

      await expect(
        api.contentBriefs.create({ projectId: "j57", prompt: "best crm for small teams", trackerId: "m42" })
      ).resolves.toEqual(brief);

      expect(calls[0].url).toBe(`${BASE_URL}/v1/content/briefs`);
      expect(calls[0].init.method).toBe("POST");
      expect(calls[0].init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
      expect(JSON.parse(calls[0].init.body as string)).toEqual({
        projectId: "j57",
        prompt: "best crm for small teams",
        trackerId: "m42",
      });
    });

    it("reads one brief by id", async () => {
      const { api, calls } = stubFetch(json(200, brief));

      await expect(api.contentBriefs.get("b 1")).resolves.toEqual(brief);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/content/briefs/b%201`);
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

  describe("integrations", () => {
    it("reads which integrations the project has", async () => {
      const status = {
        searchConsole: { connected: true, reason: null },
        analytics: { connected: true, reason: "sync_failing" },
        botLogs: { connected: false, reason: "not_connected" },
        sitemap: { connected: false, reason: "not_connected" },
      };
      const { api, calls } = stubFetch(json(200, status));

      await expect(api.integrations.status("p1")).resolves.toEqual(status);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/integrations/status`);
      expect(calls[0].init.method).toBe("GET");
    });
  });

  describe("workspaces", () => {
    it("pages the workspaces of the account", async () => {
      const workspace = { id: "w1", name: "Example Agency", kind: "team", role: "MEMBER", scoped: false };
      const { api, calls } = stubFetch(json(200, { data: [workspace], nextCursor: null }));

      await expect(api.workspaces.list({ limit: 10 })).resolves.toEqual({ data: [workspace], nextCursor: null });
      expect(calls[0].url).toBe(`${BASE_URL}/v1/workspaces?limit=10`);
    });

    it("narrows the project listing to one workspace", async () => {
      const { api, calls } = stubFetch(json(200, { data: [] }));

      await api.projects.list({ workspaceId: "w1" });

      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects?workspaceId=w1`);
    });
  });

  describe("categories and suggestions", () => {
    it("posts a subcategory", async () => {
      const category = { id: "c2", name: "Pricing", parentId: "c1", source: "manual" };
      const { api, calls } = stubFetch(json(201, category));

      await expect(api.categories.create("p1", { name: "Pricing", parentCategoryId: "c1" })).resolves.toEqual(category);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/categories`);
      expect(calls[0].init.method).toBe("POST");
      expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: "Pricing", parentCategoryId: "c1" });
    });

    it("accepts a suggestion as written with an empty body", async () => {
      const { api, calls } = stubFetch(json(200, { trackerId: "pr9" }));

      await expect(api.promptSuggestions.accept("p1", "s1", {})).resolves.toEqual({ trackerId: "pr9" });
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/prompt-suggestions/s1/accept`);
      expect(calls[0].init.body).toBe("{}");
    });

    it("reads the availability and schedules a run for a group", async () => {
      const availability = {
        canRun: false,
        reason: "cooldown",
        pendingSuggestionCount: 2,
        availableSlots: 5,
        lastRun: { status: "completed", startedAt: "2026-09-08T06:31:00.000Z", finishedAt: "2026-09-08T06:33:40.000Z" },
      };
      const read = stubFetch(json(200, availability));
      await expect(read.api.promptSuggestions.availability("p1", "g1")).resolves.toEqual(availability);
      expect(read.calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/prompt-groups/g1/suggestions/availability`);

      const scheduled = stubFetch(json(200, { runId: null, skipped: "cooldown" }));
      await expect(scheduled.api.promptSuggestions.generate("p1", "g1")).resolves.toEqual({ runId: null, skipped: "cooldown" });
      expect(scheduled.calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/prompt-groups/g1/suggestions/generate`);
      expect(scheduled.calls[0].init.method).toBe("POST");
      expect(scheduled.calls[0].init.body).toBeUndefined();
    });
  });

  describe("source pages", () => {
    it("ranks the cited pages of one assistant", async () => {
      const page = { url: "https://example.com/pricing", domain: "example.com", sourceOccurrences: 7, share: 3.84615, ownDomain: false };
      const { api, calls } = stubFetch(json(200, { data: [page], nextCursor: null }));

      await expect(api.sources.listPages("p1", { model: "gpt", limit: 5 })).resolves.toEqual({ data: [page], nextCursor: null });
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/sources/pages?model=gpt&limit=5`);
    });
  });

  describe("crawl health", () => {
    it("scores one kind of crawler for the period", async () => {
      const health = {
        total: 812,
        success: 780,
        redirects: 18,
        clientErrors: 10,
        serverErrors: 4,
        unknown: 0,
        scanRequests: 0,
        averageResponseTimeMs: 240,
        assessments: [{ key: "4xx", level: "ok", count: 10, rate: 0.012, averageResponseTimeMs: null }],
        issues: [],
      };
      const { api, calls } = stubFetch(json(200, health));

      await expect(api.traffic.health("p1", { kind: "ai", startDate: "2026-09-01" })).resolves.toEqual(health);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/traffic/health?kind=ai&startDate=2026-09-01`);
    });
  });

  describe("brand analysis", () => {
    it("starts a run and reads it back", async () => {
      const run = {
        id: "r1",
        projectId: "p1",
        status: "processing",
        createdAt: "2026-09-28T09:24:11.000Z",
        updatedAt: "2026-09-28T09:24:11.000Z",
        activePromptCount: 42,
        usedResultCount: 40,
        maxContextGaps: 10,
        gaps: [],
        sentiment: null,
        totalCost: null,
        error: null,
      };
      const started = stubFetch(json(201, run));
      await expect(started.api.brandAnalysis.createRun("p1")).resolves.toEqual(run);
      expect(started.calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/analysis/runs`);
      expect(started.calls[0].init.method).toBe("POST");

      const read = stubFetch(json(200, run));
      await expect(read.api.brandAnalysis.getRun("p1", "r1")).resolves.toEqual(run);
      expect(read.calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/analysis/runs/r1`);
    });

    it("reads whether a run can start", async () => {
      const availability = {
        canRun: true,
        reason: "ready",
        activePromptCount: 42,
        usedResultCount: 40,
        latestTrackScoreResultTimestamp: null,
      };
      const { api, calls } = stubFetch(json(200, availability));

      await expect(api.brandAnalysis.availability("p1")).resolves.toEqual(availability);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/analysis/availability`);
    });
  });

  describe("audits", () => {
    const audit = {
      id: "a1",
      projectId: null,
      status: "pending",
      startDate: "2026-09-28T09:24:11.000Z",
      endDate: null,
      duration: null,
      numberOfUrls: 1,
      results: [{ url: "https://example.com/pricing", status: "pending", error: null, totalCost: null, analysis: null }],
    };

    it("posts the URLs to audit", async () => {
      const { api, calls } = stubFetch(json(201, audit));

      await expect(api.audits.create({ urls: ["https://example.com/pricing"] })).resolves.toEqual(audit);
      expect(calls[0].url).toBe(`${BASE_URL}/v1/audits`);
      expect(JSON.parse(calls[0].init.body as string)).toEqual({ urls: ["https://example.com/pricing"] });
    });

    it("reads an audit and the quota billed to a project", async () => {
      const read = stubFetch(json(200, audit));
      await expect(read.api.audits.get("a1")).resolves.toEqual(audit);
      expect(read.calls[0].url).toBe(`${BASE_URL}/v1/audits/a1`);

      const usage = stubFetch(json(200, { limit: 100, used: 12, remaining: 88 }));
      await expect(usage.api.audits.usage({ projectId: "p1" })).resolves.toEqual({ limit: 100, used: 12, remaining: 88 });
      expect(usage.calls[0].url).toBe(`${BASE_URL}/v1/audits/usage?projectId=p1`);
    });
  });

  describe("topical maps", () => {
    const summary = {
      id: "m1",
      projectId: "p1",
      topic: "cloud backup for small teams",
      language: "en",
      status: "processing",
      createdAt: "2026-09-28T09:24:11.000Z",
      generationCost: null,
    };
    const map = { ...summary, pillar: null, clusters: [], errorMessage: null };

    it("posts a topic and lists the maps", async () => {
      const created = stubFetch(json(201, map));
      await expect(created.api.topicalMaps.create("p1", { topic: map.topic, language: "en" })).resolves.toEqual(map);
      expect(created.calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/maps`);
      expect(JSON.parse(created.calls[0].init.body as string)).toEqual({ topic: map.topic, language: "en" });

      const listed = stubFetch(json(200, { data: [summary] }));
      await expect(listed.api.topicalMaps.list("p1")).resolves.toEqual({ data: [summary] });
      expect(listed.calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/maps`);
    });

    it("reads a map and regenerates one of its categories", async () => {
      const read = stubFetch(json(200, map));
      await expect(read.api.topicalMaps.get("p1", "m1")).resolves.toEqual(map);
      expect(read.calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/maps/m1`);

      const regenerated = stubFetch(json(200, map));
      await expect(regenerated.api.topicalMaps.regenerateCluster("p1", "m1", { category: "Pricing" })).resolves.toEqual(map);
      expect(regenerated.calls[0].url).toBe(`${BASE_URL}/v1/projects/p1/maps/m1/regenerate`);
      expect(JSON.parse(regenerated.calls[0].init.body as string)).toEqual({ category: "Pricing" });
    });
  });
});
