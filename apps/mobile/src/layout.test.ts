/**
 * The layout primitives, held to the source — F306.
 *
 * layout.tsx carries the shape every screen sits inside: the two screen roots,
 * the header row, the leave sheet. There is no renderer in this suite
 * (docs/TESTING.md), so the promises those roots make are checked by reading
 * the file the same way surfaceContract.test.ts reads a screen: strip the
 * comments, then assert on the markup that is left.
 *
 * Three promises are worth a tripwire, because each is a rule the transcript
 * already learned the hard way and a new root is the easy place to forget it:
 * a scroll body keeps taps while the keyboard is up, both roots carry the web
 * height fix so a flex child cannot refuse to shrink, and neither root ever
 * switches off or caps the OS reading size.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

/** Same treatment as surfaceContract.test.ts: comments may say anything. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * The layout source with comments gone. Read fresh in each test, so an absent
 * layout.tsx fails every one of these red rather than passing a negative check
 * on an empty string.
 */
function layoutSource(): string {
  return stripComments(readFileSync(join(SRC, 'layout.tsx'), 'utf8'));
}

/** The slice of source from one export marker up to the next. */
function region(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} is missing from layout.tsx`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} is missing from layout.tsx`);
  return source.slice(start, end);
}

/**
 * The tab header with its centred branch cut out.
 *
 * Alignment is the one thing in `TabHeader` that is allowed in exactly one
 * place and banned everywhere else, so the ban needs a slice that is honest
 * about where "everywhere else" is. Cutting the branch out and asserting on
 * what is left is stricter than asserting a count of `textAlign`: a count of
 * one passes just as happily when the one is in the left branch and the
 * centred branch has none.
 */
function outsideTheCentredBranch(header: string): string {
  const opens = header.indexOf("if (align === 'center') {");
  assert.notEqual(opens, -1, 'the tab header has no centred branch, so this split is reading the wrong file');
  const closes = header.indexOf('\n  return (', opens);
  assert.notEqual(closes, -1, 'the centred branch never gives way to the left one, so the split would swallow the whole header');
  return header.slice(0, opens) + header.slice(closes);
}

describe('the layout primitives keep their promises — F306', () => {
  test('the scroll screen keeps taps while the keyboard is up, by construction — F306', () => {
    const scroll = region(
      layoutSource(),
      'export function ScrollScreen(',
      'export function ScreenHeader(',
    );
    assert.match(
      scroll,
      /keyboardShouldPersistTaps="handled"/,
      'a tap on the scroll body while the keyboard is up dismisses the keyboard instead of landing',
    );
  });

  test('both screen primitives carry the web height fix the transcript already has — F306', () => {
    const source = layoutSource();
    const screen = region(source, 'export function Screen(', 'export function ScrollScreen(');
    const scroll = region(source, 'export function ScrollScreen(', 'export function ScreenHeader(');
    // minHeight 0 beside flex 1 is what stops a flex child from refusing to
    // shrink and pushing the controls off the bottom on the web column.
    const heightFix = /flex:\s*1,\s*minHeight:\s*0/;
    assert.match(screen, heightFix, 'Screen omits the minHeight:0 that the transcript proved it needs');
    assert.match(scroll, heightFix, 'ScrollScreen omits the minHeight:0 that the transcript proved it needs');
  });

  test('the screen primitives never disable or cap font scaling — F306', () => {
    const source = layoutSource();
    assert.doesNotMatch(
      source,
      /allowFontScaling\s*[=:]\s*\{?\s*false/,
      'a layout primitive switches off font scaling, so a learner with large text set does not get it',
    );
    assert.doesNotMatch(
      source,
      /maxFontSizeMultiplier/,
      'a layout primitive caps how far its text may grow, which is the same refusal wearing a number',
    );
    assert.doesNotMatch(source, /\bAlert\b/, 'a layout primitive reaches for Alert instead of ConfirmSheet');
  });

  /**
   * F388 narrowed this rule rather than deleting it.
   *
   * It used to ban the word `Animated` from the frame outright, on the reasoning that
   * movement belongs to the scenes. Home's rotating greeting made that too blunt: the
   * display style lives only in `layout.tsx` (F336), so the one place the title can fade
   * is inside `TabHeader`, and a tab that spread `type.display` into its own stylesheet
   * to get around that would break the older rule to satisfy this one.
   *
   * So the ban moves from the noun to the verb. The frame may hold an `Animated.Value`
   * somebody else drives and may render an `Animated.Text`; it may not start, loop or
   * sequence anything itself. A timer growing in this file still fails, which is what
   * the original assertion was actually protecting.
   */
  test('the screen primitives never drive movement themselves, and never cap font scaling — F388', () => {
    const source = layoutSource();
    assert.doesNotMatch(
      source,
      /Animated\.(timing|spring|loop|sequence|stagger|decay|parallel|delay)\b/,
      'a layout primitive drives an animation; the frame holds a value, it does not move on its own',
    );
    assert.doesNotMatch(
      source,
      /\.start\s*\(/,
      'a layout primitive starts an animation; whoever owns the value owns the timing',
    );
    assert.doesNotMatch(
      source,
      /createAnimatedComponent/,
      'a layout primitive wraps a component for animation, which the motion vocabulary forbids everywhere',
    );
    assert.doesNotMatch(
      source,
      /allowFontScaling\s*[=:]\s*\{?\s*false/,
      'a layout primitive switches off font scaling, so a learner with large text set does not get it',
    );
    assert.doesNotMatch(
      source,
      /maxFontSizeMultiplier/,
      'a layout primitive caps how far its text may grow, which is the same refusal wearing a number',
    );
  });
});

describe('the chrome primitives hold their shape — F331, F334, F335', () => {
  test('the tab header sets its title at display size, left, as a heading, with a purpose line beneath and nothing capped', () => {
    // TabHeader mounts in the scroll body, not the frame's header slot, so a
    // fixed display title over a purpose line can scroll rather than pin. The
    // title is the tab's name at display size, left, rolled as a heading; the
    // purpose is one plain body line under it. Nothing caps or truncates either.
    const header = region(layoutSource(), 'export function TabHeader(', 'type ConfirmSheetProps');
    assert.match(header, /marginBottom: space\(5\)/, 'the header block does not space itself off the body beneath it');
    assert.match(
      header,
      /flexDirection: 'row', alignItems: 'center', gap: space\(3\)/,
      'the title row is not a row with room for a trailing control',
    );
    assert.match(header, /accessibilityRole="header"/, 'the tab title is not rolled as a heading');
    assert.match(
      header,
      /type\.display,\s*\{ color: paper\.ink, flex: 1 \}/,
      'the title is not the display type in ink, taking the row',
    );
    assert.match(
      header,
      /type\.body,\s*\{ color: paper\.inkSoft, marginTop: space\(2\) \}/,
      'the purpose is not a soft-ink body line beneath the title',
    );
    // Nothing capped: no line cap, no growth cap, no scaling switch.
    assert.doesNotMatch(header, /numberOfLines/, 'the tab title is capped to a line count');
    assert.doesNotMatch(header, /maxFontSizeMultiplier/, 'the tab title caps how far it may grow');
    assert.doesNotMatch(header, /allowFontScaling/, 'the tab title opts out of the OS reading size');
    // And no centring outside the one branch that exists to centre. Four tabs
    // name a subject and read left; a `textAlign` reached for anywhere else in
    // this header is how the fifth quietly stops matching them.
    assert.doesNotMatch(
      outsideTheCentredBranch(header),
      /textAlign/,
      'the tab title is aligned away from the left outside the centred branch',
    );
  });

  test('the shared header keeps a slot at the touch floor on both sides, whether or not it holds a control', () => {
    // Three slots always. The left is the chevron at the touch floor or an empty
    // box its width; the right is the leave word at the floor or an empty box its
    // width; the title sits in the flex centre between them, not half a hit target
    // off it because one side was empty. The marginLeft:auto crutch is gone.
    const header = region(layoutSource(), 'export function ScreenHeader(', 'type TabHeaderProps');
    assert.match(header, /width: HIT, height: HIT/, 'the back chevron is not a slot at the touch floor');
    assert.match(header, /<View style=\{\{ width: HIT \}\} \/>/, 'the left slot collapses when there is no back control');
    assert.match(
      header,
      /minWidth: HIT, minHeight: HIT, alignItems: 'flex-end'/,
      'the leave word is not a right slot at the touch floor',
    );
    assert.match(header, /<View style=\{\{ minWidth: HIT \}\} \/>/, 'the right slot collapses when there is no leave control');
    assert.match(header, /flex: 1, alignItems: 'center'/, 'the title is not the centred flex slot between the two');
    assert.doesNotMatch(header, /marginLeft: 'auto'/, 'the header still shoves the leave word with marginLeft:auto');
  });

  test('a scroll screen under the tab bar pads its own bottom, and one that is not does not', () => {
    // The frame owns the air above the tab bar: the scroll content pads its own
    // bottom by space(8) only when it sits under the bar, so the last card clears
    // it without the tab padding its own scroll. A screen that is not under the
    // bar adds nothing here.
    const scroll = region(layoutSource(), 'export function ScrollScreen(', 'export function ScreenHeader(');
    assert.match(
      scroll,
      /bottom === 'tab' \? \{ paddingBottom: space\(8\) \} : null/,
      'the scroll content does not pad its bottom under the tab bar, or pads it unconditionally',
    );
  });

  test('DESIGN.md names the tab header and the monogram', () => {
    const design = readFileSync(join(SRC, '..', '..', '..', 'DESIGN.md'), 'utf8');
    assert.match(design, /TabHeader/, 'DESIGN.md does not name the tab header');
    assert.match(design, /Monogram/, 'DESIGN.md does not name the monogram');
  });
});

describe('the shared header may hold a title alone — F353', () => {
  test('the shared header takes a title with neither a back nor a leave, and still never both — F353', () => {
    // Onboarding's first page holds only the progress dots: a title, no back, no
    // leave. That typechecks only when both controls are optional inside their
    // branch — the type text carries `back?:` and `leave?:`, not the bare `back:`
    // and `leave:` that used to force a caller to choose one.
    const props = region(layoutSource(), 'type ScreenHeaderProps =', 'export function ScreenHeader(');
    assert.match(props, /back\?:\s*\{/, 'back is still a required key, so a title-only header does not typecheck');
    assert.match(props, /leave\?:\s*\{/, 'leave is still a required key, so a title-only header does not typecheck');
    // Never both: each branch still forbids the other with a `never`.
    assert.match(props, /leave\?: never/, 'the back branch no longer forbids leave, so a header could offer both');
    assert.match(props, /back\?: never/, 'the leave branch no longer forbids back, so a header could offer both');
  });
});

/**
 * The greeting moves as a word, not as a line — F418.
 *
 * Home's greeting used to cross-fade the whole line. The founder circled the word
 * alone and asked for a swipe that moves up to reveal the next greeting in that
 * placeholder, which makes the shape a slot the word travels through with the
 * learner's own name beside it.
 *
 * There is no renderer here, so what is checked is the construction — and the
 * construction is where every one of those promises actually lives. Three of them
 * are load-bearing enough to be worth a tripwire, and they are the three F427 left
 * standing when it took the ghost out of this slot and let the name travel:
 *
 * The strip rises exactly one rendered line, which is the line height times the
 * font scale, because a transform is in device pixels while the line height grows
 * with the reading size. Drop the scale and the swipe lands short of the next word
 * at every size but the default.
 *
 * The name sits outside the clipping slot. Inside it, a long name would be cut off
 * at the slot's width and would ride up with the word, which is the one thing the
 * founder asked not to happen. It moves horizontally with the swipe now (F427), and
 * that is a transform on a Text in the row, not a place inside the slot.
 *
 * And the row is one fixed announcement with no live region, because a header that
 * renames itself every few seconds and says so each time is the most hostile thing
 * this app could do to somebody listening to it.
 *
 * F427 retitled this test. It used to say `sized by the widest word`, and that
 * stopped being true the moment the slot began hugging the words themselves, so
 * the title moved with the behaviour rather than outliving it. What it still
 * proves is the part that did not change: one line of clipping, the name in
 * flow beside it, and a frame that starts nothing.
 */
describe('the greeting word rises through a fixed slot — F418', () => {
  test('the tab header clips the moving word to one line, keeps the name in flow, and starts nothing — F418', () => {
    const source = layoutSource();
    const header = region(source, 'export function TabHeader(', 'type ConfirmSheetProps');

    // The prop that arrived, and the two that left with Home's fade.
    const props = region(source, 'type TabHeaderProps = {', 'export function TabHeader(');
    assert.match(
      props,
      /titleSwap\?: TitleSwap \| null;/,
      'TabHeader takes no optional swap, so the only way to move a title is to spread the display line into a tab',
    );
    assert.doesNotMatch(
      source,
      /titleOpacity/,
      'the header still takes the fade opacity it replaced; two ways to move one title is how the five tabs drift apart',
    );
    assert.doesNotMatch(
      source,
      /titleAccessibilityLabel/,
      'the header still takes a separate spoken label; with a swap the still line IS the label, and a second one can disagree with it',
    );

    const swapType = region(source, 'export interface TitleSwap {', 'type TabHeaderProps = {');
    for (const field of [
      'word: string;',
      'next: string;',
      'rest: string | null;',
      'progress: Animated.Value;',
    ]) {
      assert.ok(
        swapType.includes(field),
        `TitleSwap is missing \`${field}\`: the header needs the word showing, the word arriving, the name or its absence, and the value somebody else drives`,
      );
    }
    // The widest word sized the slot until F427 and sizes nothing now, so it is
    // gone from the contract entirely rather than left behind as a field every
    // new caller would have to invent a value for. It was optional for exactly
    // as long as `home/` had not yet dropped it, which it has.
    assert.ok(
      !swapType.includes('widest'),
      'TitleSwap still carries the widest word, which sizes nothing since F427 and would have every caller invent one',
    );
    // The two words cross, so it reads as a replacement rather than a slide.
    const leavingAt = header.search(
      /opacity: swap\.progress\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[1, 0\] \}\)/,
    );
    const arrivingAt = header.search(
      /opacity: swap\.progress\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[0, 1\] \}\)/,
    );
    assert.ok(
      leavingAt !== -1 && arrivingAt !== -1,
      'the two words do not cross-fade across the swipe, so a strip is seen sliding rather than a word being replaced',
    );
    const wordAt = header.indexOf('{swap.word}');
    const nextAt = header.indexOf('{swap.next}');
    assert.ok(
      leavingAt < wordAt && wordAt < arrivingAt && arrivingAt < nextAt,
      'the fades are on the wrong words: the word showing now must be the one going to 0, and the word rising in the one coming from 0',
    );

    // The name is outside the slot, joined to the word by a space that scales.
    const stripCloses = header.indexOf('</Animated.View>');
    const slotCloses = header.indexOf('</View>', stripCloses);
    const nameAt = header.indexOf('swap.rest');
    assert.ok(
      stripCloses !== -1 && slotCloses !== -1 && nameAt > slotCloses,
      'the name is drawn inside the clipped slot, where a long one is cut off at the ghost and rides up with the word',
    );
    assert.match(
      header,
      /color: paper\.ink,\s*flexShrink: 1,/,
      'the name is not display type that may shrink, so a long one pushes the row instead of giving way',
    );
    assert.match(
      header,
      /\{'\\u00A0' \+ swap\.rest\}/,
      'the name is not joined to the word by a non-breaking space, so the gap either stops scaling with the type or breaks across a line',
    );
    assert.match(
      header,
      /flexWrap: 'wrap'/,
      'the title row does not wrap, so at the largest reading size a long name breaks mid-word instead of dropping to a second line',
    );

    // One greeting, said once, and never re-announced.
    assert.match(
      header,
      /accessible\s+accessibilityRole="header"\s+accessibilityLabel=\{title\}/,
      'the moving row is not one accessible heading labelled with the still line, so a screen reader reads the slot word by word',
    );
    assert.doesNotMatch(
      header,
      /accessibilityLiveRegion|aria-live/,
      'the greeting is a live region, so assistive tech announces a new greeting every few seconds',
    );

    // The plain branch the other four tabs still render, and nothing capped.
    assert.match(
      header,
      /<Text accessibilityRole="header" style=\{\[type\.display, \{ color: paper\.ink, flex: 1 \}\]\}>\s*\{title\}\s*<\/Text>/,
      'a tab without a swap no longer gets the bare display heading it has always had',
    );
    assert.doesNotMatch(
      header,
      /numberOfLines|ellipsizeMode/,
      'the header truncates a title, which at the largest reading size is how a name disappears',
    );

    // The frame holds the value; it does not drive it.
    assert.doesNotMatch(
      header,
      /Animated\.(timing|spring|loop|sequence|stagger|decay|parallel|delay)\b/,
      'the header drives the swipe itself; whoever owns the value owns the timing, and only they can stop it off-screen or under reduce motion',
    );
    assert.doesNotMatch(
      header,
      /\.start\s*\(/,
      'the header starts an animation, so the frame now owns a timer it cannot pause',
    );
  });
});

/**
 * The word hugs the name, and the name travels — F427.
 *
 * F418 sized the slot to a ghost of the widest word the pool could produce, so the
 * name never had to move. The founder ran it and sent back a screenshot: measured
 * at 375pt, `Hello,` left 47pt of daylight before the name and `Salut,` left 50pt,
 * which in that face is eight spaces. It reads as a hole, not a space.
 *
 * A gap-free line and a name that never moves are the same tradeoff seen from two
 * sides. If the word is always tight against the name then the name's resting place
 * depends on the word's width, and a wider word must push it right. There is no
 * arrangement where both hold. So the name moves, and it moves as part of the swipe.
 *
 * The shape that makes that continuous, and the four places it can be got wrong:
 *
 * The slot holds both real words in normal flow, one under the other, so it is as
 * wide as the wider of the two and no ghost is needed. The words inside it must be
 * `flex-start`, not stretched: a stretched child reports the slot's width to
 * `onLayout` rather than its own, both words measure the same, the difference goes
 * to zero and the hole comes straight back.
 *
 * The name is pulled back onto whichever word is showing, by a `translateX` that
 * runs the difference between the two measured widths across the same `progress`
 * the words ride. At the commit `progress` snaps to 0 and the arriving word becomes
 * the current one: the flow width changes by exactly that difference in the same
 * frame the transform returns from it to zero, and the two cancel. That is the whole
 * reason the name arrives rather than jumping, and it only holds while the travel is
 * measured from the words themselves — which is why F428 keys the widths by the
 * string that drew them. Held by slot they described the previous pair on the one
 * frame the cancellation depends on, and the test below it says so in numbers.
 *
 * Nothing in the slot may be positioned absolutely. An absolute child is measured
 * against its owner's width — Yoga constrains it deliberately so text wraps to its
 * owner, and `react-native-web` gives every Text `word-wrap: break-word` — so a word
 * wider than the one showing would arrive broken mid-word: `Bonjour,` rising into a
 * `Hello,`-sized box shows as `Bonjou`.
 *
 * And the travel stands down once the name has wrapped to its own line, which is
 * what happens at the largest reading sizes. There the name is not beside the word,
 * so there is no gap to close, and pulling it left would walk the learner's own name
 * off the edge of the screen.
 */
describe('the greeting word hugs the name — F427', () => {
  test('the greeting word hugs the name, and the name travels with the swipe rather than jumping — F427', () => {
    const source = layoutSource();
    const header = region(source, 'export function TabHeader(', 'type ConfirmSheetProps');

    // The ghost is gone. It is the gap: a slot sized for `Morning,` is 47pt too
    // wide for `Hello,` at every reading size, not just one.
    assert.doesNotMatch(
      header,
      /swap\.widest/,
      'the header still draws the widest word to size its slot, which is the hole the founder photographed',
    );
    assert.doesNotMatch(
      header,
      /opacity: 0 \}/,
      'something in the header is drawn at zero opacity, which is a ghost by another name',
    );

    // The slot takes its width from the words in it, is exactly one line tall,
    // and still clips, so the arriving word does not exist until it arrives.
    assert.doesNotMatch(
      header,
      /\bwidth:/,
      'the slot is given a width; it has to be automatic, because a width that is not the current word is the gap',
    );
    assert.match(
      header,
      /<View style=\{\{ height: line, overflow: 'hidden' \}\} \{\.\.\.decorative\}>/,
      'the slot is not one computed line tall and clipping, so both words show at once or the next one hangs below the line',
    );

    // Both words sit in normal flow. An absolute one is measured against the
    // slot's width and arrives broken mid-word.
    assert.doesNotMatch(
      header,
      /position: 'absolute'/,
      'a word is positioned absolutely, so it is measured against the slot and a wider one arrives as `Bonjou`',
    );
    assert.match(
      header,
      /alignItems: 'flex-start'/,
      'the two words are stretched to the slot instead of hugging their own text, so both measure the same width and the name never travels',
    );

    // Both words are measured, and the name knows when it has left the row.
    assert.match(
      source,
      /import \{[^}]*\buseState\b[^}]*\} from 'react';/,
      'the header holds no state, so it cannot know how far the name has to travel',
    );
    // F428 moved the widths from two positional slots to one map keyed by the
    // string that drew them. What F427 defends is that both words are measured
    // at all and that the travel is their difference, so these follow the shape;
    // pinning the positional pair here would have pinned the stale-frame bug.
    assert.match(
      header,
      /const \[widths, setWidths\] = useState<Record<string, number>>\(\{\}\);/,
      'the drawn widths are not held, so the header cannot know how far the name has to travel',
    );
    assert.match(
      header,
      /onLayout=\{\(e\) => measure\(swap\.word, e\.nativeEvent\.layout\.width\)\}/,
      'the word showing is not measured, so its width is a guess',
    );
    assert.match(
      header,
      /onLayout=\{\(e\) => measure\(swap\.next, e\.nativeEvent\.layout\.width\)\}/,
      'the word arriving is not measured, so its width is a guess',
    );
    assert.match(
      header,
      /onLayout=\{\(e\) => setNameTop\(e\.nativeEvent\.layout\.y\)\}/,
      'the name never reports which line it is on, so the travel cannot stand down when it wraps',
    );

    // The travel: the difference between the two measured words, pulled back onto
    // whichever one is showing, and nothing at all once the name has wrapped.
    assert.match(
      header,
      /const grow =[^;]*arrivingWidth - shownWidth[^;]*;/,
      'the travel is not the difference between the two measured words, so the name cannot land tight against either',
    );
    assert.match(
      header,
      /const beside = nameTop < line \/ 2;/,
      'nothing decides whether the name is still beside the word, so a wrapped name is dragged off the left edge',
    );
    assert.match(
      header,
      /const nameFrom = beside \? -Math\.max\(grow, 0\) : 0;/,
      'the name does not start pulled back onto the word showing, which is the gap it was sent back for',
    );
    assert.match(
      header,
      /const nameTo = beside \? Math\.min\(grow, 0\) : 0;/,
      'the name does not end pulled back onto the word arriving, so the swipe lands with a hole or an overlap',
    );
    assert.match(
      header,
      /translateX: swap\.progress\.interpolate\(\{\s*inputRange: \[0, 1\],\s*outputRange: \[nameFrom, nameTo\],?\s*\}\)/,
      'the name does not travel the difference across the same progress the words ride, so it jumps at the commit instead of arriving',
    );

    // A transform may move; a layout prop may not.
    assert.doesNotMatch(
      header,
      /(width|height|left|top): [\w.]*\.interpolate\(/,
      'an interpolation is handed to a layout prop, which is a layout pass a frame and cannot cross to the native driver',
    );

    // Still nobody's timer.
    assert.doesNotMatch(
      header,
      /Animated\.(timing|spring|loop|sequence|stagger|decay|parallel|delay)\b/,
      'the header drives the swipe itself; whoever owns the value owns the timing',
    );
    assert.doesNotMatch(header, /\.start\s*\(/, 'the header starts an animation, so the frame owns a timer it cannot pause');
    assert.doesNotMatch(header, /createAnimatedComponent/, 'the header wraps a component for animation, which the motion vocabulary forbids');
  });
});
/**
 * The travel is right on the frame the words change — F428.
 *
 * F427 held the two widths by position: `wordWidth` was whatever the strip's
 * upper line last reported, `nextWidth` whatever the lower one did, and `grow`
 * was their difference. Both are one render stale at exactly the frame they
 * matter. At a commit the rotation re-renders with the new `swap.word` and
 * `swap.next` and `progress` back at 0. The slot's flow width is already right,
 * because it comes from the real text — but `onLayout` for the new pair cannot
 * have fired yet, since it fires after the new render is laid out. So the
 * transform still described the pair that had just left.
 *
 * Walked with the drawn widths at 375pt (Salut 90, Bonjour 133, Hello 93, Coucou
 * 125, Morning 140): on `Salut, -> Bonjour,` with `Hello,` next, the slot is
 * already 133 wide while `grow` is still +43, so `translateX` is -43 and the name
 * is drawn 43pt inside `Bonjour,` until the measurement lands. On `Bonjour, ->
 * Hello,` with `Coucou,` next, `grow` is still -40, so the transform is 0 while
 * the slot is Coucou-wide and the hole F427 closed reopens. `Morning, -> Salut,`
 * reopens the original 43pt hole. Four of the five morning transitions glitched.
 * The resting-state measurement that passed F427 only ever sampled settled
 * frames, which is why it saw none of it.
 *
 * Keying the widths by the string that drew them is the whole fix. The `(word,
 * next)` pair becomes a lookup by text, and by the time a pair reaches a commit
 * both of its words have been through the slot already: the word showing was the
 * strip's lower line for the cycle before, and the word arriving went through on
 * an earlier turn of the pool. Only a word's very first appearance is unmeasured,
 * and there the travel is zero — the same honest answer as the first frame before
 * anything is measured at all, and a frame with no travel is a gap for one frame
 * where the stale pair was an overlap.
 *
 * There is no renderer in this suite, so a commit cannot be driven. What is
 * proved here is the structure that makes the stale frame impossible: one map
 * keyed by text, each word writing under its own string, `grow` looked up by
 * `swap.word` and `swap.next` rather than by slot, zero travel while either word
 * is unmeasured, and a guarded write — `onLayout` fires on every relayout, and a
 * fresh object on each one is a render loop rather than a measurement.
 */
describe('the greeting travels by word, not by slot — F428', () => {
  test("the name's travel is right on the frame the words change, not one layout later — F428", () => {
    const header = region(
      layoutSource(),
      'export function TabHeader(',
      'type ConfirmSheetProps',
    );

    // One map, keyed by the string that drew the width, and no width left over
    // that belongs to a slot instead of to a word.
    assert.match(
      header,
      /const \[widths, setWidths\] = useState<Record<string, number>>\(\{\}\);/,
      'the drawn widths are not one map keyed by string, so a width still belongs to a slot rather than to the word in it',
    );
    assert.doesNotMatch(
      header,
      /setWordWidth|setNextWidth/,
      'a width is still held by position, and a positional width describes the previous pair on the frame the words change',
    );

    // Each word reports under its own text. The order pins which is which: a
    // word that wrote under the other word's key would mislabel every
    // measurement by one slot and read as correct from a distance.
    const writesWord = header.indexOf('measure(swap.word, e.nativeEvent.layout.width)');
    const drawsWord = header.indexOf('{swap.word}');
    const writesNext = header.indexOf('measure(swap.next, e.nativeEvent.layout.width)');
    const drawsNext = header.indexOf('{swap.next}');
    assert.ok(
      writesWord !== -1 && writesNext !== -1,
      'the words are not measured under their own text, so the map is keyed by something other than what was drawn',
    );
    assert.ok(
      writesWord < drawsWord && drawsWord < writesNext && writesNext < drawsNext,
      "a word reports its width under the other word's key, which mislabels every measurement by one slot",
    );

    // The travel is a lookup by text, with zero standing in for a word nobody
    // has drawn yet — never a difference against a missing width.
    assert.match(
      header,
      /const shownWidth = widths\[swap\.word\];/,
      'the width of the word showing is not looked up by the word showing',
    );
    assert.match(
      header,
      /const arrivingWidth = widths\[swap\.next\];/,
      'the width of the word arriving is not looked up by the word arriving',
    );
    assert.match(
      header,
      /const grow =\s*shownWidth != null && arrivingWidth != null \? arrivingWidth - shownWidth : 0;/,
      'grow is not the difference between the two words looked up by text, standing down to no travel while either is unmeasured',
    );
    assert.doesNotMatch(
      header,
      /nextWidth - wordWidth/,
      'grow is still the difference between two positional widths, which is the pair that just left rather than the pair on screen',
    );

    // The write is guarded, because onLayout fires on every relayout and a fresh
    // object every time re-renders, relays out, and writes again.
    assert.match(
      header,
      /setWidths\(\(seen\) => \(seen\[text\] === drawn \? seen : \{ \.\.\.seen, \[text\]: drawn \}\)\);/,
      'the measurement writes state on every layout pass instead of only when a width changed, which is a render loop',
    );
  });
});

/**
 * One tab is a person, and it is the only one that centres — F576.
 *
 * Four tabs name a subject and read left, because a left edge is where the eye
 * starts a line and four headers that agree are most of what makes an app feel
 * like one app. Profile is the exception the mockup draws: it opens on the
 * learner's own mark with their name under it, and a centred column is the only
 * honest way to draw a header that is a person rather than a subject.
 *
 * So centring is a branch of the one header rather than a `textAlign` a tab may
 * reach for, and this is the test that keeps it that way. It is written as two
 * halves on purpose. The half above proves the centred branch really does
 * everything centring needs — the column, the alignment, the mark above the
 * title — and the half in `the chrome primitives hold their shape` proves that
 * alignment appears nowhere else in the file. Either one alone is satisfied by
 * a header that centres nothing and by a header that centres everything.
 */
describe('a header that is a person, not a subject — F576', () => {
  test('a tab header can centre itself for the one tab that is a person, and only then', () => {
    const source = layoutSource();

    // The two props that arrived, and the default that keeps the other four
    // tabs where they were without touching a line of them.
    const props = region(source, 'type TabHeaderProps = {', 'export function TabHeader(');
    assert.match(props, /align\?: 'left' \| 'center';/, 'the header cannot be asked to centre, so Profile would have to align its own title');
    assert.match(props, /leading\?: ReactNode;/, 'the header takes no mark above its title, so the learner has nowhere to be drawn');

    const header = region(source, 'export function TabHeader(', 'type ConfirmSheetProps');
    assert.match(
      header,
      /align = 'left'/,
      'the header does not default to the left, so a tab that says nothing about alignment could drift',
    );

    const opens = header.indexOf("if (align === 'center') {");
    assert.notEqual(opens, -1, 'the header has no centred branch at all');
    const centred = header.slice(opens, header.indexOf('\n  return (', opens));

    // A column, centred, with the alignment the left branch is forbidden.
    assert.match(centred, /alignItems: 'center'/, 'the centred header does not centre its column, so a short purpose line hangs left');
    assert.match(centred, /textAlign: 'center'/, 'the centred header centres the box but not the words inside it, which is the same header wearing a different bug');
    assert.match(centred, /accessibilityRole="header"/, 'the centred title is not rolled as a heading, so a screen reader cannot jump to it');

    // The mark is drawn ABOVE the title. Below it, it is a signature rather
    // than the learner, which is the whole point of the centred tab.
    const leadingAt = centred.indexOf('leading != null');
    const titleAt = centred.indexOf('{title}');
    assert.ok(leadingAt !== -1, 'the centred header never draws the mark it was given');
    assert.ok(titleAt !== -1, 'the centred header never draws its title');
    assert.ok(leadingAt < titleAt, 'the mark is drawn under the title rather than above it');

    // And only then. The centred branch is not a second header: no moving word,
    // no trailing control, nothing capped.
    assert.doesNotMatch(
      centred,
      /titleSwap|TitleSwapRow/,
      'the centred header draws the greeting swap, which belongs to Home and to the left',
    );
    assert.doesNotMatch(
      centred,
      /trailing/,
      'the centred header draws a trailing control, which pulls a centred title off centre',
    );
    assert.doesNotMatch(
      centred,
      /numberOfLines|ellipsizeMode|maxFontSizeMultiplier|allowFontScaling/,
      'the centred header caps or truncates its title, which at the largest reading size is how a name disappears',
    );
  });
});
