/** The bounded gestures authored in the M2/M3 Remotion studies. */
export type IllustrationRole = 'body' | 'gesture' | 'face' | 'prop' | 'still';
export const ILLUSTRATION_MS = 1900;
export const ILLUSTRATION_STEP_MS = 55;
export const ILLUSTRATION_VIEWBOX = { width: 320, height: 200 } as const;

export type IllustrationDecision = 'wait' | 'play' | 'rest';
export interface IllustrationVisibility {
  reduced: boolean | null;
  active: boolean;
  focused: boolean;
  foreground: boolean;
}

/**
 * One flourish for a newly shown illustration/event. A reduced-motion answer
 * consumes that flourish, so changing the setting later cannot replay it.
 * Interruptions settle permanently until the caller supplies a new event key.
 */
export class IllustrationCue {
  private eventKey: string | number | undefined;
  private played = false;
  private scopeStopped = false;

  constructor(eventKey?: string | number) {
    this.eventKey = eventKey;
  }

  decide(eventKey: string | number | undefined, state: IllustrationVisibility): IllustrationDecision {
    if (eventKey !== this.eventKey) {
      this.eventKey = eventKey;
      this.played = false;
    }
    if (this.scopeStopped) return 'rest';
    if (state.reduced === null) return 'wait';
    if (state.reduced) {
      this.played = true;
      return 'rest';
    }
    if (!state.active || !state.focused || !state.foreground || this.played) return 'rest';
    this.played = true;
    return 'play';
  }

  /** A screen/account interruption never restarts an in-flight gesture. */
  interrupt(accountChanged = false): void {
    this.played = true;
    if (accountChanged) this.scopeStopped = true;
  }
}

/** Clamp invalid layout measurements before they reach native transforms. */
export function illustrationScale(width: number): number {
  return Number.isFinite(width) && width > 0 ? width / ILLUSTRATION_VIEWBOX.width : 1;
}
