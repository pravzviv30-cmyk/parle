import { evidence } from '../../test/evidence.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_TUTOR_VOICE } from '@luvani/core';
import {
  MAX_FIRST_NAME_CHARS,
  PRE_ACCOUNT_PAGES,
  firstNameFrom,
  freshPreAccountDraft,
  clearPreAccountDraft,
  loadPreAccountDraft,
  savePreAccountDraft,
} from './preAccountDraft.ts';
import { CREATE_ACCOUNT_AGE } from './firstRun.ts';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const source = read('./PreAccountOnboarding.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const app = read('../../App.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const KEY = '@luvani/pre-account-onboarding/v1';

/** Every answer the plan pages add, unanswered. */
const UNANSWERED = { drink: null, frequency: null, eligibilityConfirmed: false, quickStart: false, rememberLearning: false, reminderEnabled: false, reminderDays: [], page: null, startLevel: null, reason: null, minutes: null, reminderTime: null, firstName: null } as const;

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
  test('a learner can resume an explicitly unset routine after restarting the local first run', async () => {
    installDisk();
    const chosen = { ...freshPreAccountDraft(), page: 'plan' as const, minutes: 'none' as const };
    await savePreAccountDraft(chosen);
    assert.deepEqual(await loadPreAccountDraft(), chosen);
  });
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

    const junk: Partial<Record<keyof typeof UNANSWERED, unknown[]>> = {
      page: ['welcome', 'ready', 3, {}, 'PLAN'],
      startLevel: ['beginner', 'A1', 0, true],
      reason: ['holiday', '', ['trip']],
      minutes: [0, 7, '10', 20, null],
      reminderTime: ['dawn', 18, { value: 'evening' }],
      firstName: ['', '   ', 42, 'x'.repeat(MAX_FIRST_NAME_CHARS + 1), '\u0000'],
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

  test('first names strip Unicode formatting and controls before validation', async () => {
    const disk = installDisk();
    for (const [input, expected] of [['x\u202eevil', 'xevil'], ['\u200b\u200d', null], ['A\u0085da', 'Ada'], ['Ada\u0000', 'Ada']] as const) {
      assert.equal(firstNameFrom(input), expected);
      disk.set(KEY, JSON.stringify({ ...freshPreAccountDraft(), firstName: input }));
      assert.equal((await loadPreAccountDraft())?.firstName, expected);
    }
  });

  test('joiners preserve Persian and Sinhala spelling but cannot form a name alone', async () => {
    const disk = installDisk();
    for (const [input, expected] of [
      ['علی\u200cرضا', 'علی\u200cرضا'],
      ['ශ්\u200dරී', 'ශ්\u200dරී'],
      ['\u200c\u200d', null],
      ['x\u202eevil', 'xevil'],
      ['A\u200b\ufeff\u0000\u00adda', 'Ada'],
    ] as const) {
      assert.equal(firstNameFrom(input), expected);
      disk.set(KEY, JSON.stringify({ ...freshPreAccountDraft(), firstName: input }));
      assert.equal((await loadPreAccountDraft())?.firstName, expected);
    }
  });

  test("sign-in preserves guest work until explicit account ownership handling", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(flow, /setScreen\('signin'\)/); assert.doesNotMatch(flow.slice(flow.indexOf('const signIn ='), flow.indexOf('if (!introducing)')), /clearGuestPractice|clearPreAccountDraft/); const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx'); assert.match(handoff, /Keep this practice/); assert.match(handoff, /Start fresh/); assert.match(handoff, /adoptGuestUsage/); });

  test("complete accounts keep their own profile and new accounts use modern onboarding", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(app, /existing === null && preAccountDraft !== null && mayAdoptPreAccountDraft\(freshStart\)/); assert.match(app, /existing === null \? \( <PreAccountOnboarding/); assert.match(app, /<GuestAccountHandoff/); assert.match(app, /owner !== scopeGeneration\(\)/); assert.match(app, /if \(!ready \|\| freshStart === null\) return <Loading/); });

  test('the first name is optional, trimmed and bounded', async () => {
    const disk = installDisk();
    disk.set(KEY, JSON.stringify({ ...freshPreAccountDraft(), firstName: '  Ada  ' }));
    assert.equal((await loadPreAccountDraft())?.firstName, 'Ada');
    disk.set(KEY, JSON.stringify({ ...freshPreAccountDraft(), firstName: 'x'.repeat(MAX_FIRST_NAME_CHARS) }));
    assert.equal((await loadPreAccountDraft())?.firstName?.length, MAX_FIRST_NAME_CHARS);
  });

  test("setup selects plan and optional tutor before an account while eligibility precedes guest practice", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /label="Choose tutor"/); assert.match(screen, /TUTOR_VOICE_OPTIONS\.map/); assert.match(screen, /onCreateAccount\(\{ \.\.\.draft, page \}\)/); assert.match(screen, /!draft\.eligibilityConfirmed/); assert.match(screen, /label="Save progress"/); });

  test("page and artwork motion respond to actions and stop when reduced motion changes", () => { const motion = evidence('apps/mobile/src/onboarding/OnboardingMotion.tsx'); assert.match(motion, /useReduceMotion\(\)/); assert.match(motion, /stopAnimation\(\)/); assert.match(motion, /if \(reduced\)/); assert.match(motion, /duration: 270/); assert.doesNotMatch(motion, /Animated\.loop|setInterval/); });

  test("the selected drink model has separate French and English text without stitched punctuation", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /Bonjour, je vais prendre un/); assert.match(screen, /Hello, I will have a/); assert.match(screen, /draft\.drink === 'tea'/); assert.doesNotMatch(screen, /\.\. I’d|asSentences\(\[FIRST_LINE/); });

  test("the recorded example is optional and audio failure leaves a readable route", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /Audio could not play. The words are still here./); assert.match(screen, /This phrase has no recording yet/); assert.match(screen, /if \(playing\)/); assert.match(screen, /player\.pause\(\)/); assert.match(screen, /label="Make my plan"/); assert.doesNotMatch(screen, /requestRecordingPermissionsAsync/); });

  test("every catalogue voice is available in a contextual sheet with a provisional selection", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /surface === 'voice'/); assert.match(screen, /TUTOR_VOICE_OPTIONS\.map/); assert.match(screen, /selected=\{edit\.tutorVoice === v\.value\}/); assert.match(screen, /setEdit\(\{ \.\.\.edit, tutorVoice: v\.value \}\)/); assert.match(screen, /patch\(\{ tutorVoice: edit\.tutorVoice \}\)/); });

  test("voice selection is silent; a separate Hear control starts and stops its sample", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const selection = screen.slice(screen.indexOf("{surface === 'voice' &&"),screen.indexOf("{surface === 'start' &&")); assert.match(selection, /stopSound\(\)/); assert.match(selection, /onPress=\{\(\) => hear\(voiceSample\(v\.value\)\)/); assert.match(selection, /playing \? 'Stop'/); assert.doesNotMatch(selection, /setEdit[^;]*player\.play/); });

  test("the start sheet explains AI and retention before separate off-by-default opt-ins", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.equal(freshPreAccountDraft().analyticsConsent, false); assert.equal(freshPreAccountDraft().rememberLearning, false); const start = screen.slice(screen.indexOf("{surface === 'start' &&")); assert.ok(start.indexOf('STARTER_PROCESSING') < start.indexOf('Optional usage data')); assert.match(start, /title="Remember my learning"/); assert.match(start, /label="Privacy details"/); });

  test('turns the draft into one account-scoped profile exactly once', () => {
    assert.match(app, /function PreAccountProfileBootstrap/, 'the account boundary has no pre-account bootstrap');
    assert.match(app, /if \(!confirmed \|\| delivered\.current\) return/, 'strict mode can apply the draft more than once');
    assert.match(app, /const built = profileFromDraft\(draft\)/, 'the draft is not written through the one constructor that knows the contract');
    assert.match(app, /done\(built\)/, 'the profile is never handed over');
    assert.match(app, /onConsumed\(\)/, 'the pre-account draft is not cleared after profile creation');
  });
});

describe('the introduction the voice page shows', () => {
  test("voice sample captions come from the same catalogue as the bundled audio", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /tutorSampleLine\(v\.value\)/); assert.match(screen, /voiceSample\(v\.value\)/); assert.doesNotMatch(screen, /Bonjour, je m|my name is/); });
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


test('refusal clears a pending draft and wins over already queued answers — F641', async () => {
  const disk = installDisk();
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const delayed = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  AsyncStorage.setItem = async (key, value) => {
    writes++;
    if (writes === 1) { started(); await delayed; }
    disk.set(key, value);
  };
  const first = savePreAccountDraft({ ...freshPreAccountDraft(), firstName: 'Ada' });
  await entered;
  const queued = savePreAccountDraft({ ...freshPreAccountDraft(), firstName: 'Second answer' });
  const cleared = clearPreAccountDraft();
  release();
  await Promise.all([first, queued, cleared]);
  assert.equal(disk.has(KEY), false);
  assert.equal(await loadPreAccountDraft(), null);
  // A genuine new onboarding after this refusal is cleared may save again.
  await savePreAccountDraft(freshPreAccountDraft());
  assert.notEqual(await loadPreAccountDraft(), null);
});

test('a draft on the restored goal page resumes its question without losing answers or consent', async () => {
  const disk = installDisk();
  disk.set(KEY, JSON.stringify({ ...freshPreAccountDraft(), page: 'reason', reason: 'work', minutes: 'none', firstName: 'Ada', tutorVoice: 'marie', analyticsConsent: false }));
  const loaded = await loadPreAccountDraft();
  assert.equal(loaded?.page, 'reason');
  assert.equal(loaded?.reason, 'work');
  assert.equal(loaded?.minutes, 'none');
  assert.equal(loaded?.firstName, 'Ada');
  assert.equal(loaded?.tutorVoice, 'marie');
  assert.equal(loaded?.analyticsConsent, false);
});
