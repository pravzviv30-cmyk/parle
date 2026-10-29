import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { navigationWidth, screenInsets, screenGeometry, compactPhone, layoutClass, FOOTER_MAX, actionRowWraps, ACTION_ROW_WRAPS } from './responsiveLayout.ts';

test('phone content respects left and right safe areas', () => {
  assert.deepEqual(screenInsets(390, 0, 0), { paddingLeft: 20, paddingRight: 20 });
  assert.deepEqual(screenInsets(700, 44, 12), { paddingLeft: 64, paddingRight: 32 });
  assert.deepEqual(screenInsets(390, 0, 0, false), { paddingLeft: 0, paddingRight: 0 });
});

test('short safe viewports and large text compress decoration before content', () => {
  assert.equal(compactPhone(375, 812, 44, 34), true);
  assert.equal(compactPhone(390, 844, 47, 34), false);
  assert.equal(compactPhone(430, 932, 59, 34, 1.8), true);
  assert.equal(compactPhone(812, 375, 0, 21), true);
});

test('iPhone-sized, landscape and unfamiliar viewports leave room for content and controls', () => {
  const viewports = [[320, 568], [375, 812], [390, 844], [393, 852], [402, 874], [414, 896], [430, 932], [440, 956], [812, 375], [700, 720]];
  for (const [width, height] of viewports) for (const fontScale of [1, 1.5, 2, 3]) {
    const insets = height! > width! ? { top: 59, bottom: 34, left: 0, right: 0 } : { top: 0, bottom: 21, left: 44, right: 44 };
    const frame = screenGeometry(width!, height!, insets, fontScale);
    assert.equal(frame.usableWidth, width! - insets.left - insets.right);
    assert.equal(frame.usableHeight, height! - insets.top - insets.bottom);
    assert.ok(frame.footerMaxHeight >= 44, 'primary controls keep a touch target');
    assert.ok(frame.footerMaxHeight <= frame.usableHeight * 0.45);
    assert.ok(frame.artMaxHeight <= frame.usableHeight * 0.3, 'art gives space to readable text');
    assert.ok(frame.usableHeight - frame.footerMaxHeight > 100, 'the body remains scrollable');
  }
});

test('iPad reading width is bounded and split view returns to phone geometry', () => {
  for (const width of [834, 1024, 1194, 1366]) {
    const inset = screenInsets(width, 0, 0);
    assert.equal(width - inset.paddingLeft - inset.paddingRight, 760);
  }
  assert.deepEqual(screenInsets(375, 0, 0), { paddingLeft: 20, paddingRight: 20 });
});

test('navigation stays compact on iPad and fits narrow phones', () => {
  assert.equal(navigationWidth(320, 0, 0), 304);
  assert.equal(navigationWidth(390, 0, 0), 374);
  assert.equal(navigationWidth(600, 44, 12), 528);
  assert.equal(navigationWidth(834, 0, 0), 640);
  assert.equal(navigationWidth(1366, 0, 0), 640);
});

test('app tab headers do not render the retired website masthead', () => {
  const layout = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /Le français, pour la vie\./);
  assert.doesNotMatch(layout, /Luvani · Your French journal/);
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /maxWidth: 460/, 'iPad must not be constrained by the retired phone-only shell');
});


test('regular columns follow usable width and return to a stack in split view', () => {
  assert.equal(layoutClass(699, 0, 0), 'compact');
  assert.equal(layoutClass(700, 0, 0), 'regular');
  assert.equal(layoutClass(744, 24, 24), 'compact');
  assert.equal(layoutClass(834, 0, 0), 'regular');
  assert.equal(layoutClass(390, 0, 0), 'compact');
  assert.equal(FOOTER_MAX, 480);
});


test('on a regular-width screen the tabs use two columns and sheets keep the reading width', () => {
  // 2026-10-20, B1, B-Explore: Explore splits its sections into two columns too.
  // 2026-10-29 (F934, founder decision 6): Today leads with one ordered path,
  // which reads top to bottom at every width, so Home left this list.
  for (const file of ['tabs/ExploreTab.tsx', 'tabs/MyFrenchTab.tsx', 'tabs/PracticeTab.tsx']) {
    assert.match(readFileSync(new URL(file, import.meta.url), 'utf8'), /<Columns>/, file);
  }
  // 2026-10-20, B1, B-Explore: inside a column the topic and practice tiles
  // still drop to one under 350pt or at 1.5x text.
  const explore = readFileSync(new URL('tabs/ExploreTab.tsx', import.meta.url), 'utf8');
  assert.match(explore, /width < 350 \|\| fontScale >= 1\.5/, 'Explore lost its one-column fallback');
  const layout = readFileSync(new URL('layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /fontScale >= 1\.6/);
  assert.match(layout, /flexDirection: regular \? 'row' : 'column'/);
  const components = readFileSync(new URL('components.tsx', import.meta.url), 'utf8');
  assert.match(components, /maxWidth: READING/);
});

test('action tiles wrap two to a line at large text, and four on a narrow phone', () => {
  assert.equal(ACTION_ROW_WRAPS, 1.6, 'the action row left the tab bar\'s large-text threshold');
  // Four on a 375pt phone clipped the lesson door's label.
  assert.equal(actionRowWraps(4, 375, 1), true);
  assert.equal(actionRowWraps(4, 419, 1), true);
  assert.equal(actionRowWraps(4, 420, 1), false);
  // Two and three keep one line on the same phone.
  assert.equal(actionRowWraps(3, 375, 1), false);
  assert.equal(actionRowWraps(2, 320, 1), false);
  // Large text wraps any row, at any width.
  assert.equal(actionRowWraps(2, 1024, 1.6), true);
  assert.equal(actionRowWraps(3, 1024, 1.59), false);
});

test('scene card art never overlaps the title or duration at 320 and 375 points', async () => {
  const layout: Record<string, unknown> = await import('./responsiveLayout.ts');
  const { SCENE_CARDS, sceneCardGeometry, sceneCardFallbackWidth, sceneArtPlacement } = layout as typeof import('./responsiveLayout.ts');
  assert.equal(typeof sceneCardGeometry, 'function', 'the scene card has no shared geometry');
  type Box = { x: number; y: number; w: number; h: number };
  const meets = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const [name, card] of Object.entries(SCENE_CARDS)) {
    for (const screen of [320, 375, 390, 768]) for (const fontScale of [1, 1.5]) {
      const width = sceneCardFallbackWidth(name as keyof typeof SCENE_CARDS, screen);
      const frame = sceneCardGeometry(card, width, fontScale);
      // The title, the line with its time and the chips: tall enough for any wrap.
      const text = { ...frame.text, h: 2000 };
      assert.ok(!meets(frame.art, text), `${name} at ${screen}pt, text x${fontScale}: the art covers the title or time`);
      assert.ok(frame.text.x >= card.padding && frame.text.x + frame.text.w <= width - card.padding, `${name} at ${screen}pt: the words leave the card`);
      assert.ok(frame.art.w > 0 && frame.art.h > 0 && frame.art.w <= Math.max(card.artWidth, width));
      assert.ok(Math.abs(frame.art.w / frame.art.h - card.artWidth / card.artHeight) < 0.01, 'the drawing keeps its shape');
      if (frame.placement === 'above') assert.ok(frame.art.x >= 0 && frame.art.x + frame.art.w <= width, `${name} at ${screen}pt: the band art leaves the card`);
    }
    // Phones and large text take the band; a tablet column keeps today's side-by-side card unchanged.
    for (const screen of [320, 375, 390]) assert.equal(sceneArtPlacement(sceneCardFallbackWidth(name as keyof typeof SCENE_CARDS, screen), 1, card), 'above', `${name} at ${screen}pt`);
    assert.equal(sceneArtPlacement(sceneCardFallbackWidth(name as keyof typeof SCENE_CARDS, 768), 1, card), 'side', `${name} at 768pt`);
    assert.equal(sceneArtPlacement(sceneCardFallbackWidth(name as keyof typeof SCENE_CARDS, 768), 1.5, card), 'above', `${name} at 768pt, large text`);
    const side = sceneCardGeometry(card, 700, 1);
    assert.deepEqual([side.art.w, side.art.h, side.text.w], [card.artWidth, card.artHeight, card.textWidth], 'the wide card moved');
  }
  // Both cards draw from the shared geometry and measure themselves.
  const parts = readFileSync(new URL('./today/TodayParts.tsx', import.meta.url), 'utf8');
  const lead = parts.slice(parts.indexOf('export function SceneLead('), parts.indexOf('export function PhraseCard('));
  const tutor = readFileSync(new URL('./tabs/TutorTab.tsx', import.meta.url), 'utf8');
  for (const [where, body, key] of [['SceneLead', lead, 'today'], ['Speak', tutor, 'speak']] as const) {
    assert.match(body, new RegExp(`sceneCardGeometry\\(SCENE_CARDS\\.${key}, `), `${where} does not place its art from the shared geometry`);
    assert.match(body, new RegExp(`sceneCardFallbackWidth\\('${key}', `), `${where} has no first-frame width`);
    assert.match(body, /onLayout=\{/, `${where} does not measure its own width`);
  }
});

test('welcome bubbles stay on screen at 320 points', async () => {
  const layout: Record<string, unknown> = await import('./responsiveLayout.ts');
  const { WELCOME_BUBBLE_SPOTS, welcomeBubbleSpan, welcomeStageScale } = layout as typeof import('./responsiveLayout.ts');
  assert.ok(Array.isArray(WELCOME_BUBBLE_SPOTS) && WELCOME_BUBBLE_SPOTS.length === 3, 'the welcome bubbles are not shared geometry');
  for (const screen of [320, 360, 375, 390, 430]) for (const spot of WELCOME_BUBBLE_SPOTS) {
    const span = welcomeBubbleSpan(screen, spot);
    assert.ok(span.left >= 0, `"${spot.words}" starts at ${span.left.toFixed(1)}pt on a ${screen}pt screen`);
    assert.ok(span.right <= screen, `"${spot.words}" ends at ${span.right.toFixed(1)}pt on a ${screen}pt screen`);
  }
  assert.equal(welcomeStageScale(390), 1, '390 keeps the artboard');
  assert.equal(welcomeStageScale(430), 1);
  assert.ok(welcomeStageScale(320) < 1);
  const parts = readFileSync(new URL('./onboarding/BOnboardingParts.tsx', import.meta.url), 'utf8');
  const art = parts.slice(parts.indexOf('export function BWelcomeArt('), parts.indexOf('export function BWelcomeChip('));
  assert.match(art, /welcomeStageScale\(/, 'the welcome stage does not fit the screen');
  assert.match(art, /WELCOME_BUBBLE_SPOTS/, 'the welcome draws bubbles the geometry test does not see');
});

test('welcome and sign-up footers scroll below 700 points of height', async () => {
  const layout: Record<string, unknown> = await import('./responsiveLayout.ts');
  const { footerInScroll } = layout as typeof import('./responsiveLayout.ts');
  assert.equal(typeof footerInScroll, 'function', 'no shared rule for when the onboarding footer scrolls');
  // iPhone SE (568, 667) and short landscape windows scroll; a 375x812 phone keeps its pinned footer.
  for (const usable of [480, 548, 647, 699]) assert.equal(footerInScroll(usable), true, `${usable}pt`);
  for (const usable of [700, 719, 812 - 44 - 34, 844 - 47 - 34]) assert.equal(footerInScroll(usable), false, `${usable}pt`);
  const frame = readFileSync(new URL('./onboarding/OnboardingLayout.tsx', import.meta.url), 'utf8');
  assert.match(frame, /footerInScroll\(height - insets\.top - insets\.bottom\)/, 'the onboarding frame does not choose the scrolling footer from the usable height');
  // Welcome (PreAccountOnboarding) and sign-up both draw through this frame.
  assert.match(readFileSync(new URL('./onboarding/PreAccountOnboarding.tsx', import.meta.url), 'utf8'), /<OnboardingLayout\b[\s\S]*?footer=\{footer\}/);
  assert.match(readFileSync(new URL('./auth/SignUpScreen.tsx', import.meta.url), 'utf8'), /<OnboardingLayout\b/);
});
