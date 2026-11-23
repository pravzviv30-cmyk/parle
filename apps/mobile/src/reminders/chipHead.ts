/**
 * Whether every talk-day chip head stacks (tick above the day) or stays inline.
 * Decided once for the grid, so one screen never draws "chosen" two ways.
 */
// "Wed" in type.button (semiBold 16) measures about 36pt, the widest day; 38 leaves rounding room.
const WED_WIDTH = 38;

// space(1) * 2 chip padding + the 16pt tick + space(1) gap; theme.ts imports react-native, so node cannot load it here.
const FIXED_WIDTH = 4 * 2 + 16 + 4;

/** The cell width an inline head needs: the fixed part, plus "Wed" scaled with the text. */
export const CHIP_INLINE_WIDTH = (fontScale: number): number => FIXED_WIDTH + WED_WIDTH * fontScale;

/** A cell of 0 has not been measured yet; it stays inline until onLayout lands. */
export function chipsStack(cellWidth: number, fontScale: number): boolean {
  return cellWidth > 0 && cellWidth < CHIP_INLINE_WIDTH(fontScale);
}
