/**
 * The scene preview's model and wiring (B1, 2026-10-20, B-ScenePreview).
 *
 * The one rule that matters most: a tutor line appears only where an authored
 * opener ships on the device. Everywhere else the preview offers the
 * learner's own authored opening, and never invents what the tutor will say.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { DAILY_SCENARIOS, MISSIONS, TUTOR_VOICES, phraseKeyOf, type TutorVoiceKey } from '@luvani/core';

import { DEVICE_VOICE, RECORDED_AUDIO, TEXT_ONLY } from '../copy/access.ts';
import type { TutorAudioPack } from '../daily/tutorAudio.ts';
import { TUTOR_LINES, TUTOR_LINES_VOICE } from '../onboarding/tutorLines.ts';
import { PREVIEW_COPY, hasAuthoredOpener, scenePreview, soundLabel, stageOf, startLabel } from './scenePreview.ts';

const VOICE = TUTOR_LINES_VOICE as TutorVoiceKey;
const OTHER = (Object.keys(TUTOR_VOICES) as TutorVoiceKey[]).find((v) => v !== VOICE)!;
const EMPTY = { audio: {} as TutorAudioPack, voice: VOICE };
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const CEFR = /\b(?:A0|A1|A2|B1|B2|C1|C2)\b/;

describe('the opener is authored, or it is the learner\'s own line', () => {
  test('the premier café opens on the bundled barista line', () => {
    const model = scenePreview('mission:premier-cafe', EMPTY)!;
    // The live opener rotates among three variants server-side (brain's
    // MISSION_OPENING_DECKS), so it is a line the barista might say.
    assert.equal(model.opener?.heading, 'The barista might say');
    assert.equal(model.opener?.line.fr, TUTOR_LINES.question.fr);
    assert.deepEqual(model.opener?.line.sound, { kind: 'opener', id: TUTOR_LINES.question.id });
    // The recording exists in one voice only; another voice reads it on the device.
    assert.deepEqual(scenePreview('mission:premier-cafe', { ...EMPTY, voice: OTHER })!.opener?.line.sound, { kind: 'device' });
  });

  test('every other scene says "You could start with" over its authored opening; a mission offers one line', () => {
    for (const s of DAILY_SCENARIOS) {
      const model = scenePreview(s.id, EMPTY)!;
      assert.equal(model.opener?.heading, PREVIEW_COPY.youCould, s.id);
      assert.equal(model.opener?.line.fr, s.openingFr);
      assert.equal(model.opener?.line.en, s.openingEn);
    }
    for (const m of MISSIONS.filter((m) => !hasAuthoredOpener(m.id))) {
      const model = scenePreview(m.id, EMPTY)!;
      if (m.referencePhrases.length === 0) assert.equal(model.opener, null, `${m.id} invented an opener`);
      else assert.equal(model.opener?.heading, 'One line you could use', m.id);
    }
    for (const id of [...DAILY_SCENARIOS.map((s) => s.id), ...MISSIONS.map((m) => m.id)]) {
      assert.doesNotMatch(scenePreview(id, EMPTY)!.opener?.heading ?? '', /will start with/, id);
    }
  });

  test('an unknown id answers null, so the screen falls back calmly', () => {
    assert.equal(scenePreview('mission:not-a-scene', EMPTY), null);
    assert.equal(scenePreview(undefined, EMPTY), null);
    assert.equal(scenePreview(42, EMPTY), null);
  });
});

describe('the rest of the page', () => {
  test('lines are capped at three, for every scene', () => {
    for (const id of [...DAILY_SCENARIOS.map((s) => s.id), ...MISSIONS.map((m) => m.id)]) {
      assert.ok(scenePreview(id, EMPTY)!.lines.length <= 3, id);
    }
    const long = DAILY_SCENARIOS.find((s) => s.lines.length > 3);
    if (long) assert.equal(scenePreview(long.id, EMPTY)!.lines.length, 3);
  });

  test('stages are words, never CEFR', () => {
    // 2026-10-20, B4 review: a mission names its stage, Starter; a daily
    // scene's tier 1 keeps Explore's difficulty label, Starting out.
    assert.equal(stageOf({ kind: 'mission', cefr: 'A0' }), 'Starter');
    assert.equal(stageOf({ kind: 'mission', cefr: 'A1' }), 'Basics');
    assert.equal(stageOf({ kind: 'scenario', tier: 1 }), 'Starting out');
    for (const id of [...DAILY_SCENARIOS.map((s) => s.id), ...MISSIONS.map((m) => m.id)]) {
      assert.doesNotMatch(scenePreview(id, EMPTY)!.eyebrow, CEFR, id);
    }
  });

  test('a clip is labelled recorded only when it plays; otherwise the device voice or text', () => {
    assert.equal(soundLabel({ kind: 'clip', id: 'x' }, true, true), RECORDED_AUDIO);
    assert.equal(soundLabel({ kind: 'clip', id: 'x' }, false, true), DEVICE_VOICE);
    assert.equal(soundLabel({ kind: 'device' }, true, false), TEXT_ONLY);
  });

  test('a recorded line is a clip only when this voice has it', () => {
    const scene = DAILY_SCENARIOS[0]!;
    const id = `phrase:${scene.id}:0`;
    const pack: TutorAudioPack = { [VOICE]: { [id]: 7 } };
    assert.deepEqual(scenePreview(scene.id, { audio: pack, voice: VOICE })!.lines[0]!.sound, { kind: 'clip', id });
    assert.deepEqual(scenePreview(scene.id, { audio: pack, voice: OTHER })!.lines[0]!.sound, { kind: 'device' });
  });

  test('the lines sub points at the practice button', () => {
    assert.equal(PREVIEW_COPY.linesSub, 'Hear each one, then practise them below.');
  });

  test('the practice door covers what its label promises, and only free practice says free', () => {
    for (const id of [...DAILY_SCENARIOS.map((s) => s.id), ...MISSIONS.map((m) => m.id)]) {
      const model = scenePreview(id, EMPTY)!;
      const practice = model.practice;
      if (practice === null) continue;
      // DailyPractice and Drill are local practice: neither opens a live session.
      assert.ok(practice.screen === 'DailyPractice' || practice.screen === 'Drill', id);
      const shown = model.lines.map((l) => l.fr);
      for (const fr of practice.covers) assert.ok(shown.includes(fr), `${id} practises a line it does not show`);
      if (practice.label === PREVIEW_COPY.practiseFirst) assert.deepEqual(practice.covers, shown, `${id} promises every line`);
      else {
        assert.equal(practice.label, 'Practise the first line, free', id);
        assert.deepEqual(practice.covers, [shown[0]], id);
      }
      if (practice.screen === 'Drill') assert.deepEqual(practice.params.node.phraseKeys, practice.covers.map(phraseKeyOf), id);
    }
    const cafe = scenePreview('mission:premier-cafe', EMPTY)!.practice!;
    assert.equal(cafe.screen, 'Drill');
    assert.equal(cafe.label, PREVIEW_COPY.practiseFirst, 'the premier café drills all three lines it shows');
    assert.equal(startLabel('Sam'), 'Start with Sam');
    assert.equal(PREVIEW_COPY.footnote, 'The live conversation uses speaking time. Practising the lines does not.');
  });
});

describe('the screen is layout over the model (source probes)', () => {
  const screen = read('./ScenePreviewScreen.tsx');

  test('it reads no plan table and no continue arc (purchases/capabilities.test.ts)', () => {
    assert.doesNotMatch(screen, /capabilitiesFor\(/);
    assert.doesNotMatch(screen, /useContinueArc\(/);
  });

  test('one primary, the start through useConversationStart; practice is the secondary', () => {
    assert.match(screen, /const conversation = useConversationStart\(\);/);
    assert.equal((screen.match(/<PillButton label=\{startLabel\(tutorName\)\}/g) ?? []).length, 1);
    assert.match(screen, /<PillButton variant="secondary" label=\{model\.practice\.label\}/);
    assert.match(screen, /nav\.navigate\(target\.screen, target\.params\)/);
  });

  test('an unknown id gets a way back to Explore', () => {
    assert.match(screen, /if \(model === null\)/);
    assert.match(screen, /nav\.navigate\('Tabs', \{ screen: 'Explore' \}\)/);
  });

  test('French is tagged and upright, and every line has a hear control', () => {
    assert.match(screen, /<Text \{\.\.\.frenchText\} style=\{\[type\.french, \{ color: textOn\.sun \}\]\}>\{model\.titleFr\}/);
    assert.doesNotMatch(screen, /fontStyle: 'italic'/);
    assert.match(screen, /<IconAction layout="inline" icon="speaker" label="Hear"/);
  });
});
