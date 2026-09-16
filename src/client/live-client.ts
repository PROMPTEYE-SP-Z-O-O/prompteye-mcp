import type { PromptEyeApi } from "../api/index.js";
import type { PromptEyeClient } from "./prompteye-client.js";

/**
 * Answers from the PromptEye API wherever it has an endpoint, and from
 * `fallback` everywhere else. When the API grows an endpoint, the matching
 * method moves from the fallback to here.
 */
export function createLiveClient(api: PromptEyeApi, fallback: PromptEyeClient): PromptEyeClient {
  return {
    ...fallback,
    getAccount: () => api.account.get(),
    listProjects: () => api.projects.list(),
    getProject: (projectId) => api.projects.get(projectId),
    getKnowledgeBase: (projectId) => api.knowledgeBase.get(projectId),
    listCategories: (projectId) => api.categories.list(projectId),
    listPromptSuggestions: (projectId, query) => api.promptSuggestions.list(projectId, query),
  };
}
