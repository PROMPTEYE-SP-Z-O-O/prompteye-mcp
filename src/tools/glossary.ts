/**
 * What PromptEye's figures mean, in the words the tools hand to the model.
 *
 * These read as sentences inside a tool description or a parameter, so a model
 * reporting a number knows what it is claiming — `aiTraffic` describes the
 * prompt itself and never a period, and a priority may have been set by hand.
 */

export const AI_TRAFFIC =
  "aiTraffic is the demand behind a prompt: PromptEye expands the question into the phrasings people " +
  "actually use for it, weighs each one by how much of the question it carries, and adds up how much " +
  "demand they attract per month. It is a property of the prompt, not a measurement of a period, and " +
  "is null when nothing could be measured for it. It is not what get_ai_traffic reports: that tool " +
  "counts sessions that actually reached the site from an assistant, while this counts the demand " +
  "behind the question.";

export const BUSINESS_PRIORITY =
  "businessPriority is how much the project should bet on a prompt: the average of how close to a " +
  "purchase the question is asked and where the prompt ranks on demand among the project's own " +
  "prompts. It is banded very_high above 0.8, high above 0.6, medium above 0.4, low above 0.2 and " +
  "very_low below that. A priority set by hand in the app wins over the computed one, and the two " +
  "are not reported apart, so a surprising value may be someone's deliberate call. It is null before " +
  "the prompt has been ranked.";

export const RELATIVE_VOLUME =
  "relativeVolumeScore places the demand among the other prompts of the same group, 0 for the lowest " +
  "and 1 for the highest, and relativeVolumeLabel bands it as very_high, high or standard. It is " +
  "relative to the group, so `high` means high for this group and says nothing about the market.";

export const PURCHASE_INTENT =
  "purchaseIntentLevel is the funnel stage the question is asked at: 1 awareness (educational), 2 " +
  "consideration (looking for a solution), 3 comparison (weighing options), 4 decision (ready to " +
  "buy). A group with no prompts at a stage is a blind spot, not a tidy funnel: customers ask there " +
  "and nobody sees what the assistants answer.";

export const COMPANY_FIT =
  "companyFitScore is how well the question fits what the brand sells, 0 unrelated to 1 squarely on " +
  "topic, with companyFitReason saying what that verdict was read off.";

export const VISIBILITY =
  "visibility is the share of answers that named the brand, 0 to 100; reachIndex is that figure " +
  "weighted by how much of the market each assistant carries; averagePosition is where in the answer " +
  "the brand was named, counting from 1. Each is null until it is measured.";

export const SHARE_OF_VOICE =
  "shareOfVoice is how much of all the naming that happened on the project's prompts went to one " +
  "brand, so the brands in a ranking describe one pie. It answers a different question from " +
  "visibility: visibility is how often a brand was named at all, and every brand can score high at " +
  "once, while share of voice is what each took from the others. citations and citationShare count " +
  "how often the brand's own pages were cited as sources, which can diverge from being named — a " +
  "brand can be recommended without being linked, and linked without being recommended. The " +
  "project's own brand is in the ranking and marked with ownBrand, so it can be read against the rest.";

export const CITED_DOMAINS =
  "A cited domain is a site an assistant leaned on while answering the project's prompts. citations " +
  "counts how often it was cited, and share is its slice of every citation made on those prompts, so " +
  "the domains describe one pie. ownDomain marks the project's own domain and the alternatives " +
  "registered with it: a small own share means the assistants are describing the brand from other " +
  "people's pages rather than its own, which is where the story about it is being written.";

export const PUBLIC_REPORTS =
  "A public report is PromptEye's lead magnet, sold to agencies white-label: a prospect fills in a " +
  "form on the agency's site, PromptEye works out the industry, asks a set of assistants how visible " +
  "that brand is, and emails back a page in the agency's branding — a visibility score, the " +
  "competitors ahead of them, and quotes from what the assistants actually said. It is a one-off " +
  "sample, not tracking: nothing is measured again until the report is converted into a project, " +
  "which happens in the PromptEye app. leadStatus and the conversion are the agency's sales " +
  "pipeline, and contactCount is how many times the brand asked to be contacted from the page.";

/** Why generated prompts beat hand-written ones, for the tools that touch prompt creation. */
export const PROMPT_GENERATION =
  "PromptEye generates the prompts a project tracks: it works out which questions carry demand and " +
  "phrases them the way people actually put questions to AI assistants, then proposes each one with " +
  "the gap in the funnel it fills, the demand behind it, how close to a purchase it is asked and how " +
  "well it fits the brand. list_prompt_suggestions returns those, ready to be accepted.";

/** What Google's own figures are, and what they are not, for the tools that report them. */
export const GOOGLE_DATA =
  "Google's figures answer a different question from everything else here: visibility counts the " +
  "answers that named the brand, and this counts the people who then arrived. Search Console covers " +
  "ordinary Google results — ctr is a rate between 0 and 1, and position counts from 1, so lower is " +
  "better. AI traffic is Google Analytics sessions whose referrer was recognised as an assistant, " +
  "which undercounts by design: an assistant that names the brand without linking it sends nobody, " +
  "and somebody who reads an answer and then types the domain arrives as direct traffic. Read a " +
  "rise here as people acting on the answers, never as how often the brand is named. Mind the two " +
  "senses of the phrase: the aiTraffic field on a prompt is the demand behind that question, while " +
  "get_ai_traffic counts sessions that reached the site.";

/** Why zeros from the Google tools are ambiguous, for the tools that can return them. */
export const GOOGLE_BINDING =
  "Both integrations are bound to the project in the PromptEye app. A project with nothing bound " +
  "answers with zeros and empty lists, which reads exactly like a site nobody visits — so call " +
  "get_google_status before reporting a zero as a finding, and say which of the two it was.";

/** What the bot traffic is, for the tools that report it. */
export const BOT_TRAFFIC =
  "A bot visit is a machine fetching a page, not a person reading one. It is the supply side of " +
  "visibility: an assistant can only quote a page its bot was able to fetch, so this says whether " +
  "the site is reachable and readable to them at all. It is a different measurement from being " +
  "named in an answer (list_prompts, list_competitors), from being cited as a source " +
  "(list_sources), and from somebody arriving afterwards (get_ai_traffic). `kind=ai` is the " +
  "assistants; `kind=seo` is classic search engines and SEO tools.";

/** Why a bot request may not be the bot it claims, for the tools that count them. */
export const VERIFIED =
  "A request carries the name of the bot in its User-Agent, which is free text anybody can send, " +
  "so each one is marked `verified` or not. The API has no filter for it and counts cannot be " +
  "split by it, so any total here includes requests that only claimed to be that bot. Report a " +
  "count as an upper bound and say so; never present it as measured reach without the caveat.";
