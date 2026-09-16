import type { PromptEyeApi } from "../api/index.js";
import type { PromptEyeClient } from "./prompteye-client.js";

/** The calls the PromptEye API serves; everything else comes from the fallback. */
type LiveMethod =
  | "getAccount"
  | "listProjects"
  | "getProject"
  | "createProject"
  | "getKnowledgeBase"
  | "listCategories"
  | "listPromptSuggestions"
  | "listPrompts"
  | "getPrompt"
  | "addPrompts"
  | "listPromptGroups";

/** What is left for the sample data to answer, until the API grows those endpoints too. */
export type FallbackClient = Omit<PromptEyeClient, LiveMethod>;

/**
 * Answers from the PromptEye API wherever it has an endpoint, and from
 * `fallback` everywhere else. When the API grows an endpoint, the matching
 * method moves from the fallback to here.
 */
export function createLiveClient(api: PromptEyeApi, fallback: FallbackClient): PromptEyeClient {
  return {
    ...fallback,
    getAccount: () => api.account.get(),
    listProjects: () => api.projects.list(),
    getProject: (projectId) => api.projects.get(projectId),
    createProject: (input) => api.projects.create(input),
    getKnowledgeBase: (projectId) => api.knowledgeBase.get(projectId),
    listCategories: (projectId) => api.categories.list(projectId),
    listPromptSuggestions: (projectId, query) => api.promptSuggestions.list(projectId, query),
    listPrompts: (projectId, query) => api.prompts.list(projectId, query),
    getPrompt: (projectId, promptId, range) => api.prompts.get(projectId, promptId, range),
    addPrompts: (projectId, prompts) => api.prompts.create(projectId, prompts),
    listPromptGroups: (projectId, query) => api.promptGroups.list(projectId, query),
  };
}
