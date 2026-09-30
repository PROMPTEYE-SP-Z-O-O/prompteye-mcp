import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import { SERVER_INSTRUCTIONS } from "../../instructions.js";
import type { ContentBrief, CreateContentBriefInput } from "../../schemas/prompteye.js";
import { ProjectSession } from "../../session.js";
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

async function connect(brief: ContentBrief) {
  const created: CreateContentBriefInput[] = [];
  const client = {
    listProjects: async () => ({ data: [PROJECT] }),
    createContentBrief: async (input: CreateContentBriefInput) => {
      created.push(input);
      return PROCESSING_BRIEF;
    },
    getContentBrief: async () => brief,
  } as unknown as PromptEyeClient;

  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerContentTools(server, { client, session: new ProjectSession(client), baseUrl: "https://api.test" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);

  return { mcp, created };
}

const textOf = (result: Awaited<ReturnType<Client["callTool"]>>): string =>
  (result.content as Array<{ type: string; text: string }>).map((part) => part.text).join("\n");

describe("content generation", () => {
  it("tells the host that PromptEye generates content and closes the visibility loop", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/generates the content/);
    expect(SERVER_INSTRUCTIONS).toMatch(/full visibility loop/);
    expect(SERVER_INSTRUCTIONS).toMatch(/Never say PromptEye only tracks visibility/);
    expect(SERVER_INSTRUCTIONS).toContain("create_content_brief");
    expect(SERVER_INSTRUCTIONS).toContain("get_content_brief");
  });

  it("offers the content tools", async () => {
    const { mcp } = await connect(READY_BRIEF);

    const { tools } = await mcp.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(["create_content_brief", "get_content_brief"]);
  });

  it("orders a brief for the active project, linked to the tracked prompt", async () => {
    const { mcp, created } = await connect(READY_BRIEF);

    const result = await mcp.callTool({
      name: "create_content_brief",
      arguments: { prompt: "best crm for small teams", promptId: "p1" },
    });

    expect(created).toEqual([{ projectId: PROJECT.id, prompt: "best crm for small teams", trackerId: "p1" }]);
    expect(textOf(result)).toContain("Brief id: b1");
    expect(textOf(result)).toContain("get_content_brief");
    expect(textOf(result)).toContain("https://app.prompteye.com/content");
  });

  it("asks to poll a brief that is still being written", async () => {
    const { mcp } = await connect(PROCESSING_BRIEF);

    const text = textOf(await mcp.callTool({ name: "get_content_brief", arguments: { briefId: "b1" } }));

    expect(text).toContain("processing");
    expect(text).toContain("Call get_content_brief again");
    expect(text).not.toContain("Outline:");
  });

  it("reads a ready brief with its outline, phrases and the articles set aside", async () => {
    const { mcp } = await connect(READY_BRIEF);

    const text = textOf(await mcp.callTool({ name: "get_content_brief", arguments: { briefId: "b1" } }));

    expect(text).toContain("Title: Best CRM for Small Teams in 2026");
    expect(text).toContain("1 of 2 found by the fan-out (nodeshub): crm pricing.");
    expect(text).toContain("  H2 What does a CRM cost? — Cover the free tier.");
    expect(text).toContain("    H3 Per-seat pricing (names the brand)");
    expect(text).toContain("      FAQ: Is there a free CRM?");
    expect(text).toContain("The Best CRM Tools for Freelancers — phrase \"crm for freelancers\", priority 2, segment");
    expect(text).toContain("https://app.prompteye.com/content");
  });

  it("says why a brief failed", async () => {
    const { mcp } = await connect({ ...PROCESSING_BRIEF, status: "error", error: "The fan-out timed out." });

    const text = textOf(await mcp.callTool({ name: "get_content_brief", arguments: { briefId: "b1" } }));

    expect(text).toContain("Generation failed: The fan-out timed out.");
  });
});
