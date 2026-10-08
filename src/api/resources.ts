import type { HttpClient, RequestOptions } from "./http.js";
import {
  AcceptedPromptSuggestionSchema,
  AccountSchema,
  AnalyticsPagePageSchema,
  AnalyticsSourcePageSchema,
  AnalyticsSummarySchema,
  AnswerPageSchema,
  AuditSchema,
  AuditUsageSchema,
  BrandAnalysisAvailabilitySchema,
  BrandAnalysisRunSchema,
  CategoryListSchema,
  CategorySchema,
  CitedDomainPageSchema,
  CitedPagePageSchema,
  CompetitorExclusionListSchema,
  CompetitorPageSchema,
  ContentBriefSchema,
  FeedbackSchema,
  GoogleStatusSchema,
  IntegrationsStatusSchema,
  KnowledgeBaseSchema,
  NewPromptListSchema,
  ProjectListSchema,
  ProjectSchema,
  PublicLinkSchema,
  PromptDetailSchema,
  PromptGroupPageSchema,
  PromptGroupSettingsSchema,
  PromptPageSchema,
  PromptSettingsSchema,
  PromptSuggestionListSchema,
  ReportDetailSchema,
  ReportPageSchema,
  ReportSchema,
  SearchPagePageSchema,
  SearchQueryPageSchema,
  SearchSummarySchema,
  SuggestionRunAvailabilitySchema,
  SuggestionRunSchema,
  TopicalMapListSchema,
  TopicalMapSchema,
  TrafficCountPageSchema,
  TrafficCrawlHealthSchema,
  TrafficCrawlPageSchema,
  TrafficEventPageSchema,
  TrafficSitemapPageSchema,
  WorkspacePageSchema,
  type AcceptPromptSuggestionInput,
  type AcceptedPromptSuggestion,
  type Account,
  type Answer,
  type AnalyticsPage,
  type AnalyticsSource,
  type AnalyticsSummary,
  type Audit,
  type AuditUsage,
  type BrandAnalysisAvailability,
  type BrandAnalysisRun,
  type Category,
  type CitedDomain,
  type CitedPage,
  type Competitor,
  type CompetitorExclusion,
  type ContentBrief,
  type CreateAuditInput,
  type CreateCategoryInput,
  type CreateContentBriefInput,
  type CreateFeedbackInput,
  type CreateProjectInput,
  type CreatePromptGroupInput,
  type CreateReportInput,
  type CreateTopicalMapInput,
  type Feedback,
  type GoogleStatus,
  type IntegrationsStatus,
  type Report,
  type ReportDetail,
  type KnowledgeBase,
  type List,
  type NewPrompt,
  type Page,
  type Project,
  type Prompt,
  type PromptDetail,
  type PromptGroup,
  type PromptGroupSettings,
  type PromptInput,
  type PromptSettings,
  type PromptSuggestion,
  type RegenerateTopicalMapClusterInput,
  type SearchPage,
  type SearchQuery,
  type SearchSummary,
  type SuggestionRun,
  type SuggestionRunAvailability,
  type TopicalMap,
  type TopicalMapSummary,
  type TrafficCountPage,
  type TrafficCrawl,
  type TrafficCrawlHealth,
  type TrafficEvent,
  type TrafficGroup,
  type TrafficKind,
  type TrafficSitemapPage,
  type UpdateKnowledgeBaseInput,
  type UpdateProjectInput,
  type PublicLink,
  type UpdatePromptGroupInput,
  type UpdatePromptInput,
  type Workspace,
} from "./schemas.js";

const projectPath = (projectId: string): string => `/v1/projects/${encodeURIComponent(projectId)}`;

const promptGroupPath = (projectId: string, groupId: string): string =>
  `${projectPath(projectId)}/groups/${encodeURIComponent(groupId)}`;

const suggestionsPath = (projectId: string, groupId: string): string =>
  `${projectPath(projectId)}/prompt-groups/${encodeURIComponent(groupId)}/suggestions`;

/** The period a listing reports on. Defaults to the last 30 days. */
export type DateRange = { startDate?: string; endDate?: string };

/** `limit` at most 200, `cursor` the `nextCursor` of the previous page. */
export type Pagination = { limit?: number; cursor?: string };

export class AccountResource {
  constructor(private readonly http: HttpClient) {}

  /** `GET /v1/me` — the account the token belongs to, its plan and the token's scopes. */
  get(options?: RequestOptions): Promise<Account> {
    return this.http.get("/v1/me", AccountSchema, options);
  }
}

export class WorkspacesResource {
  constructor(private readonly http: HttpClient) {}

  list(params: Pagination = {}, options?: RequestOptions): Promise<Page<Workspace>> {
    return this.http.get("/v1/workspaces", WorkspacePageSchema, { ...options, query: params });
  }
}

export type ProjectListParams = { workspaceId?: string };

export class ProjectsResource {
  constructor(private readonly http: HttpClient) {}

  /** `GET /v1/projects` — every project the token reaches, newest first. */
  list(params: ProjectListParams = {}, options?: RequestOptions): Promise<List<Project>> {
    return this.http.get("/v1/projects", ProjectListSchema, { ...options, query: params });
  }

  /** `GET /v1/projects/{projectId}` */
  get(projectId: string, options?: RequestOptions): Promise<Project> {
    return this.http.get(projectPath(projectId), ProjectSchema, options);
  }

  /** `POST /v1/projects` — one brand tracked in one market. */
  create(input: CreateProjectInput, options?: RequestOptions): Promise<Project> {
    return this.http.post("/v1/projects", input, ProjectSchema, options);
  }

  /** `PATCH /v1/projects/{projectId}` — correct what the project tracks. */
  update(projectId: string, input: UpdateProjectInput, options?: RequestOptions): Promise<Project> {
    return this.http.patch(projectPath(projectId), input, ProjectSchema, options);
  }

  /** `PUT /v1/projects/{projectId}/public-link` — share the project under a public link, or take it down. */
  setPublicLink(projectId: string, enabled: boolean, options?: RequestOptions): Promise<PublicLink> {
    return this.http.put(`${projectPath(projectId)}/public-link`, { enabled }, PublicLinkSchema, options);
  }
}

export class KnowledgeBaseResource {
  constructor(private readonly http: HttpClient) {}

  /** `GET /v1/projects/{projectId}/knowledge-base` — what the project knows about the brand. */
  get(projectId: string, options?: RequestOptions): Promise<KnowledgeBase> {
    return this.http.get(`${projectPath(projectId)}/knowledge-base`, KnowledgeBaseSchema, options);
  }

  /** `PATCH /v1/projects/{projectId}/knowledge-base` — describe the brand better. */
  update(projectId: string, input: UpdateKnowledgeBaseInput, options?: RequestOptions): Promise<KnowledgeBase> {
    return this.http.patch(`${projectPath(projectId)}/knowledge-base`, input, KnowledgeBaseSchema, options);
  }
}

export class CategoriesResource {
  constructor(private readonly http: HttpClient) {}

  /** `GET /v1/projects/{projectId}/categories` — categories and subcategories, top-level first. */
  list(projectId: string, options?: RequestOptions): Promise<List<Category>> {
    return this.http.get(`${projectPath(projectId)}/categories`, CategoryListSchema, options);
  }

  create(projectId: string, input: CreateCategoryInput, options?: RequestOptions): Promise<Category> {
    return this.http.post(`${projectPath(projectId)}/categories`, input, CategorySchema, options);
  }
}

export class PromptsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * `GET /v1/projects/{projectId}/prompts` — the prompts of the project with their
   * figures for the period, newest first. Paused prompts are listed too.
   */
  list(
    projectId: string,
    params: DateRange & Pagination & { groupId?: string; categoryId?: string } = {},
    options?: RequestOptions
  ): Promise<Page<Prompt>> {
    return this.http.get(`${projectPath(projectId)}/prompts`, PromptPageSchema, { ...options, query: params });
  }

  /** `GET /v1/projects/{projectId}/prompts/{promptId}` — one prompt, broken down by assistant. */
  get(
    projectId: string,
    promptId: string,
    params: DateRange = {},
    options?: RequestOptions
  ): Promise<PromptDetail> {
    return this.http.get(
      `${projectPath(projectId)}/prompts/${encodeURIComponent(promptId)}`,
      PromptDetailSchema,
      { ...options, query: params }
    );
  }

  /**
   * `POST /v1/projects/{projectId}/prompts` — tracks prompts the caller wrote,
   * up to 200 in one call. A `groupName` creates the group or reuses it; there
   * is no separate group-creation endpoint.
   *
   * This deliberately bypasses PromptEye's prompt generation: what is sent here
   * is tracked verbatim, neither enriched nor replaced.
   */
  create(projectId: string, prompts: PromptInput[], options?: RequestOptions): Promise<List<NewPrompt>> {
    return this.http.post(`${projectPath(projectId)}/prompts`, { prompts }, NewPromptListSchema, options);
  }

  /** `PATCH /v1/projects/{projectId}/prompts/{promptId}` — pause, file or re-prioritise a prompt. */
  update(
    projectId: string,
    promptId: string,
    input: UpdatePromptInput,
    options?: RequestOptions
  ): Promise<PromptSettings> {
    return this.http.patch(
      `${projectPath(projectId)}/prompts/${encodeURIComponent(promptId)}`,
      input,
      PromptSettingsSchema,
      options
    );
  }
}

export class PromptGroupsResource {
  constructor(private readonly http: HttpClient) {}

  /** `GET /v1/projects/{projectId}/groups` — the groups with their figures for the period. */
  list(projectId: string, params: DateRange & Pagination = {}, options?: RequestOptions): Promise<Page<PromptGroup>> {
    return this.http.get(`${projectPath(projectId)}/groups`, PromptGroupPageSchema, {
      ...options,
      query: params,
    });
  }

  create(projectId: string, input: CreatePromptGroupInput, options?: RequestOptions): Promise<PromptGroupSettings> {
    return this.http.post(`${projectPath(projectId)}/groups`, input, PromptGroupSettingsSchema, options);
  }

  update(
    projectId: string,
    groupId: string,
    input: UpdatePromptGroupInput,
    options?: RequestOptions
  ): Promise<PromptGroupSettings> {
    return this.http.patch(promptGroupPath(projectId, groupId), input, PromptGroupSettingsSchema, options);
  }

  delete(projectId: string, groupId: string, options?: RequestOptions): Promise<void> {
    return this.http.delete(promptGroupPath(projectId, groupId), options);
  }
}

/** Narrows a ranking to one assistant, and caps how many entries come back. */
export type RankingParams = DateRange & { limit?: number; model?: string };

/**
 * Narrows a ranking to a slice of the project's prompts. Give at most one of
 * `promptId`, `groupId` or `categoryId` (with `subcategoryId` beside it);
 * combining them answers 400.
 */
export type PromptScope = { promptId?: string; groupId?: string; categoryId?: string; subcategoryId?: string };

/** A ranking that can also be scoped to one prompt, group or category. */
export type ScopedRankingParams = RankingParams & PromptScope;

export class SourcesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * `GET /v1/projects/{projectId}/sources` — the domains the assistants leaned
   * on when answering the project's prompts, most cited first.
   */
  list(projectId: string, params: ScopedRankingParams = {}, options?: RequestOptions): Promise<Page<CitedDomain>> {
    return this.http.get(`${projectPath(projectId)}/sources`, CitedDomainPageSchema, {
      ...options,
      query: params,
    });
  }

  listPages(projectId: string, params: RankingParams = {}, options?: RequestOptions): Promise<Page<CitedPage>> {
    return this.http.get(`${projectPath(projectId)}/sources/pages`, CitedPagePageSchema, {
      ...options,
      query: params,
    });
  }
}

export type AnswerParams = DateRange &
  Pagination & {
    resultId?: string;
    promptId?: string;
    model?: string;
    brand?: "named" | "missing";
    search?: string;
  };

export class AnswersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * `GET /v1/projects/{projectId}/answers` — the assistants' answers behind the
   * figures, newest first. A page ends on a whole collection run, so it can
   * hold slightly more than `limit`.
   */
  list(projectId: string, params: AnswerParams = {}, options?: RequestOptions): Promise<Page<Answer>> {
    return this.http.get(`${projectPath(projectId)}/answers`, AnswerPageSchema, {
      ...options,
      query: params,
    });
  }
}

export class CompetitorsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * `GET /v1/projects/{projectId}/competitors` — every brand named alongside the
   * project's own, ranked by visibility, then by position. The project's brand is in the list.
   */
  list(projectId: string, params: ScopedRankingParams = {}, options?: RequestOptions): Promise<Page<Competitor>> {
    return this.http.get(`${projectPath(projectId)}/competitors`, CompetitorPageSchema, {
      ...options,
      query: params,
    });
  }

  /** `GET /v1/projects/{projectId}/competitors/exclusions` — read which brands are kept out of the ranking. */
  listExclusions(projectId: string, options?: RequestOptions): Promise<List<CompetitorExclusion>> {
    return this.http.get(`${projectPath(projectId)}/competitors/exclusions`, CompetitorExclusionListSchema, options);
  }

  /** `PUT /v1/projects/{projectId}/competitors/exclusions` — set which brands are kept out of the ranking. */
  replaceExclusions(
    projectId: string,
    exclusions: Array<{ name: string; aliases?: string[] }>,
    options?: RequestOptions
  ): Promise<List<CompetitorExclusion>> {
    return this.http.put(
      `${projectPath(projectId)}/competitors/exclusions`,
      { exclusions },
      CompetitorExclusionListSchema,
      options
    );
  }
}

/**
 * The public reports an agency hands out as a free sample, and the leads they turn into.
 *
 * Creating one is the odd call in this client: the endpoint is public, so it
 * carries no key and identifies the account by `agencyId` instead — the id
 * `GET /v1/me` reports for the account the key belongs to.
 */
export class ReportsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * `POST /v1/reports` — generates a report for one brand and emails it.
   *
   * `reused` says which of the two answers came back: a fresh report that is
   * still processing, or one generated for the same domain and account within
   * the last 30 days, sent again to this address. It spends the account's
   * lead-magnet quota either way.
   */
  async create(
    input: CreateReportInput,
    options?: RequestOptions
  ): Promise<{ report: Report; reused: boolean }> {
    const { data, status } = await this.http.postAnswered("/v1/reports", input, ReportSchema, {
      ...options,
      auth: false,
    });

    return { report: data, reused: status === 200 };
  }

  /** `GET /v1/reports` — every report of the account, newest first. */
  list(params: Pagination = {}, options?: RequestOptions): Promise<Page<Report>> {
    return this.http.get("/v1/reports", ReportPageSchema, { ...options, query: params });
  }

  /** `GET /v1/reports/{reportId}` — one report with its prompts, models, examples and contacts. */
  get(reportId: string, options?: RequestOptions): Promise<ReportDetail> {
    return this.http.get(`/v1/reports/${encodeURIComponent(reportId)}`, ReportDetailSchema, options);
  }
}

export class ContentBriefsResource {
  constructor(private readonly http: HttpClient) {}

  create(input: CreateContentBriefInput, options?: RequestOptions): Promise<ContentBrief> {
    return this.http.post("/v1/content/briefs", input, ContentBriefSchema, options);
  }

  get(briefId: string, options?: RequestOptions): Promise<ContentBrief> {
    return this.http.get(`/v1/content/briefs/${encodeURIComponent(briefId)}`, ContentBriefSchema, options);
  }
}

export class PromptSuggestionsResource {
  constructor(private readonly http: HttpClient) {}

  /** `GET /v1/projects/{projectId}/prompt-suggestions` — suggestions awaiting a decision. */
  list(
    projectId: string,
    params: { groupId?: string } = {},
    options?: RequestOptions
  ): Promise<List<PromptSuggestion>> {
    return this.http.get(`${projectPath(projectId)}/prompt-suggestions`, PromptSuggestionListSchema, {
      ...options,
      query: params,
    });
  }

  accept(
    projectId: string,
    suggestionId: string,
    input: AcceptPromptSuggestionInput,
    options?: RequestOptions
  ): Promise<AcceptedPromptSuggestion> {
    return this.http.post(
      `${projectPath(projectId)}/prompt-suggestions/${encodeURIComponent(suggestionId)}/accept`,
      input,
      AcceptedPromptSuggestionSchema,
      options
    );
  }

  availability(projectId: string, groupId: string, options?: RequestOptions): Promise<SuggestionRunAvailability> {
    return this.http.get(`${suggestionsPath(projectId, groupId)}/availability`, SuggestionRunAvailabilitySchema, options);
  }

  generate(projectId: string, groupId: string, options?: RequestOptions): Promise<SuggestionRun> {
    return this.http.post(`${suggestionsPath(projectId, groupId)}/generate`, undefined, SuggestionRunSchema, options);
  }
}

export class BrandAnalysisResource {
  constructor(private readonly http: HttpClient) {}

  private path(projectId: string, rest: string): string {
    return `${projectPath(projectId)}/analysis${rest}`;
  }

  createRun(projectId: string, options?: RequestOptions): Promise<BrandAnalysisRun> {
    return this.http.post(this.path(projectId, "/runs"), undefined, BrandAnalysisRunSchema, options);
  }

  availability(projectId: string, options?: RequestOptions): Promise<BrandAnalysisAvailability> {
    return this.http.get(this.path(projectId, "/availability"), BrandAnalysisAvailabilitySchema, options);
  }

  getRun(projectId: string, runId: string, options?: RequestOptions): Promise<BrandAnalysisRun> {
    return this.http.get(this.path(projectId, `/runs/${encodeURIComponent(runId)}`), BrandAnalysisRunSchema, options);
  }
}

export type AuditUsageParams = { projectId?: string };

export class AuditsResource {
  constructor(private readonly http: HttpClient) {}

  create(input: CreateAuditInput, options?: RequestOptions): Promise<Audit> {
    return this.http.post("/v1/audits", input, AuditSchema, options);
  }

  get(auditId: string, options?: RequestOptions): Promise<Audit> {
    return this.http.get(`/v1/audits/${encodeURIComponent(auditId)}`, AuditSchema, options);
  }

  usage(params: AuditUsageParams = {}, options?: RequestOptions): Promise<AuditUsage> {
    return this.http.get("/v1/audits/usage", AuditUsageSchema, { ...options, query: params });
  }
}

export class TopicalMapsResource {
  constructor(private readonly http: HttpClient) {}

  private path(projectId: string, rest = ""): string {
    return `${projectPath(projectId)}/maps${rest}`;
  }

  create(projectId: string, input: CreateTopicalMapInput, options?: RequestOptions): Promise<TopicalMap> {
    return this.http.post(this.path(projectId), input, TopicalMapSchema, options);
  }

  list(projectId: string, options?: RequestOptions): Promise<List<TopicalMapSummary>> {
    return this.http.get(this.path(projectId), TopicalMapListSchema, options);
  }

  get(projectId: string, mapId: string, options?: RequestOptions): Promise<TopicalMap> {
    return this.http.get(this.path(projectId, `/${encodeURIComponent(mapId)}`), TopicalMapSchema, options);
  }

  regenerateCluster(
    projectId: string,
    mapId: string,
    input: RegenerateTopicalMapClusterInput,
    options?: RequestOptions
  ): Promise<TopicalMap> {
    return this.http.post(
      this.path(projectId, `/${encodeURIComponent(mapId)}/regenerate`),
      input,
      TopicalMapSchema,
      options
    );
  }
}

/** A Search Console ranking: the period, and how many rows to rank. */
export type SearchRankingParams = DateRange & { limit?: number };

/**
 * Narrows a reading of the AI traffic to one assistant. It is matched without
 * regard to case against the referrer, as the app's AI traffic screen filters
 * it: `openai` also matches chatgpt, `anthropic` matches claude, `google`
 * matches gemini and `microsoft` matches copilot and bing.
 *
 * Not the `vendor` of the bot endpoints: that one is a closed list of the
 * companies running crawlers, and the two do not take the same values.
 */
export type AiTrafficParams = DateRange & { assistant?: string };

export type AiTrafficRankingParams = AiTrafficParams & { limit?: number };

/**
 * What Google reports for the project's site: Search Console clicks and
 * impressions, and the Google Analytics sessions that came from an AI
 * assistant. Both are bound to the project in the PromptEye app.
 */
export class GoogleResource {
  constructor(private readonly http: HttpClient) {}

  private path(projectId: string, rest: string): string {
    return `${projectPath(projectId)}/traffic/google${rest}`;
  }

  /**
   * `GET /v1/projects/{projectId}/traffic/google/status` — whether either integration
   * is bound, and how its last sync went.
   *
   * Worth calling before the rest: a project with nothing bound answers the
   * other calls with zeros and empty lists, which reads exactly like a site
   * nobody visits.
   */
  status(projectId: string, options?: RequestOptions): Promise<GoogleStatus> {
    return this.http.get(this.path(projectId, "/status"), GoogleStatusSchema, options);
  }

  /** `GET /v1/projects/{projectId}/traffic/google/search` — the period's totals and its daily timeline. */
  search(projectId: string, params: DateRange = {}, options?: RequestOptions): Promise<SearchSummary> {
    return this.http.get(this.path(projectId, "/search"), SearchSummarySchema, { ...options, query: params });
  }

  /** `GET /v1/projects/{projectId}/traffic/google/search/queries` — the phrases of the period, most clicked first. */
  searchQueries(
    projectId: string,
    params: SearchRankingParams = {},
    options?: RequestOptions
  ): Promise<Page<SearchQuery>> {
    return this.http.get(this.path(projectId, "/search/queries"), SearchQueryPageSchema, {
      ...options,
      query: params,
    });
  }

  /** `GET /v1/projects/{projectId}/traffic/google/search/pages` — the pages of the period, most clicked first. */
  searchPages(
    projectId: string,
    params: SearchRankingParams = {},
    options?: RequestOptions
  ): Promise<Page<SearchPage>> {
    return this.http.get(this.path(projectId, "/search/pages"), SearchPagePageSchema, {
      ...options,
      query: params,
    });
  }

  /** `GET /v1/projects/{projectId}/traffic/google/analytics` — the sessions Analytics attributes to AI assistants. */
  analytics(
    projectId: string,
    params: AiTrafficParams = {},
    options?: RequestOptions
  ): Promise<AnalyticsSummary> {
    return this.http.get(this.path(projectId, "/analytics"), AnalyticsSummarySchema, {
      ...options,
      query: params,
    });
  }

  /** `GET /v1/projects/{projectId}/traffic/google/analytics/sources` — the assistants behind those sessions. */
  analyticsSources(
    projectId: string,
    params: AiTrafficRankingParams = {},
    options?: RequestOptions
  ): Promise<Page<AnalyticsSource>> {
    return this.http.get(this.path(projectId, "/analytics/sources"), AnalyticsSourcePageSchema, {
      ...options,
      query: params,
    });
  }

  /** `GET /v1/projects/{projectId}/traffic/google/analytics/pages` — the pages those sessions landed on. */
  analyticsPages(
    projectId: string,
    params: AiTrafficRankingParams = {},
    options?: RequestOptions
  ): Promise<Page<AnalyticsPage>> {
    return this.http.get(this.path(projectId, "/analytics/pages"), AnalyticsPagePageSchema, {
      ...options,
      query: params,
    });
  }
}

/** The period a traffic reading covers. The API caps it at 31 days, not a year. */
export const MAX_TRAFFIC_DAYS = 31;

/**
 * Narrows a reading of the bot traffic. `vendor` is the company running the
 * crawler and comes from a closed list — not the `assistant` of the Google
 * endpoints, which is matched against a referrer.
 */
export type TrafficFilters = DateRange & {
  kind?: TrafficKind;
  vendor?: string;
  botId?: string;
  /** An exact code, or a class such as `4xx`. */
  status?: string;
  /** One exact path, without the domain and starting with `/`. */
  path?: string;
};

export type TrafficEventParams = TrafficFilters & Pagination;
export type TrafficCountParams = TrafficFilters & { groupBy: TrafficGroup; limit?: number };
export type TrafficCrawlParams = Pagination & {
  kind?: TrafficKind;
  vendor?: string;
  botId?: string;
  path?: string;
};
export type TrafficSitemapParams = Pagination & { active?: "true" | "false" };
export type TrafficCrawlHealthParams = DateRange & { kind: TrafficKind; vendor?: string };

/**
 * What bots did on the tracked site. Where the Google endpoints count the
 * people who arrived, these count the machines that read the pages first.
 */
export class TrafficResource {
  constructor(private readonly http: HttpClient) {}

  private path(projectId: string, rest: string): string {
    return `${projectPath(projectId)}/traffic${rest}`;
  }

  /**
   * `GET /v1/projects/{projectId}/traffic/events` — the requests of a period,
   * newest first.
   *
   * Only the newest 4 000 requests of the period are searched, so a filter
   * that matches rarely can come back short of what the period held.
   */
  events(
    projectId: string,
    params: TrafficEventParams = {},
    options?: RequestOptions
  ): Promise<Page<TrafficEvent>> {
    return this.http.get(this.path(projectId, "/events"), TrafficEventPageSchema, {
      ...options,
      query: params,
    });
  }

  /**
   * `GET /v1/projects/{projectId}/traffic/events/count` — the same requests
   * counted by bot, path, status, day or category.
   *
   * Ranked rather than paged: the `limit` largest groups come back, and
   * `partial` says whether the period held more than could be read.
   */
  countEvents(
    projectId: string,
    params: TrafficCountParams,
    options?: RequestOptions
  ): Promise<TrafficCountPage> {
    return this.http.get(this.path(projectId, "/events/count"), TrafficCountPageSchema, {
      ...options,
      query: params,
    });
  }

  /**
   * `GET /v1/projects/{projectId}/traffic/crawls` — one row per path and bot,
   * covering everything since tracking began rather than a period.
   */
  crawls(
    projectId: string,
    params: TrafficCrawlParams = {},
    options?: RequestOptions
  ): Promise<Page<TrafficCrawl>> {
    return this.http.get(this.path(projectId, "/crawls"), TrafficCrawlPageSchema, {
      ...options,
      query: params,
    });
  }

  health(projectId: string, params: TrafficCrawlHealthParams, options?: RequestOptions): Promise<TrafficCrawlHealth> {
    return this.http.get(this.path(projectId, "/health"), TrafficCrawlHealthSchema, { ...options, query: params });
  }

  /** `GET /v1/projects/{projectId}/traffic/sitemap` — the connected sitemap and its addresses. */
  sitemap(
    projectId: string,
    params: TrafficSitemapParams = {},
    options?: RequestOptions
  ): Promise<TrafficSitemapPage> {
    return this.http.get(this.path(projectId, "/sitemap"), TrafficSitemapPageSchema, {
      ...options,
      query: params,
    });
  }
}

export class IntegrationsResource {
  constructor(private readonly http: HttpClient) {}

  status(projectId: string, options?: RequestOptions): Promise<IntegrationsStatus> {
    return this.http.get(`${projectPath(projectId)}/integrations/status`, IntegrationsStatusSchema, options);
  }
}

export class FeedbackResource {
  constructor(private readonly http: HttpClient) {}

  create(input: CreateFeedbackInput, options?: RequestOptions): Promise<Feedback> {
    return this.http.post("/v1/feedback", input, FeedbackSchema, options);
  }
}
