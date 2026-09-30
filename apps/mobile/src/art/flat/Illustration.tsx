/**
 * The one place a flat illustration reaches the screen.
 *
 * Revamp B's drawings are vectors generated from ILLUSTRATIONS.md
 * (`scripts/illustrations.mjs`), so there is no bitmap to size and no density
 * to pick: a drawing is named, and this draws it at the size the catalogue
 * gives for that name, `large` by default or `small` where the catalogue has a
 * second size (a hero spot, a row, under a headline). A caller never writes a
 * width, which is the drift the old raster registry existed to prevent, and
 * `style` is for placement only (margins, alignment, an absolute overlay).
 *
 * The box keeps its size but never runs wider than its column: on a narrow
 * phone it narrows to the column and the drawing is contained in it, centred,
 * the way the watercolours were drawn with `contain`. Every drawing is
 * decorative: the words beside it say what it shows, so the box and the
 * drawing both spread `decorative`, and it never takes a touch meant for the
 * card under it.
 */

import { View, type StyleProp, type ViewStyle } from 'react-native';

import { decorative } from '../../theme.ts';
import { ILLUSTRATIONS, type IllustrationEntry, type IllustrationName } from './index.ts';

export function Illustration({
  name,
  fit = 'large',
  style,
}: {
  name: IllustrationName;
  /** The catalogue's second size, where it gives one; otherwise the drawing's own. */
  fit?: 'large' | 'small';
  style?: StyleProp<ViewStyle>;
}) {
  const entry: IllustrationEntry = ILLUSTRATIONS[name];
  const [width, height] = entry[fit] ?? entry.large;
  const Draw = entry.draw;
  return (
    <View style={[{ width, height, maxWidth: '100%', pointerEvents: 'none' }, style]} {...decorative}>
      <Draw width="100%" height="100%" />
    </View>
  );
}
