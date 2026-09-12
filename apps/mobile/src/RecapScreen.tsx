/**
 * The free-conversation end card, sibling of SummaryScreen (F552).
 *
 * It used to list everything: twelve phrases, four fixes, every win. It is a
 * closure now, decided in `conversationPacks/closure.ts` and drawn by
 * `ConversationPackCard`: what went well, three phrases worth keeping, one
 * repair, one thing to tune, and the next situation, waiting on Home.
 * Numbers are allowed here and only here; mid-session copy never carries them.
 *
 * The closure is built from the live recap the moment it arrives, so the
 * card never waits on a disk, and the focus and the next situation fill in
 * once the three reads answer. This card SHOWS everything; it banks nothing.
 * What becomes practice is the curated few, and ConvoScreen banks them.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { missionStates, type RecapPayload } from '@luvani/core';

import { paper, space, type } from './theme.ts';
import { PillButton } from './components.tsx';
import { RecapPostcard } from './illustrations.tsx';
import { ConversationPackCard } from './conversationPacks/ConversationPackCard.tsx';
import { closureFromRecap, type ClosureContext } from './conversationPacks/closure.ts';
import { missionCompletionsFrom } from './missions/chooserView.ts';
import { loadMissionCompletions } from './missions/store.ts';
import { loadDeck } from './review/store.ts';
import { loadSoundChecks } from './soundcheck/store.ts';

export function RecapScreen({ recap, onDone }: { recap: RecapPayload; onDone: () => void }) {
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

  return (
    <View style={[st.root, { paddingTop: insets.top + space(2) }]}>
      <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + space(8) }]} showsVerticalScrollIndicator={false}>
        {/* ── something arrived in the mail ──────────────────────────── */}
        <View style={st.header}>
          <RecapPostcard width={180} />
          <View style={st.headerText}>
            <Text style={[type.title, { color: paper.ink, textAlign: 'center' }]}>{recap.headline}</Text>
            <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>
              {recap.stats.turns} turns · {Math.round(recap.stats.unassistedRate * 100)}% on your own
            </Text>
          </View>
        </View>

        <ConversationPackCard closure={{ ...closure, summary: '' }} />

        <PillButton label="Done" onPress={onDone} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground },
  scroll: { paddingHorizontal: space(5), paddingTop: space(3), gap: space(7) },
  header: { alignItems: 'center' },
  headerText: { alignItems: 'center', gap: space(2), marginTop: space(4) },
});
