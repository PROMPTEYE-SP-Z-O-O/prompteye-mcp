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
  CitedDomainSchema,
  CompetitorSchema,
  COUNTRY_CODES,
  KnowledgeBaseSchema,
  NewPromptSchema,
  ProjectSchema,
  PromptDetailSchema,
  PromptGroupSchema,
  PromptSchema,
  PromptSuggestionSchema,
  type Account,
  type Category,
  type CitedDomain,
  type Competitor,
  type CreateProjectInput,
  type KnowledgeBase,
  type List,
  type NewPrompt,
  type Project,
  type Prompt,
  type PromptDetail,
  type PromptGroup,
  type PromptInput,
  type PromptSuggestion,
} from "../api/schemas.js";

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

export type Breakdown = z.infer<typeof BreakdownSchema>;
export type VisibilitySummary = z.infer<typeof VisibilitySummarySchema>;
export type VisibilityRow = z.infer<typeof VisibilityRowSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
export type CitationQuality = z.infer<typeof CitationQualitySchema>;

/** Whether an answer named the brand. */
export type BrandPresence = z.infer<typeof AnswerSchema>["brand"];
