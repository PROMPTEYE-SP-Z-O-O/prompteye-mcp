import { DEFAULT_LIMIT, type Metrics, type ModelKey, type Page } from "../schemas/common.js";
import type {
  Answer,
  CitationQuality,
  VisibilityRow,
  VisibilitySummary,
} from "../schemas/prompteye.js";
import { PromptEyeApiError } from "../api/index.js";
import * as fixtures from "../fixtures/prompteye.js";
import type { FallbackClient } from "./live-client.js";
import type { AnswerQuery, PageQuery, VisibilityQuery, VisibilitySummaryQuery } from "./prompteye-client.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Cursors are opaque to callers; here they simply carry an offset. */
function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const offset = Number.parseInt(Buffer.from(cursor, "base64url").toString("utf-8"), 10);
  if (Number.isNaN(offset) || offset < 0) {
    throw new PromptEyeApiError(400, {
      error: {
        code: "invalid_request",
        message: "The request failed validation.",
        details: [{ field: "cursor", message: "Value is not a cursor this endpoint issued." }],
      },
    });
  }
  return offset;
}

function paginate<T>(all: T[], query: PageQuery): Page<T> {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const offset = decodeCursor(query.cursor);
  const data = all.slice(offset, offset + limit);
  const next = offset + limit;

  return {
    data,
    nextCursor: next < all.length ? Buffer.from(String(next), "utf-8").toString("base64url") : null,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function metricsOf(rows: VisibilityRow[]): Metrics {
  if (rows.length === 0) return { visibility: null, reachIndex: null, averagePosition: null };

  const positions = rows.map((row) => row.position).filter((p): p is number => p !== null);
  const visibility = average(rows.map((row) => row.visibility));

  return {
    visibility,
    reachIndex: Math.round(visibility * 0.93),
    averagePosition: positions.length > 0 ? average(positions) : null,
  };
}

function delta(now: number | null, before: number | null): number | null {
  if (now === null || before === null) return null;
  return Math.round((now - before) * 10) / 10;
}

/** Orders a ranking, keeping unmeasured entries last rather than treating null as zero. */
const byVisibility = (a: { metrics: Metrics }, b: { metrics: Metrics }): number =>
  (b.metrics.visibility ?? -1) - (a.metrics.visibility ?? -1);

/** The period of the same length ending the day before `startDate`. */
function previousPeriod(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const span = Date.parse(endDate) - Date.parse(startDate) + DAY_MS;
  const previousEnd = Date.parse(startDate) - DAY_MS;

  return {
    startDate: new Date(previousEnd - span + DAY_MS).toISOString().slice(0, 10),
    endDate: new Date(previousEnd).toISOString().slice(0, 10),
  };
}

function filterRows(rows: VisibilityRow[], query: { model?: ModelKey; promptId?: string }): VisibilityRow[] {
  return rows.filter(
    (row) =>
      (query.model === undefined || row.model === query.model) &&
      (query.promptId === undefined || row.promptId === query.promptId)
  );
}

type BreakdownEntry = ReturnType<typeof breakdownEntry>;

function breakdownEntry(key: string, label: string, rows: VisibilityRow[]) {
  return { key, label, metrics: metricsOf(rows) };
}

function buildBreakdown(rows: VisibilityRow[], by: NonNullable<VisibilitySummaryQuery["by"]>): BreakdownEntry[] {
  const groups = new Map<string, { label: string; rows: VisibilityRow[] }>();

  for (const row of rows) {
    const key = by === "day" ? row.date : by === "model" ? row.model : row.promptId;
    const label = by === "prompt" ? row.prompt : key;
    const group = groups.get(key) ?? { label, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  const entries = [...groups].map(([key, group]) => breakdownEntry(key, group.label, group.rows));

  // A trend reads in time order; a comparison reads strongest first.
  return by === "day"
    ? entries.sort((a, b) => a.key.localeCompare(b.key))
    : entries.sort(byVisibility);
}

/**
 * Answers the calls the PromptEye API does not serve yet from the sample data
 * in `src/fixtures`, computing the derived figures — totals, period-over-period
 * change, breakdowns — the way the API is specified to.
 *
 * Project ids are not checked against anything: these calls are handed the ids
 * of real projects, and still have to answer. Nothing here is reachable unless
 * `SAMPLE_TOOLS` in `src/server.ts` is on.
 */
export function createFixturesClient(): FallbackClient {
  return {
    async getVisibilitySummary(
      _projectId: string,
      query: VisibilitySummaryQuery
    ): Promise<VisibilitySummary> {
      const rows = filterRows(fixtures.visibilityRows(query.startDate, query.endDate), query);
      const before = previousPeriod(query.startDate, query.endDate);
      const previousRows = filterRows(fixtures.visibilityRows(before.startDate, before.endDate), query);

      const totals = metricsOf(rows);
      const previousTotals = metricsOf(previousRows);
      const limit = query.limit ?? 30;
      const all = query.by ? buildBreakdown(rows, query.by) : [];

      return {
        startDate: query.startDate,
        endDate: query.endDate,
        models: query.model ? [query.model] : fixtures.trackedModels,
        totals,
        change: {
          visibility: delta(totals.visibility, previousTotals.visibility),
          reachIndex: delta(totals.reachIndex, previousTotals.reachIndex),
          averagePosition: delta(totals.averagePosition, previousTotals.averagePosition),
        },
        aiTrafficTotal: fixtures.prompts.reduce((sum, prompt) => sum + (prompt.aiTraffic ?? 0), 0),
        breakdown: all.slice(0, limit),
        breakdownTruncated: all.length > limit,
      };
    },

    async getVisibility(_projectId: string, query: VisibilityQuery): Promise<Page<VisibilityRow>> {
      const rows = filterRows(fixtures.visibilityRows(query.startDate, query.endDate), query);
      return paginate(rows, query);
    },

    async listAnswers(_projectId: string, query: AnswerQuery): Promise<Page<Answer>> {
      const matching = fixtures.answers.filter(
        (answer) =>
          answer.date >= query.startDate &&
          answer.date <= query.endDate &&
          (query.model === undefined || answer.model === query.model) &&
          (query.promptId === undefined || answer.promptId === query.promptId) &&
          (query.brand === undefined || answer.brand === query.brand) &&
          (query.search === undefined ||
            answer.text.toLowerCase().includes(query.search.toLowerCase()) ||
            answer.prompt.toLowerCase().includes(query.search.toLowerCase()))
      );
      return paginate(matching, query);
    },

    async getCitationQuality(_projectId: string): Promise<CitationQuality> {
      return fixtures.citationQuality;
    },
  };
}
