/**
 * When the corner art on a tab header shows, and how far it hangs into the gutter.
 *
 * Two decisions, both of them small and both of them easy to get wrong in a
 * `.tsx` where nothing can test them. They live here instead, in a file that
 * imports nothing, so a node test can call them.
 *
 * ## The threshold
 *
 * The art sits behind the top-right corner of the header, and the greeting sits
 * in front of it. At the OS's larger reading sizes the greeting grows into that
 * corner and the two collide: serif over watercolour is unreadable, and the
 * title is the part that carries meaning. So above a font scale of 1.5 the art
 * is simply not drawn. Hiding a decorative picture costs a learner nothing,
 * which is exactly why it is the thing that yields (F383's rule: at large text
 * something has to give, and it is never the words).
 *
 * ## The bleed
 *
 * `ScrollScreen` pads `space(5)` down each side, and the mockup's art runs off
 * the top-right of the page rather than stopping at that padding. The picture
 * is therefore pulled up and out by a negative offset. The fade at the cut edge
 * is painted into the PNG's own alpha, not masked here: a negative margin under
 * a gradient clips hard on Android, and on the web the overhang becomes real
 * scrollable width and the page gains a horizontal scrollbar. An image that
 * fades to nothing needs neither.
 *
 * The offset is written in points rather than through `space()` because
 * `theme.ts` imports `Platform` and the mobile test runner has no react-native,
 * so a value import from it would make this file untestable. `headerArt.test.ts`
 * reads the grid out of `theme.ts` and fails if these two numbers ever stop
 * being four and five steps of it.
 */

/** The font scale at which the header's words would land on the picture. */
const ART_HIDES_AT = 1.5;

/**
 * Whether the corner art is drawn at this reading size.
 *
 * `PixelRatio.getFontScale()` is the caller's business; this takes the number so
 * that the decision itself can be checked.
 */
export function showHeaderArt(fontScale: number): boolean {
  return fontScale < ART_HIDES_AT;
}

/**
 * How far the art hangs off the corner: `-space(4)` up, `-space(5)` out, so its
 * right edge reaches exactly the edge of the page the screen padding created.
 */
export const HEADER_ART_OFFSET = { top: -16, right: -20 } as const;

/**
 * Practice and My French both have a two-line title. Their picture tucks
 * farther into the top bleed so its lower edge cannot cross the purpose line.
 */
export const LONG_HEADER_ART_TOP = -80;
