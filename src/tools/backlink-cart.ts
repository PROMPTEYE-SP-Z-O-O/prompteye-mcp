import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  AddBacklinkCartItemsResponseSchema,
  BacklinkCartItemRefSchema,
  BacklinkCartSchema,
  PLACEMENT_PROVIDERS,
} from "../schemas/prompteye.js";
import { DELETES, READ_ONLY, WRITES, handled, ok, type ToolContext } from "./result.js";
import { projectIdShape } from "./project-id.js";

const MAX_CART_ITEMS = 100;

const CART_LINK =
  "Always show the user `cartUrl`: the purchase is finished in the PromptEye app, which this server cannot do. " +
  "Prices are the ones seen when each line was added.";

export function registerBacklinkCartTools(server: McpServer, { client }: ToolContext): void {
  server.registerTool(
    "get_backlink_cart",
    {
      title: "Get the backlink cart",
      description:
        "The backlink placements picked for the project: each line with its provider, offer, page, price and " +
        "currency, the totals per currency, and `cartUrl`, the link to the cart in the PromptEye app. Use it " +
        "only when the user wants to buy backlinks or asks what is in the cart.\n\n" +
        CART_LINK,
      annotations: READ_ONLY,
      inputSchema: { ...projectIdShape },
      outputSchema: { data: BacklinkCartSchema },
    },
    async ({ projectId }) => handled(async () => ok(await client.getBacklinkCart(projectId)))
  );

  server.registerTool(
    "add_to_backlink_cart",
    {
      title: "Add placements to the backlink cart",
      description:
        "Puts backlink placements in the project's cart, up to " +
        `${MAX_CART_ITEMS} per call. Use it only when the user wants to buy backlinks. Take \`offerId\` and ` +
        "`provider` from list_sources called with includeOffers=true (data[].offer.offers[]), and set `url` " +
        "to 'https://' + the source domain. Before calling, show the user the chosen offers with their prices " +
        "and wait for their yes. Only the reference is sent: price, currency and type are read from the " +
        "marketplace. A line already in the cart is left as it is.\n\n" +
        "The answer's `rejected` lists references the marketplace has no offer for, or that are not available " +
        "to this account; the rest were added. Tell the user which were rejected. 422 means the cart is full (" +
        `${MAX_CART_ITEMS} lines): remove lines with remove_from_backlink_cart first. 402 means the workspace's ` +
        "plan or payment blocks changes; pass the API's reason on. 403 = this key or role may only read the project.\n\n" +
        CART_LINK,
      annotations: { ...WRITES, idempotentHint: true },
      inputSchema: {
        ...projectIdShape,
        items: z
          .array(BacklinkCartItemRefSchema)
          .min(1)
          .max(MAX_CART_ITEMS)
          .describe(`The offers to add, 1 to ${MAX_CART_ITEMS}.`),
      },
      outputSchema: AddBacklinkCartItemsResponseSchema.shape,
    },
    async ({ projectId, items }) => handled(async () => ok(await client.addToBacklinkCart(projectId, items)))
  );

  server.registerTool(
    "remove_from_backlink_cart",
    {
      title: "Remove a placement from the backlink cart",
      description:
        "Removes one line from the project's cart, identified by `provider`, `offerId` and `url` as " +
        "get_backlink_cart shows them. Removing a line that is not in the cart is not an error. Confirm with " +
        "the user which line to remove. 402 means the workspace's plan or payment blocks changes; pass the API's " +
        "reason on. 403 = this key or role may only read the project.\n\n" +
        CART_LINK,
      annotations: DELETES,
      inputSchema: {
        ...projectIdShape,
        provider: z.enum(PLACEMENT_PROVIDERS).describe("The marketplace of the line."),
        offerId: z.string().min(1).describe("The line's offerId."),
        url: z.string().min(1).describe("The line's url."),
      },
      outputSchema: { data: BacklinkCartSchema },
    },
    async ({ projectId, provider, offerId, url }) =>
      handled(async () => ok(await client.removeFromBacklinkCart(projectId, { provider, offerId, url })))
  );
}
