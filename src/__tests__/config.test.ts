import { readEnvCredentials, requireBaseUrl } from "../config.js";

const SETTINGS = ["PROMPTEYE_API_BASE_URL", "PROMPTEYE_API_KEY"] as const;

const saved = Object.fromEntries(SETTINGS.map((name) => [name, process.env[name]]));

const setEnv = (values: Partial<Record<(typeof SETTINGS)[number], string>>): void => {
  SETTINGS.forEach((name) => {
    delete process.env[name];
    const value = values[name];
    if (value !== undefined) process.env[name] = value;
  });
};

afterAll(() => setEnv(saved));

describe("requireBaseUrl", () => {
  it("returns the trimmed base URL without needing a key", () => {
    setEnv({ PROMPTEYE_API_BASE_URL: " https://api.example " });
    expect(requireBaseUrl()).toBe("https://api.example");
  });

  it("names the variable when it is missing", () => {
    setEnv({});
    expect(() => requireBaseUrl()).toThrow(/PROMPTEYE_API_BASE_URL is not set.*integrations/);
  });

  it("treats an empty value as unset", () => {
    setEnv({ PROMPTEYE_API_BASE_URL: "   " });
    expect(() => requireBaseUrl()).toThrow(/PROMPTEYE_API_BASE_URL is not set/);
  });
});

describe("readEnvCredentials", () => {
  it("reads both settings", () => {
    setEnv({ PROMPTEYE_API_BASE_URL: "https://api.example", PROMPTEYE_API_KEY: "pe_live_x" });
    expect(readEnvCredentials()).toEqual({ baseUrl: "https://api.example", token: "pe_live_x" });
  });

  it("names the key when only it is missing", () => {
    setEnv({ PROMPTEYE_API_BASE_URL: "https://api.example" });
    expect(() => readEnvCredentials()).toThrow(/^PROMPTEYE_API_KEY is not set/);
  });

  it("names the base URL when only it is missing", () => {
    setEnv({ PROMPTEYE_API_KEY: "pe_live_x" });
    expect(() => readEnvCredentials()).toThrow(/^PROMPTEYE_API_BASE_URL is not set/);
  });

  it("names both when both are missing", () => {
    setEnv({});
    expect(() => readEnvCredentials()).toThrow(/^PROMPTEYE_API_BASE_URL and PROMPTEYE_API_KEY are not set/);
  });
});
