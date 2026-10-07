/**
 * The native half of the sound-effect seam (docs/come-alive/motion-sound.md section 6.2).
 *
 * One player per sound, created the first time it is needed or warmed by the celebration host.
 * Each player keeps the audio session active when it pauses or ends: expo-audio otherwise
 * deactivates the session 100 ms after its last player stops, and a short sound ending during a
 * tutor line spoken by expo-speech could cut that line (review finding 5). Voice playback and
 * recording pause every sound effect before they change the mode (sound/audioSessionCore.ts).
 *
 * Nothing plays unless the founder approved that exact sound (SFX_APPROVED).
 */
import { AppState } from 'react-native';
import { createAudioPlayer } from 'expo-audio';

import { currentAudioMode, enterSfx, setSfxPause } from './audioSession.ts';
import { createSfxCore } from './sfxCore.ts';
import { setSfxAppActive } from './sfxGate.ts';
import type { SfxId } from './sfxIds.ts';
import { SFX_APPROVED } from './sfxManifest.ts';
import { SFX_SOURCES } from './sfxSources.ts';
import { soundEnabled } from './soundPreference.ts';

const core = createSfxCore({
  approved: SFX_APPROVED,
  soundOn: soundEnabled,
  createPlayer: (id) => createAudioPlayer(SFX_SOURCES[id], { keepAudioSessionActive: true }),
  enterSfx,
  currentMode: currentAudioMode,
});

setSfxPause(core.pauseAll);
setSfxAppActive(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
AppState.addEventListener('change', (state) => {
  setSfxAppActive(state === 'active');
  if (state !== 'active') core.pauseAll();
});

export function play(id: SfxId): void {
  void core.play(id).catch(() => {});
}

export function warmSfx(ids: readonly SfxId[]): void {
  core.warm(ids);
}

export function pauseAllSfx(): void {
  core.pauseAll();
}
