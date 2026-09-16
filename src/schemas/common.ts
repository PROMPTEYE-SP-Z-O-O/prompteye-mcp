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

const DAY_MS = 24 * 60 * 60 * 1000;
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

/** The period a request asked for, with the API's defaults filled in. */
export type ResolvedRange = { startDate: string; endDate: string };

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Applies the same defaults and bounds the API applies, so a tool rejects an
 * impossible period before it costs a round trip.
 */
export function resolveDateRange(range: DateRange): ResolvedRange {
  const endDate = range.endDate ?? toIsoDate(new Date());
  const startDate =
    range.startDate ?? toIsoDate(new Date(Date.parse(endDate) - 30 * DAY_MS));

  if (startDate > endDate) {
    throw new RangeError("startDate must not be after endDate.");
  }
  if (Date.parse(endDate) - Date.parse(startDate) > MAX_RANGE_DAYS * DAY_MS) {
    throw new RangeError(`The period must not be longer than ${MAX_RANGE_DAYS} days.`);
  }

  return { startDate, endDate };
}

/** A page of entries, as every listing endpoint answers it. */
export type Page<T> = {
  data: T[];
  nextCursor: string | null;
};

/** Each figure is null until it is measured. */
export const MetricsSchema = z.object({
  visibility: z.number().nullable(),
  reachIndex: z.number().nullable(),
  averagePosition: z.number().nullable(),
});

export const MetricsChangeSchema = z.object({
  visibility: z.number().nullable(),
  reachIndex: z.number().nullable(),
  averagePosition: z.number().nullable(),
});

/** Movement against the previous period — null when there was nothing to compare against. */
export const NullableChangeSchema = MetricsChangeSchema.nullable();

export type Metrics = z.infer<typeof MetricsSchema>;
export type MetricsChange = z.infer<typeof MetricsChangeSchema>;
