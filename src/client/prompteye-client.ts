import type { DateRange, ModelKey, Page } from "../schemas/common.js";
import type {
  AcceptPromptSuggestionInput,
  AcceptedPromptSuggestion,
  Account,
  AnalyticsPage,
  AnalyticsSource,
  Answer,
  AnalyticsSummary,
  Audit,
  AuditUsage,
  BrandAnalysisAvailability,
  BrandAnalysisRun,
  Category,
  CitedDomain,
  CitedPage,
  Competitor,
  CompetitorExclusion,
  ContentBrief,
  CreateAuditInput,
  CreateCategoryInput,
  CreateContentBriefInput,
  CreateFeedbackInput,
  CreateProjectInput,
  CreatePromptGroupInput,
  CreateReportInput,
  CreateTopicalMapInput,
  Feedback,
  GoogleStatus,
  IntegrationsStatus,
  KnowledgeBase,
  List,
  NewPrompt,
  Project,
  Prompt,
  PromptDetail,
  PromptGroup,
  PromptGroupSettings,
  PromptInput,
  PromptSettings,
  PromptSuggestion,
  RegenerateTopicalMapClusterInput,
  Report,
  ReportDetail,
  SearchPage,
  SearchQuery,
  SearchSummary,
  SuggestionRun,
  SuggestionRunAvailability,
  TopicalMap,
  TopicalMapSummary,
  TrafficCountPage,
  TrafficCrawl,
  TrafficCrawlHealth,
  TrafficEvent,
  TrafficGroup,
  TrafficKind,
  TrafficSitemapPage,
  UpdateKnowledgeBaseInput,
  UpdateProjectInput,
  UpdatePromptGroupInput,
  UpdatePromptInput,
  Workspace,
} from "../schemas/prompteye.js";

export type PageQuery = { limit?: number; cursor?: string };

export type RangeQuery = DateRange & { model?: ModelKey };

export type ProjectQuery = { workspaceId?: string };

/** Narrows a ranking to one prompt, group or category; give at most one of them. */
export type PromptScopeQuery = { promptId?: string; groupId?: string; categoryId?: string; subcategoryId?: string };

/** Sources rank rather than page: `limit` strongest domains, no cursor. */
export type SourceQuery = RangeQuery & PromptScopeQuery & { limit?: number };

/** Source pages take no prompt scope; the API rejects it. */
export type SourcePageQuery = RangeQuery & { limit?: number };

export type AnswerQuery = DateRange &
  PageQuery & {
    resultId?: string;
    promptId?: string;
    model?: ModelKey;
    brand?: "named" | "missing";
    search?: string;
  };

export type CompetitorQuery = RangeQuery & PromptScopeQuery & { limit?: number };

export type PromptQuery = DateRange & PageQuery & { groupId?: string; categoryId?: string };

export type PromptGroupQuery = DateRange & PageQuery;

export type SuggestionQuery = { groupId?: string };

/** A Search Console ranking: the period, and how many rows to rank. */
export type SearchRankingQuery = DateRange & { limit?: number };

/**
 * Narrows a reading of the AI traffic to one assistant, matched without regard
 * to case against the referrer: `openai` also matches chatgpt, `anthropic`
 * matches claude, `google` matches gemini, `microsoft` matches copilot and bing.
 */
export type AiTrafficQuery = DateRange & { assistant?: string };

export type AiTrafficRankingQuery = AiTrafficQuery & { limit?: number };

/**
 * Narrows a reading of the bot traffic. `vendor` is the company running the
 * crawler, from a closed list — not the `assistant` of the Google endpoints.
 */
export type BotTrafficFilters = {
  kind?: TrafficKind;
  vendor?: string;
  botId?: string;
  status?: string;
  path?: string;
};

export type BotVisitQuery = DateRange & BotTrafficFilters & PageQuery;
export type BotCountQuery = DateRange & BotTrafficFilters & { groupBy: TrafficGroup; limit?: number };
export type CrawlHealthQuery = DateRange & { kind: TrafficKind; vendor?: string };
export type CrawlQuery = PageQuery & Omit<BotTrafficFilters, "status">;
export type SitemapQuery = PageQuery & { active?: "true" | "false" };

export type AuditUsageQuery = { projectId?: string };

/**
 * Every call the MCP server makes against PromptEye, shaped exactly as the API
 * answers. Tools depend on this interface and never on a transport.
 */
export interface PromptEyeClient {
  getAccount(): Promise<Account>;
  listWorkspaces(query: PageQuery): Promise<Page<Workspace>>;
  listProjects(query?: ProjectQuery): Promise<List<Project>>;
  getProject(projectId: string): Promise<Project>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(projectId: string, input: UpdateProjectInput): Promise<Project>;
  getKnowledgeBase(projectId: string): Promise<KnowledgeBase>;
  updateKnowledgeBase(projectId: string, input: UpdateKnowledgeBaseInput): Promise<KnowledgeBase>;
  listCategories(projectId: string): Promise<List<Category>>;
  createCategory(projectId: string, input: CreateCategoryInput): Promise<Category>;
  listPromptSuggestions(projectId: string, query: SuggestionQuery): Promise<List<PromptSuggestion>>;
  acceptPromptSuggestion(
    projectId: string,
    suggestionId: string,
    input: AcceptPromptSuggestionInput
  ): Promise<AcceptedPromptSuggestion>;
  getPromptSuggestionAvailability(projectId: string, groupId: string): Promise<SuggestionRunAvailability>;
  generatePromptSuggestions(projectId: string, groupId: string): Promise<SuggestionRun>;

  listPrompts(projectId: string, query: PromptQuery): Promise<Page<Prompt>>;
  getPrompt(projectId: string, promptId: string, range: DateRange): Promise<PromptDetail>;
  addPrompts(projectId: string, prompts: PromptInput[]): Promise<List<NewPrompt>>;
  updatePrompt(projectId: string, promptId: string, input: UpdatePromptInput): Promise<PromptSettings>;
  listPromptGroups(projectId: string, query: PromptGroupQuery): Promise<Page<PromptGroup>>;
  createPromptGroup(projectId: string, input: CreatePromptGroupInput): Promise<PromptGroupSettings>;
  updatePromptGroup(projectId: string, groupId: string, input: UpdatePromptGroupInput): Promise<PromptGroupSettings>;
  deletePromptGroup(projectId: string, groupId: string): Promise<void>;

  listCompetitors(projectId: string, query: CompetitorQuery): Promise<Page<Competitor>>;
  listCompetitorExclusions(projectId: string): Promise<List<CompetitorExclusion>>;
  replaceCompetitorExclusions(
    projectId: string,
    exclusions: Array<{ name: string; aliases?: string[] }>
  ): Promise<List<CompetitorExclusion>>;

  /** The lead-magnet reports: generated through a public endpoint, read with the key. */
  createReport(input: CreateReportInput): Promise<{ report: Report; reused: boolean }>;
  listReports(query: PageQuery): Promise<Page<Report>>;
  getReport(reportId: string): Promise<ReportDetail>;

  createContentBrief(input: CreateContentBriefInput): Promise<ContentBrief>;
  getContentBrief(briefId: string): Promise<ContentBrief>;

  reportMissingCapability(input: CreateFeedbackInput): Promise<Feedback>;

  /**
   * What Google reports for the project's own site, which is a different
   * measurement from anything above: visibility counts answers that named the
   * brand, this counts people who arrived. `getGoogleStatus` says whether
   * either integration is bound — without it, zeros are ambiguous.
   */
  getGoogleStatus(projectId: string): Promise<GoogleStatus>;
  getSearchSummary(projectId: string, query: DateRange): Promise<SearchSummary>;
  listSearchQueries(projectId: string, query: SearchRankingQuery): Promise<Page<SearchQuery>>;
  listSearchPages(projectId: string, query: SearchRankingQuery): Promise<Page<SearchPage>>;
  getAiTrafficSummary(projectId: string, query: AiTrafficQuery): Promise<AnalyticsSummary>;
  listAiTrafficSources(projectId: string, query: AiTrafficRankingQuery): Promise<Page<AnalyticsSource>>;
  listAiTrafficPages(projectId: string, query: AiTrafficRankingQuery): Promise<Page<AnalyticsPage>>;

  /**
   * What bots did on the site. Read alongside the Google figures: these count
   * the machines that read the pages, those the people who then arrived.
   */
  listBotVisits(projectId: string, query: BotVisitQuery): Promise<Page<TrafficEvent>>;
  countBotVisits(projectId: string, query: BotCountQuery): Promise<TrafficCountPage>;
  getCrawlHealth(projectId: string, query: CrawlHealthQuery): Promise<TrafficCrawlHealth>;
  listCrawls(projectId: string, query: CrawlQuery): Promise<Page<TrafficCrawl>>;
  /** Takes no period: the sitemap is a standing inventory. */
  getSitemap(projectId: string, query: SitemapQuery): Promise<TrafficSitemapPage>;
  getIntegrationsStatus(projectId: string): Promise<IntegrationsStatus>;

  listSources(projectId: string, query: SourceQuery): Promise<Page<CitedDomain>>;
  listSourcePages(projectId: string, query: SourcePageQuery): Promise<Page<CitedPage>>;

  listAnswers(projectId: string, query: AnswerQuery): Promise<Page<Answer>>;

  createBrandAnalysisRun(projectId: string): Promise<BrandAnalysisRun>;
  getBrandAnalysisAvailability(projectId: string): Promise<BrandAnalysisAvailability>;
  getBrandAnalysisRun(projectId: string, runId: string): Promise<BrandAnalysisRun>;

  createAudit(input: CreateAuditInput): Promise<Audit>;
  getAudit(auditId: string): Promise<Audit>;
  getAuditUsage(query: AuditUsageQuery): Promise<AuditUsage>;

  createTopicalMap(projectId: string, input: CreateTopicalMapInput): Promise<TopicalMap>;
  listTopicalMaps(projectId: string): Promise<List<TopicalMapSummary>>;
  getTopicalMap(projectId: string, mapId: string): Promise<TopicalMap>;
  regenerateTopicalMapCluster(
    projectId: string,
    mapId: string,
    input: RegenerateTopicalMapClusterInput
  ): Promise<TopicalMap>;
}
