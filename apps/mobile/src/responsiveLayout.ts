/** Shared phone/tablet geometry; window width also follows iPad split view. */
export function screenInsets(width: number, left: number, right: number, padded = true) {
  const gutter = padded ? 20 : 0;
  const spare = Math.max(0, (width - left - right - 800) / 2);
  return { paddingLeft: left + spare + gutter, paddingRight: right + spare + gutter };
}

export function navigationWidth(width: number, left: number, right: number) {
  return Math.max(0, Math.min(640, width - left - right - 16));
}

/** Compact phones keep the five goal choices discoverable; text still scales and scrolls. */
export function compactPhone(width: number, height: number, top = 0, bottom = 0, fontScale = 1) {
  const usableHeight = Math.max(0, height - top - bottom);
  return width < 375 || usableHeight < 740 || fontScale >= 1.5;
}

/** Geometry follows the viewport, including rotation, safe areas and future devices. */
export function screenGeometry(width: number, height: number, insets: { top: number; bottom: number; left: number; right: number }, fontScale = 1) {
  const usableWidth = Math.max(0, width - insets.left - insets.right);
  const usableHeight = Math.max(0, height - insets.top - insets.bottom);
  const compact = compactPhone(usableWidth, height, insets.top, insets.bottom, fontScale);
  return {
    usableWidth,
    usableHeight,
    compact,
    // A tall action area scrolls independently instead of squeezing the body away.
    footerMaxHeight: Math.max(44, usableHeight * (compact ? 0.38 : 0.45)),
    artMaxHeight: Math.min(220, usableHeight * (compact ? 0.2 : 0.3)),
  };
}

/**
 * The reading column (come alive, icons section 3.6): the first run's pages and
 * sheets sit in a centred 560-point column on an iPad, so a line of copy and a
 * row of choices stay the width a phone gives them rather than stretching
 * across the content column.
 */
export const READING = 560;

/** Regular width is based on usable space, including iPad split view. */
export function layoutClass(width: number, left: number, right: number): 'compact' | 'regular' {
  return width - left - right >= 700 ? 'regular' : 'compact';
}
export const FOOTER_MAX = 480;

/**
 * The reading size at which a row of action tiles stops fitting side by side:
 * the tab bar's threshold (`nav/LuvaniTabBar.tsx`), where words wrap under
 * their icons, so the two rows agree about what large text means.
 */
export const ACTION_ROW_WRAPS = 1.6;

/**
 * Below this a row of four or more tiles wraps two to a line at any reading
 * size: four tiles on a 375pt phone left a long label like "Pronunciation
 * lesson: Au café" clipped at its edge. Two and three keep sharing one line.
 */
export const ACTION_ROW_NARROW = 420;

/** Does a row of `count` action tiles wrap two to a line? */
export function actionRowWraps(count: number, width: number, fontScale: number): boolean {
  return fontScale >= ACTION_ROW_WRAPS || (count >= 4 && width < ACTION_ROW_NARROW);
}

// ───────────────────────────────────────────── scene cards (F920, decision 23)

/**
 * The yellow scene card: Speak's Recommended card (Today's `SceneLead` sizes itself, UI-015).
 * Side by side, the café drawing hangs off the top right (`artRight` is its
 * bleed past the card edge) and the title and line are held to `textWidth`,
 * the artboard's column. `rail` is what sits between the screen content and
 * the card (none for Speak; Today's scene card left with UI-015).
 */
export type SceneCard = { artWidth: number; artHeight: number; artRight: number; artTop: number; padding: number; textWidth: number };
export const SCENE_CARDS = {
  speak: { artWidth: 150, artHeight: 137, artRight: -10, artTop: 26, padding: 20, textWidth: 200 },
} as const satisfies Record<string, SceneCard>;
const SCENE_RAIL = { speak: 0 } as const;
/** Clear space kept between the words and the drawing. */
export const SCENE_ART_GAP = 12;
/** From this reading size the words outgrow their artboard column; the art goes above. */
export const SCENE_ART_LARGE_TEXT = 1.3;
/** The drawing in the band is a little smaller than beside the words. */
export const SCENE_ART_BAND = 0.8;

/**
 * The narrowest card that holds the words column and the drawing side by
 * side without touching: padding, the column, the gap, then the drawing less
 * its bleed (Speak 20 + 200 + 12 + 140 = 372),
 * raised to `SCENE_SIDE_MIN`, so the card switches at 400.
 */
export function sceneArtThreshold(card: SceneCard): number {
  return Math.max(SCENE_SIDE_MIN, card.padding + card.textWidth + SCENE_ART_GAP + card.artWidth + card.artRight);
}
/** Founder decision 23: under about 400pt of card the art goes above, whatever the arithmetic allows. */
export const SCENE_SIDE_MIN = 400;

/**
 * Side by side, the words column keeps at least this height, so every
 * full-width row after it (pills, the answer segment, the Uses chip) starts
 * clear below the art: art top + art height + gap, less the card padding.
 */
export function sceneColumnFloor(card: SceneCard): number {
  return card.artTop + card.artHeight + SCENE_ART_GAP - card.padding;
}

export function sceneArtPlacement(cardWidth: number, fontScale: number, card: SceneCard): 'side' | 'above' {
  return fontScale >= SCENE_ART_LARGE_TEXT || cardWidth < sceneArtThreshold(card) ? 'above' : 'side';
}

/** The drawing's size in the band: a little smaller, never wider than the words' width. */
export function sceneArtBand(card: SceneCard, cardWidth: number): { width: number; height: number } {
  const width = Math.max(1, Math.min(card.artWidth * SCENE_ART_BAND, cardWidth - card.padding * 2));
  return { width: Math.round(width), height: Math.round(width * card.artHeight / card.artWidth) };
}

/** The card's width before it has measured itself: the screen's content width less the rail. */
export function sceneCardFallbackWidth(kind: keyof typeof SCENE_CARDS, windowWidth: number, left = 0, right = 0): number {
  const inset = screenInsets(windowWidth, left, right);
  return Math.max(0, windowWidth - inset.paddingLeft - inset.paddingRight - SCENE_RAIL[kind]);
}

type Box = { x: number; y: number; w: number; h: number };
/** Where the drawing and the words column sit inside a card of this width. */
export function sceneCardGeometry(card: SceneCard, cardWidth: number, fontScale = 1): { placement: 'side' | 'above'; art: Box; text: Omit<Box, 'h'> & { minHeight: number }; band: { width: number; height: number } | null } {
  const placement = sceneArtPlacement(cardWidth, fontScale, card);
  if (placement === 'side') {
    return {
      placement,
      art: { x: cardWidth - card.artRight - card.artWidth, y: card.artTop, w: card.artWidth, h: card.artHeight },
      text: { x: card.padding, y: card.padding, w: card.textWidth, minHeight: sceneColumnFloor(card) },
      band: null,
    };
  }
  const band = sceneArtBand(card, cardWidth);
  return {
    placement,
    art: { x: (cardWidth - band.width) / 2, y: card.padding, w: band.width, h: band.height },
    text: { x: card.padding, y: card.padding + band.height + SCENE_ART_GAP, w: Math.max(0, cardWidth - card.padding * 2), minHeight: 0 },
    band,
  };
}

// ───────────────────────────────────────────── welcome stage (F921, 320pt)

/** The welcome artboard, drawn at 390 wide; a narrower screen scales the whole stage. */
export const WELCOME_STAGE = { width: 390, height: 320 } as const;
/** The three speech bubbles in stage units. */
export const WELCOME_BUBBLE_SPOTS = [
  { words: 'Bonjour !', left: 18, top: 26, rotate: '-6deg', tail: 'left' },
  { words: 'Un café ?', left: 258, top: 12, rotate: '5deg', tail: 'right' },
  { words: 'Enchanté', left: 262, top: 240, rotate: '-4deg', tail: 'left' },
] as const;
/** The art bleeds 24pt into each gutter of the 560pt reading column. */
const WELCOME_SPAN_MAX = 560 + 48;

export function welcomeStageScale(windowWidth: number): number {
  return Math.min(1, Math.min(windowWidth, WELCOME_SPAN_MAX) / WELCOME_STAGE.width);
}

/**
 * A bubble's left and right edge on screen. Width is a generous estimate of
 * the 17pt heavy words (0.62em a letter) plus the 14pt padding each side and
 * the rotation's few points; the stage is centred and scaled about its middle.
 */
export function welcomeBubbleSpan(windowWidth: number, spot: { words: string; left: number }): { left: number; right: number } {
  const scale = welcomeStageScale(windowWidth);
  const width = spot.words.length * 17 * 0.62 + 28 + 6;
  const origin = windowWidth / 2 - (WELCOME_STAGE.width / 2) * scale;
  return { left: origin + (spot.left - 3) * scale, right: origin + (spot.left - 3 + width) * scale };
}

// ───────────────────────────────────────────── onboarding footer (F921)

/**
 * Below this usable height a pinned footer (capped at 0.4 of the screen)
 * leaves the form about 90pt on a 568pt phone; the footer scrolls instead.
 */
export const FOOTER_SCROLLS_BELOW = 700;
export function footerInScroll(usableHeight: number): boolean {
  return usableHeight < FOOTER_SCROLLS_BELOW;
}

/**
 * The height the footer decision reads: the tallest window seen at this
 * width. On the web react-native-web measures `visualViewport`, which the
 * soft keyboard shrinks while typing; the keyboard never changes the width,
 * so a new width (rotation, split view) starts a fresh reading. The tallest
 * height is held only while a text field has focus; a desktop window dragged
 * shorter with nothing focused follows its real height. The screen
 * height is not used: on a desktop browser it is the monitor, not the window.
 */
export function footerHeightLatch(prev: { width: number; height: number } | null, width: number, height: number, typing: boolean): { width: number; height: number } {
  // Only a focused field can raise a soft keyboard; otherwise a shorter window is really shorter.
  if (!typing || prev === null || prev.width !== width) return { width, height };
  return { width, height: Math.max(prev.height, height) };
}

// ───────────────────────────────────── Today's scene hero (UI-015)

/** The scene hero's art tile, 108 by 84, and the 12pt gap to its words. */
export const SCENE_TILE = { width: 108, height: 84, gap: 12 } as const;
/** The narrowest words column beside the tile; under it the words go below. */
export const SCENE_TILE_WORDS_MIN = 120;

/**
 * Whether the scene hero's words sit beside its art tile. Below the words'
 * minimum, or at large text, the tile goes above full-width words, so the
 * title never runs under the art or wraps one word to a line.
 */
export function sceneTileSide(innerWidth: number, fontScale = 1): boolean {
  if (!Number.isFinite(innerWidth) || !Number.isFinite(fontScale)) return false;
  return fontScale < SCENE_ART_LARGE_TEXT && innerWidth - SCENE_TILE.width - SCENE_TILE.gap >= SCENE_TILE_WORDS_MIN;
}
