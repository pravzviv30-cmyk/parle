/** Proposed motion timings, bounded and tied to real state. */
export const FEEDBACK_MS = { selection: 200, context: 260, saved: 440, earned: 650, practised: 320, help: 200, reopened: 260 } as const;
export type FeedbackKind = keyof typeof FEEDBACK_MS;
/** Session-only, bounded deduplication. Event identifiers stay in memory and are never persisted or transmitted. */
export class FeedbackLedger {
  private seen = new Set<string>();
  claim(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > 128) this.seen.delete(this.seen.values().next().value!);
    return true;
  }
}
