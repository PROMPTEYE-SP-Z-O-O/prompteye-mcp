import { z } from "zod";

/** Mirrors of the PromptEye API responses. Unknown fields are dropped. */

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
  createdAt: z.string(),
});

export const KnowledgeBaseSchema = z.object({
  text: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  /** `ai` or `manual`. */
  source: z.string(),
});

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

/** Every entry an endpoint has, in one response. */
const listOf = <T extends z.ZodTypeAny>(entry: T) => z.object({ data: z.array(entry) });

/** A page of entries, walked with `nextCursor`. */
const pageOf = <T extends z.ZodTypeAny>(entry: T) =>
  z.object({ data: z.array(entry), nextCursor: z.string().nullable() });

export const ProjectListSchema = listOf(ProjectSchema);
export const CategoryListSchema = listOf(CategorySchema);
export const PromptSuggestionListSchema = listOf(PromptSuggestionSchema);
export const PromptPageSchema = pageOf(PromptSchema);
export const PromptGroupPageSchema = pageOf(PromptGroupSchema);

export type List<T> = { data: T[] };
export type Page<T> = { data: T[]; nextCursor: string | null };
export type Metrics = z.infer<typeof MetricsSchema>;
export type ModelMetrics = z.infer<typeof ModelMetricsSchema>;
export type MetricsChange = z.infer<typeof MetricsChangeSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Prompt = z.infer<typeof PromptSchema>;
export type PromptDetail = z.infer<typeof PromptDetailSchema>;
export type PromptGroup = z.infer<typeof PromptGroupSchema>;
export type PromptSuggestion = z.infer<typeof PromptSuggestionSchema>;
