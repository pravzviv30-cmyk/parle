/**
 * How a conversation opens, from its route params (F903, F923).
 *
 * Founder decision (F903): the onboarding typing answer is a suggestion. A
 * button that says "Start speaking" sends `textMode: false`, and that opens
 * the microphone whatever the stored preference. F923: after a web reload the
 * params come back as strings, and "false" used to be truthy.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { tutorGate } from './gate.ts';
import { parseSeedTopic, stringifySeedTopic } from './convoStart.ts';
import { boolParam, convoStartFromParams, micOpensOnReady } from './convoStart.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const typer = { preferTyping: true } as const;

describe('a conversation opens the way its button said — F903, F923', () => {
  test('pressing Start speaking opens the microphone whatever the onboarding typing preference', () => {
    const start = convoStartFromParams({ textMode: false }, typer);
    assert.equal(start.openedTyped, false);
    assert.equal(start.typingOpen, false, 'Start speaking opened on the typing box');
    assert.equal(start.openMicOnReady, true, 'Start speaking left the microphone closed');

    // Listen only keeps its box and its closed mic.
    const listen = convoStartFromParams({ textMode: false, listenOnly: true }, typer);
    assert.deepEqual([listen.typingOpen, listen.openMicOnReady, listen.listenOnly], [true, false, true]);
    // Typed is typed.
    assert.deepEqual(Object.values(convoStartFromParams({ textMode: true }, null)).slice(0, 3), [true, true, false]);
    // No stated intent keeps today's behaviour: the preference seeds the box, the mic opens closed.
    assert.deepEqual(convoStartFromParams(undefined, typer), { openedTyped: false, typingOpen: true, openMicOnReady: false, listenOnly: false, walkMode: false });
    assert.deepEqual(convoStartFromParams({}, null), { openedTyped: false, typingOpen: false, openMicOnReady: false, listenOnly: false, walkMode: false });
    // A walk wins and never types; its own mic path opens the microphone.
    assert.deepEqual(convoStartFromParams({ walkMode: true, textMode: true, listenOnly: true }, typer), { openedTyped: false, typingOpen: false, openMicOnReady: false, listenOnly: false, walkMode: true });

    // The route and the screen read the seam.
    const nav = read('../nav/RootNavigator.tsx');
    assert.match(nav, /const start = convoStartFromParams\(route\.params, profile\);/);
    assert.match(nav, /startInTextMode=\{start\.openedTyped\}/);
    assert.match(nav, /openMicOnReady=\{start\.openMicOnReady\}/);
    assert.match(read('../ConvoScreen.tsx'), /useState\(typingOpenAtStart \?\? \(listenOnly \|\| prefersTyping\(profile\)\)\)/);
  });

  test('a reloaded conversation address keeps its mode', () => {
    assert.equal(boolParam('true'), true);
    assert.equal(boolParam('false'), false);
    assert.equal(boolParam(true), true);
    assert.equal(boolParam(false), false);
    for (const odd of ['', '1', 'yes', 0, null, undefined]) assert.equal(boolParam(odd), undefined);
    const spoken = convoStartFromParams({ textMode: 'false' }, typer);
    assert.equal(spoken.openedTyped, false, 'a reloaded voice address opened typed');
    assert.equal(spoken.openMicOnReady, true);
    assert.equal(convoStartFromParams({ textMode: 'true' }, null).openedTyped, true);
    assert.equal(convoStartFromParams({ listenOnly: 'true' }, null).listenOnly, true);
    assert.equal(convoStartFromParams({ walkMode: 'true' }, null).walkMode, true);
    assert.equal(convoStartFromParams({ walkMode: 'false' }, null).walkMode, false);
  });

  test('Start speaking opens the microphone once, when the room is ready, and a refusal opens the box', () => {
    const ready = { openMicOnReady: true, openedTyped: false, walkMode: false, asked: false, live: true, roomShown: true };
    assert.equal(micOpensOnReady(ready), true);
    assert.equal(micOpensOnReady({ ...ready, asked: true }), false, 'the microphone is asked for twice');
    assert.equal(micOpensOnReady({ ...ready, live: false }), false, 'the microphone is asked for before the room is live');
    assert.equal(micOpensOnReady({ ...ready, roomShown: false }), false);
    assert.equal(micOpensOnReady({ ...ready, openedTyped: true }), false);
    assert.equal(micOpensOnReady({ ...ready, walkMode: true }), false, 'the walk has its own microphone path');
    assert.equal(micOpensOnReady({ ...ready, openMicOnReady: false }), false, 'a start with no stated intent opened the microphone');
    const screen = read('../ConvoScreen.tsx');
    assert.match(screen, /micOpensOnReady\(\{/);
    assert.match(screen, /micOnReadyAsked\.current = true;\s*void live\.openMic\(\)\.then\(opened => \{ if \(!opened\) setTypingOpen\(true\); \}\);/);
  });

  test('every Start speaking button says it chose voice, and other ways in say nothing', () => {
    // The gate carries an intent only when one was stated.
    assert.deepEqual(tutorGate(true, false), { go: true, screen: 'Convo', params: { textMode: false } });
    assert.deepEqual(tutorGate(true, true), { go: true, screen: 'Convo', params: { textMode: true } });
    assert.deepEqual(tutorGate(true), { go: true, screen: 'Convo', params: {} });

    const nav = read('../nav/RootNavigator.tsx');
    assert.match(nav, /if \(entry !== 'refused'\) \{ nav\.replace\('Convo', \{ textMode: false \}\); return; \}/, 'the Wall\'s Start speaking opens with no stated intent');
    assert.match(nav, /onStart=\{\(textMode\) => nav\.replace\('Convo', \{ missionId, textMode \}\)\}/);
    assert.match(read('../onboarding/FirstSceneScreen.tsx'), /onStart\(false\);/, 'the first scene\'s Start speaking no longer says voice');
    assert.match(read('./speakView.ts'), /other: \{ label: SPEAK_INSTEAD, textMode: false \}/, 'Speak instead no longer says voice');
    assert.match(read('../missions/MissionsScreen.tsx'), /label=\{typed \? 'Start typing' : 'Start speaking'\} onPress=\{\(\) => open\(first\)\}/);
    // Starts that are not labelled Speak keep their closed microphone.
    assert.match(read('../tabs/MyFrenchTab.tsx'), /tutorGate\(answered\)/);
    assert.match(read('../tabs/PracticeTab.tsx'), /tutorGate\(answered\)/);
    assert.match(read('../main/useConversationStart.ts'), /textMode: boolean \| undefined = prefersTyping\(profile\) \? true : undefined/);
  });

  test('a reloaded topic conversation keeps its topic', () => {
    const topic = { fr: 'Ta journée', en: 'Tell me about your day' };
    const inAddress = stringifySeedTopic(topic);
    assert.equal(typeof inAddress, 'string');
    assert.doesNotMatch(inAddress, /\[object Object\]/);
    assert.deepEqual(parseSeedTopic(inAddress), topic, 'the topic did not survive the address');
    // Within one visit the param is still the object itself.
    assert.deepEqual(parseSeedTopic(topic), topic);
    // The linking map writes and reads it that way, and the route hands the screen the validated one.
    const linking = read('../nav/theme.ts');
    assert.match(linking, /Convo: \{ path: 'conversation', parse: \{ seedTopic: parseSeedTopic \}, stringify: \{ seedTopic: stringifySeedTopic \} \}/);
    assert.match(read('../nav/RootNavigator.tsx'), /seedTopic=\{parseSeedTopic\(route\.params\?\.seedTopic\)\}/);
  });

  test('a malformed topic in the address is dropped, never sent to the tutor', () => {
    for (const bad of ['[object Object]', '', '{', '"x"', '{"fr":1,"en":"x"}', '{"fr":"a"}', '{"fr":" ","en":" "}', 42, null, undefined, ['a', 'b'], { fr: 'a' }]) {
      assert.equal(parseSeedTopic(bad), undefined, `kept ${JSON.stringify(bad)}`);
    }
    // Extra fields are never passed through.
    assert.deepEqual(parseSeedTopic('{"fr":"a","en":"b","x":"evil"}'), { fr: 'a', en: 'b' });
  });
});
