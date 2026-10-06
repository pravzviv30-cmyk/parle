import { Feedback } from '../motion/Feedback.tsx';
import { recorderUri } from './recorderUri.ts';
import { Illustration } from '../art/flat/Illustration.tsx';
import { finishLocalTake } from './finishLocalTake.ts';
import { recordActiveDay } from '../progress/activity.ts';
import { useActiveClock } from '../progress/useActiveClock.ts';
import { beginSettle, finishSettle, releaseSettle } from '../game/settle.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { AudioModule, RecordingPresets, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { Card, GhostButton, PillButton } from '../components.tsx';
import { paper, type, space, frenchText } from '../theme.ts';
import { discardRecording } from '../speech/discardRecording.ts';
import { addPhrases } from '../review/store.ts';
import { dailyItem } from './catalogue.ts';
import { TUTOR_DAILY_AUDIO } from './tutorAudioManifest.ts';
import { dailyTutorVoice, tutorAudioFor } from './tutorAudio.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { claimDailyPlayback, releaseDailyPlayback, ownsDailyPlayback } from './playback.ts';
import type { RootStackParamList } from '../nav/types.ts';
import { holdMic } from '../sound/audioFocus.ts';
import { enterRecording, enterVoicePlayback, leaveRecording } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';

/** Local listen/record/compare. Recordings are never uploaded or graded. */
export function DailyPracticeScreen() {
  const goBack = useBackToHome();
  const nav = useNavigation<{ goBack: () => void; navigate: (screen: string) => void }>();
  const route = useRoute<RouteProp<RootStackParamList, 'DailyPractice'>>();
  const item = dailyItem(route.params?.id ?? '');
  const shadowing = route.params?.mode === 'shadowing';
  const { profile } = useProfile();
  const tutorVoice = dailyTutorVoice(profile.tutorVoice);
  const modelAsset = item ? tutorAudioFor(TUTOR_DAILY_AUDIO, item.id, tutorVoice) : undefined;
  const focused = useIsFocused();
  // Today's phrase has no clock kind of its own, so it keeps review's 30 s
  // stretch (review finding 13): hearing, recording and finishing are the work.
  const clock = useActiveClock('review');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();
  useVoiceHold(useAudioPlayerStatus(player).playing);
  const preparedUri = useRef<string | null>(recorderUri(recorder, null));
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [daySaved, setDaySaved] = useState(false);
  const startedRecording = useRef<number | null>(null);
  const [completedTake, setCompletedTake] = useState(false);
  const held = useRef<string | null>(null);
  const live = useRef(true);
  const generation = useRef(0);
  const playbackTicket = useRef(0);
  const operation = useRef(false);
  const finishing = useRef<Promise<void> | null>(null);
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
  const finish = (): Promise<void> => {
    if (finishing.current) return finishing.current;
    const ticket = generation.current;
    const work = (async () => {
    if (timer.current) clearTimeout(timer.current);
    const recorded = await finishLocalTake({
      stop: stopRecorder, uri: () => recorderUri(recorder, preparedUri.current),
      resetAudio: resetRecordingAudio,
      current: () => live.current && ticket === generation.current,
      discard: discardRecording,
    });
    if (!live.current || ticket !== generation.current) return;
    held.current = recorded; setUri(recorded); setRecording(false);
    setCompletedTake(recorded !== null && startedRecording.current !== null && Date.now() - startedRecording.current >= 1000);
    setNote(modelAsset != null ? 'Hear your take, then the model. Your take stays on this device until you leave.' : 'Hear your take and practise the text again. Your take stays on this device until you leave.');
    })().catch(error => {
      if (live.current && ticket === generation.current) {
        held.current = null; setUri(null); setCompletedTake(false); setRecording(false);
      }
      throw error;
    }).finally(() => { finishing.current = null; });
    finishing.current = work;
    return work;
  };
  useLayoutEffect(() => {
    live.current = focused;
    if (focused && !operation.current) setBusy(false);
    const stop = () => {
      generation.current++;
      if (timer.current) clearTimeout(timer.current);
      releaseDailyPlayback(player);
      const abandoned = recorderUri(recorder, preparedUri.current);
      discardRecording(held.current); held.current = null;
      void stopRecorder().catch(() => {}).finally(() => { discardRecording(abandoned); discardRecording(recorderUri(recorder, abandoned)); void resetRecordingAudio().catch(() => {}); });
    };
    if (!focused) { stop(); setUri(null); setRecording(false); }
    const subscription = AppState.addEventListener('change', state => { live.current = focused && state === 'active'; if (live.current && !operation.current) setBusy(false); if (state !== 'active') { stop(); setUri(null); setRecording(false); } });
    return () => { live.current = false; if (timer.current) clearTimeout(timer.current); subscription.remove(); stop(); };
  }, [recorder, player, focused]);
  // A tutor change invalidates an awaiting model play without discarding a take.
  useEffect(() => {
    return () => { playbackTicket.current++; releaseDailyPlayback(player); };
  }, [tutorVoice, player, item?.id]);
  const record = async () => {
    if (operation.current || !live.current) return; operation.current = true; setBusy(true); clock.touch();
    const ticket = generation.current;
    try {
      playbackTicket.current++; releaseDailyPlayback(player);
      if (recording) await finish();
      else {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!live.current || ticket !== generation.current) return;
        if (!permission.granted) { setNote('Microphone access is needed to record. You can still listen and practise aloud.'); return; }
        discardRecording(held.current); held.current = null; setUri(null);
        micHold.current?.(); micHold.current = holdMic();
        await enterRecording();
        preparedUri.current = recorderUri(recorder, preparedUri.current);
        await recorder.prepareToRecordAsync();
        preparedUri.current = recorderUri(recorder, preparedUri.current);
        if (!live.current || ticket !== generation.current) { await stopRecorder(); discardRecording(recorderUri(recorder, preparedUri.current)); await resetRecordingAudio(); return; }
        startedRecording.current = Date.now(); setCompletedTake(false); recorder.record(); setRecording(true); setNote('Recording, up to 20 seconds.');
        timer.current = setTimeout(() => { void finish().catch(() => { setRecording(false); setNote('That take could not finish. Try again.'); }); }, 20000);
      }
    } catch { if (live.current) { setNote('Recording could not start. You can still practise aloud.'); setRecording(false); } await resetRecordingAudio().catch(() => {}); }
    finally { operation.current = false; if (live.current) setBusy(false); }
  };
  const play = async (own = false) => {
    if (!item || recording || busy) return;
    clock.touch();
    const source = own ? uri : modelAsset;
    if (source == null) return;
    const ticket = generation.current;
    const playback = ++playbackTicket.current;
    try {
      claimDailyPlayback(player);
      await enterVoicePlayback();
      if (!live.current || ticket !== generation.current || playback !== playbackTicket.current || !ownsDailyPlayback(player)) return;
      player.pause(); player.replace(typeof source === 'string' ? { uri: source } : source); player.setPlaybackRate(1); player.play();
    } catch { if (live.current) setNote('Audio could not play. Please try again.'); }
  };
  const review = async () => {
    if (!item || operation.current || recording) return; operation.current = true; setBusy(true);
    try {
      const ack = await addPhrases([{ fr: item.fr, en: item.en, frWritten: null, enLiteral: null, register: 'neutral', note: item.note }]);
      if (!live.current) return;
      if (ack === 'durable') { player.pause(); nav.navigate('Review'); } else setNote('Your phrase could not be saved yet. Please try again.');
    } catch { if (live.current) setNote('Your phrase could not be saved yet. Please try again.'); }
    finally { operation.current = false; if (live.current) setBusy(false); }
  };
  const completePractice = async () => {
    if (!item || !completedTake || recording || operation.current || daySaved || !live.current) return;
    operation.current = true; setBusy(true);
    const owner = scopeGeneration();
    try {
      // Finishing is the last piece of work. `at` names the sitting; the day is
      // read off the clock a moment later, and should the two ever fall either
      // side of midnight the settle also records the day `at` falls on.
      clock.touch();
      const at = Date.now();
      const settling = await beginSettle();
      const ack = await recordActiveDay();
      // The practice happened whether or not this screen is still showing, so
      // it settles on the durable day alone: a quest, the goal, the +5 (F744).
      if (ack === 'durable') void finishSettle(settling, { source: 'phrase', at, xpEarned: 0, activeMs: clock.read() });
      else releaseSettle(settling);
      if (!live.current || owner !== scopeGeneration()) return;
      if (ack === 'durable') { setDaySaved(true); setNote('This practice counts as a day of French. Your recording stays on this device until you leave.'); }
      else setNote('Your day could not be saved yet. Try finishing practice again.');
    } finally { operation.current = false; if (live.current && owner === scopeGeneration()) setBusy(false); }
  };
  return <ScrollScreen bottom="inset" header={<ScreenHeader title={shadowing ? 'Hear, say and compare' : 'A little French'} back={{ onPress: goBack }} />}>
    {item ? <View style={{gap:space(4)}}>
      <Card><Text {...frenchText} style={[type.frenchLg, { color: paper.ink }]}>{item.fr}</Text><Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>{item.en}</Text>
      <View style={{ gap: space(3), marginTop: space(4) }}>
        <Text style={[type.body, { color: paper.inkSoft }]}>Hear the model, record your take, then compare. Free offline practice. Your take is deleted when you leave. Nothing is graded.</Text>
        {modelAsset != null && <GhostButton label="Hear model" onPress={() => void play()} disabled={recording || busy} />}
        {(!completedTake || recording) && !daySaved && <PillButton label={busy ? 'One moment…' : recording ? 'Finish recording' : 'Record my take'} onPress={() => void record()} disabled={busy} />}
        {uri && !recording && <GhostButton label="Hear my take" onPress={() => void play(true)} />}
        {completedTake && uri && !recording && !daySaved && <GhostButton label="Try again" onPress={() => void record()} disabled={busy} />}
        {modelAsset == null && <Text style={[type.small, { color: paper.inkSoft }]}>Tutor audio is not in this pack yet. You can record and listen to your own take.</Text>}
        <Feedback kind="practised" active={daySaved}><Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>{daySaved ? 'Practised. Your take is temporary and ungraded.' : note}</Text></Feedback>
        {completedTake && !recording && !daySaved && <PillButton label="Finish practice" disabled={busy} onPress={() => void completePractice()} />}
        {daySaved && <PillButton label="Done" onPress={goBack} />}
        <GhostButton label="Add to review and practise recall" onPress={() => void review()} />
      </View>
    </Card>{shadowing && <Illustration name="state-headphones" fit="small" />}</View> : <View style={{gap:space(4)}}><Text style={type.body}>That item is not in this pack.</Text><PillButton label="Browse phrases" onPress={()=>nav.navigate('DailyLibrary')} /></View>}
  </ScrollScreen>;
}
