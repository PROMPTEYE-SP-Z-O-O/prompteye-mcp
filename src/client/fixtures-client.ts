import {
  DEFAULT_LIMIT,
  type Metrics,
  type ModelKey,
  type Page,
  type ResolvedRange,
} from "../schemas/common.js";
import type {
  Account,
  Answer,
  Category,
  CitationQuality,
  CitedDomain,
  Competitor,
  KnowledgeBase,
  List,
  Project,
  Prompt,
  PromptDetail,
  PromptGroup,
  PromptSuggestion,
  VisibilityRow,
  VisibilitySummary,
} from "../schemas/prompteye.js";
import { PromptEyeApiError } from "../api/index.js";
import * as fixtures from "../fixtures/prompteye.js";
import type {
  AnswerQuery,
  CompetitorQuery,
  PageQuery,
  PromptEyeClient,
  PromptGroupQuery,
  PromptQuery,
  SourceQuery,
  SuggestionQuery,
  VisibilityQuery,
  VisibilitySummaryQuery,
} from "./prompteye-client.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const notFound = (what: string): PromptEyeApiError =>
  new PromptEyeApiError(404, { error: { code: "not_found", message: `${what} does not exist.` } });

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

/** Ranks rather than lists: the strongest `limit` entries, no cursor to walk. */
function ranked<T>(all: T[], limit: number | undefined): Page<T> {
  return { data: all.slice(0, limit ?? DEFAULT_LIMIT), nextCursor: null };
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
 * Answers every call from the sample data in `src/fixtures`, computing the
 * derived figures — totals, period-over-period change, breakdowns — the way the
 * API is specified to.
 *
 * The calls the API already serves check the project exists among the sample
 * projects, as the API would. The others accept any project id: next to the live
 * API they are handed real project ids, and still have to answer.
 */
export function createFixturesClient(): PromptEyeClient {
  const projectById = (projectId: string): Project => {
    const project = fixtures.projects.find((candidate) => candidate.id === projectId);
    if (!project) throw notFound(`Project ${projectId}`);
    return project;
  };

  return {
    async getAccount(): Promise<Account> {
      return fixtures.account;
    },

    async listProjects(): Promise<List<Project>> {
      return { data: fixtures.projects };
    },

    async getProject(projectId: string): Promise<Project> {
      return projectById(projectId);
    },

    async getKnowledgeBase(projectId: string): Promise<KnowledgeBase> {
      projectById(projectId);
      return fixtures.knowledgeBase;
    },

    async listCategories(projectId: string): Promise<List<Category>> {
      projectById(projectId);
      return { data: fixtures.categories };
    },

    async listPromptSuggestions(projectId: string, query: SuggestionQuery): Promise<List<PromptSuggestion>> {
      projectById(projectId);
      return {
        data: fixtures.promptSuggestions.filter(
          (suggestion) => query.groupId === undefined || suggestion.groupId === query.groupId
        ),
      };
    },

    async listPrompts(_projectId: string, query: PromptQuery): Promise<Page<Prompt>> {
      const matching = fixtures.prompts.filter(
        (prompt) =>
          (query.groupId === undefined || prompt.groupId === query.groupId) &&
          (query.categoryId === undefined ||
            fixtures.categories.some(
              (category) => category.id === query.categoryId && prompt.categories.includes(category.name)
            ))
      );
      return paginate(matching, query);
    },

    async getPrompt(_projectId: string, promptId: string, _range: ResolvedRange): Promise<PromptDetail> {
      const prompt = fixtures.prompts.find((candidate) => candidate.id === promptId);
      if (!prompt) throw notFound(`Prompt ${promptId}`);
      return { ...prompt, byModel: fixtures.promptsByModel[promptId] ?? [] };
    },

    async listPromptGroups(_projectId: string, query: PromptGroupQuery): Promise<Page<PromptGroup>> {
      return paginate(fixtures.promptGroups, query);
    },

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

    async listCompetitors(_projectId: string, query: CompetitorQuery): Promise<Page<Competitor>> {
      const ranking = [...fixtures.competitors].sort(
        (a, b) => (b.shareOfVoice ?? -1) - (a.shareOfVoice ?? -1)
      );
      return ranked(ranking, query.limit);
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

    async listSources(_projectId: string, query: SourceQuery): Promise<Page<CitedDomain>> {
      const ranking = [...fixtures.citedDomains].sort((a, b) => b.citations - a.citations);
      return ranked(ranking, query.limit);
    },

    async getCitationQuality(_projectId: string): Promise<CitationQuality> {
      return fixtures.citationQuality;
    },
  };
}
