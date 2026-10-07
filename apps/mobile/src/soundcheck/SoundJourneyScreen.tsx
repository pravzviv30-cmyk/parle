/**
 * The focused sound journey (Stage 4, item 2), drawn.
 *
 * A pushed screen, reached from My French's sound row once `journey.ts` says
 * there is a journey at all. It reads the sound-check store itself, on every
 * focus, so coming back from a check shows that check. Every judgement is
 * `journey.ts`'s: which sound, how often, which lines, and whether a line came
 * back clear. This file only lays them out.
 *
 * A word leads and the symbol waits behind the same toggle the recap and the
 * lesson summary use. The one number on the page is how many measured checks
 * called the sound out. A record is not a task, so there is no primary pill:
 * each line is a row that opens the sound check for its own situation.
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getMission } from '@luvani/core';

import { MouthGuide } from '../practice/MouthGuide.tsx';
import { IconAction, Card, GhostButton, Label, Ledger, LedgerRow } from '../components.tsx';
import { WaveformGlyph } from '../glyphs.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { accent, HIT, paper, space, type } from '../theme.ts';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { SOUND_DETAIL, soundInWord } from '../tutor/soundExample.ts';
import type { SoundCheckEvidence } from './model.ts';
import { loadSoundChecks } from './store.ts';
import { JOURNEY_COPY, againLabel, calledOutLine, soundJourney } from './journey.ts';

/** The situation's name in the learner's language, or nothing for an id this build does not know. */
function situationName(id: string | undefined): string {
  return id === undefined ? '' : getMission(id)?.titleEn ?? '';
}

export function SoundJourneyScreen() {
  const nav = useNavigation<{
    goBack: () => void;
    canGoBack: () => boolean;
    navigate: (screen: string, params?: object) => void;
  }>();
  const [checks, setChecks] = useState<readonly SoundCheckEvidence[]>([]);
  // A read that has not answered and a read that failed are facts of their
  // own; neither may be drawn as a learner with no journey.
  const [status, setStatus] = useState<'loading' | 'ready' | 'unread'>('loading');
  const [readOwner, setReadOwner] = useState<{ scope: number; userId: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Bound to the account before the read, so a list from the previous
      // account is dropped rather than drawn for this one.
      const owner = { scope: scopeGeneration(), userId: activeUserId() };
      const sameAccount = (): boolean => !cancelled && scopeGeneration() === owner.scope && activeUserId() === owner.userId;
      setReadOwner(owner);
      setStatus('loading');
      void Promise.resolve().then(() => loadSoundChecks({ strict: true })).then(
        (stored) => {
          if (!sameAccount()) return;
          setChecks(stored);
          setStatus('ready');
        },
        () => {
          if (sameAccount()) setStatus('unread');
        },
      );
      return () => {
        cancelled = true;
      };
    }, [attempt]),
  );

  // A cold link has nothing behind it, and then the tabs are the way out.
  const leave = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs'));
  const ownerMatches = readOwner?.scope === scopeGeneration() && readOwner.userId === activeUserId();
  const shownStatus = ownerMatches ? status : 'loading';
  const journey = shownStatus === 'ready' ? soundJourney(checks, Date.now()) : null;

  return (
    <ScrollScreen header={<ScreenHeader back={{ onPress: leave }} />}>
      <Label>{JOURNEY_COPY.label}</Label>

      {shownStatus === 'loading' && <Text accessibilityLiveRegion="polite" style={st.soft}>{JOURNEY_COPY.loading}</Text>}

      {shownStatus === 'unread' && (
        <Card style={st.block}>
          <Text style={[type.body, { color: paper.ink }]}>{JOURNEY_COPY.unread}</Text>
          <IconAction layout="inline" icon="refresh" label={JOURNEY_COPY.retry}  onPress={() => { if (!ownerMatches) return; setStatus('loading'); setAttempt((n) => n + 1); }} />
        </Card>
      )}

      {/* Nothing measured yet: a quiet way to the situations that measure it. */}
      {shownStatus === 'ready' && journey === null && (
        <View style={st.block}>
          <Text style={st.soft}>{JOURNEY_COPY.none}</Text>
          <IconAction layout="inline" icon="map" label={JOURNEY_COPY.choose}  onPress={() => nav.navigate('Missions')} />
        </View>
      )}

      {shownStatus === 'ready' && journey !== null && (
        <>
          <Text accessibilityRole="header" style={st.heading}>{soundInWord(journey.example)}</Text>
          <Text style={st.soft}>{JOURNEY_COPY.purpose}</Text>
          <Text style={st.count}>{calledOutLine(journey.flaggedTimes, situationName(journey.situations[0]))}</Text>
          <MouthGuide ipa={journey.phoneme} />
          {journey.focus !== null && <Text style={st.soft}>{journey.focus}</Text>}

          {/* The notation, for whoever wants it. A beginner hears a word in
              their head and cannot hear a symbol. */}
          <Pressable
            onPress={() => setDetail((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: detail }}
            style={({ pressed }) => [st.disclosure, pressed && st.pressed]}
          >
            <Text style={[type.small, { color: paper.ink }]}>{detail ? SOUND_DETAIL.hide : SOUND_DETAIL.show}</Text>
          </Pressable>
          {detail && <Text style={[type.notation, { color: paper.inkSoft }]}>/{journey.phoneme}/</Text>}

          <View style={st.lines}>
            <Label>{JOURNEY_COPY.linesLabel}</Label>
            {journey.lines.map((line) => (
              <View key={`${line.missionId}\u0000${line.reference}`} style={st.line}>
                <Card>
                  <Text style={[type.french, { color: paper.ink }]}>{line.reference}</Text>
                  <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{situationName(line.missionId)}</Text>
                  {line.clearAt !== null && <Text style={[type.small, { color: paper.ink, marginTop: space(2) }]}>{JOURNEY_COPY.lineClear}</Text>}
                </Card>
                <Ledger>
                  <LedgerRow
                    glyph={<WaveformGlyph color={accent.primary} />}
                    title={againLabel(line, checks)}
                    gloss={situationName(line.missionId)}
                    onPress={() => nav.navigate('SoundCheck', { missionId: line.missionId })}
                  />
                </Ledger>
              </View>
            ))}
          </View>

          {journey.unmeasured > 0 && <Text style={st.soft}>{JOURNEY_COPY.unmeasured}</Text>}
        </>
      )}
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  heading: { ...type.frenchLg, color: paper.ink, marginTop: space(2) },
  soft: { ...type.body, color: paper.inkSoft, marginTop: space(3) },
  count: { ...type.bodyStrong, color: paper.ink, marginTop: space(3) },
  block: { marginTop: space(4), gap: space(2) },
  disclosure: { minHeight: HIT, justifyContent: 'center', marginTop: space(2) },
  pressed: { opacity: 0.6 },
  lines: { marginTop: space(5), gap: space(4) },
  line: { gap: space(2) },
});
