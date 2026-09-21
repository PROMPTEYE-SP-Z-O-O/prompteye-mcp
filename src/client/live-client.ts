import type { PromptEyeApi } from "../api/index.js";
import type { PromptEyeClient } from "./prompteye-client.js";

/** The calls the PromptEye API serves; everything else comes from the fallback. */
type LiveMethod =
  | "getAccount"
  | "listProjects"
  | "getProject"
  | "createProject"
  | "updateProject"
  | "getKnowledgeBase"
  | "updateKnowledgeBase"
  | "listCategories"
  | "listPromptSuggestions"
  | "listPrompts"
  | "getPrompt"
  | "addPrompts"
  | "updatePrompt"
  | "listPromptGroups"
  | "listSources"
  | "listCompetitors"
  | "listCompetitorExclusions"
  | "replaceCompetitorExclusions"
  | "createReport"
  | "listReports"
  | "getReport"
  | "getGoogleStatus"
  | "getSearchSummary"
  | "listSearchQueries"
  | "listSearchPages"
  | "getAiTrafficSummary"
  | "listAiTrafficSources"
  | "listAiTrafficPages"
  | "listBotVisits"
  | "countBotVisits"
  | "listCrawls"
  | "getSitemap";

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
    updateProject: (projectId, input) => api.projects.update(projectId, input),
    getKnowledgeBase: (projectId) => api.knowledgeBase.get(projectId),
    updateKnowledgeBase: (projectId, input) => api.knowledgeBase.update(projectId, input),
    listCategories: (projectId) => api.categories.list(projectId),
    listPromptSuggestions: (projectId, query) => api.promptSuggestions.list(projectId, query),
    listPrompts: (projectId, query) => api.prompts.list(projectId, query),
    getPrompt: (projectId, promptId, range) => api.prompts.get(projectId, promptId, range),
    addPrompts: (projectId, prompts) => api.prompts.create(projectId, prompts),
    updatePrompt: (projectId, promptId, input) => api.prompts.update(projectId, promptId, input),
    listPromptGroups: (projectId, query) => api.promptGroups.list(projectId, query),
    createReport: (input) => api.reports.create(input),
    listReports: (query) => api.reports.list(query),
    getReport: (reportId) => api.reports.get(reportId),
    listSources: (projectId, query) => api.sources.list(projectId, query),
    listCompetitors: (projectId, query) => api.competitors.list(projectId, query),
    listCompetitorExclusions: (projectId) => api.competitors.listExclusions(projectId),
    replaceCompetitorExclusions: (projectId, exclusions) => api.competitors.replaceExclusions(projectId, exclusions),
    getGoogleStatus: (projectId) => api.google.status(projectId),
    getSearchSummary: (projectId, query) => api.google.search(projectId, query),
    listSearchQueries: (projectId, query) => api.google.searchQueries(projectId, query),
    listSearchPages: (projectId, query) => api.google.searchPages(projectId, query),
    getAiTrafficSummary: (projectId, query) => api.google.analytics(projectId, query),
    listAiTrafficSources: (projectId, query) => api.google.analyticsSources(projectId, query),
    listAiTrafficPages: (projectId, query) => api.google.analyticsPages(projectId, query),
    listBotVisits: (projectId, query) => api.traffic.events(projectId, query),
    countBotVisits: (projectId, query) => api.traffic.countEvents(projectId, query),
    listCrawls: (projectId, query) => api.traffic.crawls(projectId, query),
    getSitemap: (projectId, query) => api.traffic.sitemap(projectId, query),
  };
}
