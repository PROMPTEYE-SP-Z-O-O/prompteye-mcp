import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SessionRegistry, type HttpSession } from "../sessions.js";

function fakeSession(fingerprint: string, lastSeenAt: number, closed: string[], id: string): HttpSession {
  const transport = { sessionId: id, close: async () => void closed.push(id) } as unknown as StreamableHTTPServerTransport;
  return { server: {} as McpServer, transport, fingerprint, lastSeenAt };
}

describe("SessionRegistry", () => {
  it("finds a session only for the key that opened it", () => {
    const registry = new SessionRegistry({ idleMs: 1_000, maxPerKey: 5, now: () => 100 });
    registry.add("s1", fakeSession("key-a", 0, [], "s1"));

    expect(registry.find("s1", "key-b")).toBeUndefined();
    expect(registry.find("missing", "key-a")).toBeUndefined();
    expect(registry.find("s1", "key-a")?.lastSeenAt).toBe(100);
  });

  it("sweeps sessions idle longer than the limit and closes their transports", () => {
    let now = 0;
    const closed: string[] = [];
    const registry = new SessionRegistry({ idleMs: 1_000, maxPerKey: 5, now: () => now });
    registry.add("old", fakeSession("key-a", 0, closed, "old"));
    registry.add("fresh", fakeSession("key-a", 900, closed, "fresh"));

    now = 1_500;
    expect(registry.sweep()).toEqual(["old"]);
    expect(closed).toEqual(["old"]);
    expect(registry.size).toBe(1);
    expect(registry.find("fresh", "key-a")).toBeDefined();
  });

  it("evicts the oldest session of a key once it holds the maximum", () => {
    const closed: string[] = [];
    const registry = new SessionRegistry({ idleMs: 1_000, maxPerKey: 2, now: () => 50 });
    registry.add("s1", fakeSession("key-a", 10, closed, "s1"));
    registry.add("s2", fakeSession("key-a", 20, closed, "s2"));
    registry.add("other", fakeSession("key-b", 5, closed, "other"));

    registry.add("s3", fakeSession("key-a", 30, closed, "s3"));

    expect(closed).toEqual(["s1"]);
    expect(registry.countFor("key-a")).toBe(2);
    expect(registry.countFor("key-b")).toBe(1);
    expect(registry.find("s1", "key-a")).toBeUndefined();
    expect(registry.find("s3", "key-a")).toBeDefined();
  });

  it("forgets a removed session", () => {
    const registry = new SessionRegistry({ idleMs: 1_000, maxPerKey: 5 });
    registry.add("s1", fakeSession("key-a", 0, [], "s1"));

    registry.remove("s1");

    expect(registry.size).toBe(0);
  });
});
