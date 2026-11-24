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
  "Movement against the period of the same length directly before this one. null = no figure could be compared, " +
    "which is always the case when either period has fewer than 7 measured days (see changesHidden)."
);

/** Whether the response hides every `change`; absent from API versions that predate it. */
export const ChangesHiddenSchema = z
  .boolean()
  .optional()
  .describe(
    "True when every change in the response is null because either period (this one or the one of the same length " +
      "before it) has fewer than 7 measured days, counted from the project's creation and never past today. false " +
      "does not promise a change on every entry: one neither period measured still has change null."
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
  scanFrequency: z
    .string()
    .describe(
      "How often prompts are asked across the account, e.g. daily: the most frequent among its projects, so a single " +
        "project may be asked less often. Each project's own frequency is scanFrequency in list_projects."
    ),
  nextScanAt: z
    .string()
    .describe(
      "When the next scheduled run of any project of the account starts, not when it finishes, ISO 8601 in UTC; a project " +
        "asked less often may run later, see its nextScanAt in list_projects. Answers land over the hours after it, so " +
        "figures keep moving. A newly added prompt is asked straight away and does not wait for this run."
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
  accessRole: z
    .string()
    .describe(
      "OWNER manages the project, FULL_ACCESS edits it, READ_ONLY reads it. An OWNER or ADMIN of a workspace is OWNER of " +
        "every project in it, so OWNER does not mean the project is the key holder's own: workspaceName says whose it is."
    ),
  workspaceId: z
    .string()
    .nullable()
    .optional()
    .describe("Workspace the project lives in, as list_workspaces reports it. null = a project that predates workspaces."),
  workspaceName: z.string().nullable().optional().describe("Name of that workspace. null alongside workspaceId."),
  createdAt: timestamp("When the project was created"),
  publicUrl: z
    .string()
    .nullable()
    .optional()
    .describe("Link anyone can open without logging in to view the project. null = the project is not shared."),
  scanFrequency: z
    .string()
    .optional()
    .describe(
      "How often this project's prompts are asked: thriceDaily, twiceDaily, daily, everyTwoDays or weekly. A weekly " +
        "project has no new answers between its runs, so missing days are expected, not a fault. It is set in the " +
        "app or with update_project, on accounts with scan-frequency control."
    ),
  nextScanAt: z
    .string()
    .optional()
    .describe(
      "When this project's next scheduled run starts, ISO 8601 in UTC; its answers land over the hours after it. The run " +
        "asks the project's active prompts and only while the workspace's plan is active."
    ),
});

export const PublicLinkSchema = z.object({
  isPublic: z.boolean().describe("Whether the project can be viewed without logging in."),
  url: z.string().nullable().describe("The public link. null = the project is not shared."),
});

export type PublicLink = z.infer<typeof PublicLinkSchema>;

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

const aiTrafficSource = z
  .enum(["measured", "estimated", "from_generation"])
  .nullable()
  .describe(
    "How aiTraffic was obtained. measured = the volume of the decisive phrase, looked up for this prompt (also when no volume was found). " +
      "estimated = an AI estimate, because no phrase reached 50 searches a month. " +
      "from_generation = carried over from the phrase the prompt was generated from, not looked up for the prompt itself. " +
      "null = not measured since PromptEye started recording the source."
  );

const AiTrafficPhraseSchema = z.object({
  phrase: z.string().describe("A search phrasing of the prompt."),
  volume: z.number().nullable().describe("Monthly searches for the phrase. null = no volume came back for it."),
  measuredAt: z.string().nullable().describe("When the phrase was looked up, ISO 8601 in UTC. null = unknown."),
  decisive: z
    .boolean()
    .describe("true = the phrase whose volume became aiTraffic (the highest). No phrase is decisive when the figure is estimated."),
});

const aiTrafficPhrases = z
  .array(AiTrafficPhraseSchema)
  .nullable()
  .describe(
    "The search phrases the prompt was measured with. aiTraffic is the volume of the decisive one rounded up to tens, or 0 under 50. " +
      "null = not measured since PromptEye started recording the phrases."
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
  aiTrafficSource: aiTrafficSource.optional(),
  businessPriority,
  businessPriorityReason,
  metrics: MetricsSchema,
  change: NullableMetricsChangeSchema,
});

export const PromptDetailSchema = PromptSchema.extend({
  changesHidden: ChangesHiddenSchema,
  aiTrafficPhrases: aiTrafficPhrases.optional(),
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

export const SponsoredOfferSchema = z.object({
  available: z
    .boolean()
    .describe(
      "Whether WhitePress sells anything on this domain: a new sponsored article, a link insert in an existing article, or a mention in an existing article."
    ),
  price: z.number().nullable().describe("The price of a NEW sponsored article, in `currency`. null = no new article on sale."),
  currency: z.string().nullable().describe("The currency of `price`. null = no new article on sale."),
  linkInsert: z.boolean().describe("Whether a link can be bought in an existing article on this domain."),
  mention: z.boolean().describe("Whether a brand mention can be bought in an existing article on this domain."),
  linkOrMentionPriceFrom: z
    .number()
    .nullable()
    .describe("The cheapest link insert or mention price, in `linkOrMentionCurrency`. null = none or not checked yet."),
  linkOrMentionCurrency: z
    .string()
    .nullable()
    .describe("The currency of `linkOrMentionPriceFrom`. null = none or not checked yet."),
  domainRank: z.number().nullable().describe("The domain's DataForSEO rank, shown as DR in the app. null = unknown."),
  monthlyVisits: z.number().nullable().describe("Estimated monthly organic visits to the domain. null = unknown."),
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
  offer: SponsoredOfferSchema.optional().describe(
    "The sponsored publication offer for the domain. Present only when includeOffers was passed, and never on the own domain."
  ),
});

export const CompetitorSchema = z.object({
  rank: z
    .number()
    .optional()
    .describe(
      "The brand's place in the whole ranking of the period, 1 for the strongest. The own brand's row added past limit " +
        "keeps its true place, so it can be greater than limit."
    ),
  brand: z.string(),
  ownBrand: z
    .boolean()
    .describe(
      "True for the project's own brand, ranked alongside the rest. Its row is always returned, even when limit cuts it: " +
        "it is added after the others, so a page can hold limit + 1 rows. When the own brand is a product line, the row " +
        "added is its parent company's (ownBrand false). A brand no answer named in the period is not in the ranking."
    ),
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

export const WorkspaceSchema = z.object({
  id: z
    .string()
    .describe("Pass it as workspaceId to create_project to create a project there, or to list_projects to list only its projects."),
  name: z.string(),
  kind: z.string().describe("personal = the workspace every account has of its own, team = one shared with others."),
  role: z
    .string()
    .describe("What the account may do in the workspace: OWNER, ADMIN and MEMBER may create projects there; VIEWER reads only."),
  scoped: z
    .boolean()
    .describe(
      "Whether the account reaches only the projects it was invited to rather than the whole workspace. A scoped seat cannot create projects in the workspace."
    ),
});

export const WorkspacePageSchema = pageOf(WorkspaceSchema);

export const AcceptedPromptSuggestionSchema = z.object({
  trackerId: z.string().nullable().describe("Id of the prompt the suggestion became, as list_prompts reports it."),
});

export const SuggestionRunSchema = z.object({
  runId: z.string().nullable().describe("Id of the run that was scheduled. null = nothing was scheduled, see skipped."),
  skipped: z
    .string()
    .nullable()
    .describe(
      "Why no run was scheduled; set exactly when runId is null. not_eligible = the project's plan does not currently pay for background work, " +
        "cooldown = the last run finished less than 7 days ago and its proposals still await a decision, " +
        "nothing_to_suggest = the group is already healthy: no funnel gap to fill and nothing worth imitating. In a new group it usually means too few measured prompts: a run needs at least 5 active prompts already measured and scored for purchase intent, or at least 2 active prompts with a computed business priority. Add prompts, wait for their first measurement, then try again."
    ),
});

export const SUGGESTION_EMPTY_REASONS = ["no_phrases", "no_phrase_volume", "filtered_out", "all_duplicates"] as const;

export const SuggestionEmptyReasonSchema = z.enum(SUGGESTION_EMPTY_REASONS).describe(
  "Why a completed run produced no suggestions: no_phrases = no search phrases could be derived for the group topic, " +
    "no_phrase_volume = phrases have no measurable search demand, " +
    "filtered_out = candidates did not match the funnel stage the group lacks, " +
    "all_duplicates = every candidate duplicated existing prompts or earlier suggestions."
);

export const SuggestionRunAvailabilitySchema = z.object({
  canRun: z.boolean().describe("Whether generate_prompt_suggestions would schedule a run right now."),
  reason: z
    .string()
    .describe(
      "Why a run would or would not be scheduled: not_eligible = the project's plan does not currently pay for background work, " +
        "no_slots = no free prompt slots remain on the plan, running = a run is already in progress for this group, " +
        "cooldown = the last run finished less than 7 days ago and its proposals still await a decision, " +
        "nothing_to_suggest = the group is already healthy, or too few of its prompts are measured yet (a run needs at least 5 active prompts scored for purchase intent, or at least 2 with a computed business priority), " +
        "ready = nothing is blocking a new run."
    ),
  pendingSuggestionCount: z.number().describe("Suggestions from this group still awaiting a decision."),
  availableSlots: z.number().describe("Free prompt slots left on the plan; a run proposes at most this many."),
  lastRun: z
    .object({
      status: z.string().describe("running, completed or failed."),
      startedAt: timestamp("When the run started"),
      finishedAt: z.string().nullable().describe("When it finished, ISO 8601 in UTC. null = still running."),
      producedCount: z
        .number()
        .int()
        .nullish()
        .describe(
          "How many suggestions the run produced. null while the run has not finished. 0 on a finished run means it came back empty: read emptyReason (or error when status is failed) to see why."
        ),
      emptyReason: SuggestionEmptyReasonSchema.nullish().describe(
        "null when the run produced suggestions, failed, or is an older run recorded before reasons were kept. Otherwise why a completed run produced none."
      ),
      error: z.string().nullish().describe("Failure message when the status is failed; null otherwise."),
    })
    .nullable()
    .describe("This group's most recent run. null = it never had one."),
});
export const PromptPageSchema = pageOf(PromptSchema).extend({ changesHidden: ChangesHiddenSchema });
export const PromptGroupPageSchema = pageOf(PromptGroupSchema);
export const PromptGroupSettingsSchema = PromptGroupSchema.omit({ aiTrafficTotal: true, metrics: true });
export const CitedDomainPageSchema = pageOf(CitedDomainSchema);
export const CompetitorPageSchema = pageOf(CompetitorSchema).extend({ changesHidden: ChangesHiddenSchema });

export const CitedPageSchema = z.object({
  url: z.string().describe("The exact page the assistants cited."),
  domain: z.string().describe("Host the page belongs to, without www."),
  sourceOccurrences: z
    .number()
    .describe("Times this exact page appeared among an answer's sources in the period; a count of sources, not answers."),
  share: z
    .number()
    .describe(
      "The page's share of the source occurrences across the pages reported, in percent 0-100 with up to five decimals. " +
        "A page cited only below the limit cut is not in the denominator."
    ),
  ownDomain: z.boolean().describe("Whether the page's domain belongs to the brand, its own or an alternative one."),
});

export const CitedPagePageSchema = pageOf(CitedPageSchema);

export const ANSWER_BRAND_PRESENCE = ["named", "missing"] as const;

export const AnswerSourceSchema = z.object({
  url: z.string().describe("Address the assistant cited."),
  domain: z.string().describe("Host of that address, without `www.`."),
  title: z.string().nullable().describe("Title of the cited page. null = none known."),
});

export const AnswerSchema = z.object({
  id: z.string().describe("Unique identifier of this answer, `<resultId>:<model>`."),
  resultId: z
    .string()
    .describe("The collection run this answer belongs to, the same id `sourceResultIds` of a brand analysis lists."),
  date: z.string().describe("Day the answer was collected, YYYY-MM-DD."),
  promptId: z.string().describe("Prompt that was asked."),
  prompt: z.string().describe("Text of that prompt."),
  model: z.string().describe("The assistant that gave this answer."),
  brand: z.enum(ANSWER_BRAND_PRESENCE).describe("named = the brand was named in this answer, missing = it was not."),
  position: z
    .number()
    .int()
    .nullable()
    .describe("Where the brand was first named, counting from 1. null = the brand was not named."),
  text: z.string().describe("The answer as the assistant gave it."),
  sources: z.array(AnswerSourceSchema).describe("Pages the assistant cited in this answer."),
});

export const AnswerPageSchema = pageOf(AnswerSchema);

export const BrandAnalysisRankingEvidenceSchema = z.object({
  brand: z.string(),
  visibility: z.number().describe("Share of observations naming this brand, 0-100."),
  visibleCount: z.number(),
  observationCount: z.number(),
  averagePosition: z.number().nullable(),
});

export const BrandAnalysisGapSchema = z.object({
  key: z.string(),
  label: z.string(),
  bestBrand: z.string().describe("The brand that best answers this topic today."),
  gapScore: z.number().describe("How far behind the leader this topic is, 0-100."),
  whyLeaderWins: z.string(),
  whyWeMiss: z.string(),
  sourceResultIds: z.array(z.string()).describe("The tracking results this topic was derived from."),
  rankingEvidence: z.array(BrandAnalysisRankingEvidenceSchema).nullable(),
});

export const BrandAnalysisSentimentSchema = z.object({
  overallSentiment: z.string().describe("positive, neutral or negative."),
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
  status: z
    .string()
    .describe("processing the moment it is requested, then ready, or error / corrupted_response when it failed — see error."),
  createdAt: timestamp("When the run was requested"),
  updatedAt: timestamp("When the run last changed"),
  activePromptCount: z.number().describe("How many active tracked prompts fed this run."),
  usedResultCount: z.number().describe("How many tracking results fed this run."),
  maxContextGaps: z.number().nullable().describe("How many gaps this run may report at most."),
  gaps: z.array(BrandAnalysisGapSchema).describe("The topics where a competitor answers better than this brand. Empty until ready."),
  sentiment: BrandAnalysisSentimentSchema.nullable().describe(
    "How the assistants talk about the brand when they mention it. null until ready."
  ),
  totalCost: z.number().nullable().describe(
    "PromptEye's internal AI processing cost in USD, not a charge to the user. null until the run finishes."
  ),
  error: z.string().nullable().describe("Why the run failed. null unless status is error or corrupted_response."),
});

export const BrandAnalysisAvailabilitySchema = z.object({
  canRun: z.boolean().describe("Whether a new run can be started right now."),
  reason: z
    .string()
    .describe(
      "Why a new run can or cannot be started: no_project = the project could not be reached, " +
        "no_prompts = the project has no active tracked prompts yet, no_results = the active prompts have not produced tracking results yet, " +
        "processing = a run is already in progress, up_to_date = the latest run already reflects the current tracking results, " +
        "retry_error / retry_corrupted_response = the latest run failed and running again is allowed, ready = nothing is blocking a new run."
    ),
  activePromptCount: z.number(),
  usedResultCount: z.number(),
  latestTrackScoreResultTimestamp: z
    .string()
    .nullable()
    .describe("When the most recent tracking result of the project was taken. null = none yet."),
});

const auditPresenceCheck = z
  .object({
    present: z.boolean().describe("Whether the page has this element."),
    status: z.boolean().describe("Whether it passes the check."),
    message: z.string().nullable().describe("Explanation of the finding."),
  })
  .nullable();

export const AuditAnalysisSchema = z.object({
  howToSchema: auditPresenceCheck,
  organisation: auditPresenceCheck,
  breadcrumb: auditPresenceCheck,
  faqSchema: auditPresenceCheck,
  contentStructure: z.object({ h1: z.boolean(), headings: z.boolean(), rawMessage: z.string().nullable() }).nullable(),
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
  status: z.string().describe("pending, success or error."),
  error: z.string().nullable(),
  totalCost: z.number().nullable().describe(
    "PromptEye's internal AI processing cost in USD, not a charge to the user. null until the audit finishes."
  ),
  analysis: AuditAnalysisSchema.nullable().describe(
    "The nine content checks run on the URL. null until status is success."
  ),
});

export const AuditSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable().describe("The project this audit was billed to. null = run without one."),
  status: z
    .string()
    .describe(
      "pending the moment it is requested; success once every URL succeeded, partial when only some did, error when none did."
    ),
  startDate: timestamp("When the audit started"),
  endDate: z.string().nullable().describe("When it finished, ISO 8601 in UTC. null = not finished yet."),
  duration: z.number().nullable().describe("How long the audit took, in seconds."),
  numberOfUrls: z.number(),
  results: z.array(AuditUrlResultSchema),
});

export const AuditUsageSchema = z.object({
  limit: z.number().describe("How many URLs the plan allows to audit this calendar month."),
  used: z.number(),
  remaining: z.number(),
});

const topicalMapStatus = z
  .string()
  .describe("processing the moment it is requested, then ready — pillar and clusters filled in — or error, see errorMessage.");

export const TopicalMapSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  topic: z.string(),
  language: z.string(),
  status: topicalMapStatus,
  createdAt: timestamp("When the map was requested"),
  generationCost: z.number().nullable().describe("Cost of the generation, in USD."),
});

export const TopicalMapClusterSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().describe("The group this article belongs to."),
  intent: z
    .string()
    .describe("What a reader searching for this title is trying to do: Informational, Navigational or Transactional."),
});

export const TopicalMapSchema = TopicalMapSummarySchema.extend({
  pillar: z
    .object({ title: z.string(), description: z.string() })
    .nullable()
    .describe("The compendium page. null until ready."),
  clusters: z.array(TopicalMapClusterSchema).describe("The supporting article titles, grouped by category. Empty until ready."),
  errorMessage: z.string().nullable().describe("Why generation failed. null unless status is error."),
});

export const TopicalMapListSchema = listOf(TopicalMapSummarySchema);

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
  place: z.string().nullable().optional().describe("City or region the report was taken for, as sent. null = none was given."),
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

export const CreatedReportSchema = ReportSchema.omit({
  email: true,
  utm: true,
  leadStatus: true,
  projectId: true,
  contactCount: true,
}).extend({
  // A plain string, not an enum: the response is parsed after the report was already ordered, so a
  // value this server does not know yet must not turn a spent order into an error.
  emailStatus: z
    .string()
    .optional()
    .describe(
      "Whether this call emails the report, as decided at the moment of the call; it is not updated " +
        "later. scheduled = the email is queued; when_ready = it goes out once the report finishes, " +
        "and not at all if the report fails; not_sent_different_email = a reused report is only " +
        "emailed to the address it was first ordered for, so this address gets none; " +
        "not_sent_report_failed = the reused report failed, so no email goes out. Absent = unknown."
    ),
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
  place?: string;
  /** Campaign, kept on the report and in its link. */
  utm?: string;
};

export type Report = z.infer<typeof ReportSchema>;
export type CreatedReport = z.infer<typeof CreatedReportSchema>;
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

export const ContentArticleSummarySchema = z.object({
  id: z.string(),
  status: z
    .string()
    .describe(
      "processing while PromptEye writes it, then draft (the text is in content) or error. ready, published and tracked are later steps the team moves it through in the app."
    ),
  error: z
    .string()
    .nullable()
    .describe("Why the last generation failed. null unless status is error; content then still holds the previous version, if there was one."),
  projectId: z.string(),
  briefId: z.string().nullable().describe("The content brief it was written from. null = text added to the app by hand."),
  prompt: z.string().nullable().describe("The target prompt the article was written for."),
  title: z.string(),
  source: z
    .string()
    .nullable()
    .describe("generated_article when PromptEye wrote it from a brief, uploaded_docx or pasted when it was added in the app."),
  publishUrl: z.string().nullable().describe("Where the article was published. null until it is."),
  publishedAt: z.string().nullable().describe("When it was published, ISO 8601 in UTC. null until it is."),
  createdAt: timestamp("When the article was created"),
  updatedAt: timestamp("When the article last changed"),
});

export const ContentArticleSchema = ContentArticleSummarySchema.extend({
  content: z.string().nullable().describe("The article text in Markdown, with ## and ### headings. null until it is written."),
});

export const ContentArticlePageSchema = pageOf(ContentArticleSummarySchema);

export const IndexingRequestSchema = z.object({
  submitted: z.boolean().describe("Whether the article's live URL was sent for indexing now."),
  skipped: z
    .enum(["not_eligible", "cooldown", "already_indexed"])
    .nullable()
    .describe(
      "Why nothing was sent, set exactly when submitted is false: not_eligible = the project's plan does not pay for background work; " +
        "cooldown = the URL was sent less than 7 days ago and PromptEye is still checking whether it got indexed; " +
        "already_indexed = the search engine already has the page."
    ),
});

export type ContentArticleSummary = z.infer<typeof ContentArticleSummarySchema>;
export type ContentArticle = z.infer<typeof ContentArticleSchema>;
export type IndexingRequest = z.infer<typeof IndexingRequestSchema>;

export const ArticleSchemaMarkupSchema = z.object({
  jsonLd: z
    .array(z.record(z.string(), z.unknown()))
    .describe(
      "schema.org JSON-LD objects, ready to place on the page, each in its own <script type=\"application/ld+json\"> tag. Tell them apart by their @type."
    ),
  skipped: z
    .array(
      z.object({
        type: z.literal("Article"),
        reason: z
          .enum(["not_published", "author_missing"])
          .describe("not_published = the article has no live URL and publication date yet; author_missing = no author was given."),
      })
    )
    .describe("Every reason a type was not built; one type can be listed with more than one reason."),
});

export type ArticleSchemaMarkup = z.infer<typeof ArticleSchemaMarkupSchema>;

export type GenerateArticleSchemaInput = {
  faq: Array<{ question: string; answer: string }>;
  author?: { name: string; url?: string };
};

export type CreateContentBriefInput = {
  projectId: string;
  prompt: string;
  trackerId?: string;
};

export type ContentBrief = z.infer<typeof ContentBriefSchema>;
export type ContentBriefPhrase = z.infer<typeof ContentBriefPhraseSchema>;
export type ContentBriefSeparateArticle = z.infer<typeof ContentBriefSeparateArticleSchema>;
export type ContentBriefOutlineItem = z.infer<typeof ContentBriefOutlineItemSchema>;

export const SCAN_FREQUENCY_VALUES = ["thriceDaily", "twiceDaily", "daily", "everyTwoDays", "weekly"] as const;

export const UpdateProjectRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  label: z.string().min(1).max(40).optional(),
  domain: z.string().min(3).max(253).optional(),
  alternativeBrandNames: z.array(z.string().min(1).max(120)).max(20).optional(),
  alternativeDomains: z.array(z.string().min(3).max(253)).max(20).optional(),
  scanFrequency: z.enum(SCAN_FREQUENCY_VALUES).optional(),
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
  aiTrafficSource: aiTrafficSource.optional(),
  businessPriority,
  businessPriorityReason: businessPriorityReason.optional(),
});

export const CompetitorExclusionSchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
});

export const CompetitorExclusionListSchema = listOf(CompetitorExclusionSchema);

export const CompetitorGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  excludedNames: z.array(z.string()),
});

export const CompetitorGroupListSchema = listOf(CompetitorGroupSchema);

/** What merging takes: the spellings of one competitor, and the name a new group is shown under. */
export type MergeCompetitorsInput = { names: string[]; groupName?: string };

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
  workspaceId?: string;
};

export type UpdateProjectInput = z.infer<typeof UpdateProjectRequestSchema>;

export type CreateCategoryInput = { name: string; parentCategoryId?: string };

export type AcceptPromptSuggestionInput = { promptText?: string };

export type CreateAuditInput = { urls: string[]; projectId?: string };

export type CreateTopicalMapInput = { topic: string; language: string };

export type RegenerateTopicalMapClusterInput = { category: string };

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type AcceptedPromptSuggestion = z.infer<typeof AcceptedPromptSuggestionSchema>;
export type SuggestionRun = z.infer<typeof SuggestionRunSchema>;
export type SuggestionRunAvailability = z.infer<typeof SuggestionRunAvailabilitySchema>;
export type CitedPage = z.infer<typeof CitedPageSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
export type BrandAnalysisRun = z.infer<typeof BrandAnalysisRunSchema>;
export type BrandAnalysisAvailability = z.infer<typeof BrandAnalysisAvailabilitySchema>;
export type Audit = z.infer<typeof AuditSchema>;
export type AuditUsage = z.infer<typeof AuditUsageSchema>;
export type TopicalMapSummary = z.infer<typeof TopicalMapSummarySchema>;
export type TopicalMap = z.infer<typeof TopicalMapSchema>;

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
export type SponsoredOffer = z.infer<typeof SponsoredOfferSchema>;
export type CitedDomain = z.infer<typeof CitedDomainSchema>;
export type Competitor = z.infer<typeof CompetitorSchema>;
export type CompetitorExclusion = z.infer<typeof CompetitorExclusionSchema>;
export type CompetitorGroup = z.infer<typeof CompetitorGroupSchema>;
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

export const TrafficCrawlHealthAssessmentSchema = z.object({
  key: z.string().describe("Which check this is: 3xx, 4xx, 5xx (a class of status code) or responseTime."),
  level: z
    .string()
    .describe(
      "ok, warning or critical against a fixed threshold for this check; unknown when there is nothing to judge it against (no response time was recorded)."
    ),
  count: z.number().nullable().describe("Requests in this status class. null for the responseTime check."),
  rate: z
    .number()
    .nullable()
    .describe("That count as a share of every request read for the period, 0 to 1. null for the responseTime check."),
  averageResponseTimeMs: z
    .number()
    .nullable()
    .describe("The average response time this check judges, in milliseconds. Set only for the responseTime check."),
});

export const TrafficCrawlIssueSchema = z.object({
  botId: z.string(),
  botName: z.string(),
  path: z.string(),
  statusCode: z.number().describe("The status the site answered with."),
  redirectLocation: z.string().nullable().describe("Where a redirect pointed, for a 3xx status. null otherwise."),
  count: z.number().describe("How many times this bot hit this exact problem."),
  lastSeenAt: timestamp("The most recent time this bot hit this exact problem"),
  averageResponseTimeMs: z.number().nullable().describe("Average response time of the requests behind this problem, in milliseconds."),
  pathType: z
    .string()
    .describe(
      "What the path looks like it was for: secret, code, technical, asset, content or other. secret and code are the shapes only a vulnerability scanner asks for."
    ),
});

export const TrafficCrawlHealthSchema = z.object({
  total: z.number().describe("Requests read for the period."),
  success: z.number().describe("Requests answered with a 2xx status."),
  redirects: z.number().describe("Requests answered with a 3xx status."),
  clientErrors: z.number().describe("Requests answered with a 4xx status."),
  serverErrors: z.number().describe("Requests answered with a 5xx status."),
  unknown: z.number().describe("Requests the site never answered with any status code."),
  scanRequests: z
    .number()
    .describe("Requests for a path that only a vulnerability scanner would ask for, counted apart from the rest."),
  averageResponseTimeMs: z
    .number()
    .nullable()
    .describe("Average response time across the requests that reported one, in milliseconds. null = none reported one."),
  assessments: z
    .array(TrafficCrawlHealthAssessmentSchema)
    .describe("Four fixed checks: the 3xx, 4xx and 5xx rates, and the average response time."),
  issues: z
    .array(TrafficCrawlIssueSchema)
    .describe(
      "Up to 20 distinct problems (status 300 or above), worst first: 5xx before 4xx before 3xx, then the most frequent, then the most recent."
    ),
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
export type TrafficCrawlHealth = z.infer<typeof TrafficCrawlHealthSchema>;

export const FeedbackSchema = z.object({
  id: z.string(),
  receivedAt: timestamp("When PromptEye received the report"),
});

export type CreateFeedbackInput = {
  need: string;
  attemptedAction: string;
};

export type Feedback = z.infer<typeof FeedbackSchema>;

const PERCENT_FIELD = "Percent 0-100, one decimal.";
const DAY_FIELD = "A day as YYYY-MM-DD in UTC.";

const ProductShopRefSchema = z.object({
  shopKey: z.string().describe("Stable key of the shop; pass it as shopKey to get_product_shop or list_product_offers."),
  name: z.string(),
  host: z.string().describe("The shop's host name."),
});

const ProductWeekSchema = z.object({
  week: z.string().describe(`First day of the week, a Monday. ${DAY_FIELD}`),
  from: z.string().describe(`First day of the week inside the period. ${DAY_FIELD}`),
  to: z.string().describe(`Last day of the week inside the period. ${DAY_FIELD}`),
});

export const ProductShelfSchema = z.object({
  from: z.string().describe(`First day of the period. ${DAY_FIELD}`),
  to: z.string().describe(`Last day of the period. ${DAY_FIELD}`),
  firstBoxDay: z.string().nullable().describe(`The first day this project ever had a product box, not limited to the period. ${DAY_FIELD} null = never.`),
  share: z.number().nullable().describe(`Share of shelf positions the client's shop holds. ${PERCENT_FIELD} null = no prompt had a box.`),
  presence: z.number().nullable().describe(`Share of product boxes that carried the client's shop. ${PERCENT_FIELD} null = no prompt had a box.`),
  boxes: z.number().describe("Product boxes ChatGPT showed in the period."),
  promptsWithBoxes: z.number().describe("Prompts that produced at least one box."),
  promptsTotal: z.number().describe("Prompts measured in the period."),
  clientShop: ProductShopRefSchema.nullable().describe("The client's shop as it appears on the shelf. null = it does not appear."),
  shopsAheadOfClient: z.array(ProductShopRefSchema).describe("Shops that appear ahead of the client's shop."),
  prompts: z.array(
    z.object({
      promptId: z.string(),
      boxes: z.number(),
      clientBoxes: z.number(),
      positions: z.number(),
      clientPositions: z.number(),
      share: z.number().describe(PERCENT_FIELD),
      presence: z.number().describe(PERCENT_FIELD),
      meanPosition: z.number().nullable().describe("Mean place of the client's shop in the boxes, counting from 1. null = never shown."),
    })
  ),
  weeks: z.array(
    ProductWeekSchema.extend({
      share: z.number().nullable().describe(`${PERCENT_FIELD} null = no prompt had a box.`),
      presence: z.number().nullable().describe(`${PERCENT_FIELD} null = no prompt had a box.`),
      promptsWithBoxes: z.number(),
    })
  ),
});

export const ProductShopSchema = z.object({
  shopKey: z.string(),
  name: z.string(),
  domain: z.string(),
  isMine: z.boolean().describe("Whether it is the client's own shop."),
  isMarketplace: z.boolean(),
  share: z.number().describe(`Share of all shelf positions this shop holds. ${PERCENT_FIELD}`),
  presence: z.number().describe(`Share of the boxes that carried this shop. ${PERCENT_FIELD}`),
  boxes: z.number().describe("Boxes that carried this shop."),
  positions: z.number().describe("Positions this shop held across the boxes."),
});

export const ProductShopDetailSchema = ProductShopSchema.extend({
  share: z
    .number()
    .nullable()
    .describe(`Share of all shelf positions this shop holds. ${PERCENT_FIELD} null = the client's own shop when it is outside the top shops.`),
  presence: z
    .number()
    .nullable()
    .describe(`Share of the boxes that carried this shop. ${PERCENT_FIELD} null = no box of the period carried the shop.`),
  meanPosition: z.number().nullable().describe("Mean place in the boxes, counting from 1; lower is earlier. null = never shown."),
  firstPlaces: z.number().describe("Boxes where the shop was first."),
  shopsAheadOfClient: z
    .array(ProductShopRefSchema)
    .describe("Shops ahead of the client's shop. Filled only when the shop is the client's own, empty otherwise."),
  prompts: z.array(
    z.object({
      promptId: z.string(),
      boxes: z.number().describe("Boxes of this prompt that carried the shop."),
      meanPosition: z.number().nullable().describe("Mean place of the shop in those boxes, counting from 1. null = never shown."),
    })
  ),
  weeks: z.array(
    ProductWeekSchema.extend({
      presence: z.number().nullable().describe(`${PERCENT_FIELD} null = the week had no box.`),
      meanPosition: z.number().nullable().describe("Mean place of the shop in that week, counting from 1. null = never shown."),
    })
  ),
});

export const ProductSchema = z.object({
  productKey: z.string().describe("Stable key of the product; pass it as productKey to get_product and list_product_offers."),
  title: z.string().describe("Title of the product."),
  imageUrl: z.string().nullable().describe("Picture of the product. null = none."),
  answers: z.number().describe("Answers in the period that showed the product."),
  lastDay: z.string().describe(`Last day it was shown. ${DAY_FIELD}`),
  clientPosition: z.number().nullable().describe("Place of the client's shop among its offers, counting from 1. null = not offered there."),
  offersCount: z.number(),
  clientPrice: z.number().nullable().describe("The client's price in `currency`. null = no client offer."),
  currency: z.string(),
  cheapest: z
    .object({ shopKey: z.string(), name: z.string(), domain: z.string(), price: z.number() })
    .nullable()
    .describe("The cheapest offer. null = no priced offer."),
  gapAmount: z.number().nullable().describe("Client price minus the cheapest price; positive = the client is dearer."),
  gapPercent: z.number().nullable().describe("The gap as percent of the cheapest price."),
  isMine: z.boolean().describe("Whether the client's shop is among the offers."),
});

const PRODUCT_OFFER_CONDITIONS = ["new", "used", "refurbished", "ex_display", "unknown"] as const;

export const ProductOfferSchema = z.object({
  productKey: z.string(),
  shopKey: z.string(),
  shop: z.string().describe("The shop's name."),
  domain: z.string(),
  position: z.number().describe("Place in the offer list, counting from 1."),
  price: z.number().nullable(),
  currency: z.string(),
  condition: z.enum(PRODUCT_OFFER_CONDITIONS).describe("Condition of the item; only offers in the same condition are compared."),
  isMine: z.boolean(),
  isCheapest: z.boolean(),
  gapAmount: z.number().nullable().describe("Price minus the cheapest price."),
  gapPercent: z.number().nullable().describe("The gap as percent of the cheapest price."),
});

export const ProductRatingSchema = z.object({
  productKey: z.string(),
  title: z.string().describe("Title of the product."),
  groupId: z.string().nullable().describe("The prompt group the product is listed under. null = ungrouped."),
  groupName: z.string().nullable().describe("Name of that group."),
  rating: z.number().nullable().describe("Mean rating in the period."),
  ratingMin: z.number().nullable(),
  ratingMax: z.number().nullable(),
  reviews: z.number().nullable().describe("Review count."),
  measurements: z.number().describe("How many times the rating was measured."),
  days: z.number().describe("Days with a measurement."),
  belowTypical: z.boolean().describe("Whether the product is rated below the typical rating of its competitors."),
  typicalRating: z.number().nullable().describe("Typical rating of the competitors in the product's group."),
  typicalReviews: z.number().nullable().describe("Typical review count of the competitors in the product's group."),
  ratingDifference: z.number().nullable().describe("Rating minus the typical rating; negative = below."),
  reviewsPercentOfTypical: z.number().nullable().describe("Reviews as percent of the typical count."),
});

const ProductIssueMoneySchema = z.object({ amount: z.number(), currency: z.string() });
const ProductIssueShelfSchema = z.object({
  week: z.object({ from: z.string(), to: z.string() }),
  share: z.number().describe(PERCENT_FIELD),
});
const ProductIssueProductSchema = z
  .object({ itemId: z.string(), title: z.string().nullable(), imageUrl: z.string().nullable(), link: z.string().nullable() })
  .describe("The product concerned.");

export const PRODUCT_ISSUE_TYPES = ["price", "stock", "shelf_drop"] as const;

const issueFigures = {
  id: z.string().describe("Stable id: price:{itemId}, stock:{itemId}, drop:{groupId} or drop:project."),
  answers: z.number().describe("Answers affected in the period."),
  lastDay: z.string().describe(DAY_FIELD),
  weight: z.number().describe("How much the issue matters; equal to answers. The list is sorted by it, descending."),
};

const ProductPriceIssueSchema = z.object({
  ...issueFigures,
  type: z.literal("price"),
  product: ProductIssueProductSchema,
  group: z.null(),
  before: ProductIssueMoneySchema.describe("The price ChatGPT shows."),
  after: ProductIssueMoneySchema.describe("The price in the feed."),
});

const ProductStockIssueSchema = z.object({
  ...issueFigures,
  type: z.literal("stock"),
  product: ProductIssueProductSchema,
  group: z.null(),
  before: z.string().nullable().describe("The availability on the product page."),
  after: z.string().nullable().describe("The availability in the feed."),
});

const ProductShelfDropIssueSchema = z.object({
  ...issueFigures,
  type: z.literal("shelf_drop"),
  product: z.null(),
  group: z
    .object({ groupId: z.string(), name: z.string() })
    .nullable()
    .describe("The prompt group that lost share. null = a drop of the whole project."),
  before: ProductIssueShelfSchema.describe("The earlier week and its share."),
  after: ProductIssueShelfSchema.describe("The later week and its share."),
});

export const ProductIssueSchema = z.discriminatedUnion("type", [
  ProductPriceIssueSchema,
  ProductStockIssueSchema,
  ProductShelfDropIssueSchema,
]);

export const ProductShopPageSchema = pageOf(ProductShopSchema);
export const ProductPageSchema = pageOf(ProductSchema);
export const ProductOfferPageSchema = pageOf(ProductOfferSchema);
export const ProductRatingPageSchema = pageOf(ProductRatingSchema);
export const ProductIssuePageSchema = pageOf(ProductIssueSchema);

export type ProductShelf = z.infer<typeof ProductShelfSchema>;
export type ProductShop = z.infer<typeof ProductShopSchema>;
export type ProductShopDetail = z.infer<typeof ProductShopDetailSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type ProductOffer = z.infer<typeof ProductOfferSchema>;
export type ProductRating = z.infer<typeof ProductRatingSchema>;
export type ProductIssue = z.infer<typeof ProductIssueSchema>;
export type ProductIssueType = (typeof PRODUCT_ISSUE_TYPES)[number];
