import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { Card, GhostButton, OutlineButton } from '../components.tsx';
import { paper, type, space } from '../theme.ts';
import { discardRecording } from '../speech/discardRecording.ts';
import { addPhrases } from '../review/store.ts';
import { dailyItem } from './catalogue.ts';
import { TUTOR_DAILY_AUDIO } from './tutorAudioManifest.ts';
import { dailyTutorVoice, tutorAudioFor } from './tutorAudio.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { claimDailyPlayback, releaseDailyPlayback, ownsDailyPlayback } from './playback.ts';
import type { RootStackParamList } from '../nav/types.ts';

/** Local listen/record/compare. Recordings are never uploaded or graded. */
export function DailyPracticeScreen() {
  const goBack = useBackToHome();
  const nav = useNavigation<{ goBack: () => void; navigate: (screen: string) => void }>();
  const route = useRoute<RouteProp<RootStackParamList, 'DailyPractice'>>();
  const item = dailyItem(route.params.id);
  const { profile } = useProfile();
  const tutorVoice = dailyTutorVoice(profile.tutorVoice);
  const modelAsset = item ? tutorAudioFor(TUTOR_DAILY_AUDIO, item.id, tutorVoice) : undefined;
  const focused = useIsFocused();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const held = useRef<string | null>(null);
  const live = useRef(true);
  const generation = useRef(0);
  const playbackTicket = useRef(0);
  const operation = useRef(false);
  const finishing = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finish = (): Promise<void> => {
    if (finishing.current) return finishing.current;
    const ticket = generation.current;
    const work = (async () => {
    if (timer.current) clearTimeout(timer.current);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const recorded = recorder.uri;
    if (!live.current || ticket !== generation.current) { discardRecording(recorded); return; }
    held.current = recorded; setUri(recorded); setRecording(false);
    setNote(modelAsset != null ? 'Listen to your take and compare it with the model. This practice stays on your device.' : 'Listen to your take and practise the text again. This practice stays on your device.');
    })().finally(() => { finishing.current = null; });
    finishing.current = work;
    return work;
  };
  useEffect(() => {
    live.current = focused;
    if (focused && !operation.current) setBusy(false);
    const stop = () => {
      generation.current++;
      if (timer.current) clearTimeout(timer.current);
      releaseDailyPlayback(player);
      if (recorder.isRecording) void recorder.stop().catch(() => {}).finally(() => { discardRecording(recorder.uri); void setAudioModeAsync({ allowsRecording: false }).catch(() => {}); });
      discardRecording(held.current); held.current = null;
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
    if (operation.current || !live.current) return; operation.current = true; setBusy(true);
    const ticket = generation.current;
    try {
      playbackTicket.current++; releaseDailyPlayback(player);
      if (recording) await finish();
      else {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!live.current || ticket !== generation.current) return;
        if (!permission.granted) { setNote('Microphone access is needed to record. You can still listen and practise aloud.'); return; }
        discardRecording(held.current); held.current = null; setUri(null);
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (!live.current || ticket !== generation.current) { await recorder.stop(); discardRecording(recorder.uri); await setAudioModeAsync({ allowsRecording: false }); return; }
        recorder.record(); setRecording(true); setNote('Recording, up to 20 seconds.');
        timer.current = setTimeout(() => { void finish().catch(() => { setRecording(false); setNote('That take could not finish. Try again.'); }); }, 20000);
      }
    } catch { if (live.current) { setNote('Recording could not start. You can still practise aloud.'); setRecording(false); } await setAudioModeAsync({ allowsRecording: false }).catch(() => {}); }
    finally { operation.current = false; if (live.current) setBusy(false); }
  };
  const play = async (own = false) => {
    if (!item || recording || busy) return;
    const source = own ? uri : modelAsset;
    if (source == null) return;
    const ticket = generation.current;
    const playback = ++playbackTicket.current;
    try {
      claimDailyPlayback(player);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
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
  return <ScrollScreen bottom="inset" header={<ScreenHeader title="Say it in French" back={{ onPress: goBack }} />}>
    {item ? <Card><Text style={[type.frenchLg, { color: paper.ink }]}>{item.fr}</Text><Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>{item.en}</Text>
      <View style={{ gap: space(3), marginTop: space(4) }}>
        {modelAsset != null && <OutlineButton label="Hear the model" onPress={() => void play()} disabled={recording || busy} />}
        <OutlineButton label={busy ? 'One moment…' : recording ? 'Finish recording' : 'Record my take'} onPress={() => void record()} disabled={busy} />
        {uri && !recording && <OutlineButton label="Listen to my take" onPress={() => void play(true)} />}
        <Text style={[type.small, { color: paper.inkSoft }]}>{modelAsset != null ? 'Free offline practice. Compare the rhythm and sounds yourself; this does not assess pronunciation.' : 'Record and listen to your own take. Tutor audio is not in this pack yet. This practice does not assess pronunciation.'}</Text>
        <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>{note}</Text>
        <GhostButton label="Add to review and practise recall" onPress={() => void review()} />
      </View>
    </Card> : <Text>That item is not in this pack.</Text>}
  </ScrollScreen>;
}
