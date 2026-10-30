/**
 * The parts After a session, the Celebration and the Recap are drawn from
 * (2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and B-Recap), in
 * light and dark.
 *
 * After a session and the Celebration keep the blue page in both themes (the
 * brand), as the live room does; the Recap reads the theme. Pure
 * presentation: words and decisions arrive as props from
 * `recap/afterSessionView.ts` and the screen; colours are `useB()` tokens.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BArt } from '../art/BArt.tsx';
import { Press } from '../components.tsx';
import { CloseGlyph } from '../live/LiveParts.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BSpeaker, CheckDisc } from '../today/TodayParts.tsx';
import { HIT, bType, decorative, frenchText } from '../theme.ts';
import { HEAR_IT_SAID, type StatTile } from './afterSessionView.ts';

/** The close disc: the light violet one on blue, the white one on the Recap band. */
export function CloseDisc({ label, onPress, on }: { label: string; onPress: () => void; on: 'blue' | 'band' }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" accessibilityLabel={label} onPress={onPress} style={[s.close, { backgroundColor: on === 'blue' ? t.violet2 : t.card }]}>
      <CloseGlyph size={18} color={on === 'blue' ? t.onBrand : t.text} />
    </Press>
  );
}

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

/** The three stat tiles: sun, card and mint, value 22/700 over a 13 label. */
export function StatTiles({ tiles }: { tiles: readonly StatTile[] }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  if (tiles.length === 0) return null;
  return (
    <View style={s.stats}>
      {tiles.map((tile) => {
        const ground = tile.ground === 'sun' ? t.sun : tile.ground === 'mint' ? t.mint : t.card;
        const ink = tile.ground === 'card' ? t.text : t.onMint;
        const soft = tile.ground === 'card' ? t.muted : t.onMint;
        return (
          <View key={tile.key} style={[s.stat, { backgroundColor: ground }]} accessible accessibilityLabel={`${tile.value} ${tile.label}`}>
            <Text style={[bType.bold22, s.center, { color: ink }]}>{tile.value}</Text>
            <Text style={[bType.note, s.center, { color: soft }]}>{tile.label}</Text>
          </View>
        );
      })}
    </View>
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

/** The flame, the day and week in words, and the seven bars. */
export function StreakRow({ line, bars }: { line: string; bars: readonly boolean[] | null }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.streak}>
      <BArt name="flame" width={30} height={37} />
      <View style={s.grow}>
        <Text style={[bType.bold16, { color: t.onBrand }]}>{line}</Text>
        {bars ? (
          <View {...decorative} style={s.bars}>
            {bars.map((lit, index) => <View key={index} style={[s.bar, { backgroundColor: lit ? t.sun : t.violet2 }]} />)}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The Celebration's confetti, at the artboard's places. Decoration. */
export function CelebrateConfetti() {
  const t = useB();
  const pieces: readonly { left: number; top: number; width: number; height: number; color: string; rotate: number }[] = [
    { left: 34, top: 120, width: 10, height: 22, color: t.sun, rotate: 20 },
    { left: 330, top: 140, width: 12, height: 12, color: t.mint, rotate: 0 },
    { left: 70, top: 300, width: 12, height: 12, color: t.peach, rotate: 0 },
    { left: 318, top: 330, width: 9, height: 20, color: t.sun, rotate: -25 },
    { left: 40, top: 420, width: 9, height: 20, color: t.periwinkle, rotate: 35 },
    { left: 350, top: 250, width: 9, height: 20, color: t.peach, rotate: 60 },
    { left: 180, top: 96, width: 10, height: 10, color: t.mint, rotate: 0 },
    { left: 270, top: 410, width: 10, height: 10, color: t.sun, rotate: 0 },
  ];
  return (
    <View {...decorative} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <View key={index} style={{ position: 'absolute', left: piece.left, top: piece.top, width: piece.width, height: piece.height,
          borderRadius: piece.width === piece.height ? piece.width / 2 : 3, backgroundColor: piece.color, transform: [{ rotate: `${piece.rotate}deg` }] }} />
      ))}
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

/** The white postcard card: the tile, its eyebrow, the scene and the line. */
export function PostcardCard({ tile, eyebrow, title, line }: { tile: ReactNode; eyebrow: string; title: string; line: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.postcard}>
      {tile}
      <View style={s.grow}>
        <Text style={[bType.chip, { color: t.link }]}>{eyebrow}</Text>
        <Text {...frenchText} style={[bType.bold17, { color: t.text }]}>{title}</Text>
        <Text style={[bType.note, { color: t.muted }]}>{line}</Text>
      </View>
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

/** A small fix: You said, Try, and Why under a rule. Tapping it opens the try. */
export function FixCard({ quote, better, betterEn, why, onPress }: { quote: string; better: string; betterEn: string; why: string; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" accessibilityLabel={`You said ${quote}. Try ${better}. ${betterEn}. Why: ${why}`} accessibilityHint="Opens a try of this version" onPress={onPress} style={s.fix}>
      <Text style={[bType.meta, { color: t.muted }]}>You said</Text>
      <Text {...frenchText} style={[bType.line16, { color: t.text }]}>{quote}</Text>
      <Text style={[bType.bold14, { color: t.mintWords }]}>Try</Text>
      <Text {...frenchText} style={[bType.bold17, { color: t.text }]}>{better}</Text>
      <Text style={[bType.meta, s.why, { color: t.secondary }]}>{`Why: ${why}`}</Text>
    </Press>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    close: { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center' },
    hear: { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center' },
    center: { textAlign: 'center' },
    grow: { flex: 1, minWidth: 0 },
    stats: { flexDirection: 'row', gap: 8 },
    stat: { flex: 1, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
    saidWell: { backgroundColor: t.card, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    streak: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bars: { flexDirection: 'row', gap: 6, marginTop: 8 },
    bar: { flex: 1, height: 8, borderRadius: 4 },
    tile: { width: 72, height: 72, borderRadius: 16, backgroundColor: t.peach, alignItems: 'center', justifyContent: 'center', overflow: 'visible', transform: [{ rotate: '-4deg' }] },
    postcard: { backgroundColor: t.card, borderRadius: 24, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
    nextPill: { backgroundColor: t.sun, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'center' },
    goal: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 24 },
    goalRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: t.field },
    lineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    ruled: { borderBottomWidth: 1, borderBottomColor: t.line },
    fix: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
    why: { borderTopWidth: 1, borderTopColor: t.line, paddingTop: 8 },
  });
}
