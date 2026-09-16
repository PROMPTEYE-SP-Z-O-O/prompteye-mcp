import type { ModelKey, Page, ResolvedRange } from "../schemas/common.js";
import type { BrandPresence } from "../schemas/prompteye.js";
import type {
  Account,
  Answer,
  Breakdown,
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
  getKnowledgeBase(projectId: string): Promise<KnowledgeBase>;
  listCategories(projectId: string): Promise<List<Category>>;
  listPromptSuggestions(projectId: string, query: SuggestionQuery): Promise<List<PromptSuggestion>>;

  listPrompts(projectId: string, query: PromptQuery): Promise<Page<Prompt>>;
  getPrompt(projectId: string, promptId: string, range: ResolvedRange): Promise<PromptDetail>;
  listPromptGroups(projectId: string, query: PromptGroupQuery): Promise<Page<PromptGroup>>;

  getVisibilitySummary(projectId: string, query: VisibilitySummaryQuery): Promise<VisibilitySummary>;
  getVisibility(projectId: string, query: VisibilityQuery): Promise<Page<VisibilityRow>>;

  listCompetitors(projectId: string, query: CompetitorQuery): Promise<Page<Competitor>>;

  listAnswers(projectId: string, query: AnswerQuery): Promise<Page<Answer>>;
  listSources(projectId: string, query: SourceQuery): Promise<Page<CitedDomain>>;
  /** Takes no period: the API reports the latest analysis it has. */
  getCitationQuality(projectId: string): Promise<CitationQuality>;
}
