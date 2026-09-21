import type { ModelKey, Page, ResolvedRange } from "../schemas/common.js";
import type { BrandPresence } from "../schemas/prompteye.js";
import type {
  Account,
  AnalyticsPage,
  AnalyticsSource,
  AnalyticsSummary,
  Answer,
  Breakdown,
  Category,
  CitationQuality,
  CitedDomain,
  Competitor,
  CompetitorExclusion,
  CreateProjectInput,
  CreateReportInput,
  GoogleStatus,
  KnowledgeBase,
  List,
  NewPrompt,
  Project,
  Prompt,
  PromptDetail,
  PromptGroup,
  PromptInput,
  PromptSettings,
  PromptSuggestion,
  Report,
  ReportDetail,
  SearchPage,
  SearchQuery,
  SearchSummary,
  TrafficCountPage,
  TrafficCrawl,
  TrafficEvent,
  TrafficGroup,
  TrafficKind,
  TrafficSitemapPage,
  UpdateKnowledgeBaseInput,
  UpdateProjectInput,
  UpdatePromptInput,
  VisibilityRow,
  VisibilitySummary,
} from "../schemas/prompteye.js";

export type PageQuery = { limit?: number; cursor?: string };

export type RangeQuery = ResolvedRange & { model?: ModelKey };

export type VisibilitySummaryQuery = RangeQuery & {
  by?: Breakdown;
  limit?: number;
  promptId?: string;
};

export type VisibilityQuery = RangeQuery & PageQuery & { promptId?: string };

export type AnswerQuery = RangeQuery &
  PageQuery & { promptId?: string; brand?: BrandPresence; search?: string };

/** Sources rank rather than page: `limit` strongest domains, no cursor. */
export type SourceQuery = RangeQuery & { limit?: number };

export type CompetitorQuery = RangeQuery & { limit?: number };

export type PromptQuery = ResolvedRange & PageQuery & { groupId?: string; categoryId?: string };

export type PromptGroupQuery = ResolvedRange & PageQuery;

export type SuggestionQuery = { groupId?: string };

/** A Search Console ranking: the period, and how many rows to rank. */
export type SearchRankingQuery = ResolvedRange & { limit?: number };

/**
 * Narrows a reading of the AI traffic to one assistant, matched without regard
 * to case against the referrer: `openai` also matches chatgpt, `anthropic`
 * matches claude, `google` matches gemini, `microsoft` matches copilot and bing.
 */
export type AiTrafficQuery = ResolvedRange & { assistant?: string };

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

export type BotVisitQuery = ResolvedRange & BotTrafficFilters & PageQuery;
export type BotCountQuery = ResolvedRange & BotTrafficFilters & { groupBy: TrafficGroup; limit?: number };
export type CrawlQuery = PageQuery & Omit<BotTrafficFilters, "status">;
export type SitemapQuery = PageQuery & { active?: "true" | "false" };

/**
 * Every call the MCP server makes against PromptEye.
 *
 * Tools depend on this interface and never on a transport. The first block is
 * served by the PromptEye API and shaped exactly as it answers; the rest is
 * answered from sample data until the API grows those endpoints.
 */
export interface PromptEyeClient {
  getAccount(): Promise<Account>;
  listProjects(): Promise<List<Project>>;
  getProject(projectId: string): Promise<Project>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(projectId: string, input: UpdateProjectInput): Promise<Project>;
  getKnowledgeBase(projectId: string): Promise<KnowledgeBase>;
  updateKnowledgeBase(projectId: string, input: UpdateKnowledgeBaseInput): Promise<KnowledgeBase>;
  listCategories(projectId: string): Promise<List<Category>>;
  listPromptSuggestions(projectId: string, query: SuggestionQuery): Promise<List<PromptSuggestion>>;

  listPrompts(projectId: string, query: PromptQuery): Promise<Page<Prompt>>;
  getPrompt(projectId: string, promptId: string, range: ResolvedRange): Promise<PromptDetail>;
  addPrompts(projectId: string, prompts: PromptInput[]): Promise<List<NewPrompt>>;
  updatePrompt(projectId: string, promptId: string, input: UpdatePromptInput): Promise<PromptSettings>;
  listPromptGroups(projectId: string, query: PromptGroupQuery): Promise<Page<PromptGroup>>;

  getVisibilitySummary(projectId: string, query: VisibilitySummaryQuery): Promise<VisibilitySummary>;
  getVisibility(projectId: string, query: VisibilityQuery): Promise<Page<VisibilityRow>>;

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

  /**
   * What Google reports for the project's own site, which is a different
   * measurement from anything above: visibility counts answers that named the
   * brand, this counts people who arrived. `getGoogleStatus` says whether
   * either integration is bound — without it, zeros are ambiguous.
   */
  getGoogleStatus(projectId: string): Promise<GoogleStatus>;
  getSearchSummary(projectId: string, query: ResolvedRange): Promise<SearchSummary>;
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
  listCrawls(projectId: string, query: CrawlQuery): Promise<Page<TrafficCrawl>>;
  /** Takes no period: the sitemap is a standing inventory. */
  getSitemap(projectId: string, query: SitemapQuery): Promise<TrafficSitemapPage>;

  listAnswers(projectId: string, query: AnswerQuery): Promise<Page<Answer>>;
  listSources(projectId: string, query: SourceQuery): Promise<Page<CitedDomain>>;
  /** Takes no period: the API reports the latest analysis it has. */
  getCitationQuality(projectId: string): Promise<CitationQuality>;
}
