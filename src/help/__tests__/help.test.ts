import { jest } from "@jest/globals";
import { HelpCenter, parseHelpIndex } from "../help.js";

const INDEX = `# PromptEye Help

Public Reports guides in English.

## Reports

- [Reports overview](/help/raw/public-reports/reports/index.md) — [read online](/help/public-reports/reports/)
- [Generate a test report](/help/raw/public-reports/reports/create-report.md) — [read online](/help/public-reports/reports/create-report/)

## Integration

- [Connect a form to Public Reports](/help/raw/public-reports/info/index.md) — [read online](/help/public-reports/info/)
`;

const response = (body: string, status = 200) => new Response(body, { status });

describe("parseHelpIndex", () => {
  it("reads section, title, raw path and the page to send a user to", () => {
    expect(parseHelpIndex(INDEX, "https://help.test")).toEqual([
      {
        section: "Reports",
        title: "Reports overview",
        path: "/help/raw/public-reports/reports/index.md",
        url: "https://help.test/help/public-reports/reports/",
      },
      {
        section: "Reports",
        title: "Generate a test report",
        path: "/help/raw/public-reports/reports/create-report.md",
        url: "https://help.test/help/public-reports/reports/create-report/",
      },
      {
        section: "Integration",
        title: "Connect a form to Public Reports",
        path: "/help/raw/public-reports/info/index.md",
        url: "https://help.test/help/public-reports/info/",
      },
    ]);
  });

  it("ignores lines that are not article entries", () => {
    expect(
      parseHelpIndex("# x\n\n- plain bullet\n- [Off site](https://evil.test/a.md)", "https://help.test")
    ).toEqual([]);
  });
});

describe("HelpCenter", () => {
  it("caches the index between calls", async () => {
    const fetcher = jest.fn(async (_url: string) => response(INDEX));
    const help = new HelpCenter({ baseUrl: "https://help.test", fetcher });

    await help.articles();
    await help.articles();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://help.test/help/index.md");
  });

  it("fetches an article by its raw path", async () => {
    const fetcher = jest.fn(async (_url: string) => response("# Score\n\nHow it works."));
    const help = new HelpCenter({ baseUrl: "https://help.test", fetcher });

    await expect(help.article("/help/raw/public-reports/reports/score.md")).resolves.toBe(
      "# Score\n\nHow it works."
    );
    expect(fetcher).toHaveBeenCalledWith("https://help.test/help/raw/public-reports/reports/score.md");
  });

  it.each([
    "https://evil.test/help/raw/a.md",
    "/api/keys",
    "/help/raw/../../secret.md",
    "/help/raw/a.txt",
    "//evil.test/help/raw/a.md",
  ])("refuses %s", async (path) => {
    const fetcher = jest.fn(async (_url: string) => response("x"));
    const help = new HelpCenter({ baseUrl: "https://help.test", fetcher });

    await expect(help.article(path)).rejects.toThrow(/help article/i);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("names the help center when it cannot be reached", async () => {
    const help = new HelpCenter({
      baseUrl: "https://help.test",
      fetcher: async (_url: string) => response("no", 404),
    });

    await expect(help.article("/help/raw/missing.md")).rejects.toThrow(/https:\/\/help\.test\/help/);
  });
});
