import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { DEFAULT_TUTOR_VOICE } from '@luvani/core';
import { freshPreAccountDraft } from './preAccountDraft.ts';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const source = read('./PreAccountOnboarding.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const app = read('../../App.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the pre-account hand-off', () => {
  test('contains only the minimum account-creation answers', () => {
    assert.deepEqual(freshPreAccountDraft(), {
      version: 1,
      ageConfirmed: true,
      tutorVoice: DEFAULT_TUTOR_VOICE,
    });
  });

  test('is a five-page flow with a selected Tutor before account creation', () => {
    assert.match(source, /PRE_ACCOUNT_PAGES = \['welcome', 'situations', 'life', 'voice', 'ready'\]/);
    assert.match(source, /\{`Meet \$\{persona\.name\}`\}/, 'the chooser does not name the Tutor actually selected');
    assert.match(source, /onPress=\{\(\) => chooseVoice\(option\.value\)\}/, 'a tap does not save the selected voice to the draft');
    assert.match(source, /onHear=\{\(\) => hearVoice\(option\.value\)\}/, 'voice previews are not a deliberate learner action');
    assert.match(source, /I am 13 or older · Create account/, 'age confirmation is not kept at account creation');
    assert.match(source, /onCreateAccount\(draft\)/, 'the chosen voice is dropped before sign-up');
  });

  test('turns the draft into one account-scoped profile exactly once', () => {
    assert.match(app, /function PreAccountProfileBootstrap/, 'the account boundary has no pre-account bootstrap');
    assert.match(app, /if \(delivered\.current\) return/, 'strict mode can apply the draft more than once');
    assert.match(app, /createStoredProfile\(\{ name: null, ageConfirmed: draft\.ageConfirmed, motivation: null \}\)/, 'the age confirmation is not carried into the account profile');
    assert.match(app, /done\(withChosenVoice\(built, draft\.tutorVoice\)\)/, 'the selected voice is not written through the ordinary profile door');
    assert.match(app, /onConsumed\(\)/, 'the pre-account draft is not cleared after profile creation');
  });
});
