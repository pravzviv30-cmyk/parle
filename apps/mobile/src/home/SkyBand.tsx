/**
 * Today's sky band (UI-015, direction A): the hour's ground, a sun or moon off
 * the top right corner, two clouds that drift in once, the greeting in two
 * lines, the profile button, the stat tiles and the nudge.
 *
 * Props in, nothing out: the sky, the greeting and the slots arrive from the
 * screen (or a dev preview), so this file reads no storage and no navigation.
 * It runs full bleed: the screen draws it on `ScrollScreen bleedTop` with
 * `padded={false}`, as Journey's band does, and the top inset arrives through
 * `TopInset`, so the frame stays the one reader of the safe area. Its foot is
 * a spacer of `overlap` points that the hero card is pulled up over.
 *
 * The greeting is still. The clouds are decorative and move only inside
 * `Drift`, which lands at rest under Reduce Motion.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { SkyCloud } from '../art/sky/SkyCloud.tsx';
import { SkyDisc } from '../art/sky/SkyDisc.tsx';
import { TopInset } from '../layout.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { Drift } from '../motion/Drift.tsx';
import { bType, decorative, space, type } from '../theme.ts';
import { greetingLines, type SkyView } from './skyView.ts';

/** The board is drawn at 390pt wide; the clouds keep their place as a share of the band. */
const BOARD_WIDTH = 390;
/** The disc, 170pt, hangs 40pt past the top right corner. */
const DISC = 170;
const DISC_BLEED = -40;
/** The two clouds as the board draws them: size (width), left and top at 390, and opacity. */
const CLOUDS = [
  { size: 120, left: 150, top: 120, opacity: 0.35 },
  { size: 80, left: 270, top: 176, opacity: 0.25 },
] as const;

export function SkyBand({ sky, greeting, profile, stats, nudge = null, overlap, focused = true }: {
  sky: SkyView;
  greeting: { word: string; name: string | null; title: string };
  /** The ProfileButton on the sky's chip. */
  profile: ReactNode;
  /** The stat tiles, their skeleton, or nothing when the game layer could not be read. */
  stats: ReactNode;
  /** The one nudge line, only while a streak runs and today is open. */
  nudge?: string | null;
  /** How far the hero card is pulled up over the sky's foot. */
  overlap: number;
  /** Light status bar content only while Today is on top (tabs stay mounted). */
  focused?: boolean;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const scale = width / BOARD_WIDTH;
  return (
    <View style={[s.band, { backgroundColor: sky.ground }]}>
      {focused ? <StatusBar style="light" /> : null}
      <View {...decorative} pointerEvents="none" style={s.disc}>
        <SkyDisc kind={sky.discKind} size={DISC} color={sky.disc} />
      </View>
      {CLOUDS.map((cloud) => (
        <Drift key={cloud.left} style={[s.cloud, { left: cloud.left * scale, top: cloud.top * scale }]}>
          <SkyCloud width={cloud.size * scale} color={t.onBrand} opacity={cloud.opacity} />
        </Drift>
      ))}
      <TopInset extra={space(2)} />
      <View style={s.head}>
        <Text accessibilityRole="header" accessibilityLabel={greeting.title} style={[bType.greeting, s.greeting, { color: t.onBrand }]}>
          {greetingLines(greeting).join('\n')}
        </Text>
        <View style={s.profile}>{profile}</View>
      </View>
      <View style={s.stats}>
        {stats}
        {nudge !== null ? <Text style={[type.body, { color: t.onBrand }]}>{nudge}</Text> : null}
      </View>
      <View style={{ height: overlap }} />
    </View>
  );
}

const makeStyles = (_t: B) =>
  StyleSheet.create({
    band: { overflow: 'hidden', paddingHorizontal: space(4) },
    disc: { position: 'absolute', right: DISC_BLEED, top: DISC_BLEED },
    cloud: { position: 'absolute' },
    head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space(3), paddingHorizontal: space(1) },
    greeting: { flexShrink: 1, minWidth: 0 },
    profile: { flexShrink: 0 },
    stats: { marginTop: space(3), gap: space(3) },
  });
