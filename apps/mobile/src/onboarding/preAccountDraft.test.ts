import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_TUTOR_VOICE } from '@luvani/core';
import { freshPreAccountDraft, loadPreAccountDraft } from './preAccountDraft.ts';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const source = read('./PreAccountOnboarding.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const app = read('../../App.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const KEY = '@luvani/pre-account-onboarding/v1';

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

  test('is a five-page flow with a selected Tutor before account creation', () => {
    assert.match(source, /PRE_ACCOUNT_PAGES = \['welcome', 'situations', 'life', 'voice', 'ready'\]/);
    assert.match(source, /\{`Meet \$\{persona\.name\}`\}/, 'the chooser does not name the Tutor actually selected');
    assert.match(source, /onPress=\{\(\) => chooseVoice\(option\.value\)\}/, 'a tap does not save the selected voice to the draft');
    assert.match(source, /onHear=\{\(\) => hearVoice\(option\.value\)\}/, 'voice previews are not a deliberate learner action');
    assert.match(source, /I am 13 or older · Create account/, 'age confirmation is not kept at account creation');
    assert.match(source, /onCreateAccount\(draft\)/, 'the chosen voice is dropped before sign-up');
  });

  test('each short page settles into place and honours reduced motion', () => {
    assert.match(source, /const reduced = useReduceMotion\(\)/, 'the onboarding transition cannot honour reduced motion');
    assert.match(source, /pageEntry\.setValue\(0\)/, 'a new page inherits the previous page’s final animation frame');
    assert.match(source, /settleIn\(pageEntry, reduced\)/, 'the flow invents a second motion vocabulary instead of using the shared settle');
    assert.match(source, /\[page, pageEntry, reduced\]/, 'moving to another page does not restart the transition');
    assert.match(source, /<Animated\.View style=\{entryStyle\}>\{body\}<\/Animated\.View>/, 'the page content is not carried by the transition');
    assert.match(source, /import \{ settleIn, useReduceMotion \} from '\.\.\/motion\.ts'/, 'the shared motion seam is no longer imported');
  });

  test('the second page proves the product with one local café turn before it explains more', () => {
    assert.match(source, /const CAFÉ_DEMO = \{/, 'the demo copy has no single owner');
    assert.match(source, /const \[demoAnswered, setDemoAnswered\] = useState\(false\)/, 'the café turn has no local state');
    assert.match(source, /setDemoAnswered\(true\)/, 'tapping the learner reply does not advance the exchange');
    assert.match(source, /\{page === 'situations' && demoAnswered && <PillButton label="Continue"/, 'the explanation can be skipped before the learner has tried a turn');
    assert.match(source, /\{page === 'situations' && !demoAnswered && <Text/, 'the first decision is not explained while Continue is withheld');
    assert.match(source, /settleIn\(demoEntry, reduced, 80\)/, 'the reply does not use the shared reduced-motion-safe reveal');
    assert.match(source, /<Animated\.View accessibilityLiveRegion="polite" style=\{\[st\.demoReveal, demoEntryStyle\]\}>/, 'the tutor response is not carried by the reveal or announced when it appears');

    // A demonstration is not an excuse to ask for either permission. The real
    // scene remains the first place a learner can deliberately ask to speak.
    for (const permission of ['requestRecordingPermissionsAsync', 'requestPermissionsAsync', 'getPermissionsAsync']) {
      assert.ok(!source.includes(permission), `pre-account onboarding asks for permission through ${permission}`);
    }
  });

  test('the voice chooser starts with three calm suggestions and never hides a resumed choice', () => {
    assert.match(source, /const SUGGESTED_VOICE_COUNT = 3/, 'the first chooser screenful is no longer bounded');
    assert.match(source, /const visibleVoices = showAllVoices \? TUTOR_VOICE_OPTIONS : SUGGESTED_VOICES/, 'the short list and full catalogue do not share one source');
    assert.match(source, /\{visibleVoices\.map\(\(option\) => \(/, 'the chooser ignores the suggested/full catalogue decision');
    assert.match(source, /label="See all voices"/, 'the complete catalogue has no way in');
    assert.match(source, /if \(!SUGGESTED_VOICES\.some\(\(option\) => option\.value === selected\)\) setShowAllVoices\(true\)/, 'a resumed voice outside the first three is hidden');
  });

  test('a voice selection plays that tutor’s bundled bilingual introduction', () => {
    // The audio assets are generated through the agent's real voice seam and
    // each speaks the bilingual introduction `tutorSampleLine` owns, French
    // first. The words are deliberately not quoted here: a comment that quotes
    // them is a copy that can drift and can never fail. Selecting a card must
    // play the selected clip, not merely draw a tick and make the learner hunt
    // for its ear control.
    const choose = source.slice(source.indexOf('const chooseVoice'), source.indexOf('const hearVoice'));
    assert.match(choose, /setPlaying\(voice\)/, 'selecting a tutor does not show their introduction as playing');
    assert.match(choose, /player\.replace\(voiceSample\(voice\)\)/, 'selecting a tutor does not load that tutor’s own clip');
    assert.match(choose, /player\.play\(\)/, 'the selected tutor introduction is loaded but never heard');
    assert.ok(choose.indexOf('player.pause()') < choose.indexOf('player.replace('), 'a previous voice can keep sounding under the newly selected one');
    assert.match(source, /they introduce themselves in French and then in English/, 'the voice page does not explain the bilingual introduction');
  });

  test('the final page separates trust facts before it asks for analytics consent', () => {
    const ready = source.slice(source.indexOf("page === 'ready' &&"));
    const ai = ready.indexOf('Your tutor is AI');
    const mic = ready.indexOf('We ask for microphone permission only when you start a scene. You can type instead.');
    const raw = ready.indexOf('Learning history does not include raw audio by default.');
    const consent = ready.indexOf('<SwitchRow');
    assert.ok(ai > 0 && mic > ai && raw > mic, 'the final page no longer presents AI, microphone/typing and raw-audio facts in a readable order');
    assert.ok(consent > raw, 'analytics consent is asked before the learner is told what the app keeps');
  });

  test('turns the draft into one account-scoped profile exactly once', () => {
    assert.match(app, /function PreAccountProfileBootstrap/, 'the account boundary has no pre-account bootstrap');
    assert.match(app, /if \(delivered\.current\) return/, 'strict mode can apply the draft more than once');
    assert.match(app, /createStoredProfile\(\{ name: null, ageConfirmed: draft\.ageConfirmed, motivation: null \}\)/, 'the age confirmation is not carried into the account profile');
    assert.match(app, /done\(withChosenVoice\(built, draft\.tutorVoice\)\)/, 'the selected voice is not written through the ordinary profile door');
    assert.match(app, /onConsumed\(\)/, 'the pre-account draft is not cleared after profile creation');
  });
});

describe('the introduction the voice page shows', () => {
  test('the introduction on the voice page is rendered from the catalogue, never typed in', () => {
    // This is the surface the defect actually shipped on, and the one with no
    // guard at all until now: the agent's copy had a test and the clip bytes had
    // a test, while the sentence a learner reads was a hand-typed template
    // literal that went a week disagreeing with the audio.
    assert.match(
      source,
      /<Text style=\{st\.sampleLine\}>\{`“\$\{tutorSampleLine\(selected\)\}”`\}<\/Text>/,
      'the voice page does not render the introduction from the catalogue',
    );
    assert.match(source, /tutorSampleLine/, 'the screen does not import the catalogue introduction at all');

    // Nothing of the sentence may be written in this screen, in any form. The
    // curly quotation marks are presentation and stay; the words never do.
    assert.doesNotMatch(source, /Bonjour, je m/, 'the voice page writes the French opener out by hand');
    assert.doesNotMatch(source, /my name is/, 'the voice page writes the English half out by hand');
    assert.doesNotMatch(source, /persona\.name\}\. Hello/, 'the old two-sentence caption is still here');
  });
});

describe('a draft that names a voice the catalogue no longer has', () => {
  test('a retired voice becomes the default, and the rest of the draft survives', async () => {
    // F510. The catalogue went from eight voices to six, so a draft written
    // before that names somebody who has left it. `readable` used to require a
    // live catalogue key, which meant the whole draft was discarded: the learner
    // lost their age confirmation AND the usage-data answer this draft exists to
    // carry across sign-up, and was asked every question again.
    //
    // A retired key is a repair, not a corruption. The agent's `resolveTutorVoice`
    // and the app's `tutorVoiceOf` both land an unknown key on the default and
    // never throw; loading a draft now does the same.
    const map = new Map<string, string>();
    const shared = AsyncStorage as unknown as Record<string, unknown>;
    shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
    shared.setItem = (key: string, value: string): Promise<void> => {
      map.set(key, value);
      return Promise.resolve();
    };
    const KEY = '@luvani/pre-account-onboarding/v1';

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
