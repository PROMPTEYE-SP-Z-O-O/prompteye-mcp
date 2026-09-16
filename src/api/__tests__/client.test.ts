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

    expect(calls[0].url).toBe(`${BASE_URL}/v1/projects/a%2Fb/prompt-suggestions?groupId=g%201`);
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
});
