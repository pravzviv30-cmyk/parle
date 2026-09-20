/**
 * The tutor is called one thing per learner, and that thing has one home.
 *
 * Same rule, and the same reason, as the token server address in F8: the app
 * said "your tutor" in twenty-odd places, and replacing that with the literal
 * "Luc" in twenty-odd places would trade one problem for a worse one. Twenty
 * copies agree about nothing today and would eventually disagree about
 * something, and a half-renamed tutor is a learner being introduced to two
 * people.
 *
 * ## What changed, and why a second walk was needed
 *
 * The rename is now made per learner. Eight voices, two of them women, and the
 * persona travels with the sound, so the name is a fact about a profile rather
 * than about the product. `tutorPersonaOf` is the one reader, and the twelve
 * files that used to import the constant now take a name from it.
 *
 * The first walk below catches a hardcoded "Luc". The second catches the
 * subtler thirteenth: a file that imports `TUTOR_NAME` and interpolates it,
 * which spells nothing and reads perfectly and still tells a learner who chose
 * Celine that Luc is thinking. Both are needed. A rename that half-happens is
 * exactly what this file has always existed to prevent, and the per-learner
 * version of half-happening is invisible to the first walk.
 *
 * ## The places the constant is still read, on purpose
 *
 * One of them composes words with no learner in hand.
 *
 * `reminders/reminder.ts` builds a lock-screen line days before it fires, and
 * `reminderContent` takes no arguments AT ALL by design, held by its own test
 * and by schedule.test.ts: a builder that took one argument could take the
 * learner's day, and then the lock screen would report on whether they had
 * practised. That guarantee is worth more than the name, so the default name
 * is what the notification carries. It is filed rather than fixed here.
 *
 * `onboarding/` used to be on it, and is not any more. F294 and F297 were said
 * to empty this list and did not: the flow still read the constant while it had
 * `existing` in its hands, so a migrated learner who had already chosen Céline
 * was told to meet Luc and then introduced to Céline. F300 is that gap, and
 * closing it is what actually empties the list down to one.
 *
 * What the fix is NOT: onboarding no longer naming the default. A first-ever
 * run starts at the default on purpose, and `PreAccountOnboarding.tsx` changes
 * that only when the learner selects another draft voice. The narrow thing that
 * changed is that the recovery pages ask `tutorPersonaOf(existing)` first, and
 * only get the default when there is nobody on the record to get instead.
 *
 * Nothing may be added to it. A file that names the tutor while holding a
 * profile has no excuse, and the walk says so by path.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TUTOR_VOICES, tutorVoice } from '@luvani/core';
import { DEFAULT_TUTOR_PERSONA, TUTOR_NAME, tutorNameOf, tutorPersonaOf } from './tutorName.ts';
import { ONE_MOMENT, waitingView } from './waitingView.ts';
import { choosingView, anythingGoes } from './choosingView.ts';
import { rungLabel } from './rungLabel.ts';
import { statusLine, momentAnswer } from '../practice/statusLine.ts';
import {
  MEET_AI,
  MEET_PRIVACY,
  MEET_TITLE,
  PERSONA_TITLE,
  VOICE_SKIP_HINT,
  WELCOME_SUBLINE,
  pronouns,
} from '../onboarding/disclosure.ts';
import type { TurnLine } from '../live/turns.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const HOME = 'tutorName.ts';

/**
 * Files that may still read the constant, by path, each with a reason above.
 * This list may only ever shrink.
 */
const NO_LEARNER_IN_HAND: readonly string[] = ['reminders/reminder.ts'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** Comments are prose about the code, not copy shown to anyone. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('the tutor is called one thing, in one place', () => {
  test('the name is spelled out exactly once in the whole app', () => {
    const spelled: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (file.endsWith(HOME) || file.endsWith('tutorName.test.ts')) continue;
      const code = stripComments(readFileSync(file, 'utf8'));
      if (new RegExp(`\\b${TUTOR_NAME}\\b`).test(code)) spelled.push(file);
    }
    assert.deepEqual(
      spelled,
      [],
      `the name is hardcoded outside ${HOME}, so a rename would half-happen:\n${spelled.join('\n')}`,
    );
  });

  test('it is a name a beginner can say, and not empty', () => {
    assert.ok(TUTOR_NAME.trim().length > 0, 'the tutor has no name');
    assert.match(TUTOR_NAME, /^[A-ZÀ-Ý][a-zà-ÿ]+$/u, 'a name a learner reads aloud, not a handle');
  });

  test('every learner-facing tutor name reads from the chosen persona, not the constant', () => {
    // The constant is derived, not typed. A literal here would be a second
    // opinion about who DEFAULT_TUTOR_VOICE is, and nothing would ever say the
    // two had drifted.
    assert.equal(TUTOR_NAME, DEFAULT_TUTOR_PERSONA.name);
    assert.deepEqual(DEFAULT_TUTOR_PERSONA, tutorVoice('alexandre').persona, 'the default persona is not the default voice');

    // The reader. Sceptical about a stored key for the same reason
    // `strictnessOf` is, and never answers with nobody.
    assert.deepEqual(tutorPersonaOf(null), DEFAULT_TUTOR_PERSONA);
    assert.deepEqual(tutorPersonaOf(undefined), DEFAULT_TUTOR_PERSONA);
    assert.deepEqual(tutorPersonaOf({ tutorVoice: null } as never), DEFAULT_TUTOR_PERSONA);
    assert.deepEqual(tutorPersonaOf({ tutorVoice: 'not-a-voice' } as never), DEFAULT_TUTOR_PERSONA);

    // The whole reason this is more than a rename: two of the eight are women,
    // and the pronoun rides in the same row as the sound so they cannot drift.
    for (const entry of Object.values(TUTOR_VOICES)) {
      const persona = tutorPersonaOf({ tutorVoice: entry.key } as never);
      assert.deepEqual(persona, entry.persona, `${entry.key} is introduced as somebody else`);
      assert.equal(tutorNameOf({ tutorVoice: entry.key } as never), entry.persona.name);
      assert.equal(
        persona.pronoun,
        entry.gender === 'female' ? 'she' : 'he',
        `${entry.key} would introduce herself as a man, which is the defect this whole change exists for`,
      );
    }

    // And the thirteenth literal, which spells nothing and is invisible to the
    // walk above: a file that imports the constant and interpolates it.
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (file.endsWith(HOME) || /\.test\.tsx?$/.test(file)) continue;
      const code = stripComments(readFileSync(file, 'utf8'));
      if (/\bTUTOR_NAME\b/.test(code)) offenders.push(relative(SRC, file));
    }
    const unexpected = offenders.filter((file) => !NO_LEARNER_IN_HAND.includes(file));
    assert.deepEqual(
      unexpected,
      [],
      'these files name the tutor from the constant while a profile is within reach, so a learner who chose ' +
        `a different voice is told the wrong person is talking:\n${unexpected.join('\n')}`,
    );
    // A stale allowance is a hole. Anything on the list that no longer reads
    // the constant has to leave it, or the list stops meaning what it says.
    for (const allowed of NO_LEARNER_IN_HAND) {
      assert.ok(
        offenders.includes(allowed),
        `${allowed} no longer reads TUTOR_NAME, so its exemption is protecting nothing and must be deleted`,
      );
    }
  });

  test('the rung label and the waiting line name the chosen persona', () => {
    const marie = tutorVoice('marie').persona;
    const fallback = tutorVoice('alexandre').persona;

    // Rung one is the one rung that names anybody, and it was a frozen table.
    assert.equal(rungLabel(1, marie.name), `Repeat after ${marie.name}`);
    assert.equal(rungLabel(1, fallback.name), `Repeat after ${fallback.name}`);
    assert.notEqual(rungLabel(1, marie.name), rungLabel(1, fallback.name), 'the rung label is still a constant');
    for (const rung of [2, 3, 4] as const) {
      assert.equal(
        rungLabel(rung, marie.name),
        rungLabel(rung, fallback.name),
        'a rung above the first named somebody, and a rung describes how much help is left, not who is talking',
      );
    }

    // The waiting line, which is the first thing a learner reads when the room
    // is open and nobody has spoken yet.
    const safety = { kind: 'none' } as const;
    assert.equal(
      waitingView({ waitingForTutor: true, safety, tutorName: marie.name }).headline,
      `Waiting for ${marie.name}…`,
    );
    assert.equal(
      waitingView({ waitingForTutor: false, safety, tutorName: marie.name }).headline,
      ONE_MOMENT,
      'the vague line stopped being vague, and now names a fault that has not happened',
    );

    // The circle says who is thinking, speaking and ready, and the helper says
    // who is listening. Four more sentences that used to be about one man.
    const base = { textMode: false, typingOpen: false, micOpen: true, thinking: false, tutorSpeaking: false, turns: [] as const };
    const said = [
      { id: 't1', who: 'learner', fr: 'salut', frWritten: null, en: null },
    ] as const satisfies readonly TurnLine[];
    assert.equal(
      choosingView({ ...base, thinking: true, tutorName: marie.name }).orbLabel,
      `${marie.name} is thinking`,
    );
    assert.equal(
      choosingView({ ...base, tutorSpeaking: true, tutorName: marie.name }).orbLabel,
      `${marie.name} is speaking`,
    );
    assert.equal(
      choosingView({ ...base, micOpen: false, turns: said, tutorName: marie.name }).orbLabel,
      'Tap the circle when you are ready to talk',
      'the untapped circle reports a state instead of asking to be pressed',
    );
    assert.equal(choosingView({ ...base, turns: said, tutorName: marie.name }).helper, anythingGoes(marie.name));
    assert.match(anythingGoes(marie.name), new RegExp(`\\b${marie.name}\\b`));

    // The two quiet lines outside a live scene.
    assert.equal(momentAnswer(marie.name), `${marie.name} will wait.`);
    assert.equal(
      statusLine({ state: 'locked', kind: 'topic' } as never, marie.name),
      `${marie.name} is still writing this one`,
    );
    assert.equal(
      statusLine({ state: 'locked', kind: 'mine' } as never, marie.name),
      'Your conversations write this one',
      'a node the learner writes started naming the tutor',
    );
  });
});


describe('onboarding introduces the voice already on the record — F300', () => {
  /**
   * The gap F294 and F297 left behind, and the reason this file's allowance
   * list is one line long now.
   *
   * Onboarding is not only a first-ever run. A learner migrated from the
   * pre-account era walks it again, and so does anyone sent back through by a
   * question that became required after they signed up. That learner arrives
   * with `existing` set, and `existing` can already carry a voice. Reading the
   * default anyway meant four pages calling them Luc and then `TutorIntro`
   * introducing Céline, which is the mismatch F281 and F294 both exist to stop:
   * the screen says one person, the voice says another, and the learner
   * believes the voice.
   *
   * What is NOT being tested is that onboarding stopped naming the default. It
   * has not, and must not. A first-ever run has nobody on the record and the
   * copy has to name somebody, so it names the person who answers if the
   * learner never chooses. The test below this one holds that path word for
   * word, so a fix that quietly took the default away would be caught too.
   */
  const FLOW = stripComments(readFileSync(join(SRC, 'onboarding/OnboardingFlow.tsx'), 'utf8'));
  const WELCOME = stripComments(readFileSync(join(SRC, 'onboarding/PreAccountOnboarding.tsx'), 'utf8'));

  test('a learner who already chose a voice is re-introduced to that voice, not the default', () => {
    const chosen = tutorPersonaOf({ tutorVoice: 'marie' } as never);
    assert.notEqual(chosen.name, TUTOR_NAME, 'the record under test no longer holds a voice other than the default');
    assert.deepEqual(chosen, tutorVoice('marie').persona);

    // The four sentences the flow reads to somebody it has a record for. Each
    // one used to name the default and only the default.
    const readTo = (persona: typeof chosen) => [
      MEET_TITLE(persona),
      MEET_AI(persona),
      MEET_PRIVACY(persona),
      VOICE_SKIP_HINT(persona),
    ];

    for (const line of readTo(chosen)) {
      assert.ok(line.includes(chosen.name), `"${line}" does not name the voice this learner already chose`);
      assert.ok(
        !new RegExp(`\\b${TUTOR_NAME}\\b`).test(line),
        `"${line}" names the default to a learner who had already chosen ${chosen.name}`,
      );
    }

    // And the page after them agrees. This is the whole defect in one line:
    // the meet page said one name and the intro two screens later said another.
    assert.ok(
      PERSONA_TITLE(chosen).includes(chosen.name),
      'the intro and the meet page introduce two different people again',
    );

    // None of the above reaches a learner unless the screen asks the record
    // who they have. A source walk, in the idiom `disclosure.test.ts` uses for
    // TutorIntro's hint card: the sentences are composed inside a `.tsx` and
    // apps/mobile has no renderer, so the wiring is the part that can be read.
    assert.ok(
      FLOW.includes('const persona = tutorPersonaOf(existing)'),
      'the flow names somebody without asking the record who this learner has',
    );
    for (const call of ['{MEET_TITLE(persona)}', '{MEET_AI(persona)}', '{MEET_PRIVACY(persona)}', '{VOICE_SKIP_HINT(persona)}']) {
      assert.ok(FLOW.includes(call), `the flow renders ${call.slice(1, -2)} for somebody other than this learner`);
    }
    assert.match(
      FLOW,
      /\$\{persona\.name\} greets you by name/,
      'the name page tells a learner who already chose Céline that Luc greets them by name',
    );

    // The persona is read off the record, not off the picker on the last page.
    // `voice` moves under the learner's thumb; a skip writes nothing, so who
    // they walked in with is who the skip hint has to be honest about.
    assert.ok(
      !FLOW.includes('tutorPersonaOf(voice)') && !FLOW.includes('tutorPersonaOf({ tutorVoice: voice })'),
      'the flow names the voice being picked rather than the one on the record',
    );

    // Every persona, not just the one woman, and both halves of the agreement:
    // the right words present and the wrong ones absent. A ternary that happens
    // to work for Céline is not a rule.
    for (const entry of Object.values(TUTOR_VOICES)) {
      const persona = entry.persona;
      const p = pronouns(persona);
      const wrong = p.subject === 'he' ? /\b(she|her)\b/i : /\b(he|him)\b/i;
      const noun = p.subject === 'she' ? 'woman' : 'man';

      for (const line of [...readTo(persona), WELCOME_SUBLINE(persona)]) {
        assert.ok(line.includes(persona.name), `"${line}" is read to ${persona.name} and names somebody else`);
        assert.doesNotMatch(line, wrong, `"${line}" calls ${persona.name} the wrong pronoun`);
      }

      // The one noun in the copy that has a gender. The life story is the
      // sentence most likely to be left behind by a pronoun-only fix.
      assert.match(MEET_AI(persona), /character we wrote/, 'the persona must be disclosed as authored');
      assert.doesNotMatch(MEET_AI(persona), /ran a bar|twenty years|not a teacher/, 'the tutor must not inherit a fabricated life story');
      // The rule that outranks all of this and is never allowed to move: the
      // sentence carrying the invented life also says what she is.
      assert.match(MEET_AI(persona), /\bAI tutor\b/, `${persona.name}'s meet page went back to a biography`);
    }
  });

  test('a first run has nobody on the record, so it still names the default on purpose', () => {
    // Byte for byte what onboarding has always said to somebody arriving with
    // no profile. `tutorPersonaOf` resolves null, undefined and a key the
    // catalogue has forgotten to the same person, so all three read this way.
    for (const record of [null, undefined, { tutorVoice: null }, { tutorVoice: 'not-a-voice' }]) {
      const persona = tutorPersonaOf(record as never);
      assert.equal(MEET_TITLE(persona), `Meet ${TUTOR_NAME}`);
      assert.equal(
        MEET_AI(persona),
        `${TUTOR_NAME} is an AI tutor with a character we wrote for him. He helps you practise natural French, explains useful patterns, and builds on the learning you choose to save.`,
      );
      assert.equal(
        MEET_PRIVACY(persona),
        `No person hears you. What you say goes to speech and language services so ${TUTOR_NAME} can answer, ` +
          `and nothing about it goes anywhere for any purpose other than carrying a conversation, answering you ` +
          `and keeping what you have learned.`,
      );
      assert.equal(
        VOICE_SKIP_HINT(persona),
        `You do not have to pick. Skip and you talk to ${TUTOR_NAME}, and you can change it in Profile whenever you like.`,
      );
      assert.equal(
        WELCOME_SUBLINE(persona),
        `${TUTOR_NAME} is an AI tutor. He talks with you in French, steps in when you stall, and never makes you feel silly.`,
      );
    }

    // The front door is the one screen that may not ask, because it is read
    // before an account exists. It says which persona it means out loud rather
    // than letting the copy module decide for it.
    assert.ok(
      WELCOME.includes('WELCOME_SUBLINE(persona)'),
      'the welcome screen stopped saying which persona its subline is about',
    );
  });
});
