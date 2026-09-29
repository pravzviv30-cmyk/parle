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
  test('the monogram is an ink initial on the deeper paper, and it is hidden from assistive tech', () => {
    // 2026-09-27, notebook Phase 1: the monogram becomes an ink initial on
    // `groundDeep`, per the design contract, so the learner's mark stops
    // competing with the one ink pill. Revamp B keeps the names and changes
    // what they mean: `groundDeep` is the skeleton fill and `font.sansMedium` is
    // Outfit Medium, the one face. Still a circle, still sized from the disc,
    // still decorative so a screen reader walks past a loose letter.
    const mono = region(componentsSource(), 'export function Monogram(', 'export function ProgressDots(');
    assert.match(mono, /backgroundColor: paper\.groundDeep/, 'the disc is not the deeper paper');
    assert.doesNotMatch(mono, /accent\./, 'the monogram still wears an accent');
    assert.match(mono, /borderRadius: size \/ 2/, 'the disc is not a circle at its own size');
    assert.match(mono, /\{\.\.\.decorative\}/, 'the disc is not hidden from assistive tech');
    assert.match(mono, /fontFamily: font\.sansMedium/, 'the initial is not Outfit Medium');
    assert.match(mono, /fontSize: size \* 0\.44/, 'the initial is not sized to the disc');
    assert.match(mono, /color: paper\.ink/, 'the initial is not ink');
  });

  test('a pill, an outline and a ghost can be given a name for assistive tech, and forward it', () => {
    // Both take an optional accessibilityLabel and forward it to the Pressable,
    // falling back to the printed label when it is absent — which is the name a
    // Pressable already derived from its child Text, so the fallback is a no-op.
    const pill = region(componentsSource(), 'export function PillButton(', 'export function OutlineButton(');
    assert.match(pill, /accessibilityLabel\?: string/, 'PillButton takes no accessibilityLabel');
    assert.match(
      pill,
      /accessibilityLabel=\{accessibilityLabel \?\? label\}/,
      'PillButton does not forward its accessibilityLabel, or does not fall back to the label',
    );

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
      /accessibilityLabel=\{accessibilityLabel \?\? label\}/,
      'GhostButton does not forward its accessibilityLabel, or does not fall back to the label',
    );
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
  });

  test('a stat can sit three to a row — F366', () => {
    // Two facts to a row is Home's shape; My French has three facts and one
    // line, so the basis narrows to thirty percent when asked, and nothing else
    // about the stat changes.
    const stat = region(componentsSource(), 'export function Stat(', 'export function Monogram(');
    assert.match(stat, /columns\?: 2 \| 3/, 'Stat takes no column count');
    assert.match(stat, /columns === 3 \? '30%' : '46%'/, 'three to a row is not thirty percent each');
  });

  test('the tab bar can name itself and stand with nothing chosen — F368', () => {
    // Inline on Profile, the segmented control is a setting: a learner who has
    // not chosen a daily goal must see three quiet segments, not a lie, and a
    // screen reader must hear what the three words are a choice of.
    const bar = region(componentsSource(), 'export function TabBar<', 'export function Stat(');
    assert.match(bar, /active: K \| null/, 'the tab bar cannot stand with nothing chosen');
    assert.match(bar, /track = paper\.groundDeep/, 'the segmented control no longer runs on a paper track');
    assert.match(bar, /accessibilityLabel\?: string/, 'the tab bar cannot name its group');
    assert.match(bar, /accessibilityRole="tablist" accessibilityLabel=\{accessibilityLabel\}/, 'the name is not on the group');
    assert.match(bar, /accessibilityState=\{\{ selected: isActive \}\}/, 'a segment no longer says it is selected');
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
  test('a ledger row is one pressable at 56pt with an ink glyph and no disc, a title, a gloss, meta and a chevron, and it names itself once', () => {
    // One Pressable, not a card with a button in it: the whole row is the
    // target, a nested button is invalid on the web, and a row whose only tap
    // area is its chevron is F545 again.
    const row = region(componentsSource(), 'export function LedgerRow(', '\nexport function ');
    assert.equal((row.match(/<Pressable\b/g) ?? []).length, 1, 'the ledger row is not exactly one target');
    assert.match(row, /accessibilityRole="button"/, 'the row is not a button, so nothing says it opens anything');
    assert.match(
      row,
      /accessibilityLabel=\{accessibilityLabel \?\? \(gloss \? `\$\{title\}, \$\{gloss\}` : title\)\}/,
      'the row does not name itself from its own title and gloss, so a screen reader reads two loose lines',
    );
    assert.match(row, /accessibilityState=\{\{ disabled \}\}/, 'the row never says it is unavailable');
    assert.match(row, /<ChevronRight color=\{paper\.inkFaint\} \/>/, 'the row draws no chevron, so nothing marks it as a way in');
    assert.match(row, /\{trailing != null \? trailing : null\}/, 'the row cannot carry a state before its chevron');
    assert.match(row, /meta\?: string/, 'the row cannot carry trailing meta');
    assert.match(row, /pressed && !disabled && ls\.pressed/, 'the row has no pressed state, or fades a disabled one instead of saying so');
    assert.doesNotMatch(row, /opacity/, 'the row says unavailable in opacity, which leaves a control with no shape to fall back on');
    for (const cap of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'adjustsFontSizeToFit']) {
      assert.ok(!row.includes(cap), `the ledger row caps its words with ${cap}; a long title must wrap and the row grow to hold it`);
    }
    const style = region(componentsSource(), '  row: {', '  pressed:');
    assert.match(style, /minHeight: HIT \+ space\(3\)/, 'the ledger row is under its 56pt floor');
    assert.match(style, /borderBottomWidth: HAIRLINE/, 'the ledger row draws no hairline divider');
    assert.match(style, /borderBottomColor: paper\.line/, 'the divider is not the paper hairline');
    assert.doesNotMatch(style, /borderRadius|backgroundColor|borderColor: paper\.ink/, 'the ledger row is a box, not a line in a ledger');
    const glyph = region(componentsSource(), '  glyph: {', '  words:');
    assert.match(glyph, /minWidth: 24/, 'the glyph slot is not the 24pt ink glyph');
    assert.doesNotMatch(glyph, /backgroundColor|borderRadius/, 'the glyph sits on a disc again');
  });

  test('the one card is white at radius 16 with a paper hairline, no shadow and no ink outline', () => {
    // 2026-09-27, notebook Phase 1. Stricter than the whisper rule it replaces:
    // the card spreads no shadow at all, and the component file reaches for no
    // shadow token. The live microphone glow is the only shadow.
    const card = region(componentsSource(), '  card: {', '  cardPadded:');
    assert.doesNotMatch(card, /shadow/, 'the card still lifts on a shadow');
    assert.match(card, /backgroundColor: paper\.card/, 'the card is not white');
    assert.match(card, /borderRadius: radius\.card/, 'the card no longer turns the card corner from the token');
    assert.match(card, /borderWidth: HAIRLINE/, 'the card lost its hairline');
    assert.match(card, /borderColor: paper\.line/, 'the card is outlined in something other than the paper hairline');
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

  test('one ink pill, fully rounded; the seconds are quiet links; a caps label is soft ink', () => {
    const source = componentsSource();
    const pill = region(source, '  pill: {', '  pillPressed:');
    assert.match(pill, /minHeight: HIT \+ 12/, 'the pill is under 56pt');
    assert.match(pill, /backgroundColor: accent\.primary/, 'the pill is not ink');
    assert.match(pill, /borderRadius: radius\.pill/, 'the pill is not fully rounded like the logo');
    const outline = region(source, '  outline: {', '  outlinePressed:');
    assert.match(outline, /minHeight: HIT/, 'the quiet link is under the touch floor');
    assert.doesNotMatch(outline, /borderWidth|backgroundColor/, 'the secondary action is a boxed button, not a quiet link');
    const label = region(source, 'export function Label(', 'export function PillButton(');
    assert.match(label, /color = paper\.inkSoft/, 'the caps label is not soft ink');
    const option = region(source, '  optionSelected: {', '  optionPressed:');
    assert.doesNotMatch(option, /backgroundColor/, 'a chosen option is still a filled panel');
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
    // 2026-09-27, notebook Phase 1: the segmented control has a paper track and
    // a white active segment with ink lettering, so it never competes with the
    // one ink pill. The selected state is still said twice, as above.
    assert.match(bar, /color: isActive \? paper\.ink : paper\.inkSoft/, 'the chosen segment is not ink lettering');
    const track = region(source, '  tabActive: {', '  dotsRow:');
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
  const NEW_MARKS = ['Ledger', 'LedgerRow', 'Highlight', 'SoundTag', 'LadderMark', 'LevelPath', 'TutorCard', 'SceneBrief'] as const;
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

  test('no new mark caps its words, builds a pill, spells a hex or draws a tint', () => {
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

  test('the ledger rules its rows with a top hairline and is one list to assistive tech', () => {
    const ledger = mark('Ledger');
    assert.match(ledger, /accessibilityRole="list"/, 'the ledger is not a list to a screen reader');
    assert.match(ledger, /borderTopWidth: HAIRLINE/, 'the ledger has no rule above its first row');
    assert.match(ledger, /borderTopColor: paper\.line/, 'the ledger rule is not the paper hairline');
  });

  test('the highlighter draws in once behind a French line, and reduced motion lands on the band', () => {
    const band = mark('Highlight');
    assert.match(band, /const reduced = useReduceMotion\(\)/, 'the highlighter does not ask whether movement is withheld');
    assert.match(band, /drawIn\(draw, reduced\)/, 'the highlighter does not draw in through the one motion vocabulary');
    assert.match(band, /backgroundColor: highlight/, 'the band is not the highlighter');
    assert.match(band, /transform: \[\{ scaleX: draw \}\]/, 'the band does not draw across on a transform');
    assert.match(band, /transformOrigin: 'left'/, 'the band grows from its middle rather than drawing from the left like a pen');
    assert.match(band, /\{\.\.\.decorative\}/, 'the band is announced to assistive tech; the words on it are what is read');
    assert.match(band, /type\.french/, 'the line on the band is not set in the French serif');
    assert.match(band, /color: paper\.ink/, 'the line on the band is not ink');
    // Once, not a loop: there is no Animated.loop and nothing resets it.
    assert.doesNotMatch(band, /Animated\.loop|setValue\(0\)/, 'the highlighter moves more than once');
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

  test('a tutor card shows the orb, the name, the voice, the signature line, a sample and a quiet change link', () => {
    const card = mark('TutorCard');
    assert.match(card, /<OrbGlyph color=\{orb\.ready\}/, 'the tutor is not drawn as the orb');
    assert.match(card, /accessibilityLabel=\{playing \? `Stop \$\{name\}` : `Hear \$\{name\}`\}/, 'the sample offers to play what is already playing');
    assert.match(card, /<GhostButton label=\{changeLabel\}/, 'changing tutor is not a quiet link');
    assert.match(card, /type\.french/, 'the signature line is not set in the French serif');
  });

  test('a scene brief takes its one Start from the caller and draws everything else from tokens', () => {
    const brief = mark('SceneBrief');
    assert.match(brief, /action: ReactNode;/, 'the Start is no longer a node the caller passes');
    assert.match(brief, /\{action\}/, 'the brief never draws the Start it was handed');
    assert.match(brief, /CAN_DO_LEAD/, 'the can-do is not led by "You\'ll be able to"');
    assert.match(brief, /lines\.map\(/, 'the lines you will say are not drawn');
    assert.match(brief, /fitHero\(french\)/, 'the French title is not the fitted French hero');
    assert.match(brief, /\{corner != null \? <View style=\{ls\.corner\}>\{corner\}<\/View> : null\}/, 'the corner slot is gone, or reserved when empty');
    assert.match(componentsSource(), /corner: \{ minWidth: HIT, minHeight: HIT/, 'the corner slot is under the touch floor');
    assert.match(brief, /<Card\b/, 'the brief is not drawn on the one card');
    assert.doesNotMatch(brief, /fontSize|lineHeight|fontFamily/, 'the brief writes type itself; the scale lives in theme.ts');
  });

  test('the French hero fits long lines by the theme steps, never a raw size', () => {
    const fit = mark('fitHero');
    assert.match(fit, /type\.frenchHero/, 'a short line is not the French hero');
    assert.match(fit, /heroFit\.long/, 'a long line does not step down to 30');
    assert.match(fit, /heroFit\.longest/, 'the longest line does not step down to 26');
    assert.doesNotMatch(fit, /fontSize/, 'the fit writes a raw size; the steps live in theme.ts');
  });
});
