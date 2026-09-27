/**
 * The free-conversation end card, sibling of SummaryScreen (F552, F584).
 *
 * It used to list everything: twelve phrases, four fixes, every win. It is a
 * closure now, decided in `conversationPacks/closure.ts` and drawn by
 * `ConversationPackCard`: what went well, three phrases worth keeping, one
 * repair, one thing to tune, and the next situation, waiting on Home.
 *
 * Revamp A changed two things about the head of it. The postcard is the
 * registry's raster scene rather than the vector drawing, so the end of a
 * conversation and the end of a lesson show the same picture at the same size,
 * and the line under the headline is `tutor/recapLine.ts` in words. The digits
 * it replaces were the app's only percentage: "6 turns · 70% on your own", on
 * the screen a learner reaches at the moment they decide whether they are any
 * good at this.
 *
 * Whole-app Stage 3A (2026-09-25) set the reading order: what went well, one
 * thing to try, the phrase to practise, Done. The other phrases, the small fix
 * and the next step are all still here, one tap away under a closed More. A
 * sound focus leads with the drill's two words; its notation is a detail the
 * learner opens.
 *
 * The closure is built from the live recap the moment it arrives, so the
 * card never waits on a disk, and the focus and the next situation fill in
 * once the three reads answer. The one visible keepsake is persisted exactly
 * before this card calls it saved; the rest of practice is still the curated
 * few that ConvoScreen banks when the agent delivers them.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { missionStates, type RecapPayload } from '@luvani/core';

import { accent, HAIRLINE, HIT, paper, radius, signal, space, type } from './theme.ts';
import { BookmarkGlyph, Card, GhostButton, Label, OutlineButton, PillButton, TintPanel } from './components.tsx';
import { Art } from './art/Art.tsx';
import { SCREEN_ART } from './art/maps.ts';
import { ConversationPackCard, NEXT_WAITING } from './conversationPacks/ConversationPackCard.tsx';
import { SOUND_DETAIL, exampleFirstHeading } from './tutor/soundExample.ts';
import { MAX_CLOSURE_PHRASES, closureFromRecap, type ClosureContext } from './conversationPacks/closure.ts';
import { missionCompletionsFrom } from './missions/chooserView.ts';
import { loadMissionCompletions } from './missions/store.ts';
import { loadDeck } from './review/store.ts';
import { loadSoundChecks } from './soundcheck/store.ts';
import { recapLine } from './tutor/recapLine.ts';

export interface RecapPracticePhrase {
  fr: string;
  en: string;
  situation: string;
}

export function RecapScreen({
  recap,
  onDone,
  onPractice,
  onSave,
}: {
  recap: RecapPayload;
  onDone: () => void;
  /** Opens the existing own-words drill with a phrase this conversation earned. */
  onPractice?: (phrase: RecapPracticePhrase) => void;
  /** Persists the exact keepsake phrase and answers only when the write is durable. */
  onSave: (phrase: RecapPracticePhrase) => Promise<boolean>;
}) {
  const insets = useSafeAreaInsets();
  // Null until the reads answer: the closure draws at once from the recap,
  // and the focus and the next situation arrive a beat later.
  const [context, setContext] = useState<ClosureContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadMissionCompletions(), loadDeck(), loadSoundChecks()])
      .then(([completions, deck, checks]) => {
        if (cancelled) return;
        setContext({ progress: missionStates(missionCompletionsFrom(completions), deck, Date.now()), deck, checks });
      })
      .catch(() => {
        // A disk that will not answer leaves the recap as it arrived. Nothing
        // on it is a claim about the learner that a failed read could falsify.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const closure = closureFromRecap(recap, context);
  // Pick the keepsake from the recap alone, so a later deck read cannot swap the
  // phrase after the save has started. The enriched closure may reorder phrases
  // to prefer something new; remove this exact key wherever it lands and keep
  // the original three-phrase ceiling across the keepsake and the rows below.
  const keptPhrase = closureFromRecap(recap, null).phrases[0] ?? null;
  const otherPhrases = closure.phrases.filter((phrase) => phrase.key !== keptPhrase?.key).slice(0, MAX_CLOSURE_PHRASES - 1);
  // Stage 3A: the lead is what went well and one focus. A sound focus is said
  // with the drill's own two words first; the notation is an optional detail.
  const leadFocus =
    closure.focus !== null && closure.focus.kind === 'sound'
      ? { ...closure.focus, acoustic: { ...closure.focus.acoustic, heading: exampleFirstHeading(closure.focus.acoustic, closure.focus.example) } }
      : closure.focus;
  const leadClosure = { ...closure, summary: '', phrases: [], repair: null, nextMission: null, focus: leadFocus };
  const hasMore = otherPhrases.length > 0 || closure.repair !== null || closure.nextMission !== null;
  const [more, setMore] = useState(false);
  const [soundDetail, setSoundDetail] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const situation = closure.title;
  const retrySave = () => {
    if (keptPhrase === null || saveState === 'saving') return;
    setSaveState('saving');
    void onSave({ fr: keptPhrase.fr, en: keptPhrase.en, situation })
      .then((saved) => setSaveState(saved ? 'saved' : 'failed'))
      .catch(() => setSaveState('failed'));
  };

  useEffect(() => {
    if (keptPhrase === null) {
      setSaveState('idle');
      return;
    }
    let cancelled = false;
    setSaveState('saving');
    void onSave({ fr: keptPhrase.fr, en: keptPhrase.en, situation })
      .then((saved) => {
        if (!cancelled) setSaveState(saved ? 'saved' : 'failed');
      })
      .catch(() => {
        if (!cancelled) setSaveState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [keptPhrase?.en, keptPhrase?.fr, keptPhrase?.key, onSave, situation]);

  const saveLine =
    saveState === 'saved'
      ? 'Saved to My French'
      : saveState === 'failed'
        ? 'Not saved yet'
        : 'Saving to My French';

  return (
    <View style={[st.root, { paddingTop: insets.top + space(2) }]}>
      <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + space(8) }]} showsVerticalScrollIndicator={false}>
        {/* ── something arrived in the mail ──────────────────────────── */}
        <View style={st.header}>
          <Art name={SCREEN_ART.recap} />
          <View style={st.headerText}>
            <Text accessibilityRole="header" style={[type.display, { color: paper.ink, textAlign: 'center' }]}>
              {recap.headline}
            </Text>
            {keptPhrase !== null ? (
              <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center' }]}>{situation}</Text>
            ) : null}
            {/* How it went, in a sentence. See tutor/recapLine.ts for why the
                old score-like arithmetic is gone. */}
            <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center' }]}>{recapLine(recap.stats)}</Text>
          </View>
        </View>

        {/* What went well, and the one thing to try. */}
        <ConversationPackCard closure={leadClosure} />

        {closure.focus !== null && closure.focus.kind === 'sound' && (
          <View>
            <Pressable
              onPress={() => setSoundDetail((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: soundDetail }}
              style={({ pressed }) => [st.disclosure, pressed && st.pressed]}
            >
              <Text style={[type.small, { color: paper.ink }]}>{soundDetail ? SOUND_DETAIL.hide : SOUND_DETAIL.show}</Text>
            </Pressable>
            {soundDetail && <Text style={[type.notation, { color: paper.inkSoft }]}>{closure.focus.acoustic.heading}</Text>}
          </View>
        )}

        {keptPhrase !== null ? (
          <View style={st.keptStack}>
            <Label>A phrase to take with you</Label>
            <TintPanel tint="lilac" style={st.keptCard}>
              <View style={st.keptCopy}>
                <Text style={[type.frenchLg, { color: paper.ink }]}>{keptPhrase.fr}</Text>
                <Text style={[type.body, { color: paper.inkSoft }]}>{keptPhrase.en}</Text>
              </View>
              <View style={st.keptMark}>
                <BookmarkGlyph size={22} color={signal.good} />
              </View>
            </TintPanel>

            <TintPanel tint="rose" style={st.savedLine}>
              <BookmarkGlyph size={18} color={paper.ink} />
              <Text accessibilityLiveRegion="polite" style={[type.bodyStrong, { color: paper.ink }]}>{saveLine}</Text>
            </TintPanel>

            {saveState === 'failed' && <OutlineButton label="Try saving again" onPress={retrySave} />}
            {onPractice !== undefined ? (
              <PillButton
                label="Practise this phrase"
                onPress={() => onPractice({ fr: keptPhrase.fr, en: keptPhrase.en, situation })}
                accessibilityLabel={`Practise ${keptPhrase.fr}`}
              />
            ) : null}
          </View>
        ) : null}

        <GhostButton label="Finish conversation" onPress={onDone} />

        {/* Everything else the closure chose, one tap away and closed by
            default: the other phrases, the small fix and the next step. Drawn
            after Done so opening it never pushes the way out down the screen. */}
        {hasMore && (
          <View>
            <Pressable
              onPress={() => setMore((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={more ? 'Hide more from this conversation' : 'More from this conversation'}
              accessibilityState={{ expanded: more }}
              style={({ pressed }) => [st.disclosure, pressed && st.pressed]}
            >
              <Text style={[type.small, { color: paper.ink }]}>{more ? 'Show less' : 'More'}</Text>
            </Pressable>
            {more && (
              <View style={st.more}>
                {otherPhrases.length > 0 && (
                  <View>
                    <Label>New phrases</Label>
                    <Card style={st.section}>
                      <View style={{ gap: space(3) }}>
                        {otherPhrases.map((phrase, index) => (
                          <View key={phrase.key} style={index > 0 ? st.divider : undefined}>
                            <Text style={[type.french, { color: paper.ink }]}>{phrase.fr}</Text>
                            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{phrase.en}</Text>
                          </View>
                        ))}
                      </View>
                    </Card>
                  </View>
                )}
                {closure.repair !== null && (
                  <View>
                    <Label color={signal.correspondance}>Small fixes</Label>
                    <Card style={st.section}>
                      <Text style={[type.small, { color: paper.inkSoft }]}>« {closure.repair.quote} »</Text>
                      <Text style={[type.french, { color: paper.ink, marginTop: space(1) }]}>{closure.repair.better}</Text>
                      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{closure.repair.betterEn}</Text>
                      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{closure.repair.why}</Text>
                    </Card>
                  </View>
                )}
                {closure.nextMission !== null && (
                  <View>
                    <Label color={signal.correspondance}>Next step</Label>
                    <Card style={st.section}>
                      <Text style={[type.title, { color: paper.ink }]}>{closure.nextMission.mission.title}</Text>
                      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(0.5) }]}>{closure.nextMission.mission.titleEn}</Text>
                      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{NEXT_WAITING}</Text>
                    </Card>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground },
  scroll: { flexGrow: 1, alignSelf: 'stretch', maxWidth: 760, marginHorizontal: 'auto', paddingHorizontal: space(5), paddingTop: space(3), gap: space(5) },
  header: { alignItems: 'center', padding: space(5), backgroundColor: accent.feature, borderWidth: HAIRLINE, borderColor: paper.ink, borderRadius: radius.card },
  headerText: { alignItems: 'center', gap: space(2), marginTop: space(4) },
  keptStack: { gap: space(3) },
  keptCard: {
    minHeight: 132,
    borderRadius: radius.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    padding: space(5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(4),
  },
  keptCopy: { flex: 1, gap: space(1) },
  keptMark: {
    width: 48,
    height: 48,
    borderRadius: radius.row,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.lineOnCard,
  },
  disclosure: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  more: { gap: space(7), marginTop: space(3) },
  section: { marginTop: space(2) },
  divider: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard, paddingTop: space(3) },
  savedLine: {
    minHeight: 48,
    alignSelf: 'center',
    paddingHorizontal: space(5),
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
});
