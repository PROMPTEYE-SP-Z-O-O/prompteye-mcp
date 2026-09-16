/** The PromptEye API client. Depends on `zod` alone and knows nothing about MCP. */
export { PromptEyeApi, DEFAULT_TIMEOUT_MS, type PromptEyeApiOptions } from "./client.js";
export { API_ERROR_MESSAGES, PromptEyeApiError, type ApiErrorDetail } from "./errors.js";
export type { FetchLike, RequestOptions } from "./http.js";
export type {
  AccountResource,
  CategoriesResource,
  KnowledgeBaseResource,
  ProjectsResource,
  PromptSuggestionsResource,
} from "./resources.js";
export {
  AccountSchema,
  CategorySchema,
  KnowledgeBaseSchema,
  ProjectSchema,
  PromptSuggestionSchema,
  type Account,
  type Category,
  type KnowledgeBase,
  type List,
  type Project,
  type PromptSuggestion,
} from "./schemas.js";
