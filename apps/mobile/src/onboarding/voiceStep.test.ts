/**
 * The first-run voice step, held to the three things it is not allowed to
 * break.
 *
 * Two halves, in this folder's idiom. The first reads values, because the
 * copy and the rules are values and a value is the one thing this workspace can
 * assert about without a renderer. The second reads `OnboardingFlow.tsx` as
 * source, because "every voice is on the screen and each one can be played"
 * is a claim about glass, and a rule module nobody renders is a rule nobody
 * reads.
 *
 * The source walk is written against identifiers rather than sentences on
 * purpose. A test that matched the copy would have to be edited every time the
 * words improved, and a test somebody edits to make it pass is not a test.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DEFAULT_TUTOR_VOICE, TUTOR_VOICES, tutorVoice, type TutorVoiceKey } from '@luvani/core';
import { VOICE_STEP_COPY, VOICE_STEP_OPTIONS, voiceAfterStep, withChosenVoice } from './voiceStep.ts';
import { VOICE_AI, VOICE_BODY, VOICE_SKIP, VOICE_SKIP_HINT, VOICE_TITLE, FIRST_RUN_SURFACES } from './disclosure.ts';
import { DEFAULT_TUTOR_PERSONA } from '../tutor/tutorName.ts';
import { PAGES, answersFrom } from './answers.ts';
import { TUTOR_VOICE_OPTIONS, tutorVoiceOf } from '../tutor/tutorVoice.ts';
import { createStoredProfile, withTutorVoice, type StoredProfile } from '../profile/store.ts';

const SRC = new URL('../', import.meta.url);
const at = (relative: string) => fileURLToPath(new URL(relative, SRC));
const read = (relative: string) => readFileSync(at(relative), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const FLOW = stripComments(read('onboarding/OnboardingFlow.tsx'));
const CARDS = stripComments(read('onboarding/TutorSelection.tsx'));
const PREVIEW = stripComments(read('tutor/useTutorPreview.ts'));
const CONTROLLER = stripComments(read('tutor/tutorPreview.ts'));

const SHEET = stripComments(read('tabs/ProfileTab.tsx'));
const APP = stripComments(readFileSync(fileURLToPath(new URL('../../App.tsx', import.meta.url)), 'utf8'));

/** Just enough of a learner to write a field onto. */
const fresh = (): StoredProfile =>
  createStoredProfile(answersFrom({ name: 'Camille', ageConfirmed: true, motivation: null, tutorVoice: null, analyticsConsent: null }), 1_700_000_000_000);

/** A catalogue voice that is not the default, so a no-op cannot pass as a write. */
const CHOICE: TutorVoiceKey =
  (Object.keys(TUTOR_VOICES) as TutorVoiceKey[]).find((key) => key !== DEFAULT_TUTOR_VOICE) ?? DEFAULT_TUTOR_VOICE;

describe('first run introduces the voices and lets the learner choose one — F297', () => {
  test('first run introduces every voice, names it, and can play it', () => {
    // The list is the catalogue's, in the catalogue's order, and is the SAME
    // object the Profile sheet renders. Two lists built separately is how a
    // ninth voice ends up offered in one place and missing in the other.
    assert.equal(VOICE_STEP_OPTIONS, TUTOR_VOICE_OPTIONS, 'the first run built a second list of voices');
    assert.equal(VOICE_STEP_OPTIONS.length, 6, 'the catalogue has six voices and the first run must showcase all of them');
    assert.deepEqual(
      VOICE_STEP_OPTIONS.map((option) => option.value),
      Object.keys(TUTOR_VOICES),
      'the step offers a list of its own, so a voice added in core would never reach a first run',
    );

    // Named, and described in the catalogue's own words. Nothing on this page
    // is written here, because a second sentence about a recording is an
    // unverified claim about a voice nobody in this file has heard.
    for (const option of VOICE_STEP_OPTIONS) {
      const entry = tutorVoice(option.value);
      assert.equal(option.label, entry.persona.name, `${option.value} is offered under a name that is not the persona's`);
      assert.equal(option.gloss, entry.sound, `${option.value} carries a description onboarding invented`);
      assert.ok(option.label.trim().length > 0, `${option.value} is offered with no name at all`);
    }

    // The recovery screen shares the production cards and one owned player.
    assert.match(FLOW, /<TutorSelection chosen=\{voice\} preview=\{preview\} onChoose=\{setVoice\}/);
    assert.match(CARDS, /TUTOR_VOICE_OPTIONS\.map\(/);
    assert.match(CARDS, /\{voice\.label\}/);
    assert.match(CARDS, /\{voice\.gloss\}/);
    assert.match(CARDS, /onPress=\{\(\) => onChoose\(voice\.value\)\}/);
    assert.match(CARDS, /preview\.toggle\(voice\.value\)/);
    assert.match(FLOW, /useTutorPreview\(\{ active: loaded && page === 'voice' \}\)/);
    assert.match(PREVIEW, /createAudioPlayer/);
    assert.match(PREVIEW, /player\.replace\(voiceSample\(voice\)\)/);
    assert.match(CONTROLLER, /if \(fresh\) close\(\)/);
    assert.ok(FLOW.indexOf('preview.stop();') < FLOW.indexOf('await onDone('), 'completion leaves a preview playing');

    // Nothing here says one of them is better than the others. None of it has
    // been measured, and a learner who picks by adjective and then dislikes the
    // voice has been mis-sold. Same list `tutorVoice.test.ts` holds the sheet to.
    const comparative = /\bbetter\b|\bbest\b|\bmost\b|\bmore native\b|\bnative\b|\bclearer\b|\bclearest\b|\beasiest\b|\bpurest\b|\bproper\b|\breal french\b/i;
    const vendors = /deepgram|elevenlabs|eleven labs|openai|anthropic|cartesia|fish|livekit|azure|google|playht|resemble/i;
    for (const line of VOICE_STEP_COPY) {
      assert.doesNotMatch(line, comparative, `"${line}" tells a learner one of these voices is better than the others`);
      assert.doesNotMatch(line, vendors, `"${line}" names the machinery`);
      assert.doesNotMatch(line, /[—–]/, `"${line}" carries an em dash`);
      assert.ok(line.trim().length > 0, 'a blank line reached the voice step');
    }

    // "How they work": what the choice DOES, said before the list rather than
    // after the regret. Eight French names with no explanation reads as picking
    // a difficulty, or as picking which French you are going to be taught.
    assert.equal(VOICE_BODY, 'Listen to the voices and choose who you’d like to practise with.');
  });

  test('the voice step can be skipped, and skipping leaves the default chosen', () => {
    // A skip writes NOTHING. The temptation is to store the default key so the
    // field is set, and that is exactly wrong: it records a choice nobody made
    // and the Profile row can no longer tell "picked Luc" from "never looked".
    const before = fresh();
    const skipped = withChosenVoice(before, null);
    assert.equal(skipped, before, 'skipping the step rewrote the profile');
    assert.equal(skipped.tutorVoice, null, 'a skip was recorded as a choice');

    // And the default is a real answer, not an absence. Both ends of the wire
    // resolve null the same way, so the learner talks to somebody with a name.
    assert.equal(tutorVoiceOf(skipped), DEFAULT_TUTOR_VOICE, 'a learner who skipped is left without a voice');
    assert.equal(voiceAfterStep(skipped, null), DEFAULT_TUTOR_VOICE);
    assert.equal(voiceAfterStep(null, null), DEFAULT_TUTOR_VOICE, 'a learner with no profile at all is left without a voice');
    assert.equal(voiceAfterStep(before, CHOICE), CHOICE, 'a pick made on the step is not the voice they leave with');
    assert.ok(
      tutorVoice(DEFAULT_TUTOR_VOICE).persona.name.length > 0,
      'the voice a skip leaves you with has no name, so the skip is not an answer',
    );

    // On glass: the way past is offered, it is not the primary action, and it
    // goes to the same place the pill does rather than somewhere else.
    const footer = FLOW.slice(FLOW.indexOf("{page === 'voice' && ("));
    assert.ok(footer.includes('<GhostButton label={VOICE_SKIP}'), 'the voice step offers no way past');
    assert.match(footer, /onPress=\{\(\) => void complete\(null\)\}/, 'skipping does something other than leaving with nothing chosen');
    assert.ok(footer.includes('<PillButton label={MEET_PILL} onPress={() => void complete(voice)}'), 'the voice step does not lead anywhere');

    // Nothing on the page is disabled or required. A step that can hold a
    // learner at a menu on the way to their first French sentence is the one
    // thing this whole flow is not allowed to be.
    assert.match(footer, /disabled=\{busy\}/, 'async completion has no duplicate-tap guard');
    assert.doesNotMatch(footer, /voice !== null|voice === null \?/, 'the voice step gates its own exit on having chosen');

    // And it is the LAST page, so skipping it is one tap from the chooser.
    assert.equal(PAGES[PAGES.length - 1], 'voice', 'the voice step is no longer the last thing before the chooser');
    assert.ok(PAGES.indexOf('voice') > PAGES.indexOf('meet'), 'the voices are met before the app says what they are');
  });

  test('the voice step writes through the same door as the profile sheet', () => {
    // One door. `withTutorVoice` in profile/store.ts is the only write path for
    // this field, and `withChosenVoice` is a wrapper over it that adds the one
    // case the sheet does not have: a learner who chose nobody.
    const before = fresh();
    const chosen = withChosenVoice(before, CHOICE);
    assert.equal(chosen.tutorVoice, CHOICE, 'the step did not record the voice the learner picked');
    assert.deepEqual(chosen, withTutorVoice(before, CHOICE), 'the step writes the voice a different way than the sheet does');
    assert.deepEqual({ ...chosen, tutorVoice: null }, before, 'the step edited the learner as well as the voice');

    // By name, in both files, so neither can grow a private write path.
    assert.match(
      stripComments(read('onboarding/voiceStep.ts')),
      /import \{[^}]*\bwithTutorVoice\b[^}]*\} from '\.\.\/profile\/store\.ts'/,
      'the first run reaches for the field some other way than the named door',
    );
    assert.match(SHEET, /update\(withTutorVoice\(profile, option\.value\)\)/, 'the Profile sheet stopped using the door this step shares');
    assert.deepEqual(
      FLOW.match(/tutorVoice:[^,\n]*/g),
      ['tutorVoice: chosen'],
      'the voice page names the stored field somewhere other than the answers it hands back',
    );
    assert.ok(!FLOW.includes('withTutorVoice('), 'the voice page writes the profile itself instead of handing its answer back');
    assert.doesNotMatch(FLOW, /\.\.\.existing\b|\.\.\.profile\b/, 'the voice page spreads a profile instead of going through the door');

    // Wired, not merely available. Onboarding runs OUTSIDE ProfileProvider —
    // ProfileGate renders it precisely when there is no usable profile — so the
    // pick rides out in the answers and is applied to the profile the moment it
    // exists. Without this line the step would be a picker that silently threw
    // the pick away, which is worse than not offering it.
    assert.match(APP, /withChosenVoice\(built, answers\.tutorVoice\)/, 'the profile is built without the voice the learner picked');
    assert.match(APP, /import \{ withChosenVoice \} from '\.\/src\/onboarding\/voiceStep\.ts'/, 'App.tsx applies a voice from somewhere else');
    assert.match(FLOW, /tutorVoice: chosen,/, 'the flow hands its answers back without the voice');
  });

  test('the voice step still says the tutor is AI', () => {
    // This is a disclosure surface, and it is the page most likely to be
    // rewritten as a cast list. Eight named people with warm descriptions and
    // no mention of what they are is exactly the copy the module exists to stop.
    const voice = FIRST_RUN_SURFACES.find((surface) => surface.key === 'voice');
    assert.ok(voice, 'the voice step is not a first-run disclosure surface at all');
    assert.equal(voice.where, 'onboarding/OnboardingFlow.tsx', 'the surface names a file that does not render it');
    assert.ok(voice.lines.some((line) => /\bAI\b/.test(line)), 'the voice step never says AI');
    assert.match(VOICE_AI, /\bAI tutor\b/, 'AI is said, but not next to what he is');
    assert.ok(
      VOICE_STEP_COPY.some((line) => /\bAI tutor\b/.test(line)),
      'the words on the voice page never say what the voices are voices of',
    );

    // The disclosure is on the page, not merely in the module.
    for (const name of ['VOICE_TITLE', 'VOICE_AI', 'VOICE_SKIP']) {
      assert.ok(FLOW.includes(`{${name}}`), `no first-run screen puts ${name} on glass`);
    }
    // The hint is the one line here that names a person, so it is rendered for
    // the persona this learner already has rather than for the default. A skip
    // writes nothing, so somebody who arrived with Céline leaves with Céline,
    // and a hint naming the default would be promising the opposite. F300.
    assert.ok(
      FLOW.includes('{VOICE_SKIP_HINT(persona)}'),
      'the skip hint names the default rather than the voice this learner already has',
    );
    assert.ok(FLOW.indexOf('{VOICE_AI}') > -1, 'the AI line is imported and never rendered');

    // And it says AI before the names, not underneath them.
    assert.ok(
      FLOW.indexOf('{VOICE_AI}') < FLOW.indexOf('<TutorSelection'),
      'the voices are introduced before the learner is told what they are',
    );

    // The copy itself is one flat list so a sentence added to the page is
    // covered the moment it is added, rather than when somebody remembers.
    assert.deepEqual(
      [...VOICE_STEP_COPY],
      [VOICE_TITLE, VOICE_BODY, VOICE_AI, VOICE_SKIP, VOICE_SKIP_HINT(DEFAULT_TUTOR_PERSONA)],
    );
  });
});

describe('the voice audition and skip hold their three fixes — F303, F304, F305', () => {
  test('the skip contributes null on its own, not through a raced setState — F303', () => {
    // A learner who taps a voice and then taps "Skip for now" must leave with
    // nothing chosen. The skip used to run `setVoice(null); finish();` in one
    // tick, but `finish` had already closed over the previous `voice`, so it
    // handed the tapped key to `onDone` and the skip saved the voice the learner
    // walked past. The exit now takes the value as an argument: the pill passes
    // the selection, the skip passes null, and neither reads a state update that
    // has only been queued.
    const footer = FLOW.slice(FLOW.indexOf("{page === 'voice' && ("));
    assert.match(footer, /onPress=\{\(\) => void complete\(null\)\}/, 'the skip does not pass null on its own');
    assert.match(footer, /onPress=\{\(\) => void complete\(voice\)\}/, 'the pill does not leave with the selection');
    assert.doesNotMatch(footer, /setVoice\(null\)/, 'the skip still schedules a setState it then races');
  });

  test('a sample stops when the voice step is left by system navigation — F304', () => {
    // The chevron only moves the page; nothing on it paused the player, so a clip
    // auditioned on the voice step played on over the Meet screen behind it. An
    // effect pauses whenever the page is no longer the voice step, which is the
    // one exit `complete`'s own pause did not cover.
    assert.match(FLOW, /preview\.stop\(\);\s*return pageMotion\.transition/);
    assert.match(PREVIEW, /if \(!active\) controller\.stop\(\)/);
  });

  test('the voice cards show which sample is sounding, on the first run and in the Profile sheet — F355', () => {
    // The card takes `playing`, and both auditions hand it the row whose sample
    // is sounding, so the ear that is lit is the one actually playing. Walked
    // the same way F305 walks FLOW/SHEET/components: the wiring on each surface,
    // then the drawing in the primitive.
    assert.match(FLOW, /preview=\{preview\}/);
    assert.match(CARDS, /preview\?\.voice === voice\.value \? preview\.phase/);
    assert.match(CARDS, /phase === 'playing' \? 'Pause'/);
    assert.match(SHEET, /playing=\{samplePlaying === option\.value\}/);

    // And the card draws it the way the design system says: the ear tints to the
    // accent on a quiet disc while it sounds, and its label reads Stop so a
    // screen reader hears the toggle rather than a second Hear.
    const COMPONENTS = stripComments(read('components.tsx'));
    assert.match(
      COMPONENTS,
      /playing \? accent\.primary : paper\.inkSoft/,
      'the sounding ear is not tinted in the accent',
    );
    assert.match(
      COMPONENTS,
      /playing && \{ backgroundColor: paper\.groundDeep, borderRadius: radius\.pill \}/,
      'the sounding ear sits on no lit disc',
    );
    assert.match(
      COMPONENTS,
      /playing \? `Stop \$\{text\}` : `Hear \$\{text\}`/,
      'the ear never says Stop while it is sounding',
    );
  });

  test('a clip that ends clears the selection so the next tap replays it — F305', () => {
    // `nextSample(playing, tapped)` returns null when the tapped voice is the one
    // already playing, which is how a second tap stops it. But a clip that ends
    // on its own leaves `playing` pointing at it, so the next tap on that same
    // voice was read as "stop" and stopped nothing — a dead ear until a third
    // tap. Watching the player and clearing the key the instant it finishes makes
    // the next tap a fresh play again. Both the first run and the Profile sheet
    // do it, because both run the same one-player audition.
    assert.match(CONTROLLER, /status\.didJustFinish/);
    assert.match(CONTROLLER, /phase: 'ended'/);
    assert.match(CONTROLLER, /state\.phase !== 'paused' \|\| !owned/);
    assert.match(SHEET, /useAudioPlayerStatus\(/);
    assert.ok(SHEET.includes('didJustFinish'));
    assert.ok(SHEET.includes('setSamplePlaying(null)'));

  });
});
