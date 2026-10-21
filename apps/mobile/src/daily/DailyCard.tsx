/**
 * One daily word or phrase: the French, the English, the tutor's recording, a
 * save, and a way to say it.
 *
 * Nothing here moves. The tutor's audio leads the French on Today and in the
 * library. Decorative daily drawings and their selector are retired.
 *
 * Two looks, one owner of the audio. `full` is the library card. `today` is
 * Today's lavender card (2026-10-20, B5, B-Today): "Today's phrase", the
 * French with a play disc that stops what it started, the English, and one
 * white "Say it yourself", which is the library's "Say it". It has no example
 * and never states the audio line, so a phrase with no recording still reads
 * and still opens its practice.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { IconButton, Card, IconAction, Label } from '../components.tsx';
import { space, type } from '../theme.ts';
import { loadBookmarks, setBookmark } from '../bookmarks/store.ts';
import { TUTOR_DAILY_AUDIO } from './tutorAudioManifest.ts';
import { dailyTutorVoice, tutorAudioFor } from './tutorAudio.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { PhraseCard } from '../today/TodayParts.tsx';
import type { DailyItem } from './catalogue.ts';
import { claimDailyPlayback, releaseDailyPlayback, ownsDailyPlayback } from './playback.ts';
import { audioLine } from './libraryView.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { enterVoicePlayback } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';
import { useB } from '../main/bTheme.tsx';

export function DailyCard({ item, reveal = true, onSaved, compact = false, embedded = false, variant = 'full' }: {
  item: DailyItem; reveal?: boolean; onSaved?: (id: string, saved: boolean) => void; compact?: boolean; embedded?: boolean; variant?: 'full' | 'today';
}) {
  const t = useB();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const focused = useIsFocused();
  const { profile } = useProfile();
  const tutorVoice = dailyTutorVoice(profile.tutorVoice);
  const tutorName = tutorNameOf(profile);
  const asset = tutorAudioFor(TUTOR_DAILY_AUDIO, item.id, tutorVoice);
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  useVoiceHold(status.playing);
  const owner = scopeGeneration();
  const [saveRead, setSaveRead] = useState<{ owner: number; saved: boolean } | null>(null);
  const saved = saveRead?.owner === owner ? saveRead.saved : null;
  const [saveUnread, setSaveUnread] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(reveal);
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(!compact);
  const active = useRef(focused);
  const playTicket = useRef(0);
  const lastOwner = useRef(owner);
  useEffect(() => { if (lastOwner.current !== owner) { lastOwner.current = owner; setBusy(false); } }, [owner]);
  useEffect(() => {
    let live = true;
    setShown(reveal); setSaveRead(null); setSaveUnread(false);
    if (focused) void loadBookmarks().then(rows => {
      if (live && owner === scopeGeneration()) setSaveRead({ owner, saved: rows.some(r => r.scenarioId === item.id && r.saved) });
    }).catch(() => { if (live && owner === scopeGeneration()) setSaveUnread(true); });
    return () => { live = false; };
  }, [item.id, reveal, focused, owner, readAttempt]);
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
      await enterVoicePlayback();
      if (!active.current || ticket !== playTicket.current || !ownsDailyPlayback(player)) return;
      player.pause(); player.replace(asset); player.setPlaybackRate(slow ? 0.75 : 1); player.play(); setNote('');
    } catch { setNote('Audio could not play. Please try again.'); }
  };
  const save = async () => {
    if (busy || saved === null || owner !== scopeGeneration()) return;
    setBusy(true);
    try {
      await setBookmark(item.id, !saved);
      if (owner !== scopeGeneration() || !active.current) return;
      const rows = await loadBookmarks();
      if (owner !== scopeGeneration() || !active.current) return;
      const actual = rows.some(r => r.scenarioId === item.id && r.saved);
      if (actual === saved) setNote('That save did not finish. Please try again.');
      else {
        setSaveRead({ owner, saved: actual }); onSaved?.(item.id, actual);
        setNote(actual ? 'Saved in Progress, Daily collection.' : 'Removed from your daily collection.');
      }
    } catch {
      if (owner === scopeGeneration() && active.current) {
        setSaveRead(null); setSaveUnread(true);
        setNote('');
      }
    } finally { if (owner === scopeGeneration()) setBusy(false); }
  };
  const retrySaveRead = () => setReadAttempt(value => value + 1);
  const saveFailure = saveUnread && <View style={{ gap: space(1) }}>
    <Text accessibilityLiveRegion="polite" style={[type.small, { color: t.muted }]}>Save status unavailable. You can still hear and practise this phrase.</Text>
    <IconAction layout="inline" icon="refresh" label="Retry save status" onPress={retrySaveRead} />
  </View>;
  // Stop this card's recording before the practice screen opens, so the
  // learner hears their own attempt and not the tutor under it.
  const sayIt = () => { playTicket.current++; releaseDailyPlayback(player); nav.navigate('DailyPractice', { id: item.id }); };
  // The disc stops what it started, and the stop spends the ticket the way
  // a blur does, so nothing queued behind it can start the sound again.
  const toggle = () => { if (status.playing) { playTicket.current++; releaseDailyPlayback(player); } else void play(); };
  const contents = <View style={{ gap: space(2) }}>
    <Label>{item.label}</Label>
    {!shown ? <><Text style={[type.body, { color: t.text }]}>{item.en}</Text><IconAction layout="inline" icon="eye" label="Try it from memory, then reveal" onPress={() => setShown(true)} /></> : <>
      {/* The library states audio availability before the first listen. */}
      {!embedded && <Text style={[type.small, { color: t.muted }]}>{audioLine(asset != null)}</Text>}
      {asset != null && <IconAction layout="inline" icon="speaker" label="Hear"  onPress={() => void play()} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <View style={{ flex: 1, minWidth: 0 }}><Text selectable={!embedded} style={[compact ? type.french : type.frenchLg, { color: t.text }]}>{item.fr}</Text><Text selectable={!embedded} style={[type.small, { color: t.muted, marginTop: space(1) }]}>{item.en}</Text></View>
      </View>
      {(!compact || !item.exampleFr || expanded) && <Text selectable={!embedded} style={[type.small, { color: t.muted }]}>{item.note}</Text>}
      {item.exampleFr ? <><Text selectable={!embedded} style={[type.frenchSm, { color: t.text }]}>{item.exampleFr}</Text>{expanded && <Text selectable={!embedded} style={[type.small, { color: t.muted }]}>{item.exampleEn}</Text>}</> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        <IconButton icon="bookmark" label={busy ? 'Saving…' : saved === null ? saveUnread ? 'Save unavailable' : 'Checking save…' : saved ? 'Saved ✓' : 'Save'} disabled={saved === null || busy} onPress={() => void save()} />
        {compact && <IconAction layout="inline" icon="chevron-down" label={expanded ? 'Less' : 'More'} onPress={() => setExpanded(v => !v)} />}
        {expanded && <>{asset != null && <IconAction layout="inline" icon="speaker-slow" label="Slow replay" onPress={() => void play(true)} />}
          <IconAction layout="inline" icon="microphone" label="Say it" onPress={sayIt} /></>}
      </View>
    </>}
    {saveFailure}
    {note !== '' && <Text accessibilityLiveRegion="polite" style={[type.small, { color: t.muted }]}>{note}</Text>}
  </View>;
  // 2026-10-20, B5, B-Today: today's phrase on the lavender card. The caps
  // line, the French with its play disc (the tutor's bundled clip, which says
  // Stop while it sounds), the English, and one white "Say it yourself" that
  // stops the clip and opens the practice. Save and the collection stay on the
  // library card.
  if (variant === 'today') {
    // 2026-10-20 UI-008, artboard B-Today: the B lavender card, drawn by
    // today/TodayParts in both themes; the audio stays this card's.
    return <PhraseCard
      eyebrow="Today's phrase"
      fr={item.fr}
      en={item.en}
      hearLabel={`Hear ${tutorName} say it`}
      onHear={asset != null ? toggle : undefined}
      playing={status.playing}
      sayLabel="Say it yourself"
      sayAccessibilityLabel="Say today's phrase yourself"
      onSay={sayIt}
      note={note}
    />;
  }
  return embedded ? contents : <Card style={{ marginTop: space(3) }}>{contents}</Card>;
}
