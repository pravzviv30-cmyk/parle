/**
 * The one player a Practice or My French screen uses for a bundled recording.
 *
 * Playback only, of an asset shipped with the app: nothing here records,
 * uploads or scores, and nothing here ever falls back to the phone's
 * synthesiser, so a recording is the only thing it can play. It takes the
 * shared daily-playback claim, so a recording started here stops one started
 * on a daily card and the other way round, and it lets go when the screen
 * goes, so a line never follows the learner onto the next screen (F304).
 */

import { useCallback, useEffect, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { claimDailyPlayback, releaseDailyPlayback } from '../daily/playback.ts';

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

  const stop = useCallback(() => {
    releaseDailyPlayback(player);
    setPlaying(null);
  }, [player]);

  useEffect(() => {
    if (status.didJustFinish) setPlaying(null);
  }, [status.didJustFinish]);

  // Let go when the screen goes.
  useEffect(() => () => releaseDailyPlayback(player), [player]);

  const toggle = useCallback(
    (asset: number) => {
      if (playing === asset) {
        stop();
        return;
      }
      claimDailyPlayback(player);
      setPlaying(asset);
      void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, shouldPlayInBackground: false })
        .then(() => {
          player.pause();
          player.replace(asset);
          player.play();
        })
        .catch(() => setPlaying(null));
    },
    [player, playing, stop],
  );

  return { playing, toggle, stop };
}
