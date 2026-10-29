import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import { SERVER_INSTRUCTIONS } from "../../instructions.js";
import type { ContentArticle, ContentBrief, CreateContentBriefInput } from "../../schemas/prompteye.js";
import { registerContentTools } from "../content.js";

const PROJECT = {
  id: "k9project",
  name: "Acme — Germany",
  brand: "Acme",
  domain: "acme.example",
  country: "DE",
  label: null,
  alternativeBrandNames: [],
  alternativeDomains: [],
  excludedCompetitors: [],
  accessRole: "OWNER",
  createdAt: "2026-09-01T10:00:00.000Z",
};

const PROCESSING_BRIEF: ContentBrief = {
  id: "b1",
  status: "processing",
  projectId: PROJECT.id,
  trackerId: "p1",
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

const READY_BRIEF: ContentBrief = {
  ...PROCESSING_BRIEF,
  status: "ready",
  title: "Best CRM for Small Teams in 2026",
  fanoutSource: "nodeshub",
  fanoutVariants: [
    { keyword: "crm pricing", type: "comparison", confidence: 0.82 },
    { keyword: "crm for freelancers", type: "segment", confidence: 0.74 },
  ],
  phrasesForArticle: [{ keyword: "crm pricing", type: "comparison", confidence: 0.82 }],
  separateArticles: [
    {
      keyword: "crm for freelancers",
      articleTitle: "The Best CRM Tools for Freelancers",
      type: "segment",
      confidence: 0.74,
      reason: "segment",
      priority: 2,
    },
  ],
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
    {
      level: "H3",
      text: "Per-seat pricing",
      annotation: null,
      sourcePhrases: null,
      includesBrand: true,
      faqQuestions: ["Is there a free CRM?"],
      origin: null,
      originalHeading: null,
      originalHasDirectAnswer: null,
    },
  ],
  readyAt: "2026-09-28T09:25:02.000Z",
};

const PROCESSING_ARTICLE: ContentArticle = {
  id: "a1",
  status: "processing",
  error: null,
  projectId: PROJECT.id,
  briefId: "b1",
  prompt: "best crm for small teams",
  title: "Best CRM for Small Teams in 2026",
  source: "generated_article",
  publishUrl: null,
  publishedAt: null,
  createdAt: "2026-09-28T09:26:00.000Z",
  updatedAt: "2026-09-28T09:26:00.000Z",
  content: null,
};

const DRAFT_ARTICLE: ContentArticle = {
  ...PROCESSING_ARTICLE,
  status: "draft",
  content: "## What does a CRM cost?\n\nMost CRMs for small teams charge per seat.",
};

const ARTICLE_SUMMARY = { ...DRAFT_ARTICLE, content: undefined };

async function connect(brief: ContentBrief, article: ContentArticle = DRAFT_ARTICLE) {
  const created: CreateContentBriefInput[] = [];
  const requested: string[] = [];
  const listed: { projectId: string; query: unknown }[] = [];
  const published: Array<{ articleId: string; url: string }> = [];
  const saved: Array<{ briefId: string; content: string; title?: string }> = [];
  const client = {
    getProject: async () => PROJECT,
    createContentBrief: async (input: CreateContentBriefInput) => {
      created.push(input);
      return PROCESSING_BRIEF;
    },
    getContentBrief: async () => brief,
    createContentArticle: async (briefId: string) => {
      requested.push(briefId);
      return PROCESSING_ARTICLE;
    },
    listContentArticles: async (projectId: string, query: unknown) => {
      listed.push({ projectId, query });
      return { data: [ARTICLE_SUMMARY], nextCursor: null };
    },
    getContentArticle: async () => article,
    saveContentArticle: async (briefId: string, content: string, title?: string) => {
      saved.push({ briefId, content, title });
      return { ...DRAFT_ARTICLE, content };
    },
    publishContentArticle: async (articleId: string, url: string) => {
      published.push({ articleId, url });
      return { ...DRAFT_ARTICLE, status: "published", publishUrl: url };
    },
  } as unknown as PromptEyeClient;

  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerContentTools(server, { client, baseUrl: "https://api.test" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);

  return { mcp, created, requested, listed, published, saved };
}

describe("content generation", () => {
  it("tells the host that PromptEye generates content and closes the visibility loop", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/generates the content/);
    expect(SERVER_INSTRUCTIONS).toMatch(/full visibility loop/);
    expect(SERVER_INSTRUCTIONS).toMatch(/Content generation is part of PromptEye, not only tracking/);
    expect(SERVER_INSTRUCTIONS).toContain("create_content_brief");
    expect(SERVER_INSTRUCTIONS).toContain("get_content_brief");
    expect(SERVER_INSTRUCTIONS).toContain("create_article");
    expect(SERVER_INSTRUCTIONS).toContain("save_article");
    expect(SERVER_INSTRUCTIONS).toContain("get_article");
    expect(SERVER_INSTRUCTIONS).toContain("list_articles");
  });

  it("offers the content tools", async () => {
    const { mcp } = await connect(READY_BRIEF);

    const { tools } = await mcp.listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      "create_content_brief",
      "get_content_brief",
      "create_article",
      "save_article",
      "get_article",
      "list_articles",
      "publish_article",
    ]);
  });

  it("orders a brief for the given project, linked to the tracked prompt", async () => {
    const { mcp, created } = await connect(READY_BRIEF);

    const result = await mcp.callTool({
      name: "create_content_brief",
      arguments: { projectId: PROJECT.id, prompt: "best crm for small teams", promptId: "p1" },
    });

    expect(created).toEqual([{ projectId: PROJECT.id, prompt: "best crm for small teams", trackerId: "p1" }]);
    expect(result.structuredContent).toEqual(PROCESSING_BRIEF);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(PROCESSING_BRIEF) }]);
  });

  it("orders the brief for the given project", async () => {
    const { mcp, created } = await connect(READY_BRIEF);

    await mcp.callTool({
      name: "create_content_brief",
      arguments: { projectId: "other-project", prompt: "best crm for small teams" },
    });

    expect(created).toEqual([{ projectId: "other-project", prompt: "best crm for small teams", trackerId: undefined }]);
  });

  it.each([
    ["still being written", PROCESSING_BRIEF],
    ["ready", READY_BRIEF],
    ["failed", { ...PROCESSING_BRIEF, status: "error", error: "The fan-out timed out." }],
  ])("reads a brief that is %s as the API returns it", async (_state, brief) => {
    const { mcp } = await connect(brief);

    const result = await mcp.callTool({ name: "get_content_brief", arguments: { briefId: "b1" } });

    expect(result.structuredContent).toEqual(brief);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(brief) }]);
  });

  it("asks for the article of a brief and returns it still processing", async () => {
    const { mcp, requested } = await connect(READY_BRIEF);

    const result = await mcp.callTool({
      name: "create_article",
      arguments: { briefId: "b1", confirmedByUser: true },
    });

    expect(requested).toEqual(["b1"]);
    expect(result.structuredContent).toEqual(PROCESSING_ARTICLE);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(PROCESSING_ARTICLE) }]);
  });

  it("refuses to write an article the user has not confirmed", async () => {
    const { mcp, requested } = await connect(READY_BRIEF);

    const result = await mcp.callTool({ name: "create_article", arguments: { briefId: "b1" } });

    expect(result.isError).toBe(true);
    expect(requested).toEqual([]);
  });

  it.each([
    ["still being written", PROCESSING_ARTICLE],
    ["written", DRAFT_ARTICLE],
    ["failed", { ...PROCESSING_ARTICLE, status: "error", error: "The model timed out." } as ContentArticle],
  ])("reads an article that is %s as the API returns it", async (_state, article) => {
    const { mcp } = await connect(READY_BRIEF, article);

    const result = await mcp.callTool({ name: "get_article", arguments: { articleId: "a1" } });

    expect(result.structuredContent).toEqual(article);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(article) }]);
  });

  it("lists the articles of the project without their text", async () => {
    const { mcp, listed } = await connect(READY_BRIEF);

    const result = await mcp.callTool({ name: "list_articles", arguments: { projectId: PROJECT.id, limit: 5, cursor: "c1" } });

    expect(listed).toEqual([{ projectId: PROJECT.id, query: { limit: 5, cursor: "c1" } }]);
    expect(result.structuredContent).toEqual({ data: [ARTICLE_SUMMARY], nextCursor: null });
  });

  it("saves text written outside PromptEye as the article of a brief", async () => {
    const { mcp, saved } = await connect(READY_BRIEF);

    const result = await mcp.callTool({
      name: "save_article",
      arguments: { briefId: "b1", content: "## Heading\n\nText", title: "My title" },
    });

    expect(saved).toEqual([{ briefId: "b1", content: "## Heading\n\nText", title: "My title" }]);
    expect(result.structuredContent).toMatchObject({ status: "draft", content: "## Heading\n\nText" });
  });

  it("refuses to save an empty article text", async () => {
    const { mcp, saved } = await connect(READY_BRIEF);

    const result = await mcp.callTool({ name: "save_article", arguments: { briefId: "b1", content: "" } });

    expect(result.isError).toBe(true);
    expect(saved).toEqual([]);
  });

  it("records where an article went live", async () => {
    const { mcp, published } = await connect(READY_BRIEF);

    const result = await mcp.callTool({
      name: "publish_article",
      arguments: { articleId: "a1", url: "https://example.com/blog/crm" },
    });

    expect(published).toEqual([{ articleId: "a1", url: "https://example.com/blog/crm" }]);
    expect(result.structuredContent).toMatchObject({ status: "published", publishUrl: "https://example.com/blog/crm" });
  });
});
