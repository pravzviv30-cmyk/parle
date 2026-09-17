/**
 * Daily momentum, drawn.
 *
 * It lives on the Progress screen now rather than on Home: the four cards are
 * the evidence a learner goes looking for, and Home opens on the one thing to
 * do tonight. The section's own heading is the screen's, not this file's, so
 * the block can sit under whatever the screen decides to call it.
 *
 * One full-width card, two half tiles and the goal, and not one of the words on
 * them is written here. `progress/momentum.ts` decides every count, every
 * label, every unit and every line, and every field that has nothing true to
 * say arrives `null`. This file is a set of null gates and a stylesheet.
 *
 * That division is the whole point of the module. A tile that spelled its own
 * label would be a tile that could say "Days active" over a number that counted
 * something else, and there is no renderer in this workspace to notice.
 *
 * Nothing here computes either. No arithmetic, no rounding, no counting the
 * chips to decide whether to say "+2 more" — the module already did all three,
 * and a second opinion about a number is how two parts of one card come to
 * disagree. `HomeTab.test.ts` refuses `Math.`, `toFixed` and `.length` in this
 * file for exactly that reason.
 *
 * ## Green, and only for ground already covered
 *
 * The filled day marks, the speaking glyph, the weekly gain, the recall band
 * line and the goal bar's fill are `signal.good`, which means the same here as
 * it means everywhere else in the app: the learner produced French. The bar's
 * fill is deliberately NOT `accent.primary` — the violet is identity, the
 * colour of the thing you press, and a bar reporting how far along today is
 * reports a state. A day that has not happened is a hairline in `paper.line`
 * and not a colour at all, on TodayRow's rule that a thing which has not
 * happened is not a state worth signalling.
 *
 * The violet appears once on this whole block, on the badge beside the recall
 * figure, where it labels a card and reports nothing. That is why the guard
 * counts `accent.` rather than merely banning it: once, on a glyph, never in
 * the stylesheet.
 *
 * ## Present from the first day, worded as a start
 *
 * This block used to be absent until there was something to say, on the
 * argument that a rail of empty marks is a quota and a quota nobody has met is
 * guilt wearing a different hat. The founder overturned that on 2026-09-05: a
 * learner should meet the four things this app will ever claim about them
 * before it can claim any of them.
 *
 * So the four cards are always drawn, and the refusal moved down a level. Where
 * a count would be nought the numeral is simply not drawn and the module's
 * `words` field carries a start line in its place, so the learner reads an
 * invitation rather than a zero. The empty rail and the empty bar name no
 * target, and the one line that asks for anything asks for a promise rather
 * than for work: without a daily goal the goal card carries Profile's own
 * `DAILY_GOAL_UNSET`, "Pick a daily promise". That is an offer of a setting, not
 * a quota, and it is the only ask on the block.
 */

import { StyleSheet, Text, View } from 'react-native';

import { BadgeGlyph, Card, FlameGlyph, GhostButton, MicGlyph, TargetGlyph, WeekRail } from '../components.tsx';
import type { Momentum } from './momentum.ts';
import { accent, HAIRLINE, paper, radius, signal, space, type } from '../theme.ts';

/** The rounded well the hero's glyph sits in. Square, so it stays a square. */
const WELL = 36;

export function MomentumCards({
  momentum,
  onReviewPhrases,
}: {
  momentum: Momentum;
  onReviewPhrases: () => void;
}) {
  const { days, retained, mastery, goal } = momentum;

  return (
    <View style={st.block}>
      <Card style={st.hero}>
        <View style={st.heroHead}>
          <View style={st.well}>
            <MicGlyph size={18} color={signal.good} />
          </View>
          <View style={st.heroWords}>
            <Text style={st.heroLabel}>{retained.label}</Text>
            <Text style={st.heroSub}>{retained.sub}</Text>
          </View>
          {/* Absent rather than zero: a week that added nothing has nothing to
              add up, and "+0" is a nought wearing a plus sign. */}
          {retained.weekLine !== null && (
            <View style={st.weekPill}>
              <Text style={st.gain}>{retained.weekLine}</Text>
            </View>
          )}
        </View>

        <View style={st.count}>
          {retained.count !== null && <Text style={st.number}>{retained.count}</Text>}
          <Text style={st.words}>{retained.words}</Text>
        </View>

        {/* The learner's own French, exactly as they said it. Wrapping, never
            clipped: at the largest reading size a serif line is wide, and the
            card is allowed to get taller.

            Gated on the count, not on the chips, because the module empties
            them together and this file may not count anything. Without the
            gate the row is still a row: an empty one, height nought, carrying
            its own top margin, which leaves a strip of dead air under the start
            line on exactly the screen a first-run learner meets. */}
        {retained.count !== null && (
          <View style={st.chips}>
            {retained.chips.map((said, index) => (
              <View key={index} style={st.chip}>
                <Text style={st.chipWord}>{said}</Text>
              </View>
            ))}
          </View>
        )}
        {retained.moreLine !== null && <Text style={st.more}>{retained.moreLine}</Text>}

        {retained.foot !== null && (
          <View style={st.heroFoot}>
            <View style={st.rule} />
            <View style={st.heroFootRow}>
              <View style={st.heroFootWords}>
                <Text style={st.words}>{retained.foot}</Text>
              </View>
              {/* The same door the Practice pill opens, drawn as the quiet link
                  the ability rows use, because Home already has its one pill. */}
              {retained.link !== null && <GhostButton label={retained.link} onPress={onReviewPhrases} />}
            </View>
          </View>
        )}
      </Card>

      <View style={st.tiles}>
        <Card style={st.tile}>
          <View style={st.tileHead}>
            <FlameGlyph />
            <Text style={st.tileLabel}>{days.label}</Text>
          </View>
          <View style={st.count}>
            {days.count !== null && <Text style={st.number}>{days.count}</Text>}
            <Text style={st.words}>{days.words}</Text>
          </View>
          {/* A picture of the last seven days, never a target. The count above
              already says it, so the rail itself is decorative, and it is the
              shared rail so Profile's week is the same picture.
              No day names here. This tile is half the width of the screen and
              seven labelled dots wrap onto two lines on a 430pt phone, worse on
              a 390pt one. The labelled rail belongs to Profile's rhythm panel,
              which is full width and is the surface that is *about* the week;
              here the week is one tile of four and the count beside it is what
              a learner reads. */}
          <WeekRail week={days.week} />
        </Card>

        <Card style={st.tile}>
          <View style={st.tileHead}>
            <BadgeGlyph color={accent.primary} />
            <Text style={st.tileLabel}>{mastery.label}</Text>
          </View>
          <View style={st.count}>
            {mastery.percentLabel !== null && <Text style={st.number}>{mastery.percentLabel}</Text>}
            <Text style={st.words}>{mastery.words}</Text>
          </View>
          {mastery.line !== null && <Text style={st.band}>{mastery.line}</Text>}
        </Card>
      </View>

      <Card style={st.goal}>
        <View style={st.goalHead}>
          <TargetGlyph />
          <View style={st.goalWords}>
            <Text style={st.goalTitle}>{goal.title}</Text>
          </View>
          {goal.amount !== null && <Text style={st.goalAmount}>{goal.amount}</Text>}
        </View>
        {/* No promise, no bar. A track with nothing to measure against is a
            quota drawn empty, and the note below says what to do instead. */}
        {goal.target !== null && (
          <View
            style={st.track}
            accessibilityRole="progressbar"
            accessibilityLabel={goal.title}
            accessibilityValue={{ min: 0, max: 100, now: goal.percent, text: goal.percentLabel ?? goal.note }}
          >
            <View style={[st.fill, { width: `${goal.percent}%` }]} />
          </View>
        )}
        <View style={st.goalFoot}>
          <View style={st.goalWords}>
            <Text style={st.goalNote}>{goal.note}</Text>
          </View>
          {goal.percentLabel !== null && <Text style={st.goalPercent}>{goal.percentLabel}</Text>}
        </View>
      </Card>
    </View>
  );
}

const st = StyleSheet.create({
  block: { marginTop: space(7), gap: space(3) },
  hero: { padding: space(4) },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  // Square, and sized by a constant rather than a number, so the F409 sweep can
  // tell a glyph well apart from a text box pinned to a width.
  well: {
    width: WELL,
    height: WELL,
    borderRadius: radius.chip,
    backgroundColor: paper.groundDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWords: { flex: 1, minWidth: 0 },
  heroLabel: { ...type.bodyStrong, color: paper.ink },
  heroSub: { ...type.small, color: paper.inkSoft, marginTop: space(0.5) },
  // `paper.ground` and not `paper.groundDeep`: green text measures 4.96 on the
  // first and 4.32 on the second, and words clear 4.5 or they are not words.
  weekPill: {
    borderRadius: radius.pill,
    backgroundColor: paper.ground,
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
    flexShrink: 1,
    minWidth: 0,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  // `flexShrink: 1` so a long line narrows and wraps inside its own chip rather
  // than running off the card.
  chip: {
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: paper.groundDeep,
    borderRadius: radius.chip,
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
  },
  chipWord: { ...type.frenchSm, color: paper.ink },
  more: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  heroFoot: { marginTop: space(4) },
  rule: { height: HAIRLINE, backgroundColor: paper.lineOnCard },
  heroFootRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(2) },
  heroFootWords: { flex: 1, minWidth: 0 },
  // Two tiles to a row, each taking half of what is there. `minWidth: 0` is
  // what lets a tile shrink at the largest reading size instead of pushing its
  // neighbour off the screen.
  tiles: { flexDirection: 'row', gap: space(3) },
  tile: { flex: 1, minWidth: 0, padding: space(4) },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  tileLabel: { ...type.small, color: paper.inkSoft, flex: 1, minWidth: 0 },
  count: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space(2), marginTop: space(2) },
  number: { ...type.title, color: paper.ink },
  words: { ...type.small, color: paper.inkSoft },
  gain: { ...type.small, color: signal.good },
  band: { ...type.small, color: signal.good, marginTop: space(2) },
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
