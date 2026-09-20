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
});
