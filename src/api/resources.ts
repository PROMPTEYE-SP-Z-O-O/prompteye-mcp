import type { HttpClient, RequestOptions } from "./http.js";
import {
  AccountSchema,
  CategoryListSchema,
  KnowledgeBaseSchema,
  ProjectListSchema,
  ProjectSchema,
  PromptSuggestionListSchema,
  type Account,
  type Category,
  type KnowledgeBase,
  type List,
  type Project,
  type PromptSuggestion,
} from "./schemas.js";

const projectPath = (projectId: string): string => `/v1/projects/${encodeURIComponent(projectId)}`;

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

export class PromptSuggestionsResource {
  constructor(private readonly http: HttpClient) {}

  /** `GET /v1/projects/{projectId}/prompt-suggestions` — suggestions awaiting a decision, optionally for one group. */
  list(projectId: string, params: { groupId?: string } = {}, options?: RequestOptions): Promise<List<PromptSuggestion>> {
    const query = params.groupId ? `?groupId=${encodeURIComponent(params.groupId)}` : "";
    return this.http.get(`${projectPath(projectId)}/prompt-suggestions${query}`, PromptSuggestionListSchema, options);
  }
}
