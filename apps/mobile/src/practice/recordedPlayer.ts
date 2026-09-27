/**
 * The one player a Practice or My French screen uses for a bundled recording.
 *
 * Playback only, of an asset shipped with the app: nothing here records,
 * uploads or scores, and nothing here ever falls back to the phone's
 * synthesiser, so a recording is the only thing it can play. It takes the
 * shared daily-playback claim, so a recording started here stops one started
 * on a daily card and the other way round.
 *
 * It lets go whenever the learner leaves: when the screen unmounts, when its
 * tab loses focus (tabs stay mounted, so unmounting alone never happened on a
 * tab switch), and when the app goes to the background, the way
 * `daily/DailyCard.tsx` already does (F304, F470, Phase 3 review 2026-09-27).
 * A play that was stopped while it loaded never starts: `playbackGate.ts`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { claimDailyPlayback, releaseDailyPlayback } from '../daily/playback.ts';
import { createPlaybackGate, playWhenCurrent } from './playbackGate.ts';

export interface RecordedLinePlayer {
  /** The asset playing now, or null. */
  playing: number | null;
  /** Play this asset, or stop it when it is the one playing. */
  toggle: (asset: number) => void;
  stop: () => void;
}

export function useRecordedLine(): RecordedLinePlayer {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [playing, setPlaying] = useState<number | null>(null);
  const gate = useRef(createPlaybackGate()).current;
  const focused = useIsFocused();

  const stop = useCallback(() => {
    gate.cancel();
    releaseDailyPlayback(player);
    setPlaying(null);
  }, [gate, player]);

  useEffect(() => {
    if (status.didJustFinish) setPlaying(null);
  }, [status.didJustFinish]);

  // The tab stays mounted when the learner switches away, so a blur is a leave.
  useEffect(() => {
    if (!focused) stop();
  }, [focused, stop]);

  // And so is the app going to the background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') stop(); });
    return () => subscription.remove();
  }, [stop]);

  // Let go when the screen goes.
  useEffect(
    () => () => {
      gate.cancel();
      releaseDailyPlayback(player);
    },
    [gate, player],
  );

  const toggle = useCallback(
    (asset: number) => {
      if (playing === asset) {
        stop();
        return;
      }
      const ticket = gate.begin();
      claimDailyPlayback(player);
      setPlaying(asset);
      void playWhenCurrent(gate, ticket, () => setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, shouldPlayInBackground: false }), () => {
        player.pause();
        player.replace(asset);
        player.play();
      }).catch(() => {
        if (gate.isCurrent(ticket)) setPlaying(null);
      });
    },
    [gate, player, playing, stop],
  );

  return { playing, toggle, stop };
}
