/**
 * The free-conversation end card, sibling of SummaryScreen.
 *
 * Same discipline as the lesson's card: lead with what the learner did, show at
 * most a handful of gentle fixes, and name exactly one next step. Numbers are
 * allowed here and only here — mid-session copy never carries them.
 *
 * The conversation's new phrases join the review deck the moment this card
 * shows, so the free daily habit inherits what the paid minutes produced.
 */

import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RecapPayload } from '@parle/core';
import { enamel, signal, space, type, radius, HIT } from './theme.ts';
import { Plaque, Tag, LabeledTag, ArrowRight } from './components.tsx';
import { addPhrases } from './review/store.ts';

/** Fixes shown on the card. The agent already ranked them; we keep the top few. */
const MAX_FIXES = 4;

/**
 * A register label the learner can actually read: the French term is the
 * vocabulary being taught, the English gloss is the meaning — the same pairing
 * rule every other French label in the interface follows.
 */
function registerTag(register: string): string {
  const en: Record<string, string> = {
    argot: 'SLANG',
    familier: 'CASUAL',
    courant: 'EVERYDAY',
    soutenu: 'FORMAL',
  };
  const gloss = en[register];
  return gloss ? `${register.toUpperCase()} · ${gloss}` : register.toUpperCase();
}

export function RecapScreen({ recap, onDone }: { recap: RecapPayload; onDone: () => void }) {
  const insets = useSafeAreaInsets();

  // Fire and forget, the same contract as the lesson path's summary: the deck
  // write catches up in the background while the card shows.
  useEffect(() => {
    void addPhrases(recap.phrases);
  }, [recap]);

  return (
    <View style={[st.root, { paddingTop: insets.top + space(2) }]}>
      <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + space(8) }]} showsVerticalScrollIndicator={false}>
        <View>
          <LabeledTag fr="SORTIE" en="End of conversation" />
          <Text style={[type.plaqueSmall, { color: enamel.white, marginTop: space(2) }]}>{recap.headline}</Text>
          <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(1) }]}>
            {recap.stats.turns} turns · {Math.round(recap.stats.unassistedRate * 100)}% on your own
          </Text>
        </View>

        {/* ── what they said that landed ─────────────────────────────── */}
        {recap.wins.length > 0 && (
          <View style={st.wins}>
            <LabeledTag fr="VOS RÉUSSITES" en="Your wins" color={signal.good} />
            <View style={{ marginTop: space(2), gap: space(1.5) }}>
              {recap.wins.map((w) => (
                <Text key={w} style={[type.bodyStrong, { color: enamel.white }]}>
                  « {w} »
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* ── gentle fixes, their own words quoted back ──────────────── */}
        {recap.fixes.length > 0 && (
          <View>
            <LabeledTag fr="À AJUSTER" en="Small fixes" color={signal.correspondance} />
            <View style={{ marginTop: space(3), gap: space(2.5) }}>
              {recap.fixes.slice(0, MAX_FIXES).map((f) => (
                <View key={f.quote + f.better} style={st.fix}>
                  <View style={st.fixLine}>
                    <Text style={[type.body, { color: enamel.whiteMuted, flexShrink: 1 }]}>« {f.quote} »</Text>
                    <ArrowRight size={14} color={enamel.whiteFaint} />
                    <Text style={[type.bodyStrong, { color: enamel.white, flexShrink: 1 }]}>{f.better}</Text>
                  </View>
                  <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(1.5) }]}>{f.betterEn}</Text>
                  <Text style={[type.small, { color: enamel.whiteFaint, marginTop: space(0.5) }]}>{f.why}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── new phrases, with the register they belong to ──────────── */}
        {recap.phrases.length > 0 && (
          <View>
            <LabeledTag fr="NOUVELLES PHRASES" en="New phrases" color={enamel.whiteFaint} />
            <View style={{ marginTop: space(3), gap: space(2.5) }}>
              {recap.phrases.map((p) => (
                <View key={p.fr} style={st.phrase}>
                  <View style={st.phraseHead}>
                    <Text style={[type.bodyStrong, { color: enamel.white, flex: 1 }]}>{p.fr}</Text>
                    <Tag color={enamel.whiteFaint}>{registerTag(p.register)}</Tag>
                  </View>
                  <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(0.5) }]}>{p.en}</Text>
                </View>
              ))}
            </View>
            <Text style={[type.small, { color: enamel.whiteFaint, marginTop: space(2.5) }]}>These joined your review deck.</Text>
          </View>
        )}

        {/* ── exactly one next step, never a list ────────────────────── */}
        <Plaque raised>
          <LabeledTag fr="PROCHAINE ÉTAPE" en="Next step" color={signal.correspondance} />
          <Text style={[type.bodyStrong, { color: enamel.white, marginTop: space(2.5) }]}>{recap.nextFocus}</Text>
        </Plaque>

        <Pressable onPress={onDone} accessibilityRole="button" style={({ pressed }) => [st.done, pressed && { opacity: 0.8 }]}>
          <Text style={[type.tag, { color: enamel.white }]}>SORTIE · DONE</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: enamel.ground },
  scroll: { paddingHorizontal: space(5), paddingTop: space(3), gap: space(7) },
  wins: {
    borderLeftWidth: 1,
    borderLeftColor: signal.good,
    paddingLeft: space(3.5),
  },
  fix: {
    backgroundColor: enamel.field,
    borderRadius: radius.plaque,
    borderWidth: 1,
    borderColor: 'rgba(242,239,228,0.24)',
    padding: space(3.5),
  },
  fixLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(2) },
  phrase: {
    paddingBottom: space(2),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,239,228,0.1)',
  },
  phraseHead: { flexDirection: 'row', alignItems: 'baseline', gap: space(2) },
  done: {
    minHeight: HIT + 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: enamel.white,
    borderRadius: radius.plaque,
  },
});
