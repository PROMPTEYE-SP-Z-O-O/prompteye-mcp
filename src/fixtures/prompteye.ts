import type { ModelKey } from "../schemas/common.js";
import type {
  Answer,
  CitationQuality,
  CitedDomain,
  Competitor,
  VisibilityRow,
} from "../schemas/prompteye.js";

/**
 * Sample data for the endpoints the PromptEye API does not serve yet, in the
 * shapes the API is specified to answer with. Where the API ships a single row
 * to illustrate a schema, the series below are widened to a full period — a
 * one-day trend line would say nothing about whether a tool works.
 */

/** The prompts the sample series are generated from. */
type SamplePrompt = { id: string; prompt: string; aiTraffic: number | null; visibility: number };

export const prompts: SamplePrompt[] = [
  {
    id: "m42k8x1p7q3w9z5v6n0b2c4d",
    prompt: "best AI visibility tracking tools",
    aiTraffic: 1900,
    visibility: 66.7,
  },
  {
    id: "m55l9y2q8r4x0a6w7p1c3d5e",
    prompt: "how to measure brand mentions in ChatGPT answers",
    aiTraffic: 640,
    visibility: 41.2,
  },
  {
    id: "m68m0z3r9s5y1b7x8q2d4e6f",
    prompt: "PromptEye pricing",
    aiTraffic: null,
    visibility: 92.9,
  },
];

export const competitors: Competitor[] = [
  {
    brand: "PromptEye",
    ownBrand: true,
    metrics: { visibility: 62.5, reachIndex: 58, averagePosition: 2.4 },
    change: { visibility: 4.1, reachIndex: 3, averagePosition: -0.2 },
    shareOfVoice: 25,
    citations: 18,
    citationShare: 5,
  },
  {
    brand: "Example Analytics",
    ownBrand: false,
    metrics: { visibility: 48.1, reachIndex: 45, averagePosition: 3.1 },
    change: { visibility: -2.6, reachIndex: -2, averagePosition: 0.3 },
    shareOfVoice: 18,
    citations: 31,
    citationShare: 10,
  },
  {
    brand: "Northbeam AI",
    ownBrand: false,
    metrics: { visibility: 39.4, reachIndex: 36, averagePosition: 3.6 },
    change: { visibility: 6.2, reachIndex: 5, averagePosition: -0.5 },
    shareOfVoice: 14,
    citations: 22,
    citationShare: 7,
  },
  {
    brand: "Mentionly",
    ownBrand: false,
    metrics: { visibility: 21.8, reachIndex: 19, averagePosition: 4.9 },
    change: { visibility: -0.4, reachIndex: 0, averagePosition: 0.1 },
    shareOfVoice: 9,
    citations: 11,
    citationShare: 3,
  },
];

export const citedDomains: CitedDomain[] = [
  { domain: "example.com", citations: 42, share: 12.4, ownDomain: false, lastCitedOn: "2026-09-09" },
  { domain: "prompteye.com", citations: 18, share: 5.3, ownDomain: true, lastCitedOn: "2026-09-08" },
  { domain: "reddit.com", citations: 15, share: 4.4, ownDomain: false, lastCitedOn: "2026-09-09" },
  { domain: "g2.com", citations: 12, share: 3.5, ownDomain: false, lastCitedOn: "2026-09-07" },
];

export const citationQuality: CitationQuality = {
  analysedOn: "2026-09-09T02:14:00.000Z",
  role: {
    totalResponses: 186,
    mentionedResponses: 192,
    distribution: [
      { key: "recommendation", count: 84, percentage: 45.2 },
      { key: "comparison_element", count: 52, percentage: 28 },
      { key: "one_of_sources", count: 31, percentage: 16.7 },
      { key: "expert_citation", count: 12, percentage: 6.4 },
      { key: "incidental_mention", count: 7, percentage: 3.7 },
      { key: "anti_recommendation", count: 0, percentage: 0 },
    ],
  },
  sentiment: {
    totalResponses: 186,
    mentionedResponses: 192,
    distribution: [
      { key: "positive", count: 121, percentage: 65.1 },
      { key: "neutral", count: 58, percentage: 31.2 },
      { key: "negative", count: 7, percentage: 3.7 },
    ],
  },
};

export const answers: Answer[] = [
  {
    id: "a91c4e7b2d5f8a3c6b0d9e2f",
    date: "2026-09-09",
    promptId: "m42k8x1p7q3w9z5v6n0b2c4d",
    prompt: "best AI visibility tracking tools",
    model: "gpt",
    brand: "named",
    position: 2,
    text: "Several tools track how brands appear in AI answers. PromptEye reports visibility per assistant…",
    sources: [
      { url: "https://example.com/guide", domain: "example.com", title: "A guide to AI visibility" },
      { url: "https://prompteye.com/blog/measuring", domain: "prompteye.com", title: "Measuring AI visibility" },
    ],
  },
  {
    id: "a02d5f8c3e6b9a4d7c1e0f3a",
    date: "2026-09-09",
    promptId: "m42k8x1p7q3w9z5v6n0b2c4d",
    prompt: "best AI visibility tracking tools",
    model: "perplexity",
    brand: "missing",
    position: null,
    text: "The tools most often mentioned for this are Example Analytics and Northbeam AI…",
    sources: [{ url: "https://g2.com/categories/ai-visibility", domain: "g2.com", title: "AI visibility on G2" }],
  },
  {
    id: "a13e6g9d4f7c0b5e8d2f1a4b",
    date: "2026-09-08",
    promptId: "m68m0z3r9s5y1b7x8q2d4e6f",
    prompt: "PromptEye pricing",
    model: "claude",
    brand: "named",
    position: 1,
    text: "PromptEye publishes its plans on prompteye.com/pricing; the Pro plan covers…",
    sources: [{ url: "https://prompteye.com/pricing", domain: "prompteye.com", title: "PromptEye pricing" }],
  },
];

/** The assistants the sample project collects answers from. */
export const trackedModels: ModelKey[] = ["gpt", "perplexity", "claude"];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A visibility figure for one day and assistant, wobbling around a per-assistant
 * baseline.
 *
 * The seed is the absolute day, not an offset into the requested period, so a
 * date reads the same whichever period asks for it — which is what makes a
 * period-over-period change come out non-zero.
 */
function sampleVisibility(model: ModelKey, absoluteDay: number): number {
  const baseline: Record<string, number> = { gpt: 78, perplexity: 41, claude: 63 };
  const base = baseline[model] ?? 50;
  const wobble = Math.sin(absoluteDay * 0.7 + model.length) * 9 + Math.cos(absoluteDay * 0.31) * 4;
  const drift = Math.sin(absoluteDay * 0.05) * 6;
  return Math.max(0, Math.min(100, Math.round((base + wobble + drift) * 10) / 10));
}

function samplePosition(visibility: number): number | null {
  if (visibility === 0) return null;
  return Math.round((1 + (100 - visibility) / 22) * 10) / 10;
}

/** Every day/prompt/assistant measurement in a period, as `/visibility` reports them. */
export function visibilityRows(startDate: string, endDate: string): VisibilityRow[] {
  const rows: VisibilityRow[] = [];
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);

  for (let at = start; at <= end; at += DAY_MS) {
    const date = new Date(at).toISOString().slice(0, 10);
    const absoluteDay = Math.round(at / DAY_MS);

    for (const prompt of prompts) {
      for (const model of trackedModels) {
        const spread = prompt.visibility / 66.7;
        const visibility = Math.min(100, Math.round(sampleVisibility(model, absoluteDay) * spread * 10) / 10);
        rows.push({
          date,
          promptId: prompt.id,
          prompt: prompt.prompt,
          model,
          answered: true,
          visibility,
          position: samplePosition(visibility),
        });
      }
    }
  }

  return rows;
}
