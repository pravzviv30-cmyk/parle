/**
 * The parts the one-scroll recap is drawn from (UI-020; first drawn for
 * 2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and B-Recap), in
 * light and dark. Pure presentation: words and decisions arrive as props from
 * `recap/afterSessionView.ts` and the screen; colours are `useB()` tokens.
 */

import { StyleSheet, Text, View } from 'react-native';

import { BArt } from '../art/BArt.tsx';
import { LipTile, Press } from '../components.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BSpeaker, CheckDisc } from '../today/TodayParts.tsx';
import { HIT, bType, decorative, frenchText } from '../theme.ts';
import { HEAR_IT_SAID } from './afterSessionView.ts';

/** The 44pt lavender speaker that plays the tutor's voice saying a line. */
export function HearItSaid({ line, onPress, ground = 'lavender' }: { line: string; onPress: () => void; ground?: 'lavender' | 'card' }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" depth="tile" accessibilityLabel={`${HEAR_IT_SAID}: ${line}`} onPress={onPress} style={[s.hear, { backgroundColor: ground === 'card' ? t.card : t.lavender }]}>
      <BSpeaker size={18} color={t.text} />
    </Press>
  );
}

/** "You said this well": the learner's line and the tutor's voice saying it. */
export function SaidWellCard({ line, onHear }: { line: string; onHear: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.saidWell}>
      <View style={s.grow}>
        <Text style={[bType.semi13, { color: t.muted }]}>You said this well</Text>
        <Text {...frenchText} style={[bType.bold18, { color: t.text }]}>{line}</Text>
      </View>
      <HearItSaid line={line} onPress={onHear} />
    </View>
  );
}

/** The postcard tile: a peach square turned -4 degrees, holding the café table. */
export function PostcardTile() {
  const s = useThemedStyles(makeStyles);
  return (
    <View {...decorative} style={s.tile}>
      <BArt name="cafe-table" width={78} height={71} />
    </View>
  );
}

/** The sun "Next:" pill. */
export function NextPill({ line }: { line: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return <View style={s.nextPill}><Text style={[bType.bold14, s.center, { color: t.onMint }]}>{line}</Text></View>;
}

/** A goal on the Recap band's white card: a mint tick when reached, an empty ring when not. */
export function BandGoal({ label, achieved }: { label: string; achieved: boolean }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.goal} accessible accessibilityLabel={achieved ? `Done: ${label}` : `Not this time: ${label}`}>
      {achieved ? <CheckDisc size={22} fill={t.mint} tick={t.onMint} /> : <View style={s.goalRing} />}
      <Text style={[bType.semi15, { color: t.text }]}>{label}</Text>
    </View>
  );
}

/** A row of "Your lines": the learner's French and the tutor's voice saying it. */
export function LineRow({ line, last, onHear }: { line: string; last: boolean; onHear: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.lineRow, !last && s.ruled]}>
      <Text {...frenchText} style={[bType.bold16, s.grow, { color: t.text }]}>{line}</Text>
      <HearItSaid line={line} onPress={onHear} />
    </View>
  );
}

/** A small fix on a lip tile: You said, Try, and Why under a rule. Tapping it opens the try. */
export function FixCard({ quote, better, betterEn, why, onPress }: { quote: string; better: string; betterEn: string; why: string; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <LipTile accessibilityLabel={`You said ${quote}. Try ${better}. ${betterEn}. Why: ${why}`} accessibilityHint="Opens a try of this version" onPress={onPress} style={s.fix}>
      <Text style={[bType.meta, { color: t.muted }]}>You said</Text>
      <Text {...frenchText} style={[bType.line16, { color: t.text }]}>{quote}</Text>
      <Text style={[bType.bold14, { color: t.mintWords }]}>Try</Text>
      <Text {...frenchText} style={[bType.bold17, { color: t.text }]}>{better}</Text>
      <Text style={[bType.meta, s.why, { color: t.secondary }]}>{`Why: ${why}`}</Text>
    </LipTile>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    hear: { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center' },
    center: { textAlign: 'center' },
    grow: { flex: 1, minWidth: 0 },
    saidWell: { backgroundColor: t.card, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    tile: { width: 72, height: 72, borderRadius: 16, backgroundColor: t.peach, alignItems: 'center', justifyContent: 'center', overflow: 'visible', transform: [{ rotate: '-4deg' }] },
    nextPill: { backgroundColor: t.sun, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
    goal: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 24 },
    goalRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: t.field },
    lineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    ruled: { borderBottomWidth: 1, borderBottomColor: t.line },
    fix: { paddingVertical: 14, paddingHorizontal: 16, gap: 8, alignItems: 'stretch' },
    why: { borderTopWidth: 1, borderTopColor: t.line, paddingTop: 8 },
  });
}
