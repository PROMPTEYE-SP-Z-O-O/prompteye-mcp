import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AuditSchema, AuditUsageSchema } from "../schemas/prompteye.js";
import { READ_ONLY, WRITES, handled, ok, type ToolContext } from "./result.js";

const projectIdShape = (what: string) => ({
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe(
      `${what} to that project's workspace plan instead of the API key holder's own plan. ` +
        "The active project's id is what get_active_project reports. Left out, the key holder's own plan is used."
    ),
});

export function registerAuditTools(server: McpServer, { client }: ToolContext): void {
  server.registerTool(
    "create_audit",
    {
      title: "Run a WWW audit on one or more URLs",
      description:
        "Audits the given URLs for the on-page signals that help a page get cited by AI assistants: " +
        "schema markup, breadcrumbs, heading structure, crawlability, authority signals, reading level " +
        "and writing style.\n\n" +
        "Running one is instant; auditing takes under a minute. The audit comes back `pending` and " +
        "turns `success` (or `partial` / `error`) once every URL has been checked — read it with " +
        "get_audit until it does.\n\n" +
        "Give projectId to bill the audit to that project's workspace plan; leave it out to bill it to " +
        "the API key holder's own plan. Either way the audited URLs count against that plan's monthly " +
        "URL quota — get_audit_usage reads it first.",
      annotations: WRITES,
      inputSchema: {
        urls: z.array(z.string().min(1)).min(1).describe("The URLs to audit, each with its protocol."),
        ...projectIdShape("Bill the audit"),
      },
      outputSchema: AuditSchema.shape,
    },
    async (input) =>
      handled(async () => {
        const audit = await client.createAudit(input);
        return ok(audit);
      })
  );

  server.registerTool(
    "get_audit",
    {
      title: "Read one audit",
      description:
        "One audit in full: every URL that was audited and, once checked, the nine content signals found " +
        "on it. Call it after create_audit until `status` is no longer `pending` — each URL carries " +
        "`analysis` null until its own check finishes.",
      annotations: READ_ONLY,
      inputSchema: {
        auditId: z.string().min(1).describe("Id of the audit, as create_audit reports it."),
      },
      outputSchema: AuditSchema.shape,
    },
    async ({ auditId }) =>
      handled(async () => {
        const audit = await client.getAudit(auditId);
        return ok(audit);
      })
  );

  server.registerTool(
    "get_audit_usage",
    {
      title: "Check the monthly audit URL quota",
      description:
        "How many URLs the relevant plan may audit this calendar month, how many have been audited " +
        "already, and how many remain — the same quota create_audit checks itself. Give projectId to " +
        "read the quota billed to that project's workspace; leave it out for the API key holder's own plan.",
      annotations: READ_ONLY,
      inputSchema: projectIdShape("Read the quota billed"),
      outputSchema: AuditUsageSchema.shape,
    },
    async (args) =>
      handled(async () => {
        const usage = await client.getAuditUsage(args);
        return ok(usage);
      })
  );
}
