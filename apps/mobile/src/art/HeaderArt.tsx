import { PixelRatio, StyleSheet, View } from 'react-native';

import { decorative } from '../theme.ts';
import { Art } from './Art.tsx';
import { HEADER_ART_OFFSET, LONG_HEADER_ART_TOP, showHeaderArt } from './headerArt.ts';
import type { ArtKey } from './registry.ts';

/**
 * The watercolour corner of a tab header.
 *
 * A tab draws this and its `TabHeader` inside one `position: 'relative'` view,
 * so the art can sit behind the words and bleed off the top-right of the page.
 * It is absolute, `zIndex: 0` and `pointerEvents="none"`: a picture that eats a
 * tap on a heading is a picture that breaks a screen, and this one covers the
 * corner where a greeting that swaps languages lives.
 *
 * Nothing here moves, and nothing here is announced. At a font scale of 1.5 or
 * more it is not drawn at all — see `headerArt.ts` for both decisions.
 */
export function HeaderArt({ name }: { name: ArtKey }) {
  if (!showHeaderArt(PixelRatio.getFontScale())) return null;
  const longTitle = name === 'header-practice' || name === 'header-myfrench';
  return (
    <View style={[st.corner, longTitle && st.longTitle]} pointerEvents="none" {...decorative}>
      <Art name={name} />
    </View>
  );
}

const st = StyleSheet.create({
  corner: {
    position: 'absolute',
    top: HEADER_ART_OFFSET.top,
    right: HEADER_ART_OFFSET.right,
    zIndex: 0,
    // The corner is atmosphere, never competition for a long title. The PNG
    // keeps its colour, but the whole wash yields when words cross its fade.
    opacity: 0.82,
  },
  longTitle: { top: LONG_HEADER_ART_TOP },
});
