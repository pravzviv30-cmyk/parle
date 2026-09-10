import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DEFAULT_TUTOR_VOICE,
  TUTOR_VOICES,
  isTutorVoiceKey,
  tutorVoice,
  tutorSampleLine,
  type TutorVoiceKey,
} from './voices.ts';

/**
 * The shape the token server's `validTutorVoice` enforces before it signs a
 * voice into the join metadata. Repeated here rather than imported, because
 * core cannot import a service and because the point of the assertion is that
 * the two agree: a catalogue key the token server would silently drop is a
 * voice no learner could ever be given.
 */
const KEY_SHAPE = /^[a-z][a-z0-9-]*$/;
const MAX_KEY_CHARS = 32;

/**
 * Words that turn a description into a ranking. A learner picking a voice is
 * choosing who they want to talk to, not which one is the good one, and every
 * voice here is a real French speaker. "native", "proper" and "correct" are
 * the ones that would slip in first, because they read as helpful.
 */
const COMPARATIVE = /\b(best|better|more|most|native|authentic|proper|correct|perfect|natural|realistic|premium|clearer|clearest|pro)\b/i;

/** Anything that would tell a learner which company makes the sound. */
const VENDOR_WORDS = /eleven|labs|openai|anthropic|cartesia|deepgram|fish|azure|google|amazon|polly/i;

describe('the tutor voice catalogue', () => {
  test('a sound line says gender, age band and where the vendor places the accent, and nothing else', () => {
    // F504. A sound line is learner-facing copy about a recording, and the only
    // party who can back a claim in it is the vendor who made the recording. So
    // the shape is fixed: gender, the age band, and a place. Nothing about warmth,
    // timbre or quality, because nobody in this file has ever heard these voices.
    //
    // Five of the eight lines this replaced claimed Paris or Quebec, and under the
    // new recordings most of those would have been false. The agent's suite has
    // the other half of this: it cross-checks the place against the label the
    // vendor recorded beside the clip, so a line cannot merely be well-formed.
    const SOUND = /^A (young )?(man|woman)'s voice, from (France|Paris|Belgium)\.$/;

    for (const key of Object.keys(TUTOR_VOICES) as TutorVoiceKey[]) {
      const entry = tutorVoice(key);
      assert.match(entry.sound, SOUND, `${key}'s sound line says something it cannot back`);
      assert.equal(
        entry.sound.includes("woman's"),
        entry.gender === 'female',
        `${key}'s sound line and its gender disagree`,
      );
      assert.equal(
        /young/i.test(entry.sound),
        entry.ageBand === 'young',
        `${key}'s sound line and its age band disagree`,
      );
    }
  });

  test('the catalogue offers six voices, three men and three women, with one default', () => {
    const keys = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];

    assert.deepEqual(
      [...keys].sort(),
      ['alexandre', 'anatole', 'emilie', 'guillaume', 'marie', 'sarah'],
      'these six are the ones the vendor verifies for French AND French-accented English on the model the agent pins. Adding a seventh here without proving that at the vendor is how the tutor came to speak American English for weeks.',
    );

    // The keys that were here and are not any more. A stored preference naming
    // one of them lands on the default, which is what `resolveTutorVoice` does
    // and what the profile upgrade documents, so this list is a reminder rather
    // than a rule: never revive one of these names for a different voice.
    for (const retired of ['luc', 'benoit', 'celine', 'enrick', 'mathieu']) {
      assert.ok(!keys.includes(retired as TutorVoiceKey), `${retired} retired in F503 and must not come back`);
    }

    assert.equal(DEFAULT_TUTOR_VOICE, 'alexandre', 'the default is who a learner who has never chosen gets, and who every line of first-run copy names.');
    assert.ok(isTutorVoiceKey(DEFAULT_TUTOR_VOICE), 'the default has to be in the catalogue it defaults to');

    const names = new Set<string>();
    for (const key of keys) {
      const entry = tutorVoice(key);

      assert.equal(entry.key, key, `${key} disagrees with the key it is filed under, so a lookup and a round trip would return different voices`);
      assert.match(key, KEY_SHAPE, `${key} is not shaped like a key the token server would sign, so this voice could never reach the agent`);
      assert.ok(key.length <= MAX_KEY_CHARS, `${key} is longer than the token server's cap and would be dropped in flight`);
      assert.equal(key, key.toLowerCase(), `${key} is not lowercase, and a stored preference that differs only in case is a preference that stops working`);

      // The whole reason this feature is more than a dropdown: two of the eight
      // voices are women, so a persona pinned to "he" would have Celine
      // introduce herself as a man on the very first line she speaks.
      assert.equal(
        entry.persona.pronoun,
        entry.gender === 'female' ? 'she' : 'he',
        `${key} is a ${entry.gender} voice but the persona says "${entry.persona.pronoun}". The tutor would contradict itself out loud.`,
      );
      assert.ok(entry.persona.name.length > 0 && entry.persona.name.trim() === entry.persona.name, `${key} has no usable persona name`);
      assert.equal(names.has(entry.persona.name), false, `two voices both call themselves ${entry.persona.name}, so a learner cannot tell which one they picked`);
      names.add(entry.persona.name);

      // The learner-facing line. It may say gender and where the accent is
      // from, and "young" for the one voice whose age band is verified. Not
      // taste, not quality, and nothing about who supplies the audio.
      assert.ok(entry.sound.length > 0 && entry.sound.length <= 80, `${key}'s sound line is not a short plain sentence`);
      assert.ok(entry.sound.trim().endsWith('.'), `"${entry.sound}" is not a finished sentence`);
      assert.doesNotMatch(entry.sound, /—/, `"${entry.sound}" uses an em dash, which this repo's copy never does`);
      assert.doesNotMatch(entry.sound, COMPARATIVE, `"${entry.sound}" ranks this voice against the others. A learner picks who they want to talk to, not who is best.`);
      assert.doesNotMatch(entry.sound, VENDOR_WORDS, `"${entry.sound}" names the machinery to a learner`);
      assert.equal(
        /young/i.test(entry.sound),
        entry.ageBand === 'young',
        `"${entry.sound}" claims an age band the catalogue does not record for ${key}`,
      );
    }

    // Three and three. The women are the reason the persona follows the voice at
    // all: one hardcoded "he" and Marie introduces herself as a man in her own
    // first sentence. The balance is also a product decision, made after a roster
    // of six men and two women, and it is asserted so it cannot erode quietly.
    assert.equal(keys.filter((k) => TUTOR_VOICES[k].gender === 'female').length, 3, 'three of the six are women');
    assert.equal(keys.filter((k) => TUTOR_VOICES[k].gender === 'male').length, 3, 'three of the six are men');


    // Vendor ids live in exactly one place: the agent, which is the only
    // process holding the key that bills for them. If one ever appears here it
    // ships to the phone in the app bundle, and a re-clone under the same key
    // becomes an edit in two repositories instead of one table.
    const source = readFileSync(new URL('./voices.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(source, VENDOR_WORDS, 'the catalogue names the vendor. Core is imported by the app; the vendor belongs to the agent alone.');
    for (const token of source.match(/\b[A-Za-z0-9]{20}\b/g) ?? []) {
      const looksLikeAVendorId = /[a-z]/.test(token) && /[A-Z]/.test(token) && /[0-9]/.test(token);
      assert.equal(looksLikeAVendorId, false, `"${token}" is shaped like a vendor voice id. Those belong in the agent's ELEVEN_VOICES table, never in core.`);
    }
  });

  test('an unknown or malformed key is not a tutor voice', () => {
    for (const key of Object.keys(TUTOR_VOICES)) {
      assert.ok(isTutorVoiceKey(key), `${key} is in the catalogue but the guard denies it`);
    }

    const rejected: unknown[] = [
      '',
      '   ',
      'luc ', // a stored preference that was never trimmed is not a different voice, it is a bug upstream
      ' luc',
      'Luc',
      'LUC',
      'celine2',
      'celina',
      'céline', // the key is ASCII on purpose; the accent lives in the persona name
      'emilie/../admin',
      'luc,alexandre',
      // The prototype chain. A guard written as `key in TUTOR_VOICES` or as a
      // truthy lookup says yes to all four of these, and the agent would then
      // try to resolve `toString` to a vendor id.
      '__proto__',
      'constructor',
      'toString',
      'hasOwnProperty',
      42,
      true,
      null,
      undefined,
      {},
      [],
      ['luc'],
      { key: 'luc' },
    ];
    for (const bad of rejected) {
      assert.equal(isTutorVoiceKey(bad), false, `${JSON.stringify(bad) ?? String(bad)} was accepted as a tutor voice`);
    }
  });
});

/**
 * The introduction the sample clips speak, which lives here because the screen
 * that prints it and the script that synthesizes it are different processes.
 *
 * This file's other copy rules police the `sound` field only, so without this a
 * learner-facing sentence would sit in core with nothing checking it, which is
 * how core would become the next place an unpoliced line lives.
 */
describe('the bilingual introduction', () => {
  test('every voice introduces itself in two short sentences the catalogue owns, French first', () => {
    const seen = new Set<string>();
    for (const key of Object.keys(TUTOR_VOICES) as TutorVoiceKey[]) {
      const line = tutorSampleLine(key);
      const { name } = tutorVoice(key).persona;

      // French, then the same introduction in English. Two sentences, because
      // that is what the manifest records and what a live session would send for
      // this text. It was one sentence joined by "and in English" for a day, to
      // try to carry the accent across in a single request; it did not work, and
      // it read as a person translating their own name (F505).
      assert.equal(line, `Bonjour, je m’appelle ${name}. Hi, my name is ${name}.`, `${key}'s introduction`);
      assert.doesNotMatch(line, /in English/i, `${key}'s introduction still explains itself`);

      // Names itself and nobody else. Half of them are women, so a line saying
      // the wrong name is the exact mismatch this catalogue exists to prevent.
      for (const other of Object.keys(TUTOR_VOICES) as TutorVoiceKey[]) {
        const otherName = tutorVoice(other).persona.name;
        if (other === key || name.includes(otherName)) continue;
        assert.ok(!line.includes(otherName), `${key}'s introduction names ${otherName}`);
      }
      assert.ok(!seen.has(line), `${key} has its own introduction`);
      seen.add(line);

      // The same copy rules the `sound` lines answer to: a learner reads this one
      // on the first-run voice page and hears it in the clip.
      assert.ok(line.length < 90, `${key}'s introduction stays short: ${line.length} characters`);
      assert.doesNotMatch(line, /—/, `"${line}" uses an em dash, which this repo's copy never does`);
      assert.doesNotMatch(line, COMPARATIVE, `"${line}" ranks this voice against the others`);
      assert.doesNotMatch(line, VENDOR_WORDS, `"${line}" names the machinery to a learner`);
      assert.doesNotMatch(line, /repeat|say it|répétez|essayez/i, `"${line}" asks the learner to speak`);
    }
  });
});
