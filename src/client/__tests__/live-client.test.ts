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

/** An API that knows one project, recording the paths it is asked for. */
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

  it("serves the rest from sample data, for a real project id, without calling the API", async () => {
    const { client, requested } = liveClient();
    const range = { startDate: "2026-08-16", endDate: "2026-09-15" };

    const summary = await client.getVisibilitySummary(LIVE_PROJECT.id, range);
    const prompts = await client.listPrompts(LIVE_PROJECT.id, range);
    const quality = await client.getCitationQuality(LIVE_PROJECT.id);

    expect(summary.totals.visibility).not.toBeNull();
    expect(prompts.data.length).toBeGreaterThan(0);
    expect(quality.role.distribution.length).toBeGreaterThan(0);
    expect(requested).toEqual([]);
  });

  it("lets the session select the only project the key reaches", async () => {
    const { client } = liveClient();

    await expect(new ProjectSession(client).require()).resolves.toEqual(LIVE_PROJECT);
  });
});
