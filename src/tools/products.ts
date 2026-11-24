import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DEFAULT_LIMIT, MAX_LIMIT, dateRangeShape, promptScopeShape } from "../schemas/common.js";
import {
  NextCursorSchema,
  PRODUCT_ISSUE_TYPES,
  ProductIssueSchema,
  ProductOfferSchema,
  ProductRatingSchema,
  ProductSchema,
  ProductShelfSchema,
  ProductShopDetailSchema,
  ProductShopSchema,
} from "../schemas/prompteye.js";
import { PRODUCTS_SCOPE } from "./glossary.js";
import { projectIdShape } from "./project-id.js";
import { READ_ONLY, handled, ok, type ToolContext } from "./result.js";

const { promptId, groupId } = promptScopeShape("Report on");

const productScopeShape = { ...projectIdShape, ...dateRangeShape, promptId, groupId };

const limitShape = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(
      `How many rows to return, at most ${MAX_LIMIT}. Defaults to ${DEFAULT_LIMIT}. The list is the first rows in its order and has no next page ` +
        "(nextCursor is always null); raise limit to see more."
    ),
};

const productKeyShape = {
  productKey: z.string().min(1).describe("The product's key, as list_products reports it."),
};

const shopKeyShape = {
  shopKey: z.string().min(1).describe("The shop's key, as list_product_shops or list_product_offers reports it."),
};

const listOutput = <T extends z.ZodTypeAny>(row: T) => ({ data: z.array(row), nextCursor: NextCursorSchema });

export function registerProductTools(server: McpServer, { client }: ToolContext): void {
  server.registerTool(
    "get_product_shelf",
    {
      title: "Read how often ChatGPT's product boxes carry the client's shop",
      description:
        "How the project's shop does in the product boxes ChatGPT shows next to its answers: its share of the " +
        "shelf positions, its presence (the share of boxes that carried it), the shops that appear ahead of " +
        "it, and the same figures per prompt and per week. share and presence are null when no prompt had a " +
        "box. One object, not a list.\n\n" +
        PRODUCTS_SCOPE,
      annotations: READ_ONLY,
      inputSchema: productScopeShape,
      outputSchema: ProductShelfSchema.shape,
    },
    async ({ projectId, ...query }) =>
      handled(async () => {
        const shelf = await client.getProductShelf(projectId, query);
        return ok(shelf);
      })
  );

  server.registerTool(
    "list_product_shops",
    {
      title: "List the shops ChatGPT's product boxes show",
      description:
        "The shops that appeared in ChatGPT's product boxes in the period, with their share of the shelf " +
        "positions, their presence (the share of boxes that carried them) and how many boxes and positions they held. Order is the app's top-shops order, not an " +
        "ascending or alphabetical one. Mean position and first places are only in get_product_shop.\n\n" +
        PRODUCTS_SCOPE,
      annotations: READ_ONLY,
      inputSchema: { ...productScopeShape, ...limitShape },
      outputSchema: listOutput(ProductShopSchema),
    },
    async ({ projectId, ...query }) =>
      handled(async () => {
        const page = await client.listProductShops(projectId, query);
        return ok(page);
      })
  );

  server.registerTool(
    "get_product_shop",
    {
      title: "Read one shop in ChatGPT's product boxes",
      description:
        "One shop's figures in the product boxes: its share, presence, mean position, first places, and the " +
        "same per prompt and per week. presence is null when no box carried the shop, and share is null for the " +
        "client's own shop when it is outside the top shops. For the client's own shop it also names the shops " +
        "that appear ahead of it; for any other shop that list is empty. Only the top shops and the client's " +
        "own shop can be read: any other shopKey, like an unknown one, is a not-found error.\n\n" +
        PRODUCTS_SCOPE,
      annotations: READ_ONLY,
      inputSchema: { ...productScopeShape, ...shopKeyShape },
      outputSchema: ProductShopDetailSchema.shape,
    },
    async ({ projectId, shopKey, ...query }) =>
      handled(async () => {
        const shop = await client.getProductShop(projectId, shopKey, query);
        return ok(shop);
      })
  );

  server.registerTool(
    "list_products",
    {
      title: "List the products ChatGPT showed",
      description:
        "The products ChatGPT showed in the period, with how many answers showed each, the client's position " +
        "and price among the offers, the cheapest offer and the gap to it. Narrow with `mine` (only products " +
        "the client's shop offers), `shop` (the cheapest offer is this shopKey) and `q` (title contains this " +
        "text). Offers per shop come from list_product_offers.\n\n" +
        PRODUCTS_SCOPE,
      annotations: READ_ONLY,
      inputSchema: {
        ...productScopeShape,
        mine: z.boolean().optional().describe("true = only products the client's shop offers, false = only products it does not sell. Omit for both."),
        shop: z.string().min(1).optional().describe("Only products whose cheapest offer is from this shopKey."),
        q: z.string().min(1).optional().describe("Only products whose title contains this text, ignoring case and accents."),
        ...limitShape,
      },
      outputSchema: listOutput(ProductSchema),
    },
    async ({ projectId, ...query }) =>
      handled(async () => {
        const page = await client.listProducts(projectId, query);
        return ok(page);
      })
  );

  server.registerTool(
    "get_product",
    {
      title: "Read one product ChatGPT showed",
      description:
        "One product's row, the same fields list_products gives. An unknown productKey is a not-found error.\n\n" +
        PRODUCTS_SCOPE,
      annotations: READ_ONLY,
      inputSchema: { ...productScopeShape, ...productKeyShape },
      outputSchema: ProductSchema.shape,
    },
    async ({ projectId, productKey, ...query }) =>
      handled(async () => {
        const product = await client.getProduct(projectId, productKey, query);
        return ok(product);
      })
  );

  server.registerTool(
    "list_product_offers",
    {
      title: "List the offers behind the products ChatGPT showed",
      description:
        "The shop offers ChatGPT listed for products: shop, position, price, condition, whether it is the " +
        "client's and whether it is the cheapest, with the gap to the cheapest. Give `productKey` or " +
        "`mine=true`; a call with neither fails with a 400, because the offers of every product are not " +
        "available in one call. `shopKey` narrows further to one shop. An unknown productKey is a not-found " +
        "error; a product with no offer list yet gives no rows. With `mine=false` and a productKey of a client's " +
        "product the list is empty. The list stops at `limit` offers and reads at most the first 50 products, " +
        "so with `mine` or `shopKey` it may not cover every product.\n\n" +
        PRODUCTS_SCOPE,
      annotations: READ_ONLY,
      inputSchema: {
        ...productScopeShape,
        productKey: productKeyShape.productKey.optional(),
        shopKey: shopKeyShape.shopKey.optional(),
        mine: z
          .boolean()
          .optional()
          .describe("true = the offers of the products the client sells, false = of the products it does not. Without productKey it must be true."),
        ...limitShape,
      },
      outputSchema: listOutput(ProductOfferSchema),
    },
    async ({ projectId, ...query }) =>
      handled(async () => {
        const page = await client.listProductOffers(projectId, query);
        return ok(page);
      })
  );

  server.registerTool(
    "list_product_ratings",
    {
      title: "List product ratings against the typical product",
      description:
        "Customer ratings, one row per product the client sells: rating, range, reviews, how often it was " +
        "measured, and how it compares with the typical rating of the competitors in its prompt group. " +
        "`belowTypical=true` keeps only the products rated below typical. A producer project answers with an " +
        "empty list.\n\n" +
        PRODUCTS_SCOPE,
      annotations: READ_ONLY,
      inputSchema: {
        ...productScopeShape,
        belowTypical: z.boolean().optional().describe("true = only products rated below the typical rating, false = only the others. Omit for both."),
        ...limitShape,
      },
      outputSchema: listOutput(ProductRatingSchema),
    },
    async ({ projectId, ...query }) =>
      handled(async () => {
        const page = await client.listProductRatings(projectId, query);
        return ok(page);
      })
  );

  server.registerTool(
    "list_product_issues",
    {
      title: "List problems with how the shop appears in product answers",
      description:
        "The problems the app flags, heaviest first: `price` (ChatGPT shows a price that differs from the " +
        "feed), `stock` (the page and the feed disagree on availability) and `shelf_drop` (the shop's share " +
        "of a prompt group or of the whole project fell between the last two weeks). Each row gives what it was before and after, how many answers " +
        "were affected and a weight equal to that count. Price and stock rows come from at most 5,000 matched feed " +
        "products each, mismatches first, so a larger feed is listed in part. Issues follow the owner of the " +
        "key's product alert settings: a type switched off in the app returns no rows. Sorted by weight descending, a tie puts stock before price before shelf_drop. " +
        "`type` keeps one kind. No comparable weeks or no feed means no rows of that kind.\n\n" +
        PRODUCTS_SCOPE,
      annotations: READ_ONLY,
      inputSchema: {
        ...productScopeShape,
        type: z.enum(PRODUCT_ISSUE_TYPES).optional().describe("Only issues of this type."),
        ...limitShape,
      },
      outputSchema: listOutput(ProductIssueSchema),
    },
    async ({ projectId, ...query }) =>
      handled(async () => {
        const page = await client.listProductIssues(projectId, query);
        return ok(page);
      })
  );
}
