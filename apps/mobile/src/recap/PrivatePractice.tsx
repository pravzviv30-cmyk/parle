import { recorderUri } from '../daily/recorderUri.ts';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { AudioModule, RecordingPresets, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio';
import { useProfile } from '../app/ProfileContext.tsx';
import { IconAction, GhostButton, OutlineButton } from '../components.tsx';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { dailyTutorVoice, tutorAudioForFrench } from '../daily/tutorAudio.ts';
import { claimDailyPlayback, ownsDailyPlayback, releaseDailyPlayback } from '../daily/playback.ts';
import { finishLocalTake } from '../daily/finishLocalTake.ts';
import { discardRecording } from '../speech/discardRecording.ts';
import { onUserScopeReset } from '../storage/scope.ts';
import { holdMic } from '../sound/audioFocus.ts';
import { enterRecording, enterVoicePlayback, leaveRecording } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';
import { paper, type, space, frenchText } from '../theme.ts';
import { PrivateClip } from './privateClip.ts';

/** Fresh practice only: never the learner's actual live attempt or an assessment. */
export function PrivatePractice({ french }: { french: string }) {
  const { profile } = useProfile();
  const voice = dailyTutorVoice(profile.tutorVoice);
  const asset = tutorAudioForFrench(TUTOR_DAILY_AUDIO, DAILY_ITEMS, french, voice);
  const focused = useIsFocused();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();
  useVoiceHold(useAudioPlayerStatus(player).playing);
  const preparedUri = useRef<string | null>(recorderUri(recorder, null));
  const clip = useRef(new PrivateClip(discardRecording)).current;
  const active = useRef(false);
  const operation = useRef(false);
  const playback = useRef(0);
  const stopping = useRef<Promise<void> | null>(null);
  const stopRecorder = (): Promise<void> => {
    if (stopping.current) return stopping.current;
    const work = (async () => { await recorder.stop(); })().finally(() => { if (stopping.current === work) stopping.current = null; });
    stopping.current = work; return work;
  };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The microphone focus, held from before the mode change until the take ends
  // by any route; every route out goes through here (F724).
  const micHold = useRef<(() => void) | null>(null);
  const resetRecordingAudio = (): Promise<void> => { micHold.current?.(); micHold.current = null; return leaveRecording(); };
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const finish = async () => {
    const ticket = clip.ticket();
    try {
      const result = await clip.finish(ticket, () => finishLocalTake({
        stop: stopRecorder, uri: () => recorderUri(recorder, preparedUri.current),
        resetAudio: resetRecordingAudio,
        current: () => active.current && clip.current(ticket), discard: discardRecording,
      }));
      if (!active.current || !clip.current(ticket)) return;
      setUri(result); setRecording(false); setNote(result ? 'Your fresh practice take is ready to hear.' : 'That take could not finish. Try again.');
    } catch { if (active.current && clip.current(ticket)) { setRecording(false); setNote('That take could not finish. Try again.'); } }
    finally { if (timer.current) clearTimeout(timer.current); }
  };
  useLayoutEffect(() => {
    active.current = focused && AppState.currentState === 'active';
    const exit = () => {
      active.current = false; clip.exit(); playback.current++;
      if (timer.current) clearTimeout(timer.current);
      releaseDailyPlayback(player);
      const abandoned = recorderUri(recorder, preparedUri.current);
      void stopRecorder().catch(() => {}).finally(() => {
        discardRecording(abandoned); discardRecording(recorderUri(recorder, abandoned)); void resetRecordingAudio().catch(() => {});
      });
      setUri(null); setRecording(false);
    };
    if (!focused) exit();
    const reset = onUserScopeReset(exit);
    const app = AppState.addEventListener('change', state => {
      if (state !== 'active') exit();
      else { active.current = focused; if (!operation.current) setBusy(false); }
    });
    return () => { exit(); reset(); app.remove(); };
  }, [clip, recorder, player, focused, french]);
  useEffect(() => () => { playback.current++; releaseDailyPlayback(player); }, [voice, player]);
  const record = async () => {
    if (!active.current || operation.current) return;
    operation.current = true; setBusy(true);
    const ticket = clip.ticket();
    try {
      playback.current++; releaseDailyPlayback(player);
      if (recording) await finish();
      else {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!active.current || !clip.current(ticket)) return;
        if (!permission.granted) { setNote('Microphone access is needed for a take. You can still practise aloud.'); return; }
        clip.replace(); setUri(null);
        micHold.current?.(); micHold.current = holdMic();
        await enterRecording();
        if (!active.current || !clip.current(ticket)) { await resetRecordingAudio(); return; }
        preparedUri.current = recorderUri(recorder, preparedUri.current);
        await recorder.prepareToRecordAsync();
        preparedUri.current = recorderUri(recorder, preparedUri.current);
        if (!active.current || !clip.current(ticket)) {
          await stopRecorder().catch(() => {}); discardRecording(recorderUri(recorder, preparedUri.current));
          await resetRecordingAudio(); return;
        }
        recorder.record(); setRecording(true); setNote('Recording a fresh practice take, up to 20 seconds.');
        timer.current = setTimeout(() => { void finish(); }, 20000);
      }
    } catch {
      await stopRecorder().catch(() => {}); discardRecording(recorderUri(recorder, preparedUri.current));
      await resetRecordingAudio().catch(() => {});
      if (active.current && clip.current(ticket)) { setRecording(false); setNote('Recording could not start. You can still practise aloud.'); }
    } finally { operation.current = false; if (active.current && clip.current(ticket)) setBusy(false); }
  };
  const play = async (own: boolean) => {
    if (!active.current || recording || operation.current) return;
    const source = own ? clip.uri : asset;
    if (source == null) return;
    const ticket = clip.ticket(); const playTicket = ++playback.current;
    try {
      claimDailyPlayback(player);
      await enterVoicePlayback();
      if (!active.current || !clip.current(ticket) || playTicket !== playback.current || !ownsDailyPlayback(player)) return;
      player.replace(typeof source === 'string' ? { uri: source } : source); player.setPlaybackRate(1); player.play();
    } catch { if (active.current && clip.current(ticket)) setNote('Audio could not play. Please try again.'); }
  };
  return <View style={{ gap: space(3), marginTop: space(4) }}>
    <Text style={[type.heading, { color: paper.ink }]}>A fresh practice take</Text>
    <Text {...frenchText} style={[type.frenchLg, { color: paper.ink }]}>{french}</Text>
    <Text style={[type.small, { color: paper.inkSoft }]}>This is new practice, separate from your conversation. Nothing is judged or uploaded. Your clip is deleted when you leave this page.</Text>
    {asset != null ? <IconAction layout="inline" icon="speaker" label="Hear my tutor" disabled={busy || recording} onPress={() => void play(false)} /> : <Text style={[type.small, { color: paper.inkSoft }]}>This word has no recording from your chosen tutor yet. You can still record and hear your own take.</Text>}
    <OutlineButton label={busy ? 'One moment…' : recording ? 'Finish recording' : uri ? 'Record another take' : 'Record my practice take'} disabled={busy} onPress={() => void record()} />
    {uri && !recording && <IconAction layout="inline" icon="speaker" label="Hear my practice take" disabled={busy} onPress={() => void play(true)} />}
    {note !== '' && <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.ink }]}>{note}</Text>}
  </View>;
}
