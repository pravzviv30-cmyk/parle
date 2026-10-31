import { Illustration } from '../art/flat/Illustration.tsx';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Card, ColourCard, FrenchBlock, IconAction, PillButton } from '../components.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { TUTOR_OFFLINE } from '../tutor/gate.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { decorative, space, type } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';
import { deviceOnLine, localPracticeFor, offlineNotice, offlineOffer } from './localPractice.ts';

/**
 * Bundled reference audio and a temporary real take, never simulated speech.
 *
 * On Today (`vivid`, F924, 2026-10-29) it is the offline lead: it says so
 * first, with the offline art, and offers a re-check. The café line is a
 * Starter line and is labelled as one; a learner past Starter is pointed at
 * today's phrase and review below, which work offline, rather than handed it.
 */
export function LocalPracticeCard({ vivid = false, levelIndex = 0, bare = false }: { vivid?: boolean; levelIndex?: number; /** On Today's hero card (UI-015): no card of its own, so no card sits inside a card. */ bare?: boolean }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();
  const { recheck } = useLive();
  const [checking, setChecking] = useState(false);
  // 2026-10-21 UI-008: theme tokens. The white card follows the mode; the sun
  // ground is sun in both modes, so its words take onMint, the ink of both.
  const t = useB();
  const phrase = localPracticeFor(profile.tutorVoice, DAILY_ITEMS, TUTOR_DAILY_AUDIO);
  const offer = offlineOffer(levelIndex);
  if (vivid) return <OfflineLeadBody notice={offlineNotice(deviceOnLine())} cafe={offer === 'cafe' && phrase !== null} bare={bare} checking={checking}
    onTry={() => { if (phrase !== null) nav.navigate('DailyPractice', { id: phrase.id, mode: 'shadowing' }); }}
    onRecheck={() => { if (checking) return; setChecking(true); void recheck().catch(() => false).finally(() => setChecking(false)); }} />;
  if (phrase === null) return null;
  // Bare on Today's hero (UI-015) the same words sit on the card's ground, in its ink.
  const words = bare ? t.text : t.onMint;
  const body = <>
    <Text accessibilityRole="header" style={[type.heading, { color: words }]}>Order a coffee</Text>
    <FrenchBlock french={phrase.fr ?? ''} english={phrase.en} ground={bare ? 'white' : 'sun'} />
    <Text style={[type.small, { color: bare ? t.muted : words }]}>Hear, say and compare. Free offline practice. Your recording is temporary and is not graded.</Text>
    <PillButton label="Try this line" tone={bare ? undefined : 'ink'} onPress={() => nav.navigate('DailyPractice', { id: phrase.id, mode: 'shadowing' })} />
  </>;
  return bare ? <View style={{ gap: space(4) }}>{body}</View> : <ColourCard ground="sun">{body}</ColourCard>;
}

/**
 * Today's offline lead, props in (UI-015, shared with the dev preview): the
 * offline art and notice, the Starter café line when it is offered, else the
 * pointer to the phrase and review below, and the re-check.
 */
export function OfflineLeadBody({ notice, cafe, bare, checking, onTry, onRecheck }: { notice: string; cafe: boolean; bare: boolean; checking: boolean; onTry: () => void; onRecheck: () => void }) {
  const t = useB();
  return <View style={{ gap: space(4) }}>
    <View {...decorative} style={{ alignItems: 'center' }}><Illustration name="state-offline" fit="small" /></View>
    <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[type.bodyStrong, { color: t.text }]}>{notice}</Text>
    {cafe ? <>
      {bare
        ? <View style={{ gap: space(1) }}><Text style={[type.heading, { color: t.text }]}>At the café</Text><Text style={[type.small, { color: t.muted }]}>A Starter line: hear and try a first order. Free offline.</Text></View>
        : <Card style={{ gap: space(1) }}><Text style={[type.heading, { color: t.text }]}>At the café</Text><Text style={[type.small, { color: t.muted }]}>A Starter line: hear and try a first order. Free offline.</Text></Card>}
      <PillButton label="Try this line" onPress={onTry} />
    </> : <Text style={[type.body, { color: t.muted }]}>Your next scene comes back when you're online. Today's phrase and review below work without a connection.</Text>}
    <IconAction layout="inline" icon="refresh" busy={checking} disabled={checking} label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} onPress={onRecheck} />
  </View>;
}
