import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_TUTOR_VOICE } from '@luvani/core';
import {
  MAX_FIRST_NAME_CHARS,
  PRE_ACCOUNT_PAGES,
  freshPreAccountDraft,
  loadPreAccountDraft,
  savePreAccountDraft,
} from './preAccountDraft.ts';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const source = read('./PreAccountOnboarding.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const app = read('../../App.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const KEY = '@luvani/pre-account-onboarding/v1';

/** Every answer the plan pages add, unanswered. */
const UNANSWERED = { page: null, startLevel: null, reason: null, minutes: null, reminderTime: null, firstName: null } as const;

/** One in-memory AsyncStorage, so the round trip is the real store's. */
function installDisk(): Map<string, string> {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
    map.set(key, value);
    return Promise.resolve();
  };
  shared.removeItem = (key: string): Promise<void> => {
    map.delete(key);
    return Promise.resolve();
  };
  return map;
}

describe('the pre-account hand-off', () => {
  test('contains only the minimum account-creation answers', () => {
    assert.deepEqual(freshPreAccountDraft(), {
      version: 1,
      ageConfirmed: true,
      tutorVoice: DEFAULT_TUTOR_VOICE,
      analyticsConsent: false,
      ...UNANSWERED,
    });
  });

  test('a draft written before the usage-data question reads as opted out', async () => {
    // The version stays at 1 on purpose, so this blob is not an old shape being
    // upgraded, it is this shape with a field the writer had never heard of. A
    // learner nobody asked has not agreed to anything, so the absence repairs
    // forward to false rather than rejecting a perfectly good voice and age
    // answer or, far worse, reading silence as a yes.
    const disk = installDisk();
    disk.set(KEY, JSON.stringify({ version: 1, ageConfirmed: true, tutorVoice: DEFAULT_TUTOR_VOICE }));
    assert.deepEqual(await loadPreAccountDraft(), {
      version: 1,
      ageConfirmed: true,
      tutorVoice: DEFAULT_TUTOR_VOICE,
      analyticsConsent: false,
      ...UNANSWERED,
    });

    // And only a literal true is agreement. Everything a disk can hand back in
    // that slot other than the boolean itself is somebody who did not say yes.
    for (const junk of ['true', 1, null, {}, []]) {
      disk.set(KEY, JSON.stringify({ version: 1, ageConfirmed: true, tutorVoice: DEFAULT_TUTOR_VOICE, analyticsConsent: junk }));
      const loaded = await loadPreAccountDraft();
      assert.equal(loaded?.analyticsConsent, false, `this read as agreement: ${JSON.stringify(junk)}`);
    }

    // A real yes survives the round trip, or the question was asked for nothing.
    disk.set(KEY, JSON.stringify({ version: 1, ageConfirmed: true, tutorVoice: DEFAULT_TUTOR_VOICE, analyticsConsent: true }));
    assert.equal((await loadPreAccountDraft())?.analyticsConsent, true, 'a learner who said yes was carried across as a no');
  });

  test('the plan answers round-trip, and junk in any of them repairs to null', async () => {
    const disk = installDisk();
    const answered = {
      ...freshPreAccountDraft(),
      page: 'plan',
      startLevel: 'getby',
      reason: 'moving',
      minutes: 15,
      reminderTime: 'night',
      firstName: 'Ada',
    } as const;
    await savePreAccountDraft(answered);
    assert.deepEqual(await loadPreAccountDraft(), answered, 'an answered draft did not come back as it was written');

    const junk: Record<keyof typeof UNANSWERED, unknown[]> = {
      page: ['welcome', 'ready', 3, {}, 'PLAN'],
      startLevel: ['beginner', 'A1', 0, true],
      reason: ['holiday', '', ['trip']],
      minutes: [0, 7, '10', 20, null],
      reminderTime: ['dawn', 18, { value: 'evening' }],
      firstName: ['', '   ', 42, 'x'.repeat(MAX_FIRST_NAME_CHARS + 1), 'Ada\u0000'],
    };
    for (const [field, values] of Object.entries(junk)) {
      for (const value of values) {
        disk.set(KEY, JSON.stringify({ ...answered, [field]: value }));
        const loaded = await loadPreAccountDraft();
        assert.ok(loaded, `junk in ${field} threw the whole draft away`);
        assert.equal(loaded[field as keyof typeof UNANSWERED], null, `${field}: ${JSON.stringify(value)} was not repaired to null`);
        assert.equal(loaded.analyticsConsent, false, 'repairing an answer touched the consent');
      }
    }
  });

  test('leaving mid-flow resumes on the same page with the answers kept', async () => {
    const disk = installDisk();
    for (const page of PRE_ACCOUNT_PAGES) {
      await savePreAccountDraft({ ...freshPreAccountDraft(), page, startLevel: 'few', reason: 'trip' });
      const back = await loadPreAccountDraft();
      assert.equal(back?.page, page, `a learner who left on ${page} comes back somewhere else`);
      assert.equal(back?.startLevel, 'few');
      assert.equal(back?.reason, 'trip');
    }
    assert.ok(disk.has(KEY));
  });

  test('the first name is optional, trimmed and bounded', async () => {
    const disk = installDisk();
    disk.set(KEY, JSON.stringify({ ...freshPreAccountDraft(), firstName: '  Ada  ' }));
    assert.equal((await loadPreAccountDraft())?.firstName, 'Ada');
    disk.set(KEY, JSON.stringify({ ...freshPreAccountDraft(), firstName: 'x'.repeat(MAX_FIRST_NAME_CHARS) }));
    assert.equal((await loadPreAccountDraft())?.firstName?.length, MAX_FIRST_NAME_CHARS);
  });

  test('is a six-page flow with the plan and a selected Tutor before account creation', () => {
    assert.deepEqual([...PRE_ACCOUNT_PAGES], ['hear-it', 'first-line', 'start-level', 'reason', 'plan', 'save']);
    assert.match(source, /onPress=\{\(\) => chooseVoice\(option\.value\)\}/, 'a tap does not save the selected voice to the draft');
    assert.match(source, /onHear=\{\(\) => hearVoice\(selected\)\}/, 'the voice sample is not a deliberate learner action');
    assert.match(source, /I am 13 or older · Create account/, 'age confirmation is not kept at account creation');
    assert.match(source, /onCreateAccount\(draft\)/, 'the chosen voice is dropped before sign-up');
  });

  test('no page animates on its own; the highlighter is the only thing that moves', () => {
    assert.doesNotMatch(source, /\bAnimated\b/, 'a page animates again');
    assert.doesNotMatch(source, /settleIn|interpolate/, 'the flow brought back its own motion');
    assert.match(source, /const reduced = useReduceMotion\(\)/, 'the exchange cannot honour reduced motion');
  });

  test('the café reply is read aloud as two sentences, with no doubled mark — Stage 4 browser proof', () => {
    // The label read "…s’il vous plaît.. I’d like a coffee, please." because a
    // full stop was added after a line that already ends with one.
    assert.match(
      source,
      /accessibilityLabel=\{`Reply: \$\{asSentences\(\[FIRST_LINE\.reply\.fr, FIRST_LINE\.reply\.en\]\)\}`\}/,
      'the reply label joins its sentences by hand again',
    );
    assert.match(source, /import \{ asSentences \} from '\.\.\/copy\/spoken\.ts';/, 'the reply label does not use the shared sentence joiner');
  });

  test('the second page is the learner’s first line, and Continue waits for it', () => {
    assert.match(source, /const \[stage, setStage\] = useState<LineStage>\('ask'\)/, 'the first line has no local state');
    assert.match(source, /setStage\('saying'\)/, 'tapping the reply does not play it');
    assert.match(source, /\{page === 'first-line' && stage === 'said' && <PillButton label=\{CONTINUE\}/, 'the learner can move on before saying the line');
    assert.match(source, /\{page === 'first-line' && stage !== 'said' && <Text/, 'the first decision is not explained while Continue is withheld');
    assert.match(source, /accessibilityLiveRegion="polite"/, 'the tutor’s close is not announced when it appears');

    // A demonstration is not an excuse to ask for either permission. The real
    // scene remains the first place a learner can deliberately ask to speak.
    for (const permission of ['requestRecordingPermissionsAsync', 'requestPermissionsAsync', 'getPermissionsAsync']) {
      assert.ok(!source.includes(permission), `pre-account onboarding asks for permission through ${permission}`);
    }
  });

  test('the plan lists every voice and never hides a resumed choice', () => {
    assert.match(source, /\{voicesOpen && \(/, 'the voice list is always open, or never');
    assert.match(source, /\{TUTOR_VOICE_OPTIONS\.map\(\(option\) => \(/, 'the plan offers fewer than every voice');
    assert.match(source, /onChange=\{\(\) => setVoicesOpen\(\(open\) => !open\)\}/, 'the tutor card cannot open the voice list');
  });

  test('a voice selection plays that tutor’s bundled bilingual introduction', () => {
    const choose = source.slice(source.indexOf('const chooseVoice'), source.indexOf('const hearVoice'));
    assert.match(choose, /setPlaying\('sample'\)/, 'selecting a tutor does not show their introduction as playing');
    assert.match(choose, /player\.replace\(voiceSample\(voice\)\)/, 'selecting a tutor does not load that tutor’s own clip');
    assert.match(choose, /player\.play\(\)/, 'the selected tutor introduction is loaded but never heard');
    assert.ok(choose.indexOf('player.pause()') < choose.indexOf('player.replace('), 'a previous voice can keep sounding under the newly selected one');
  });

  test('the final page separates trust facts before it asks for analytics consent', () => {
    const save = source.slice(source.indexOf("page === 'save' &&"));
    const ai = save.indexOf('Your tutor is AI');
    const mic = save.indexOf('We ask for microphone permission only when you start a scene. You can type instead.');
    const raw = save.indexOf('Learning history does not include raw audio by default.');
    const consent = save.indexOf('<SwitchRow');
    assert.ok(ai > 0 && mic > ai && raw > mic, 'the final page no longer presents AI, microphone/typing and raw-audio facts in a readable order');
    assert.ok(consent > raw, 'analytics consent is asked before the learner is told what the app keeps');
    assert.match(save, /\{TRIAL_LINE\}/, 'the save page does not say what the trial is');
    assert.match(save, /<Field\b/, 'the save page does not ask for a first name');
  });

  test('turns the draft into one account-scoped profile exactly once', () => {
    assert.match(app, /function PreAccountProfileBootstrap/, 'the account boundary has no pre-account bootstrap');
    assert.match(app, /if \(delivered\.current\) return/, 'strict mode can apply the draft more than once');
    assert.match(app, /const built = profileFromDraft\(draft\)/, 'the draft is not written through the one constructor that knows the contract');
    assert.match(app, /done\(built\)/, 'the profile is never handed over');
    assert.match(app, /onConsumed\(\)/, 'the pre-account draft is not cleared after profile creation');
  });
});

describe('the introduction the voice page shows', () => {
  test('the introduction on the voice page is rendered from the catalogue, never typed in', () => {
    // The voice choice lives on the plan now, as the tutor card. Its signature
    // is the French half of the bundled sample, read off the catalogue through
    // `tutorCardFacts`, so the words on the card are the words the clip says.
    assert.match(source, /const card = tutorCardFacts\(selected\)/, 'the plan does not read the tutor card from the catalogue');
    assert.match(source, /signature=\{card\.signature\}/, 'the card shows a signature that is not the catalogue’s');

    // Nothing of the sentence may be written in this screen, in any form.
    assert.doesNotMatch(source, /Bonjour, je m/, 'the voice page writes the French opener out by hand');
    assert.doesNotMatch(source, /my name is/, 'the voice page writes the English half out by hand');
    assert.doesNotMatch(source, /persona\.name\}\. Hello/, 'the old two-sentence caption is still here');
  });
});

describe('a draft that names a voice the catalogue no longer has', () => {
  test('a retired voice becomes the default, and the rest of the draft survives', async () => {
    // F510. The catalogue went from eight voices to six, so a draft written
    // before that names somebody who has left it. A retired key is a repair,
    // not a corruption.
    const map = installDisk();

    for (const retired of ['luc', 'benoit', 'celine', 'enrick', 'mathieu']) {
      map.set(KEY, JSON.stringify({ version: 1, ageConfirmed: true, tutorVoice: retired, analyticsConsent: true }));
      const loaded = await loadPreAccountDraft();
      assert.ok(loaded, `a draft naming the retired voice ${retired} was thrown away instead of repaired`);
      assert.equal(loaded.tutorVoice, DEFAULT_TUTOR_VOICE, `${retired} did not become the default`);
      assert.equal(loaded.ageConfirmed, true, `${retired}'s draft lost the age confirmation`);
      assert.equal(loaded.analyticsConsent, true, `${retired}'s draft lost the usage-data answer, which is the one that matters`);
    }

    // A live key is still carried through untouched, so the repair cannot be
    // hiding a bug where every draft silently lands on the default.
    map.set(KEY, JSON.stringify({ version: 1, ageConfirmed: true, tutorVoice: 'marie', analyticsConsent: false }));
    const kept = await loadPreAccountDraft();
    assert.equal(kept?.tutorVoice, 'marie', 'a voice still in the catalogue was overwritten with the default');
    assert.equal(kept?.analyticsConsent, false, 'a no became a yes on the way through');

    // And a draft that is genuinely unreadable is still refused rather than
    // repaired into a learner who never confirmed their age.
    map.set(KEY, JSON.stringify({ version: 1, ageConfirmed: false, tutorVoice: 'marie' }));
    assert.equal(await loadPreAccountDraft(), null, 'an unconfirmed age was repaired into a confirmation');
  });
});
