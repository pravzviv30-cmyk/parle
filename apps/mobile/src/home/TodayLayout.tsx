/**
 * Today's page as one composition (UI-015), used by the tab and by the dev
 * previews: the sky band, the hero card pulled up over the sky's foot with
 * 16pt side margins, then Today's path under its title, Today's three, Coming
 * up and the week, about 30pt apart. Props in only: each slot is drawn by its
 * own part, and an empty slot draws nothing.
 *
 * The frame alone pads the scroll's foot (F409), so this adds none.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemedStyles, type B } from '../main/bTheme.tsx';
import { space } from '../theme.ts';
import { SectionTitle } from '../today/TodayParts.tsx';

/**
 * How far the hero is pulled up over the sky (board: the sky ends at 300, the
 * hero starts at 238, so 62; the tiles' lip ends about 16pt above it).
 */
export const TODAY_OVERLAP = 60;
/** The page's side margins under the sky (board: 16). */
const SIDE = space(4);
/** Between sections (board: 30). */
const SECTION_GAP = 30;

export function TodayLayout({ sky, hero, pathTitle, rows, three, comingUp, week, overlap = TODAY_OVERLAP }: {
  /** A SkyBand. */
  sky: ReactNode;
  /** A TodayHeroCard with its contents, or the hero's skeleton. */
  hero: ReactNode;
  pathTitle: string;
  /** The remaining stops as RouteRows, or null when there are none. */
  rows: ReactNode;
  three: ReactNode;
  comingUp: ReactNode;
  week: ReactNode;
  overlap?: number;
}) {
  const s = useThemedStyles(makeStyles);
  return (
    <View>
      {sky}
      <View style={[s.body, { marginTop: -overlap }]}>
        {hero}
        {rows != null ? (
          <View style={s.section}>
            <SectionTitle title={pathTitle} />
            <View>{rows}</View>
          </View>
        ) : null}
        {three != null ? <View style={s.section}>{three}</View> : null}
        {comingUp != null ? <View style={s.section}>{comingUp}</View> : null}
        {week != null ? <View style={s.section}>{week}</View> : null}
      </View>
    </View>
  );
}

const makeStyles = (_t: B) =>
  StyleSheet.create({
    body: { paddingHorizontal: SIDE },
    section: { marginTop: SECTION_GAP },
  });
