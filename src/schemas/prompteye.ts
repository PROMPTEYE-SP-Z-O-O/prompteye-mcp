import { z } from "zod";
import { MetricsSchema, ModelSchema, NullableChangeSchema } from "./common.js";

/*
 * The models the PromptEye API already serves live in the API client, which is
 * the single source of truth for them. The rest are mirrored here until the
 * API grows the endpoints, and are answered from sample data meanwhile.
 */
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
} from "../api/schemas.js";

export const PromptSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  keyword: z.string().nullable(),
  status: z.enum(["active", "paused", "pending"]),
  categories: z.array(z.string()),
  subcategories: z.array(z.string()),
  groupId: z.string().nullable(),
  createdAt: z.string(),
  aiTraffic: z.number().nullable(),
  metrics: MetricsSchema,
  change: NullableChangeSchema,
});

export const PromptDetailSchema = PromptSchema.extend({
  byModel: z.array(z.object({ model: ModelSchema, metrics: MetricsSchema })),
});

export const PromptGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().nullable(),
  promptCount: z.number(),
  businessPriority: z.number().nullable(),
  aiTrafficTotal: z.number().nullable(),
  metrics: MetricsSchema,
});

export const BREAKDOWN_KEYS = ["day", "model", "prompt"] as const;
export const BreakdownSchema = z.enum(BREAKDOWN_KEYS);

export const BreakdownEntrySchema = z.object({
  key: z.string(),
  label: z.string(),
  metrics: MetricsSchema,
});

export const VisibilitySummarySchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  models: z.array(ModelSchema),
  totals: MetricsSchema,
  change: NullableChangeSchema,
  aiTrafficTotal: z.number().nullable(),
  breakdown: z.array(BreakdownEntrySchema),
  breakdownTruncated: z.boolean(),
});

export const VisibilityRowSchema = z.object({
  date: z.string(),
  promptId: z.string(),
  prompt: z.string(),
  model: ModelSchema,
  answered: z.boolean().nullable(),
  visibility: z.number(),
  position: z.number().nullable(),
});

export const SourceSchema = z.object({
  url: z.string(),
  domain: z.string(),
  title: z.string().nullable(),
});

export const AnswerSchema = z.object({
  id: z.string(),
  date: z.string(),
  promptId: z.string(),
  prompt: z.string(),
  model: ModelSchema,
  brand: z.enum(["named", "missing"]),
  position: z.number().nullable(),
  text: z.string(),
  sources: z.array(SourceSchema),
});

export const CitedDomainSchema = z.object({
  domain: z.string(),
  citations: z.number(),
  share: z.number(),
  ownDomain: z.boolean(),
  lastCitedOn: z.string(),
});

const DistributionEntrySchema = z.object({
  key: z.string(),
  count: z.number(),
  percentage: z.number(),
});

export const CitationQualitySchema = z.object({
  analysedOn: z.string(),
  role: z.object({
    totalResponses: z.number(),
    mentionedResponses: z.number(),
    distribution: z.array(DistributionEntrySchema),
  }),
  sentiment: z.object({
    totalResponses: z.number(),
    mentionedResponses: z.number(),
    distribution: z.array(DistributionEntrySchema),
  }),
});

export const CompetitorSchema = z.object({
  brand: z.string(),
  ownBrand: z.boolean(),
  metrics: MetricsSchema,
  change: NullableChangeSchema,
  shareOfVoice: z.number().nullable(),
  citations: z.number().nullable(),
  citationShare: z.number().nullable(),
});

export type Prompt = z.infer<typeof PromptSchema>;
export type PromptDetail = z.infer<typeof PromptDetailSchema>;
export type PromptGroup = z.infer<typeof PromptGroupSchema>;
export type Breakdown = z.infer<typeof BreakdownSchema>;
export type VisibilitySummary = z.infer<typeof VisibilitySummarySchema>;
export type VisibilityRow = z.infer<typeof VisibilityRowSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
export type CitedDomain = z.infer<typeof CitedDomainSchema>;
export type CitationQuality = z.infer<typeof CitationQualitySchema>;
export type Competitor = z.infer<typeof CompetitorSchema>;

/** Whether an answer named the brand. */
export type BrandPresence = z.infer<typeof AnswerSchema>["brand"];
