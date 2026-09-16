import type { HttpClient, RequestOptions } from "./http.js";
import {
  AccountSchema,
  CategoryListSchema,
  KnowledgeBaseSchema,
  NewPromptListSchema,
  ProjectListSchema,
  ProjectSchema,
  PromptDetailSchema,
  PromptGroupPageSchema,
  PromptPageSchema,
  PromptSuggestionListSchema,
  type Account,
  type Category,
  type CreateProjectInput,
  type KnowledgeBase,
  type List,
  type NewPrompt,
  type Page,
  type Project,
  type Prompt,
  type PromptDetail,
  type PromptGroup,
  type PromptInput,
  type PromptSuggestion,
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
}

export class KnowledgeBaseResource {
  constructor(private readonly http: HttpClient) {}

  /** `GET /v1/projects/{projectId}/knowledge-base` — what the project knows about the brand. */
  get(projectId: string, options?: RequestOptions): Promise<KnowledgeBase> {
    return this.http.get(`${projectPath(projectId)}/knowledge-base`, KnowledgeBaseSchema, options);
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
