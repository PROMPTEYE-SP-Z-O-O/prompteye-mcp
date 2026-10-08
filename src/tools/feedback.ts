import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FeedbackSchema } from "../schemas/prompteye.js";
import { WRITES, handled, ok, type ToolContext } from "./result.js";

export function registerFeedbackTools(server: McpServer, { client }: ToolContext): void {
  server.registerTool(
    "report_missing_capability",
    {
      title: "Tell the PromptEye team about a missing capability",
      description:
        "Sends the PromptEye team a short note from the user: something this server or the PromptEye " +
        "API cannot do today, something that does not work, or any other feedback, praise included.\n\n" +
        "Use it when something does not work, the user cannot find something they expected, the server " +
        "cannot do what they asked, or they want to share feedback with the team. Ask first and send " +
        "nothing until the user agrees in this conversation.\n\n" +
        "Send only a short description of the need and of what you were trying to do. Never include " +
        "conversation transcripts, quoted messages, figures from the workspace or personal data such " +
        "as names, email addresses or phone numbers.",
      annotations: WRITES,
      inputSchema: {
        need: z
          .string()
          .trim()
          .min(1)
          .max(2000)
          .describe(
            "What the user needs that the server cannot do, in a few plain sentences. No transcripts " +
              "and no personal data."
          ),
        attemptedAction: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .describe("What you were trying to do for the user when you hit the gap, in one short sentence."),
        confirmedByUser: z
          .literal(true)
          .describe(
            "Must be true, and only set it once the user has explicitly agreed in this conversation " +
              "to send this report to the PromptEye team."
          ),
      },
      outputSchema: FeedbackSchema.shape,
    },
    async ({ need, attemptedAction }) =>
      handled(async () => {
        const feedback = await client.reportMissingCapability({ need, attemptedAction });
        return ok(feedback);
      })
  );
}
