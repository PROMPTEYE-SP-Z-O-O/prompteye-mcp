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

const timestamp = (description: string) => z.string().describe(`${description}, ISO 8601 in UTC.`);

const VISIBILITY_FIELD = "Share of answers that named the brand in the period, in percent 0-100. null = not measured.";
const AVERAGE_POSITION_FIELD =
  "Mean place the brand was named at in the answers that named it, counting from 1; lower is earlier. null = not measured.";

const MetricsSchema = z.object({
  visibility: z.number().nullable().describe(VISIBILITY_FIELD),
  reachIndex: z
    .number()
    .nullable()
    .describe("Visibility weighted by how much of the market each assistant carries, 0-100, whole number. null = not measured."),
  averagePosition: z.number().nullable().describe(AVERAGE_POSITION_FIELD),
});

/** One assistant measured against itself, so there is no weighted figure. */
const ModelMetricsSchema = z.object({
  visibility: z.number().nullable().describe(VISIBILITY_FIELD),
  averagePosition: z.number().nullable().describe(AVERAGE_POSITION_FIELD),
});

const MetricsChangeSchema = z.object({
  visibility: z
    .number()
    .nullable()
    .describe("Percentage points visibility moved by; negative = fell. null = either period could not measure it."),
  reachIndex: z
    .number()
    .nullable()
    .describe("Points reachIndex moved by; negative = fell. null = either period could not measure it."),
  averagePosition: z
    .number()
    .nullable()
    .describe(
      "Places moved, signed so positive = named earlier (an improvement). null = either period could not measure it."
    ),
});

const NullableMetricsChangeSchema = MetricsChangeSchema.nullable().describe(
  "Movement against the period of the same length directly before this one. null = no figure could be compared."
);

export const AccountSchema = z.object({
  id: z.string(),
  email: z.string(),
  plan: z.object({ key: z.string(), name: z.string() }).nullable().describe("null = no plan assigned."),
  addons: z.array(z.string()),
  scopes: z.array(z.string()),
  promptCount: z
    .number()
    .describe("Prompts tracked across the workspace, active or pending; paused prompts are not counted."),
  promptLimit: z
    .number()
    .describe("Prompts the plan allows in total; the room left is promptLimit minus promptCount."),
  /** The assistants every active prompt is asked on, following the plan and its add-ons. */
  models: z.array(z.string()),
  scanFrequency: z.string().describe("How often every active prompt is asked, e.g. daily."),
  nextScanAt: z
    .string()
    .describe(
      "When the next run starts, not when it finishes, ISO 8601 in UTC; answers land over the hours after it, so figures keep moving."
    ),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  domain: z.string(),
  country: z.string(),
  label: z.string().nullable().describe("Grouping label. null = the project has none."),
  alternativeBrandNames: z.array(z.string()),
  alternativeDomains: z.array(z.string()),
  excludedCompetitors: z.array(z.string()),
  accessRole: z.string().describe("OWNER manages the project, FULL_ACCESS edits it, READ_ONLY reads it."),
  createdAt: timestamp("When the project was created"),
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
  text: z.string().nullable().describe("The whole profile as stored, one `Label: value` block per field. null = not described yet."),
  profile: CompanyProfileSchema.optional().describe("One field per question about the brand; null where nothing is written yet."),
  updatedAt: z.string().nullable().describe("When the profile was last written, ISO 8601 in UTC. null = no profile yet."),
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
  parentId: z.string().nullable().describe("The category this one sits under. null = top-level."),
  source: z.string().describe("ai = proposed by PromptEye, manual = written by hand."),
});

const promptKeyword = z.string().describe("Keyword the prompt was built around. Empty when it was written by hand.");

const promptStatus = z
  .string()
  .describe("active = asked on every run, paused = not asked, pending = added but not measured yet.");

const promptGroupId = z.string().nullable().describe("null = the prompt is ungrouped.");

const promptCreatedAt = timestamp("When the prompt was added");

const aiTraffic = z
  .number()
  .nullable()
  .describe(
    "Estimated monthly searches behind the prompt; a property of the prompt, not of the period. " +
      "0 = measured, below the reporting floor of 50 searches a month. " +
      "null = no figure: not measured yet when aiTrafficMeasuredAt is null, otherwise measured with no volume found (unknown, not zero)."
  );

const aiTrafficMeasuredAt = z
  .string()
  .nullable()
  .describe(
    "When aiTraffic was last measured, ISO 8601 in UTC. null = never measured. A failed refresh keeps the previous figure and date."
  );

const businessPriority = z
  .string()
  .nullable()
  .describe(
    "very_high, high, medium, low or very_low. null = not ranked yet. A priority set by hand wins over the computed one."
  );

const businessPriorityReason = z
  .string()
  .nullable()
  .describe("Why the priority was set by hand. null = the computed priority, or no reason given.");

export const PromptSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  keyword: promptKeyword,
  status: promptStatus,
  categories: z.array(z.string()),
  subcategories: z.array(z.string()),
  groupId: promptGroupId,
  createdAt: promptCreatedAt,
  aiTraffic,
  aiTrafficMeasuredAt: aiTrafficMeasuredAt.optional(),
  businessPriority,
  businessPriorityReason,
  metrics: MetricsSchema,
  change: NullableMetricsChangeSchema,
});

export const PromptDetailSchema = PromptSchema.extend({
  byModel: z
    .array(z.object({ model: z.string(), metrics: ModelMetricsSchema }))
    .describe("One entry per assistant that actually answered."),
});

export const PromptGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional().describe("What the group is for. null = nobody described it."),
  order: z.number().nullable().describe("Where the group sits in the project's own ordering, lowest first."),
  promptCount: z.number().describe("Prompts in the group, paused ones included."),
  aiTrafficTotal: z
    .number()
    .nullable()
    .describe(
      "Monthly searches behind the group's prompts still being asked, added up; paused prompts add nothing. " +
        "null = none of them has a measured figure."
    ),
  metrics: MetricsSchema,
});

export const PromptSuggestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  mode: z
    .string()
    .describe("gap = fills a funnel stage the group does not cover, replicate = close to prompts already performing in it."),
  groupId: z.string(),
  groupName: z.string().nullable(),
  sourcePhrase: z.string(),
  sourcePhraseVolume: z
    .number()
    .nullable()
    .describe("Monthly searches for sourcePhrase as the traffic provider reports them, not an estimate of the prompt."),
  aiTraffic: z
    .number()
    .nullable()
    .describe("Estimated monthly searches behind the prompt, on the scale tracked prompts use. null = the phrases came back with no data."),
  relativeVolumeScore: z.number().describe("Where the demand sits among the group's prompts, 0 lowest to 1 highest."),
  relativeVolumeLabel: z.string().describe("very_high, high or standard, relative to the group rather than the market."),
  purchaseIntentLevel: z.number().describe("1 educational, 2 solution-seeking, 3 comparison, 4 decision."),
  companyFitScore: z.number().describe("How well the question fits what the brand sells, 0 unrelated to 1 squarely on topic."),
  companyFitReason: z.string(),
  whyText: z.string(),
  whyArguments: z.array(z.string()),
  createdAt: timestamp("When the suggestion was generated"),
  expiresAt: timestamp("When it lapses if nobody decides on it"),
});

export const CitedDomainSchema = z.object({
  domain: z.string(),
  sourceOccurrences: z
    .number()
    .describe("Times a page on this exact host appeared among an answer's sources; a count of sources, not answers."),
  share: z
    .number()
    .describe(
      "The domain's share of the source occurrences across the domains reported, in percent 0-100 with up to five decimals."
    ),
  ownDomain: z.boolean().describe("Whether it is the project's own domain or one of its alternatives."),
});

export const CompetitorSchema = z.object({
  brand: z.string(),
  ownBrand: z.boolean().describe("True for the project's own brand, ranked alongside the rest."),
  metrics: MetricsSchema,
  change: NullableMetricsChangeSchema,
  shareOfVoice: z
    .number()
    .nullable()
    .describe(
      "How much of the naming this brand took, in whole percent 0-100; all brands in the period add up to 100. null = no figure for the period."
    ),
  citedAnswers: z
    .number()
    .nullable()
    .describe(
      "Answers citing at least one domain of this brand, each domain once per answer; a count of answers, not sources. null = no figure for the period."
    ),
  citationShare: z
    .number()
    .nullable()
    .describe(
      "Share of the answers carrying any sources that cited this brand, in whole percent 0-100; brands do not add up to 100. null = no answer carried sources."
    ),
});

/** A prompt as it comes back from being added: it has not been asked yet. */
export const NewPromptSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  groupName: z.string().nullable().describe("The group it was filed under. null = ungrouped."),
});

/** Every entry an endpoint has, in one response. */
const listOf = <T extends z.ZodTypeAny>(entry: T) => z.object({ data: z.array(entry) });

export const NextCursorSchema = z
  .string()
  .nullable()
  .describe("Pass as cursor to read the next page. null = this was the last page.");

/** A page of entries, walked with `nextCursor`. */
const pageOf = <T extends z.ZodTypeAny>(entry: T) => z.object({ data: z.array(entry), nextCursor: NextCursorSchema });

export const ProjectListSchema = listOf(ProjectSchema);
export const CategoryListSchema = listOf(CategorySchema);
export const PromptSuggestionListSchema = listOf(PromptSuggestionSchema);
export const NewPromptListSchema = listOf(NewPromptSchema);
export const PromptPageSchema = pageOf(PromptSchema);
export const PromptGroupPageSchema = pageOf(PromptGroupSchema);
export const PromptGroupSettingsSchema = PromptGroupSchema.omit({ aiTrafficTotal: true, metrics: true });
export const CitedDomainPageSchema = pageOf(CitedDomainSchema);
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
  domain: z.string().nullable().describe("Website without `www.`. null = the form carried no website."),
  /** Where the finished report was sent. */
  email: z.string(),
  status: z.string().describe("processing until the assistants have answered, then ready, or error."),
  score: z.number().nullable().describe("Visibility of the brand in whole percent 0-100. null = the report is not ready yet."),
  reach: z.string().nullable().describe("How far the brand sells: local, regional or national."),
  country: z.string().nullable().describe("Market the report was taken in, ISO 3166-1 alpha-2."),
  language: z.string().nullable(),
  utm: z.string().nullable(),
  leadStatus: z.string().describe("new, in_progress or done; moved in the PromptEye app, not through the API."),
  projectId: z.string().nullable().describe("The project the report was converted into. null = still only a sample."),
  contactCount: z.number().describe("How many times the brand asked to be contacted from the report page."),
  createdAt: timestamp("When the report was ordered"),
  readyAt: z.string().nullable().describe("When it finished, ISO 8601 in UTC. null = not finished yet."),
  /** The public report page, in the agency's branding. */
  url: z.string(),
});

export const ReportDetailSchema = ReportSchema.extend({
  industry: z.string().nullable(),
  monthlySearches: z
    .number()
    .nullable()
    .describe("Monthly searches behind the prompts the report asked, as the traffic provider reports them."),
  /** Every question put to the assistants for this report. */
  prompts: z.array(z.string()),
  rankingPhrases: z.array(z.string()),
  competitors: z
    .array(z.object({ name: z.string(), score: z.number().describe("Its visibility, in whole percent 0-100.") }))
    .describe("Other brands the same answers named, strongest first."),
  models: z
    .array(
      z.object({
        model: z.string(),
        score: z.number().nullable().describe("Visibility in this assistant's answers, in whole percent 0-100."),
        answers: z.number().nullable().describe("How many of the prompts this assistant answered."),
        averagePosition: z
          .number()
          .nullable()
          .describe("Mean place the brand took in the answers that named it, counting from 1."),
      })
    )
    .describe("One entry per assistant that answered; the others are left out."),
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
      type: z.string().describe("calendly, email or phone: how the brand asked to be reached."),
      createdAt: timestamp("When the brand asked"),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      meetingAt: z.string().nullable().describe("Start of the meeting booked through Calendly, as Calendly sent it. null = none booked."),
      inviteeEmail: z.string().nullable(),
    })
  ),
});

export const ReportPageSchema = pageOf(ReportSchema);

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

export const ContentBriefPhraseSchema = z.object({
  keyword: z.string(),
  type: z.string(),
  confidence: z.number(),
});

export const ContentBriefSeparateArticleSchema = z.object({
  keyword: z.string(),
  articleTitle: z.string().nullable(),
  type: z.string(),
  confidence: z.number(),
  reason: z.string(),
  priority: z.number().describe("How worthwhile the separate article is, 1 (highest) to 5."),
});

export const ContentBriefOutlineItemSchema = z.object({
  level: z.string().describe("H2 or H3."),
  text: z.string(),
  annotation: z.string().nullable(),
  sourcePhrases: z.array(z.string()).nullable(),
  includesBrand: z.boolean().describe("Whether this is the one section required to name the brand."),
  faqQuestions: z.array(z.string()).nullable().describe("Questions to answer as FAQ; set only for the FAQ section."),
  origin: z
    .string()
    .nullable()
    .describe(
      "When optimizing an existing article: existing (kept), from_fanout (built from a phrase) or added. null = brief built from scratch."
    ),
  originalHeading: z.string().nullable().describe("The original heading this replaces; set only when origin is existing."),
  originalHasDirectAnswer: z
    .boolean()
    .nullable()
    .describe("Whether the original section already answered directly; set only when origin is existing."),
});

export const ContentBriefSchema = z.object({
  id: z.string(),
  status: z.string().describe("processing until generated, then ready (title and outline filled in) or error."),
  projectId: z.string(),
  trackerId: z.string().nullable().describe("The tracked prompt the brief is linked to. null = requested standalone."),
  prompt: z.string(),
  error: z.string().nullable().describe("Why generation failed. null unless status is error."),
  title: z.string().nullable().describe("Generated article title. null until status is ready."),
  originalTitle: z
    .string()
    .nullable()
    .describe("Title of the existing article being optimized. null = no existing article, or not ready yet."),
  titleChangeAnnotation: z
    .string()
    .nullable()
    .describe("Why the title changed. null = kept, no existing article, or not ready yet."),
  fanoutSource: z.string().nullable().describe("Which fan-out engine produced the phrases. null until ready."),
  fanoutError: z
    .string()
    .nullable()
    .describe("Set when the fan-out failed but the brief completed with the phrases it had. null otherwise."),
  fanoutVariants: z.array(ContentBriefPhraseSchema).nullable().describe("Every phrase the fan-out found. null until ready."),
  phrasesForArticle: z
    .array(ContentBriefPhraseSchema)
    .nullable()
    .describe("Phrases that belong in this article and built the outline. null until ready."),
  separateArticles: z
    .array(ContentBriefSeparateArticleSchema)
    .nullable()
    .describe("Phrases that deserve an article of their own. null until ready."),
  outline: z.array(ContentBriefOutlineItemSchema).nullable().describe("The H2/H3 structure of the article. null until ready."),
  sourceTextMatchPercentage: z
    .number()
    .nullable()
    .describe(
      "How much of the phrase coverage the existing article already had, in whole percent 0-100. null = no existing article, or not ready yet."
    ),
  requestedAt: timestamp("When the brief was requested"),
  readyAt: z.string().nullable().describe("When it finished, ISO 8601 in UTC. null = not finished yet."),
});

export type CreateContentBriefInput = {
  projectId: string;
  prompt: string;
  trackerId?: string;
};

export type ContentBrief = z.infer<typeof ContentBriefSchema>;
export type ContentBriefPhrase = z.infer<typeof ContentBriefPhraseSchema>;
export type ContentBriefSeparateArticle = z.infer<typeof ContentBriefSeparateArticleSchema>;
export type ContentBriefOutlineItem = z.infer<typeof ContentBriefOutlineItemSchema>;

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

export const CreatePromptGroupRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(500).optional(),
  order: z.number().int().min(0).optional(),
});

export const UpdatePromptGroupRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().max(500).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

export const PromptSettingsSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  keyword: promptKeyword,
  status: promptStatus,
  categories: z.array(z.string()),
  subcategories: z.array(z.string()),
  groupId: promptGroupId,
  createdAt: promptCreatedAt,
  aiTraffic,
  aiTrafficMeasuredAt: aiTrafficMeasuredAt.optional(),
  businessPriority,
  businessPriorityReason: businessPriorityReason.optional(),
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
export type CreatePromptGroupInput = z.infer<typeof CreatePromptGroupRequestSchema>;
export type UpdatePromptGroupInput = z.infer<typeof UpdatePromptGroupRequestSchema>;

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
export type Competitor = z.infer<typeof CompetitorSchema>;
export type CompetitorExclusion = z.infer<typeof CompetitorExclusionSchema>;
export type ReplaceCompetitorExclusionItem = z.infer<typeof ReplaceCompetitorExclusionItemSchema>;
export type ReplaceCompetitorExclusionsInput = z.infer<typeof ReplaceCompetitorExclusionsRequestSchema>;
export type Prompt = z.infer<typeof PromptSchema>;
export type PromptDetail = z.infer<typeof PromptDetailSchema>;
export type PromptSettings = z.infer<typeof PromptSettingsSchema>;
export type PromptGroup = z.infer<typeof PromptGroupSchema>;
export type PromptGroupSettings = z.infer<typeof PromptGroupSettingsSchema>;
export type PromptSuggestion = z.infer<typeof PromptSuggestionSchema>;
export type NewPrompt = z.infer<typeof NewPromptSchema>;

/*
 * Google: what Google itself reports for the project's site — Search Console
 * clicks and impressions, and the Google Analytics sessions that arrived from
 * an AI assistant. None of it is a PromptEye measurement: it counts people who
 * reached the site, where visibility counts answers that named the brand.
 */

export const IntegrationSchema = z.object({
  connected: z
    .boolean()
    .describe("Whether it is connected. While false, the figures it feeds are zeros that describe a missing integration, not a quiet site."),
  reason: z
    .string()
    .nullable()
    .describe(
      "not_connected = the figures say nothing about the site; sync_failing = connected but the last sync failed, so figures are stale. null = connected and working."
    ),
});

export const IntegrationsStatusSchema = z.object({
  searchConsole: IntegrationSchema,
  analytics: IntegrationSchema,
  botLogs: IntegrationSchema,
  sitemap: IntegrationSchema,
});

/** How the last pull from Google went. `failedSince` stays null while it is healthy. */
export const GoogleSyncSchema = z.object({
  lastSyncedAt: z
    .string()
    .nullable()
    .describe("When the last successful sync finished, ISO 8601 in UTC. null = before the first one."),
  failedSince: z.string().nullable().describe("When the sync started failing, ISO 8601 in UTC. null = it works."),
  error: z.string().nullable().describe("Why the last sync failed. null = it works."),
});

export const SearchConsoleStatusSchema = z.object({
  connected: z.boolean(),
  siteUrl: z.string().nullable().describe("The bound property as Google names it, e.g. sc-domain:example.com. null = none bound."),
  /** What the bound account may read, e.g. `siteOwner`. */
  permissionLevel: z.string().nullable(),
  sync: GoogleSyncSchema.nullable(),
});

export const AnalyticsStatusSchema = z.object({
  connected: z.boolean(),
  propertyId: z.string().nullable().describe("The bound Google Analytics property. null = none bound."),
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
  date: z.string().describe("The day, YYYY-MM-DD."),
  clicks: z.number(),
  impressions: z.number(),
});

/** The figures every Search Console row carries, whatever it is a row of. */
const searchFigures = {
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number().describe("Clicks divided by impressions, a rate from 0 to 1, not a percentage."),
  position: z.number().describe("Average position in Google results weighted by impressions, counting from 1; lower is better."),
};

export const SearchSummarySchema = z.object({
  ...searchFigures,
  timeline: z.array(SearchTimelinePointSchema).describe("Clicks and impressions for each day of the period, oldest first."),
});

export const SearchQuerySchema = z.object({ query: z.string(), ...searchFigures });
export const SearchPageSchema = z.object({ page: z.string(), ...searchFigures });

/** Only the sessions whose referrer was recognised as an AI assistant are counted. */
export const AnalyticsSummarySchema = z.object({
  sessions: z.number(),
  engagedSessions: z.number(),
  engagementRate: z.number().describe("Engaged sessions divided by sessions, a rate from 0 to 1, not a percentage."),
  averageSessionDuration: z.number().describe("Average session length in seconds."),
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

export type Integration = z.infer<typeof IntegrationSchema>;
export type IntegrationsStatus = z.infer<typeof IntegrationsStatusSchema>;
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

const botKind = TrafficKindSchema.describe("ai = an AI assistant's bot, seo = search engines and SEO tools.");

export const TrafficEventSchema = z.object({
  id: z.string(),
  at: timestamp("When the bot made the request"),
  botId: z.string(),
  name: z.string(),
  vendor: z.string(),
  botType: z.string(),
  kind: botKind,
  category: TrafficCategorySchema,
  path: z.string(),
  statusCode: z.number().nullable().describe("HTTP status the site answered with. null = none reported."),
  redirectLocation: z.string().nullable().describe("Where a redirect pointed. null = not a redirect."),
  responseTimeMs: z.number().nullable().describe("How long the site took to answer, in milliseconds. null = not reported."),
  country: z.string().nullable().describe("Two-letter country the request came from. null = unknown."),
  referer: z.string().nullable().describe("The referrer the bot sent. null = none."),
  verified: z
    .boolean()
    .describe(
      "Whether the origin was confirmed as the bot it claims to be; false also when it could not be checked. Unverified requests are claims, so counts are upper bounds."
    ),
});

export const TrafficCountSchema = z.object({
  key: z
    .string()
    .describe("A bot id, a path, an HTTP status code (unknown when none was reported), a UTC day or a category."),
  label: z.string().nullable().describe("Display name, set for bots. null for the other groupings."),
  count: z.number().describe("Requests in the group."),
  uniquePaths: z.number().describe("Distinct paths those requests asked for."),
  lastAt: timestamp("When the newest request of the group was made"),
});

export const TrafficCountPageSchema = z.object({
  data: z.array(TrafficCountSchema),
  nextCursor: z.string().nullable().describe("Always null: the answer is ranked, not paged."),
  partial: z
    .boolean()
    .describe("true = the period held more requests than could be read, so the counts describe the newest ones only."),
});

export const TrafficCrawlSchema = z.object({
  path: z.string(),
  botId: z.string(),
  name: z.string(),
  vendor: z.string(),
  botType: z.string(),
  kind: botKind,
  firstVisitAt: timestamp("When the bot first asked for the path"),
  lastVisitAt: timestamp("When the bot last asked for the path"),
  visitCount: z.number().describe("How many times the bot asked for the path since tracking began, not over a period."),
  lastStatusCode: z.number().nullable().describe("HTTP status the site answered with the last time. null = none reported."),
});

export const TrafficSitemapUrlSchema = z.object({
  url: z.string(),
  path: z.string().describe("The path in the form the other traffic tools use, so the two can be joined."),
  lastModified: z.string().nullable().describe("The lastmod the sitemap gives, as written there. null = none given."),
  firstSeenAt: timestamp("When the address first appeared in the sitemap"),
  lastSeenAt: timestamp("When the address was last found in the sitemap"),
  active: z.boolean().describe("Whether the sitemap still lists it."),
});

export const TrafficSitemapStateSchema = z.object({
  url: z.string(),
  status: z.enum(["active", "syncing", "error"]).describe("Where the last sync stands."),
  lastSyncedAt: z.string().nullable().describe("When the last sync finished, ISO 8601 in UTC. null = before the first one."),
  nextSyncAt: timestamp("When the next sync is due"),
  urlCount: z.number().describe("How many addresses the last sync found."),
  error: z.string().nullable().describe("Why the last sync failed. null = it works."),
});

export const TrafficSitemapPageSchema = z.object({
  sitemap: TrafficSitemapStateSchema.nullable().describe("null = no sitemap is connected; data is then empty."),
  data: z.array(TrafficSitemapUrlSchema),
  nextCursor: NextCursorSchema,
});

export const TrafficEventPageSchema = pageOf(TrafficEventSchema);
export const TrafficCrawlPageSchema = pageOf(TrafficCrawlSchema);

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

export const FeedbackSchema = z.object({
  id: z.string(),
  receivedAt: timestamp("When PromptEye received the report"),
});

export type CreateFeedbackInput = {
  need: string;
  attemptedAction: string;
};

export type Feedback = z.infer<typeof FeedbackSchema>;
