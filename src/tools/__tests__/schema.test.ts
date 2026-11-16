import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { PromptEyeApiError } from "../../api/index.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import { SERVER_INSTRUCTIONS } from "../../instructions.js";
import type { ArticleSchemaMarkup, GenerateArticleSchemaInput } from "../../schemas/prompteye.js";
import { registerSchemaTools } from "../schema.js";

const FAQ = [{ question: "What does a fractional CFO cost?", answer: "Most charge a monthly retainer." }];
const AUTHOR = { name: "Anna Kowalska", url: "https://acme.example/team/anna" };

const MARKUP: ArticleSchemaMarkup = {
  jsonLd: [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: FAQ[0].question,
          acceptedAnswer: { "@type": "Answer", text: FAQ[0].answer },
        },
      ],
    },
  ],
  skipped: [{ type: "Article", reason: "not_published" }],
};

type GenerateCall = { articleId: string; input: GenerateArticleSchemaInput };

async function connect(generate: (call: GenerateCall) => Promise<ArticleSchemaMarkup>) {
  const calls: GenerateCall[] = [];
  const client = {
    generateArticleSchema: async (articleId: string, input: GenerateArticleSchemaInput) => {
      calls.push({ articleId, input });
      return generate({ articleId, input });
    },
  } as unknown as PromptEyeClient;

  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerSchemaTools(server, { client, baseUrl: "https://api.test" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);

  return { mcp, calls };
}

describe("article schema", () => {
  it("tells the host it can build schema markup for an article", () => {
    expect(SERVER_INSTRUCTIONS).toContain("generate_article_schema");
  });

  it("offers the schema tool as read-only", async () => {
    const { mcp } = await connect(async () => MARKUP);

    const { tools } = await mcp.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(["generate_article_schema"]);
    expect(tools[0].annotations?.readOnlyHint).toBe(true);
    expect(tools[0].description).toMatch(/^schema\.org JSON-LD/);
  });

  it("passes the FAQ and author through and returns the markup as the API built it", async () => {
    const { mcp, calls } = await connect(async () => MARKUP);

    const result = await mcp.callTool({
      name: "generate_article_schema",
      arguments: { articleId: "a1", faq: FAQ, author: AUTHOR },
    });

    expect(calls).toEqual([{ articleId: "a1", input: { faq: FAQ, author: AUTHOR } }]);
    expect(result.structuredContent).toEqual(MARKUP);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(MARKUP) }]);
  });

  it("returns every skip reason the API gives", async () => {
    const draftWithoutAuthor: ArticleSchemaMarkup = {
      ...MARKUP,
      skipped: [
        { type: "Article", reason: "not_published" },
        { type: "Article", reason: "author_missing" },
      ],
    };
    const { mcp } = await connect(async () => draftWithoutAuthor);

    const result = await mcp.callTool({ name: "generate_article_schema", arguments: { articleId: "a1", faq: FAQ } });

    expect(result.structuredContent).toEqual(draftWithoutAuthor);
  });

  it("leaves the author out when none is given", async () => {
    const { mcp, calls } = await connect(async () => MARKUP);

    await mcp.callTool({ name: "generate_article_schema", arguments: { articleId: "a1", faq: FAQ } });

    expect(calls).toEqual([{ articleId: "a1", input: { faq: FAQ } }]);
  });

  it("reports an article the key does not reach as a tool error", async () => {
    const { mcp } = await connect(async () => {
      throw new PromptEyeApiError(404, { error: { code: "not_found", message: "Article not found" } });
    });

    const result = await mcp.callTool({
      name: "generate_article_schema",
      arguments: { articleId: "missing", faq: FAQ },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: "PromptEye API error 404 (not_found): The resource does not exist, or the API key does not reach it.",
      },
    ]);
  });
});
