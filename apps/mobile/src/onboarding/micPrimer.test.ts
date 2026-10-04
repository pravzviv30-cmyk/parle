/**
 * The first scene's microphone primer: one button, the OS prompt only after
 * it, Open Settings plus typing if refused, and "Type instead" always there.
 * The decisions are values here; the wiring is read from the screen and the
 * navigator, in the idiom of the rest of this folder.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { TUTOR_VOICES } from '@luvani/core';
import { guiltIn } from '../copy/guilt.ts';
import { MEET_MIC } from './disclosure.ts';
import {
  OPEN_SETTINGS,
  PRIMER_ACTION,
  PRIMER_COPY,
  PRIMER_LINES,
  PRIMER_META,
  PRIMER_REFUSED,
  PRIMER_REFUSED_HOW,
  PRIMER_REFUSED_TITLE,
  PRIMER_REFUSED_WEB,
  PRIMER_REFUSED_WEB_TITLE,
  TYPE_INSTEAD,
  afterPermission,
  primerView,
} from './micPrimer.ts';

const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (relative: string) => strip(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'));

describe('the first scene opens with a microphone primer', () => {
  test('one button asks, and typing is always one tap away', () => {
    const ask = primerView('ask', true);
    assert.equal(ask.primary.act, 'ask');
    assert.equal(ask.primary.label, PRIMER_ACTION);
    assert.equal(PRIMER_ACTION, 'Start speaking');
    assert.equal(ask.note, MEET_MIC, 'the primer says something other than the first-run microphone line');
    assert.deepEqual(ask.secondary, { label: TYPE_INSTEAD, act: 'type' });
    assert.equal(ask.busy, false);
    assert.equal(primerView('asking', true).busy, true, 'the pill can be tapped twice while the OS is asking');

    for (const phase of ['ask', 'asking', 'refused'] as const) {
      for (const settings of [true, false]) {
        const view = primerView(phase, settings);
        const typing = [view.primary, view.secondary].filter((a) => a?.act === 'type');
        assert.equal(typing.length, 1, `${phase}/${settings}: "Type instead" is not on screen exactly once`);
        assert.equal(typing[0]!.label, TYPE_INSTEAD);
      }
    }
  });

  test('the first scene is the blue brief with a white Start, and a refusal turns to paper and leads with typing', () => {
    // The view model. The brief has no title of its own (the scene is the
    // title) and no how. A refusal leads with typing, because typing cannot
    // fail, and offers the phone's settings second where there are any.
    const brief = primerView('ask', true);
    assert.equal(brief.title, null);
    assert.equal(brief.how, null);
    const native = primerView('refused', true);
    assert.deepEqual(native, {
      title: 'The microphone is off for Luvani',
      note: 'You can turn it on in Settings, or type your answers.',
      how: 'In Settings, allow Luvani to use the microphone, then come back here.',
      primary: { label: TYPE_INSTEAD, act: 'type' },
      secondary: { label: OPEN_SETTINGS, act: 'settings' },
      busy: false,
    });
    assert.deepEqual(
      [native.title, native.note, native.how],
      [PRIMER_REFUSED_TITLE, PRIMER_REFUSED, PRIMER_REFUSED_HOW],
      'the refusal says words other than its exports',
    );
    const web = primerView('refused', false);
    assert.deepEqual(web, {
      title: 'Your browser is not sharing the microphone',
      note: 'You can allow it from the address bar, or type your answers.',
      how: null,
      primary: { label: TYPE_INSTEAD, act: 'type' },
      secondary: null,
      busy: false,
    }, 'the web offers a settings app it does not have');
    assert.deepEqual([web.title, web.note], [PRIMER_REFUSED_WEB_TITLE, PRIMER_REFUSED_WEB]);
    for (const line of [PRIMER_REFUSED_TITLE, PRIMER_REFUSED, PRIMER_REFUSED_HOW, PRIMER_REFUSED_WEB_TITLE, PRIMER_REFUSED_WEB]) {
      assert.ok(PRIMER_COPY.includes(line), `"${line}" is off the copy list, so nothing checks it`);
    }
    for (const entry of Object.values(TUTOR_VOICES)) {
      const meta = PRIMER_META(entry.persona.name);
      assert.equal(meta, `Your first scene, with ${entry.persona.name}`, `the brief names someone other than ${entry.key}`);
      assert.equal(guiltIn(meta), undefined);
      assert.doesNotMatch(meta, /[—–·]/);
    }
    assert.equal(afterPermission(true), 'start');
    assert.equal(afterPermission(false), 'refused');

    // The screen. The brief is a blue page, the refusal a paper one, from one
    // ground switch, so the one header and the one pill serve both.
    const screen = read('./FirstSceneScreen.tsx');
    assert.match(screen, /ground=\{refused \? paper\.ground : colour\.blue\}/, 'the brief is not blue, or the refusal is not paper');
    assert.match(screen, /<ScreenHeader title=\{false\} divider=\{false\} back=\{\{ onPress: onBack \}\} \/>/, 'the header prints a title over the brief');
    assert.doesNotMatch(screen, /SceneBrief/, 'the first scene is still a card on paper');
    assert.match(screen, /\{PRIMER_META\(persona\.name\)\}/, 'the brief does not say whose scene it is');
    assert.match(screen, /const persona = tutorPersonaOf\(useProfile\(\)\.profile\)/, 'the brief names a tutor the learner did not choose');
    assert.match(screen, /accessibilityRole="header" style=\{\[type\.title, \{ color: paper\.onInk \}\]\}>\{mission\.titleEn\}<\/Text>/, 'the English outcome is not the headline');
    assert.match(screen, /<Text \{\.\.\.frenchText\}[^\n]*>\{mission\.title\}<\/Text>/, 'the French scene title is missing');
    assert.match(screen, /title: \{ \.\.\.type\.display, color: textOn\.blue \}/, 'the French title is not legible on blue');
    assert.match(screen, /\{canDoSentence\(mission\.canDoEn\)\}/, 'the can-do is not one sentence');
    assert.match(screen, /mission\.referencePhrases\.slice\(0, 3\)/, 'the brief shows other than the first three lines');
    assert.match(screen, /<Label>One line to try<\/Label>/, 'the brief lacks a first usable line');
    assert.match(screen, /showMore && lines\.slice\(1\)/, 'the other examples cannot be disclosed');
    assert.equal(PRIMER_LINES(3), "The three lines you'll say");
    assert.equal(PRIMER_LINES(2), "The two lines you'll say", 'a scene with two lines is promised three');
    assert.match(screen, /<Card style=\{st\.lines\}>/, 'the lines are not on a white card');
    assert.match(screen, /tone=\{refused \? 'ink' : 'white'\}/, 'the Start is not white on blue, or the refusal pill is not ink');
    assert.match(screen, /typing \? <KeyboardGlyph size=\{22\} color=\{paper\.onInk\} \/> : <MicGlyph size=\{22\} color=\{paper\.ink\} \/>/, 'the pill does not carry the mark of what it does');
    assert.equal((screen.match(/<PillButton\b/g) ?? []).length, 1, 'the brief and the refusal draw more than one pill');

    // The refusal: the microphone drawing, the title, the note, the how, and
    // the settings note when Settings would not open.
    const refusal = screen.slice(screen.indexOf('{refused ? ('), screen.indexOf(') : ('));
    const order = ['<Illustration name="state-microphone" fit="small" />', '{view.title}', '{view.note}', '{view.how}', '{settingsNote}'];
    const at = order.map((piece) => refusal.indexOf(piece));
    assert.ok(at.every((i, n) => i > 0 && (n === 0 || i > at[n - 1]!)), `the refusal is not drawing, title, note, how and settings note in order: ${at.join(', ')}`);
  });

  test('primer copy is plain and kind', () => {
    for (const line of PRIMER_COPY) {
      assert.equal(guiltIn(line), undefined, `guilt in "${line}"`);
      assert.doesNotMatch(line, /[—–]/, `em dash in "${line}"`);
    }
  });

  test('the microphone refusal says how to turn it back on in words that are true on iOS and Android', () => {
    // F635. Open Settings lands on Luvani's own page on both phones, but only
    // iOS draws the microphone there as a switch; Android asks the learner to
    // allow it under Permissions. One sentence is true on both, and the view
    // model does not branch on the platform to get there.
    assert.equal(PRIMER_REFUSED_HOW, 'In Settings, allow Luvani to use the microphone, then come back here.');
    assert.doesNotMatch(PRIMER_REFUSED_HOW, /\b(switch|toggle)\b/i, 'the how names a switch Android does not have');
    assert.equal(primerView('refused', true).how, PRIMER_REFUSED_HOW, 'the refusal says a how other than the one sentence');
    assert.doesNotMatch(read('./micPrimer.ts'), /\bPlatform\b/, 'the primer view model branches on the platform');
  });

  test('the OS prompt is raised only by the primer’s button, and the scene opens through the ordinary route', () => {
    const screen = read('./FirstSceneScreen.tsx');
    assert.equal((screen.match(/requestRecordingPermissionsAsync/g) ?? []).length, 1, 'the primer asks for the microphone from more than one place');
    const ask = screen.slice(screen.indexOf('const ask = async'), screen.indexOf('const act ='));
    assert.match(ask, /requestRecordingPermissionsAsync\(\)/, 'the ask is not inside the button handler');
    assert.doesNotMatch(screen, /useEffect\([^)]*requestRecordingPermissionsAsync/, 'the primer asks on mount');
    assert.match(screen, /onStart\(false\)/, 'a granted microphone does not open the spoken scene');
    assert.match(screen, /onStart\(true\)/, 'typing does not open the typed scene');
    assert.match(screen, /openPhoneSettings\(\)/, 'a refusal cannot reach the phone’s settings');
    assert.doesNotMatch(screen, /from '\.\.\/live\//, 'the primer reaches into live session logic');

    const navigator = read('../nav/RootNavigator.tsx');
    assert.match(navigator, /<Stack\.Screen name="FirstScene" component=\{FirstSceneRoute\} \/>/, 'the first scene is not a route');
    assert.match(navigator, /nav\.replace\('Convo', \{ missionId, textMode \}\)/, 'the primer does not hand over to the ordinary conversation route');
    assert.match(read('../nav/types.ts'), /FirstScene: \{ missionId: string \}/);
    assert.match(read('../nav/theme.ts'), /FirstScene: 'first-scene\/:missionId'/);
  });
});
