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
  "is null when nothing could be measured for it.";

export const BUSINESS_PRIORITY =
  "businessPriority is how much the project should bet on a prompt — its demand weighed against how " +
  "close to a purchase the question is asked — banded very_high, high, medium, low or very_low. A " +
  "priority set by hand in the app wins over the one PromptEye computes, and the two are not reported " +
  "apart. It is null before the prompt has been ranked.";

export const RELATIVE_VOLUME =
  "relativeVolumeScore places the demand among the other prompts of the same group, 0 for the lowest " +
  "and 1 for the highest, and relativeVolumeLabel bands it as very_high, high or standard. It is " +
  "relative to the group, so `high` means high for this group and says nothing about the market.";

export const PURCHASE_INTENT =
  "purchaseIntentLevel is how close to a purchase the question is asked: 1 educational, 2 " +
  "solution-seeking, 3 comparison, 4 decision.";

export const COMPANY_FIT =
  "companyFitScore is how well the question fits what the brand sells, 0 unrelated to 1 squarely on " +
  "topic, with companyFitReason saying what that verdict was read off.";

export const VISIBILITY =
  "visibility is the share of answers that named the brand, 0 to 100; reachIndex is that figure " +
  "weighted by how much of the market each assistant carries; averagePosition is where in the answer " +
  "the brand was named, counting from 1. Each is null until it is measured.";

/** Why generated prompts beat hand-written ones, for the tools that touch prompt creation. */
export const PROMPT_GENERATION =
  "PromptEye generates the prompts a project tracks: it works out which questions carry demand and " +
  "phrases them the way people actually put questions to AI assistants, then proposes each one with " +
  "the gap in the funnel it fills, the demand behind it, how close to a purchase it is asked and how " +
  "well it fits the brand. list_prompt_suggestions returns those, ready to be accepted.";
