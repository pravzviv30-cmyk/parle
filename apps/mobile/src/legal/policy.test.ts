/**
 * The privacy notice, held to the document it was assembled from — F479.
 *
 * A privacy notice is the one piece of copy in the app where being pleasant is
 * worth nothing and being accurate is worth everything, so almost every
 * assertion here reads `docs/PRIVACY_AND_SAFETY.md` and asks whether the
 * sentence a learner reads still agrees with it. The document is maintained as
 * the account of what the code really does; the notice is that account in the
 * learner's words, and the two are not allowed to drift.
 *
 * The sharpest checks are the negative ones. Both supplied mockups asserted a
 * cipher, a region and a certification nobody had checked, and every one of
 * those reads as reassuring. What stops the next one is a test that fails on the
 * words rather than a reviewer noticing.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { LEGAL_REVIEW_PENDING, companyFrom, privacyNote } from './company.ts';
import { POLICY_COPY, POLICY_INTRO, POLICY_SECTIONS, POLICY_TITLE, policyCopy, policySections } from './policy.ts';
import { APPLE_EULA_URL, TERMS_BODY, TERMS_COPY, TERMS_TITLE } from './terms.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const source = (name: string): string => readFileSync(`${HERE}${name}`, 'utf8');

/** The document every sentence in the notice has to be checkable against. */
const DOC = readFileSync(fileURLToPath(new URL('../../../../docs/PRIVACY_AND_SAFETY.md', import.meta.url)), 'utf8');

/** The facts as they will read once the two owed ones arrive. */
const SUPPLIED = companyFrom({
  registeredName: 'Vision Strategies Ltd',
  companyNumber: '01234567',
  supportEmail: 'hello@example.com',
});

const HEADINGS = POLICY_SECTIONS.map((section) => section.heading);
const WHOLE = POLICY_COPY.join('\n');

describe('the privacy notice — F479', () => {
  test('every section of the policy has a heading and a body', () => {
    assert.ok(POLICY_SECTIONS.length >= 10, 'the notice lost sections; it covers eleven subjects');
    for (const section of POLICY_SECTIONS) {
      assert.ok(section.heading.trim().length > 0, 'a section has no heading');
      assert.ok(section.body.length > 0, `"${section.heading}" has a heading and nothing under it`);
      for (const paragraph of section.body) {
        assert.ok(paragraph.trim().length > 0, `"${section.heading}" carries an empty paragraph`);
      }
    }
    assert.equal(new Set(HEADINGS).size, HEADINGS.length, 'two sections share a heading, so one cannot be found');

    // The order is part of the document. Who we are first, because a notice
    // that does not say whose it is answers nothing; what changes last.
    assert.equal(HEADINGS[0], 'Who we are');
    assert.equal(HEADINGS.at(-1), 'Changes to this notice');

    // Data, not a screen. A section list that imported a component could not be
    // rendered to HTML by the script that has to publish the same words.
    assert.doesNotMatch(source('policy.ts'), /from 'react-native'|\.tsx'/, 'the notice reaches for a renderer');

    // The paragraphs that name an address are absent until there is one, and
    // present once there is. Both halves, because a branch nobody drives is a
    // branch nobody has seen.
    // Set 2026-10-22 for the beta: the shipped notice names it, and a notice
    // built with no address still names none.
    assert.match(WHOLE, /You can write to us at hello@luvani\.app\./, 'the shipped notice does not name the address that is set');
    assert.doesNotMatch(policyCopy(companyFrom({ registeredName: 'Vision Strategies Ltd', companyNumber: null, supportEmail: null })).join('\n'),
      /write to us/i, 'the notice offers an address that is not set');
    const supplied = policyCopy(SUPPLIED).join('\n');
    assert.match(supplied, /You can write to us at hello@example\.com\./, 'a supplied address is never drawn');
    assert.match(supplied, /Company number 01234567\./, 'a supplied company number is never drawn');
  });

  test('the policy says only what the privacy document says is true', () => {
    // The ten events. The count is in the notice, so it is read off the union
    // rather than trusted: the day an eleventh event lands, this fails instead of
    // the notice quietly becoming untrue. It has already earned its keep once, when
    // the subscription wall took the count from five to ten.
    const union = readFileSync(`${HERE}../analytics/track.ts`, 'utf8');
    const serverEvents = readFileSync(`${HERE}../../../../services/token-server/src/productEvents.ts`, 'utf8');
    assert.equal((union.match(/\| \{ name: '/g) ?? []).length, 14, 'ProductEvent no longer declares fourteen device events');
    assert.match(serverEvents, /SERVER_EVENT_NAMES = \['trial_started', 'minutes_refused'\]/, 'the two server facts must stay explicit');
    assert.match(WHOLE, /record sixteen plain events/, 'the notice stopped naming how many events there are');
    assert.match(DOC, /Luvani records sixteen events/, 'the document no longer agrees with the notice, so the notice is guessing');

    // Speech. The strongest sentence in the notice, and the one most worth
    // holding to the document word for word.
    assert.match(WHOLE, /Live conversation audio is not stored by Luvani\./);
    assert.match(WHOLE, /temporary recording stays on your device/);
    assert.match(WHOLE, /It is never uploaded/);
    assert.match(DOC, /No file, no bucket, no table, no log line/, 'the document softened what it says about audio');

    // The two absences the document calls deliberate.
    assert.match(WHOLE, /no advertising identifier anywhere in Luvani, and no third party analytics kit/);
    assert.match(DOC, /no advertising or\nattribution identifier of any kind, and there is no third-party analytics SDK/);

    // The retentions, as the table states them. Words rather than digits, so
    // the check is on the period rather than on how it is typed.
    assert.match(WHOLE, /Usage events are kept for thirteen months\./);
    assert.match(DOC, /\| 13 months from `occurred_at` \|/, 'the document moved the events retention');
    assert.match(WHOLE, /speaking time per session is kept for two years/);
    assert.match(DOC, /\| 24 months from `reported_at` \|/, 'the document moved the usage retention');
    assert.match(DOC, /\| 24 months from `claimed_at` \|/, 'the document moved the antifraud retention');

    // The antifraud identifier, which the document lists as an undisclosed
    // pseudonymous identifier and this notice exists partly to disclose.
    const trial = POLICY_SECTIONS.find((s) => s.heading === 'Keeping one free trial honest');
    assert.ok(trial, 'the notice stopped disclosing the antifraud markers');
    const said = trial.body.join(' ');
    assert.match(said, /two scrambled markers/, 'the markers are no longer described');
    assert.match(said, /not an advertising identifier/, 'the notice stopped saying what the markers are not');
    assert.match(said, /kept for two years/, 'the notice stopped saying how long the markers are kept');
    assert.match(said, /stay when an account is deleted/, 'the notice hides that the markers survive deletion');

    // A direct recipient can be verified from the shipped request; its retention
    // contract remains unverified. The optional saved-phrase path names only its
    // actual recipient and makes no retention, certification or zero-log claim.
    const savedAudio = POLICY_COPY.find(paragraph => paragraph.startsWith('Where saved-phrase tutor audio is available,'));
    assert.ok(savedAudio, 'saved phrase delivery needs an explicit conditional disclosure');
    assert.match(savedAudio, /choosing Hear can send that curated French line to ElevenLabs in your chosen tutor voice/);
    assert.match(savedAudio, /bounded private audio cache/);
    assert.match(savedAudio, /deletion waits for it and reports a failure/);
    assert.match(DOC, /Explicit Hear can send the curated French to ElevenLabs/);
    assert.match(DOC, /Vendor-side retention for this\s+generated phrase is unverified/);
    const savedServer = readFileSync(`${HERE}../../../../services/token-server/src/phraseAudio.ts`, 'utf8');
    assert.match(savedServer, /https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\//);
    // Which companies may be named at all is held by the allow-list in
    // 'the notice names every company that receives learner data, by role'.
    const speech = POLICY_SECTIONS.find(section => section.heading === 'Your speech')?.body.join(' ') ?? '';
    assert.match(speech, /Deepgram turns that take into French text/);
    assert.match(speech, /check and edit before choosing Check/);
    assert.match(speech, /own-words drill or Fix your line/, 'both temporary recording doors need disclosure');
    assert.match(speech, /removes the local take after the upload finishes or is refused/);
    assert.match(DOC, /Vendor-side retention for LiveKit, Deepgram, ElevenLabs and Speechace is unverified/);

    // Deletion is described, never certified. The cascade has never run against
    // a live database and the device erase has never run on a real build.
    assert.match(WHOLE, /We cannot yet tell you it has been watched happen/);
    assert.doesNotMatch(WHOLE, /deletion (is|has been) verified|permanently purge/i, 'the notice certifies deletion');
    assert.match(DOC, /neither may be described to a learner as\nverified until it is/);

    // Everything the mockups asserted and nobody checked. Each of these reads
    // as reassurance, which is exactly why the ban is mechanical.
    for (const invention of [
      'AES',
      'encrypted',
      'end to end',
      'E2EE',
      'compliant',
      'certified',
      'ISO ',
      'Frankfurt',
      'France',
      'SAS',
      '2016/679',
      'anonymous',
      'guarantee',
      'military',
      'bank grade',
    ]) {
      assert.ok(!WHOLE.toLowerCase().includes(invention.toLowerCase()), `the notice claims "${invention}"`);
    }

    // Jurisdiction: the founder's decision, and the fact both mockups got wrong.
    assert.match(WHOLE, /registered in the UK\./, 'the notice stopped saying where the company is registered');

    // House voice, over the longest piece of copy in the app, with the facts
    // both unset and set so a supplied address cannot smuggle a word in.
    for (const line of [...POLICY_COPY, POLICY_TITLE, POLICY_INTRO, ...policyCopy(SUPPLIED)]) {
      assert.equal(guiltIn(line), undefined, `guilt in the notice: ${line}`);
      assert.doesNotMatch(line, /[—–]/, `em dash in the notice: ${line}`);
      assert.doesNotMatch(
        line.replace(/hello@example\.com|01234567/g, ''),
        /\d/,
        `a digit in the notice, where a period should be a word: ${line}`,
      );
    }
  });

  test('the notice names the language model among the services that see what a learner says', () => {
    // F481. The section listed a carrier, a transcriber, a voice and a scorer,
    // and then said "Nothing is shared with anyone else." Every learner turn
    // also goes, as text, to whichever language model `brainClient` selects,
    // and that is the one recipient that reads the words rather than carrying
    // them. Leaving it out made the notice narrower than the footer it
    // replaced, on the single point a recipients section exists for.
    const seen = POLICY_SECTIONS.find((section) => section.heading === 'Who else sees it');
    assert.ok(seen, 'the notice stopped saying who else sees what a learner says');
    const said = seen.body.join(' ');

    // Named, and named without an ordinal since F501: what it is asked for here
    // is that the model is listed among the recipients, never that it is the
    // fifth of them.
    assert.match(said, /Another is the language model/, 'the notice lists the audio services and hides the one that reads the words');
    assert.match(said, /reads what you said as text and writes the reply the tutor speaks/);
    assert.match(said, /your words are read rather than only carried/, 'the notice stopped saying what makes this recipient different from the carriers');

    // What it receives, in the learner's words. Naming a recipient and hiding
    // what it is handed moves the omission rather than closing it.
    assert.match(said, /The language model is sent what you said/);
    assert.match(said, /your name where you gave one/);
    assert.match(said, /Your email and which sign-in you used are never part of it\./);

    // Sold is still no. Shared is bounded now rather than denied outright.
    // What it is bounded *by* changed in F488, from a count of vendors to the
    // purposes named above the sentence, so this asks for the bound rather than
    // for the number the model was once the fifth of.
    assert.match(said, /Luvani does not sell your learning data/);
    assert.match(said, /Provider retention.*verified before release/);
    assert.match(said, /may retain or review material under their own terms/);
    assert.doesNotMatch(WHOLE, /Nothing is shared with anyone else/, 'the notice denies a sharing that happens every turn');

    // Its retention is as unchecked as the other four, and the notice says so
    // rather than letting the model read as the exception.
    assert.match(said, /is not something we have checked/);

    // The sentence tracks the code. A model client is chosen at runtime and the
    // learner's turn is handed to it, so this fails if the pipeline changes
    // shape rather than only if somebody edits the copy.
    const convo = readFileSync(fileURLToPath(new URL('../../../../services/tutor-agent/src/convo.ts', import.meta.url)), 'utf8');
    assert.match(convo, /export function brainClient/, 'brainClient moved, so this test no longer watches the recipient it names');
    assert.match(convo, /this\.client\.turn\(/, 'the learner turn no longer reaches a model client from convo.ts');

    // Which vendor key is read moved out of convo.ts and into brain's factory,
    // so that the token server and the agent cannot come to disagree about
    // which brain a learner is talking to. The watch follows it rather than
    // being dropped: convo.ts still has to build its client from the
    // environment, and the file that reads the environment still has to be
    // reading somebody else's key.
    assert.match(convo, /brainClientFromEnv/, 'convo.ts no longer builds its client from the environment, so the factory below is not the one it uses');
    const factory = readFileSync(fileURLToPath(new URL('../../../../packages/brain/src/llm/factory.ts', import.meta.url)), 'utf8');
    assert.match(factory, /GROQ_API_KEY|OPENAI_API_KEY/, 'the model client stopped being an outside service, which would change this section');

    // And the document says it, so the sentence is sourced rather than argued.
    assert.match(DOC, /The language model vendor, OpenAI in production, receives the words themselves, as text/);
    assert.match(
      DOC,
      /Vendor-side retention for LiveKit, Deepgram, ElevenLabs and Speechace is unverified, and so is the language model vendor's/,
      'the document stopped saying the model vendor keeps as little verified as the other four',
    );

    // Named since the founder's 2026-10-19 decision, because production boot
    // now refuses any other brain. The vendors it refuses stay unnamed.
    assert.match(said, /Another is the language model, from OpenAI/, 'the notice stopped naming the model vendor production enforces');
    assert.doesNotMatch(WHOLE, /Anthropic|Groq|GPT|Claude|Gemini/i, 'the notice names a model vendor production refuses');
  });

  test('the notice names every company that receives learner data, by role', () => {
    // P3 #7, F854. Founder decision 2026-10-19: OpenAI is production's model
    // and Railway hosts the server. Production boot refuses any other brain
    // (token-server config.ts, tutor-agent preflight.ts), so every recipient can
    // now be named inside the role sentence it already had. This is the
    // allow-list that replaced the two "no vendor named" guards: each of the ten
    // must be named, beside its job, and no other company may be.
    const ROLES: readonly [string, RegExp][] = [
      ['LiveKit', /LiveKit carries the audio/],
      ['Deepgram', /Deepgram turns speech into text/],
      ['ElevenLabs', /ElevenLabs gives the tutor its voice/],
      ['Speechace', /Speechace scores a pronunciation attempt/],
      ['OpenAI', /Another is the language model, from OpenAI/],
      ['TypeSafe', /a company called TypeSafe reads your answer first/],
      ['RevenueCat', /Apple or Google takes the payment in its store, and RevenueCat handles the purchase/],
      ['Supabase', /Supabase runs the database that keeps your account and your learning, and the sign-in/],
      ['Upstash', /Upstash holds the counters that hold cost and abuse in check, under a scrambled marker/],
      ['Railway', /Our server runs on computers we rent from Railway/],
    ];
    const seen = POLICY_SECTIONS.find((section) => section.heading === 'Who else sees it');
    assert.ok(seen, 'the notice stopped saying who else sees what a learner says');
    const said = seen.body.join(' ');
    for (const [name, role] of ROLES) {
      assert.match(said, role, `${name} is not named beside what it does`);
    }

    // No company outside the ten. Store operators appear only as where the
    // payment is taken. Every capitalised word that is not opening a sentence
    // has to be ordinary vocabulary, our own name, or one of the above, so a new
    // company fails here by name rather than reading as reassuring copy.
    const COMPANIES = new Set(ROLES.map(([name]) => name));
    const STORES = new Set(['Apple', 'Google', 'App', 'Store']);
    const OURS = new Set(['Luvani', ...String(SUPPLIED.registeredName).split(' '), 'UK']);
    const VOCABULARY = new Set(['AI', 'Check', 'Fix', 'French', 'Friends', 'Hear', 'Profile', 'Progress', 'Record', 'Save', 'Saved', 'Settings', 'Terms', 'Why', 'Your']);
    const stray = new Set<string>();
    for (const line of [...POLICY_COPY, ...policyCopy(SUPPLIED)]) {
      for (const hit of line.matchAll(/(?<![.!?:]\s)(?<!^)(?<=\s|\()[A-Z][A-Za-z.]*[A-Za-z]/g)) {
        const word = hit[0];
        if (!COMPANIES.has(word) && !STORES.has(word) && !OURS.has(word) && !VOCABULARY.has(word)) stray.add(word);
      }
    }
    assert.deepEqual([...stray], [], `the notice names something outside the allow-list: ${[...stray].join(', ')}`);

    // And at any position, the companies production does not use or the notice
    // must not name: refused model vendors, the other voice supplier, the
    // scorer behind Speechace and store SDKs.
    assert.doesNotMatch(WHOLE, /\b(Anthropic|Groq|Gemini|GPT|Claude|Fish Audio|TonePerfect|StoreKit|Sentry|Firebase|Vercel|Heroku|AWS|Amazon|Cloudflare|Mistral)\b/i, 'the notice names a company outside the ten');

    // The names are true because the code routes there. Each check fails when
    // the routing changes rather than when somebody edits the copy.
    const root = fileURLToPath(new URL('../../../../', import.meta.url));
    const config = readFileSync(join(root, 'services/token-server/src/config.ts'), 'utf8');
    assert.match(config, /env\.TUTOR_LLM\.trim\(\)\.toLowerCase\(\) !== 'openai'/, 'production boot stopped refusing a non-OpenAI brain, so naming OpenAI is a guess again');
    const preflight = readFileSync(join(root, 'services/tutor-agent/src/preflight.ts'), 'utf8');
    assert.match(preflight, /\.toLowerCase\(\) !== 'openai'/, 'the agent stopped refusing a non-OpenAI brain in production');
    assert.match(readFileSync(join(root, 'services/token-server/src/rateLimit.ts'), 'utf8'), /privateSignal/, 'the Upstash keys stopped being scrambled markers');
    assert.match(readFileSync(join(root, 'services/token-server/src/phraseAudio.ts'), 'utf8'), /api\.elevenlabs\.io/);

    // Naming adds no retention claim. The unverified sentence stays.
    assert.match(said, /is not something we have checked/);
    assert.match(said, /Provider retention and any processing under their own terms must be verified before release/);
    assert.match(DOC, /Railway hosts the token server/, 'the document does not source the host the notice names');
  });

  test('the notice says the language model is also sent what the tutor remembers about the learner', () => {
    // F484. The list of what the model receives was checked against
    // `prepareTurn` and `buildTurnContext`, which are the turn call, and
    // `convo.ts` reaches the model at five sites. `buildFrame` sends the last
    // five memory facts into the scene prompt as REAL ACCOUNT MEMORY, and those
    // are facts about the learner's real life that the profile carries from one
    // session into the next: a job interview mentioned on Monday is sent to the
    // vendor on Wednesday to build the next scene. The notice said only this
    // session's turns go, which is the most personal thing the product holds
    // crossing to a third party undisclosed.
    const seen = POLICY_SECTIONS.find((section) => section.heading === 'Who else sees it');
    assert.ok(seen, 'the notice stopped saying who else sees what a learner says');
    const said = seen.body.join(' ');

    assert.match(
      said,
      /the language model is also sent a few things you have told the tutor about yourself/,
      'the notice hides the memory the tutor carries between sessions from the model vendor',
    );
    assert.match(said, /which it remembers so it can bring them up next time/, 'the notice stopped saying why the memory is sent');
    // F562. The learner can now write goals in Profile, and they ride the same
    // snapshot beside the remembered facts (LEARN-009, `memory.learnerGoals`); and the facts themselves
    // can be seen and removed there. Both are said, or the section names a
    // recipient and hides what it receives.
    assert.match(said, /and any goals you write in Profile/, 'the notice hides the goals the learner writes from the list of what the model is sent');
    assert.match(said, /each of those things can be removed in Profile/, 'the notice does not say the remembered facts can be removed');
    const memory = readFileSync(fileURLToPath(new URL('../profile/memory.ts', import.meta.url)), 'utf8');
    assert.match(memory, /learnerGoals: \[\.\.\.profile\.learnerGoals\]/, 'the snapshot no longer carries the goals, so the sentence about them is untrue');
    assert.match(DOC, /goals the learner writes in Profile ride/, 'the document stopped describing the goals that ride with the facts');

    // Facts now ride the scene and each turn in the same repaired bounded
    // memory brief. Keep the disclosure and both actual call doors together.
    const convo = readFileSync(fileURLToPath(new URL('../../../../services/tutor-agent/src/convo.ts', import.meta.url)), 'utf8');
    assert.match(convo, /repaired\.memory\.facts\s*\.filter\(fact => safeContextText\(fact\.en\) && !sensitiveConversationFact\(fact\)\)\s*\.slice\(-5\)/, 'the memory brief stopped sending the bounded repaired facts');
    assert.match(convo, /this\.memoryBrief = tutorMemoryBrief\(this\.profile\)/);
    assert.match(convo, /this\.teachingBrief,[\s\S]*?this\.memoryBrief/);
    assert.match(convo, /text: this\.memoryBrief/);
    assert.match(said, /and on each tutor turn/);
    assert.match(convo, /this\.client\.frame\(/, 'the scene is no longer built by a model client from convo.ts');
    assert.match(convo, /SAVED TUTOR MEMORY/, 'the memory prompt stopped naming its actual editable-note source');

    // And the document, which is where the narrower sentence came from. It said
    // no stored row is handed over; the memory facts are stored rows.
    assert.match(DOC, /`tutorMemoryBrief`[\s\S]{0,200}`repaired\.memory\.facts\.filter\(\.\.\.\)\.slice\(-5\)`/, 'the document stopped describing what the memory brief sends');
    assert.doesNotMatch(DOC, /no stored row/i, 'the document claims again that nothing stored reaches the model vendor');
  });

  test('the notice says when the model is sent something, not only that a session is running', () => {
    // F485. "while a session is running" was this section's whole account of
    // timing, and it tells a learner the sending stops when they stop. It does
    // not. `endSession` makes three more calls to the same vendor after the
    // learner has gone, and one of them hands over that session's turns with
    // every fact on file beside them, so the memory the notice now discloses
    // crosses twice: once when a scene is set up, and again after the session.
    // No category crosses there that had not crossed already, which is why this
    // is a sentence about when rather than a new recipient.
    //
    // The scene list is the other half. `buildFrame` sends the last few scene
    // titles beside the facts, and "your level and the things to watch for"
    // covers the unmastered phrases sent with them but never covered the list.
    // Those titles are the model's own words coming back to it, so the notice
    // says so rather than letting them read as something the learner wrote.
    const seen = POLICY_SECTIONS.find((section) => section.heading === 'Who else sees it');
    assert.ok(seen, 'the notice stopped saying who else sees what a learner says');
    const said = seen.body.join(' ');

    assert.doesNotMatch(said, /while a session is running/, 'the notice still says the sending stops when the session does');
    assert.match(said, /hears from us once more after a session ends/, 'the notice hides the model calls that run once a session has ended');
    assert.match(
      said,
      /turns go back to it, together with the things already on file about you/,
      'the notice sends the turns back after a session without the facts that go with them',
    );
    assert.match(said, /pick out the phrases worth practising and note anything new worth remembering/);

    // And a boundary, so "after a session ends" cannot be read as open ended.
    // It closed on a count of the services until F501 and closes on the
    // services themselves now; what it has to keep saying is that the sending
    // stops, which is what this asks for. Since F625 it names the one way a
    // session's phrase goes out again, which is practising it.
    assert.match(said, /Nothing more about that session reaches any of them after that, unless you practise a phrase from it\./);

    // The scene list, named proportionately: what it is, and whose words.
    assert.match(said, /the titles of the last few situations you practised/, 'the notice hides the scene list sent with the memory facts');
    assert.match(said, /which it wrote itself/, 'the notice lets the scene titles read as words the learner wrote');

    // The code both halves are about, so this fails when a call changes shape
    // rather than only when somebody edits the copy.
    const convo = readFileSync(fileURLToPath(new URL('../../../../services/tutor-agent/src/convo.ts', import.meta.url)), 'utf8');
    assert.match(
      convo,
      /buildExtractionRequest\(\{ history: this\.state\.history, knownFacts: this\.profile\.memory\.facts, knownGoals: this\.profile\.memory\.learnerGoals \?\? \[\] \}\)/,
      'the post-session memory call stopped sending the session turns with the facts already on file',
    );
    assert.match(convo, /await Promise\.allSettled\(\[this\.extractMemory\(/, 'the post-session model calls no longer run after a session ends');
    assert.match(convo, /recentScenarios: this\.profile\.preferences\.lastScenarios/, 'the scene call stopped sending the recent scene list');
    const extract = readFileSync(fileURLToPath(new URL('../../../../packages/brain/src/prompt/extractPrompt.ts', import.meta.url)), 'utf8');
    assert.match(extract, /'Already on file:'/, 'the facts on file no longer reach the model under the name the document cites');
    const profile = readFileSync(fileURLToPath(new URL('../../../../packages/brain/src/profile/profile.ts', import.meta.url)), 'utf8');
    assert.match(profile, /lastScenarios = \[\n\s*state\.frame\.title/, 'the recent scene list stopped being scene titles the model wrote');

    // And the document, so every sentence above is sourced rather than argued.
    assert.match(DOC, /The sending is not over when the session is/, 'the document stopped describing the calls that run after a session');
    assert.match(DOC, /every fact on file up to twelve, rendered as\n`Already on file:`/, 'the document stopped saying the facts go over again after a session');
    assert.match(DOC, /The recent scene list beside those facts is not learner words/, 'the document stopped saying what the scene list is made of');
  });

  test('the policy says a drill answer in your own words is read by the language model and by TypeSafe', () => {
    // F625. `POST /drill/judge` hands a typed own-words answer to the language
    // model, and with `TYPESAFE_API_KEY` set `JevFirstBrainClient` hands it to
    // TypeSafe first. The section named neither, and closed on "Nothing more
    // about that session reaches any of them after that" while the phrase and
    // the situation being judged come out of a finished session's recap.
    const seen = POLICY_SECTIONS.find((section) => section.heading === 'Who else sees it');
    assert.ok(seen, 'the notice stopped saying who else sees what a learner says');
    const said = seen.body.join(' ');

    // The language model, and exactly what it is handed.
    const model = seen.body.find((paragraph) => paragraph.startsWith('When you check a phrase in your own words'));
    assert.ok(model, 'the notice hides that an own-words answer is read by the language model');
    assert.match(model, /your typed or edited transcribed answer is read by the language model too\./);
    assert.match(
      model,
      /It is sent your answer, the phrase, what the phrase means, the situation it came from and a note of your level\./,
      'the notice names the recipient and hides what it is handed',
    );
    assert.match(model, /It checks that your words still mean the same thing and may suggest a more natural way to say it\./);
    assert.match(model, /It is not told who you are, and we keep no copy of your answer\./);

    // TypeSafe, named, and said to be conditional, to write nothing, and to be
    // followed by the language model whenever it is not sure.
    const jev = seen.body.find((paragraph) => paragraph.includes('a company called TypeSafe'));
    assert.ok(jev, 'the notice does not name TypeSafe, which reads the answer first when it is switched on');
    assert.match(jev, /^For own-words checks, when we have it switched on, a company called TypeSafe reads your answer first\./);
    assert.match(jev, /It is sent the same things, without your level\./, 'the notice hides what TypeSafe is handed');
    assert.match(jev, /yes or no on whether your answer means the same thing/, 'the notice stopped saying what TypeSafe answers');
    assert.match(jev, /writes nothing/);
    assert.match(jev, /the language model is not asked\. Otherwise the language model reads it too\./, 'the notice lets TypeSafe read as the only reader');
    const repair = seen.body.find(paragraph => paragraph.startsWith('In Fix your line, choosing Check'));
    assert.ok(repair, 'the distinct repair check must describe its own disclosure');
    assert.match(repair, /original fragment, the corrected French, the reason for that correction, your edited retry and a note of your level/);
    assert.match(repair, /not pronunciation or overall fluency/);
    assert.match(repair, /receives no account identifier/);
    assert.match(repair, /saves no copy of the retry or its verdict/);
    assert.match(repair, /An uncertain check stays unjudged/);
    assert.match(repair, /directly to the language model, without TypeSafe/);

    // The "nothing more" bound, true again. The unqualified close is gone, and
    // the exception it carries is the practice the two paragraphs describe.
    assert.doesNotMatch(said, /reaches any of them after that\./, 'the notice still says nothing about a session goes out after it, which the drill judge contradicts');
    assert.match(said, /Nothing more about that session reaches any of them after that, unless you practise a phrase from it\./);

    // Order carries meaning here. The unchecked-retention sentence and the
    // purpose bound speak of "these companies" and "the ones above", so the drill
    // paragraphs have to sit above both or TypeSafe falls outside them.
    const at = (start: string) => seen.body.findIndex((paragraph) => paragraph.startsWith(start));
    const unchecked = at('What any of these companies keeps on its own side');
    const bound = at('Luvani does not sell');
    assert.ok(unchecked > 0 && bound > 0, 'the notice lost the retention caveat or the purpose bound');
    assert.ok(seen.body.indexOf(model) < unchecked && seen.body.indexOf(jev) < unchecked, 'TypeSafe sits below the sentence that says its retention is unchecked');
    assert.ok(seen.body.indexOf(jev) < bound, 'TypeSafe sits below the purpose bound, so the bound does not cover it');

    // House voice, held on the new sentences directly as well as by the loop
    // over the whole notice above.
    for (const paragraph of [model, jev]) {
      assert.doesNotMatch(paragraph, /[—–·]/, `a dash or middot in the drill judge copy: ${paragraph}`);
      assert.equal(guiltIn(paragraph), undefined, `guilt in the drill judge copy: ${paragraph}`);
    }

    // The code every clause is about, so this fails when the route changes
    // shape rather than only when somebody edits the copy.
    const repo = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
    const drillJudge = repo('services/token-server/src/drillJudge.ts');
    assert.match(
      drillJudge,
      /buildOwnWordsJudgeRequest\(\s*\{ fr, en, situation, mustKeep: mustKeepOf\(body\.mustKeep\), attempt, cefr: cefrOf\(body\.cefr\) \}/,
      'the judge request is built from something other than the answer, the phrase, its meaning, the situation and the level',
    );
    assert.doesNotMatch(drillJudge, /console\.|\.insert\(|\.upsert\(/, 'the judge handler logs or stores something, so "we keep no copy" is untrue');
    const server = repo('services/token-server/src/server.ts');
    assert.match(server, /client: \{ judge: request => judgeBrain\(\)\.judge\(request\) \},[\s\S]*?usage: \(usage\) => console\.log\(judgeUsageLine\(usage\)\)/, 'the lazy judge route must meter only content-free usage');
    const judgeMemo = repo('services/token-server/src/judgeMemo.ts');
    assert.match(server, /const judgeMemo = judgeMemoFromEnv\(process\.env\);/, 'the judge memo is on without the flag, so "we keep no copy" is untrue');
    assert.doesNotMatch(server, /new JudgeMemo\(/, 'the judge memo is on without the flag, so "we keep no copy" is untrue');
    assert.match(judgeMemo, /export function judgeMemoFromEnv\([^)]*\)[^{]*\{\s*return env\.LUVANI_JUDGE_MEMO === '1' \? new JudgeMemo\(\) : null;/, 'the judge memo is on without the flag, so "we keep no copy" is untrue');
    const judge = repo('packages/brain/src/llm/judge.ts');
    assert.match(judge, /`LEARNER LEVEL: \$\{input\.cefr\}`/, 'the model stopped being sent the level, so the sentence overclaims');
    const jevJudge = repo('packages/brain/src/llm/jevJudge.ts');
    const state = jevJudge.slice(jevJudge.indexOf('export function jevJudgeState'), jevJudge.indexOf('export const JEV_JUDGE_QUESTIONS'));
    assert.match(state, /learner_attempt: input\.attempt/, 'TypeSafe stopped being sent the answer');
    assert.doesNotMatch(state, /cefr|userId/, 'TypeSafe is now sent the level or an id, which the notice says it is not');
    assert.match(jevJudge, /request\.signal\?\.throwIfAborted\(\);\s*return this\.brain\.judge\(request\);/, 'an unsettled answer no longer goes on to the language model');
    const factory = repo('packages/brain/src/llm/factory.ts');
    assert.match(factory, /jev === null \? brain : new JevFirstBrainClient\(\{ brain, jev \}\)/, 'TypeSafe stopped being optional in front of the model');
    const typesafe = repo('packages/brain/src/llm/typesafe.ts');
    assert.match(typesafe, /if \(apiKey === ''\) return null;/, 'TypeSafe is reached without a key, so "when we have it switched on" is untrue');

    // Sourced to the document, and on the list of terms still to confirm.
    assert.match(DOC, /\*\*An own-words answer is read by the language model, and first by TypeSafe when it is on\.\*\*/, 'the document stopped describing the drill judge route');
    assert.match(DOC, /and so is TonePerfect's, [^|]*, and so is TypeSafe's/, 'the document stopped listing TypeSafe retention as unverified');
    assert.match(repo('docs/RELEASE_GATE.md'), /Speechace, TonePerfect, TypeSafe and the\s+language model vendor's retention/, 'the release gate stopped asking for TypeSafe terms to be confirmed');
  });


  test('the notice names the payment processor among the companies that receive something', () => {
    // F488, and the third time one defect: the section listed the companies a
    // conversation needs, closed the list, and `purchases/adapter.native.ts` was
    // meanwhile handing another one the learner's account id and their purchase
    // history. A recipient the notice denies exists is worse than one it
    // describes badly, and this is the one a learner pays through.
    const seen = POLICY_SECTIONS.find((section) => section.heading === 'Who else sees it');
    assert.ok(seen, 'the notice stopped saying who else sees what a learner says');
    const said = seen.body.join(' ');

    // Named for what it does, in the learner's words rather than as a category.
    assert.match(said, /Apple or Google takes the payment in its store, and RevenueCat handles the purchase and tells the app what was bought/, 'the notice hides the company that is told what a learner bought');
    assert.match(said, /What RevenueCat is told is which account bought what\./, 'the notice names the payment company and hides what it is handed');

    // And bounded the other way, because overclaiming is its own untruth: an
    // account and a purchase cross, and not one word of French.
    assert.match(said, /none of them hears any of your French/);
    assert.match(said, /No audio, no words you said and nothing you are learning goes to any of them\./);

    // The two calls the paragraph is about, so this fails when the purchase path
    // changes shape rather than only when somebody edits the copy.
    const adapter = readFileSync(`${HERE}../purchases/adapter.native.ts`, 'utf8');
    assert.match(
      adapter,
      /Purchases\.configure\(\{ apiKey: key, appUserID: userId \}\)/,
      'the store adapter stopped filing the account id with the processor at configure',
    );
    assert.match(adapter, /Purchases\.logIn\(userId\)/, 'the store adapter stopped identifying the account to the processor');

    // Our own server is the other half of the same recipient: it asks the vendor
    // about a named account every time it re-projects an entitlement.
    const billing = readFileSync(fileURLToPath(new URL('../../../../services/token-server/src/billing/revenuecat.ts', import.meta.url)), 'utf8');
    assert.match(
      billing,
      /api\.revenuecat\.com\/v1\/subscribers\/\$\{encodeURIComponent\(userId\)\}/,
      'the server stopped asking the processor about a named account, which would change what this section owes',
    );

    // Sourced to the document, like every other sentence in the notice. The
    // vendor table named it and the recipients prose did not, which is the same
    // source gap F481 traced.
    assert.match(DOC, /A purchase reaches a company that hears none of it/, 'the document does not describe the recipient the notice now names');
    assert.match(
      DOC,
      /\| The account id a purchase is filed under, and what that account bought \| RevenueCat/,
      'the vendor table stopped listing the purchase processor',
    );

    // Named by company since 2026-10-19, and only by company: the store SDK
    // names are implementation, not recipients a learner can look up.
    assert.match(said, /RevenueCat handles the purchase/, 'the notice stopped naming the purchase vendor');
    assert.doesNotMatch(WHOLE, /StoreKit|Google Play Billing/i, 'the notice names a store SDK rather than a company');
  });

  test('the notice bounds sharing by purpose rather than by a count of vendors', () => {
    // The construction, not the omission. "Nothing goes to anyone beyond the
    // five services that make a conversation happen" was false the moment a
    // sixth company existed, exactly as "beyond the four" was false before it.
    // A count is falsified by the next vendor and by every vendor the writer did
    // not think of; a purpose is not.
    const seen = POLICY_SECTIONS.find((section) => section.heading === 'Who else sees it');
    assert.ok(seen, 'the notice stopped saying who else sees what a learner says');
    const said = seen.body.join(' ');
    const bound = seen.body.find((paragraph) => paragraph.startsWith('Luvani does not sell'));
    assert.ok(bound, 'the notice stopped bounding what leaves at all');

    // The sentence that was always true, kept whole.
    assert.match(bound, /^Luvani does not sell your learning data/);

    // No count in the bound, in either spelling, and none anywhere in the notice
    // closing a recipients list.
    assert.doesNotMatch(bound, /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d)\b/i, 'the bound counts vendors again, and the next vendor falsifies a count');
    assert.doesNotMatch(WHOLE, /beyond the \w+ services/i, 'the notice closes its recipients list on a number again');

    for (const purpose of ['conversation replies', 'saved learning', 'account operations', 'payment handling', 'abuse controls', 'optional usage events']) {
      assert.ok(bound.includes(purpose), `the notice hides processing for ${purpose}`);
    }
    assert.match(bound, /advertisers or data brokers/);
    assert.match(bound, /Provider retention.*verified before release/);
    assert.doesNotMatch(bound, /for any purpose other than/, 'unknown vendor processing is described as an absolute purpose promise');

    // "The ones above" has to point at something, so the two recipients the
    // count hid are named there. Our own server is companies we pay to hold
    // things, and neither of those was in the notice either.
    assert.match(said, /Our server runs on computers we rent from Railway\./, 'the notice lets a rented database read as a machine of ours');
    assert.match(said, /under a scrambled marker rather than your name/, 'the notice stopped saying what the counter store is keyed by');
    assert.match(DOC, /Our server is somebody else's computer/, 'the document stopped naming the companies behind "our server"');
    assert.match(DOC, /Recipients are bounded by purpose, not by a count/, 'the document stopped holding the rule this entry exists for');

    // And the mechanical half, because the next recipient arrives as a
    // dependency long before anybody rereads this file. A tracker, an attribution
    // kit or a crash reporter in any workspace fails here rather than in a
    // sentence somebody has to notice is wrong.
    const root = fileURLToPath(new URL('../../../../', import.meta.url));
    const manifests = ['apps', 'packages', 'services'].flatMap((group) =>
      readdirSync(join(root, group), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(root, group, entry.name, 'package.json'))
        .filter((path) => existsSync(path)),
    );
    assert.ok(manifests.length >= 6, 'the workspace scan stopped finding the packages it reads');
    const dependencies = manifests.flatMap((path) => {
      const pkg = JSON.parse(readFileSync(path, 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    });
    const unnamed = dependencies.filter((name) =>
      /sentry|bugsnag|crashlytics|firebase|amplitude|posthog|mixpanel|segment\.io|appsflyer|onesignal|datadog|logrocket|instabug|braze|clevertap|kochava|facebook/i.test(name),
    );
    assert.deepEqual(unnamed, [], `a vendor SDK arrived that no paragraph of the notice names: ${unnamed.join(', ')}`);
    assert.ok(
      dependencies.includes('react-native-purchases'),
      'the purchase SDK is gone, so the paragraph about the company that takes the payment describes something that no longer happens',
    );
  });

  test('no sentence in the notice depends on how many vendors there are', () => {
    // F501, and the last instance of the construction F481, F484, F488, F497 and
    // F500 each corrected somewhere else. F488 stopped the closing bound from
    // counting, and three sentences around it went on counting: "A fifth is the
    // language model", "What you say reaches all five", and "Nothing about that
    // session goes to any of the five after that". Each was a back-reference to
    // the list immediately above it, which is what made all three defensible on
    // the day they were written and none of them safe.
    //
    // Unsafe, because the vendor set is already a runtime choice. `voiceVendorOf`
    // reads LUVANI_TTS_VENDOR and answers with one of two voice suppliers, so a
    // fallback voice, a second transcriber or a second model arrives as an
    // environment variable rather than as an edit to policy.ts, and a count would
    // go stale here with every test in the repo still green. That is the failure
    // this test exists to make impossible: it fails on the construction rather
    // than on the number, so it fires before the extra vendor rather than after.
    const counting: readonly { pattern: RegExp; why: string }[] = [
      { pattern: /\b(a|the|another|one) (second|third|fourth|fifth|sixth|seventh|eighth)\b/i, why: 'a recipient named by its place in a count' },
      { pattern: /\b(all|any|each|none|one|both|either|neither) of the (two|three|four|five|six|seven|eight|nine|ten)\b/i, why: 'a set of recipients pointed at by how many there are' },
      { pattern: /\ball (two|three|four|five|six|seven|eight|nine|ten)\b/i, why: 'every recipient, counted' },
      { pattern: /\bthe (two|three|four|five|six|seven|eight|nine|ten)\b/i, why: 'a set of recipients named by its size' },
      { pattern: /\b(one|two|three|four|five|six|seven|eight|nine|ten)( more| other)? (compan(y|ies)|service|services|vendor|vendors|processors?)\b/i, why: 'companies, counted' },
    ];
    const counted: string[] = [];
    for (const line of [...POLICY_COPY, ...policyCopy(SUPPLIED)]) {
      for (const { pattern, why } of counting) {
        const hit = line.match(pattern);
        if (hit) counted.push(`${why}: "${hit[0]}" in "${line}"`);
      }
    }
    assert.deepEqual(counted, [], `the notice counts its recipients again:\n${counted.join('\n')}`);

    // The sentences themselves, so a revert fails by name rather than only as a
    // pattern somebody can argue with.
    const seen = POLICY_SECTIONS.find((section) => section.heading === 'Who else sees it');
    assert.ok(seen, 'the notice stopped saying who else sees what a learner says');
    const said = seen.body.join(' ');
    assert.match(said, /Another is the language model/, 'the language model is the fifth of something again');
    assert.match(said, /What you say reaches these services during a session/, 'what a learner says reaches a number again');
    assert.match(said, /Nothing more about that session reaches any of them after that, unless you practise a phrase from it\./, 'the sending after a session stops at a number again');
    assert.match(said, /Paying for Luvani brings in other companies, and none of them hears any of your French\./, 'the payment company is counted rather than named');

    // What a count is NOT. The opening enumeration gives each service the job it
    // does, and a new vendor edits that sentence exactly as it edits the rest of
    // the section. Removing the jobs to remove the arithmetic would make the
    // notice vaguer, which is the opposite of what this entry is for.
    assert.match(
      said,
      /LiveKit carries the audio, Deepgram turns speech into text, ElevenLabs gives the tutor its voice, and Speechace scores a pronunciation attempt\./,
      'the notice stopped saying what each service is for, which is the disclosure the count was hiding behind',
    );

    // The paragraph nobody was looking at. Two rented holders were tied together
    // by a word that means two, which is the same construction one size down.
    const rented = seen.body.find((paragraph) => paragraph.startsWith('Our server runs on computers we rent'));
    assert.ok(rented, "the notice stopped saying that our server is somebody else's computer");
    assert.doesNotMatch(rented, /\b(both|neither|either)\b/i, 'the rented database and the counter store are tied together by a word that counts them');
    assert.match(rented, /They hold what is described above so that we can, and nothing else is sent to them\./);

    // The switch that would falsify a count without anybody editing this notice,
    // so this fails when the shape of the risk changes rather than only when
    // somebody edits the copy.
    const devPlan = readFileSync(fileURLToPath(new URL('../../../../services/shared/devPlan.ts', import.meta.url)), 'utf8');
    assert.match(devPlan, /function voiceVendorOf\(env: Env\): 'elevenlabs' \| 'fish'/, 'the voice supplier is no longer chosen at runtime, which is the risk this test was written about');
    assert.match(devPlan, /env\.LUVANI_TTS_VENDOR/, 'LUVANI_TTS_VENDOR stopped selecting the voice supplier');
    const preflight = readFileSync(fileURLToPath(new URL('../../../../services/tutor-agent/src/preflight.ts', import.meta.url)), 'utf8');
    assert.match(preflight, /env\.LUVANI_TTS_VENDOR/, 'the worker stopped reading the vendor switch the notice may not count around');

    // And the document, so the rule is written where the next recipient is added
    // rather than only enforced here.
    assert.match(DOC, /Recipients are bounded by purpose, not by a count/, 'the document stopped holding the rule this entry exists for');
    assert.match(DOC, /No learner-facing sentence says how many vendors there are/, 'the document stopped covering back-references as well as the closing bound');
  });

  test('the footer bounds sharing the same way the notice does', () => {
    // F497. The Settings footer ended "Nothing is shared with anyone else or
    // sold for advertising", which is the flat denial F481 struck out of the
    // notice and F488 replaced with a purpose bound. It was defensible while
    // the sentence before it named the only recipients there were, because a
    // language model is a language service; it stopped being defensible the
    // moment the payment processor, the rented database and the counter store
    // were established as recipients, because none of the three is a speech or
    // language service and every one of them holds something.
    //
    // The footer and the notice are one vocabulary for one pipeline, so this
    // reads the purposes off the notice rather than retyping them: the day
    // somebody adds a purpose to the bound above, the footer that does not
    // carry it fails here instead of quietly saying less than the notice does.
    const note = privacyNote();
    const seen = POLICY_SECTIONS.find((section) => section.heading === 'Who else sees it');
    assert.ok(seen, 'the notice stopped saying who else sees what a learner says');
    const bound = seen.body.find((paragraph) => paragraph.startsWith('Luvani does not sell'));
    assert.ok(bound, 'the notice stopped bounding what leaves at all');

    assert.match(bound, /Provider retention.*verified before release/);
    assert.match(note, /spoken or typed words are processed/i);
    assert.match(note, /speech and language services for tutor replies and practice/);
    assert.match(note, /control memory, saved conversation text and optional usage data/);
    assert.match(note, /export your data or delete your account/);
    assert.ok(note.includes(LEGAL_REVIEW_PENDING), 'the footer hides outstanding legal verification');
    assert.doesNotMatch(note, /for any purpose other than/, 'a short footer certifies unverified vendor purposes');

    // The two shapes that were wrong before: a denial of every recipient
    // nobody had thought of, and a count the next vendor falsifies.
    assert.doesNotMatch(note, /Nothing is shared with anyone else/, 'the footer denies a sharing that happens every turn');
    assert.doesNotMatch(note, /anyone else|no one else|nobody else/i, 'the footer bounds by who is not a recipient again');
    assert.doesNotMatch(
      note,
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
      'the footer counts the companies, which is the construction F488 removed from the notice',
    );

    // Still a footer. The notice is one tap away and says the rest; a footer
    // that grows into it is a second document to keep true.
    assert.ok(note.length < 600, `the footer is turning into the notice: ${note.length} characters`);
    assert.ok(privacyNote(SUPPLIED).length < 600, 'the footer with an address in it is turning into the notice');
    for (const line of [note, privacyNote(SUPPLIED)]) {
      assert.equal(guiltIn(line), undefined, `guilt in the footer: ${line}`);
      assert.doesNotMatch(line, /[—–]/, `em dash in the footer: ${line}`);
    }

    // Sourced, like every sentence in the notice it now agrees with.
    assert.match(DOC, /Recipients are bounded by purpose, not by a count/, 'the document stopped holding the rule both surfaces follow');
  });

  test('the notice distinguishes a purchase erasure request from store cancellation', () => {
    const rights = POLICY_SECTIONS.find(section => section.heading === 'Your rights');
    assert.ok(rights);
    const said = rights.body.join(' ');
    assert.match(said, /Account deletion asks it to erase the record of which account bought what before removing your Luvani account/);
    assert.match(said, /That request is queued by the company/);
    assert.match(said, /it is not a claim that every record it holds has already gone/);
    assert.match(said, /No audio, no words you said and nothing you are learning is part of that record/);
    assert.match(said, /Deleting your account does not cancel a store subscription\. Cancel it in the store\./);
    assert.doesNotMatch(said, /deleting your Luvani account does not reach it/);
    const deletion = readFileSync(fileURLToPath(new URL('../../../../services/token-server/src/accountDeletion.ts', import.meta.url)), 'utf8');
    assert.match(deletion, /method: 'DELETE'/);
    assert.match(deletion, /api\.revenuecat\.com\/v1\/subscribers/);
    assert.match(deletion, /response\.status === 200 \|\| response\.status === 404/);
    const ordered = deletion.slice(deletion.indexOf('export async function deleteAccountWithProcessor('));
    assert.ok(ordered.indexOf('requestRevenueCatErasure(') < ordered.indexOf('deleteSupabaseUser('));
    const server = readFileSync(fileURLToPath(new URL('../../../../services/token-server/src/server.ts', import.meta.url)), 'utf8');
    const route = server.slice(server.indexOf("if (req.method === 'POST' && url.pathname === '/account/delete')"), server.indexOf("if (req.method === 'GET' && url.pathname === '/account/export')"));
    assert.match(route, /authenticationIsRecent\(resolved\.authenticatedAt\)/);
    assert.match(route, /privacyJobs\(supabaseUrl, serviceRoleKey, process\.env\.REVENUECAT_SECRET_API_KEY\)\.begin\(resolved\.userId\)/);
    assert.match(route, /result\.kind === 'pending' \? 202 : 200/);
    const jobs = readFileSync(fileURLToPath(new URL('../../../../services/token-server/src/privacyJobs.ts', import.meta.url)), 'utf8');
    assert.ok(jobs.indexOf('requestRevenueCatErasure(') < jobs.indexOf('deleteSupabaseUser('));
    assert.match(DOC, /Account deletion requests purchase-processor erasure/);
    assert.match(DOC, /asynchronous queue/);
    assert.match(WHOLE, /RevenueCat/);
    assert.doesNotMatch(WHOLE, /StoreKit|Google Play Billing/i);
  });

  test('the not true yet table carries no gap the ledger has already closed', () => {
    // F482. That table is the one place in this repo where a gap is allowed to
    // be written down, which is exactly why a row that stopped being true is
    // worse there than anywhere else: it is read as the current account of what
    // is missing, by us and by anyone we hand this file to.
    //
    // A tick is not on its own proof that a row is stale, so this is a named
    // list rather than a sweep. F63, F70, F71 and F114 are ticked for the half
    // that can be proven from inside this repo, and the rows pointing at them
    // describe the half that cannot: a live database, a real device, an outside
    // reviewer. Those rows are right, and a mechanical sweep would delete them.
    const ledger = readFileSync(fileURLToPath(new URL('../../../../docs/KNOWN_ISSUES.md', import.meta.url)), 'utf8');
    const ticked = new Map<string, boolean>();
    let entry: string | null = null;
    for (const line of ledger.split('\n')) {
      const heading = line.match(/^### (F\d+) /);
      if (heading) entry = heading[1]!;
      const status = line.match(/^- status: \[( |x)\]/);
      if (status !== null && entry !== null) {
        ticked.set(entry, status[1] === 'x');
        entry = null;
      }
    }

    const table = DOC.slice(DOC.indexOf('## Not true yet'));
    assert.ok(table.length > 0, 'the document lost its Not true yet section');
    const rows = table.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| Gap |'));
    assert.ok(rows.length >= 10, 'the Not true yet table lost its rows, which is not a way to close a gap');

    // Closed in code on this branch: the switch is on the pre-account Ready
    // page and in Settings, and PolicyScreen draws the antifraud section.
    for (const [id, gone] of [
      ['F472', /analytics switch is not on a screen/],
      ['F479', /no screen draws it yet/],
    ] as const) {
      assert.equal(ticked.get(id), true, `${id} is no longer ticked, so the table may be right and this test wrong`);
      assert.ok(!rows.some((row) => row.includes(id)), `Not true yet still points at ${id}, which the ledger closed`);
      assert.doesNotMatch(table, gone, `Not true yet still lists a gap ${id} closed`);
    }

    // The gaps that really are open stay listed, so emptying the table is not a
    // way to pass this.
    assert.match(table, /no scheduled delete/, 'the unenforced retentions stopped being listed');
    assert.match(table, /Vendor-side retention/, 'the unverified vendor retention stopped being listed');
    assert.equal(ticked.get('F208'), true, 'safety-stop enrichment remains a live gap if its repair is reopened');
    assert.ok(!rows.some((row) => row.includes('F208')), 'the table still lists the closed safety-stop model work gap');
    assert.doesNotMatch(table, /stop does not stop the worker/);

    // And the tab those two gaps live on is called Settings now.
    for (const stale of ['One switch in Profile', 'The Profile legal text', "Profile's **Download my data**"]) {
      assert.ok(!DOC.includes(stale), `the document still sends a learner to Profile: "${stale}"`);
    }
  });

  test('the privacy document says an under-13 answer before an account keeps nothing, and the code keeps nothing', () => {
    // F637/F639 cleanup remains enforced for a known refusal. C2's normal
    // entry uses a linked declaration rather than the retired age question.
    // The refusal clears the draft and stores no marker. The document
    // is held to that and to the code, because a refusal that quietly began
    // leaving something behind would be data about a child nobody chose to keep.
    const flat = (text: string) => text.replace(/\s+/g, ' ');
    const heading = '### An under-13 answer before an account keeps nothing';
    const at = DOC.indexOf(heading);
    assert.ok(at > 0, 'the document no longer says what an under-13 answer before an account keeps');
    const rest = DOC.slice(at + heading.length);
    const said = flat(rest.slice(0, rest.search(/\n#{2,3} /)));
    assert.match(said, /It clears the draft\./, 'the document no longer says the refusal clears the first-run draft');
    assert.match(said, /any first name typed/, 'the document no longer says the first name goes with the draft');
    assert.match(said, /It sends nothing\./, 'the document no longer says the refusal sends nothing');
    assert.match(said, /It stores no marker\./, 'the document no longer says the refusal leaves no marker on the device');
    assert.match(
      said,
      /a relaunch starts at the first page with nothing kept and presents C2's linked declaration again/,
      'the document no longer says what a relaunch after a refusal shows',
    );
    assert.doesNotMatch(
      said,
      /(?:never|not) asked again|remembers? the refusal|refusal (?:is|stays) (?:stored|saved|remembered)/i,
      'the document promises the refusal outlasts a relaunch, which the founder did not choose',
    );

    // The holdings table names the first name and the refusal, and Not true
    // yet carries the ceiling.
    const row = DOC.split('\n').find((line) => line.startsWith('| ') && line.includes('`@luvani/pre-account-onboarding/v1`'));
    assert.ok(row, 'the holdings table has no row for the first-run draft');
    assert.match(row, /speaking confidence, practice focus and deliberate tutor selection/, 'the holdings row must disclose every new local personalisation answer');
    assert.match(row, /interests/, 'the holdings row must disclose interests');
    assert.match(row, /an optional first name/, 'the draft row does not say it can hold a first name');
    assert.match(row, /completed and skipped steps, the onboarding variant, an optional account email/, 'the draft row omits the locally retained route and account email');
    assert.match(row, /sign-in or sign-up form and its return page/, 'the draft row omits the retained account form and return route');
    assert.match(row, /Passwords are never saved/, 'the draft row omits the password storage boundary');
    assert.match(row, /known refusal/i, 'the draft row does not name the known refusal among what removes it');
    assert.match(
      DOC.slice(DOC.indexOf('## Not true yet')),
      /known under-13 refusal before an account lasts the launch and no longer/i,
      'Not true yet stopped stating the actual launch-only refusal boundary',
    );

    // What makes it true. The refusal reaches the discard, which takes the
    // whole key off the device.
    const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
    const app = read('../../App.tsx');
    assert.match(app, /onRefuse=\{refusePreAccount\}/, 'App.tsx does not hear the refusal, so the document overclaims');
    const refuseAt = app.indexOf('const refusePreAccount');
    assert.ok(refuseAt > 0, 'App.tsx no longer has the refusal handler the flow is wired to');
    assert.match(app.slice(refuseAt, app.indexOf('}, [', refuseAt)), /\bdiscardPreAccountDraft\(\);/, 'App.tsx does not clear the draft on a refusal, so the document overclaims');
    const discardAt = app.indexOf('const discardPreAccountDraft');
    assert.ok(discardAt > 0, 'App.tsx no longer has the discard the document names');
    assert.match(app.slice(discardAt, app.indexOf('}, []);', discardAt)), /clearPreAccountDraft\(\)/, 'the discard leaves the draft on the device');

    // The draft holds exactly what the row names, and nothing about a refusal.
    // A new field is new data on the device before an account: change the row
    // and this list together.
    const draft = read('../onboarding/preAccountDraft.ts');
    const shapeAt = draft.indexOf('export interface PreAccountOnboardingDraft {');
    assert.ok(shapeAt > 0, 'the first-run draft has no declared shape');
    const fields = [...draft.slice(shapeAt, draft.indexOf('\n}', shapeAt)).matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
    assert.deepEqual(
      fields,
      ['version', 'onboardingCompletedSteps', 'onboardingSkippedSteps', 'onboardingVariant', 'accountEmail', 'accountMode', 'accountReturnPage', 'drink', 'frequency', 'eligibilityConfirmed', 'quickStart', 'rememberLearning', 'reminderEnabled', 'reminderDays', 'ageConfirmed', 'tutorVoice', 'tutorChosen', 'speakingConfidence', 'practiceFocus', 'analyticsConsent', 'page', 'startLevel', 'reason', 'interests', 'minutes', 'reminderTime', 'firstName'],
      'the first-run draft holds a different set of fields from the ones the holdings row names',
    );

    // Nothing on the first run or in the flow holding the refusal can send or
    // store on its own.
    for (const file of ['../onboarding/PreAccountOnboarding.tsx', '../auth/AuthFlow.tsx']) {
      assert.doesNotMatch(
        read(file),
        /analytics\/track|trackProductEvent|\bfetch\(|supabase|AsyncStorage|SecureStore/i,
        `${file} can send or store something itself, and the document says the refusal does neither`,
      );
    }

    // A launch-only pre-account refusal and a device-local signed-in stop
    // have different owners. The only refusal fact described as kept is the
    // stop said during a signed-in conversation.
    const age = POLICY_SECTIONS.find((section) => section.heading === 'Age');
    assert.ok(age, 'the notice lost its age section');
    const beforeAccount = age.body.find(paragraph => /known refusal before an account/.test(paragraph));
    assert.ok(beforeAccount, 'the notice must distinguish a refusal before an account from a signed-in safety stop');
    assert.match(beforeAccount, /rest of that app launch and stores no refusal marker/);
    assert.match(beforeAccount, /Signing in, signing out or creating a new account does not bypass it/);
    for (const sentence of age.body.join(' ').split(/(?<=\.)\s+/)) {
      if (!/remember|kept|keeps|stored|saved/i.test(sentence)) continue;
      assert.match(sentence, /during a conversation/, `the notice says an age answer is kept that is not the stop in a conversation: ${sentence}`);
    }
    const signedInStop = age.body.find(paragraph => /during a conversation/.test(paragraph));
    assert.ok(signedInStop);
    assert.match(signedInStop, /signed-in learner/);
    assert.match(signedInStop, /this phone keeps the stop until they pass the return eligibility check/);
  });

  test('the terms declare Luvani eligibility and name the licence without claiming other apps agree', () => {
    // F483. Apple's standard licence applies to apps that supply no licence of
    // their own, and plenty supply one, so "the same one that covers everything
    // else you get from the App Store" was a claim about other people's
    // agreements that nobody here can make. The sentence stands without it.
    assert.equal(TERMS_BODY[0], 'Luvani is for learners aged 13 and over.');
    assert.match(TERMS_BODY[1]!, /By starting practice or creating an account, you confirm that you meet this minimum age/);
    assert.equal(TERMS_BODY[2], "Luvani is licensed to you under Apple's standard licence agreement for apps.");
    const body = TERMS_BODY.join(' ');
    assert.doesNotMatch(body, /everything else/i, 'the terms speak for apps that are not ours');
    assert.doesNotMatch(body, /(all|other|every other) apps?\b/i, 'the terms describe what covers somebody else');
    assert.doesNotMatch(body, /the same one/i, 'the terms compare our licence to a licence we have not read');

    // Acceptance is a declaration rather than an age-verification claim.
    assert.equal(TERMS_BODY.length, 4, 'eligibility, declaration and the licence source must stay explicit');
    assert.doesNotMatch(body, /age (?:is |has been )?verified|verified your age/i);
    assert.match(body, /Apple publishes the full text on its own site/);
  });

  test('the screen says a review is still owed until it is not', () => {
    // One sentence, in one module, quoted by both surfaces that carry it. When
    // a lawyer has read the documents it is deleted once, and both stop saying
    // it in the same commit.
    assert.ok(POLICY_COPY.includes(LEGAL_REVIEW_PENDING), 'the notice stopped saying a review is still required');
    assert.equal(POLICY_SECTIONS.at(-1)?.body.at(-1), LEGAL_REVIEW_PENDING, 'the sentence moved off the end');
    assert.ok(privacyNote().includes(LEGAL_REVIEW_PENDING), 'the Settings note stopped saying it');
    assert.doesNotMatch(
      source('policy.ts'),
      /Our privacy policy and terms still need legal review/,
      'the notice restates the sentence instead of importing it, so one could be edited alone',
    );
    // Accurate is not cleared, and the notice must not imply that it is.
    assert.doesNotMatch(WHOLE, /reviewed by (a )?(lawyer|solicitor|counsel)/i, 'the notice claims a review it has not had');
  });

  test("the terms screen names apple's licence rather than reproducing it", () => {
    assert.equal(TERMS_TITLE, 'Terms of use');
    assert.match(TERMS_BODY.join(' '), /Apple's standard licence agreement/, 'the terms stopped naming whose licence this is');
    assert.equal(
      APPLE_EULA_URL,
      'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
      "Apple's canonical address for the standard licence has changed, or been retyped",
    );

    // Not reproduced. Apple's document is theirs, it is thousands of words, and
    // a copy in the bundle is stale the first time they revise it.
    const terms = source('terms.ts');
    assert.ok(TERMS_BODY.join(' ').length < 600, 'the terms screen is long enough to be reproducing something');
    for (const apple of ['LICENSED APPLICATION', 'END USER LICENSE', 'Scope of License', 'THE APPLICATION IS PROVIDED']) {
      assert.ok(!terms.includes(apple), `terms.ts reproduces Apple's text: "${apple}"`);
    }
    // One outward address, and it is Apple's.
    assert.deepEqual(
      [...terms.matchAll(/https?:\/\/[^\s'"`]+/g)].map((m) => m[0]),
      [APPLE_EULA_URL],
      'terms.ts carries an address that is not the one link this screen exists to open',
    );

    for (const line of TERMS_COPY) {
      assert.ok(line.trim().length > 0, 'a terms line is empty');
      assert.equal(guiltIn(line), undefined, `guilt in the terms copy: ${line}`);
      assert.doesNotMatch(line, /[—–]/, `em dash in the terms copy: ${line}`);
    }
  });
});

test("the privacy notice's age section does not promise the question is asked only once", () => {
  const age = POLICY_SECTIONS.find(section => section.heading === 'Age')?.body.join(' ') ?? '';
  const kept = POLICY_SECTIONS.find(section => section.heading === 'What Luvani keeps')?.body.join(' ') ?? '';
  assert.match(kept, /minimum-age eligibility declaration/);
  assert.match(age, /learners aged thirteen and over/);
  assert.match(age, /Starting practice, submitting account creation, choosing a sign-in provider on the create-account page or continuing profile setup accepts the linked Terms declaration/);
  assert.match(age, /Reading a legal link does not accept it/);
  assert.match(age, /This declaration is not age verification/);
  assert.match(DOC, /Only deliberate Start practice, Create account,\s*account provider actions or repair Continue accept that notice/);
  assert.doesNotMatch(WHOLE, /asks once|Your answer to the age question|The app asks in plain words|until the age question is answered again/);
  assert.doesNotMatch(age, /verifies (?:your )?age|age is verified|legal compliance|legally compliant/i);
});
