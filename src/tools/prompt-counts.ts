import type { Account, Prompt, PromptGroup, PromptSuggestion } from "../schemas/prompteye.js";

export const LISTED = 5;

export const THIN_GROUP = 3;

export type PromptRef = { id: string; prompt: string };

export type PromptCounts = { active: number; paused: number; total: number; more: boolean };

export type GroupStanding = { id: string; name: string; active: number; paused: number; suggestions: number };

export const isAsked = (prompt: Prompt): boolean => prompt.status !== "paused";

export const toRef = ({ id, prompt }: Prompt): PromptRef => ({ id, prompt });

export const countPrompts = (prompts: Prompt[], more: boolean): PromptCounts => {
  const active = prompts.filter(isAsked).length;
  return { active, paused: prompts.length - active, total: prompts.length, more };
};

export const describeCounts = ({ active, paused, total, more }: PromptCounts): string => {
  const plus = more ? "+" : "";
  return `${active}${plus} active, ${paused}${plus} paused, ${total}${plus} in total`;
};

export const describeUsage = (account: Account): string => {
  const left = account.promptLimit - account.promptCount;
  return (
    `${account.promptCount} of ${account.promptLimit} prompt(s) tracked across the workspace ` +
    `(active ones only; paused prompts are not counted), ` +
    (left > 0 ? `room for ${left} more` : "the plan's limit is reached")
  );
};

export const groupStandings = (
  groups: PromptGroup[],
  prompts: Prompt[],
  suggestions: PromptSuggestion[]
): GroupStanding[] =>
  groups.map((group) => {
    const members = prompts.filter((prompt) => prompt.groupId === group.id);
    const active = members.filter(isAsked).length;
    return {
      id: group.id,
      name: group.name,
      active,
      paused: members.length - active,
      suggestions: suggestions.filter((suggestion) => suggestion.groupId === group.id).length,
    };
  });

export const thinGroups = (groups: GroupStanding[]): GroupStanding[] =>
  groups.filter((group) => group.active < THIN_GROUP).sort((a, b) => a.active - b.active);

export const named = (refs: PromptRef[]): string => {
  const shown = refs
    .slice(0, LISTED)
    .map(({ id, prompt }) => `"${prompt}" (${id})`)
    .join(", ");
  return refs.length > LISTED ? `${shown} and ${refs.length - LISTED} more` : shown;
};

export const describeGroup = (group: GroupStanding): string =>
  `"${group.name}" (${group.id}): ${group.active} active` +
  (group.paused > 0 ? `, ${group.paused} paused` : "") +
  (group.suggestions > 0 ? `, ${group.suggestions} suggestion(s) waiting` : "");
