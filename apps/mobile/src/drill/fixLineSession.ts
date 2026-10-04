import type { FixLineVerdict } from '../speech/fixLineAttempt.ts';

export type FixLinePhase = 'ready' | 'transcribing' | 'editing' | 'checking' | 'retry' | 'success' | 'unavailable' | 'finished';
export interface FixLineState { phase: FixLinePhase; attempt: string; hint: string | null }
export interface FixLinePorts {
  now(): number;
  current(): boolean;
  changed(state: FixLineState): void;
  judge(attempt: string, signal: AbortSignal, current: () => boolean): Promise<FixLineVerdict | null>;
  transcribe(uri: string, signal: AbortSignal, current: () => boolean): Promise<string | null>;
  discard(uri: string): void;
  success(): void;
}

/** Deliberate retry. Only requests time out; drafts live until explicit exit. */
export class FixLineSession {
  private alive = true;
  private revision = 0;
  private pending: AbortController | null = null;
  private state: FixLineState = { phase: 'ready', attempt: '', hint: null };
  private ports: FixLinePorts;
  constructor(ports: FixLinePorts) { this.ports = ports;  }
  snapshot(): FixLineState { return { ...this.state }; }
  private current(ticket = this.revision): boolean {
    return this.alive && this.ports.current() && ticket === this.revision;
  }
  private show(state: FixLineState): void { this.state = state; this.ports.changed(this.snapshot()); }
  edit(attempt = this.state.attempt): void {
    if (!this.current() || this.state.phase === 'success') return;
    this.revision++; this.pending?.abort(); this.pending = null;
    this.show({ phase: 'editing', attempt: attempt.slice(0, 600), hint: null });
  }
  async take(uri: string | null): Promise<void> {
    if (!uri) { this.edit(); return; }
    if (!this.current() || ['checking', 'transcribing', 'success'].includes(this.state.phase)) { this.ports.discard(uri); return; }
    const draft = this.state.attempt;
    const ticket = ++this.revision;
    const controller = new AbortController(); this.pending = controller;
    this.show({ phase: 'transcribing', attempt: draft, hint: null });
    try {
      const transcript = await this.ports.transcribe(uri, controller.signal, () => this.current(ticket));
      if (this.current(ticket)) this.show({ phase: 'editing', attempt: transcript?.trim() ? transcript.slice(0, 600) : draft, hint: null });
    } catch {
      if (this.current(ticket)) this.show({ phase: 'editing', attempt: draft, hint: null });
    } finally { this.ports.discard(uri); if (this.pending === controller) this.pending = null; }
  }
  async check(): Promise<void> {
    const attempt = this.state.attempt.trim();
    if (!this.current() || !attempt || ['checking', 'transcribing', 'success'].includes(this.state.phase)) return;
    const ticket = ++this.revision;
    const controller = new AbortController(); this.pending = controller;
    this.show({ phase: 'checking', attempt, hint: null });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const expiry = new Promise<null>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null); }, 12_000); });
      const verdict = await Promise.race([this.ports.judge(attempt, controller.signal, () => this.current(ticket)), expiry]);
      if (!this.current(ticket)) return;
      if (!verdict) this.show({ phase: 'unavailable', attempt, hint: null });
      else if (verdict.fixed) { this.show({ phase: 'success', attempt, hint: null }); this.ports.success(); }
      else this.show({ phase: 'retry', attempt, hint: verdict.hint });
    } catch {
      if (this.current(ticket)) this.show({ phase: 'unavailable', attempt, hint: null });
    } finally { clearTimeout(timer); if (this.pending === controller) this.pending = null; }
  }
  finish(): void {
    if (!this.alive) return;
    this.alive = false; this.revision++; this.pending?.abort(); this.pending = null;
    if (this.state.phase === 'success') return;
    this.show({ phase: 'finished', attempt: '', hint: null });
  }
  dispose(): void { this.alive = false; this.revision++; this.pending?.abort(); this.pending = null; this.state = { phase: 'finished', attempt: '', hint: null }; }
}
