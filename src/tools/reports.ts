import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { paginationShape } from "../schemas/common.js";
import { REPORT_REACH, ReportDetailSchema, ReportSchema } from "../schemas/prompteye.js";
import type { Report } from "../schemas/prompteye.js";
import { PUBLIC_REPORTS } from "./glossary.js";
import { READ_ONLY, WRITES, fail, handled, morePages, num, ok, type ToolContext } from "./result.js";

const line = (report: Report): string =>
  `- ${report.brand}${report.domain ? ` (${report.domain})` : ""} — ${report.status}` +
  `${report.score === null ? "" : `, score ${report.score}%`}` +
  `, lead ${report.leadStatus}` +
  `${report.contactCount > 0 ? `, ${report.contactCount} contact request(s)` : ""}` +
  `${report.projectId ? ", converted to a project" : ""} [id: ${report.id}]`;

export function registerReportTools(server: McpServer, { client }: ToolContext): void {
  server.registerTool(
    "create_report",
    {
      title: "Generate a public report for a brand",
      description:
        "Generates the free visibility report an agency hands to a prospect, and emails it to the " +
        "address given. " +
        PUBLIC_REPORTS +
        "\n\nThis is the one call that does not use the API key: the endpoint is public, and the " +
        "report is booked to the account named by `agencyId`, whose lead-magnet quota it spends. Ask " +
        "the user for that id rather than guessing — for their own agency it is the account id that " +
        "get_account reports.\n\n" +
        "A report for the same domain and account generated in the last 30 days is not built again; " +
        "it is sent to the address once more, and the result says which of the two happened. A new " +
        "one comes back as `processing` with no score — the figures land minutes later, so read them " +
        "with get_report rather than promising them straight away.",
      annotations: WRITES,
      inputSchema: {
        brand: z.string().min(1).max(200).describe("The brand the report is about."),
        email: z.string().min(3).describe("Where the finished report is sent. The prospect's address."),
        agencyId: z
          .string()
          .min(1)
          .optional()
          .describe(
            "The PromptEye account the report belongs to and is billed to. Required by the API — " +
              "ask the user if it is not known; get_account reports it for their own account."
          ),
        website: z
          .string()
          .min(3)
          .optional()
          .describe("The brand's domain, without protocol. It is what a cached report is matched on."),
        country: z.string().length(2).optional().describe("Market as an ISO 3166-1 alpha-2 code, e.g. PL."),
        language: z.string().length(2).optional().describe("Language of the prompts, as a two-letter code."),
        reach: z
          .enum(REPORT_REACH)
          .optional()
          .describe(
            "How wide the brand competes, which decides the questions asked: local, regional or " +
              "national. Defaults to national."
          ),
        utm: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe("Campaign the lead came from; kept on the report and in its link."),
      },
      outputSchema: ReportSchema.extend({ reused: z.boolean() }).shape,
    },
    async ({ agencyId, ...input }) =>
      handled(async () => {
        if (!agencyId) {
          return fail(
            "agencyId is missing, and the report cannot be generated without it. It names the " +
              "PromptEye account the report belongs to and whose lead-magnet quota it spends. Ask the " +
              "user which account to book it to; if it is their own, call get_account and use the id " +
              "it reports."
          );
        }

        const { report, reused } = await client.createReport({ agencyId, ...input });

        return ok(
          [
            reused
              ? `A report for ${report.brand} was already generated in the last 30 days, so it was sent to ${report.email} again rather than built anew.`
              : `Report for ${report.brand} started; it is ${report.status} and will be emailed to ${report.email} when it is done.`,
            `Page: ${report.url}`,
            reused
              ? `Score ${num(report.score, "%")}, ready ${report.readyAt ?? "—"}.`
              : "The score and the competitor list arrive with the finished report — read them later with get_report.",
            `Report id: ${report.id}`,
          ].join("\n"),
          { ...report, reused }
        );
      })
  );

  server.registerTool(
    "list_reports",
    {
      title: "List the public reports of the account",
      description:
        "Every report this key's account has generated, newest first — the agency's lead pipeline. " +
        PUBLIC_REPORTS +
        "\n\nEach row carries the visibility score, whether the prospect asked to be contacted, and " +
        "whether the report has been converted into a tracked project. Sorting the work by " +
        "contactCount is how the interested leads are found.",
      annotations: READ_ONLY,
      inputSchema: paginationShape,
      outputSchema: { data: z.array(ReportSchema), nextCursor: z.string().nullable() },
    },
    async (args) =>
      handled(async () => {
        const page = await client.listReports(args);
        const waiting = page.data.filter((report) => report.contactCount > 0).length;

        return ok(
          (page.data.length === 0
            ? "This account has generated no public reports."
            : `${page.data.length} report(s)${waiting > 0 ? `, ${waiting} with a contact request` : ""}:\n` +
              page.data.map(line).join("\n")) + morePages(page.nextCursor),
          page
        );
      })
  );

  server.registerTool(
    "get_report",
    {
      title: "Read one public report",
      description:
        "One report in full: the score, the industry and demand behind it, the prompts that were " +
        "asked, the competitors and their scores, how each assistant answered, example answers with " +
        "their sources, and every request to be contacted that came from the report page.\n\n" +
        "Call this after create_report to see whether the report finished, and to read what it found. " +
        "A report still `processing` carries no score yet.",
      annotations: READ_ONLY,
      inputSchema: {
        reportId: z.string().min(1).describe("Id of the report, as create_report or list_reports reports it."),
      },
      outputSchema: ReportDetailSchema.shape,
    },
    async ({ reportId }) =>
      handled(async () => {
        const report = await client.getReport(reportId);

        const competitors = report.competitors
          .slice(0, 5)
          .map((competitor) => `  ${competitor.name}: ${competitor.score}%`);
        const models = report.models.map(
          (model) =>
            `  ${model.model}: ${num(model.score, "%")}, ${num(model.answers)} answer(s), position ${num(model.averagePosition)}`
        );
        const contacts = report.contacts.map(
          (contact) =>
            `  ${contact.createdAt} — ${contact.type}${contact.email ? ` (${contact.email})` : ""}` +
            `${contact.phone ? ` (${contact.phone})` : ""}${contact.meetingAt ? `, meeting ${contact.meetingAt}` : ""}`
        );

        const lines = [
          `${report.brand}${report.domain ? ` (${report.domain})` : ""} — ${report.status}, score ${num(report.score, "%")}`,
          `Industry: ${report.industry ?? "—"}. Monthly searches: ${num(report.monthlySearches)}. Reach: ${report.reach ?? "—"}.`,
          `${report.prompts.length} prompt(s) asked, ${report.examples.length} example answer(s) kept.`,
          `Page: ${report.url}`,
        ];

        if (competitors.length > 0) lines.push("Competitors:", ...competitors);
        if (models.length > 0) lines.push("By assistant:", ...models);

        lines.push(
          contacts.length > 0
            ? `Contact requests (${report.contactCount}) — this is a warm lead:`
            : "No contact request from this report yet.",
          ...contacts
        );

        lines.push(
          report.projectId
            ? `Converted into project ${report.projectId}.`
            : "Not converted into a tracked project yet; that is done in the PromptEye app."
        );

        return ok(lines.join("\n"), report);
      })
  );
}
