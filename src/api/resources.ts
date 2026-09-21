import type { HttpClient, RequestOptions } from "./http.js";
import {
  AccountSchema,
  CategoryListSchema,
  CitedDomainPageSchema,
  CompetitorExclusionListSchema,
  CompetitorPageSchema,
  KnowledgeBaseSchema,
  NewPromptListSchema,
  ProjectListSchema,
  ProjectSchema,
  PromptDetailSchema,
  PromptGroupPageSchema,
  PromptPageSchema,
  PromptSettingsSchema,
  PromptSuggestionListSchema,
  ReportDetailSchema,
  ReportPageSchema,
  ReportSchema,
  type Account,
  type Category,
  type CitedDomain,
  type Competitor,
  type CompetitorExclusion,
  type CreateProjectInput,
  type CreateReportInput,
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
  type PromptInput,
  type PromptSettings,
  type PromptSuggestion,
  type UpdateKnowledgeBaseInput,
  type UpdateProjectInput,
  type UpdatePromptInput,
} from "./schemas.js";

const projectPath = (projectId: string): string => `/v1/projects/${encodeURIComponent(projectId)}`;

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

export class ProjectsResource {
  constructor(private readonly http: HttpClient) {}

  /** `GET /v1/projects` — every project the token reaches, newest first. */
  list(options?: RequestOptions): Promise<List<Project>> {
    return this.http.get("/v1/projects", ProjectListSchema, options);
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

  /** `GET /v1/projects/{projectId}/prompt-groups` — the groups with their figures for the period. */
  list(projectId: string, params: DateRange & Pagination = {}, options?: RequestOptions): Promise<Page<PromptGroup>> {
    return this.http.get(`${projectPath(projectId)}/prompt-groups`, PromptGroupPageSchema, {
      ...options,
      query: params,
    });
  }
}

/** Narrows a ranking to one assistant, and caps how many entries come back. */
export type RankingParams = DateRange & { limit?: number; model?: string };

export class SourcesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * `GET /v1/projects/{projectId}/sources` — the domains the assistants leaned
   * on when answering the project's prompts, most cited first.
   */
  list(projectId: string, params: RankingParams = {}, options?: RequestOptions): Promise<Page<CitedDomain>> {
    return this.http.get(`${projectPath(projectId)}/sources`, CitedDomainPageSchema, {
      ...options,
      query: params,
    });
  }
}

export class CompetitorsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * `GET /v1/projects/{projectId}/competitors` — every brand named alongside the
   * project's own, ranked by share of voice. The project's brand is in the list.
   */
  list(projectId: string, params: RankingParams = {}, options?: RequestOptions): Promise<Page<Competitor>> {
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
}
