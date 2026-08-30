/**
 * The disclosure, held to what it promises.
 *
 * Two halves, in the `answers.test.ts` idiom. The first reads the constants,
 * because they are the copy and a value is the one thing this workspace can
 * assert about without a renderer. The second reads the first-run screens as
 * source, because "the app says AI before a learner talks to it" is a claim
 * about glass, and a module nobody imports says nothing to anybody.
 *
 * The listener check is written as negation-aware on purpose. A blunt search
 * for "person hears" flags the very sentence that exists to reassure, which is
 * how a safety test ends up rewarded for deleting the safety copy.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  FIRST_RUN_COPY,
  FIRST_RUN_SURFACES,
  MEET_AI,
  MEET_MIC,
  MEET_MORE,
  MEET_PILL,
  MEET_PRIVACY,
  MEET_TITLE,
  MEET_TYPING,
  PERSONA_BODY,
  PERSONA_TITLE,
  VENDOR_PHRASE,
  WELCOME_SUBLINE,
} from './disclosure.ts';
import { TUTOR_NAME } from '../tutor/tutorName.ts';

/** apps/mobile/src, so a first-run file can be named the way a screen names it. */
const SRC = new URL('../', import.meta.url);
const at = (relative: string) => fileURLToPath(new URL(relative, SRC));
const read = (relative: string) => readFileSync(at(relative), 'utf8');

/** JSX wraps a sentence across lines; a learner reads it as one. */
const squash = (source: string) => source.replace(/\s+/g, ' ');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/**
 * Every screen a learner can read before a conversation is reachable.
 *
 * Found by listing directories rather than by naming files, so a screen added
 * to the first run joins this check without anyone remembering to add it, and
 * a screen deleted this phase stops being looked for.
 */
function firstRunFiles(): string[] {
  const found: string[] = [];
  for (const dir of ['onboarding', 'auth', 'splash']) {
    if (!existsSync(at(dir))) continue;
    for (const name of readdirSync(at(dir))) {
      if (name.endsWith('.tsx')) found.push(`${dir}/${name}`);
    }
  }
  if (existsSync(at('tutor/TutorIntro.tsx'))) found.push('tutor/TutorIntro.tsx');
  return found;
}

const FIRST_RUN_SOURCE = firstRunFiles().map((file) => ({ file, source: stripComments(read(file)) }));

/** A human, close to a verb about receiving what the learner said. */
const LISTENER =
  /\b(person|human|someone|somebody|anyone|teacher|our team|native speaker)\b[^.!?]{0,60}\b(hear|hears|heard|listen|listens|listening|read|reads|watch|watches|watching|reply|replies|respond|responds)\b/i;
const NEGATED = /\b(no|not|never|nobody|nothing|none)\b/i;

/** True when a sentence says a human is on the other end, rather than that none is. */
function claimsAHumanListener(line: string): boolean {
  return line
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => LISTENER.test(sentence) && !NEGATED.test(sentence));
}

/** Phrases that put a human on the other end however they are arranged. */
const HUMAN_CLAIMS = [
  'real person',
  'real human',
  'human tutor',
  'live tutor',
  'our team',
  'someone is listening',
  'somebody is listening',
  'a person is listening',
  'we are listening',
  'we listen to',
  'native speaker',
  'moderated',
  'monitored',
  'reviewed by',
];

describe('the first run says what a learner is talking to', () => {
  test('the first run says the tutor is AI before any conversation', () => {
    // Order is the whole claim. Saying AI on the fourth screen is not saying it
    // before the conversation, so the list is read front to back and the front
    // door is held to the strictest version of the rule.
    assert.deepEqual(
      FIRST_RUN_SURFACES.map((s) => s.key),
      ['welcome', 'meet', 'persona'],
      'the surfaces a learner meets before a conversation changed shape',
    );

    const [welcome] = FIRST_RUN_SURFACES;
    assert.ok(welcome, 'there is no front door');
    assert.equal(welcome.lines[0], WELCOME_SUBLINE, 'the welcome subline is what the front door says');

    const opening = WELCOME_SUBLINE.split(/(?<=[.!?])\s+/)[0] ?? '';
    assert.match(opening, /\bAI\b/, 'the first sentence a learner reads does not say AI');
    assert.match(opening, /\bAI tutor\b/, 'AI is said, but not next to what he is');

    for (const surface of FIRST_RUN_SURFACES) {
      assert.ok(
        surface.lines.some((line) => /\bAI\b/.test(line)),
        `the ${surface.key} surface never says AI`,
      );
    }

    // Plainly means the word, not a softer word standing in for it.
    for (const line of FIRST_RUN_COPY) {
      for (const dodge of ['powered by', 'AI-powered', 'smart assistant', 'virtual friend', 'digital friend']) {
        assert.ok(!line.toLowerCase().includes(dodge.toLowerCase()), `"${line}" softens AI into "${dodge}"`);
      }
    }

    // A character is not a lie; a biography presented as fact is. Wherever the
    // invented life appears, the sentence that carries it also says what he is.
    assert.match(MEET_AI, /\b(made up|character we wrote)\b/i, 'the persona is offered as fact again');
    for (const line of FIRST_RUN_COPY) {
      if (/Lyon|ran a bar|behind a bar|twenty years/i.test(line)) {
        assert.match(line, /\bAI\b/, `"${line}" tells his life story without saying he is AI`);
      }
    }
  });

  test('no first-run copy claims a person is listening', () => {
    // The product position, stated in PRIVACY_AND_SAFETY.md: nobody is
    // watching a session, nobody is on call, no message reaches a human. A
    // learner decides what to say out loud before the first scene, so they
    // learn it before the first scene.
    for (const line of FIRST_RUN_COPY) {
      assert.ok(!claimsAHumanListener(line), `"${line}" puts a person on the other end`);
      for (const claim of HUMAN_CLAIMS) {
        assert.ok(!line.toLowerCase().includes(claim), `"${line}" implies a person is there: "${claim}"`);
      }
    }

    // Not implying is half of it. Saying so is the other half.
    assert.ok(
      FIRST_RUN_COPY.some((line) => /\bno (person|one|body)\b[^.!?]{0,40}\bhear/i.test(line)),
      'nothing in the first run tells a learner that no person hears them',
    );

    // And the screens themselves, so a hardcoded line cannot say what the
    // module is forbidden from saying.
    assert.ok(FIRST_RUN_SOURCE.length > 0, 'no first-run screen was found to read');
    for (const { file, source } of FIRST_RUN_SOURCE) {
      for (const claim of HUMAN_CLAIMS) {
        assert.ok(!source.toLowerCase().includes(claim), `${file} tells a learner "${claim}"`);
      }
    }
  });

  test('the first run borrows the Profile footer for where speech goes', () => {
    // Two stories about one pipeline is how a document and a screen start
    // disagreeing, and the learner is the one who finds out.
    const footer = squash(stripComments(read('tabs/ProfileTab.tsx')));
    assert.ok(footer.includes(VENDOR_PHRASE), 'the Profile footer no longer uses the words this module copied');
    assert.ok(MEET_PRIVACY.includes(VENDOR_PHRASE), 'the first run invented its own words for the vendors');
    assert.ok(
      footer.includes('Nothing is shared with anyone else'),
      'the footer stopped saying nothing is shared, so the first run should not say it either',
    );

    // The doc points at the module, so neither can drift alone.
    const policy = readFileSync(fileURLToPath(new URL('../../../../docs/PRIVACY_AND_SAFETY.md', import.meta.url)), 'utf8');
    assert.ok(
      policy.includes('onboarding/disclosure.ts'),
      'PRIVACY_AND_SAFETY.md does not name the module that says this to learners',
    );
  });

  test('no first-run copy promises a policy that does not exist', () => {
    // Legal review remains a release gate. First-run copy may not imply a
    // reviewed policy exists before the founder can name a controller, a
    // contact channel and vendor terms that have actually been checked.
    for (const line of FIRST_RUN_COPY) {
      for (const promise of [
        'privacy policy',
        'terms of service',
        'terms and conditions',
        'gdpr',
        'compliant',
        'certified',
        'encrypted',
        'guarantee',
        'anonymous',
        'never stored',
        'deleted immediately',
        '100%',
      ]) {
        assert.ok(!line.toLowerCase().includes(promise), `"${line}" promises "${promise}"`);
      }
    }

    // Including the promise this repo cannot make yet: attempt recordings still
    // linger in the app cache, listed under Not true yet.
    assert.ok(!/\brecord/i.test(MEET_MIC), 'the microphone line makes a claim about recordings');
    assert.ok(
      squash(stripComments(read('tabs/ProfileTab.tsx'))).includes('A reviewed privacy policy and terms are still required before release'),
      'the Profile footer stopped naming the legal-review release gate',
    );
  });

  test('nothing the first run says carries an em dash or a scolding', () => {
    for (const line of FIRST_RUN_COPY) {
      assert.ok(!/[—–]/.test(line), `"${line}" carries an em dash`);
      assert.ok(!/\b(wrong|bad|failed|must)\b/i.test(line), `"${line}" scolds`);
      assert.ok(line.trim().length > 0, 'a first-run line is empty');
    }

    // The page a learner is left on has one thing to do next.
    assert.equal(MEET_PILL, 'Choose your first scene');
    assert.equal(MEET_TITLE, `Meet ${TUTOR_NAME}`, 'the page stopped being an introduction to him');
    assert.match(MEET_MIC, /microphone/, 'the microphone line stopped mentioning the microphone');
    assert.match(MEET_TYPING, /Type instead/, 'the typing line no longer names the control it points at');
    assert.match(MEET_MORE, /Profile/, 'the pointer to the rest of it lost its destination');
    assert.ok(PERSONA_TITLE.includes(TUTOR_NAME), 'the persona page stopped naming him');
    assert.match(PERSONA_BODY, /\bAI tutor\b/, 'the persona page went back to a biography');
  });

  test('every first-run screen reads its AI disclosure from one module', () => {
    // The wiring, checked by identifier rather than by filename so it does not
    // depend on what a screen ends up being called. Red until the welcome, the
    // Meet Luc page and the persona page consume these constants, which is the
    // whole of F107 and the reason this module exists.
    const names = [
      'WELCOME_SUBLINE',
      'MEET_TITLE',
      'MEET_AI',
      'MEET_PRIVACY',
      'MEET_MIC',
      'MEET_TYPING',
      'MEET_MORE',
      'MEET_PILL',
      'PERSONA_TITLE',
      'PERSONA_BODY',
    ];
    for (const name of names) {
      assert.ok(
        FIRST_RUN_SOURCE.some(({ source }) => source.includes(name)),
        `no first-run screen puts ${name} on glass`,
      );
    }

    for (const surface of FIRST_RUN_SURFACES) {
      assert.ok(existsSync(at(surface.where)), `${surface.where} owns the ${surface.key} surface and does not exist`);
    }

    // Nobody re-inlines the life story next to nothing that says he is written.
    for (const { file, source } of FIRST_RUN_SOURCE) {
      if (/Lyon|ran a bar|behind a bar|twenty years/i.test(source)) {
        assert.ok(
          /\bAI\b/.test(source) || source.includes('disclosure.ts'),
          `${file} tells his life story as a biography again`,
        );
      }
    }
  });
});
