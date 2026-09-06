/**
 * The card for a learner who cannot think of anything to talk about.
 *
 * It draws one situation out of the authored pool, with three lines they could
 * actually say in it, and three ways forward: another suggestion, a drill over
 * the phrases they already have, or the conversation itself.
 *
 * The mockup fills this card with a solid violet button. It is an outline here
 * instead, decided by the founder: Practice keeps exactly one primary action,
 * the next step, and a second solid pill on the same screen would put the eye
 * in two places. The card is no quieter for it, because it is the only thing
 * on screen with three doors.
 */

import { View, Text, StyleSheet } from 'react-native';
import type { DailyScenario } from '@luvani/core';
import { ArrowRight, Card, Label, OutlineButton } from '../components.tsx';
import { MissionDisc } from '../missions/MissionDisc.tsx';
import { paper, radius, space, type } from '../theme.ts';
import { SUGGESTION } from './suggestion.ts';

export function ScenarioCard({
  scenario,
  checking,
  onAnother,
  onDrill,
  onTutor,
}: {
  scenario: DailyScenario;
  checking: boolean;
  onAnother: () => void;
  /** Null when the deck is empty, so the door is not drawn onto nothing. */
  onDrill: (() => void) | null;
  onTutor: () => void;
}) {
  return (
    <Card style={st.card}>
      <Text style={st.title}>{SUGGESTION.title}</Text>
      <Text style={st.blurb}>{SUGGESTION.blurb}</Text>

      {/* On the page's own paper, so the suggestion reads as something lifted
          out of the card rather than another paragraph of it. The same inset
          Home's situation card uses, for the same reason. */}
      <View style={st.inset}>
        <View style={st.insetHead}>
          <MissionDisc place={scenario.place} size={48} />
          <View style={st.insetWords}>
            <Label>{SUGGESTION.suggested}</Label>
            <Text style={st.scenarioTitle}>{scenario.titleEn}</Text>
            <Text style={st.scenarioFr}>{scenario.titleFr}</Text>
          </View>
        </View>

        <Text style={st.body}>{scenario.bodyEn}</Text>

        {/* The learner's own side of the scene, three beats of it. They wrap
            onto further lines rather than being cut off: a real French
            sentence at this size is wide, and the card may get taller. */}
        <View style={st.lines}>
          {scenario.lines.map((line) => (
            <View key={line.fr} style={st.line}>
              <Text style={st.lineFr}>{line.fr}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* The mockup's footer: the wide action, then two side by side. They are
          all outlines, because the tab's one primary pill is the next step and
          a second solid button would put the eye in two places at once. */}
      <View style={st.actions}>
        <OutlineButton label={SUGGESTION.another} onPress={onAnother} />
        <View style={st.pair}>
          {onDrill !== null && (
            <View style={st.half}>
              <OutlineButton label={SUGGESTION.drill} onPress={onDrill} />
            </View>
          )}
          <View style={st.half}>
            <OutlineButton
              label={SUGGESTION.tutor}
              icon={<ArrowRight size={18} color={paper.ink} />}
              disabled={checking}
              onPress={onTutor}
            />
          </View>
        </View>
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  card: { padding: space(4) },
  title: { ...type.title, color: paper.ink },
  blurb: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  inset: {
    marginTop: space(4),
    padding: space(3),
    backgroundColor: paper.ground,
    borderRadius: radius.chip,
  },
  insetHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  insetWords: { flex: 1, minWidth: 0 },
  scenarioTitle: { ...type.bodyStrong, color: paper.ink, marginTop: space(1) },
  scenarioFr: { ...type.french, color: paper.inkSoft, marginTop: space(1) },
  body: { ...type.small, color: paper.inkSoft, marginTop: space(3) },
  lines: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  // `flexShrink` so a long line narrows and wraps inside its own chip rather
  // than running off the card, exactly as the momentum hero's chips do.
  line: {
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: paper.card,
    borderRadius: radius.chip,
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
  },
  lineFr: { ...type.frenchSm, color: paper.ink },
  actions: { marginTop: space(4), gap: space(2) },
  pair: { flexDirection: 'row', gap: space(2) },
  // `minWidth: 0` is what lets a half shrink at the largest reading size rather
  // than pushing its neighbour off the card.
  half: { flex: 1, minWidth: 0 },
});
