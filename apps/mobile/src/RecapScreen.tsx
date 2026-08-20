/**
 * The free-conversation end card, sibling of SummaryScreen.
 *
 * Same discipline as the lesson's card: lead with what the learner did, show at
 * most a handful of gentle fixes, and name exactly one next step. Numbers are
 * allowed here and only here — mid-session copy never carries them.
 *
 * This card SHOWS everything; it banks nothing. What becomes practice is the
 * curated few — ConvoScreen banks them from the agent's practice message (or
 * its own leave fallback), so the deck gets the keepers, not the transcript.
 */

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RecapPayload } from '@parle/core';
import { paper, signal, space, type, HAIRLINE } from './theme.ts';
import { Card, Label, PillButton } from './components.tsx';
import { RecapPostcard } from './illustrations.tsx';

/** Fixes shown on the card. The agent already ranked them; we keep the top few. */
const MAX_FIXES = 4;

/**
 * A register label the learner can actually read: the French term is the
 * vocabulary being taught, the English gloss is the meaning. Taught vocabulary
 * keeps both halves even though the chrome around it is English.
 */
function registerTag(register: string): string {
  const en: Record<string, string> = {
    argot: 'slang',
    familier: 'casual',
    courant: 'everyday',
    soutenu: 'formal',
  };
  const gloss = en[register];
  return gloss ? `${register} · ${gloss}` : register;
}

export function RecapScreen({ recap, onDone }: { recap: RecapPayload; onDone: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[st.root, { paddingTop: insets.top + space(2) }]}>
      <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + space(8) }]} showsVerticalScrollIndicator={false}>
        {/* ── something arrived in the mail ──────────────────────────── */}
        <View style={st.header}>
          <RecapPostcard width={180} />
          <View style={st.headerText}>
            <Label>End of conversation</Label>
            <Text style={[type.title, { color: paper.ink, textAlign: 'center' }]}>{recap.headline}</Text>
            <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>
              {recap.stats.turns} turns · {Math.round(recap.stats.unassistedRate * 100)}% on your own
            </Text>
          </View>
        </View>

        {/* ── what they said that landed ─────────────────────────────── */}
        {recap.wins.length > 0 && (
          <View>
            <Label color={signal.good}>Your wins</Label>
            <Card style={st.sectionCard}>
              <View style={{ gap: space(2.5) }}>
                {recap.wins.map((w) => (
                  <Text key={w} style={[type.french, { color: paper.ink }]}>
                    « {w} »
                  </Text>
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* ── gentle fixes, their own words quoted back ──────────────── */}
        {recap.fixes.length > 0 && (
          <View>
            <Label color={signal.correspondance}>Small fixes</Label>
            <Card style={st.sectionCard}>
              <View style={{ gap: space(3) }}>
                {recap.fixes.slice(0, MAX_FIXES).map((f, i) => (
                  <View key={f.quote + f.better} style={i > 0 ? st.divider : undefined}>
                    <Text style={[type.small, { color: paper.inkSoft }]}>« {f.quote} »</Text>
                    <Text style={[type.french, { color: paper.ink, marginTop: space(1) }]}>{f.better}</Text>
                    <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{f.betterEn}</Text>
                    <Text style={[type.small, { color: paper.inkFaint, marginTop: space(0.5) }]}>{f.why}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* ── new phrases, with the register they belong to ──────────── */}
        {recap.phrases.length > 0 && (
          <View>
            <Label>New phrases</Label>
            <Card style={st.sectionCard}>
              <View style={{ gap: space(3) }}>
                {recap.phrases.map((p, i) => (
                  <View key={p.fr} style={i > 0 ? st.divider : undefined}>
                    <View style={st.phraseHead}>
                      <Text style={[type.french, { color: paper.ink, flex: 1 }]}>{p.fr}</Text>
                      <Text style={[type.small, { color: paper.inkFaint }]}>{registerTag(p.register)}</Text>
                    </View>
                    <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{p.en}</Text>
                  </View>
                ))}
              </View>
            </Card>
            <Text style={[type.small, { color: paper.inkFaint, marginTop: space(2.5) }]}>The best of these become practice on your path.</Text>
          </View>
        )}

        {/* ── exactly one next step, never a list ────────────────────── */}
        <View>
          <Label color={signal.correspondance}>Next step</Label>
          <Card style={st.sectionCard}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{recap.nextFocus}</Text>
          </Card>
        </View>

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
  sectionCard: { marginTop: space(2) },
  divider: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard, paddingTop: space(3) },
  phraseHead: { flexDirection: 'row', alignItems: 'baseline', gap: space(2) },
});
