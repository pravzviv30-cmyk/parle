/**
 * The closure, drawn (F552).
 *
 * Six short sections, each from `closure.ts` and none decided here: what went
 * well, three phrases worth keeping, one repair, one thing to tune, and one
 * next situation. The four caps labels are the end card's own, kept as they
 * were because they name something no sentence under them says; the fifth
 * is new, for the focus. A section with nothing behind it is not drawn.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Label } from '../components.tsx';
import { HAIRLINE, paper, signal, space, type } from '../theme.ts';
import { arrived } from '../motion/haptics.ts';
import type { Closure } from './closure.ts';

export const NEXT_WAITING = 'It is waiting for you on Home.';

export function ConversationPackCard({ closure }: { closure: Closure }) {
  // Arriving somewhere earned: once, when the closure first draws.
  useEffect(() => {
    arrived();
  }, []);
  return (
    <View style={st.stack}>
      {closure.summary.length > 0 && <Text style={st.summary}>{closure.summary}</Text>}

      {closure.didWell.length > 0 && (
        <View>
          <Label color={signal.good}>Your wins</Label>
          <Card style={st.section}>
            <View style={{ gap: space(2.5) }}>
              {closure.didWell.map((win) => (
                <Text key={win} style={[type.french, { color: paper.ink }]}>« {win} »</Text>
              ))}
            </View>
          </Card>
        </View>
      )}

      {closure.phrases.length > 0 && (
        <View>
          <Label>New phrases</Label>
          <Card style={st.section}>
            <View style={{ gap: space(3) }}>
              {closure.phrases.map((phrase, index) => (
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

      {closure.focus !== null && (
        <View>
          <Label>One thing to tune</Label>
          <Card style={st.section}>
            {closure.focus.kind === 'sound' && (
              <>
                <Text style={[type.bodyStrong, { color: paper.ink }]}>{closure.focus.acoustic.heading}</Text>
                <Text style={[type.body, { color: paper.inkSoft, marginTop: space(1) }]}>{closure.focus.acoustic.cue}</Text>
              </>
            )}
            {closure.focus.kind === 'clarity' && <Text style={[type.bodyStrong, { color: paper.ink }]}>{closure.focus.line}</Text>}
            {closure.focus.kind === 'cadence' && (
              <>
                <Text style={[type.french, { color: paper.ink }]}>{closure.focus.fr}</Text>
                <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{closure.focus.en}</Text>
                <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{closure.focus.note}</Text>
              </>
            )}
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
  );
}

const st = StyleSheet.create({
  stack: { gap: space(7) },
  summary: { ...type.body, color: paper.ink, textAlign: 'center' },
  section: { marginTop: space(2) },
  divider: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard, paddingTop: space(3) },
});
