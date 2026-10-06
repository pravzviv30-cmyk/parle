/**
 * The recap's progress strip, on the coral result page (come alive, core loop
 * 2.9): the XP the conversation credited counting up, the day streak it stands
 * on, and today's goal ring drawing from where it stood to where it stands.
 * What it shows is `progressStripView`'s, every number read back from disk by
 * the settle; this only draws it.
 *
 * Composed from the shared primitives (`CountUp`, `ProgressRing`, `Enter`), so
 * nothing here moves by itself. The recap mounts it on its beat in the recap's
 * moment (`useRecapMoment`), when it rises in and its numbers count up to
 * themselves; when the moment is final (reduced motion, a page turned back to,
 * or nothing to celebrate) it is drawn at its values at once. It is never drawn
 * showing a number it has not reached. A screen reader hears each part once,
 * at its final value. White on coral, the one text colour coral carries. Parts
 * wrap at large text sizes, and no line is capped.
 */

import { StyleSheet, Text, View } from 'react-native';

import { xpText } from '../celebrate/endCardModel.ts';
import { Icon } from '../icons/Icon.tsx';
import { CountUp } from '../motion/CountUp.tsx';
import { Enter } from '../motion/layout.tsx';
import { ProgressRing } from '../motion/ProgressRing.tsx';
import { DUR } from '../motion/tokens.ts';
import { decorative, segmentPending, space, textOn, type } from '../theme.ts';
import type { ProgressStripView } from './progressStrip.ts';

const INK = textOn.coral;
const RING = 28;

export function ProgressStrip({ view, final }: { view: ProgressStripView; final: boolean }) {
  const parts = (
    <View style={st.row}>
      {view.xp !== null ? (
        <View style={st.part} accessible accessibilityLabel={`${xpText(view.xp.value)} ${view.xp.label}`}>
          <CountUp
            from={final ? view.xp.value : 0}
            to={view.xp.value}
            format={xpText}
            label={`${xpText(view.xp.value)} ${view.xp.label}`}
            textStyle={[type.stat, { color: INK }]}
          />
          <Text style={[type.small, { color: INK }]}>{view.xp.label}</Text>
        </View>
      ) : null}
      {view.streak !== null ? (
        <View style={st.part} accessible accessibilityLabel={`${view.streak.value} ${view.streak.label}`}>
          <View style={st.inline}>
            <View {...decorative}>
              <Icon name="flame" variant="bulk" size={22} color={INK} />
            </View>
            <Text style={[type.stat, { color: INK }]}>{view.streak.value}</Text>
          </View>
          <Text style={[type.small, { color: INK }]}>{view.streak.label}</Text>
        </View>
      ) : null}
      {view.goal !== null ? (
        <View style={st.part} accessible accessibilityLabel={view.goal.line}>
          <View style={st.inline}>
            <ProgressRing
              from={final ? view.goal.to : view.goal.from}
              to={view.goal.to}
              size={RING}
              stroke={4}
              color={INK}
              track={segmentPending.coral}
              duration={DUR.reveal}
            />
            <Text style={[type.bodyStrong, st.grow, { color: INK }]}>{view.goal.line}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
  return (
    <View style={st.strip}>
      {final ? parts : <Enter>{parts}</Enter>}
      {view.capLine !== null ? <Text style={[type.small, { color: INK }]}>{view.capLine}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  strip: { gap: space(2), marginTop: space(2) },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space(4) },
  part: { gap: space(0.5), flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), flexShrink: 1 },
  grow: { flexShrink: 1 },
});
