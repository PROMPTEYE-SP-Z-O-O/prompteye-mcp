import { z } from "zod";

/** Mirrors of the PromptEye API responses. Unknown fields are dropped. */

/** The markets a project can be tracked in. `GLOB` is the global answer set. */
export const COUNTRY_CODES = [
  "GLOB", "AE", "AR", "AT", "AU", "BE", "BG", "BR", "CA", "CH", "CL", "CN", "CO", "CY", "CZ", "DE",
  "DK", "EE", "EG", "ES", "FI", "FR", "GB", "GR", "HK", "HR", "HU", "ID", "IE", "IL", "IN", "IS",
  "IT", "JP", "KE", "KR", "KZ", "LT", "LU", "LV", "MT", "MX", "MY", "NG", "NL", "NO", "NZ", "PE",
  "PH", "PL", "PT", "QA", "RO", "RS", "RU", "SA", "SE", "SG", "SI", "SK", "TH", "TR", "TW", "UA",
  "US", "VN", "ZA",
] as const;

const MetricsSchema = z.object({
  /** Share of answers naming the brand, 0 to 100. `null` until measured. */
  visibility: z.number().nullable(),
  /** Visibility weighted by how much of the market each assistant carries. */
  reachIndex: z.number().nullable(),
  averagePosition: z.number().nullable(),
});

/** One assistant measured against itself, so there is no weighted figure. */
const ModelMetricsSchema = z.object({
  visibility: z.number().nullable(),
  averagePosition: z.number().nullable(),
});

/** Movement against the period of the same length before this one. */
const MetricsChangeSchema = z.object({
  visibility: z.number().nullable(),
  reachIndex: z.number().nullable(),
  averagePosition: z.number().nullable(),
});

export const AccountSchema = z.object({
  id: z.string(),
  email: z.string(),
  plan: z.object({ key: z.string(), name: z.string() }).nullable(),
  addons: z.array(z.string()),
  scopes: z.array(z.string()),
  promptCount: z.number(),
  /** What the plan allows in total; `promptCount` counts against it. */
  promptLimit: z.number(),
  /** The assistants every active prompt is asked on, following the plan and its add-ons. */
  models: z.array(z.string()),
  /** How often the prompts are asked. */
  scanFrequency: z.string(),
  /**
   * When the next run *starts*, RFC 3339 in UTC — not when it has finished.
   * Asking every prompt on every assistant takes tens of minutes, so the
   * figures keep moving for a while after this time passes.
   */
  nextScanAt: z.string(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  domain: z.string(),
  country: z.string(),
  label: z.string().nullable(),
  alternativeBrandNames: z.array(z.string()),
  alternativeDomains: z.array(z.string()),
  excludedCompetitors: z.array(z.string()),
  /** `OWNER`, `FULL_ACCESS` or `READ_ONLY`. */
  accessRole: z.string(),
  organisationId: z.string().nullable(),
  organisationName: z.string().nullable(),
  createdAt: z.string(),
});

export const CompanyProfileSchema = z.object({
  industry: z.string().nullable(),
  productCategory: z.string().nullable(),
  targetAudience: z.string().nullable(),
  icp: z.string().nullable(),
  operatingArea: z.string().nullable(),
  description: z.string().nullable(),
});

export const KnowledgeBaseSchema = z.object({
  text: z.string().nullable(),
  profile: CompanyProfileSchema.optional(),
  updatedAt: z.string().nullable(),
});

export const UpdateKnowledgeBaseRequestSchema = z.object({
  industry: z.string().max(4000).optional(),
  productCategory: z.string().max(4000).optional(),
  targetAudience: z.string().max(4000).optional(),
  icp: z.string().max(4000).optional(),
  operatingArea: z.string().max(4000).optional(),
  description: z.string().max(4000).optional(),
});

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  /** `ai` or `manual`. */
  source: z.string(),
});

export type CreateCategoryInput = {
  name: string;
  parentCategoryId?: string;
};

export const PromptSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  /** Empty when the prompt was written by hand. */
  keyword: z.string(),
  /** `active`, `paused` or `pending`. */
  status: z.string(),
  categories: z.array(z.string()),
  subcategories: z.array(z.string()),
  /** `null` when the prompt is ungrouped. */
  groupId: z.string().nullable(),
  createdAt: z.string(),
  aiTraffic: z.number().nullable(),
  /** `very_high`, `high`, `medium`, `low`, `very_low`, or `null` before it is ranked. */
  businessPriority: z.string().nullable(),
  /** Why someone set the priority by hand; `null` when it is the computed one. */
  businessPriorityReason: z.string().nullable(),
  metrics: MetricsSchema,
  change: MetricsChangeSchema.nullable(),
});

export const PromptDetailSchema = PromptSchema.extend({
  /** Only the assistants that actually answered. */
  byModel: z.array(z.object({ model: z.string(), metrics: ModelMetricsSchema })),
});

export const PromptGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().nullable(),
  /** Paused prompts included. */
  promptCount: z.number(),
  /** Added up over the prompts still being asked. */
  aiTrafficTotal: z.number().nullable(),
  metrics: MetricsSchema,
});

export const PromptGroupSettingsSchema = PromptGroupSchema.omit({ metrics: true });

export type PromptGroupSettings = z.infer<typeof PromptGroupSettingsSchema>;

export type CreatePromptGroupInput = { name: string; order?: number };
export type UpdatePromptGroupInput = { name?: string; order?: number };

export const PromptSuggestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  /** `gap` or `replicate`. */
  mode: z.string(),
  groupId: z.string(),
  groupName: z.string().nullable(),
  sourcePhrase: z.string(),
  sourcePhraseVolume: z.number().nullable(),
  aiTraffic: z.number().nullable(),
  relativeVolumeScore: z.number(),
  relativeVolumeLabel: z.string(),
  /** 1 educational, 2 solution-seeking, 3 comparison, 4 decision. */
  purchaseIntentLevel: z.number(),
  companyFitScore: z.number(),
  companyFitReason: z.string(),
  whyText: z.string(),
  whyArguments: z.array(z.string()),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export const AcceptedPromptSuggestionSchema = z.object({
  trackerId: z.string().nullable(),
});

export type AcceptedPromptSuggestion = z.infer<typeof AcceptedPromptSuggestionSchema>;
export type AcceptPromptSuggestionInput = { promptText?: string };

export const SUGGESTION_RUN_SKIP_REASONS = ["not_eligible", "cooldown", "nothing_to_suggest"] as const;

export const SuggestionRunSkipReasonSchema = z.enum(SUGGESTION_RUN_SKIP_REASONS);

export const SuggestionRunSchema = z.object({
  runId: z.string().nullable(),
  skipped: SuggestionRunSkipReasonSchema.nullable(),
});

export type SuggestionRunSkipReason = z.infer<typeof SuggestionRunSkipReasonSchema>;
export type SuggestionRun = z.infer<typeof SuggestionRunSchema>;

export const SUGGESTION_RUN_AVAILABILITY_REASONS = [
  "not_eligible",
  "no_slots",
  "running",
  "cooldown",
  "nothing_to_suggest",
  "ready",
] as const;

export const SuggestionRunAvailabilityReasonSchema = z.enum(SUGGESTION_RUN_AVAILABILITY_REASONS);

export const SuggestionRunLastRunSchema = z.object({
  status: z.enum(["running", "completed", "failed"]),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const SuggestionRunAvailabilitySchema = z.object({
  canRun: z.boolean(),
  reason: SuggestionRunAvailabilityReasonSchema,
  pendingSuggestionCount: z.number(),
  availableSlots: z.number(),
  lastRun: SuggestionRunLastRunSchema.nullable(),
});

export type SuggestionRunAvailabilityReason = z.infer<typeof SuggestionRunAvailabilityReasonSchema>;
export type SuggestionRunAvailability = z.infer<typeof SuggestionRunAvailabilitySchema>;

export const CitedDomainSchema = z.object({
  domain: z.string(),
  citations: z.number(),
  /** The domain's share of every citation made on the project's prompts. */
  share: z.number(),
  /** Whether it is the project's own domain, or one of its alternatives. */
  ownDomain: z.boolean(),
});

/** The individual pages behind a `CitedDomain` — one row per URL instead of per host. */
export const CitedPageSchema = z.object({
  url: z.string(),
  /** Host the page belongs to, without `www.`. */
  domain: z.string(),
  citations: z.number(),
  /** The page's share of every citation counted across the pages reported here. */
  share: z.number(),
  /** Whether the page's domain belongs to the brand, its own or an alternative one. */
  ownDomain: z.boolean(),
});

export const CompetitorSchema = z.object({
  brand: z.string(),
  /** True for the project's own brand, which is ranked alongside the rest. */
  ownBrand: z.boolean(),
  metrics: MetricsSchema,
  change: MetricsChangeSchema.nullable(),
  /** How much of the naming this brand took from everyone else. */
  shareOfVoice: z.number().nullable(),
  citations: z.number().nullable(),
  citationShare: z.number().nullable(),
});

/** A prompt as it comes back from being added: it has not been asked yet. */
export const NewPromptSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  /** The group it was filed under, or `null` when it is ungrouped. */
  groupName: z.string().nullable(),
});

/** Every entry an endpoint has, in one response. */
const listOf = <T extends z.ZodTypeAny>(entry: T) => z.object({ data: z.array(entry) });

/** A page of entries, walked with `nextCursor`. */
const pageOf = <T extends z.ZodTypeAny>(entry: T) =>
  z.object({ data: z.array(entry), nextCursor: z.string().nullable() });

export const ProjectListSchema = listOf(ProjectSchema);
export const CategoryListSchema = listOf(CategorySchema);
export const PromptSuggestionListSchema = listOf(PromptSuggestionSchema);
export const NewPromptListSchema = listOf(NewPromptSchema);
export const PromptPageSchema = pageOf(PromptSchema);
export const PromptGroupPageSchema = pageOf(PromptGroupSchema);
export const CitedDomainPageSchema = pageOf(CitedDomainSchema);
export const CitedPagePageSchema = pageOf(CitedPageSchema);
export const CompetitorPageSchema = pageOf(CompetitorSchema);

/** How wide the brand competes, which decides the prompts a report is built from. */
export const REPORT_REACH = ["local", "regional", "national"] as const;

/**
 * A public report: the free sample an agency's prospect fills a form for, and
 * the lead that comes out of it.
 */
export const ReportSchema = z.object({
  id: z.string(),
  brand: z.string(),
  /** Without `www.`; `null` when the form carried no website. */
  domain: z.string().nullable(),
  /** Where the finished report was sent. */
  email: z.string(),
  /** `processing`, `ready` or `error`. */
  status: z.string(),
  /** Visibility 0–100, `null` until the report is ready. */
  score: z.number().nullable(),
  reach: z.string().nullable(),
  country: z.string().nullable(),
  language: z.string().nullable(),
  utm: z.string().nullable(),
  /** `new`, `in_progress` or `done` — moved in the PromptEye app, not through the API. */
  leadStatus: z.string(),
  /** The project this report was converted into, or `null` while it is still just a sample. */
  projectId: z.string().nullable(),
  /** How many times the brand asked to be contacted from the report page. */
  contactCount: z.number(),
  createdAt: z.string(),
  readyAt: z.string().nullable(),
  /** The public report page, in the agency's branding. */
  url: z.string(),
});

export const ReportDetailSchema = ReportSchema.extend({
  industry: z.string().nullable(),
  monthlySearches: z.number().nullable(),
  /** Every question put to the assistants for this report. */
  prompts: z.array(z.string()),
  rankingPhrases: z.array(z.string()),
  /** Strongest first. */
  competitors: z.array(z.object({ name: z.string(), score: z.number() })),
  /** Assistants that answered; the others are left out. */
  models: z.array(
    z.object({
      model: z.string(),
      score: z.number().nullable(),
      answers: z.number().nullable(),
      averagePosition: z.number().nullable(),
    })
  ),
  examples: z.array(
    z.object({
      prompt: z.string(),
      response: z.string(),
      model: z.string(),
      sources: z.array(z.object({ url: z.string(), title: z.string().nullable() })),
    })
  ),
  /** Oldest first. */
  contacts: z.array(
    z.object({
      /** `calendly`, `email` or `phone`. */
      type: z.string(),
      createdAt: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      meetingAt: z.string().nullable(),
      inviteeEmail: z.string().nullable(),
    })
  ),
});

export const ReportPageSchema = pageOf(ReportSchema);

export const CONTENT_BRIEF_STATUSES = ["processing", "ready", "error"] as const;
export const CONTENT_BRIEF_FANOUT_SOURCES = ["nodeshub", "gpt_fallback", "cloro"] as const;
export const CONTENT_BRIEF_OUTLINE_LEVELS = ["H2", "H3"] as const;
export const CONTENT_BRIEF_OUTLINE_ORIGINS = ["existing", "from_fanout", "added"] as const;

const ContentBriefFanoutVariantSchema = z.object({
  /** A phrase the fan-out found for this prompt. */
  keyword: z.string(),
  /** What kind of phrase this is, as the fan-out classified it. */
  type: z.string(),
  /** How confident the fan-out is that this phrase belongs to this article. */
  confidence: z.number(),
});

const ContentBriefSeparateArticleSchema = z.object({
  keyword: z.string(),
  /** A publish-ready title for the separate article this phrase deserves. */
  articleTitle: z.string().nullable(),
  type: z.string(),
  confidence: z.number(),
  /** Why this phrase did not fit the requested article and deserves one of its own. */
  reason: z.string(),
  /** How worthwhile the separate article is, 1 highest. */
  priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
});

const ContentBriefOutlineItemSchema = z.object({
  level: z.enum(CONTENT_BRIEF_OUTLINE_LEVELS),
  text: z.string(),
  /** Editorial note on what this section should cover. */
  annotation: z.string().nullable(),
  /** Fan-out phrases this section answers. */
  sourcePhrases: z.array(z.string()).nullable(),
  /** Whether this is the one section required to name the brand. */
  includesBrand: z.boolean(),
  /** Questions to answer as FAQ inside this section, only set for the FAQ section. */
  faqQuestions: z.array(z.string()).nullable(),
  /**
   * Where this section came from when optimizing an existing article: kept from
   * the original (`existing`), built from a fan-out phrase (`from_fanout`), or
   * added new (`added`). `null` for a brief built from scratch.
   */
  origin: z.enum(CONTENT_BRIEF_OUTLINE_ORIGINS).nullable(),
  /** The exact original heading this section replaces. Only set for `origin: "existing"`. */
  originalHeading: z.string().nullable(),
  /** Whether the original section already answered directly in its first sentences. */
  originalHasDirectAnswer: z.boolean().nullable(),
});

/**
 * A content brief: a title and an H2/H3 outline PromptEye writes for an
 * article targeting one prompt. `status` is `processing` the moment it is
 * requested; poll it until it turns `ready` or `error`.
 */
export const ContentBriefSchema = z.object({
  id: z.string(),
  status: z.enum(CONTENT_BRIEF_STATUSES),
  /** The project this brief was requested for. */
  projectId: z.string(),
  /** The tracked prompt this brief is linked to, or `null` when requested standalone. */
  trackerId: z.string().nullable(),
  /** The target prompt the article is being written for. */
  prompt: z.string(),
  /** Why generation failed. `null` unless `status` is `error`. */
  error: z.string().nullable(),
  /** Title generated for the article. `null` until `status` is `ready`. */
  title: z.string().nullable(),
  /** The title of the existing article this brief optimizes, before any change. */
  originalTitle: z.string().nullable(),
  /** Why the title was changed from the existing article. */
  titleChangeAnnotation: z.string().nullable(),
  /** Which fan-out engine produced the phrases below. `null` until `ready`. */
  fanoutSource: z.enum(CONTENT_BRIEF_FANOUT_SOURCES).nullable(),
  /** Set when the fan-out failed but the brief still completed with whatever phrases it had. */
  fanoutError: z.string().nullable(),
  /** Every phrase the fan-out found for the target prompt. `null` until `ready`. */
  fanoutVariants: z.array(ContentBriefFanoutVariantSchema).nullable(),
  /** The phrases classified as belonging to this article, used to build the outline below. */
  phrasesForArticle: z.array(ContentBriefFanoutVariantSchema).nullable(),
  /** Phrases that deserve their own article instead of a section here. */
  separateArticles: z.array(ContentBriefSeparateArticleSchema).nullable(),
  /** The generated H2/H3 structure of the article. `null` until `ready`. */
  outline: z.array(ContentBriefOutlineItemSchema).nullable(),
  /**
   * For a brief that optimizes an existing article, how much of the fan-out
   * phrase coverage the original text already had, in whole percent.
   */
  sourceTextMatchPercentage: z.number().nullable(),
  requestedAt: z.string(),
  /** When it finished. `null` until then. */
  readyAt: z.string().nullable(),
});

/** What a content brief is generated from. */
export type CreateContentBriefInput = {
  /** The project to request the brief for. */
  projectId: string;
  /** The target prompt to write the article for. */
  prompt: string;
  /** Link the brief to an existing tracked prompt. */
  trackerId?: string;
};

export type ContentBrief = z.infer<typeof ContentBriefSchema>;

/** What a public report is generated from. */
export type CreateReportInput = {
  /** The PromptEye account the report belongs to, and whose quota it spends. */
  agencyId: string;
  brand: string;
  /** Where the finished report is sent. */
  email: string;
  /** The brand's domain; a report generated for it in the last 30 days is reused. */
  website?: string;
  /** ISO 3166-1 alpha-2. */
  country?: string;
  language?: string;
  reach?: (typeof REPORT_REACH)[number];
  /** Campaign, kept on the report and in its link. */
  utm?: string;
};

export type Report = z.infer<typeof ReportSchema>;
export type ReportDetail = z.infer<typeof ReportDetailSchema>;
export type ReportReach = (typeof REPORT_REACH)[number];

export const UpdateProjectRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  label: z.string().min(1).max(40).optional(),
  domain: z.string().min(3).max(253).optional(),
  alternativeBrandNames: z.array(z.string().min(1).max(120)).max(20).optional(),
  alternativeDomains: z.array(z.string().min(3).max(253)).max(20).optional(),
});

export const BUSINESS_PRIORITY_VALUES = [
  "very_high",
  "high",
  "medium",
  "low",
  "very_low",
] as const;

export const UpdatePromptRequestSchema = z.object({
  status: z.enum(["active", "paused"]).optional(),
  groupId: z.string().min(1).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  subcategoryId: z.string().min(1).optional(),
  businessPriority: z.enum(BUSINESS_PRIORITY_VALUES).nullable().optional(),
  businessPriorityReason: z.string().max(500).optional(),
});

export const PromptSettingsSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  keyword: z.string(),
  status: z.string(),
  categories: z.array(z.string()),
  subcategories: z.array(z.string()),
  groupId: z.string().nullable(),
  createdAt: z.string(),
  aiTraffic: z.number().nullable(),
  businessPriority: z.string().nullable(),
  businessPriorityReason: z.string().nullable().optional(),
});

export const CompetitorExclusionSchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
});

export const CompetitorExclusionListSchema = listOf(CompetitorExclusionSchema);

export const ReplaceCompetitorExclusionItemSchema = z.object({
  name: z.string().min(1).max(120),
  aliases: z.array(z.string().min(1).max(120)).max(20).optional(),
});

export const ReplaceCompetitorExclusionsRequestSchema = z.object({
  exclusions: z.array(ReplaceCompetitorExclusionItemSchema).max(50),
});

/** What a project is created from. */
export type CreateProjectInput = {
  /** The brand as it is written in answers; visibility is measured against this name. */
  brand: string;
  /** Primary domain, without protocol or path. */
  domain: string;
  country: (typeof COUNTRY_CODES)[number];
  /** Defaults to the brand name. */
  name?: string;
  label?: string;
  alternativeBrandNames?: string[];
  alternativeDomains?: string[];
  excludedCompetitors?: string[];
  /** Puts the project in this workspace instead of the key holder's own. */
  organisationId?: string;
};

export type UpdateProjectInput = z.infer<typeof UpdateProjectRequestSchema>;

/** One prompt to track, as handed to the API. */
export type PromptInput = {
  /** Sent to the assistants verbatim. */
  prompt: string;
  /** Creates the group when it does not exist yet, and reuses it when it does. */
  groupName?: string;
};

export type UpdatePromptInput = z.infer<typeof UpdatePromptRequestSchema>;

export type List<T> = { data: T[] };
export type Page<T> = { data: T[]; nextCursor: string | null };
export type CountryCode = (typeof COUNTRY_CODES)[number];
export type Metrics = z.infer<typeof MetricsSchema>;
export type ModelMetrics = z.infer<typeof ModelMetricsSchema>;
export type MetricsChange = z.infer<typeof MetricsChangeSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type UpdateKnowledgeBaseInput = z.infer<typeof UpdateKnowledgeBaseRequestSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type CitedDomain = z.infer<typeof CitedDomainSchema>;
export type CitedPage = z.infer<typeof CitedPageSchema>;
export type Competitor = z.infer<typeof CompetitorSchema>;
export type CompetitorExclusion = z.infer<typeof CompetitorExclusionSchema>;
export type ReplaceCompetitorExclusionItem = z.infer<typeof ReplaceCompetitorExclusionItemSchema>;
export type ReplaceCompetitorExclusionsInput = z.infer<typeof ReplaceCompetitorExclusionsRequestSchema>;
export type Prompt = z.infer<typeof PromptSchema>;
export type PromptDetail = z.infer<typeof PromptDetailSchema>;
export type PromptSettings = z.infer<typeof PromptSettingsSchema>;
export type PromptGroup = z.infer<typeof PromptGroupSchema>;
export type PromptSuggestion = z.infer<typeof PromptSuggestionSchema>;
export type NewPrompt = z.infer<typeof NewPromptSchema>;

/*
 * Google: what Google itself reports for the project's site — Search Console
 * clicks and impressions, and the Google Analytics sessions that arrived from
 * an AI assistant. None of it is a PromptEye measurement: it counts people who
 * reached the site, where visibility counts answers that named the brand.
 */

/** How the last pull from Google went. `failedSince` stays null while it is healthy. */
export const GoogleSyncSchema = z.object({
  lastSyncedAt: z.string().nullable(),
  /** When the failures started, so a stale figure can be told from a fresh one. */
  failedSince: z.string().nullable(),
  error: z.string().nullable(),
});

export const SearchConsoleStatusSchema = z.object({
  connected: z.boolean(),
  /** The property as Google names it, e.g. `sc-domain:example.com`. Null until one is bound. */
  siteUrl: z.string().nullable(),
  /** What the bound account may read, e.g. `siteOwner`. */
  permissionLevel: z.string().nullable(),
  sync: GoogleSyncSchema.nullable(),
});

export const AnalyticsStatusSchema = z.object({
  connected: z.boolean(),
  propertyId: z.string().nullable(),
  propertyName: z.string().nullable(),
  accountName: z.string().nullable(),
  sync: GoogleSyncSchema.nullable(),
});

/**
 * Whether the project has any Google data at all.
 *
 * Read this before the rest: a project with nothing bound answers the other
 * Google endpoints with zeros and empty lists, which is not the same answer as
 * a site nobody visits.
 */
export const GoogleStatusSchema = z.object({
  searchConsole: SearchConsoleStatusSchema,
  analytics: AnalyticsStatusSchema,
});

/** One day of the Search Console timeline. */
export const SearchTimelinePointSchema = z.object({
  date: z.string(),
  clicks: z.number(),
  impressions: z.number(),
});

/** The figures every Search Console row carries, whatever it is a row of. */
const searchFigures = {
  clicks: z.number(),
  impressions: z.number(),
  /** Clicks over impressions, 0 to 1 — a rate, not a percentage. */
  ctr: z.number(),
  /** Average position in the results, counting from 1. Lower is better. */
  position: z.number(),
};

export const SearchSummarySchema = z.object({
  ...searchFigures,
  timeline: z.array(SearchTimelinePointSchema),
});

export const SearchQuerySchema = z.object({ query: z.string(), ...searchFigures });
export const SearchPageSchema = z.object({ page: z.string(), ...searchFigures });

/** Only the sessions whose referrer was recognised as an AI assistant are counted. */
export const AnalyticsSummarySchema = z.object({
  sessions: z.number(),
  engagedSessions: z.number(),
  /** Engaged sessions over sessions, 0 to 1. */
  engagementRate: z.number(),
  /** Seconds. */
  averageSessionDuration: z.number(),
  /** The conversions the property marks as key events. */
  keyEvents: z.number(),
});

export const AnalyticsSourceSchema = z.object({
  /** The referrer as Analytics recorded it, e.g. `chatgpt.com`. */
  source: z.string(),
  sessions: z.number(),
  keyEvents: z.number(),
});

export const AnalyticsPageSchema = z.object({
  /** The landing page the session started on, as a path. */
  page: z.string(),
  sessions: z.number(),
  keyEvents: z.number(),
});

export const SearchQueryPageSchema = pageOf(SearchQuerySchema);
export const SearchPagePageSchema = pageOf(SearchPageSchema);
export const AnalyticsSourcePageSchema = pageOf(AnalyticsSourceSchema);
export const AnalyticsPagePageSchema = pageOf(AnalyticsPageSchema);

export type GoogleSync = z.infer<typeof GoogleSyncSchema>;
export type SearchConsoleStatus = z.infer<typeof SearchConsoleStatusSchema>;
export type AnalyticsStatus = z.infer<typeof AnalyticsStatusSchema>;
export type GoogleStatus = z.infer<typeof GoogleStatusSchema>;
export type SearchTimelinePoint = z.infer<typeof SearchTimelinePointSchema>;
export type SearchSummary = z.infer<typeof SearchSummarySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchPage = z.infer<typeof SearchPageSchema>;
export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;
export type AnalyticsSource = z.infer<typeof AnalyticsSourceSchema>;
export type AnalyticsPage = z.infer<typeof AnalyticsPageSchema>;

/*
 * Traffic: the requests bots made to the tracked site, and the pages they came
 * for. The supply side of visibility — an assistant can only quote a page its
 * bot was able to fetch.
 */

export const TRAFFIC_KINDS = ["ai", "seo"] as const;
export const TRAFFIC_CATEGORIES = ["agent", "assistant", "search"] as const;
export const TRAFFIC_GROUPS = ["bot", "path", "status", "day", "category"] as const;

export const TrafficKindSchema = z.enum(TRAFFIC_KINDS);
export const TrafficCategorySchema = z.enum(TRAFFIC_CATEGORIES);
export const TrafficGroupSchema = z.enum(TRAFFIC_GROUPS);

export const TrafficEventSchema = z.object({
  id: z.string(),
  at: z.string(),
  botId: z.string(),
  name: z.string(),
  vendor: z.string(),
  botType: z.string(),
  kind: TrafficKindSchema,
  category: TrafficCategorySchema,
  path: z.string(),
  statusCode: z.number().nullable(),
  redirectLocation: z.string().nullable(),
  responseTimeMs: z.number().nullable(),
  country: z.string().nullable(),
  referer: z.string().nullable(),
  /**
   * Whether the origin checked out as the bot it claims to be. A `User-Agent`
   * is free text anybody can send, so an unverified request is a claim rather
   * than reach. The API has no filter for it: read it, never quietly drop it.
   */
  verified: z.boolean(),
});

export const TrafficCountSchema = z.object({
  /** A bot id, a path, a status code (`unknown` when none was reported), a UTC day or a category. */
  key: z.string(),
  /** A display name, set for bots and null for the other groupings. */
  label: z.string().nullable(),
  count: z.number(),
  uniquePaths: z.number(),
  lastAt: z.string(),
});

export const TrafficCountPageSchema = z.object({
  data: z.array(TrafficCountSchema),
  /** Always null: the answer is ranked, not paged. */
  nextCursor: z.string().nullable(),
  /** The period held more requests than could be read, so only the newest are counted. */
  partial: z.boolean(),
});

export const TrafficCrawlSchema = z.object({
  path: z.string(),
  botId: z.string(),
  name: z.string(),
  vendor: z.string(),
  botType: z.string(),
  kind: TrafficKindSchema,
  firstVisitAt: z.string(),
  lastVisitAt: z.string(),
  /** Since tracking began, not over a period. */
  visitCount: z.number(),
  lastStatusCode: z.number().nullable(),
});

export const TrafficSitemapUrlSchema = z.object({
  url: z.string(),
  /** The same form the other traffic endpoints use, so the two can be joined. */
  path: z.string(),
  lastModified: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  /** Whether the sitemap still lists it. */
  active: z.boolean(),
});

export const TrafficSitemapStateSchema = z.object({
  url: z.string(),
  status: z.enum(["active", "syncing", "error"]),
  lastSyncedAt: z.string().nullable(),
  nextSyncAt: z.string(),
  urlCount: z.number(),
  error: z.string().nullable(),
});

export const TrafficSitemapPageSchema = z.object({
  /** Null when no sitemap is connected; `data` is then empty. */
  sitemap: TrafficSitemapStateSchema.nullable(),
  data: z.array(TrafficSitemapUrlSchema),
  nextCursor: z.string().nullable(),
});

export const TrafficEventPageSchema = pageOf(TrafficEventSchema);
export const TrafficCrawlPageSchema = pageOf(TrafficCrawlSchema);

export const CRAWL_HEALTH_LEVELS = ["ok", "warning", "critical", "unknown"] as const;
export const CRAWL_HEALTH_ASSESSMENT_KEYS = ["3xx", "4xx", "5xx", "responseTime"] as const;

export const CrawlHealthLevelSchema = z.enum(CRAWL_HEALTH_LEVELS);
export const CrawlHealthAssessmentKeySchema = z.enum(CRAWL_HEALTH_ASSESSMENT_KEYS);

export const TrafficCrawlHealthAssessmentSchema = z.object({
  key: CrawlHealthAssessmentKeySchema,
  level: CrawlHealthLevelSchema,
  count: z.number().nullable(),
  rate: z.number().nullable(),
  averageResponseTimeMs: z.number().nullable(),
});

export const TrafficCrawlIssueSchema = z.object({
  botId: z.string(),
  botName: z.string(),
  path: z.string(),
  statusCode: z.number(),
  redirectLocation: z.string().nullable(),
  count: z.number(),
  lastSeenAt: z.string(),
  averageResponseTimeMs: z.number().nullable(),
});

export const TrafficCrawlHealthSchema = z.object({
  total: z.number(),
  success: z.number(),
  redirects: z.number(),
  clientErrors: z.number(),
  serverErrors: z.number(),
  unknown: z.number(),
  scanRequests: z.number(),
  averageResponseTimeMs: z.number().nullable(),
  assessments: z.array(TrafficCrawlHealthAssessmentSchema),
  issues: z.array(TrafficCrawlIssueSchema),
});

export type TrafficKind = z.infer<typeof TrafficKindSchema>;
export type TrafficCategory = z.infer<typeof TrafficCategorySchema>;
export type TrafficGroup = z.infer<typeof TrafficGroupSchema>;
export type TrafficEvent = z.infer<typeof TrafficEventSchema>;
export type TrafficCount = z.infer<typeof TrafficCountSchema>;
export type TrafficCountPage = z.infer<typeof TrafficCountPageSchema>;
export type TrafficCrawl = z.infer<typeof TrafficCrawlSchema>;
export type TrafficSitemapUrl = z.infer<typeof TrafficSitemapUrlSchema>;
export type TrafficSitemapState = z.infer<typeof TrafficSitemapStateSchema>;
export type TrafficSitemapPage = z.infer<typeof TrafficSitemapPageSchema>;
export type CrawlHealthLevel = z.infer<typeof CrawlHealthLevelSchema>;
export type CrawlHealthAssessmentKey = z.infer<typeof CrawlHealthAssessmentKeySchema>;
export type TrafficCrawlHealthAssessment = z.infer<typeof TrafficCrawlHealthAssessmentSchema>;
export type TrafficCrawlIssue = z.infer<typeof TrafficCrawlIssueSchema>;
export type TrafficCrawlHealth = z.infer<typeof TrafficCrawlHealthSchema>;

export const BRAND_ANALYSIS_RUN_STATUSES = ["processing", "ready", "error", "corrupted_response"] as const;

export const BRAND_ANALYSIS_AVAILABILITY_REASONS = [
  "no_project",
  "no_prompts",
  "no_results",
  "processing",
  "up_to_date",
  "retry_error",
  "retry_corrupted_response",
  "ready",
] as const;

export const BrandAnalysisRunStatusSchema = z.enum(BRAND_ANALYSIS_RUN_STATUSES);
export const BrandAnalysisAvailabilityReasonSchema = z.enum(BRAND_ANALYSIS_AVAILABILITY_REASONS);

export const BrandAnalysisRankingEvidenceSchema = z.object({
  brand: z.string(),
  visibility: z.number(),
  visibleCount: z.number(),
  observationCount: z.number(),
  averagePosition: z.number().nullable(),
});

export const BrandAnalysisGapSchema = z.object({
  key: z.string(),
  label: z.string(),
  bestBrand: z.string(),
  gapScore: z.number(),
  whyLeaderWins: z.string(),
  whyWeMiss: z.string(),
  sourceResultIds: z.array(z.string()),
  rankingEvidence: z.array(BrandAnalysisRankingEvidenceSchema).nullable(),
});

export const BrandAnalysisSentimentSchema = z.object({
  overallSentiment: z.enum(["positive", "neutral", "negative"]),
  positiveScore: z.number(),
  negativeScore: z.number(),
  neutralScore: z.number(),
  positiveAttributes: z.array(z.string()),
  negativeAttributes: z.array(z.string()),
  neutralAttributes: z.array(z.string()),
  summary: z.string(),
});

export const BrandAnalysisRunSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  status: BrandAnalysisRunStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  activePromptCount: z.number(),
  usedResultCount: z.number(),
  maxContextGaps: z.number().nullable(),
  gaps: z.array(BrandAnalysisGapSchema),
  sentiment: BrandAnalysisSentimentSchema.nullable(),
  totalCost: z.number().nullable(),
  error: z.string().nullable(),
});

export const BrandAnalysisAvailabilitySchema = z.object({
  canRun: z.boolean(),
  reason: BrandAnalysisAvailabilityReasonSchema,
  activePromptCount: z.number(),
  usedResultCount: z.number(),
  latestTrackScoreResultTimestamp: z.string().nullable(),
});

export type BrandAnalysisRunStatus = z.infer<typeof BrandAnalysisRunStatusSchema>;
export type BrandAnalysisAvailabilityReason = z.infer<typeof BrandAnalysisAvailabilityReasonSchema>;
export type BrandAnalysisRankingEvidence = z.infer<typeof BrandAnalysisRankingEvidenceSchema>;
export type BrandAnalysisGap = z.infer<typeof BrandAnalysisGapSchema>;
export type BrandAnalysisSentiment = z.infer<typeof BrandAnalysisSentimentSchema>;
export type BrandAnalysisRun = z.infer<typeof BrandAnalysisRunSchema>;
export type BrandAnalysisAvailability = z.infer<typeof BrandAnalysisAvailabilitySchema>;

export const AUDIT_STATUSES = ["pending", "success", "partial", "error"] as const;
export const AUDIT_URL_STATUSES = ["pending", "success", "error"] as const;

export const AuditStatusSchema = z.enum(AUDIT_STATUSES);
export const AuditUrlStatusSchema = z.enum(AUDIT_URL_STATUSES);

const auditPresenceCheck = z
  .object({
    present: z.boolean(),
    status: z.boolean(),
    message: z.string().nullable(),
  })
  .nullable();

export const AuditAnalysisSchema = z.object({
  howToSchema: auditPresenceCheck,
  organisation: auditPresenceCheck,
  breadcrumb: auditPresenceCheck,
  faqSchema: auditPresenceCheck,
  contentStructure: z
    .object({ h1: z.boolean(), headings: z.boolean(), rawMessage: z.string().nullable() })
    .nullable(),
  crawlability: z
    .object({ metaRobotsTag: z.boolean(), canonicalTag: z.boolean(), rawMessage: z.string().nullable() })
    .nullable(),
  authoritySignals: z
    .object({
      authorInfo: z.boolean(),
      outboundLinks: z.boolean(),
      reputableOutboundLinks: z.boolean(),
      missingItems: z.array(z.string()).nullable(),
      rawMessage: z.string().nullable(),
    })
    .nullable(),
  readingLevel: z
    .object({
      readingAge: z.number(),
      recommendedMinAge: z.number(),
      recommendedMaxAge: z.number(),
      notes: z.string().nullable(),
    })
    .nullable(),
  writingStyle: z
    .object({ declarativePercent: z.number(), descriptivePercent: z.number(), notes: z.string().nullable() })
    .nullable(),
});

export const AuditUrlResultSchema = z.object({
  url: z.string(),
  status: AuditUrlStatusSchema,
  error: z.string().nullable(),
  totalCost: z.number().nullable(),
  analysis: AuditAnalysisSchema.nullable(),
});

export const AuditSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  status: AuditStatusSchema,
  startDate: z.string(),
  endDate: z.string().nullable(),
  duration: z.number().nullable(),
  numberOfUrls: z.number(),
  results: z.array(AuditUrlResultSchema),
});

export const AuditUsageSchema = z.object({
  limit: z.number(),
  used: z.number(),
  remaining: z.number(),
});

export type AuditStatus = z.infer<typeof AuditStatusSchema>;
export type AuditUrlStatus = z.infer<typeof AuditUrlStatusSchema>;
export type AuditAnalysis = z.infer<typeof AuditAnalysisSchema>;
export type AuditUrlResult = z.infer<typeof AuditUrlResultSchema>;
export type Audit = z.infer<typeof AuditSchema>;
export type AuditUsage = z.infer<typeof AuditUsageSchema>;

export type CreateAuditInput = { urls: string[]; projectId?: string };
export type AuditUsageQuery = { projectId?: string };

export const TOPICAL_MAP_STATUSES = ["processing", "ready", "error"] as const;
export const TOPICAL_MAP_CLUSTER_INTENTS = ["Informational", "Navigational", "Transactional"] as const;

export const TopicalMapStatusSchema = z.enum(TOPICAL_MAP_STATUSES);
export const TopicalMapClusterIntentSchema = z.enum(TOPICAL_MAP_CLUSTER_INTENTS);

export const TopicalMapPillarSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const TopicalMapClusterSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  intent: TopicalMapClusterIntentSchema,
});

const topicalMapSummaryShape = {
  id: z.string(),
  projectId: z.string(),
  topic: z.string(),
  language: z.string(),
  status: TopicalMapStatusSchema,
  createdAt: z.string(),
  generationCost: z.number().nullable(),
};

export const TopicalMapSummarySchema = z.object(topicalMapSummaryShape);

export const TopicalMapSchema = z.object({
  ...topicalMapSummaryShape,
  pillar: TopicalMapPillarSchema.nullable(),
  clusters: z.array(TopicalMapClusterSchema),
  errorMessage: z.string().nullable(),
});

export const TopicalMapListSchema = listOf(TopicalMapSummarySchema);

export type TopicalMapStatus = z.infer<typeof TopicalMapStatusSchema>;
export type TopicalMapClusterIntent = z.infer<typeof TopicalMapClusterIntentSchema>;
export type TopicalMapPillar = z.infer<typeof TopicalMapPillarSchema>;
export type TopicalMapCluster = z.infer<typeof TopicalMapClusterSchema>;
export type TopicalMapSummary = z.infer<typeof TopicalMapSummarySchema>;
export type TopicalMap = z.infer<typeof TopicalMapSchema>;

export type CreateTopicalMapInput = { topic: string; language: string };
export type RegenerateTopicalMapClusterInput = { category: string };
