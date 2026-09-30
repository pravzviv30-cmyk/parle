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
    // Three slots always. The left is the round back button, a disc at the
    // touch floor (components.tsx draws it at HIT), or an empty box its width;
    // the right is the leave word at the floor or an empty box its width; the
    // title sits in the flex centre between them, not half a hit target off it
    // because one side was empty. The marginLeft:auto crutch is gone.
    const header = region(layoutSource(), 'export function ScreenHeader(', 'type TabHeaderProps');
    assert.match(header, /<RoundButton kind="back"/, 'the back control is not the round button at the touch floor');
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

  test('the pushed header\'s way back is a 44 round white button', () => {
    // Revamp B, F597: SNIPPETS header-pushed. The way back is the white disc at
    // the touch floor with the ICONS.md back mark, drawn once in components.tsx,
    // rather than a bare chevron this file lays out itself. The name still
    // falls back to Back when the caller gives none.
    const header = region(layoutSource(), 'export function ScreenHeader(', 'type TabHeaderProps');
    assert.match(
      header,
      /<RoundButton kind="back" onPress=\{back\.onPress\} accessibilityLabel=\{back\.label \?\? 'Back'\} \/>/,
      'the pushed header does not go back through the round button, or lost its fallback name',
    );
    assert.doesNotMatch(header, /<ChevronLeft/, 'the header draws a bare chevron again beside the round button');
    const round = readFileSync(join(SRC, 'components.tsx'), 'utf8');
    const at = round.indexOf('export function RoundButton(');
    assert.notEqual(at, -1, 'components.tsx has no RoundButton for the header to use');
    const button = round.slice(at, round.indexOf('\nexport ', at + 1));
    assert.match(button, /const disc = next \? HIT \+ space\(5\) : HIT;/, 'the back disc is not at the touch floor');
    assert.match(button, /ground === 'white' \? paper\.card/, 'the back disc is not white');
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
 * The greeting moves as one complete phrase through a clipped line — F418.
 *
 * Both visual lines share the same geometry and travel exactly one rendered
 * line. The name therefore follows its greeting without a second correction,
 * while the full-height separation keeps the two phrases from doubling over
 * each other at the middle of the animation.
 *
 * The visual layers remain one fixed accessibility announcement with no live
 * region, and the fixed-height animation stands down before Dynamic Type needs
 * the title to wrap.
 */
describe('the greeting word rises through a fixed slot — F418', () => {
  test('the tab header is a static accessible heading with no swap API or animation — F418', () => {
    const source = layoutSource();
    const header = region(source, 'export function TabHeader(', 'type ConfirmSheetProps');
    const props = region(source, 'type TabHeaderProps = {', 'export function TabHeader(');
    assert.doesNotMatch(props, /titleSwap\??:|TitleSwap/);
    assert.doesNotMatch(header, /Animated|TitleSwapRow|\.interpolate\(|\.start\s*\(/);
    assert.match(header, /<Text accessibilityRole="header"/);
    assert.doesNotMatch(header, /numberOfLines|ellipsizeMode|maxFontSizeMultiplier|accessibilityLiveRegion/);
  });
});

/**
 * The greeting and the learner's name move as one phrase — F427.
 */
describe('the greeting word hugs the name — F427', () => {
  test('the static tab heading keeps the complete greeting and name in one text node — F427', () => {
    const header = region(layoutSource(), 'export function TabHeader(', 'type ConfirmSheetProps');
    const left = header.slice(header.indexOf('\n  return ('));
    assert.equal((left.match(/\{title\}/g) ?? []).length, 1);
    assert.match(left, /<Text accessibilityRole="header"[^>]*>\s*\{title\}\s*<\/Text>/);
    assert.doesNotMatch(left, /swap\.|setWidths|setNameTop|onLayout=/);
  });
});

/**
 * Both full-line layers share geometry without sharing a baseline — F428.
 */
describe('the greeting travels by word, not by slot — F428', () => {
  test('the static greeting wraps in normal flow without a measured or clipped motion slot — F428', () => {
    const header = region(layoutSource(), 'export function TabHeader(', 'type ConfirmSheetProps');
    assert.doesNotMatch(header, /translateX|translateY|arrivingWidth|shownWidth|measure\(|st\.swapLine/);
    assert.doesNotMatch(header, /height:|overflow:|position:|numberOfLines|allowFontScaling|maxFontSizeMultiplier/);
    assert.match(header, /type\.display/);
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
