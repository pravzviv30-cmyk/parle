/**
 * The canvas art (DECISIONS.md UI-008, 2026-10-20): the 22 composed drawings
 * the direction B artboards use, bundled unmodified under assets/b-art and
 * drawn through SvgXml. Each mounted copy gets its own definition-ID
 * namespace (`c2SvgForInstance`), so two copies of one drawing on a screen, or
 * on the web document, never bind to each other's gradients.
 *
 * Art is decoration: the words beside it carry the meaning, so it is hidden
 * from assistive technology (surfaceContract J6). It is drawn unchanged in
 * both themes, as the M3 screenshots draw it.
 */
import { useId, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import manifest from '../../assets/b-art/manifest.json';
import svg from '../../assets/b-art/svg.json';
import { c2SvgForInstance } from './flat/c2SvgNamespace.ts';
import { decorative } from '../theme.ts';

export type BArtName = keyof typeof manifest;

/** The drawn height for a width, from the drawing's own aspect ratio. */
export function bArtHeight(name: BArtName, width: number): number {
  const size = manifest[name];
  return (width * size.height) / size.width;
}

/**
 * Widens a drawing's root viewBox to the left by `bleed` units, for a drawing
 * whose composed layers sit left of its own frame (friends-cheer's cloud is
 * translated -19.5), so nothing is cut at the frame's edge. Pure string work
 * on the bundled XML; the asset itself is unchanged.
 */
export function bleedLeft(xml: string, frameWidth: number, frameHeight: number, bleed: number): string {
  return xml.replace(`viewBox="0 0 ${frameWidth} ${frameHeight}"`, `viewBox="${-bleed} 0 ${frameWidth + bleed} ${frameHeight}"`)
    .replace(`width="${frameWidth}" height="${frameHeight}"`, `width="${frameWidth + bleed}" height="${frameHeight}"`);
}

export function BArt({ name, width, height, style, bleed = 0 }: {
  name: BArtName;
  width: number;
  /** Viewbox units to show left of the drawing's frame; the frame keeps its place. */
  bleed?: number;
  /** Defaults to the drawing's own aspect ratio at `width`. */
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const instance = useId();
  const size = manifest[name];
  const xml = useMemo(() => {
    const own = c2SvgForInstance(svg[name], `b-${name}-${instance}`);
    return bleed > 0 ? bleedLeft(own, size.width, size.height, bleed) : own;
  }, [name, instance, bleed, size.width, size.height]);
  const drawn = height ?? bArtHeight(name, width);
  const extra = bleed > 0 ? (width * bleed) / size.width : 0;
  return (
    <View {...decorative} style={[{ width, height: drawn }, style]}>
      <SvgXml {...decorative} xml={xml} width={width + extra} height={drawn} style={extra > 0 ? { marginLeft: -extra } : undefined} />
    </View>
  );
}
