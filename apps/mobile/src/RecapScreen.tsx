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
 * The closure is built from the live recap the moment it arrives, so the
 * card never waits on a disk, and the focus and the next situation fill in
 * once the three reads answer. The one visible keepsake is persisted exactly
 * before this card calls it saved; the rest of practice is still the curated
 * few that ConvoScreen banks when the agent delivers them.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { missionStates, type RecapPayload } from '@luvani/core';

import { HAIRLINE, paper, radius, signal, space, type } from './theme.ts';
import { BookmarkGlyph, OutlineButton, PillButton, TintPanel } from './components.tsx';
import { Art } from './art/Art.tsx';
import { SCREEN_ART } from './art/maps.ts';
import { ConversationPackCard } from './conversationPacks/ConversationPackCard.tsx';
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
  const remainingClosure = {
    ...closure,
    summary: '',
    phrases: closure.phrases.filter((phrase) => phrase.key !== keptPhrase?.key).slice(0, MAX_CLOSURE_PHRASES - 1),
  };
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const situation = closure.title;

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
              <Text style={[type.title, { color: paper.inkSoft, textAlign: 'center' }]}>A phrase became yours.</Text>
            ) : null}
            {/* How it went, in a sentence. See tutor/recapLine.ts for why the
                old score-like arithmetic is gone. */}
            <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center' }]}>{recapLine(recap.stats)}</Text>
          </View>
        </View>

        {keptPhrase !== null ? (
          <View style={st.keptStack}>
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

            {onPractice !== undefined ? (
              <OutlineButton
                label="Practise this"
                onPress={() => onPractice({ fr: keptPhrase.fr, en: keptPhrase.en, situation })}
                accessibilityLabel={`Practise ${keptPhrase.fr}`}
              />
            ) : null}
          </View>
        ) : null}

        <ConversationPackCard closure={remainingClosure} />

        <PillButton label="Done for today" onPress={onDone} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground },
  scroll: { paddingHorizontal: space(5), paddingTop: space(3), gap: space(7) },
  header: { alignItems: 'center' },
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
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.lineOnCard,
  },
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
