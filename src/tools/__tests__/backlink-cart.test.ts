import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PromptEyeApiError } from "../../api/errors.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import { registerBacklinkCartTools } from "../backlink-cart.js";

const CART_URL = "https://app.prompteye.com/project/p1/backlink-cart";

const LINE = {
  provider: "whitepress",
  offerId: "4821",
  type: "sponsoredArticle",
  scope: "portal",
  price: 120,
  currency: "PLN",
  isFollow: true,
  isPermanent: false,
  url: "https://news.example/post",
  domain: "news.example",
  addedAt: "2026-11-28T09:30:00.000Z",
};

const CART = {
  projectId: "p1",
  items: [LINE],
  totals: [{ currency: "PLN", amount: 120 }],
  cartUrl: CART_URL,
  updatedAt: "2026-11-28T09:30:00.000Z",
};

const REF = { provider: "whitepress", offerId: "4821", url: "https://news.example/post" };
const MISSING_REF = { provider: "linkhouse", offerId: "999", url: "https://gone.example/a" };

const FULL_MESSAGE =
  "A backlink cart holds at most 100 lines. Nothing was added; remove lines or add fewer.";
const FROZEN_MESSAGE = "The workspace that pays for this project has a lapsed subscription.";

const calls: Array<{ method: string; args: unknown[] }> = [];

const fakeClient = {
  getBacklinkCart: async (...args: unknown[]) => {
    calls.push({ method: "getBacklinkCart", args });
    return { data: CART };
  },
  addToBacklinkCart: async (...args: unknown[]) => {
    calls.push({ method: "addToBacklinkCart", args });
    const [projectId] = args as [string];
    if (projectId === "full") {
      throw new PromptEyeApiError(422, {
        error: { code: "not_available", message: FULL_MESSAGE },
      });
    }
    if (projectId === "frozen") {
      throw new PromptEyeApiError(402, {
        error: { code: "plan_limit_exceeded", message: FROZEN_MESSAGE },
      });
    }
    return { data: CART, rejected: [MISSING_REF] };
  },
  removeFromBacklinkCart: async (...args: unknown[]) => {
    calls.push({ method: "removeFromBacklinkCart", args });
    return { data: { ...CART, items: [], totals: [] } };
  },
} as unknown as PromptEyeClient;

async function connectedClient(): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerBacklinkCartTools(server, {
    client: fakeClient,
    baseUrl: "https://api.example",
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

beforeEach(() => {
  calls.length = 0;
});

describe("backlink cart tools", () => {
  it("get_backlink_cart answers the cart with its totals and cartUrl", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "get_backlink_cart",
      arguments: { projectId: "p1" },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ data: CART });
    expect(calls).toEqual([{ method: "getBacklinkCart", args: ["p1"] }]);
  });

  it("add_to_backlink_cart hands the references to the API and answers the rejected ones", async () => {
    const client = await connectedClient();
    const items = [REF, MISSING_REF];
    const result = await client.callTool({
      name: "add_to_backlink_cart",
      arguments: { projectId: "p1", items },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      data: CART,
      rejected: [MISSING_REF],
    });
    expect(calls).toEqual([
      { method: "addToBacklinkCart", args: ["p1", items] },
    ]);
  });

  it("add_to_backlink_cart passes the API's reason on when the cart is full", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "add_to_backlink_cart",
      arguments: { projectId: "full", items: [REF] },
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(FULL_MESSAGE);
  });

  it("add_to_backlink_cart passes the API's reason on when the workspace plan has lapsed", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "add_to_backlink_cart",
      arguments: { projectId: "frozen", items: [REF] },
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(FROZEN_MESSAGE);
  });

  it("add_to_backlink_cart refuses an empty items list without calling the API", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "add_to_backlink_cart",
      arguments: { projectId: "p1", items: [] },
    });

    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });

  it("add_to_backlink_cart refuses 101 items without calling the API", async () => {
    const client = await connectedClient();
    const items = Array.from({ length: 101 }, (_, index) => ({
      ...REF,
      offerId: String(index),
    }));
    const result = await client.callTool({
      name: "add_to_backlink_cart",
      arguments: { projectId: "p1", items },
    });

    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });

  it("add_to_backlink_cart accepts exactly 100 items", async () => {
    const client = await connectedClient();
    const items = Array.from({ length: 100 }, (_, index) => ({
      ...REF,
      offerId: String(index),
    }));
    const result = await client.callTool({
      name: "add_to_backlink_cart",
      arguments: { projectId: "p1", items },
    });

    expect(result.isError).toBeFalsy();
    expect(calls).toEqual([{ method: "addToBacklinkCart", args: ["p1", items] }]);
  });

  it("add_to_backlink_cart refuses a provider the API does not sell through", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "add_to_backlink_cart",
      arguments: { projectId: "p1", items: [{ ...REF, provider: "other" }] },
    });

    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });

  it("remove_from_backlink_cart hands the provider, offer and page to the API", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "remove_from_backlink_cart",
      arguments: { projectId: "p1", ...REF },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      data: { ...CART, items: [], totals: [] },
    });
    expect(calls).toEqual([
      { method: "removeFromBacklinkCart", args: ["p1", REF] },
    ]);
  });

  it("annotates the read tool read-only and only the removal destructive", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    const annotations = (name: string) =>
      tools.find((tool) => tool.name === name)?.annotations;

    expect(annotations("get_backlink_cart")?.readOnlyHint).toBe(true);
    expect(annotations("add_to_backlink_cart")?.readOnlyHint).toBe(false);
    expect(annotations("add_to_backlink_cart")?.destructiveHint).toBe(false);
    expect(annotations("remove_from_backlink_cart")?.readOnlyHint).toBe(false);
    expect(annotations("remove_from_backlink_cart")?.destructiveHint).toBe(true);
  });
});
