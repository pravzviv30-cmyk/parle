/**
 * One hear control's playback for Explore's words and the scene preview (B1,
 * 2026-10-20). Which source plays is decided before this runs
 * (`scenePreview.ts`, `exploreView.ts`); this only plays it.
 *
 * A bundled clip plays the way the daily cards and `ListeningPreview` play
 * theirs: one player, claimed through `daily/playback.ts`. A line with no clip
 * speaks through `speech/tutorVoice.ts`, labelled as the device voice by the
 * caller. Leaving the screen or the app going to the background stops both.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { claimDailyPlayback, ownsDailyPlayback, releaseDailyPlayback } from '../daily/playback.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { enterVoicePlayback } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';

export function useHear() {
  const player = useAudioPlayer();
  useVoiceHold(useAudioPlayerStatus(player).playing);
  const focused = useIsFocused();
  const ticket = useRef(0);
  const speaking = useRef(false);
  const [deviceFrench, setDeviceFrench] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void tutorVoice.available().then((has) => { if (!cancelled) setDeviceFrench(has); });
    return () => { cancelled = true; };
  }, []);

  const stop = useCallback(() => {
    ticket.current += 1;
    releaseDailyPlayback(player);
    if (speaking.current) { speaking.current = false; tutorVoice.stop(); }
  }, [player]);

  useEffect(() => () => stop(), [focused, stop]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') stop(); });
    return () => subscription.remove();
  }, [stop]);

  /** Play a bundled asset when there is one, otherwise the device voice. */
  const hear = useCallback(async (fr: string, asset: number | undefined) => {
    stop();
    const mine = ticket.current;
    try {
      if (asset !== undefined) {
        claimDailyPlayback(player);
        await enterVoicePlayback();
        if (mine !== ticket.current || !ownsDailyPlayback(player)) return;
        player.pause();
        player.replace(asset);
        player.play();
        return;
      }
      if (deviceFrench !== true) return;
      speaking.current = true;
      tutorVoice.speakLines([fr], () => { if (ticket.current === mine) speaking.current = false; });
    } catch {
      // The words stay on screen to read.
    }
  }, [deviceFrench, player, stop]);

  return { hear, stop, deviceFrench: deviceFrench === true };
}
