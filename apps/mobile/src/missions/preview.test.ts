/**
 * The authored listening preview (Stage 4, item 4), held to where its sound
 * comes from.
 *
 * Three sources, and the label always names the one that plays: a bundled
 * recording of the learner's chosen tutor voice, the phone's own French voice,
 * or no sound at all. A mission has no recording anywhere in the app, so a
 * mission is never labelled recorded. Every preview says it is an authored
 * example, and none of it is an assessment of anything.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  DAILY_PHRASES,
  DAILY_SCENARIOS,
  MISSIONS,
  TUTOR_VOICES,
  getMission,
  type DailyScenario,
  type TutorVoiceKey,
} from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { AUTHORED_EXAMPLE, DEVICE_VOICE, RECORDED_AUDIO, TEXT_ONLY } from '../copy/access.ts';
import type { TutorAudioPack } from '../daily/tutorAudio.ts';
import { PREVIEW_COPY, previewFor, recordingIdFor } from './preview.ts';

const VOICES = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];
const [VOICE, OTHER] = VOICES as [TutorVoiceKey, TutorVoiceKey];
const CAFE = getMission('mission:cafe')!;
const SCENE = DAILY_SCENARIOS.find((s) => s.id === 'situation:cafe-terrace')!;
const ASSET = 42;

/** A recordings pack with exactly these ids for exactly this voice. */
const packWith = (voice: TutorVoiceKey, ids: readonly string[]): TutorAudioPack => ({
  [voice]: Object.fromEntries(ids.map((id, i) => [id, ASSET + i])),
});

describe('a mission previews its authored lines, and is never recorded — Stage 4 item 4', () => {
  test('the reference lines and the goal, in the device voice when the phone has French', () => {
    const preview = previewFor({ kind: 'mission', mission: CAFE }, { voice: VOICE, recordings: {}, deviceFrench: true });
    assert.deepEqual(preview.lines.map((l) => l.fr), [...CAFE.referencePhrases]);
    assert.ok(preview.lines.every((l) => l.en === null), 'an English line was invented for a phrase core does not gloss');
    assert.equal(preview.context, CAFE.goalEn);
    assert.equal(preview.audio, 'device');
    assert.equal(preview.label, DEVICE_VOICE);
    assert.equal(preview.plays, 'all');
    assert.equal(preview.asset, undefined);
    assert.equal(preview.note, AUTHORED_EXAMPLE);
  });

  test('text only when the phone has no French voice', () => {
    const preview = previewFor({ kind: 'mission', mission: CAFE }, { voice: VOICE, recordings: {}, deviceFrench: false });
    assert.equal(preview.audio, 'text');
    assert.equal(preview.label, TEXT_ONLY);
    assert.equal(preview.plays, 'none');
    assert.equal(preview.note, AUTHORED_EXAMPLE);
  });

  test('never recorded, whatever the recordings pack claims', () => {
    // Even a pack that names the mission, its lines, or every id a caller
    // could think of does not make a mission recorded.
    const hostile = packWith(VOICE, [CAFE.id, `phrase:${CAFE.id}:0`, ...CAFE.referencePhrases, 'phrase:mission:cafe:0']);
    for (const mission of MISSIONS) {
      for (const deviceFrench of [true, false]) {
        const preview = previewFor({ kind: 'mission', mission }, { voice: VOICE, recordings: hostile, deviceFrench });
        assert.notEqual(preview.audio, 'recorded', `${mission.id} was labelled recorded`);
        assert.notEqual(preview.label, RECORDED_AUDIO);
        assert.equal(preview.asset, undefined);
      }
    }
  });

  test('the bundled manifest holds no mission recordings, which is why', () => {
    const manifest = readFileSync(fileURLToPath(new URL('../daily/tutorAudioManifest.ts', import.meta.url)), 'utf8');
    assert.doesNotMatch(manifest, /"[^"]*mission:/, 'the manifest now carries mission audio; revisit this rule rather than labelling it by accident');
  });
});

describe('a situation is recorded only for the chosen voice, and only on the line recorded', () => {
  test('the recording is of the scene’s first line, not its opening suggestion', () => {
    assert.equal(recordingIdFor(SCENE), `phrase:${SCENE.id}:0`);
    // Core's own daily phrase list says what text that id is.
    const phrase = DAILY_PHRASES.find((p) => p.id === recordingIdFor(SCENE));
    assert.equal(phrase?.fr, SCENE.lines[0]?.fr);
    assert.notEqual(SCENE.openingFr, SCENE.lines[0]?.fr, 'the fixture no longer shows why the opening line is not the recorded one');
  });

  test('recorded tutor audio when the chosen voice has that recording', () => {
    const preview = previewFor({ kind: 'situation', scenario: SCENE }, { voice: VOICE, recordings: packWith(VOICE, [recordingIdFor(SCENE)]), deviceFrench: true });
    assert.equal(preview.audio, 'recorded');
    assert.equal(preview.label, RECORDED_AUDIO);
    assert.equal(preview.asset, ASSET);
    assert.equal(preview.plays, 'first', 'the other lines have no recording and are not played in another voice under this label');
    assert.deepEqual(preview.lines, SCENE.lines.map((l) => ({ fr: l.fr, en: l.en })));
    assert.equal(preview.lines[0]?.fr, SCENE.lines[0]?.fr, 'the recorded line is not the first one shown');
    assert.equal(preview.context, SCENE.bodyEn);
    assert.equal(preview.note, AUTHORED_EXAMPLE);
  });

  test('another voice’s recording is never borrowed', () => {
    const preview = previewFor({ kind: 'situation', scenario: SCENE }, { voice: OTHER, recordings: packWith(VOICE, [recordingIdFor(SCENE)]), deviceFrench: true });
    assert.equal(preview.audio, 'device');
    assert.equal(preview.label, DEVICE_VOICE);
    assert.equal(preview.asset, undefined);
  });

  test('a recording of another line or another scene is not this scene’s', () => {
    for (const id of [`phrase:${SCENE.id}:1`, `phrase:${SCENE.id}:2`, 'phrase:situation:cafe-bill:0', SCENE.id]) {
      const preview = previewFor({ kind: 'situation', scenario: SCENE }, { voice: VOICE, recordings: packWith(VOICE, [id]), deviceFrench: false });
      assert.equal(preview.audio, 'text', `${id} was taken as this scene's recording`);
      assert.equal(preview.label, TEXT_ONLY);
      assert.equal(preview.plays, 'none');
    }
  });

  test('a scene with no lines has nothing to record and nothing to play', () => {
    const bare = { ...SCENE, lines: [] } as DailyScenario;
    const preview = previewFor({ kind: 'situation', scenario: bare }, { voice: VOICE, recordings: packWith(VOICE, [recordingIdFor(bare)]), deviceFrench: true });
    assert.notEqual(preview.audio, 'recorded');
    assert.deepEqual(preview.lines, [{ fr: SCENE.openingFr, en: SCENE.openingEn }], 'a scene with no lines drops its opening suggestion too');
  });
});

describe('what the preview may say', () => {
  test('the label is exactly the source, and nothing claims the tutor or an assessment', () => {
    for (const line of [...Object.values(PREVIEW_COPY), RECORDED_AUDIO, DEVICE_VOICE, TEXT_ONLY, AUTHORED_EXAMPLE]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.doesNotMatch(line, /\d|—|%/, `"${line}" carries a number or a dash`);
      assert.doesNotMatch(line, /your tutor'?s voice|assess|score|check your|how you sound|pronunciation/i, `"${line}" implies more than playback`);
    }
  });
});
