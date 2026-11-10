/**
 * Which exit ended a session, said once. The first cause marked wins, so a
 * cleanup that runs after the real cause cannot overwrite it. A session that
 * ends with nothing marked ended because the learner went.
 */
export type SessionExitClass = 'brain-turn' | 'lease' | 'stt' | 'tts' | 'cap' | 'learner-left' | 'done' | 'safety' | 'start';

export class SessionExit {
  #cls: SessionExitClass | undefined;
  #logged = false;
  readonly #write: (line: string) => void;
  constructor(write: (line: string) => void = (line) => console.log(line)) { this.#write = write; }
  mark(cls: SessionExitClass): void { this.#cls ??= cls; }
  log(): void {
    if (this.#logged) return;
    this.#logged = true;
    this.#write(`[luvani:session-exit] class=${this.#cls ?? 'learner-left'}`);
  }
}

/** The half of the pipeline an unrecoverable error took down; undefined for kinds with no exit class. */
export function exitForPipeline(kind: string): SessionExitClass | undefined {
  return kind === 'stt_error' ? 'stt' : kind === 'tts_error' ? 'tts' : kind === 'llm_error' ? 'brain-turn' : undefined;
}

/**
 * Why the lifecycle stopped the room, as the lifecycle recorded it: the hard
 * deadline is the cap; anything else is a lease that could not be renewed.
 */
export function exitForStop(lifecycle: { readonly stoppedAtDeadline: boolean }): SessionExitClass {
  return lifecycle.stoppedAtDeadline ? 'cap' : 'lease';
}
