import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export type HttpSession = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  fingerprint: string;
  lastSeenAt: number;
};

export type SessionRegistryOptions = { idleMs: number; maxPerKey: number; now?: () => number };

type Entry = [id: string, session: HttpSession];

const byLastSeen = ([, a]: Entry, [, b]: Entry): number => a.lastSeenAt - b.lastSeenAt;

export class SessionRegistry {
  private readonly sessions = new Map<string, HttpSession>();
  private readonly now: () => number;

  constructor(private readonly options: SessionRegistryOptions) {
    this.now = options.now ?? Date.now;
  }

  find(sessionId: string, fingerprint: string): HttpSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.fingerprint !== fingerprint) return undefined;

    session.lastSeenAt = this.now();
    return session;
  }

  add(sessionId: string, session: HttpSession): void {
    if (this.countFor(session.fingerprint) >= this.options.maxPerKey) {
      const [oldestId] = this.entriesFor(session.fingerprint).sort(byLastSeen)[0];
      this.close(oldestId);
    }
    this.sessions.set(sessionId, session);
  }

  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  sweep(): string[] {
    const now = this.now();
    const idle = [...this.sessions].filter(([, session]) => now - session.lastSeenAt > this.options.idleMs);
    const ids = idle.map(([id]) => id);
    ids.forEach((id) => this.close(id));
    return ids;
  }

  countFor(fingerprint: string): number {
    return this.entriesFor(fingerprint).length;
  }

  get size(): number {
    return this.sessions.size;
  }

  private entriesFor(fingerprint: string): Entry[] {
    return [...this.sessions].filter(([, session]) => session.fingerprint === fingerprint);
  }

  private close(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    this.sessions.delete(sessionId);
    Promise.resolve(session?.transport.close()).catch(() => undefined);
  }
}
