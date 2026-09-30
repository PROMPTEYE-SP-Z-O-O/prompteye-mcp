import { aiTrafficText } from "../result.js";

describe("aiTrafficText", () => {
  it("tells a measured zero apart from a prompt that was never measured", () => {
    expect(aiTrafficText({ aiTraffic: 0, aiTrafficMeasuredAt: "2026-09-29T10:00:00.000Z" })).toBe(
      "0 (measured 2026-09-29)"
    );
    expect(aiTrafficText({ aiTraffic: null, aiTrafficMeasuredAt: null })).toBe("not measured yet");
  });

  it("says a measurement came back without data rather than zero", () => {
    expect(aiTrafficText({ aiTraffic: null, aiTrafficMeasuredAt: "2026-09-29T10:00:00.000Z" })).toBe(
      "no data (measured 2026-09-29)"
    );
  });

  it("shows a figure whose measurement time is unknown", () => {
    expect(aiTrafficText({ aiTraffic: 70, aiTrafficMeasuredAt: null })).toBe("70");
  });

  it("falls back to the bare figure against an API that does not report the time", () => {
    expect(aiTrafficText({ aiTraffic: 70 })).toBe("70");
    expect(aiTrafficText({ aiTraffic: null })).toBe("—");
  });
});
