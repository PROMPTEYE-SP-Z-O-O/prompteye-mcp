import { VerifiedKeys } from "../verified-keys.js";

describe("VerifiedKeys", () => {
  it("remembers an accepted key until its time is up", () => {
    let now = 0;
    const keys = new VerifiedKeys({ ttlMs: 60_000, now: () => now });

    keys.add("fp");
    now = 59_999;
    const before = keys.has("fp");
    now = 60_000;

    expect(before).toBe(true);
    expect(keys.has("fp")).toBe(false);
  });

  it("forgets a key the API refused", () => {
    const keys = new VerifiedKeys({ ttlMs: 60_000 });

    keys.add("fp");
    keys.forget("fp");

    expect(keys.has("fp")).toBe(false);
  });
});
