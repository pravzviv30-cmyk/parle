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

import { useMainAppearance } from '../main/MainAppearance.tsx';
import { StaggerIn } from '../motion/StaggerIn.tsx';
import { STAGGER } from '../motion/tokens.ts';
import { decorative, space, type } from '../theme.ts';

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
});
