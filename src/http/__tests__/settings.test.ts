import { readHttpSettings } from "../settings.js";

const BASE = { PROMPTEYE_API_BASE_URL: "https://api.example" };
const RESOURCE = "https://mcp.example.com/mcp";
const ISSUER = "https://auth.example.com/oauth";

const read = (env: Record<string, string>) => readHttpSettings({ ...BASE, ...env });

describe("readHttpSettings OAuth", () => {
  it("leaves OAuth off when neither variable is set", () => {
    expect(read({}).oauth).toBeUndefined();
  });

  it("enables OAuth when both variables are set", () => {
    expect(read({ MCP_PUBLIC_URL: RESOURCE, MCP_AUTHORIZATION_SERVER: ISSUER }).oauth).toEqual({
      resource: RESOURCE,
      authorizationServer: ISSUER,
    });
  });

  it("fails when only one variable is set", () => {
    expect(() => read({ MCP_PUBLIC_URL: RESOURCE })).toThrow(/must be set together/);
    expect(() => read({ MCP_AUTHORIZATION_SERVER: ISSUER })).toThrow(/must be set together/);
  });

  it("requires absolute https URLs and allows http only for localhost", () => {
    expect(() => read({ MCP_PUBLIC_URL: "mcp.example.com/mcp", MCP_AUTHORIZATION_SERVER: ISSUER })).toThrow(/MCP_PUBLIC_URL/);
    expect(() => read({ MCP_PUBLIC_URL: "http://mcp.example.com/mcp", MCP_AUTHORIZATION_SERVER: ISSUER })).toThrow(/MCP_PUBLIC_URL/);
    expect(() => read({ MCP_PUBLIC_URL: RESOURCE, MCP_AUTHORIZATION_SERVER: "http://auth.example.com" })).toThrow(/MCP_AUTHORIZATION_SERVER/);
    expect(read({ MCP_PUBLIC_URL: "http://localhost:3000/mcp", MCP_AUTHORIZATION_SERVER: "http://localhost:4000" }).oauth).toBeDefined();
  });

  it("treats empty and whitespace values as unset", () => {
    expect(read({ MCP_PUBLIC_URL: "", MCP_AUTHORIZATION_SERVER: "  " }).oauth).toBeUndefined();
    expect(() => read({ MCP_PUBLIC_URL: RESOURCE, MCP_AUTHORIZATION_SERVER: "  " })).toThrow(/must be set together/);
  });

  it("requires MCP_PUBLIC_URL to be exactly the /mcp endpoint", () => {
    const rejected = [
      "https://mcp.example.com/mcp/",
      "https://mcp.example.com/mcp?x=1",
      "https://mcp.example.com/mcp#frag",
      "https://mcp.example.com/",
      "https://mcp.example.com",
      "https://mcp.example.com/other",
      "https://mcp.example.com/(mcp)",
    ];
    for (const value of rejected) {
      expect(() => read({ MCP_PUBLIC_URL: value, MCP_AUTHORIZATION_SERVER: ISSUER })).toThrow(/MCP_PUBLIC_URL must be the MCP endpoint/);
    }
  });
});
