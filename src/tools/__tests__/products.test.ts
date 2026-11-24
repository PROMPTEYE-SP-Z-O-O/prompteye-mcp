import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MAX_LIMIT } from "../../schemas/common.js";
import type { PromptEyeClient } from "../../client/prompteye-client.js";
import { PRODUCTS_SCOPE } from "../glossary.js";
import { registerProductTools } from "../products.js";

const SHELF = {
  from: "2026-08-16",
  to: "2026-09-15",
  firstBoxDay: null,
  share: null,
  presence: null,
  boxes: 0,
  promptsWithBoxes: 0,
  promptsTotal: 3,
  clientShop: null,
  shopsAheadOfClient: [],
  prompts: [],
  weeks: [],
};

const SHOP = {
  shopKey: "allegro",
  name: "Allegro",
  domain: "allegro.pl",
  isMine: false,
  isMarketplace: true,
  share: 41.5,
  presence: 60,
  boxes: 12,
  positions: 30,
};

const SHOP_DETAIL = { ...SHOP, meanPosition: 2.1, firstPlaces: 3, shopsAheadOfClient: [], prompts: [], weeks: [] };

const PRODUCT = {
  productKey: "k1",
  title: "Trail shoe",
  imageUrl: null,
  answers: 7,
  lastDay: "2026-09-14",
  clientPosition: 2,
  offersCount: 4,
  clientPrice: 299,
  currency: "PLN",
  cheapest: { shopKey: "allegro", name: "Allegro", domain: "allegro.pl", price: 279 },
  gapAmount: 20,
  gapPercent: 7.2,
  isMine: true,
};

const OFFER = {
  productKey: "k1",
  shopKey: "allegro",
  shop: "Allegro",
  domain: "allegro.pl",
  position: 1,
  price: 279,
  currency: "PLN",
  condition: "new",
  isMine: false,
  isCheapest: true,
  gapAmount: 0,
  gapPercent: 0,
};

const RATING = {
  productKey: "k1",
  title: "Trail shoe",
  groupId: "g1",
  groupName: "Shoes",
  rating: 4.1,
  ratingMin: 3.9,
  ratingMax: 4.3,
  reviews: 120,
  measurements: 9,
  days: 6,
  belowTypical: true,
  typicalRating: 4.5,
  typicalReviews: 300,
  ratingDifference: -0.4,
  reviewsPercentOfTypical: 40,
};

const ISSUE = {
  id: "price:k1",
  type: "price",
  product: { itemId: "k1", title: "Trail shoe", imageUrl: null, link: null },
  group: null,
  before: { amount: 299, currency: "PLN" },
  after: { amount: 279, currency: "PLN" },
  answers: 7,
  lastDay: "2026-09-14",
  weight: 7,
};

const STOCK_ISSUE = { ...ISSUE, id: "stock:k1", type: "stock", before: "in_stock", after: null };

const SHELF_DROP_ISSUE = {
  ...ISSUE,
  id: "drop:project",
  type: "shelf_drop",
  product: null,
  group: null,
  before: { week: { from: "2026-08-03", to: "2026-08-09" }, share: 50 },
  after: { week: { from: "2026-08-10", to: "2026-08-16" }, share: 30 },
};

const page = (row: unknown) => ({ data: [row], nextCursor: null });

const ISSUES_PAGE = { data: [ISSUE, STOCK_ISSUE, SHELF_DROP_ISSUE], nextCursor: null };

const calls: Array<{ method: string; args: unknown[] }> = [];

const recorded =
  (method: string, answer: unknown) =>
  async (...args: unknown[]) => {
    calls.push({ method, args });
    return answer;
  };

const fakeClient = {
  getProductShelf: recorded("getProductShelf", SHELF),
  listProductShops: recorded("listProductShops", page(SHOP)),
  getProductShop: recorded("getProductShop", SHOP_DETAIL),
  listProducts: recorded("listProducts", page(PRODUCT)),
  getProduct: recorded("getProduct", PRODUCT),
  listProductOffers: recorded("listProductOffers", page(OFFER)),
  listProductRatings: recorded("listProductRatings", page(RATING)),
  listProductIssues: recorded("listProductIssues", ISSUES_PAGE),
} as unknown as PromptEyeClient;

async function connectedClient(): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerProductTools(server, { client: fakeClient, baseUrl: "https://api.example" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

beforeEach(() => {
  calls.length = 0;
});

describe("product tools", () => {
  it.each([
    ["get_product_shelf", { promptId: "pr1" }, SHELF, "getProductShelf", ["p1", { promptId: "pr1" }]],
    ["list_product_shops", { limit: 5 }, page(SHOP), "listProductShops", ["p1", { limit: 5 }]],
    ["get_product_shop", { shopKey: "allegro" }, SHOP_DETAIL, "getProductShop", ["p1", "allegro", {}]],
    ["list_products", { mine: true, q: "shoe" }, page(PRODUCT), "listProducts", ["p1", { mine: true, q: "shoe" }]],
    ["get_product", { productKey: "k1", groupId: "g1" }, PRODUCT, "getProduct", ["p1", "k1", { groupId: "g1" }]],
    ["list_product_offers", { productKey: "k1" }, page(OFFER), "listProductOffers", ["p1", { productKey: "k1" }]],
    ["list_product_ratings", { belowTypical: true }, page(RATING), "listProductRatings", ["p1", { belowTypical: true }]],
    ["list_product_issues", { type: "price" }, ISSUES_PAGE, "listProductIssues", ["p1", { type: "price" }]],
  ])("%s hands the project and filters to the API and answers its data", async (name, input, expected, method, args) => {
    const client = await connectedClient();

    const result = await client.callTool({ name, arguments: { projectId: "p1", ...input } });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(expected);
    expect(calls).toEqual([{ method, args }]);
  });

  it("are all read-only", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(8);
    tools.forEach((tool) => expect(tool.annotations?.readOnlyHint).toBe(true));
  });

  it("all describe the ChatGPT-only scope", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();

    tools.forEach((tool) => expect(tool.description).toContain(PRODUCTS_SCOPE));
  });

  it("offer no model, category or subcategory filter", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();

    tools.forEach((tool) => {
      const properties = Object.keys(tool.inputSchema.properties ?? {});
      expect(properties).not.toContain("model");
      expect(properties).not.toContain("categoryId");
      expect(properties).not.toContain("subcategoryId");
    });
  });

  it("refuses a limit above the maximum", async () => {
    const client = await connectedClient();

    const result = await client.callTool({
      name: "list_product_shops",
      arguments: { projectId: "p1", limit: MAX_LIMIT + 1 },
    });

    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });

  it("refuses an issue type the API does not know", async () => {
    const client = await connectedClient();

    const result = await client.callTool({ name: "list_product_issues", arguments: { projectId: "p1", type: "other" } });

    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });
});
