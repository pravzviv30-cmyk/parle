/**
 * The web half of the sound-effect seam (docs/come-alive/motion-sound.md section 6.3).
 *
 * The browser preview obeys the same approval and gate as the phone, with three web rules:
 * - Never preload. expo-audio's preload path makes a `blob:` URL, which the preview's content
 *   policy refuses; a player is created only inside the first play that a gesture started, and
 *   it loads the same-origin file as a plain media element.
 * - Play only inside a user-gesture task (`navigator.userActivation.isActive`). A celebration
 *   that arrives after an async store write is not one, and a browser would refuse it.
 * - expo-audio discards the promise `HTMLMediaElement.play()` returns, so a refusal surfaces as an
 *   unhandled rejection rather than a throw (review finding 13). One listener, installed with the
 *   first sound, drops a `NotAllowedError` that follows one of our own plays, and nothing else.
 * There are no audio modes on the web (`setAudioModeAsync` is a no-op there).
 */
import { AppState } from 'react-native';
import { createAudioPlayer } from 'expo-audio';

import { createSfxCore } from './sfxCore.ts';
import { setSfxAppActive } from './sfxGate.ts';
import type { SfxId } from './sfxIds.ts';
import { SFX_APPROVED } from './sfxManifest.ts';
import { SFX_SOURCES } from './sfxSources.ts';
import { soundEnabled } from './soundPreference.ts';

/** How long after one of our plays a refusal is taken to be that play's. */
const REFUSAL_WINDOW_MS = 2000;

let lastPlayAt = Number.NEGATIVE_INFINITY;
let listening = false;

type RejectionEvent = { reason?: unknown; preventDefault?: () => void };

function dropOurRefusal(event: RejectionEvent): void {
  const reason = event.reason as { name?: unknown } | null | undefined;
  if (!reason || reason.name !== 'NotAllowedError') return;
  if (Date.now() - lastPlayAt > REFUSAL_WINDOW_MS) return;
  event.preventDefault?.();
}

function listenForRefusals(): void {
  if (listening) return;
  const target = globalThis as { addEventListener?: (type: string, listener: (event: RejectionEvent) => void) => void };
  if (typeof target.addEventListener !== 'function') return;
  target.addEventListener('unhandledrejection', dropOurRefusal);
  listening = true;
}

function inGestureTask(): boolean {
  const activation = (globalThis as { navigator?: { userActivation?: { isActive?: boolean } } }).navigator?.userActivation;
  return activation?.isActive === true;
}

const core = createSfxCore({
  approved: SFX_APPROVED,
  soundOn: soundEnabled,
  // Lazily, inside the first play a gesture started; `downloadFirst` stays false (no blob: URL).
  createPlayer: (id) => createAudioPlayer(SFX_SOURCES[id]),
  mayStart: inGestureTask,
  // Called once the throttle has admitted the sound, just before it plays, so the refusal window
  // opens only for a play that is about to start.
  willStart: () => {
    listenForRefusals();
    lastPlayAt = Date.now();
  },
});

AppState.addEventListener('change', (state) => {
  setSfxAppActive(state === 'active');
  if (state !== 'active') core.pauseAll();
});

export function play(id: SfxId): void {
  void core.play(id).catch(() => {});
}

/** The web seam never preloads: a warm is nothing here. */
export function warmSfx(_ids: readonly SfxId[]): void {
  // Never preload on the web.
}

export function pauseAllSfx(): void {
  core.pauseAll();
}
