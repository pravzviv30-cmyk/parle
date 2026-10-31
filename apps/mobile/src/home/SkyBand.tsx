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

import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { SkyCloud } from '../art/sky/SkyCloud.tsx';
import { SkyDisc } from '../art/sky/SkyDisc.tsx';
import { TopInset } from '../layout.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { Drift } from '../motion/Drift.tsx';
import { bType, decorative, space, type } from '../theme.ts';
import { SKY_DISC, cloudPlaces, greetingLines, greetingMaxWidth, skyBarStyle, type SkyView } from './skyView.ts';

/** Where the head box starts across the band (its padding, space(4)): an absolute child and an onLayout x both count from here. */
const BAND_PAD = 16;
/** The disc, 170pt, hangs 40pt past the top right corner. */
const DISC = SKY_DISC.size;
const DISC_BLEED = -SKY_DISC.bleed;


export function SkyBand({ sky, greeting, profile, stats, nudge = null, overlap, focused = true, scrolledPast = false, onMeasure }: {
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
  /** The sky's foot has scrolled up under the status bar: the theme's own bar style then (`skyBarStyle`). */
  scrolledPast?: boolean;
  /** The band's height and the bar's, measured, so the screen can tell when the sky has gone up under it. */
  onMeasure?: (sky: { band: number; bar: number }) => void;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const barStyle = skyBarStyle({ focused, scrolledPast, themeBar: t.statusBar });
  const [bar, setBar] = useState<number | null>(null);
  const [band, setBand] = useState<number | null>(null);
  useEffect(() => {
    if (band !== null && bar !== null) onMeasure?.({ band, bar });
  }, [band, bar, onMeasure]);
  // The greeting's right edge across the band, measured, so no cloud sits on its words.
  const [greetingRight, setGreetingRight] = useState<number | null>(null);
  return (
    <View style={[s.band, { backgroundColor: sky.ground }]} onLayout={(event) => setBand(Math.round(event.nativeEvent.layout.height))}>
      {barStyle !== null ? <StatusBar style={barStyle} /> : null}
      <View {...decorative} pointerEvents="none" style={s.disc}>
        <SkyDisc kind={sky.discKind} size={DISC} color={sky.disc} />
      </View>
      <View onLayout={(event) => setBar(Math.round(event.nativeEvent.layout.height) - space(2))}><TopInset extra={space(2)} /></View>
      <View style={s.head}>
        {/* Behind the greeting's row, right of its words (`cloudPlaces`); the tiles sit under it. */}
        {cloudPlaces(width, greetingRight).map((cloud, index) => (
          <Drift key={index} style={[s.cloud, { left: cloud.left - BAND_PAD, top: cloud.top }]}>
            <SkyCloud width={cloud.width} color={t.onBrand} opacity={cloud.opacity} />
          </Drift>
        ))}
        <Text accessibilityRole="header" accessibilityLabel={greeting.title} style={[bType.greeting, s.greeting, { color: t.onBrand, maxWidth: greetingMaxWidth(width, bar) }]} onLayout={(event) => { const { x, width: w } = event.nativeEvent.layout; setGreetingRight(Math.round(BAND_PAD + x + w)); }}>
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
