/**
 * The component vocabulary, held to the source — F332, F333.
 *
 * components.tsx carries the drawn pieces every screen builds from. There is no
 * renderer in this suite (docs/TESTING.md), so the promises those pieces make
 * are checked by reading the file the same way layout.test.ts and
 * surfaceContract.test.ts read a screen: strip the comments, slice the region
 * from one export to the next, then assert on the markup that is left.
 *
 * Two pieces are worth a tripwire here. The monogram is the one drawn initial,
 * a filled violet disc the design says is the identity mark, and it must stay
 * hidden from assistive tech so a screen reader does not read a loose letter.
 * And the pill and the ghost each take a name for assistive tech that falls back
 * to their label, because the tabs and the drill lean on it to say more than the
 * word printed on the control.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { MISSIONS } from '@luvani/core';

const SRC = fileURLToPath(new URL('.', import.meta.url));

/** Same treatment as layout.test.ts: comments may say anything. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The components source with comments gone. Read fresh in each test. */
function componentsSource(): string {
  return stripComments(readFileSync(join(SRC, 'components.tsx'), 'utf8'));
}

/** The slice of source from one export marker up to the next. */
function region(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} is missing from components.tsx`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} is missing from components.tsx`);
  return source.slice(start, end);
}

describe('the drawn vocabulary keeps its promises — F332, F333', () => {
  test('the monogram is a white initial on an ink disc, and it is hidden from assistive tech', () => {
    // Revamp B, F597: SNIPPETS header-tab draws the learner's mark as a white
    // initial in Outfit Bold on an ink disc. It still wears no accent (the
    // brand blue is not the learner), is still a circle sized from the disc,
    // and is still decorative so a screen reader walks past a loose letter.
    const mono = region(componentsSource(), 'export function Monogram(', 'export function ProgressDots(');
    assert.match(mono, /backgroundColor: paper\.ink/, 'the disc is not ink');
    assert.doesNotMatch(mono, /accent\./, 'the monogram still wears an accent');
    assert.match(mono, /borderRadius: size \/ 2/, 'the disc is not a circle at its own size');
    assert.match(mono, /\{\.\.\.decorative\}/, 'the disc is not hidden from assistive tech');
    assert.match(mono, /fontFamily: font\.bold/, 'the initial is not Outfit Bold');
    assert.match(mono, /fontSize: size \* 0\.44/, 'the initial is not sized to the disc');
    assert.match(mono, /color: paper\.onInk/, 'the initial is not white on the ink');
  });

  test('a pill, an outline and a ghost can be given a name for assistive tech, and forward it', () => {
    // Both take an optional accessibilityLabel and forward it to the press,
    // falling back to the printed label when it is absent — which is the name a
    // Pressable already derived from its child Text, so the fallback is a no-op.
    // Revamp B: the pill and the ghost forward it through `Press`, the one
    // spring, and give a light impact; the pill takes a white tone for blue and
    // coral grounds, and the ghost is an underlined word.
    const pill = region(componentsSource(), 'export function PillButton(', 'export function OutlineButton(');
    assert.match(pill, /accessibilityLabel\?: string/, 'PillButton takes no accessibilityLabel');
    assert.match(
      pill,
      /<Press haptic="light"[^>]*accessibilityLabel=\{accessibilityLabel \?\? label\}/,
      'PillButton does not forward its accessibilityLabel to the press, or does not fall back to the label',
    );
    assert.match(pill, /<Press haptic="light"/, 'the pill does not press through the one spring with a light impact');
    assert.match(pill, /tone\?: 'ink' \| 'white'/, 'the pill cannot be white on a blue or coral ground');

    // The outline button too: on the web the derived name was not reaching the
    // accessibility tree, so a "Talk about this instead" read as a bare button.
    const outline = region(componentsSource(), 'export function OutlineButton(', 'export function GhostButton(');
    assert.match(outline, /accessibilityLabel\?: string/, 'OutlineButton takes no accessibilityLabel');
    assert.match(
      outline,
      /accessibilityLabel=\{accessibilityLabel \?\? label\}/,
      'OutlineButton does not forward its accessibilityLabel, or does not fall back to the label',
    );

    const ghost = region(componentsSource(), 'export function GhostButton(', 'export function OptionCard(');
    assert.match(ghost, /accessibilityLabel\?: string/, 'GhostButton takes no accessibilityLabel');
    assert.match(
      ghost,
      /<Press haptic="light"[^>]*accessibilityLabel=\{accessibilityLabel \?\? label\}/,
      'GhostButton does not forward its accessibilityLabel to the press, or does not fall back to the label',
    );
    assert.match(ghost, /<Press haptic="light"/, 'the ghost does not press through the one spring with a light impact');
    assert.match(ghost, /textDecorationLine: 'underline'/, 'the second action is not an underlined link');
  });
});

describe('the onboarding-polish primitives speak their state — F354, F358', () => {
  test('an option card tells a screen reader it is selected, the way the tab bar does — F354', () => {
    // The tab bar folds its active state into accessibilityState so VoiceOver
    // says "selected" (components.tsx:426); the option card must do the same, or
    // a learner picking a voice, goal, strictness or reminder hears nothing.
    const option = region(componentsSource(), 'export function OptionCard(', 'export function Field(');
    assert.match(
      option,
      /accessibilityState=\{\{ selected \}\}/,
      'the option card does not tell a screen reader whether it is selected',
    );
  });

  test('the step dots speak as one element, and the station line speaks not at all — F358, F458', () => {
    // Both carry an accessibilityLabel ("Step X of Y" / "Stop X of Y") but iOS
    // never focuses the group and never reads it unless the container is marked
    // `accessible`. The label without the flag is a promise the OS drops.
    const dots = region(componentsSource(), 'export function ProgressDots(', 'export function SpeakCircle(');
    assert.match(dots, /accessible(?![a-zA-Z])/, 'the step dots are not one focusable element, so their label is never read');
    assert.match(dots, /accessibilityLabel/, 'the step dots carry no label to read');

    // The station line is the exception, and it changed direction on purpose.
    // It used to be one focusable element reading "Stop three of seven", which
    // meant the invariant this app is strictest about, that no score is shown
    // mid-session, held for everybody except the learner using a screen reader.
    // It is decorative now, like the week rail on Home. Nothing is lost: what a
    // learner needs mid-session is what to say next, and that is the card above
    // it, in words.
    const station = region(componentsSource(), 'export function StationLine(', 'export function fitDisplay(');
    assert.match(station, /\{\.\.\.decorative\}/, 'the station line is not hidden from assistive tech, so it may be counting out loud again');
    assert.ok(!station.includes('accessibilityLabel'), 'the station line carries a label again, and the only thing it can say is a count');
  });
});

describe('the mockup-review primitives keep their promises — F362, F366, F368, F373', () => {
  test('a secure field can be shown, and says so to a screen reader — F373', () => {
    // A password typed blind is a password typed twice. The control is drawn
    // only for a secure field, sits at the touch floor, and the input's secrecy
    // follows the toggle rather than the prop alone. The F109 bindings around
    // it (id, aria-labelledby, role="alert") are not this test's business and
    // are held by surfaceContract.test.ts.
    const field = region(componentsSource(), 'export function Field(', 'export function TabBar<');
    assert.match(field, /secureTextEntry=\{secure && !revealed\}/, 'secrecy does not follow the Show/Hide toggle');
    assert.match(field, /\{secure && \(/, 'the control is drawn for fields that are not secure');
    assert.match(field, /accessibilityLabel=\{revealed \? 'Hide password' : 'Show password'\}/, 'the control does not say what it does');
    assert.match(field, /\{revealed \? 'Hide' : 'Show'\}/, 'the control does not read Show or Hide');
    assert.match(field, /minHeight: HIT/, 'the control is under the touch floor');
    assert.match(field, /minWidth: HIT/, 'the control is under the touch floor');
    // Revamp B (SNIPPETS field): the border is STYLE's field grey, a mark at the
    // 3 floor on white rather than the decorative hairline, and the input is
    // 56 tall like the one pill.
    const style = region(componentsSource(), '  field: {', '  tabTrack:');
    assert.match(style, /borderColor: paper\.field/, 'the input border is not the field grey, so an empty field does not read as a field');
    assert.match(style, /minHeight: HIT \+ 12/, 'the input is under the 56pt the field is drawn at');
  });

  test('a stat can sit three to a row — F366', () => {
    // Two facts to a row is Home's shape; My French has three facts and one
    // line, so the basis narrows to thirty percent when asked, and nothing else
    // about the stat changes.
    const stat = region(componentsSource(), 'export function Stat(', 'export function Monogram(');
    assert.match(stat, /columns\?: 2 \| 3/, 'Stat takes no column count');
    assert.match(stat, /columns === 3 \? '30%' : '46%'/, 'three to a row is not thirty percent each');
  });

  test('the segmented control is a sand track with a white chosen segment, never ink capsules, and every segment keeps the touch floor', () => {
    // F368: inline on Profile, the segmented control is a setting: a learner who
    // has not chosen a daily goal must see three quiet segments, not a lie, and
    // a screen reader must hear what the three words are a choice of.
    // Revamp B, F597: it is SNIPPETS' segmented, a sand track with a white
    // chosen segment and no borders, never ink capsules, and each segment is a
    // choice, so it presses through `Press` with a selection tick. SNIPPETS
    // draws 38; the segments stay at the 44 floor.
    const source = componentsSource();
    const bar = region(source, 'export function TabBar<', 'export function Stat(');
    assert.match(bar, /active: K \| null/, 'the tab bar cannot stand with nothing chosen');
    assert.match(bar, /track = paper\.skeleton/, 'the segmented control no longer runs on the sand track');
    assert.match(bar, /accessibilityLabel\?: string/, 'the tab bar cannot name its group');
    assert.match(bar, /accessibilityRole="tablist" accessibilityLabel=\{accessibilityLabel\}/, 'the name is not on the group');
    assert.match(bar, /accessibilityState=\{\{ selected: isActive \}\}/, 'a segment no longer says it is selected');
    assert.match(bar, /<Press haptic="selection" frame=\{s\.segmentFrame\}/, 'a segment does not press as a choice through the one spring');
    assert.match(bar, /accessibilityRole="tab"/, 'a segment is not a tab to a screen reader');
    const track = region(source, '  tabTrack: {', '  tab: {');
    assert.doesNotMatch(track, /borderWidth/, 'the sand track is outlined again');
    const tab = region(source, '  tab: {', '  tabActive: {');
    assert.match(tab, /minHeight: HIT/, 'a segment is under the touch floor');
    assert.match(tab, /borderRadius: radius\.field - 3/, 'a segment\'s corner is not concentric with the track\'s');
    const active = region(source, '  tabActive: {', '  segmentFrame:');
    assert.equal(active.trim(), 'tabActive: { backgroundColor: paper.card },', 'the chosen segment is more than white: a border, a fill or an ink capsule');
    // The ink chip styles may sit dead until Stage 6, but no part draws them.
    assert.doesNotMatch(source, /style=\{\[?s\.chip/, 'a part draws the ink chip again, which is the ink capsule SNIPPETS refuses');
  });

  test('the retired tinted wrappers are not exported', () => {
    assert.doesNotMatch(componentsSource(), /export function Tint(?:Disc|Panel|Row)\b/);
  });
});

/**
 * The revamp A primitives, held to the source — F569, F577, F586.
 *
 * The mockup replaced most of the app's white-card-with-a-button shapes with two
 * pieces: a card that lifts off the ground on one soft shadow, and a tinted row
 * that is a whole button. Both are in this file rather than in five screens, and
 * what follows is the promises they make.
 */
describe('the revamp primitives keep their promises — F569, F577, F586', () => {
  test('a ledger row is one pressable at 60 with an ink glyph and no disc, a title, a gloss, meta and a chevron, and it names itself once', () => {
    // One press, not a card with a button in it: the whole row is the target, a
    // nested button is invalid on the web, and a row whose only tap area is its
    // chevron is F545 again. Revamp B: that one press is `Press`, the spring.
    // F602 (SNIPPETS list): the row is 60, its chevron the soft 20, and the
    // hairline between rows belongs to the Ledger, so the row rules nothing.
    const row = region(componentsSource(), 'export function LedgerRow(', '\nexport function ');
    assert.equal((row.match(/<Press\b/g) ?? []).length, 1, 'the ledger row is not exactly one target');
    assert.doesNotMatch(row, /<Pressable\b/, 'the ledger row presses beside the one spring');
    assert.match(row, /accessibilityRole="button"/, 'the row is not a button, so nothing says it opens anything');
    assert.match(
      row,
      /accessibilityLabel=\{accessibilityLabel \?\? \(gloss \? `\$\{title\}, \$\{gloss\}` : title\)\}/,
      'the row does not name itself from its own title and gloss, so a screen reader reads two loose lines',
    );
    assert.match(row, /accessibilityState=\{\{ disabled \}\}/, 'the row never says it is unavailable');
    assert.match(row, /<ChevronRight size=\{20\} color=\{paper\.inkSoft\} \/>/, 'the row draws no soft 20 chevron, so nothing marks it as a way in');
    assert.match(row, /\{trailing != null \? trailing : null\}/, 'the row cannot carry a state before its chevron');
    assert.match(row, /meta\?: string/, 'the row cannot carry trailing meta');
    assert.match(row, /<Press haptic="light" style=\{ls\.row\} disabled=\{disabled\}/, 'the row has no pressed state, or presses while it is disabled');
    assert.doesNotMatch(row, /opacity/, 'the row says unavailable in opacity, which leaves a control with no shape to fall back on');
    for (const cap of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'adjustsFontSizeToFit']) {
      assert.ok(!row.includes(cap), `the ledger row caps its words with ${cap}; a long title must wrap and the row grow to hold it`);
    }
    const style = region(componentsSource(), '  row: {', '  glyph: {');
    assert.match(style, /minHeight: HIT \+ space\(4\)/, 'the ledger row is under its 60 floor');
    assert.doesNotMatch(style, /borderBottomWidth|borderTopWidth|borderWidth/, 'the row rules itself, so a list draws a rule under its last row or two between a pair');
    assert.doesNotMatch(style, /borderRadius|backgroundColor|borderColor: paper\.ink/, 'the ledger row is a box, not a line in a ledger');
    const glyph = region(componentsSource(), '  glyph: {', '  words:');
    assert.match(glyph, /minWidth: 24/, 'the glyph slot is not the 24pt ink glyph');
    assert.doesNotMatch(glyph, /backgroundColor|borderRadius/, 'the glyph sits on a disc again');
  });

  test('the one card is white at the card radius with no hairline, no outline and no shadow', () => {
    // 2026-09-27, notebook Phase 1: the card spreads no shadow at all, and the
    // component file reaches for no shadow token. The live microphone glow is
    // the only shadow. Revamp B, F597 (SNIPPETS card-white): the hairline goes
    // too; white on the warm paper is the whole edge.
    const card = region(componentsSource(), '  card: {', '  cardPadded:');
    assert.doesNotMatch(card, /shadow/, 'the card still lifts on a shadow');
    assert.match(card, /backgroundColor: paper\.card/, 'the card is not white');
    assert.match(card, /borderRadius: radius\.card/, 'the card no longer turns the card corner from the token');
    assert.doesNotMatch(card, /borderWidth|borderColor/, 'the card is outlined again; B draws it white with no hairline');
    const source = componentsSource();
    assert.doesNotMatch(source, /\bshadow\.whisper\b|\bshadow,/, 'components.tsx still reaches for the retired whisper');
    assert.doesNotMatch(source, /\baccent\.feature\b/, 'components.tsx still spells the retired feature paper');
    for (const number of ['shadowOpacity', 'shadowRadius', 'shadowOffset']) {
      const spelled = source.split('\n').filter((line) => line.includes(number));
      assert.deepEqual(
        spelled.filter((line) => !line.includes('signal.good') && !/^\s*shadow(Offset|Opacity|Radius): /.test(line)).length,
        0,
        `${number} is written somewhere new in components.tsx; the mic glow is the only shadow`,
      );
    }
  });

  test('one ink pill at 56, white on blue or coral; the second action is an underlined ink link at the touch floor; a label is the meta line', () => {
    // Revamp B, F597 (SNIPPETS button-primary, link-text, meta-line). The one
    // pill is ink at 56 and fully rounded, and white with ink lettering on a
    // blue or coral ground. The second action is an underlined word at the
    // touch floor, never a box. A label that annotates a card is the meta line,
    // small soft ink, quieter than the heading under it.
    const source = componentsSource();
    const pill = region(source, '  pill: {', '  pillWhite:');
    assert.match(pill, /minHeight: HIT \+ 12/, 'the pill is under 56pt');
    assert.match(pill, /backgroundColor: accent\.primary/, 'the pill is not ink');
    assert.match(pill, /borderRadius: radius\.pill/, 'the pill is not fully rounded like the logo');
    assert.match(source, /pillWhite: \{ backgroundColor: paper\.card \}/, 'the white pill for blue and coral grounds is not white');
    const outline = region(source, '  outline: {', '  outlinePressed:');
    assert.match(outline, /minHeight: HIT/, 'the quiet link is under the touch floor');
    assert.doesNotMatch(outline, /borderWidth|backgroundColor/, 'the secondary action is a boxed button, not a quiet link');
    const ghost = region(source, '  ghost: {', '  chip:');
    assert.match(ghost, /minHeight: HIT/, 'the underlined link is under the touch floor');
    assert.doesNotMatch(ghost, /borderWidth|backgroundColor/, 'the underlined link is drawn as a box');
    const label = region(source, 'export function Label(', 'export function PillButton(');
    assert.match(label, /type\.small/, 'the label is not the small meta line');
    assert.match(label, /color = paper\.inkSoft/, 'the meta line is not soft ink');
    const option = region(source, '  optionSelected: {', '  optionPressed:');
    assert.doesNotMatch(option, /backgroundColor/, 'a chosen option is still a filled panel');
  });

  test('no pressed style scales by hand: the 0.985 statics are gone', () => {
    // Revamp B, F597. Every tappable part presses through `Press`, the one
    // spring to 0.97, so a static scale in a pressed style is a second press
    // that ignores reduced motion and never springs back.
    const source = componentsSource();
    assert.doesNotMatch(source, /scale: 0\.985/, 'a pressed style still scales by hand');
    assert.doesNotMatch(source, /pillPressed|ls\.pressed/, 'a static pressed style survived beside the spring');
  });

  test('a selected option announces its state on the web as well as on a device', () => {
    // Two spellings, one meaning, and neither is derived from the other.
    // `accessibilityState` is what VoiceOver and TalkBack read; `aria-selected`
    // is what the browser puts in its accessibility tree, and without it a
    // learner picking a plan, a goal or a voice on the web hears three
    // identical buttons (F522, F586).
    const source = componentsSource();
    const bar = region(source, 'export function TabBar<', 'export function Stat(');
    assert.match(bar, /accessibilityState=\{\{ selected: isActive \}\}/, 'a segment no longer says it is selected on a device');
    assert.match(bar, /aria-selected=\{isActive\}/, 'a segment says nothing to the browser, so on the web the choice is silent');
    const option = region(source, 'export function OptionCard(', 'export function Field(');
    assert.match(option, /accessibilityState=\{\{ selected \}\}/, 'the option card no longer says it is selected on a device');
    assert.match(option, /aria-selected=\{selected\}/, 'the option card says nothing to the browser, so on the web the choice is silent');
    // Revamp B: the segmented control has a sand track and a white chosen
    // segment with ink lettering at Bold, the rest soft ink at SemiBold, so it
    // never competes with the one ink pill. The selected state is still said
    // twice, as above, and a third time in weight.
    assert.match(bar, /color: isActive \? paper\.ink : paper\.inkSoft/, 'the chosen segment is not ink lettering');
    assert.match(bar, /fontFamily: isActive \? font\.bold : font\.semiBold/, 'the chosen segment is not told by weight as well as colour');
    const track = region(source, '  tabActive: {', '  segmentFrame:');
    assert.match(track, /backgroundColor: paper\.card/, 'the chosen segment is not white');
    assert.doesNotMatch(track, /accent\./, 'the chosen segment still wears the ink fill of the primary pill');
  });

  test('the retired week rail is not exported and leaves no mark style behind', () => {
    // 2026-09-27, notebook final sweep. The week is a sentence on Today and on
    // Profile; the seven-dot rail's last live caller was the retired French wall
    // page, and its only other caller was the momentum block nothing rendered.
    const source = componentsSource();
    assert.doesNotMatch(source, /export function WeekRail\b/, 'the week rail is exported again');
    assert.doesNotMatch(source, /\bmarkDone\b|\bmarkWaiting\b/, 'the rail\'s mark styles are still in the sheet');
  });
});

/**
 * The notebook marks — Phase 1 of the redesign, added 2026-09-27.
 *
 * Appended to components.tsx, which is append-only because every region above
 * is sliced between adjacent exports. Each mark is held to the promises the
 * design contract makes for it: the highlighter is drawn once and rests on its
 * final frame when movement is withheld; nothing caps its words; a mark that is
 * a picture is silent and the words beside it are what a screen reader hears;
 * and nothing here builds a primary pill, so the one-pill count stays readable
 * from each screen's own file.
 */
describe('the notebook marks keep their promises — redesign Phase 1', () => {
  const NEW_MARKS = [
    'Ledger',
    'LedgerRow',
    'Highlight',
    'SoundTag',
    'LadderMark',
    'LevelPath',
    'TutorCard',
    'SceneBrief',
    // Revamp B, F597: the B parts, appended after fitHero in this order.
    'Press',
    'CloseGlyph',
    'CheckGlyph',
    'RoundButton',
    'ColourCard',
    'StatTile',
    'HeroNumber',
    'OptionRow',
    'Sheet',
    'Skeleton',
    'QuietLine',
    'FrenchBlock',
    // Revamp B, F601: the Start parts, appended after the B stylesheet, and
    // the alert mark Field draws, moved here from glyphs.tsx.
    'SceneMark',
    'canDoSentence',
    'AlertGlyph',
  ] as const;
  /** From one export to the next, or to the end of the file. */
  const mark = (name: string): string => {
    const source = componentsSource();
    const at = source.indexOf(`export function ${name}(`);
    assert.notEqual(at, -1, `${name} is missing from components.tsx`);
    const next = source.indexOf('\nexport ', at + 1);
    return source.slice(at, next === -1 ? source.length : next);
  };

  test('every new mark is appended after the stylesheet, so no sliced region moved', () => {
    const source = componentsSource();
    const sheet = source.indexOf('const s = StyleSheet.create(');
    assert.notEqual(sheet, -1, 'the main stylesheet is gone; this ordering check reads nothing');
    for (const name of NEW_MARKS) {
      const at = source.indexOf(`export function ${name}(`);
      assert.ok(at > sheet, `${name} is not appended after the stylesheet, so an older region may have grown a new neighbour`);
    }
  });

  test('the B parts are appended after the stylesheet, draw from tokens, cap no words, build no pill and spell no hex', () => {
    // The B parts come after fitHero, in the contract's order, so each region
    // is sliced between the same two neighbours every time it is read.
    const source = componentsSource();
    let previous = source.indexOf('export function fitHero(');
    assert.notEqual(previous, -1, 'fitHero moved; the B parts have no anchor to be appended after');
    for (const name of NEW_MARKS.slice(NEW_MARKS.indexOf('Press'))) {
      const at = source.indexOf(`export function ${name}(`);
      assert.ok(at > previous, `${name} is not appended after fitHero in the contract's order`);
      previous = at;
    }
    for (const name of NEW_MARKS) {
      const body = mark(name);
      for (const cap of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'adjustsFontSizeToFit']) {
        assert.ok(!body.includes(cap), `${name} caps its words with ${cap}`);
      }
      assert.ok(!body.includes('<PillButton'), `${name} builds its own pill, so a screen's one-pill count moves into a shared file`);
      assert.doesNotMatch(body, /#[0-9A-Fa-f]{6}\b/, `${name} writes a raw colour`);
      assert.doesNotMatch(body, /\btint\[|\btint\./, `${name} draws a tint`);
      assert.doesNotMatch(body, /shadow/, `${name} draws a shadow`);
    }
  });

  test('the ledger rules a hairline between its rows, never around them, and is one list to assistive tech', () => {
    // F602 (SNIPPETS list): the rule sits between rows. The card's edge is the
    // only edge, so there is no rule above the first row or under the last.
    const ledger = mark('Ledger');
    assert.match(ledger, /accessibilityRole="list"/, 'the ledger is not a list to a screen reader');
    assert.match(
      ledger,
      /index === 0 \? \[row\] : \[<View key=\{`rule-\$\{index\}`\} \{\.\.\.decorative\} style=\{ls\.rule\} \/>, row\]/,
      'the ledger does not rule a hairline before every row but the first, or the rule is read aloud',
    );
    assert.doesNotMatch(ledger, /borderTopWidth|borderBottomWidth/, 'the ledger rules above or below its rows, around them rather than between');
    const rule = region(componentsSource(), '  rule: {', '  row: {');
    assert.match(rule, /height: HAIRLINE, backgroundColor: paper\.line/, 'the rule between rows is not the paper hairline');
  });

  test('the highlighter is a still band behind one French line, marked as French, and moves nothing', () => {
    // Revamp B, F597 (SNIPPETS highlight). STYLE section 11's motion budget is
    // the orb, the recap count-up and the confetti; the pen stroke is not in
    // it, so the band is simply there. The line on it is marked as French, so
    // a screen reader reads it in a French voice, and the band is decorative.
    const band = mark('Highlight');
    assert.doesNotMatch(band, /Animated|useReduceMotion|drawIn|transform/, 'the highlighter moves again');
    assert.match(band, /backgroundColor: highlight/, 'the band is not the highlighter');
    assert.match(band, /\{\.\.\.frenchText\}/, 'the line on the band is not marked as French');
    assert.match(band, /\{\.\.\.decorative\}/, 'the band is announced to assistive tech; the words on it are what is read');
    assert.match(band, /type\.french/, 'the line on the band is not set as French');
    assert.match(band, /color: paper\.ink/, 'the line on the band is not ink');
    const style = region(componentsSource(), '  band: {', '  soundTag: {');
    assert.match(style, /top: 0, bottom: 0/, 'the band is a stroke under the words, not SNIPPETS\' band behind the whole line');
    assert.match(style, /borderRadius: space\(1\.5\)/, 'the band\'s corner is not SNIPPETS\' 6');
  });

  test('the motion vocabulary carries the draw-in, and withholding movement lands on the final frame', () => {
    const motion = stripComments(readFileSync(join(SRC, 'motion.ts'), 'utf8'));
    const draw = motion.slice(motion.indexOf('export function drawIn('));
    assert.ok(motion.includes('export function drawIn('), 'motion.ts has no highlighter draw-in');
    assert.match(draw, /if \(reduced\) \{\s*value\.setValue\(1\);\s*return null;/, 'reduced motion does not land on the final frame');
    assert.match(draw, /useNativeDriver: true/, 'the draw-in runs on the JS thread');
    assert.match(draw, /duration: DRAW_MS/, 'the draw-in writes its own number instead of the named duration');
  });

  test('a sound tag is notation beside one example word, and says both once', () => {
    const tag = mark('SoundTag');
    assert.match(tag, /type\.notation/, 'the IPA is not set as notation');
    assert.match(tag, /type\.frenchSm/, 'the example word is not set in the French serif');
    assert.match(tag, /accessible accessibilityLabel=\{`Sound \$\{ipa\}, as in \$\{example\}`\}/, 'the tag is read as two loose words rather than one sound');
  });

  test('the ladder mark draws four rungs in their own colours and names the current one in words', () => {
    const ladder = mark('LadderMark');
    assert.match(ladder, /\[1, 2, 3, 4\] as const/, 'the ladder does not draw all four rungs');
    assert.match(ladder, /rungColor\[r\]/, 'a rung is not drawn in its own support colour');
    assert.match(ladder, /rungLabel\(rung, tutorName\)/, 'the current rung is not named by the one rung sentence');
    assert.match(ladder, /\{\.\.\.decorative\}/, 'the four marks are read aloud as well as the sentence');
  });

  test('the level path marks one stop as here with the highlighter and says so in words', () => {
    const path = mark('LevelPath');
    assert.match(path, /backgroundColor: highlight/, 'the you-are-here stop is not the highlighter');
    assert.match(path, /stop\.state === 'here'/, 'the path does not know which stop is here');
    assert.match(path, /YOU_ARE_HERE/, 'the path does not say you are here in words');
    assert.match(path, /accessibilityLabel=\{stopLabel\(level\.level, stop\)\}/, 'a stop is not one sentence to a screen reader');
  });

  test('the tutor card is white: the orb, the name and voice, a play disc and a quiet change link', () => {
    const card = mark('TutorCard');
    assert.match(card, /<OrbGlyph color=\{orb\.ready\}/, 'the tutor is not drawn as the orb');
    assert.match(card, /accessibilityLabel=\{playing \? `Stop \$\{name\}` : `Hear \$\{name\}`\}/, 'the sample offers to play what is already playing');
    assert.match(card, /<GhostButton label=\{changeLabel\}/, 'changing tutor is not a quiet link');
    assert.match(card, /type\.french/, 'the signature line is not set in the French serif');
    // Revamp B, F601: the sample is a 44 ink disc that presses through the one
    // spring, with the white speaker mark, and no Pressable of its own.
    assert.match(card, /<Press haptic="light"/, 'the sample does not press through the one spring with a light impact');
    assert.doesNotMatch(card, /<Pressable\b/, 'the tutor card keeps a Pressable of its own beside the spring');
    assert.match(card, /<EarGlyph size=\{22\} color=\{paper\.onInk\} \/>/, 'the speaker on the ink disc is not white');
    const disc = region(componentsSource(), '  hear: {', '  brief: {');
    assert.match(disc, /width: HIT,\s*height: HIT,\s*borderRadius: HIT \/ 2/, 'the play disc is not a circle at the touch floor');
    assert.match(disc, /backgroundColor: paper\.ink/, 'the play disc is not ink');
    assert.doesNotMatch(disc, /borderWidth|borderColor/, 'the play disc is still a hairline ring');
    // A white card, the name as a heading, the voice as the soft small line,
    // and the change link under them in the same column, before the disc.
    assert.match(card, /<Card style=\{ls\.tutor\}>/, 'the tutor is not drawn on the one white card');
    assert.match(card, /type\.heading, \{ color: paper\.ink \}\]\}>\{name\}/, 'the name is not the heading');
    assert.match(card, /type\.small, \{ color: paper\.inkSoft \}\]\}>\{voice\}/, 'the voice is not the soft small line');
    const at = (needle: string): number => {
      const i = card.indexOf(needle);
      assert.notEqual(i, -1, `${needle} is missing from the tutor card`);
      return i;
    };
    assert.ok(at('<OrbGlyph') < at('{name}'), 'the orb does not lead the row');
    assert.ok(at('{voice}') < at('<GhostButton'), 'the change link is not under the voice');
    assert.ok(at('<GhostButton') < at('<Press haptic="light"'), 'the play disc does not end the row');
    assert.ok(at('<Press haptic="light"') < at('{signature}'), 'the signature is not under the row');
    // The signature is French, and said in a French voice.
    assert.match(card, /<Text \{\.\.\.frenchText\} style=\{\[type\.french, \{ color: paper\.ink \}\]\}>/, 'the signature is not marked as French');
    // The props do not change: Speak and the plan pass the same six.
    assert.match(card, /onHear: \(\) => void;\s*playing: boolean;\s*onChange: \(\) => void;\s*changeLabel\?: string;/, 'the tutor card\'s props changed');
  });

  test('the scene brief is the one blue card: a meta line, the French title, the English, the can-do sentence, one line to say, and the caller\'s white Start', () => {
    // F602 (SNIPPETS card-colour, meta-line, french-block). The brief is the
    // one colour card on Home, and on Speak after F603: white words on the
    // blue, and the blue ground's own secondary for every quieter line.
    const brief = mark('SceneBrief');
    assert.match(brief, /<ColourCard ground="blue"/, 'the brief is not the blue colour card');
    assert.doesNotMatch(brief, /<Card\b/, 'the brief is still the white card');
    assert.doesNotMatch(brief, /onPress/, 'the card that holds the Start presses too, a button in a button');

    // The props: one meta line, the two names, a finished can-do sentence, one
    // line to say with its English, a note, and the caller's nodes.
    assert.match(
      brief,
      /meta: string;[\s\S]*french\?: string;[\s\S]*title: string;[\s\S]*canDo\?: string;[\s\S]*line\?: \{ fr: string; en\?: string \};[\s\S]*note\?: string;[\s\S]*action: ReactNode;[\s\S]*secondary\?: ReactNode;[\s\S]*corner\?: ReactNode;/,
      'the brief does not take the meta line, the names, the can-do, one line, a note and the caller\'s nodes',
    );

    // The meta line, beside the 44 corner slot.
    assert.match(brief, /<Text style=\{\[type\.small, ROW_WORDS, \{ color: onColour\.blue \}\]\}>\{meta\}<\/Text>/, 'the meta line is not the small line in the blue\'s secondary, taking the row');
    assert.match(brief, /\{corner != null \? <View style=\{ls\.corner\}>\{corner\}<\/View> : null\}/, 'the corner slot is gone, or reserved when empty');
    assert.match(componentsSource(), /corner: \{ minWidth: HIT, minHeight: HIT/, 'the corner slot is under the touch floor');

    // The French title leads as the heading, read as French; the English sits
    // under it. With no French the English leads at the same size, still the
    // heading, and is not marked as French.
    assert.match(
      brief,
      /<Text \{\.\.\.frenchText\} accessibilityRole="header" style=\{\[type\.frenchLg, \{ color: textOn\.blue \}\]\}>\s*\{french\}/,
      'the French title is not the heading, in white at the large French size, read as French',
    );
    assert.match(brief, /<Text style=\{\[type\.body, \{ color: onColour\.blue \}\]\}>\{title\}<\/Text>/, 'the English is not the body line under the French');
    assert.match(
      brief,
      /\) : \(\s*<Text accessibilityRole="header" style=\{\[type\.frenchLg, \{ color: textOn\.blue \}\]\}>\s*\{title\}/,
      'with no French name the English does not lead as the heading, or it is marked as French',
    );

    // The can-do is a finished sentence in white, and the one line is French
    // with its English quieter under it.
    assert.match(brief, /<Text style=\{\[type\.body, \{ color: textOn\.blue \}\]\}>\{canDo\}<\/Text>/, 'the can-do sentence is not a white body line');
    assert.match(brief, /<Text \{\.\.\.frenchText\} style=\{\[type\.french, \{ color: textOn\.blue \}\]\}>\s*\{line\.fr\}/, 'the line to say is not French in white, read as French');
    assert.match(brief, /type\.small, \{ color: onColour\.blue \}\]\}>\{line\.en\}/, 'the line\'s English is not the small line in the blue\'s secondary');
    assert.match(brief, /type\.small, \{ color: onColour\.blue \}\]\}>\{note\}/, 'the note is not the small line in the blue\'s secondary');

    // The caller's Start and its second way in, last and in that order.
    assert.match(brief, /\{action\}/, 'the brief never draws the Start it was handed');
    const at = (needle: string): number => {
      const i = brief.indexOf(needle);
      assert.notEqual(i, -1, `${needle} is missing from the scene brief`);
      return i;
    };
    const order = ['{meta}', '{french}', '{canDo}', '{line.fr}', '{note}', '{action}', '{secondary != null'];
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(at(order[i - 1]!) < at(order[i]!), `the brief draws ${order[i]} before ${order[i - 1]}`);
    }

    // Tokens only: no raw type, no caps Label, no fitted hero, and soft ink is
    // never set on a colour.
    assert.doesNotMatch(brief, /fontSize|lineHeight|fontFamily/, 'the brief writes type itself; the scale lives in theme.ts');
    assert.doesNotMatch(brief, /<Label\b/, 'the brief draws a Label; its meta is one plain line');
    assert.doesNotMatch(brief, /fitHero\(/, 'the brief still fits a French hero; the board sets the French at one size');
    assert.doesNotMatch(brief, /paper\.inkSoft|paper\.ink\b/, 'the brief sets ink on the blue');
    // The lead stays, because the can-do sentence is built from it.
    assert.match(componentsSource(), /const CAN_DO_LEAD = "You'll be able to";/, 'the can-do lead is gone');
  });

  test('a ledger is a white card of rows split by hairlines, each at 60 with a 16 title, a soft detail and a chevron', () => {
    // F602 (SNIPPETS list): 4 above and below the rows and 20 at the sides, on
    // white at the card radius. Every row after the first is led by the rule.
    const source = componentsSource();
    const ledger = mark('Ledger');
    assert.match(ledger, /const rows = Children\.toArray\(children\);/, 'the ledger counts its rows before React drops the empty ones, so a missing row leaves a rule');
    assert.match(ledger, /style=\{\[ls\.ledger, style\]\}/, 'the ledger is not drawn from its own card style');
    assert.match(
      source,
      /ledger: \{ backgroundColor: paper\.card, borderRadius: radius\.card, paddingVertical: space\(1\), paddingHorizontal: space\(5\) \}/,
      'the ledger is not SNIPPETS\' white list card',
    );
    assert.match(source, /rule: \{ height: HAIRLINE, backgroundColor: paper\.line \}/, 'the rule between rows is not the paper hairline');

    // Each row: 60 tall, 10 above and below its words, no rule of its own.
    const style = region(source, '  row: {', '  glyph: {');
    assert.match(style, /minHeight: HIT \+ space\(4\)/, 'a row is under 60');
    assert.match(style, /paddingVertical: space\(2\.5\)/, 'a row does not keep 10 above and below its words');
    assert.doesNotMatch(style, /border/, 'a row rules itself');
    const glyph = region(source, '  glyph: {', '  words:');
    assert.match(glyph, /minWidth: 24/, 'the glyph slot is not 24');

    // The title is the 16 label; a French title is the French line, read as
    // French. The detail, the note and the meta are the soft small line.
    const row = mark('LedgerRow');
    assert.match(row, /lang\?: 'fr';/, 'a row cannot say its title is French');
    assert.match(row, /<Text style=\{\[type\.label, \{ color \}\]\}>\{title\}<\/Text>/, 'the title is not the 16 label');
    assert.match(
      row,
      /lang === 'fr' \? \(\s*<Text \{\.\.\.frenchText\} style=\{\[type\.french, \{ color \}\]\}>\{title\}<\/Text>/,
      'a French title is not set as French and read in a French voice',
    );
    assert.match(row, /const color = disabled \? paper\.inkSoft : paper\.ink;/, 'the title is not ink, or soft ink when the row is off');
    assert.equal(
      (row.match(/<Text style=\{\[type\.small, \{ color: paper\.inkSoft \}\]\}>\{(gloss|note|meta)\}<\/Text>/g) ?? []).length,
      3,
      'the detail, the note and the meta are not each the soft small line',
    );
    assert.match(row, /<ChevronRight size=\{20\} color=\{paper\.inkSoft\} \/>/, 'the chevron is not the soft 20');
    assert.match(row, /\{label != null \? <Label>\{label\}<\/Label> : null\}/, 'the row lost its meta line');
    assert.doesNotMatch(row, /type\.heading/, 'the title is still the 20 heading');

    // The sizes the names promise, read from the theme.
    const theme = stripComments(readFileSync(join(SRC, 'theme.ts'), 'utf8'));
    assert.match(theme, /\blabel: \{ fontFamily: font\.semiBold, fontSize: 16,/, 'the row title is not 16');
    assert.match(theme, /export const HIT = 44;/, 'the touch floor moved, so HIT + space(4) is no longer 60');
    assert.match(theme, /export const space = \(n: number\) => n \* 4;/, 'the spacing unit moved, so HIT + space(4) is no longer 60');
  });

  test('the French hero fits long lines by the theme steps, never a raw size', () => {
    const fit = mark('fitHero');
    assert.match(fit, /type\.frenchHero/, 'a short line is not the French hero');
    assert.match(fit, /heroFit\.long/, 'a long line does not step down to 30');
    assert.match(fit, /heroFit\.longest/, 'the longest line does not step down to 26');
    assert.doesNotMatch(fit, /fontSize/, 'the fit writes a raw size; the steps live in theme.ts');
  });
});

/**
 * Revamp B's icons, held to ICONS.md — F598.
 *
 * ICONS.md draws every mark as a stroke on a 24 box and fills exactly two, the
 * Apple and Google brand marks, in the one colour they are given. So a fill
 * anywhere else in this file is a second icon style, which STYLE section 1
 * calls icon soup.
 */
describe('the icons are ICONS.md\'s — F598', () => {
  test('the brand marks are the only filled glyphs, and they are filled in the mark\'s own colour', () => {
    const source = componentsSource();
    const google = region(source, 'export function GoogleMark(', 'export function AppleMark(');
    const apple = region(source, 'export function AppleMark(', 'export function Card(');
    for (const [name, mark, path] of [
      ['GoogleMark', google, 'M12.48 10.92v3.28h7.84'],
      ['AppleMark', apple, 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04'],
    ] as const) {
      assert.match(mark, /fill=\{color\}/, `${name} is not filled in the colour it is given`);
      assert.doesNotMatch(mark, /stroke=/, `${name} is drawn as a line, and ICONS.md draws the brand marks solid`);
      assert.ok(mark.includes(path), `${name} is not ICONS.md's brand mark`);
    }
    assert.equal(
      (source.match(/fill=\{color\}/g) ?? []).length,
      2,
      'a glyph other than the two brand marks is filled, which is a second icon style beside the stroke set',
    );
  });
});

/**
 * The B parts, held to SNIPPETS.md — F597.
 *
 * Every part a Stage 3 screen pastes, read as source the way the rest of this
 * file reads the older parts. Each region runs from its export to the next.
 */
describe('the B parts keep their promises — F597', () => {
  /** From one export to the next, or to the end of the file. */
  const part = (name: string): string => {
    const source = componentsSource();
    const at = source.indexOf(`export function ${name}(`);
    assert.notEqual(at, -1, `${name} is missing from components.tsx`);
    const next = source.indexOf('\nexport ', at + 1);
    return source.slice(at, next === -1 ? source.length : next);
  };

  test('every tappable part presses through one spring: 0.97, stiffness 439, damping 29.3, released on lift, instant under reduced motion', () => {
    // STYLE section 11: every tappable thing scales to 0.97 on a spring of
    // response 0.3 and damping 0.7. The spring is written once, in motion.ts,
    // and `Press` is the one caller, so the numbers cannot drift per part.
    const press = part('Press');
    assert.match(press, /haptic = 'light'/, 'a press does not default to a light impact');
    assert.match(press, /const reduced = useReduceMotion\(\)/, 'the press does not ask whether movement is withheld');
    assert.match(press, /onPressIn=\{[^}]*\{[\s\S]*?pressTo\(scale, PRESS_SCALE, reduced\)/, 'the press does not go down to 0.97 on the spring');
    assert.match(press, /onPressOut=\{[^}]*\{[\s\S]*?pressTo\(scale, 1, reduced\)/, 'the press is not released on lift');
    assert.match(press, /<Animated\.View style=\{\[style, \{ transform: \[\{ scale \}\] \}\]\}>/, 'the drawn surface is not what shrinks');
    assert.match(press, /accessibilityRole="button" \{\.\.\.rest\}/, 'the press is not a button by default, or a caller cannot give it another role');
    assert.match(press, /useEffect\(\(\) => \(\) => running\.current\?\.stop\(\), \[\]\)/, 'a press unmounted mid-spring leaves the spring running');
    assert.doesNotMatch(press, /pressRetentionOffset/, 'the press widens its own retention, so a scroll no longer cancels it');
    assert.doesNotMatch(press, /Animated\.spring/, 'the press writes its own spring instead of the one in motion.ts');
    assert.doesNotMatch(press, /createAnimatedComponent/, 'the press animates the Pressable itself, which motion.test.ts refuses');
    assert.match(
      componentsSource(),
      /import \{ PRESS_SCALE, pressTo, useReduceMotion \} from '\.\/motion\.ts';/,
      'the press does not take its scale and its spring from the motion vocabulary',
    );

    // The spring itself: STYLE's numbers, converted, and instant when movement
    // is withheld, so the press is still felt and nothing travels.
    const motion = stripComments(readFileSync(join(SRC, 'motion.ts'), 'utf8'));
    const spring = motion.slice(motion.indexOf('export function pressTo('));
    assert.ok(motion.includes('export function pressTo('), 'motion.ts has no press spring');
    assert.match(spring, /if \(reduced\) \{\s*value\.setValue\(to\);\s*return null;/, 'reduced motion does not land the press at once');
    assert.match(spring, /stiffness: 439, damping: 29\.3, mass: 1/, 'the press spring is not STYLE\'s response 0.3 and damping 0.7');
    assert.match(motion, /export const PRESS_SCALE = 0\.97;/, 'a press does not scale to 0.97');

    // The older tappable parts press through it too, and none of them keeps a
    // Pressable of its own beside it.
    for (const [name, end] of [
      ['PillButton', 'export function OutlineButton('],
      ['GhostButton', 'export function OptionCard('],
      ['LedgerRow', 'export function Highlight('],
      ['TabBar<', 'export function Stat('],
    ] as const) {
      const body = region(componentsSource(), name === 'TabBar<' ? 'export function TabBar<' : `export function ${name}(`, end);
      assert.match(body, /<Press\b/, `${name} does not press through the one spring`);
      assert.doesNotMatch(body, /<Pressable\b/, `${name} keeps a Pressable of its own beside the spring`);
    }
  });

  test('a round button is a 44 disc for back and close and a 64 disc for next, with the ICONS.md mark', () => {
    // SNIPPETS header-pushed and button-next-round: back and close are a white
    // disc at the touch floor with a 24 mark; next is 64 with a 28 mark and its
    // word beside it. Sizes come from the floor, never a raw number.
    const round = part('RoundButton');
    assert.match(round, /kind: 'back' \| 'next' \| 'close'/, 'the round button is not the three SNIPPETS controls');
    assert.match(round, /const disc = next \? HIT \+ space\(5\) : HIT;/, 'the discs are not the touch floor and 64');
    assert.match(round, /<ChevronLeft size=\{24\}/, 'back is not the ICONS.md back mark at 24');
    assert.match(round, /<ArrowRight size=\{28\}/, 'next is not the ICONS.md next mark at 28');
    assert.match(round, /<CloseGlyph size=\{24\}/, 'close is not the ICONS.md close mark at 24');
    assert.match(round, /<Press haptic="light"/, 'the round button does not press through the one spring');
    assert.match(round, /ground === 'white' \? paper\.card : ground === 'sun' \? colour\.sun : paper\.ink/, 'the disc is not white, sun or ink');
    assert.doesNotMatch(round, /\b(44|64)\b/, 'the round button writes a raw size instead of the touch floor');
    const close = part('CloseGlyph');
    assert.ok(close.includes('M6 6l12 12') && close.includes('M18 6 6 18'), 'CloseGlyph is not ICONS.md\'s close');
    assert.ok(part('CheckGlyph').includes('M5 12.5l4.5 4.5L19 7'), 'CheckGlyph is not ICONS.md\'s check');
  });

  test('a colour card is one ground with its words in the palette\'s colours for it, and a stat tile and a hero number each read as one phrase', () => {
    const card = part('ColourCard');
    assert.match(card, /ground: Ground/, 'a colour card is not one of the four grounds');
    assert.match(card, /backgroundColor: colour\[ground\]/, 'the card is not its ground\'s colour');
    assert.match(card, /borderRadius: radius\.feature/, 'the card is not at the feature radius');
    assert.doesNotMatch(card, /<PillButton/, 'the colour card builds its own pill, so a screen\'s pill count moves into a shared file');
    // The whole card is a target only when it is given somewhere to go; a card
    // that holds its own pill is a plain view, never a button in a button.
    assert.equal((card.match(/<Press\b/g) ?? []).length, 1, 'the colour card presses in more than one place');
    assert.ok(card.indexOf('if (onPress != null)') !== -1 && card.indexOf('if (onPress != null)') < card.indexOf('<Press'), 'the card presses without being given somewhere to go');
    assert.match(card, /return <View style=\{surface\}>/, 'a card with no onPress is not a plain view');

    const tile = part('StatTile');
    assert.match(tile, /type\.stat/, 'the tile\'s number is not the stat style');
    assert.match(tile, /accessible accessibilityLabel=\{`\$\{value\}, \$\{label\}`\}/, 'the tile is read as two loose lines rather than one phrase');

    const hero = part('HeroNumber');
    assert.match(hero, /type\.hero/, 'the number is not the hero style');
    assert.match(hero, /type\.title/, 'the unit is not the title style');
    assert.match(hero, /textOn\[ground\]/, 'the hero number is not in its ground\'s words colour');
    assert.equal((hero.match(/accessibilityLabel=/g) ?? []).length, 1, 'the hero number is not one phrase to a screen reader');
  });

  test('an option row says its choice twice and marks it with the blue check or the field ring', () => {
    const row = part('OptionRow');
    assert.match(row, /accessibilityState=\{\{ selected \}\}/, 'the option row does not tell a device it is selected');
    assert.match(row, /aria-selected=\{selected\}/, 'the option row says nothing to the browser, so on the web the choice is silent');
    assert.match(row, /haptic="selection"/, 'a choice does not tick like a choice');
    assert.match(row, /backgroundColor: accent\.brand/, 'the chosen mark is not the brand blue');
    assert.match(row, /<CheckGlyph size=\{18\} color=\{paper\.onInk\}/, 'the chosen mark has no white check');
    assert.match(row, /borderColor: paper\.field/, 'the unchosen mark is not the field ring');
    assert.match(row, /accessibilityLabel=\{accessibilityLabel \?\? \(detail \? `\$\{title\}, \$\{detail\}` : title\)\}/, 'the option row does not name itself once from its title and detail');
  });

  test('a sheet rises from the bottom under an ink scrim, is modal, and closes from the scrim', () => {
    const sheet = part('Sheet');
    assert.match(sheet, /if \(!visible\) return null/, 'a hidden sheet still mounts');
    assert.match(sheet, /accessibilityViewIsModal/, 'the sheet is not modal, so a screen reader walks into the screen under it');
    assert.match(sheet, /backgroundColor: paper\.ink, opacity: 0\.45/, 'the scrim is not ink at 0.45');
    assert.match(sheet, /accessibilityLabel="Close"\s+onPress=\{onClose\}/, 'the scrim does not close the sheet, or says nothing when it does');
    assert.match(sheet, /borderTopLeftRadius: radius\.feature/, 'the panel\'s top corners are not the feature radius');
    assert.match(sheet, /accessibilityRole="header"/, 'the sheet\'s title is not a heading');
    assert.doesNotMatch(sheet, /#[0-9A-Fa-f]{6}\b|rgba\(/, 'the sheet spells a raw colour; palette.ts is the only file with one');
    const panel = region(componentsSource(), '  sheetOverlay: {', '  grabber:');
    assert.match(panel, /justifyContent: 'flex-end'/, 'the sheet does not rise from the bottom');
  });

  test('a skeleton is still sand blocks that say Loading once, and a quiet line is a centred small line', () => {
    const skeleton = part('Skeleton');
    assert.match(skeleton, /accessible accessibilityLabel="Loading"/, 'the skeleton does not say Loading once');
    assert.match(skeleton, /backgroundColor: paper\.skeleton/, 'the blocks are not sand');
    assert.doesNotMatch(skeleton, /Animated/, 'the skeleton shimmers; STYLE\'s motion budget has no room for it');
    const quiet = part('QuietLine');
    assert.match(quiet, /type\.small/, 'the quiet line is not small');
    assert.match(quiet, /textAlign: 'center'/, 'the quiet line is not centred');
    assert.doesNotMatch(quiet, /Animated/, 'the quiet line moves');
  });

  test('a French block leads with the French, marks it as French, glosses under it, and offers to hear or to stop', () => {
    const block = part('FrenchBlock');
    assert.match(block, /size === 'lg' \? type\.frenchLg : type\.french/, 'the French is not the large French line, or the list size');
    assert.match(block, /<Text \{\.\.\.frenchText\}/, 'the French line is not marked as French');
    assert.ok(block.indexOf('{french}') < block.indexOf('{english}'), 'the English leads the French');
    assert.match(block, /onColour\.blue/, 'the English on blue is not the blue ground\'s secondary');
    assert.match(block, /accessibilityLabel=\{playing \? 'Stop' : 'Hear this line'\}/, 'the hear control offers to play what is already playing');
    assert.match(block, /<EarGlyph size=\{22\}/, 'the hear control is not the ICONS.md speaker at 22');
    assert.match(block, /<Press\b/, 'the hear control does not press through the one spring');
    const disc = region(componentsSource(), '  hearDisc: {', '});');
    assert.match(disc, /width: HIT, height: HIT/, 'the hear control is under the touch floor');
  });
});

/**
 * The Start parts, held to SNIPPETS.md — F601.
 *
 * The first run needed three things the parts file did not have: an error line
 * that carries the alert mark rather than a colour, a mark for where a learner
 * stands against one goal, and a can-do that reads as a sentence. The first is
 * a restyle of `Field` in place; the other two are appended after the B
 * stylesheet, and the alert mark moved in beside them.
 */
describe('the Start parts keep their promises — F601', () => {
  /** From one export to the next, or to the end of the file. */
  const part = (name: string): string => {
    const source = componentsSource();
    const at = source.indexOf(`export function ${name}(`);
    assert.notEqual(at, -1, `${name} is missing from components.tsx`);
    const next = source.indexOf('\nexport ', at + 1);
    return source.slice(at, next === -1 ? source.length : next);
  };

  test('a field error sits beside the alert mark in ink, and is still announced', () => {
    // SNIPPETS field: the alert mark, then what happened and what to do, in
    // ink. Errors are never red, so the mark and the words carry the state.
    const source = componentsSource();
    const field = region(source, 'export function Field(', 'export function TabBar<');
    const opens = field.indexOf('{error != null && (');
    assert.notEqual(opens, -1, 'the field no longer draws its error only when there is one');
    const error = field.slice(opens);
    assert.match(error, /<View style=\{s\.fieldError\}>/, 'the error line is not a row');
    assert.match(error, /<AlertGlyph size=\{16\} color=\{paper\.ink\} \/>/, 'the error line has no 16 ink alert mark');
    assert.ok(error.indexOf('<AlertGlyph') < error.indexOf('{error}'), 'the alert mark does not lead the words');
    assert.match(error, /style=\{\[type\.small, ROW_WORDS, \{ color: paper\.ink \}\]\}/, 'the message is not the small line in ink, able to wrap beside the mark');
    assert.doesNotMatch(field, /signal\.correspondance/, 'the error still names the fix colour rather than the ink the board draws');
    const row = region(source, '  fieldError: {', '  fieldErrorMark:');
    assert.match(row, /flexDirection: 'row', alignItems: 'flex-start'/, 'the mark does not sit at the top of a wrapping message');

    // Still announced, exactly as before: the id the input points at, the web
    // alert role and the Android live region all stay on the words, and iOS
    // is still told out loud. The mark is decorative, so nothing is said twice.
    assert.match(
      error,
      /<Text\s+id=\{errorId\}\s+role="alert"\s+accessibilityLiveRegion="polite"/,
      'the error words lost their id, their alert role or their live region',
    );
    assert.match(field, /AccessibilityInfo\.announceForAccessibility\(error\)/, 'iOS is left with an error nothing speaks');
    assert.match(field, /aria-label=\{name != null && error != null \? `\$\{name\}, \$\{error\}` : name\}/, 'a failed field no longer folds its error into its name');

    // The mark is ICONS.md's alert, drawn here because Field draws it, and
    // hidden from assistive tech like every other glyph.
    const alert = part('AlertGlyph');
    assert.match(alert, /<Svg [^>]*\{\.\.\.decorative\}>/, 'the alert mark is announced as an unlabelled image');
    assert.match(alert, /strokeWidth=\{STROKE\}/, 'the alert mark is not drawn in the one pen');
    assert.match(alert, /fill="none"/, 'the alert mark is filled');
    assert.ok(alert.includes('M10.3 4.5 2.9 17.5a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0Z'), 'the alert is not ICONS.md\'s mark');
    // glyphs.tsx imports from this file, so this file never imports back.
    assert.doesNotMatch(source, /from '\.\/glyphs\.tsx'/, 'components.tsx imports from glyphs.tsx, which imports from it: a cycle');
  });

  test('a scene mark is a mint tick, a sun dot or a field ring, and names its state', () => {
    // SNIPPETS task-ticks and mark-next: a 24 disc. Done is mint with an ink
    // check, next is a plain sun dot, and one not reached yet is the grey ring.
    const mark = part('SceneMark');
    assert.match(mark, /\{ state \}: \{ state: 'earned' \| 'here' \| 'ahead' \}/, 'the mark does not take the three states of a stop');
    assert.match(mark, /state === 'earned' && \{ backgroundColor: colour\.mint \}/, 'a done mark is not mint');
    assert.match(mark, /\{state === 'earned' \? <CheckGlyph size=\{16\} color=\{paper\.ink\} \/> : null\}/, 'a done mark has no 16 ink tick, or another state draws one');
    assert.equal((mark.match(/<CheckGlyph\b/g) ?? []).length, 1, 'the tick is drawn more than once');
    assert.match(mark, /state === 'here' && \{ backgroundColor: colour\.sun \}/, 'the next mark is not a sun dot');
    assert.match(mark, /state === 'ahead' && \{ borderWidth: 2, borderColor: paper\.field \}/, 'a mark ahead is not the field ring');
    // Mint and sun take ink, never white (palette.ts).
    assert.doesNotMatch(mark, /paper\.onInk/, 'the mark sets white on mint or sun');
    // One element, and it says its state in a word, so colour is never the
    // only signal.
    assert.match(
      mark,
      /accessible\s+accessibilityLabel=\{state === 'earned' \? 'Done' : state === 'here' \? 'Next' : 'Not yet'\}/,
      'the mark does not say Done, Next or Not yet as one element',
    );
    const disc = region(componentsSource(), '  sceneMark: {', '});');
    assert.match(disc, /width: space\(6\),\s*height: space\(6\),\s*borderRadius: space\(3\)/, 'the mark is not a 24 disc');
  });

  test('a can-do reads as one sentence after "You\'ll be able to"', () => {
    // Production text, lifted and run: the lead and the function exactly as
    // components.tsx spells them, through node's own type stripper, because
    // this suite has no react-native to import the parts file with.
    const raw = readFileSync(join(SRC, 'components.tsx'), 'utf8');
    const lead = /const CAN_DO_LEAD = "[^"]*";/.exec(raw);
    assert.ok(lead, 'CAN_DO_LEAD is gone from components.tsx');
    const at = raw.indexOf('export function canDoSentence(');
    assert.notEqual(at, -1, 'canDoSentence is missing from components.tsx');
    const fn = raw.slice(at + 'export '.length, raw.indexOf('\n}\n', at) + 2);
    assert.match(fn, /\$\{CAN_DO_LEAD\}/, 'the sentence spells its own lead instead of the one the scene brief uses');
    const wrapped = stripTypeScriptTypes(`function lifted() {\n${lead[0]}\n${fn}\nreturn canDoSentence;\n}`);
    const body = wrapped.slice(wrapped.indexOf('{') + 1, wrapped.lastIndexOf('}'));
    const canDoSentence = new Function(`"use strict";\n${body}`)() as (canDo: string) => string;

    const expected = "You'll be able to order a coffee at the counter.";
    assert.equal(canDoSentence('Order a coffee at the counter'), expected);
    assert.equal(canDoSentence('Order a coffee at the counter.'), expected, 'a can-do that brings its own full stop ends on two');
    assert.equal(canDoSentence('  Order a coffee at the counter .. '), expected, 'stray space or stops survive into the sentence');

    // And every can-do the catalogue holds reads as one sentence: the lead,
    // the can-do with its first letter lowered and the rest as written, one
    // full stop.
    assert.ok(MISSIONS.length > 0, 'the catalogue is empty, so this check reads nothing');
    for (const mission of MISSIONS) {
      const canDo = mission.canDoEn.trim().replace(/\s*\.+$/, '');
      const sentence = canDoSentence(mission.canDoEn);
      assert.equal(
        sentence,
        `You'll be able to ${canDo.charAt(0).toLowerCase()}${canDo.slice(1)}.`,
        `${mission.id} does not read as one sentence: ${sentence}`,
      );
      assert.doesNotMatch(sentence, /\.\.$|[–—·]/, `${mission.id} ends on two stops or carries a dash or a middot`);
    }
  });
});
