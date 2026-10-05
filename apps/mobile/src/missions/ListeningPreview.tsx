/**
 * The authored listening preview, as a quiet control (Stage 4, item 4).
 *
 * Closed, it is one ghost link. Open, it shows the authored lines, says in one
 * word where the sound comes from and that this is an authored example, and
 * offers to play it. Every decision is `preview.ts`'s. A bundled recording
 * plays the way the daily cards play theirs (`daily/DailyCard.tsx`): one player,
 * claimed through `daily/playback.ts` so only one daily recording sounds at a
 * time, released when the control closes or the screen goes. The device voice
 * speaks only through `speech/tutorVoice.ts`, and only when the preview is
 * labelled as the device voice.
 *
 * Nothing here listens, records, scores or reaches the network.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { GhostButton } from '../components.tsx';
import { HIT, onColour, frenchText, paper, space, type } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { dailyTutorVoice } from '../daily/tutorAudio.ts';
import { claimDailyPlayback, ownsDailyPlayback, releaseDailyPlayback } from '../daily/playback.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { enterVoicePlayback } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';
import { PREVIEW_COPY, previewFor, type PreviewSelection } from './preview.ts';

/**
 * `showContext` draws the selection's own description above the lines. Off by
 * default, because a host card usually says it already: on the chooser's hero
 * it is the goal line drawn just above this control.
 */
export function ListeningPreview({ selection, showContext = false, ground = 'white' }: { selection: PreviewSelection; showContext?: boolean; ground?: 'white' | 'blue' }) {
  const ink = ground === 'blue' ? paper.onInk : paper.ink;
  const quiet = ground === 'blue' ? onColour.blue : paper.inkSoft;
  const { profile } = useProfile();
  const voice = dailyTutorVoice(profile.tutorVoice);
  const player = useAudioPlayer();
  // No sound effect takes the audio session from the recording while it plays.
  useVoiceHold(useAudioPlayerStatus(player).playing);
  // The chooser stays mounted under a native stack when it pushes a room or a
  // lesson, so leaving it is a blur, not an unmount.
  const focused = useIsFocused();
  const [open, setOpen] = useState(false);
  // Null until the phone answers: before then, "no French voice" is a guess.
  const [deviceFrench, setDeviceFrench] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const ticket = useRef(0);
  // Whether the device voice now speaking was started here. `tutorVoice.stop()`
  // is global, so this preview only ever stops a voice it started.
  const speaking = useRef(false);

  const stopOwnVoice = useCallback(() => {
    if (!speaking.current) return;
    speaking.current = false;
    tutorVoice.stop();
  }, []);

  // Both sources at once: the recording and this preview's own device voice.
  const silence = useCallback(() => {
    ticket.current += 1;
    releaseDailyPlayback(player);
    stopOwnVoice();
  }, [player, stopOwnVoice]);

  // Asked once the control opens, never assumed: a phone with no French voice
  // gets the text-only label rather than a play button that plays nothing.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void tutorVoice.available().then((has) => {
      if (!cancelled) setDeviceFrench(has);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Closing the control, changing voice, the screen losing focus or going away
  // stops the sound, the way the daily cards stop theirs.
  useEffect(() => {
    return () => silence();
  }, [open, focused, player, voice, silence]);

  // So does the app leaving the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') silence();
    });
    return () => subscription.remove();
  }, [silence]);

  const preview = previewFor(selection, { voice, recordings: TUTOR_DAILY_AUDIO, deviceFrench: deviceFrench === true });
  // A bundled recording is known at once; the device voice only once asked.
  const sourceKnown = preview.audio === 'recorded' || deviceFrench !== null;

  const play = async () => {
    const mine = ++ticket.current;
    setNote('');
    try {
      if (preview.audio === 'recorded' && preview.asset !== undefined) {
        stopOwnVoice();
        claimDailyPlayback(player);
        await enterVoicePlayback();
        if (mine !== ticket.current || !ownsDailyPlayback(player)) return;
        player.pause();
        player.replace(preview.asset);
        player.play();
        return;
      }
      if (preview.plays === 'all') {
        releaseDailyPlayback(player);
        speaking.current = true;
        // A finish from an earlier press does not clear a newer one.
        tutorVoice.speakLines(preview.lines.map((line) => line.fr), () => {
          if (ticket.current === mine) speaking.current = false;
        });
      }
    } catch {
      setNote(PREVIEW_COPY.failed);
    }
  };

  return (
    <View style={st.wrap}>
      <Pressable
        onPress={() => setOpen((was) => !was)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [st.toggle, pressed && st.pressed]}
      >
        <Text style={[type.bodyStrong, { color: ink }]}>{open ? PREVIEW_COPY.close : PREVIEW_COPY.open}</Text>
      </Pressable>

      {open && (
        <View style={st.body}>
          {showContext && <Text style={[type.small, { color: quiet }]}>{preview.context}</Text>}
          {preview.lines.map((line) => (
            <View key={line.fr}>
              <Text {...frenchText} style={[type.french, { color: ink }]}>{line.fr}</Text>
              {line.en !== null && <Text style={[type.small, { color: quiet }]}>{line.en}</Text>}
            </View>
          ))}
          {sourceKnown && <Text style={[type.small, { color: ink }]}>{preview.label}</Text>}
          <Text style={[type.small, { color: quiet }]}>{preview.note}</Text>
          {sourceKnown && preview.plays !== 'none' && (
            <View style={st.controls}>
              <GhostButton label={preview.plays === 'first' ? PREVIEW_COPY.playFirst : PREVIEW_COPY.play} color={paper.ink} onPress={() => void play()} />
              <GhostButton label={PREVIEW_COPY.stop} color={ink} onPress={silence} />
            </View>
          )}
          {note !== '' && <Text accessibilityLiveRegion="polite" style={[type.small, { color: quiet }]}>{note}</Text>}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: space(2) },
  toggle: { minHeight: HIT, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  body: { gap: space(2) },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
