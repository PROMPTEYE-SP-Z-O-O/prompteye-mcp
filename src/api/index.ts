/** The PromptEye API client. Depends on `zod` alone and knows nothing about MCP. */
export { PromptEyeApi, DEFAULT_TIMEOUT_MS, type PromptEyeApiOptions } from "./client.js";
export { API_ERROR_MESSAGES, PromptEyeApiError, type ApiErrorDetail } from "./errors.js";
export type { FetchLike, Query, RequestOptions } from "./http.js";
export type {
  AccountResource,
  CategoriesResource,
  DateRange,
  KnowledgeBaseResource,
  Pagination,
  ProjectsResource,
  PromptGroupsResource,
  PromptsResource,
  PromptSuggestionsResource,
} from "./resources.js";
export {
  AccountSchema,
  CategorySchema,
  KnowledgeBaseSchema,
  ProjectSchema,
  PromptDetailSchema,
  PromptGroupSchema,
  PromptSchema,
  PromptSuggestionSchema,
  type Account,
  type Category,
  type KnowledgeBase,
  type List,
  type Metrics,
  type MetricsChange,
  type ModelMetrics,
  type Page,
  type Project,
  type Prompt,
  type PromptDetail,
  type PromptGroup,
  type PromptSuggestion,
} from "./schemas.js";
