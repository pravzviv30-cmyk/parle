/**
 * One daily word or phrase: the French, the English, the tutor's recording, a
 * save, and a way to say it.
 *
 * Nothing here moves. The tutor's audio leads the French on Today and in the
 * library. Decorative daily drawings and their selector are retired.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Card, GhostButton, Label } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { loadBookmarks, setBookmark } from '../bookmarks/store.ts';
import { TUTOR_DAILY_AUDIO } from './tutorAudioManifest.ts';
import { dailyTutorVoice, tutorAudioFor } from './tutorAudio.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import type { DailyItem } from './catalogue.ts';
import { claimDailyPlayback, releaseDailyPlayback, ownsDailyPlayback } from './playback.ts';
import { audioLine } from './libraryView.ts';

export function DailyCard({ item, reveal = true, onSaved, compact = false, embedded = false }: {
  item: DailyItem; reveal?: boolean; onSaved?: (id: string, saved: boolean) => void; compact?: boolean; embedded?: boolean;
}) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const focused = useIsFocused();
  const { profile } = useProfile();
  const tutorVoice = dailyTutorVoice(profile.tutorVoice);
  const asset = tutorAudioFor(TUTOR_DAILY_AUDIO, item.id, tutorVoice);
  const player = useAudioPlayer();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(reveal);
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(!compact);
  const active = useRef(focused);
  const playTicket = useRef(0);
  useEffect(() => { let live = true; setShown(reveal); void loadBookmarks().then(rows => { if (live) setSaved(rows.some(r => r.scenarioId === item.id && r.saved)); }).catch(() => {}); return () => { live = false; }; }, [item.id, reveal, focused]);
  useEffect(() => { active.current = focused; setNote(''); return () => { active.current = false; playTicket.current++; releaseDailyPlayback(player); }; }, [focused, player, item.id, tutorVoice]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      active.current = focused && state === 'active';
      if (state !== 'active') { playTicket.current++; releaseDailyPlayback(player); }
    });
    return () => subscription.remove();
  }, [focused, player]);
  const play = async (slow = false) => {
    const ticket = ++playTicket.current;
    try {
      if (asset == null) { setNote('Audio is not in this pack yet. You can still practise the text.'); return; }
      claimDailyPlayback(player);
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, shouldPlayInBackground: false });
      if (!active.current || ticket !== playTicket.current || !ownsDailyPlayback(player)) return;
      player.pause(); player.replace(asset); player.setPlaybackRate(slow ? 0.75 : 1); player.play(); setNote('');
    } catch { setNote('Audio could not play. Please try again.'); }
  };
  const save = async () => {
    if (busy) return; setBusy(true);
    try { await setBookmark(item.id, !saved); const rows = await loadBookmarks(); const actual = rows.some(r => r.scenarioId === item.id && r.saved); if (actual === saved) setNote('That save did not finish. Please try again.'); else { setSaved(actual); onSaved?.(item.id, actual); setNote(actual ? 'Saved in My French, Daily collection.' : 'Removed from your daily collection.'); } }
    catch { setNote('That save did not finish. Please try again.'); } finally { setBusy(false); }
  };
  const contents = <View style={{ gap: space(2) }}>
    <Label>{item.label}</Label>
    {!shown ? <><Text style={[type.body, { color: paper.ink }]}>{item.en}</Text><GhostButton label="Try it from memory, then reveal" onPress={() => setShown(true)} /></> : <>
      {/* The library states audio availability before the first listen. */}
      {!embedded && <Text style={[type.small, { color: paper.inkSoft }]}>{audioLine(asset != null)}</Text>}
      {asset != null && <GhostButton label="Hear" color={paper.ink} onPress={() => void play()} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <View style={{ flex: 1, minWidth: 0 }}><Text selectable={!embedded} style={[compact ? type.french : type.frenchLg, { color: paper.ink }]}>{item.fr}</Text><Text selectable={!embedded} style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{item.en}</Text></View>
      </View>
      {(!compact || !item.exampleFr || expanded) && <Text selectable={!embedded} style={[type.small, { color: paper.inkSoft }]}>{item.note}</Text>}
      {item.exampleFr && <><Text selectable={!embedded} style={[type.frenchSm, { color: paper.ink }]}>{item.exampleFr}</Text>{expanded && <Text selectable={!embedded} style={[type.small, { color: paper.inkSoft }]}>{item.exampleEn}</Text>}</>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        <GhostButton label={busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save'} onPress={() => void save()} />
        {compact && <GhostButton label={expanded ? 'Less' : 'More'} onPress={() => setExpanded(v => !v)} />}
        {expanded && <>{asset != null && <GhostButton label="Slow replay" onPress={() => void play(true)} />}
          <GhostButton label="Say it" onPress={() => { playTicket.current++; releaseDailyPlayback(player); nav.navigate('DailyPractice', { id: item.id }); }} /></>}
      </View>
    </>}
    {note !== '' && <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft }]}>{note}</Text>}
  </View>;
  return embedded ? contents : <Card style={{ marginTop: space(3) }}>{contents}</Card>;
}
