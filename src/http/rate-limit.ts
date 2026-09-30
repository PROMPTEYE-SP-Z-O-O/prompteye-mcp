export type RequestBudgetOptions = { perMinute: number; now?: () => number };

export type BudgetDecision = { allowed: boolean; retryAfterSeconds: number };

type Window = { startedAt: number; used: number };

const WINDOW_MS = 60_000;
const PRUNE_ABOVE = 5_000;

export class RequestBudget {
  private readonly windows = new Map<string, Window>();
  private readonly now: () => number;

  constructor(private readonly options: RequestBudgetOptions) {
    this.now = options.now ?? Date.now;
  }

  peek(key: string): BudgetDecision {
    const now = this.now();
    return this.decide(this.currentWindow(key, now), now);
  }

  take(key: string): BudgetDecision {
    const now = this.now();
    const window = this.currentWindow(key, now);
    const decision = this.decide(window, now);
    if (decision.allowed) window.used += 1;
    return decision;
  }

  private decide(window: Window, now: number): BudgetDecision {
    if (window.used >= this.options.perMinute) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((window.startedAt + WINDOW_MS - now) / 1000)) };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  private currentWindow(key: string, now: number): Window {
    const existing = this.windows.get(key);
    if (existing && !this.isExpired(existing, now)) return existing;

    if (this.windows.size > PRUNE_ABOVE) this.forgetExpired(now);
    const fresh = { startedAt: now, used: 0 };
    this.windows.set(key, fresh);
    return fresh;
  }

  private isExpired(window: Window, now: number): boolean {
    return now - window.startedAt >= WINDOW_MS;
  }

  private forgetExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (this.isExpired(window, now)) this.windows.delete(key);
    }
  }
}
