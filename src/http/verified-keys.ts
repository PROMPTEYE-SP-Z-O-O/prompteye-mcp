export type VerifiedKeysOptions = { ttlMs: number; now?: () => number };

export class VerifiedKeys {
  private readonly verifiedUntil = new Map<string, number>();
  private readonly now: () => number;

  constructor(private readonly options: VerifiedKeysOptions) {
    this.now = options.now ?? Date.now;
  }

  has(fingerprint: string): boolean {
    const until = this.verifiedUntil.get(fingerprint);
    if (until === undefined) return false;
    if (until > this.now()) return true;

    this.verifiedUntil.delete(fingerprint);
    return false;
  }

  add(fingerprint: string): void {
    this.dropExpired();
    this.verifiedUntil.set(fingerprint, this.now() + this.options.ttlMs);
  }

  forget(fingerprint: string): void {
    this.verifiedUntil.delete(fingerprint);
  }

  private dropExpired(): void {
    const now = this.now();
    for (const [fingerprint, until] of this.verifiedUntil) {
      if (until <= now) this.verifiedUntil.delete(fingerprint);
    }
  }
}
