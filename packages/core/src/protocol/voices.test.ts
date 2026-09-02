import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DEFAULT_TUTOR_VOICE,
  TUTOR_VOICES,
  isTutorVoiceKey,
  tutorVoice,
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
  test('the catalogue offers eight voices, one default, every key lowercase and vendor-free', () => {
    const keys = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];

    assert.deepEqual(
      [...keys].sort(),
      ['alexandre', 'benoit', 'celine', 'emilie', 'enrick', 'guillaume', 'luc', 'mathieu'],
      'the eight voices are the eight verified on the account for both French and English. Adding a ninth here without proving it exists at the vendor is a room that opens and a tutor that never speaks.',
    );

    assert.equal(DEFAULT_TUTOR_VOICE, 'luc', 'Luc is who a learner who has never chosen gets, and he is who the first-run copy describes.');
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

    assert.equal(keys.filter((k) => TUTOR_VOICES[k].gender === 'female').length, 2, 'the two women are the reason the persona follows the voice. Losing them loses the point.');

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
