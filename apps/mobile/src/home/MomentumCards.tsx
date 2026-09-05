/**
 * Daily momentum, drawn.
 *
 * Two half tiles and one card, and not one of the words on them is written
 * here. `progress/momentum.ts` decides every count, every label, every unit and
 * every line, and each of its three parts is independently `null` when it has
 * nothing true to say. This file is three null gates and a stylesheet.
 *
 * That division is the whole point of the module. A tile that spelled its own
 * label would be a tile that could say "Days active" over a number that counted
 * something else, and there is no renderer in this workspace to notice.
 *
 * ## Green, and only for ground already covered
 *
 * The filled day marks, the speaking glyph, the weekly gain and the goal bar's
 * fill are `signal.good`, which means the same here as it means everywhere else
 * in the app: the learner produced French. The bar's fill is deliberately NOT
 * `accent.primary` — the violet is identity, the colour of the thing you press,
 * and a bar reporting how far along today is reports a state. A day that has
 * not happened is a hairline in `paper.line` and not a colour at all, on
 * TodayRow's rule that a thing which has not happened is not a state worth
 * signalling.
 *
 * ## Nothing at zero
 *
 * `hasMomentum` holds the whole block back, and each part holds itself back
 * inside that. A learner with no progress meets no tile, no empty rail and no
 * nudge to go and earn one. A rail of empty marks is a quota, and a quota you
 * have not met is guilt wearing a different hat.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card, FlameGlyph, Label, MicGlyph, TargetGlyph } from '../components.tsx';
import { hasMomentum, type Momentum } from '../progress/momentum.ts';
import { HAIRLINE, paper, radius, signal, space, type } from '../theme.ts';

/** TodayRow's mark, at TodayRow's size, because it is TodayRow's mark. */
const MARK = 10;

export function MomentumCards({ momentum }: { momentum: Momentum }) {
  if (!hasMomentum(momentum)) return null;
  const { days, retained, goal } = momentum;

  return (
    <View style={st.block}>
      <Label>Daily momentum</Label>

      {(days !== null || retained !== null) && (
        <View style={st.tiles}>
          {days !== null && (
            <Card style={st.tile}>
              <View style={st.tileHead}>
                <FlameGlyph />
                <Text style={st.tileLabel}>{days.label}</Text>
              </View>
              <View style={st.count}>
                <Text style={st.number}>{days.count}</Text>
                <Text style={st.unit}>{days.unit}</Text>
              </View>
              {/* A picture of the last seven days, never a target. The count
                  above already says it, so the row itself is decorative. */}
              <View
                style={st.marks}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {days.week.map((filled, index) => (
                  <View key={index} style={[st.mark, filled ? st.markDone : st.markWaiting]} />
                ))}
              </View>
            </Card>
          )}

          {retained !== null && (
            <Card style={st.tile}>
              <View style={st.tileHead}>
                <MicGlyph size={18} color={signal.good} />
                <Text style={st.tileLabel}>{retained.label}</Text>
              </View>
              <View style={st.count}>
                <Text style={st.number}>{retained.count}</Text>
                {/* Absent rather than zero: a card graded before the deck kept
                    the moment it settled cannot say which week it landed in. */}
                {retained.weekLine !== null && <Text style={st.gain}>{retained.weekLine}</Text>}
              </View>
              <Text style={st.unit}>{retained.unit}</Text>
            </Card>
          )}
        </View>
      )}

      {goal !== null && (
        <Card style={st.goal}>
          <View style={st.goalHead}>
            <TargetGlyph />
            <View style={st.goalWords}>
              <Text style={st.goalTitle}>{goal.title}</Text>
            </View>
            <Text style={st.goalAmount}>{goal.amount}</Text>
          </View>
          <View
            style={st.track}
            accessibilityRole="progressbar"
            accessibilityLabel={goal.title}
            accessibilityValue={{ min: 0, max: 100, now: goal.percent, text: goal.percentLabel }}
          >
            <View style={[st.fill, { width: `${goal.percent}%` }]} />
          </View>
          <View style={st.goalFoot}>
            <View style={st.goalWords}>
              <Text style={st.goalNote}>{goal.note}</Text>
            </View>
            <Text style={st.goalPercent}>{goal.percentLabel}</Text>
          </View>
        </Card>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  block: { marginTop: space(7), gap: space(3) },
  // Two tiles to a row, each taking half of what is there. `minWidth: 0` is
  // what lets a tile shrink at the largest reading size instead of pushing its
  // neighbour off the screen.
  tiles: { flexDirection: 'row', gap: space(3) },
  tile: { flex: 1, minWidth: 0, padding: space(4) },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  tileLabel: { ...type.small, color: paper.inkSoft, flex: 1, minWidth: 0 },
  count: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space(2), marginTop: space(2) },
  number: { ...type.title, color: paper.ink },
  unit: { ...type.small, color: paper.inkSoft },
  gain: { ...type.small, color: signal.good },
  marks: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(1.5), marginTop: space(3) },
  mark: { width: MARK, height: MARK, borderRadius: MARK / 2 },
  markDone: { backgroundColor: signal.good },
  markWaiting: { borderWidth: HAIRLINE + 0.4, borderColor: paper.line },
  goal: { padding: space(4) },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  goalWords: { flex: 1, minWidth: 0 },
  goalTitle: { ...type.bodyStrong, color: paper.ink },
  goalAmount: { ...type.small, color: paper.inkSoft, textAlign: 'right' },
  track: {
    height: space(2),
    borderRadius: radius.pill,
    backgroundColor: paper.groundDeep,
    overflow: 'hidden',
    marginTop: space(3),
  },
  // Green, because it is ground the learner has already covered. The accent is
  // identity and never reports a state.
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: signal.good },
  goalFoot: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginTop: space(2) },
  goalNote: { ...type.small, color: paper.inkSoft },
  goalPercent: { ...type.small, color: paper.ink, textAlign: 'right' },
});
