import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AuditSchema, AuditUsageSchema } from "../schemas/prompteye.js";
import type { Audit, AuditUrlResult } from "../schemas/prompteye.js";
import { READ_ONLY, WRITES, handled, num, ok, type ToolContext } from "./result.js";

const describeUrlResult = (result: AuditUrlResult): string => {
  if (result.status !== "success" || !result.analysis) {
    return `- ${result.url} — ${result.status}${result.error ? `: ${result.error}` : ""}`;
  }

  const checks = [
    ["How-to schema", result.analysis.howToSchema],
    ["Organisation schema", result.analysis.organisation],
    ["Breadcrumb", result.analysis.breadcrumb],
    ["FAQ schema", result.analysis.faqSchema],
  ]
    .filter(([, check]) => check !== null)
    .map(([label, check]) => `${label} ${(check as { status: boolean }).status ? "OK" : "missing"}`);

  return `- ${result.url} — success. ${checks.join(", ") || "no checks reported"}`;
};

const describeAudit = (audit: Audit): string => {
  const lines = [
    `Audit ${audit.id} — ${audit.status}` +
      `${audit.projectId ? ` (billed to project ${audit.projectId})` : ""}, ${audit.numberOfUrls} URL(s)`,
  ];

  if (audit.status === "pending") {
    lines.push("Still auditing — call get_audit again in a moment.");
    return lines.join("\n");
  }

  lines.push(...audit.results.map(describeUrlResult));
  return lines.join("\n");
};

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
        "turns `success` (or `partial`/`error`) once every URL has been checked — poll get_audit with " +
        "the returned id until it does.\n\n" +
        "projectId decides which workspace plan pays for the audit, not which project the URLs belong " +
        "to: give it to bill a project's plan, or omit it to bill the API key holder's own plan. " +
        "Either way, the audited URLs count against that plan's monthly URL quota — call " +
        "get_audit_usage first to check it, since the plan may not include the WWW audit feature at all.",
      annotations: WRITES,
      inputSchema: {
        urls: z
          .array(z.string().min(1))
          .min(1)
          .describe("The URLs to audit, in one call."),
        projectId: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Bill this audit to a project's workspace plan instead of the API key holder's own plan. " +
              "Does not have to be the active project selected in this session."
          ),
      },
      outputSchema: AuditSchema.shape,
    },
    async ({ urls, projectId }) =>
      handled(async () => {
        const audit = await client.createAudit({ urls, projectId });

        return ok(
          `Audit started for ${audit.numberOfUrls} URL(s); it is ${audit.status} — poll get_audit with ` +
            `id ${audit.id} until it turns success, partial or error.`,
          audit
        );
      })
  );

  server.registerTool(
    "get_audit_usage",
    {
      title: "Check the monthly audit URL quota",
      description:
        "How many URLs the relevant plan may audit this calendar month, how many have been audited " +
        "already, and how many remain — the same quota create_audit checks itself.\n\n" +
        "Give projectId to read the quota billed to that project's workspace; omit it to read the API " +
        "key holder's own plan.",
      annotations: READ_ONLY,
      inputSchema: {
        projectId: z
          .string()
          .min(1)
          .optional()
          .describe("Read the quota billed to this project's workspace instead of the API key holder's own plan."),
      },
      outputSchema: AuditUsageSchema.shape,
    },
    async ({ projectId }) =>
      handled(async () => {
        const usage = await client.getAuditUsage({ projectId });

        return ok(`${usage.used} of ${num(usage.limit)} URL(s) audited this month, ${usage.remaining} remaining.`, usage);
      })
  );

  server.registerTool(
    "get_audit",
    {
      title: "Read one WWW audit",
      description:
        "One audit in full: every URL that was audited and, once checked, the nine content signals " +
        "found on it — schema markup, breadcrumbs, heading structure, crawlability, authority signals, " +
        "reading level and writing style.\n\n" +
        "This is where an audit is polled until status is no longer pending — each URL carries no " +
        "analysis until its own check finishes.",
      annotations: READ_ONLY,
      inputSchema: {
        auditId: z.string().min(1).describe("Id of the audit, as create_audit reports it."),
      },
      outputSchema: AuditSchema.shape,
    },
    async ({ auditId }) =>
      handled(async () => {
        const audit = await client.getAudit(auditId);
        return ok(describeAudit(audit), audit);
      })
  );
}
