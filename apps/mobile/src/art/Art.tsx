import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { decorative } from '../theme.ts';
import { ART, type ArtKey } from './registry.ts';

/**
 * The one place a bundled picture reaches the screen.
 *
 * This is the only file in the app allowed to import `Image` from react-native,
 * and `registry.test.ts` fails if a second one appears. One renderer is what
 * makes two promises checkable rather than hopeful: every scene is hidden from
 * assistive technology, and every scene is drawn at the size the registry gives
 * it. A raw `<Image>` somewhere else would be an unlabelled image announced to
 * a screen reader as "image", which is the accessibility failure J6 already
 * closed for the vector scenes.
 *
 * The art carries nothing the words around it do not already say, so it is
 * `accessible={false}` and spreads `decorative` — three platforms, three
 * spellings, all of them in `theme.ts`.
 *
 * `resizeMode="contain"` because these are scenes with generous white space and
 * a soft alpha edge: cover would crop the wash away, and stretch would bend the
 * ink. The `style` prop is for placement only (margins, alignment, opacity); a
 * width written at a call site is the drift this registry exists to prevent.
 */
export function Art({ name, style, compact = false }: { name: ArtKey; style?: StyleProp<ImageStyle>; compact?: boolean }) {
  const art = ART[name];
  const scale = compact ? 0.65 : 1;
  return (
    <Image
      source={art.source}
      style={[{ width: art.width * scale, height: art.height * scale, maxWidth: '100%' }, style]}
      resizeMode="contain"
      accessible={false}
      {...decorative}
    />
  );
}
