import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EarGlyph, Label, OutlineButton } from '../components.tsx';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { accent, paper, radius, space, type, HIT } from '../theme.ts';
import { LEDGER, type Ledger } from './ledger.ts';

/**
 * The lines that became the learner's, with one of them given a name.
 *
 * The featured phrase is the summit of the evidence ladder made concrete: a
 * phrase the learner produced in a real conversation, printed large, with the
 * one claim its counters license. That is the whole answer to "no percentage,
 * no bar" that is not merely an absence. A number would have said the same
 * thing less well, and a bar would have needed a denominator this product does
 * not have.
 *
 * There is no mark beside a row on purpose. Every row here is at the same rung
 * by construction, so a mark would carry no information, and a rail of filled
 * and hollow marks is a fraction drawn instead of typed. `progress/passport.ts`
 * refuses the same shape for the same reason.
 *
 * The featured phrase can be heard. A line the learner produced once, weeks
 * ago, is a line they may no longer be sure of the sound of, and the whole
 * point of featuring it is that it is theirs. The voice is stopped on the way
 * out, because one that follows a learner onto another tab is F304.
 *
 * Every judgement is `ledger.ts`'s. This file picks styles.
 */
export function LedgerLane({ ledger, onOpenPhrases }: { ledger: Ledger; onOpenPhrases: () => void }) {
  useEffect(() => () => tutorVoice.stop(), []);
  const featured = ledger.featured;
  if (featured === null) return null;

  return (
    <View style={st.lane}>
      <Card>
        <Label>{LEDGER.featuredLabel}</Label>
        <View style={st.featured}>
          <View style={st.featuredWords}>
            <Text style={[type.frenchLg, { color: paper.ink }]}>{featured.front}</Text>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(1) }]}>{featured.back}</Text>
          </View>
          <Pressable
            onPress={() => tutorVoice.speak(featured.front)}
            accessibilityRole="button"
            accessibilityLabel={`Hear ${featured.front}`}
            style={({ pressed }) => [st.play, pressed && { opacity: 0.6 }]}
          >
            <EarGlyph size={20} color={paper.onInk} />
          </Pressable>
        </View>
        {featured.ipa !== '' && (
          <Text style={[type.notation, { color: paper.inkSoft, marginTop: space(1) }]}>{featured.ipa}</Text>
        )}
        <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(3) }]}>{featured.claim}</Text>
        {featured.note !== null && (
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>
            {LEDGER.noteLabel} {featured.note}
          </Text>
        )}
      </Card>

      {ledger.rows.length > 0 && (
        <Card style={{ marginTop: space(6) }}>
          <Label>{LEDGER.rowsLabel}</Label>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{LEDGER.rowsBlurb}</Text>
          {ledger.cadenceLine !== null && (
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{ledger.cadenceLine}</Text>
          )}
          <View style={st.rows}>
            {ledger.rows.map((row) => (
              <View key={row.id} style={st.row}>
                <Text style={[type.frenchSm, { color: paper.ink }]}>{row.front}</Text>
                <Text style={[type.small, { color: paper.inkSoft }]}>{row.back}</Text>
                {row.transferLine !== null && (
                  <Text style={[type.small, { color: paper.ink }]}>{row.transferLine}</Text>
                )}
              </View>
            ))}
          </View>
          {ledger.moreLine !== null && (
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>{ledger.moreLine}</Text>
          )}
          <View style={{ marginTop: space(4) }}>
            <OutlineButton label={LEDGER.door} onPress={onOpenPhrases} />
          </View>
        </Card>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  lane: { marginTop: space(6) },
  // The phrase and the way to hear it, side by side. The words take the room
  // and the control keeps its floor, so a long line wraps rather than squeezing
  // the button under the touch minimum.
  featured: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3), marginTop: space(2) },
  featuredWords: { flex: 1, minWidth: 0 },
  // The identity violet, because this is the one phrase the page is about. A
  // signal here would report a state, and the phrase is not a state.
  play: {
    width: HIT,
    height: HIT,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accent.primary,
  },
  rows: { marginTop: space(3), gap: space(3) },
  // A row is words only, so it needs no touch floor: nothing on it is a control.
  row: { gap: space(0.5) },
});
