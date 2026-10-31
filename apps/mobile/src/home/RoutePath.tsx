/**
 * Luvani's route motif, drawn once (F932, F934; founder decision 6): stops on
 * one rail, each a dot with a line down to the next, in theme colours from
 * `useMainAppearance`, no glyphs. `start` is a filled sun dot, `stop` an open
 * ring, `end` a filled brand dot; a stop with no title draws a small waypoint.
 *
 * Drawn to the same sizes and tokens as the wall's trial route
 * (`wall/WallPlansPage.tsx` TrialTimeline). The wall still draws its own copy:
 * moving it here means repointing the wall's Apple 3.1.2 price-prominence pin
 * (`trialTimeline.test.ts`), a money pin, which waits for its owner. `RoutePath`
 * is the drop-in for it. Today's path composes `RouteNode`s, so a stop can
 * carry the card it leads to under its words.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { useB } from '../main/bTheme.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { StaggerIn } from '../motion/StaggerIn.tsx';
import { STAGGER } from '../motion/tokens.ts';
import { HIT, bType, decorative, frenchText, space, type } from '../theme.ts';
import { routeRowLabel } from './routeRow.ts';

export type RouteMark = 'start' | 'stop' | 'end';

export interface RouteStopView {
  key: string;
  title: string | null;
  line: string;
  mark: RouteMark;
}

/** One stop: the dot, the line to the next stop unless `last`, the words, and what the stop leads to. */
export function RouteNode({ mark, title, line, last, children }: { mark: RouteMark; title: string | null; line: string | null; last: boolean; children?: ReactNode }) {
  const { colors, b } = useMainAppearance();
  const dot = mark === 'start'
    ? { backgroundColor: b.sun, borderColor: b.sun }
    : mark === 'end' ? { backgroundColor: b.brand, borderColor: b.brand } : { backgroundColor: colors.background, borderColor: b.brand };
  return (
    <View style={st.node}>
      <View style={st.rail} {...decorative}>
        <View style={[title === null ? st.waypoint : st.stop, dot]} />
        {!last && <View style={[st.route, { backgroundColor: b.brand }]} />}
      </View>
      <View style={[st.nodeWords, !last && st.nodeGap]}>
        {title !== null && <Text style={[st.nodeTitle, { color: colors.text }]}>{title}</Text>}
        {line !== null && <Text style={[st.nodeLine, { color: colors.muted }]}>{line}</Text>}
        {children !== undefined && <View style={st.leads}>{children}</View>}
      </View>
    </View>
  );
}

/** A whole route, staggered in (the shared stagger honours reduced motion). */
export function RoutePath({ stops }: { stops: readonly RouteStopView[] }) {
  return (
    <StaggerIn step={STAGGER.base}>
      {stops.map((node, index) => (
        <RouteNode key={node.key} mark={node.mark} title={node.title} line={node.line} last={index === stops.length - 1} />
      ))}
    </StaggerIn>
  );
}

/**
 * One of Today's remaining stops as a flat row (UI-015): the rail (a ring
 * stop, or the ink end dot, and the 2pt line to the next), a 52pt art thumb
 * on its pastel, the words, and a trailing text action or a chevron. The whole
 * row is one press at the touch floor with one label (`routeRowLabel`); a
 * hairline sits under every row but the last.
 */
export function RouteRow({ mark, last, thumb, thumbGround, eyebrow = null, title, titleLang, line = null, action = null, chevron = false, onPress }: {
  mark: 'stop' | 'end';
  last: boolean;
  /** The decorative drawing in the thumb. */
  thumb: ReactNode;
  thumbGround: string;
  eyebrow?: string | null;
  title: string;
  /** 'fr' when the title is French, so it is read in French. */
  titleLang?: string;
  line?: string | null;
  action?: { label: string; accessibilityLabel?: string } | null;
  chevron?: boolean;
  onPress: () => void;
}) {
  const t = useB();
  const french = titleLang === 'fr' ? frenchText : null;
  return (
    <Press haptic="light" accessibilityRole="button" accessibilityLabel={routeRowLabel({ title, line, action })} onPress={onPress} glowRadius={ROW_THUMB_RADIUS} style={st.row}>
      <View style={st.rowRail} {...decorative}>
        <View style={mark === 'end' ? [st.rowEnd, { backgroundColor: t.text }] : [st.rowStop, { borderColor: t.link }]} />
        {!last && <View style={[st.rowLine, { backgroundColor: t.line }]} />}
      </View>
      <View style={[st.rowBody, !last && [st.rowRule, { borderBottomColor: t.line }]]}>
        <View {...decorative} style={[st.thumb, { backgroundColor: thumbGround }]}>{thumb}</View>
        <View style={st.rowWords}>
          {eyebrow !== null && <Text style={[bType.eyebrow, { color: t.link }]}>{eyebrow}</Text>}
          <Text {...french} style={[bType.heavy16, { color: t.text }]}>{title}</Text>
          {line !== null && <Text style={[bType.note, { color: t.muted }]}>{line}</Text>}
        </View>
        {action !== null
          ? <Text style={[bType.bold14, st.action, { color: t.text }]}>{action.label}</Text>
          : chevron ? <View {...decorative}><Icon name="chevron-right" size={ROW_CHEVRON} color={t.muted} /></View> : null}
      </View>
    </Press>
  );
}

/** The row's rail column, ring stop and end dot (board: 18, 14, a 3pt ring). */
const ROW_RAIL = 18;
const ROW_DOT = 14;
const ROW_RING = 3;
/** Where the dot sits, level with the thumb's top third (board: 18). */
const ROW_DOT_TOP = 18;
/** The art thumb (board: 52, radius 16). */
const ROW_THUMB = 52;
const ROW_THUMB_RADIUS = 16;
const ROW_CHEVRON = 20;
/** The 1pt rule under a row (board). */
const HAIRLINE = 1;

const STOP = 16;
const WAYPOINT = 10;
/** The 2pt line between stops: decorative, never a container of words. */
const LINE = 2;

const st = StyleSheet.create({
  node: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', width: STOP, paddingTop: 5 },
  stop: { width: STOP, height: STOP, borderRadius: STOP / 2, borderWidth: 2.5 },
  waypoint: { width: WAYPOINT, height: WAYPOINT, borderRadius: WAYPOINT / 2, borderWidth: 2 },
  route: { flex: 1, minWidth: 0, width: LINE, marginTop: space(0.5), opacity: 0.35 },
  nodeWords: { flex: 1, minWidth: 0, gap: 2 },
  // A margin, not padding: the same gap, and Home's frame alone pads the scroll (F409).
  nodeGap: { marginBottom: space(3) },
  nodeTitle: { ...type.bodyStrong },
  nodeLine: { ...type.small },
  leads: { marginTop: space(2) },
  row: { minHeight: HIT, flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  rowRail: { alignItems: 'center', width: ROW_RAIL },
  rowStop: { width: ROW_DOT, height: ROW_DOT, borderRadius: ROW_DOT / 2, borderWidth: ROW_RING, marginTop: ROW_DOT_TOP },
  rowEnd: { width: ROW_DOT, height: ROW_DOT, borderRadius: ROW_DOT / 2, marginTop: ROW_DOT_TOP },
  rowLine: { flex: 1, minWidth: 0, width: LINE },
  rowBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  rowRule: { borderBottomWidth: HAIRLINE },
  thumb: { width: ROW_THUMB, height: ROW_THUMB, borderRadius: ROW_THUMB_RADIUS, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  rowWords: { flex: 1, minWidth: 0 },
  action: { textDecorationLine: 'underline', flexShrink: 0 },
});
