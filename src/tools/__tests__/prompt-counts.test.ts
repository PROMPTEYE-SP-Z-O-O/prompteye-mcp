import type { Account, Prompt } from "../../schemas/prompteye.js";
import { countPrompts, describeCounts, describeUsage, thinGroups } from "../prompt-counts.js";

const account = (promptCount: number, promptLimit: number): Account =>
  ({ promptCount, promptLimit }) as Account;

const withStatus = (status: string): Prompt => ({ id: status, prompt: status, status }) as Prompt;

describe("countPrompts", () => {
  it("counts pending prompts as active and keeps paused ones apart", () => {
    expect(countPrompts([withStatus("active"), withStatus("pending"), withStatus("paused")], false)).toEqual({
      active: 2,
      paused: 1,
      total: 3,
      more: false,
    });
  });
});

describe("describeCounts", () => {
  it("marks every figure as a floor when more prompts exist", () => {
    expect(describeCounts({ active: 150, paused: 50, total: 200, more: true })).toBe(
      "150+ active, 50+ paused, 200+ in total"
    );
  });
});

describe("describeUsage", () => {
  it("says the workspace count leaves paused prompts out and how much room is left", () => {
    expect(describeUsage(account(25, 50))).toMatch(/^25 of 50 prompt\(s\) tracked across the workspace/);
    expect(describeUsage(account(25, 50))).toMatch(/paused prompts are not counted\), room for 25 more$/);
    expect(describeUsage(account(50, 50))).toMatch(/the plan's limit is reached$/);
  });
});

describe("thinGroups", () => {
  it("keeps groups under three active prompts, emptiest first", () => {
    const groups = [
      { id: "a", name: "A", active: 2, paused: 0, suggestions: 0 },
      { id: "b", name: "B", active: 5, paused: 0, suggestions: 0 },
      { id: "c", name: "C", active: 0, paused: 3, suggestions: 1 },
    ];
    expect(thinGroups(groups).map((group) => group.id)).toEqual(["c", "a"]);
  });
});
