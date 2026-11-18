/**
 * Luvani's route motif on Today (F932, F934, UI-015; founder decision 6): each
 * of Today's remaining stops as a flat row on one rail, in theme colours from
 * `useB()`, no glyphs on the rail. `RouteNode` and `RoutePath`, the card-under-
 * the-words stops, left with UI-015 when Today's path became rows; the wall
 * still draws its own trial route (`wall/WallPlansPage.tsx` TrialTimeline).
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { useB } from '../main/bTheme.tsx';
import { HIT, bType, corner, decorative, frenchText, radius, space } from '../theme.ts';
import { routeRowLabel } from './routeRow.ts';

/**
 * One of Today's remaining stops as a flat row (UI-015): the rail (a ring
 * stop, or the ink end dot, and the 2pt line to the next), a 52pt art thumb
 * on its pastel, the words, and a chevron (F954: no row carries an action
 * word). The whole row is one press at the touch floor with one label
 * (`routeRowLabel`; a French title is read in French, the line as the hint); a
 * hairline sits under every row but the last.
 */
export function RouteRow({ mark, last, thumb, thumbGround, title, titleLang, line = null, disabled = false, onPress }: {
  mark: 'stop' | 'end';
  last: boolean;
  /** The decorative drawing in the thumb. */
  thumb: ReactNode;
  thumbGround: string;
  title: string;
  /** 'fr' when the title is French, so it is read in French. */
  titleLang?: string;
  line?: string | null;
  /** While a gated start is checking: the row cannot be pressed again. */
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useB();
  const french = titleLang === 'fr' ? frenchText : null;
  const said = routeRowLabel({ title, titleLang, line });
  return (
    <Press haptic="light" accessibilityRole="button" accessibilityLabel={said.label} accessibilityHint={said.hint} accessibilityLanguage={said.language} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} glowRadius={radius.field} style={st.row}>
      <View style={st.rowRail} {...decorative}>
        <View style={mark === 'end' ? [st.rowEnd, { backgroundColor: t.text }] : [st.rowStop, { borderColor: t.link }]} />
        {!last && <View style={[st.rowLine, { backgroundColor: t.line }]} />}
      </View>
      <View style={[st.rowBody, !last && [st.rowRule, { borderBottomColor: t.line }]]}>
        <View {...decorative} style={[st.thumb, { backgroundColor: thumbGround }]}>{thumb}</View>
        <View style={st.rowWords}>
          <Text {...french} style={[bType.heavy16, { color: t.text }]}>{title}</Text>
          {line !== null && <Text style={[bType.note, { color: t.muted }]}>{line}</Text>}
        </View>
        <View {...decorative}><Icon name="chevron-right" size={ROW_CHEVRON} color={t.muted} /></View>
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
/** The art thumb (board: 52; its corner the field step, F994). */
const ROW_THUMB = 52;
/** The drawing inside the 52pt thumb, for every row's caller. */
export const ROW_ART = 40;
const ROW_CHEVRON = 20;
/** The 1pt rule under a row (board). */
const HAIRLINE = 1;

/** The 2pt line between stops: decorative, never a container of words. */
const LINE = 2;

const st = StyleSheet.create({
  row: { minHeight: HIT, flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  rowRail: { alignItems: 'center', width: ROW_RAIL },
  rowStop: { width: ROW_DOT, height: ROW_DOT, borderRadius: ROW_DOT / 2, borderWidth: ROW_RING, marginTop: ROW_DOT_TOP },
  rowEnd: { width: ROW_DOT, height: ROW_DOT, borderRadius: ROW_DOT / 2, marginTop: ROW_DOT_TOP },
  rowLine: { flex: 1, minWidth: 0, width: LINE },
  rowBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  rowRule: { borderBottomWidth: HAIRLINE },
  thumb: { width: ROW_THUMB, height: ROW_THUMB, ...corner.field, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  rowWords: { flex: 1, minWidth: 0 },
});
