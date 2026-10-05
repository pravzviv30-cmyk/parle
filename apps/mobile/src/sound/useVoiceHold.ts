/**
 * Holds the voice focus while a player reports that it is playing, so no sound effect can take the
 * audio session from a voice line (sound/audioFocus.ts). Released when playback stops, finishes or
 * the screen goes.
 */
import { useEffect } from 'react';

import { holdVoice } from './audioFocus.ts';

export function useVoiceHold(playing: boolean): void {
  useEffect(() => {
    if (!playing) return undefined;
    return holdVoice();
  }, [playing]);
}
