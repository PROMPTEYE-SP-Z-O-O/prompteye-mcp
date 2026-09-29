import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FeedbackSchema } from "../schemas/prompteye.js";
import { WRITES, handled, ok, type ToolContext } from "./result.js";

export function registerFeedbackTools(server: McpServer, { client, session }: ToolContext): void {
  server.registerTool(
    "report_missing_capability",
    {
      title: "Tell the PromptEye team about a missing capability",
      description:
        "Sends the PromptEye team a short note that the user needs something this server or the " +
        "PromptEye API cannot do today.\n\n" +
        "Use it only when the user wants the PromptEye team to know about the gap. Ask the user " +
        "first and send nothing until they agree in this conversation; never send a report on your " +
        "own initiative.\n\n" +
        "Send only a short description of the need and of what you were trying to do. Never include " +
        "conversation transcripts, quoted messages, figures from the workspace or personal data such " +
        "as names, email addresses or phone numbers.",
      annotations: WRITES,
      inputSchema: {
        need: z
          .string()
          .min(1)
          .max(2000)
          .describe(
            "What the user needs that the server cannot do, in a few plain sentences. No transcripts " +
              "and no personal data."
          ),
        attemptedAction: z
          .string()
          .min(1)
          .max(500)
          .describe("What you were trying to do for the user when you hit the gap, in one short sentence."),
        projectId: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Id of the project the need concerns. Left out, the active project is sent when one is " +
              "selected, and no project otherwise."
          ),
        confirmedByUser: z
          .literal(true)
          .describe(
            "Must be true, and only set it once the user has explicitly agreed in this conversation " +
              "to send this report to the PromptEye team."
          ),
      },
      outputSchema: FeedbackSchema.shape,
    },
    async ({ need, attemptedAction, projectId }) =>
      handled(async () => {
        const feedback = await client.reportMissingCapability({
          need,
          attemptedAction,
          projectId: projectId ?? session.current()?.id,
        });

        return ok(
          `Sent to the PromptEye team [id: ${feedback.id}]. Tell the user their report was received.`,
          feedback
        );
      })
  );
}
