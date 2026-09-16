import type { ModelKey } from "../schemas/common.js";
import type {
  Account,
  Answer,
  Category,
  CitationQuality,
  CitedDomain,
  Competitor,
  KnowledgeBase,
  Project,
  Prompt,
  PromptGroup,
  PromptSuggestion,
  VisibilityRow,
} from "../schemas/prompteye.js";

/**
 * Sample data lifted from the PromptEye API's own fixtures, so the tools answer
 * with the exact shapes the API answers with. Where the API ships a single row
 * to illustrate a schema, the series below are widened to a full period — a
 * one-day trend line would say nothing about whether a tool works.
 */

export const account: Account = {
  id: "k17f4b2c9d8e6a5b3c1d0e9f",
  email: "anna@prompteye.com",
  plan: { key: "3", name: "Pro" },
  addons: ["claude"],
  scopes: ["api_access"],
  promptCount: 128,
};

export const projects: Project[] = [
  {
    id: "j57d2m8fp1q0z9y4c3b7a6e5x",
    name: "PromptEye — Poland",
    brand: "PromptEye",
    domain: "prompteye.com",
    country: "PL",
    label: null,
    alternativeBrandNames: ["Prompt Eye"],
    alternativeDomains: [],
    excludedCompetitors: [],
    accessRole: "OWNER",
    createdAt: "2026-09-10T09:24:11.000Z",
  },
  {
    id: "j61h4n2kr5s8t0u3v7w9x2y4z",
    name: "PromptEye — Global",
    brand: "PromptEye",
    domain: "prompteye.com",
    country: "GLOB",
    label: "worldwide",
    alternativeBrandNames: ["Prompt Eye"],
    alternativeDomains: ["prompteye.io"],
    excludedCompetitors: ["Example Analytics"],
    accessRole: "READ_ONLY",
    createdAt: "2026-07-02T08:11:03.000Z",
  },
];

export const knowledgeBase: KnowledgeBase = {
  text:
    "PromptEye tracks how often AI assistants name a brand when they answer buying questions. It is used " +
    "by marketing teams to see which prompts mention them, which competitors take their place and which " +
    "sources the assistants lean on.",
  updatedAt: "2026-08-21T14:05:39.000Z",
};

export const prompts: Prompt[] = [
  {
    id: "m42k8x1p7q3w9z5v6n0b2c4d",
    prompt: "best AI visibility tracking tools",
    keyword: "ai visibility tracking",
    status: "active",
    categories: ["Comparison"],
    subcategories: [],
    groupId: "g33n1k5m7p9r2t4v6x8z0b2d",
    createdAt: "2026-08-14T11:02:47.000Z",
    aiTraffic: 1900,
    metrics: { visibility: 66.7, reachIndex: 61, averagePosition: 2.1 },
    change: { visibility: 8.3, reachIndex: 6, averagePosition: -0.4 },
  },
  {
    id: "m55l9y2q8r4x0a6w7p1c3d5e",
    prompt: "how to measure brand mentions in ChatGPT answers",
    keyword: "measure brand mentions chatgpt",
    status: "active",
    categories: ["How to"],
    subcategories: [],
    groupId: "g44p2l6n8r0t2v4x6z8b0d2f",
    createdAt: "2026-08-14T11:02:47.000Z",
    aiTraffic: 640,
    metrics: { visibility: 41.2, reachIndex: 38, averagePosition: 3.4 },
    change: { visibility: -3.1, reachIndex: -2, averagePosition: 0.6 },
  },
  {
    id: "m68m0z3r9s5y1b7x8q2d4e6f",
    prompt: "PromptEye pricing",
    keyword: "prompteye pricing",
    status: "active",
    categories: ["Pricing"],
    subcategories: [],
    groupId: "g33n1k5m7p9r2t4v6x8z0b2d",
    createdAt: "2026-08-20T09:44:12.000Z",
    aiTraffic: null,
    metrics: { visibility: 92.9, reachIndex: 90, averagePosition: 1.2 },
    change: { visibility: 1.4, reachIndex: 1, averagePosition: -0.1 },
  },
];

export const promptsByModel: Record<string, { model: ModelKey; metrics: Prompt["metrics"] }[]> = {
  m42k8x1p7q3w9z5v6n0b2c4d: [
    { model: "gpt", metrics: { visibility: 100, reachIndex: 100, averagePosition: 2 } },
    { model: "perplexity", metrics: { visibility: 0, reachIndex: 0, averagePosition: null } },
    { model: "claude", metrics: { visibility: 100, reachIndex: 84, averagePosition: 2.3 } },
  ],
  m55l9y2q8r4x0a6w7p1c3d5e: [
    { model: "gpt", metrics: { visibility: 66.7, reachIndex: 60, averagePosition: 3.1 } },
    { model: "perplexity", metrics: { visibility: 33.3, reachIndex: 29, averagePosition: 4.2 } },
    { model: "claude", metrics: { visibility: 23.5, reachIndex: 22, averagePosition: 3.8 } },
  ],
  m68m0z3r9s5y1b7x8q2d4e6f: [
    { model: "gpt", metrics: { visibility: 100, reachIndex: 100, averagePosition: 1 } },
    { model: "perplexity", metrics: { visibility: 92.3, reachIndex: 88, averagePosition: 1.3 } },
    { model: "claude", metrics: { visibility: 86.4, reachIndex: 82, averagePosition: 1.4 } },
  ],
};

export const promptGroups: PromptGroup[] = [
  {
    id: "g33n1k5m7p9r2t4v6x8z0b2d",
    name: "Comparison queries",
    order: 1,
    promptCount: 12,
    businessPriority: 3,
    aiTrafficTotal: 8400,
    metrics: { visibility: 58.3, reachIndex: 55, averagePosition: 2.6 },
  },
  {
    id: "g44p2l6n8r0t2v4x6z8b0d2f",
    name: "How to",
    order: 2,
    promptCount: 9,
    businessPriority: 1,
    aiTrafficTotal: 2100,
    metrics: { visibility: 37.9, reachIndex: 34, averagePosition: 3.5 },
  },
];

export const categories: Category[] = [
  { id: "c72b4d6f8h0j2l4n6p8r0t2v", name: "Comparison", parentId: null, source: "ai" },
  { id: "c90d6f8h0j2l4n6p8r0t2v4x", name: "How to", parentId: null, source: "ai" },
  { id: "c81c5e7g9i1k3m5o7q9s1u3w", name: "Pricing", parentId: "c72b4d6f8h0j2l4n6p8r0t2v", source: "manual" },
];

export const promptSuggestions: PromptSuggestion[] = [
  {
    id: "s18d4f6h8j0l2n4p6r8t0v2x",
    prompt: "which AI visibility tool reports citations by domain",
    mode: "gap",
    groupId: "g33n1k5m7p9r2t4v6x8z0b2d",
    groupName: "Comparisons",
    sourcePhrase: "ai visibility tool citations",
    sourcePhraseVolume: 480,
    aiTraffic: 1300,
    relativeVolumeScore: 0.75,
    relativeVolumeLabel: "high",
    purchaseIntentLevel: 3,
    companyFitScore: 0.82,
    companyFitReason: "The brand sells AI visibility tracking, which is what the question asks for.",
    whyText: "This prompt fills a gap in your funnel — nothing is monitored at the comparison stage.",
    whyArguments: ["fit", "volume_high"],
    createdAt: "2026-09-08T06:31:12.000Z",
    expiresAt: "2026-10-08T06:31:12.000Z",
  },
  {
    id: "s29e5g7i9k1m3o5q7s9u1w3y",
    prompt: "how to measure brand mentions in ChatGPT answers",
    mode: "replicate",
    groupId: "g44p2l6n8r0t2v4x6z8b0d2f",
    groupName: "How to",
    sourcePhrase: "measure brand mentions chatgpt",
    sourcePhraseVolume: 210,
    aiTraffic: null,
    relativeVolumeScore: 0.5,
    relativeVolumeLabel: "standard",
    purchaseIntentLevel: 1,
    companyFitScore: 0.64,
    companyFitReason: "Measuring mentions is the job the product does, asked without naming a tool.",
    whyText: "This prompt is close in theme to your best-performing prompts in this group.",
    whyArguments: ["intent"],
    createdAt: "2026-09-08T06:31:12.000Z",
    expiresAt: "2026-10-08T06:31:12.000Z",
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
        const spread = (prompt.metrics.visibility ?? 50) / 66.7;
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
