/**
 * F945, founder decision 25: every tutor surface draws the learner's own tutor
 * as their portrait, not the shared orb, and the portrait's edge clears the
 * 3:1 mark floor on the surface it sits on, in light and dark.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TUTOR_VOICES, type TutorVoiceKey } from '@luvani/core';
import { tutorPortraitSvg } from '../onboarding/tutorPortraits.ts';
import { b, colour } from '../palette.ts';
import { MARK, contrast } from '../testing/contrast.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('each tutor shows their own portrait', () => {
  const voices = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];
  assert.equal(voices.length, 6);
  assert.equal(new Set(voices.map(tutorPortraitSvg)).size, 6, 'two tutors share a portrait');

  const component = read('./TutorPortrait.tsx');
  assert.match(component, /<SvgXml \{\.\.\.decorative\} xml=\{xml\}/);
  assert.match(component, /tutorPortraitSvg\(voice\)/);

  // Surfaces that always know the tutor: the orb is gone.
  const always: Array<[string, RegExp]> = [
    ['../onboarding/TutorSelection.tsx', /<TutorPortrait voice=\{voice\.value\} size=\{44\} ring=\{selected \? t\.sun : t\.text\} \/>/],
    ['../tabs/ProfileTab.tsx', /<TutorPortrait voice=\{tutorVoiceOf\(profile\)\} size=\{40\} ring=\{t\.text\} \/>/],
    ['../tabs/TutorTab.tsx', /<TutorPortrait voice=\{voiceKey\} size=\{56\} ring=\{t\.text\} \/>/],
  ];
  for (const [file, use] of always) {
    const src = read(file);
    assert.match(src, use, `${file} does not draw the learner's tutor`);
    assert.doesNotMatch(src, /tutor-orb"/, `${file} still draws the shared orb`);
  }
  // Surfaces whose caller passes the tutor: the portrait when it does.
  const given: Array<[string, RegExp]> = [
    ['../today/TodayParts.tsx', /voice \? <TutorPortrait voice=\{voice\} size=\{44\} ring=\{t\.text\} \/> :/],
    ['../live/LiveParts.tsx', /voice \? <TutorPortrait voice=\{voice\} size=\{outer \* 0\.64\} ring=\{t\.onBrand\} \/> :/],
    ['../onboarding/BOnboardingParts.tsx', /voice \? <TutorPortrait voice=\{voice\} size=\{size\} ring=\{t\.onBrand\} \/> :/],
    ['../onboarding/BOnboardingParts.tsx', /voice \? <TutorPortrait voice=\{voice\} size=\{orb\} ring=\{t\.onBrand\} \/> :/],
  ];
  for (const [file, use] of given) assert.match(read(file), use, `${file} cannot draw the learner's tutor`);
  // And each caller passes it (F945 wiring).
  const callers: Array<[string, RegExp]> = [
    ['../tabs/HomeTab.tsx', /<ComingUpCard\s+view=\{event\}\s+voice=\{tutorVoiceOf\(profile\)\}/],
    ['../onboarding/PreAccountOnboarding.tsx', /<BBandOrb size=\{70\} right=\{18\} top=\{22\} voice=\{draft\.tutorChosen && draft\.tutorVoice \? draft\.tutorVoice : undefined\} \/>/],
    ['../ConvoScreen.tsx', /<C2LiveRoom [^>]*voice=\{tutorVoiceOf\(profile\)\}/],
    ['../live/C2LiveRoom.tsx', /<LiveOrb state=\{state\} voice=\{voice\} /],
  ];
  for (const [file, use] of callers) assert.match(read(file), use, `${file} does not pass the learner's tutor`);
  // The choose step itself keeps the orb: no tutor is chosen yet.
  assert.match(read('../onboarding/PreAccountOnboarding.tsx'), /<BTutorOrb \/>/);

  // Each ring against the surface under it, both themes.
  for (const t of [b.light, b.dark]) {
    for (const [surface, ring, where] of [
      [t.card, t.text, 'a card'],
      [colour.blue, t.sun, 'the chosen tutor card'],
      [t.violet2, t.onBrand, 'the live orb ring'],
      [t.hint, t.onBrand, 'the tutor band disc'],
    ] as const) {
      assert.ok(contrast(surface, ring) >= MARK, `the ring on ${where} is ${contrast(surface, ring).toFixed(2)}:1`);
    }
  }
});
