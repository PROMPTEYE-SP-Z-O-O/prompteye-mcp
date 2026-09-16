import { z } from "zod";

/** Mirrors of the PromptEye API responses. Unknown fields are dropped. */

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

const listOf = <T extends z.ZodTypeAny>(entry: T) => z.object({ data: z.array(entry) });

export const ProjectListSchema = listOf(ProjectSchema);
export const CategoryListSchema = listOf(CategorySchema);
export const PromptSuggestionListSchema = listOf(PromptSuggestionSchema);

export type List<T> = { data: T[] };
export type Account = z.infer<typeof AccountSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type PromptSuggestion = z.infer<typeof PromptSuggestionSchema>;
