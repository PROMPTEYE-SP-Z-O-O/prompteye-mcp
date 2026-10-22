export type VerifiedKeysOptions = { ttlMs: number; now?: () => number };

export class VerifiedKeys {
  private readonly verifiedUntil = new Map<string, number>();
  private readonly now: () => number;

  constructor(private readonly options: VerifiedKeysOptions) {
    this.now = options.now ?? Date.now;
  }

  has(fingerprint: string): boolean {
    return (this.verifiedUntil.get(fingerprint) ?? 0) > this.now();
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
