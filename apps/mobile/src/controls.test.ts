/**
 * Controls a keyboard and a low-vision learner can use (F921, F927).
 *
 * F921: an input's border and an unchosen option's ring are the only thing
 * that says "this is a control", so they take `field` (3:1 and up), never the
 * decorative `line` hairline (1.24:1). F927: Space chooses a radio, checkbox,
 * tab or switch on the web, a keyboard focus draws the app's ring, and a
 * disabled action with a reason stays reachable and says why.
 *
 * Pure functions where the behaviour is a function, source reads where it is
 * wiring: there is no renderer in this suite (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { b, boldRhythm, colour, mainApp, paper } from './palette.ts';
import { signupWaitingReason } from './auth/signupForm.ts';
import { PASSWORD_MIN } from './auth/validate.ts';
import { contrast, MARK } from './testing/contrast.ts';
import { composeKeyDown, FOCUS_RING_ATTRIBUTE, focusRuleCss, keyActivates, spaceActivator } from './keyActivation.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const MODES = ['light', 'dark'] as const;

/**
 * Every control border and unchosen ring, found in its file by the words
 * around it. Each capture is `namespace.token`; the namespace says which
 * table the token is read from.
 */
const CONTROL_BORDERS: { file: string; what: string; pattern: RegExp }[] = [
  { file: 'auth/AccountField.tsx', what: 'the account input', pattern: /inputWrap:[^\n]*borderColor: (\w+\.\w+)/ },
  { file: 'auth/ProviderButtonBase.tsx', what: 'the Google button', pattern: /borderWidth: apple \? 0 : 1, borderColor: (\w+\.\w+)/ },
  { file: 'onboarding/BoldChoice.tsx', what: 'an unchosen quiet choice', pattern: /colourful \? 'transparent' : (\w+\.\w+)/ },
  { file: 'wall/WallPlansPage.tsx', what: 'an unchosen plan card', pattern: /: \{ borderWidth: 1, borderColor: (\w+\.\w+) \}\]\}>/ },
  { file: 'wall/WallPlansPage.tsx', what: 'an unchosen plan radio', pattern: /: \{ borderWidth: 1\.5, borderColor: (\w+\.\w+) \}\]\}>\s*\{checked/ },
  { file: 'explore/ExploreParts.tsx', what: 'the Explore field', pattern: /fieldInput: \{[^\n]*borderColor: (\w+\.\w+)/ },
  { file: 'components.tsx', what: 'an unchosen Choice on colour', pattern: /selected \? fill : onColourGround \? (\w+\.\w+) :/ },
  { file: 'components.tsx', what: 'an unchosen Choice on paper', pattern: /selected \? fill : onColourGround \? \w+\.\w+ : (\w+\.\w+)/ },
  { file: 'live/LiveParts.tsx', what: 'a live choice', pattern: /choice: \{[^\n]*borderColor: (\w+\.\w+)/ },
  { file: 'live/LiveParts.tsx', what: 'the live secondary button', pattern: /secondary: \{[^\n]*borderColor: (\w+\.\w+)/ },
  { file: 'conversationPacks/ConversationPracticeScreen.tsx', what: 'an unmatched pair tile', pattern: /borderColor: chosen \? t\.text : (\w+\.\w+)/ },
  { file: 'conversationPacks/ConversationPracticeScreen.tsx', what: 'an unchosen meaning', pattern: /borderColor: choice === i \? t\.text : (\w+\.\w+)/ },
];

/** A token as each mode draws it. The first run is light only, so `c` and `paper` read the same in both. */
function resolve(ref: string, mode: (typeof MODES)[number]): string {
  const [space, name] = ref.split('.') as [string, string];
  const table: Record<string, unknown> =
    space === 'c' ? boldRhythm : space === 'paper' ? paper : space === 'colors' ? mainApp[mode] : b[mode];
  const value = table[name];
  assert.equal(typeof value, 'string', `${ref} is not a colour token`);
  return value as string;
}

describe('F921: control borders', () => {
  test('input borders and radio rings reach 3:1 against their background', () => {
    for (const { file, what, pattern } of CONTROL_BORDERS) {
      const found = read(file).match(pattern);
      assert.ok(found, `${file}: could not find ${what}`);
      for (const mode of MODES) {
        const border = resolve(found[1]!, mode);
        for (const ground of ['card', 'ground'] as const) {
          const ratio = contrast(border, b[mode][ground]);
          assert.ok(ratio >= MARK, `${file}: ${what} (${found[1]}) is ${ratio.toFixed(2)} on the ${mode} ${ground}, under ${MARK}`);
        }
      }
    }
  });

  test('a control border never uses the decorative hairline', () => {
    // App-wide: every full `borderColor` drawn from the hairline (`line`,
    // `lineOnCard`, or mainApp's `border`, which is the same value) is a
    // finding unless it is listed here as decorative. A one-sided rule
    // (borderTopColor and the like) is a divider by construction and is not
    // read. A new input, choice, tile or chip on the hairline fails by default.
    const DECORATIVE = new Map<string, string>([
      ['components.tsx#stopMark', 'a stop on the progress line, not pressable'],
      ['components.tsx#inline:LineBullet', 'a rung bullet beside a line, not pressable'],
      ['drill/AnswerSheet.tsx#calm', 'the calm feedback panel around the answer words'],
      ['settings/ProfileParts.tsx#statRuled', 'the rules between the profile stats'],
      ['myfrench/CadenceCard.tsx#notYet', 'a day dot not yet practised'],
      ['tutor/MissionTaskList.tsx#open', 'an open task mark beside its words'],
      ['onboarding/firstRun/StreakCelebrationScreen.tsx#disc', 'a day disc inside the streak art'],
      ['onboarding/firstRun/WeekStrip.tsx#open', 'an open day in the week strip'],
    ]);
    const root = new URL('.', import.meta.url);
    const files = readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !p.startsWith('testing/'));
    const findings: string[] = [];
    const seen = new Set<string>();
    for (const file of files) {
      const source = read(file);
      for (const m of source.matchAll(/\bborderColor:\s*([^,}\n]+)/g)) {
        if (!/\.(line|lineOnCard|border)\b/.test(m[1]!)) continue;
        // The style this border belongs to: the key in front of its innermost open brace.
        let depth = 0;
        let at = m.index!;
        for (; at >= 0; at -= 1) {
          const ch = source[at];
          if (ch === '}') depth += 1;
          else if (ch === '{') { if (depth === 0) break; depth -= 1; }
        }
        // An inline style is named by the component it sits in, so one entry never covers a whole file.
        const key = /(\w+):\s*$/.exec(source.slice(Math.max(0, at - 80), at))?.[1]
          ?? `inline:${[...source.slice(0, at).matchAll(/function (\w+)/g)].at(-1)?.[1] ?? 'module'}`;
        const where = `${file.split('\\').join('/')}#${key}`;
        seen.add(where);
        if (!DECORATIVE.has(where)) findings.push(`${where} (${m[1]!.trim()})`);
      }
    }
    assert.deepEqual(findings, [], 'controls drawn with the decorative hairline (1.2:1); use field, or list a truly decorative border with its reason');
    for (const where of DECORATIVE.keys()) assert.ok(seen.has(where), `${where} is allowlisted but no longer on the hairline; drop it from the list`);
  });
});

describe('F927: Space and the focus ring', () => {
  test('Space selects an onboarding option', () => {
    for (const role of ['radio', 'checkbox', 'tab', 'switch']) {
      assert.equal(keyActivates(role, ' '), true, `Space does not choose a ${role}`);
      assert.equal(keyActivates(role, 'Spacebar'), true, `old Spacebar does not choose a ${role}`);
      // Enter already presses through react-native-web's own responder; a
      // second press here would choose twice.
      assert.equal(keyActivates(role, 'Enter'), false, `Enter would fire twice on a ${role}`);
    }
    // A button already takes Space from the responder.
    assert.equal(keyActivates('button', ' '), false);
    assert.equal(keyActivates(undefined, ' '), false);

    let chosen = 0;
    let prevented = 0;
    const onKeyDown = spaceActivator('radio', () => { chosen += 1; });
    assert.ok(onKeyDown, 'a radio gets no key handler');
    onKeyDown({ key: ' ', repeat: false, preventDefault: () => { prevented += 1; } });
    assert.equal(chosen, 1, 'Space did not choose');
    assert.equal(prevented, 1, 'Space would scroll the page');
    onKeyDown({ key: ' ', repeat: true, preventDefault: () => { prevented += 1; } });
    assert.equal(chosen, 1, 'a held Space chose again');
    onKeyDown({ key: 'Enter', repeat: false, preventDefault: () => { prevented += 1; } });
    assert.equal(chosen, 1, 'Enter chose a second time');
    assert.equal(spaceActivator('button', () => {}), undefined, 'a button would take Space twice');

    // A caller's own onKeyDown still runs beside the Space handler (it was replaced).
    const heard: string[] = [];
    const both = composeKeyDown((e: { key: string }) => heard.push(`space ${e.key}`), (e: { key: string }) => heard.push(`caller ${e.key}`));
    both!({ key: 'a' });
    assert.deepEqual(heard, ['space a', 'caller a'], 'the caller key handler was dropped');
    assert.equal(composeKeyDown(undefined, undefined), undefined);
    const solo = (e: { key: string }) => heard.push(e.key);
    assert.equal(composeKeyDown(undefined, solo), solo);

    // Every onboarding option is built on Press, and Press and Chip wire it.
    const components = read('components.tsx');
    const press = components.slice(components.indexOf('export function Press('), components.indexOf('function SelectRing('));
    assert.match(press, /spaceActivator\(/, 'Press does not answer Space');
    assert.match(press, /webKeyDown\(composeKeyDown\(onSpace, callerKeyDown\)\)/, 'Press replaces the caller onKeyDown');
    const chip = components.slice(components.indexOf('export function Chip('), components.indexOf('export function Chip(') + 3000);
    assert.match(chip, /spaceActivator\(role/, 'a filter chip does not answer Space');
    for (const [file, start] of [
      ['onboarding/BoldChoice.tsx', 'export function BoldChoice'],
      ['onboarding/BOnboardingParts.tsx', 'export function BOption'],
      ['onboarding/TutorSelection.tsx', 'export function TutorSelection'],
    ] as const) {
      const source = read(file);
      const body = source.slice(source.indexOf(start), source.indexOf(start) + 2500);
      assert.match(body, /<Press\b[^>]*accessibilityRole=/, `${file}: the option is not a Press`);
      assert.doesNotMatch(body, /<Pressable\b/, `${file}: a raw Pressable skips the Space handler`);
    }
  });

  test('focused buttons show the app focus ring', () => {
    // The token: a 2pt ink outline over a 2pt white halo that fills the gap,
    // so on every ground the app puts a control on, one of the pair is a mark.
    const theme = read('theme.ts');
    assert.match(theme, /export const FOCUS = \{ width: 2, offset: 2, colour: paper\.ink, halo: paper\.card \}/, 'theme.ts has no two-tone 2pt focus token');
    const GROUNDS = [
      ['cream', paper.ground], ['white card', paper.card], ['dark ground', b.dark.ground], ['dark card', b.dark.card],
      ['blue', colour.blue], ['coral', colour.coral], ['sun', colour.sun], ['mint', colour.mint],
    ] as const;
    for (const [name, ground] of GROUNDS) {
      const best = Math.max(contrast(paper.ink, ground), contrast(paper.card, ground));
      assert.ok(best >= MARK, `the focus ring is ${best.toFixed(2)} at best on ${name}, under ${MARK}`);
    }

    // One rule, keyboard focus only, and it outranks react-native-web's own outline reset.
    const css = focusRuleCss({ width: 2, offset: 2, colour: paper.ink, halo: paper.card });
    assert.match(css, new RegExp(`\\[data-${FOCUS_RING_ATTRIBUTE}\\]:focus-visible`), 'the ring is not keyboard focus only');
    assert.match(css, new RegExp(`outline: 2px solid ${paper.ink} !important`), 'the ring is not drawn');
    assert.match(css, new RegExp(`box-shadow: 0 0 0 2px ${paper.card} !important`), 'the halo does not fill the gap');
    assert.match(css, /:focus:not\(:focus-visible\)[^{]*\{[^}]*outline: none/, 'a mouse click would draw a ring');

    // Injected once, from components.tsx, on the web only.
    const components = read('components.tsx');
    assert.match(components, /if \(Platform\.OS === 'web'\) installFocusRule\(FOCUS\)/, 'the rule is never installed');
    const keyActivation = read('keyActivation.ts');
    assert.match(keyActivation, /getElementById\(FOCUS_RULE_ID\)/, 'the rule could be injected twice');
    assert.match(components, /const ringProps = \(Platform\.OS === 'web' \? \{ dataSet: focusRing \}/, 'the ring attribute is not set on the web');

    // Every shared control carries it.
    const slice = (start: string, end: string) => components.slice(components.indexOf(start), components.indexOf(end, components.indexOf(start)));
    for (const [name, body] of [
      ['Press', slice('export function Press(', 'function SelectRing(')],
      ['OutlineButton', slice('export function OutlineButton(', 'export function GhostButton(')],
      ['OptionCard', slice('export function OptionCard(', 'A labelled text input')],
      ['Chip', slice('export function Chip(', 'A lock, drawn two ways')],
    ] as const) {
      assert.match(body, /\{\.\.\.ringProps\}/, `${name} does not carry the focus ring`);
    }
  });

  test('a disabled button with a reason stays reachable and says why', () => {
    const components = read('components.tsx');
    const press = components.slice(components.indexOf('export function Press('), components.indexOf('function SelectRing('));
    assert.match(press, /const explained = disabled && disabledReason != null/, 'Press takes no reason');
    // Still in the tab order: the Pressable is not disabled, so it keeps tabIndex 0.
    assert.match(press, /disabled=\{disabled && !explained \? true : undefined\}/, 'an explained button leaves the tab order');
    assert.match(press, /accessibilityDisabled: true/, 'the web does not hear it is off');
    assert.match(press, /setAttribute\('aria-description', disabledReason\)/, 'the web does not hear why');
    assert.match(press, /accessibilityHint: disabledReason/, 'a device does not hear why');
    assert.match(press, /if \(disabled \|\| onPress\?\.\(\) === false\) return;/, 'an explained press is not ignored');
    assert.match(press, /onLongPress=\{explained \? undefined : onLongPress\}/, 'an explained button still answers a long press');
    const pill = components.slice(components.indexOf('export function PillButton('), components.indexOf('function PillWait('));
    assert.match(pill, /disabledReason\?: string/, 'PillButton takes no reason');
    assert.match(pill, /disabledReason=\{disabled && !waiting \? disabledReason : undefined\}/, 'PillButton does not pass its reason');

    // Sign-up's Create account says what is still missing, and nothing while busy.
    assert.equal(signupWaitingReason('', '', ''), `Add your email and a password of at least ${PASSWORD_MIN} characters to continue.`);
    assert.equal(signupWaitingReason('', 'longenough', 'longenough'), 'Add your email to continue.');
    assert.equal(signupWaitingReason('a@example.com', 'short', 'short'), `Use a password of at least ${PASSWORD_MIN} characters to continue.`);
    assert.equal(signupWaitingReason('a@example.com', 'longenough', ''), 'Type your password again to continue.');
    assert.equal(signupWaitingReason('a@example.com', 'longenough', 'different1'), 'Make both passwords match to continue.');
    assert.equal(signupWaitingReason('a@example.com', 'longenough', 'longenough'), null);
    for (const email of ['', 'a@example.com']) for (const password of ['', 'short', 'longenough']) for (const confirm of ['', 'short', 'longenough']) {
      const reason = signupWaitingReason(email, password, confirm);
      if (reason) assert.doesNotMatch(reason, /[\u2014\u00B7]/, 'the reason carries an em dash or middot');
    }
    const signup = read('auth/SignUpScreen.tsx');
    assert.match(signup, /disabledReason=\{!busy && !formOk && !ready \? signupWaitingReason\(email, password, confirm\) \?\? undefined : undefined\}/, 'Create account does not say why it is off');
    assert.match(read('onboarding/BoldButton.tsx'), /<PillButton \{\.\.\.props\}/, 'BoldButton drops the reason');
  });
});

describe('F927: targets', () => {
  /** The drawn height plus the vertical hitSlop the control's Press carries. */
  const TARGETS: [file: string, what: string, style: RegExp, slop: RegExp][] = [
    ['explore/ExploreParts.tsx', 'a filter chip', /\n\s*chip: \{ minHeight: (\d+)/, /hitSlop=\{\{ top: (\d+), bottom: (\d+) \}\} onPress=\{\(\) => onToggle/],
    ['practice/PracticeParts.tsx', 'a practice tab', /\n\s*tab: \{ minHeight: (\d+)/, /hitSlop=\{\{ top: (\d+), bottom: (\d+) \}\} onPress=\{\(\) => onChoose/],
    ['tabs/TutorTab.tsx', 'a mode segment', /\n\s*cell: \{ minHeight: (\d+)/, /const CHIP_SLOP = \{ top: (\d+), bottom: (\d+)/],
    ['tabs/TutorTab.tsx', 'a talk chip', /\n\s*talkChip: \{ minHeight: (\d+)/, /const CHIP_SLOP = \{ top: (\d+), bottom: (\d+)/],
    ['tabs/TutorTab.tsx', 'an outline link', /\n\s*outline: \{ minHeight: (\d+)/, /const OUTLINE_SLOP = \{ top: (\d+), bottom: (\d+)/],
  ];
  test('every chip, segment and outline link reaches the 44pt target', () => {
    for (const [file, what, style, slop] of TARGETS) {
      const source = read(file);
      const height = Number(source.match(style)?.[1]);
      const pad = source.match(slop);
      assert.ok(Number.isFinite(height) && pad, `${file}: could not read ${what}`);
      const target = height + Number(pad[1]) + Number(pad[2]);
      assert.ok(target >= 44, `${file}: ${what} is ${target}pt to a finger, under 44`);
    }
    // The plan pill is drawn inside the whole-card Press, never its own target.
    const profile = read('settings/ProfileParts.tsx');
    assert.match(profile, /<Press haptic="light" accessibilityRole="button" accessibilityLabel=\{spoken\} onPress=\{onPress\} style=\{s\.plan\}>[\s\S]*?<View style=\{s\.planPill\}>/, 'the plan pill is no longer inside the card target');
  });
});
