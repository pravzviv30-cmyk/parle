import { evidence } from '../../test/evidence.ts';
/**
 * The disclosure, held to what it promises.
 *
 * Two halves, in the `answers.test.ts` idiom. The first reads the copy, because
 * the words are values and a value is the one thing this workspace can assert
 * about without a renderer. The second reads the first-run screens as source,
 * because "the app says AI before a learner talks to it" is a claim about
 * glass, and a module nobody imports says nothing to anybody.
 *
 * Every line that names the tutor is a function of a persona, so the first half
 * applies `DEFAULT_TUTOR_PERSONA` in as many words: that is the copy a
 * first-ever run reads, and it is the reading these rules were written about.
 * The eight-persona sweep at the bottom of the file is what holds the other
 * seven to the same rules.
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
  SAVE_PRIVACY,
  MEET_TITLE,
  MEET_TYPING,
  PERSONA_BODY,
  PERSONA_TITLE,
  VENDOR_PHRASE,
  WELCOME_SUBLINE,
  firstRunCopy,
  pronouns,
} from './disclosure.ts';
import { DEFAULT_TUTOR_PERSONA, TUTOR_NAME } from '../tutor/tutorName.ts';
import { guiltIn } from '../copy/guilt.ts';
import { COMPANY, LEGAL_REVIEW_PENDING, privacyNote } from '../legal/company.ts';
import { POLICY_SECTIONS } from '../legal/policy.ts';
import { TUTOR_VOICES, tutorVoice, type TutorVoiceKey } from '@luvani/core';
import { PRE_ACCOUNT_PAGES } from './preAccountDraft.ts';

/** The eight personas a learner can be reading these pages as. */
const EVERY_PERSONA = (Object.keys(TUTOR_VOICES) as TutorVoiceKey[]).map((key) => tutorVoice(key).persona);

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
      ['welcome', 'meet', 'voice', 'persona'],
      'the surfaces a learner meets before a conversation changed shape',
    );

    const [welcome] = FIRST_RUN_SURFACES;
    assert.ok(welcome, 'there is no front door');
    assert.equal(
      welcome.lines[0],
      WELCOME_SUBLINE(DEFAULT_TUTOR_PERSONA),
      'the welcome subline is what the front door says',
    );

    const opening = WELCOME_SUBLINE(DEFAULT_TUTOR_PERSONA).split(/(?<=[.!?])\s+/)[0] ?? '';
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
    assert.match(
      MEET_AI(DEFAULT_TUTOR_PERSONA),
      /\b(made up|character we wrote)\b/i,
      'the persona is offered as fact again',
    );
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
        assert.ok(!line.toLowerCase().replace('no live human tutor', '').includes(claim), `"${line}" implies a person is there: "${claim}"`);
      }
    }

    // Not implying is half of it. Saying so is the other half.
    assert.ok(
      FIRST_RUN_COPY.some((line) => /no live human tutor in the room/i.test(line)),
      'the first run does not distinguish an AI conversation from a live human tutor',
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
    //
    // The footer's words are `privacyNote` in legal/company.ts now. Reading the
    // module rather than the tab is the same check made stronger: the sentence
    // is a value here, so this holds what a learner reads rather than what a
    // JSX block happens to look like, and it keeps holding when the note moves
    // from Profile to Settings.
    const note = privacyNote();
    assert.ok(note.includes(VENDOR_PHRASE), 'the privacy note no longer uses the words this module copied');
    assert.ok(
      MEET_PRIVACY(DEFAULT_TUTOR_PERSONA).includes(VENDOR_PHRASE),
      'the first run invented its own words for the vendors',
    );
    assert.match(note, /Your account stores your email, name, age confirmation and learning/);
    assert.match(note, /processed by speech and language services for tutor replies and practice/);
    assert.match(note, /control memory, saved conversation text and optional usage data/);
    assert.match(note, /export your data or delete your account/);
    assert.ok(privacyNote(COMPANY, true).includes(LEGAL_REVIEW_PENDING), 'a development or staging footer hides the unchecked legal review');
    assert.ok(!privacyNote(COMPANY, false).includes(LEGAL_REVIEW_PENDING), 'a production footer shows an internal review note');
    assert.doesNotMatch(note, /Nothing is shared with anyone else/, 'the footer denies a sharing that happens every turn');
    assert.doesNotMatch(note, /anyone else/i, 'the footer bounds its recipients by who is not one of them again');
    assert.doesNotMatch(
      note,
      /beyond the \w+ (services|companies|vendors)/i,
      'the footer closes its recipients on a count, which the next vendor falsifies',
    );

    // The doc points at the module, so neither can drift alone.
    const policy = readFileSync(fileURLToPath(new URL('../../../../docs/PRIVACY_AND_SAFETY.md', import.meta.url)), 'utf8');
    assert.ok(
      policy.includes('onboarding/disclosure.ts'),
      'PRIVACY_AND_SAFETY.md does not name the module that says this to learners',
    );
  });


  test('the first run bounds sharing the same way the footer and the notice do', () => {
    // F500, and the last surface carrying the construction F481, F484, F488 and
    // F497 each corrected somewhere else. This line still ended "and nothing is
    // shared with anyone else" on the one page every learner reads, after both
    // the footer and the notice had stopped saying it.
    //
    // It was narrower here than in either of those, because the subject is what
    // a learner says during a session, and neither the company that takes the
    // payment nor the counter store is ever sent that. It was still not true:
    // the short summary a session leaves behind is derived from what was said,
    // and it is kept in a database another company runs for us.
    const line = MEET_PRIVACY(DEFAULT_TUTOR_PERSONA);

    // What the page still says, because a bound is not licence to say less than
    // the screen said before it.
    assert.match(line, /is an AI tutor, with no live human tutor in the room/, 'the first run does not explain the kind of tutor');
    assert.ok(line.includes(VENDOR_PHRASE), 'the first run invented its own words for the vendors');
    assert.ok(
      line.includes('prepare replies and practice'),
      'the first run stopped saying why what a learner says goes anywhere at all',
    );

    // The shape that was wrong, in every spelling the other four fixes banned.
    assert.doesNotMatch(line, /nothing is shared with anyone else/i, 'the first run denies a sharing that happens every turn');
    assert.doesNotMatch(line, /anyone else|no one else|nobody else/i, 'the first run bounds its recipients by who is not one of them again');
    assert.doesNotMatch(
      line,
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
      'the first run counts the companies, which is the construction F488 removed from the notice',
    );
    assert.doesNotMatch(line, /beyond the \w+ (services|companies|vendors)/i, 'the first run closes its recipients on a count');

    assert.match(line, /Spoken or typed words are processed/);
    assert.match(line, /Settings explains the providers, saved learning and deletion controls/);
    assert.doesNotMatch(line, /for any purpose other than|No person hears you/, 'the concise disclosure overpromises vendor behavior');
    const seen = POLICY_SECTIONS.find(section => section.heading === 'Who else sees it');
    assert.ok(seen?.body.some(paragraph => /Provider retention.*verified before release/.test(paragraph)), 'the full notice hides unverified provider retention');

    assert.match(MEET_MIC, /microphone/, 'the microphone line stopped mentioning the microphone');
    assert.match(MEET_TYPING, /Type instead/, 'the typing line no longer names the control it points at');
    assert.match(MEET_MORE, /Settings/, 'the pointer to the rest of it lost its destination');
    assert.ok(PERSONA_TITLE(DEFAULT_TUTOR_PERSONA).includes(TUTOR_NAME), 'the persona page stopped naming him');
    assert.match(PERSONA_BODY(DEFAULT_TUTOR_PERSONA), /\bAI tutor\b/, 'the persona page went back to a biography');
  });

  test('typing is offered as a choice, not a fallback — F360', () => {
    // The typing line used to read "If you cannot speak out loud, tap Type
    // instead", which frames typing as a disability-only fallback and quietly
    // narrows who the app is for. Typing is a choice available in any scene, so
    // the copy offers it as one. The control it names stays literal — the
    // :262 pin above still requires "Type instead".
    assert.match(MEET_TYPING, /Type instead/, 'the typing line no longer names the control it points at');
    assert.doesNotMatch(MEET_TYPING, /cannot|can't|unable/i, 'the typing line frames typing as a fallback again');
    assert.ok(!/[—–]/.test(MEET_TYPING), 'the typing line carries an em dash');
    assert.ok(!/\b(wrong|bad|failed|must)\b/i.test(MEET_TYPING), 'the typing line scolds');
  });

  test("bounded starter disclosure names AI, transcription, typed checks and local retention before Start", () => {
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    const disclosure = evidence('apps/mobile/src/onboarding/disclosure.ts');
    const body = screen.slice(screen.indexOf('const consentBody'), screen.indexOf('return (', screen.indexOf('const consentBody')));
    assert.match(body, /STARTER_AI[\s\S]*STARTER_LOCAL[\s\S]*label="Privacy details"/);
    assert.doesNotMatch(body, /STARTER_PROCESSING|LiveKit|Deepgram|ElevenLabs/);
    const privacy = screen.slice(screen.indexOf("{surface === 'privacy' &&"), screen.indexOf("{surface === 'policy' &&"));
    assert.match(privacy, /LiveKit, Deepgram for transcription, and ElevenLabs/);
    assert.match(privacy, /Your speech and typed replies are checked against a scripted café scene\. No AI model writes the replies\./);
    assert.match(privacy, /Speaking and typing use the same live scene\./);
    assert.match(privacy, /Your words are not kept\. A record of the scripted turns you reach is held for up to 30 days/);
    assert.doesNotMatch(privacy, /configured AI provider|Confirmed replies stay on this device|session summary|[—–]/);
    assert.match(body, /body="It plays a short café scene with you, and it can mishear you\."/);
    assert.match(privacy, /up to 30 days/);
    assert.match(privacy, /label="Read privacy policy"/);
    assert.match(disclosure, /up to 30 days/);
    assert.doesNotMatch(disclosure.slice(disclosure.indexOf('export const STARTER_AI')), /No person hears|nothing is shared|certified/i);
  });

  test("modern starter and legacy repair use the shared disclosure module", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /from '\.\/disclosure\.ts'/); for (const path of ['apps/mobile/src/onboarding/OnboardingFlow.tsx','apps/mobile/src/tutor/TutorIntro.tsx']) { const source = evidence(path); assert.match(source, /disclosure\.ts/); assert.doesNotMatch(source, /No person hears you/); } });
});

describe("the first-run copy claims nothing a voice can contradict — F281", () => {
  /**
   * The sibling of the prompt guard in brain. The persona page and the Meet page
   * both told his life story and both named the town, so a learner could hear a
   * Québécois voice and read that he grew up in Lyon. The bar and the twenty
   * years stay; they are true of any voice that could read them.
   */
  test('the first-run copy tells his life story without naming a city', () => {
    const CITIES = /\b(Lyon|Lyonnais|Sa[oô]ne|Marseille|Bordeaux|Toulouse|Montr[eé]al|Qu[eé]bec)\b/i;
    for (const line of FIRST_RUN_COPY) {
      const found = line.match(CITIES);
      assert.equal(found, null, `"${line}" places him in ${found?.[0]}`);
    }
  });
});

describe('the first-run disclosure follows the chosen persona — F294', () => {
  /**
   * The sibling of F281 and F292, made about gender rather than about place.
   *
   * `PERSONA_TITLE` and `PERSONA_BODY` were constants that said "Luc" and "him"
   * and "He". Two of the eight catalogue voices are women, so a learner who
   * chose Céline was read a page introducing her as a man — the same defect as
   * a Québécois voice being handed a biography set in Lyon. The rule is the one
   * `voices.ts` states: the persona follows the voice, and a screen that
   * hardcodes either half creates the mismatch the code was supposed to prevent.
   *
   * Both are checked for ALL eight rather than for one woman, because a ternary
   * that happens to work for Céline is not a rule.
   */
  test('the persona page describes the chosen persona in the right words, and still says AI tutor', () => {
    assert.equal(EVERY_PERSONA.length, 6, 'the catalogue stopped having six people to introduce');

    for (const persona of EVERY_PERSONA) {
      const p = pronouns(persona);
      const wrong = p.subject === 'he' ? { subject: 'she', object: 'her' } : { subject: 'he', object: 'him' };

      const title = PERSONA_TITLE(persona);
      assert.ok(title.includes(persona.name), `the persona page does not name ${persona.name}`);

      const body = PERSONA_BODY(persona);
      assert.ok(body.includes(persona.name), `the body introduces somebody other than ${persona.name}`);

      // The disclosure itself. It is the reason this page exists, so the gender
      // words move around it and it does not move at all.
      assert.match(body, /\bAI tutor\b/, `${persona.name}'s page went back to a biography`);
      assert.ok(
        body.includes(`${persona.name} is an AI tutor`),
        `the sentence that says what ${persona.name} is no longer says it next to the name`,
      );

      // Agreement, both ways round: the right pronouns are present and the
      // other set is absent. Only asserting the first would pass a body that
      // said "her" once and "him" twice.
      assert.ok(body.includes(`${p.Subject} responds`), `the body does not use "${p.Subject}" for ${persona.name}`);
      assert.match(body, /teaches through conversation/, 'the introduction should promise teaching, not deny it');
      assert.doesNotMatch(body, /not a teacher|twenty years|ran a bar/i, 'the introduction must not invent a human life');
      for (const line of [title, body]) {
        assert.doesNotMatch(
          line,
          new RegExp(`\\b(${wrong.subject}|${wrong.object})\\b`, 'i'),
          `"${line}" calls ${persona.name} ${wrong.subject}`,
        );
      }

      // Nobody put a name back into the constant next to the function.
      if (persona.name !== TUTOR_NAME) {
        assert.ok(!body.includes(TUTOR_NAME), `${persona.name}'s page still says ${TUTOR_NAME}`);
      }
    }

    // And every rule the rest of this file holds the default copy to holds for
    // the other seven. F281's guard in particular: the fix for the home town
    // was never allowed to be re-derived per persona.
    const CITIES = /\b(Lyon|Lyonnais|Sa[oô]ne|Marseille|Bordeaux|Toulouse|Montr[eé]al|Qu[eé]bec)\b/i;
    for (const persona of EVERY_PERSONA) {
      for (const line of firstRunCopy(persona)) {
        assert.equal(line.match(CITIES), null, `"${line}" places ${persona.name} somewhere`);
        assert.ok(!/[—–]/.test(line), `"${line}" carries an em dash`);
        assert.ok(!claimsAHumanListener(line), `"${line}" puts a person on the other end`);
        if (/ran a bar|behind a bar|twenty years/i.test(line)) {
          assert.match(line, /\bAI\b/, `"${line}" tells the life story without saying AI`);
        }
      }
    }
  });

  test("the intro's pronoun follows the chosen persona", () => {
    // The one sentence outside this module that had a pronoun written into it:
    // "In English tells you what he just said", on TutorIntro's hint card. A
    // source walk rather than a value check, because the sentence is composed
    // inside the screen and apps/mobile has no renderer.
    const intro = stripComments(read('tutor/TutorIntro.tsx'));

    assert.ok(
      intro.includes('PERSONA_TITLE(persona)') && intro.includes('PERSONA_BODY(persona)'),
      "the intro renders the persona page for somebody other than the choice this learner made",
    );
    assert.ok(intro.includes('pronouns(persona)'), 'the intro no longer derives the pronouns from the chosen persona');
    assert.match(
      intro,
      /In English tells you what \$\{p\.subject\} just said/,
      'the hint card writes a pronoun in by hand again, so it calls Céline he',
    );
    assert.doesNotMatch(
      intro,
      /tells you what he just said|tells you what she just said/,
      'a literal pronoun is back on the hint card',
    );

    // The two forms this table has to answer, checked directly rather than
    // through the copy that happens to use them today.
    const he = EVERY_PERSONA.find((persona) => persona.pronoun === 'he');
    const she = EVERY_PERSONA.find((persona) => persona.pronoun === 'she');
    assert.ok(he && she, 'the catalogue no longer has a voice of each gender to check agreement with');
    assert.deepEqual(pronouns(he), { subject: 'he', Subject: 'He', object: 'him' });
    assert.deepEqual(pronouns(she), { subject: 'she', Subject: 'She', object: 'her' });

    // Nothing else in the walkthrough may name a person the catalogue did not
    // choose. `TUTOR_NAME` is the default persona's name, and a page that spells
    // it is a page that greets Céline as Luc.
    assert.ok(!intro.includes('TUTOR_NAME'), 'the intro reads the default name instead of the chosen persona');
    assert.ok(intro.includes('tutorPersonaOf('), 'the intro stopped asking who this learner chose');
  });
});

/**
 * Consent order, Phase 5 (spine contract section 4; Apple 5.1.2(i)).
 *
 * Nothing reaches an AI service or the network before the save page is passed.
 * Two halves: the page order puts the AI disclosure first and the consent
 * switch last, and a walk over every module the pre-account flow can load, by
 * value import from the screen outward, finds no live, sync, auth or analytics
 * sender and no network primitive. All six pages live in the one screen file,
 * so the walk covers pages one to five and the save page as well.
 */
describe('nothing reaches an AI service or the network before the save page is passed', () => {
  test("setup remains local and the processing disclosure precedes deliberate Terms acceptance and Start", () => {
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    const body = screen.slice(screen.indexOf('const consentBody'), screen.indexOf('return (', screen.indexOf('const consentBody')));
    assert.match(body, /STARTER_AI[\s\S]*STARTER_LOCAL[\s\S]*label="Privacy details"/);
    assert.match(body, /onPress=\{\(\) => setSurface\('privacy'\)\}/);
    assert.doesNotMatch(body, /STARTER_PROCESSING|LiveKit|Deepgram|ElevenLabs/);
    assert.match(body, /Optional, off by default/);
    assert.match(body, /Share usage analytics[\s\S]*selected=\{draft\.analyticsConsent\}/);
    assert.match(body, /Remember my learning[\s\S]*selected=\{draft\.rememberLearning === true\}[\s\S]*onPress=\{toggleRemember\}/);
    assert.doesNotMatch(screen, /\bsetRemember\b/, 'the visible opt-in must use the committed draft');
    assert.doesNotMatch(screen, /title="I am 13 or older"|label="I am younger than that"/);
    const start = screen.slice(screen.indexOf('const start = async'), screen.indexOf('const saveAccount'));
    assert.match(start, /operation\.current \|\| refused/);
    assert.match(start, /if \(previewOnly\) return/);
    assert.match(start, /patch\(\{ eligibilityConfirmed: true \}\)/);
    assert.ok(start.indexOf('patch({ eligibilityConfirmed: true })') < start.indexOf('await startGuestPractice(acceptedDraft, guest)'));
    assert.match(screen, /TermsAcceptance context="practice"/);
    assert.match(screen, /label=\{needsAccount \? 'Create account to start' : 'Start live practice'\}[^>]*disabled=\{busy \|\| previewOnly\} onPress=\{\(\) => void \(needsAccount \? continueWithAccount\(\) : start\(\)\)\}/);
    assert.match(screen, /isAccountHandoffRefusal\(error\.message\)/, 'only a specific unavailable guest capability opens the account route');
    assert.match(screen, /Practice is unavailable in this screen preview/);
    // F926: the preselected tutor records the choice on the way to consent.\n    assert.match(screen, /disabled=\{busy\} onPress=\{\(\) => \{ patch\(\{ tutorChosen: true \}\); open\('start'\); \}\}/);
    assert.doesNotMatch(body, /startGuestPractice|requestRecordingPermissionsAsync|new Room\(/);
  });

  test("guest service requests require deliberate eligible Start and remain bounded outside authenticated rooms", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const service = evidence('apps/mobile/src/onboarding/guestPractice.ts'); const server = evidence('services/token-server/src/server.ts'); assert.match(service, /if \(!plan\.eligibilityConfirmed\) throw/); assert.match(screen, /await startGuestPractice\(acceptedDraft, guest\)/); assert.match(server, /body\.eligible !== true/); assert.match(server, /guest\.installation !== installHash/); assert.match(server, /guest\.expiresAt <= Date\.now\(\) \|\| guest\.owner/); assert.doesNotMatch(screen, /requestRecordingPermissionsAsync|joinRoom|new Room\(/); const recording = evidence('apps/mobile/src/onboarding/FirstLivePractice.tsx'); assert.match(recording, /mode: 'convo', guestToken: guest\.token!/); assert.match(recording, /await live\.openMic\(\)/); });
});

test('the start page says what the café scene keeps: turn ids, not words', async () => {
  const { STARTER_LOCAL } = await import('./disclosure.ts');
  assert.equal(STARTER_LOCAL, 'Your words are not kept. A record of the scripted turns you reach is held for up to 30 days and can be saved to your account.');
  assert.doesNotMatch(STARTER_LOCAL, /[—–]|session summary|stay on this device/);
});
