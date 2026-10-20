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

export function BArt({ name, width, height, style }: {
  name: BArtName;
  width: number;
  /** Defaults to the drawing's own aspect ratio at `width`. */
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const instance = useId();
  const xml = useMemo(() => c2SvgForInstance(svg[name], `b-${name}-${instance}`), [name, instance]);
  const drawn = height ?? bArtHeight(name, width);
  return (
    <View {...decorative} style={[{ width, height: drawn }, style]}>
      <SvgXml {...decorative} xml={xml} width={width} height={drawn} />
    </View>
  );
}
