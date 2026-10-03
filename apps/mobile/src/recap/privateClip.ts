/** A recap take has no store, upload or learning effect. Invalidated async work
 * can only dispose its result; it cannot replace the next account's clip. */
export class PrivateClip {
  private generation = 0;
  private held: string | null = null;
  private finishing: Promise<string | null> | null = null;
  private readonly discard: (uri: string | null) => void;
  constructor(discard: (uri: string | null) => void) { this.discard = discard; }
  ticket(): number { return this.generation; }
  current(ticket: number): boolean { return ticket === this.generation; }
  get uri(): string | null { return this.held; }
  replace(): void { this.discard(this.held); this.held = null; }
  exit(): void { this.generation++; this.replace(); }
  finish(ticket: number, stop: () => Promise<string | null>): Promise<string | null> {
    if (this.finishing) return this.finishing;
    const work = stop().then(uri => {
      if (!this.current(ticket)) { this.discard(uri); return null; }
      this.replace(); this.held = uri; return uri;
    }).finally(() => { if (this.finishing === work) this.finishing = null; });
    this.finishing = work; return work;
  }
}
