import { z } from "zod";

/**
 * Assistants an answer can be collected from. Mirrors the `Model` enum of the
 * PromptEye API — answers scraped from ChatGPT are reported under `gpt`.
 */
export const MODEL_KEYS = [
  "gpt",
  "perplexity",
  "claude",
  "deepSeek",
  "gemini",
  "grok",
  "llama",
  "aiOverview",
  "copilot",
  "googleAiMode",
] as const;

export type ModelKey = (typeof MODEL_KEYS)[number];

export const ModelSchema = z.enum(MODEL_KEYS);

export const MAX_LIMIT = 200;
export const DEFAULT_LIMIT = 50;
export const MAX_RANGE_DAYS = 366;

/** The bot traffic endpoints read a month at a time, not a year. */
export const MAX_TRAFFIC_RANGE_DAYS = 31;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date as YYYY-MM-DD.");

/** Query shape shared by every endpoint that reports on a period. */
export const dateRangeShape = {
  startDate: isoDate
    .optional()
    .describe("First day to report on, inclusive. Defaults to 30 days before today."),
  endDate: isoDate
    .optional()
    .describe(
      `Last day to report on, inclusive. Defaults to today, and must be within ${MAX_RANGE_DAYS} days of startDate.`
    ),
};

export const modelFilterShape = {
  model: ModelSchema.optional().describe(
    "Report on this assistant alone instead of all of them."
  ),
};

/** The prompt scope the competitor and source rankings accept. `verb` opens each sentence ("Rank", ...). */
export const promptScopeShape = (verb: string) => ({
  promptId: z.string().min(1).optional().describe(`${verb} this prompt alone instead of every prompt in the project.`),
  groupId: z
    .string()
    .min(1)
    .optional()
    .describe(`${verb} this prompt group alone instead of every prompt in the project.`),
  categoryId: z
    .string()
    .min(1)
    .optional()
    .describe(`${verb} only the prompts filed under this category, subcategories included.`),
  subcategoryId: z
    .string()
    .min(1)
    .optional()
    .describe("Narrow `categoryId` further, to one of its subcategories. Needs `categoryId` alongside it."),
});

export const paginationShape = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(`How many entries to return, at most ${MAX_LIMIT}. Defaults to ${DEFAULT_LIMIT}.`),
  cursor: z
    .string()
    .optional()
    .describe("The nextCursor of the previous page. Omit it to start from the first one."),
};

export type DateRange = { startDate?: string; endDate?: string };

/** A page of entries, as every listing endpoint answers it. */
export type Page<T> = {
  data: T[];
  nextCursor: string | null;
};
