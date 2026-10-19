/**
 * The privacy notice, as structured data rather than as a screen.
 *
 * `Acknowledgements.tsx` holds a `NOTICES` array and draws it; this is the data
 * half of that same idea, split out because two things read it. A screen draws
 * it in the app, and `scripts/legal-html.mjs` renders the same sections into the
 * page App Store Connect needs at a URL. Two copies maintained by hand disagree
 * the first time one is edited, and a reviewer comparing them is how a
 * resubmission is refused.
 *
 * ## Every sentence has a source
 *
 * The text is assembled from `docs/PRIVACY_AND_SAFETY.md`, which is where this
 * repo already keeps an accurate account of what is collected and where speech
 * goes. That is the difference between this and the notice both supplied
 * mockups drew: nothing here is a claim about a cipher, a region or a
 * certification that nobody has checked. If a sentence here cannot be pointed at
 * a line in that document, it does not belong in this file.
 *
 * Three things are deliberately NOT said, each because the document says they
 * are not known:
 *
 * - **What the vendors keep on their own side.** Unverified, listed under Not
 *   true yet, so the notice names what they do for us and stops there.
 * - **That deletion has been proven.** The cascade has never run against a live
 *   database and the device erase has never run on a real build (F63, F71), so
 *   the notice describes what deletion does and says plainly that it has not
 *   been watched happen.
 * - **That a lawyer has read this.** `LEGAL_REVIEW_PENDING` stays on the last
 *   section until one has. Accurate words are not cleared words.
 *
 * ## Recipients are bounded by purpose, never by a count
 *
 * Three defects in one change were the same defect: the recipients section ended
 * in a number, and every recipient nobody had counted falsified it. F481 was the
 * language model, F484 the memory that crosses with it, F488 the purchase
 * processor, which "beyond the five services that make a conversation happen"
 * denied existed while `purchases/adapter.native.ts` was handing it an account
 * id. So the closing sentence bounds what is sent by the purposes named above it
 * rather than by how many companies there are, and every recipient is named for
 * what it does. A new vendor is still a new paragraph; the difference is that the
 * sentence around it does not become a lie while nobody writes one.
 *
 * The same construction then had to be struck twice more. F497 took the flat
 * denial off the Settings footer, F500 took it off the first-run line in
 * `onboarding/disclosure.ts`, and F501 is the arithmetic that was still inside
 * this file: "A fifth is the language model", "What you say reaches all five"
 * and "Nothing about that session goes to any of the five after that" each named
 * a set of companies by counting it. Every one of them was defensible as a
 * back-reference to the paragraph above, which is what makes the shape
 * dangerous rather than safe: `LUVANI_TTS_VENDOR` already selects between two
 * voice suppliers (`voiceVendorOf` in `services/shared/devPlan.ts`), so a
 * fallback voice, a second transcriber or a second model would falsify a count
 * here while every test in the repo stayed green. So a recipient is named for
 * what it does, and a sentence that points back at the list points at the
 * services rather than at how many of them there are.
 *
 * ## The own-words judge, and the one company named
 *
 * F625. `POST /drill/judge` sends a typed own-words answer, the phrase, its
 * meaning, the situation and the level to the language model, and when
 * `TYPESAFE_API_KEY` is set `JevFirstBrainClient` sends the same minus the level
 * to TypeSafe first. The phrase and the situation come from a finished session's
 * recap, so "Nothing more about that session reaches any of them after that"
 * was untrue until it carried the practice exception. TypeSafe was the first
 * recipient this notice named, because CLAUDE.md requires it.
 *
 * ## Every company named, beside what it does
 *
 * Founder decision, 2026-10-19: production's language model is OpenAI and the
 * server is hosted on Railway. Until then the model could not be named, because
 * `TUTOR_LLM` chose between three vendors at runtime and a name would have been
 * a guess. Production boot now refuses any brain but OpenAI (`config.ts`
 * `productionConfigurationProblems` in the token server, `preflight.ts` in the
 * agent), so the name is enforced rather than hoped for, and every recipient
 * is now named inside the role sentence it already had: LiveKit, Deepgram,
 * ElevenLabs, Speechace, OpenAI, TypeSafe, RevenueCat (beside Apple or Google
 * taking the payment), Supabase, Upstash and Railway. The construction above
 * still holds: each is named for what it does and none is counted. Naming a
 * company adds no claim about what it keeps; that stays unverified and the
 * notice says so. `policy.test.ts` holds the names to an allow-list, so an
 * eleventh name, or a model vendor production refuses, fails by name.
 *
 * ## What survives a deletion is said where deletion is
 *
 * The trial markers and the installation id are ours, and "Your rights" already
 * named them. The purchase record is not ours: nothing in this repo calls the
 * processor's delete API, so it outlives the account it belongs to, and a
 * paragraph that lists what survives while leaving it out tells a learner the
 * opposite of the truth. So it is disclosed beside the other two rather than
 * left in the recipients section, where somebody asking what survives deletion
 * would never look, and it is written as who holds it and what it is rather than
 * as a list: the day the deletion path does reach the processor, one sentence
 * changes. Closing the gap itself is server work and stays open in Not true yet.
 *
 * The bound in the other direction matters as much. What crosses is an account
 * id and what that account bought, so the paragraph says that and stops.
 * Overclaiming a gap is the same defect as hiding one, and this one is small.
 *
 * The retention periods are stated even though no scheduled delete enforces
 * them yet. Publishing a period creates the obligation, which is the commitment
 * being made on purpose; the gap between the promise and the mechanism is
 * recorded in the Not true yet table rather than hidden by softer wording.
 *
 * ## Why it takes the facts
 *
 * The support address is not supplied yet, so every sentence that would name it
 * is absent rather than written with a blank in it. That is `company.ts`'s rule
 * reaching the longest piece of copy in the app.
 */

import { COMPANY, LEGAL_REVIEW_PENDING, companyLine, contactRow, type CompanyFacts } from './company.ts';

/** One part of the notice: a heading somebody can scan for, and its paragraphs. */
export interface PolicySection {
  heading: string;
  body: readonly string[];
}

/** What the document is called, on the screen and on the page. */
export const POLICY_TITLE = 'Privacy';

/** The line under the title, so the first thing read is what this is for. */
export const POLICY_INTRO =
  'What Luvani keeps about you, why it keeps it, how long it stays, and what you can ask us to do with it.';

/**
 * The notice, in the order it is meant to be read.
 *
 * A function of the facts for the same reason the first-run copy is a function
 * of the persona: the sentences that name an address are only true once there
 * is one, and a document that renders a blank is worse than one that is shorter.
 */
export function policySections(facts: CompanyFacts = COMPANY): readonly PolicySection[] {
  const company = companyLine(facts);
  const contact = contactRow(facts);
  return [
    {
      heading: 'Who we are',
      body: [
        ...(company === null ? [] : [`Luvani is made by ${company}`]),
        'This notice covers the Luvani app and nothing else.',
        ...(contact === null ? [] : [`You can write to us at ${contact.address}.`]),
      ],
    },
    {
      heading: 'What Luvani keeps',
      body: [
        'Your email, your name and which sign-in you used. There is no account without them.',
        'Your minimum-age eligibility declaration. Luvani is for learners aged thirteen and over. This declaration is not age verification.',
        'What you have learned. Your history, your review deck, the phrases you keep, your missions and your sound checks. It sits on your phone, and on our server for an account that syncs.',
        'Your curated conversations. After a session the app keeps a short summary with the phrases and corrections worth practising. The conversation itself, turn by turn, is never part of that practice pack.',
        'Conversation text, only if you choose Save conversation text after the recap. This separately saves the conversation and tutor coaching to your account. Speech recognition can differ from what you said. No recording is saved. Read or permanently delete each text in Progress, Your conversations, Saved conversation text. Deleting text leaves a marker without its words to stop a delayed save restoring it; that marker is removed when you delete your account. Deleting curated practice and deleting conversation text are separate choices.',
        'Your plan and the speaking time you have used, so a session is billed once.',
      ],
    },
    {
      heading: 'Your speech',
      body: [
        'Live conversation audio is not stored by Luvani. Daily offline practice is different: when you choose Record my take, a temporary recording stays on your device so you can listen back. It is deleted when you leave that screen, background the app, or record another take. It is never uploaded. An interrupted app may leave a temporary cache file for the operating system to clear.',
        'Nothing tees a live session to storage. Online pronunciation checks read an attempt into memory and answer with observations; daily offline practice is self-comparison and does not send an attempt to that service.',
        'Before registration you can try a bounded live session with your chosen AI tutor. LiveKit carries the conversation, Deepgram transcribes speech, the OpenAI language model generates replies, and ElevenLabs supplies the tutor voice. Typing uses the same live conversation. We retain a guest capability, usage and a learning summary for up to thirty days to let you save progress after registration. Raw guest audio is not retained. Your confirmed contributions and plan are also stored on this device. Saving your progress transfers the learning summary to your account and removes its temporary guest copy. Interrupted practice is not recorded as completed. Optional analytics and personal tutor memory start off. Daily aggregate starter analytics contain only event, design variant and input categories, and expire after ninety days.',
        'In an own-words drill or Fix your line you can make a temporary recording instead of typing. Deepgram turns that take into French text, which you can check and edit before choosing Check. Luvani removes the local take after the upload finishes or is refused, and keeps no copy of the audio or your answer. Typing remains available without a microphone.',
        'What you say is turned into text so the tutor can answer. The room holds its text temporarily while it is open. Leaving drops that text unless you explicitly chose to save it after the recap. Safety stops offer no text save. Curated practice is kept separately as described above.',
        'Authored tutor lines can be synthesised once and kept as audio. A cached line can be heard again without another voice-service request; an evicted saved-phrase recording may need to be generated again.',
        'Where saved-phrase tutor audio is available, choosing Hear can send that curated French line to ElevenLabs in your chosen tutor voice. The app keeps a bounded private audio cache so hearing it again can reuse the recording. The cache is separate from your recordings. Account changes start cache cleanup; deletion waits for it and reports a failure if this phone cannot finish removing it. An interrupted write is recovered when the cache is next used or cleared. Generation is not automatic, and unavailable audio does not silently use a device voice.',
      ],
    },
    {
      heading: 'Friends is optional',
      body: [
        'If you join Friends, we store your chosen username, display name, privacy choices, requests, connections, blocks, submitted reports, challenges and encouragement. Someone with your exact username or invitation can find your profile and ask to connect. We never upload your contacts.',
        'Friends is an unranked list. Milestone sharing starts off. If you switch it on, accepted friends can see weekly practice milestones. Joining a shared challenge lets that partner see your combined conversation count, not an assessment of your French. Your recordings, corrections and saved phrases are not shared.',
        'Leaving Friends removes your connections and hides your profile. Account deletion removes your social records. Reports are available to authorised support staff, not the reported person. Social updates are in-app badges, not remote push notifications.',
      ],
    },
    {
      heading: 'Who else sees it',
      body: [
        'A live conversation needs services we pay for. LiveKit carries the audio, Deepgram turns speech into text, ElevenLabs gives the tutor its voice, and Speechace scores a pronunciation attempt. Another is the language model, from OpenAI: it reads what you said as text and writes the reply the tutor speaks, so your words are read rather than only carried.',
        "The language model is sent what you said, the turns already taken in the same session, the situation you are practising, including a moment you described in your own words when you brought one, your name where you gave one, and a short note of your level and the things to watch for in your French. It writes the tutor's answer from that. When a new situation is set up for you and on each tutor turn, the language model is also sent a few things you have told the tutor about yourself, which it remembers so it can bring them up next time, and any goals you write in Profile, and the titles of the last few situations you practised, which it wrote itself, so the next one is not a repeat. What the tutor remembers about you is yours to see, and each of those things can be removed in Profile. Pause personal memory keeps remembered details and goals out of future conversations and stops new personal-memory extraction, while your name and French progress still help the tutor. This pause does not stop ordinary replies, learning recaps or practice preparation. One curated correction from your latest saved conversation may also reach the language model in the next conversation, with its original fragment and source title, to give you another chance to use it. This is separate from personal memory and from saving full conversation text. Your email and which sign-in you used are never part of it.",
        "What you say reaches these services during a session, so the tutor can answer you. The language model hears from us once more after a session ends: that session's turns go back to it, together with the things already on file about you, so it can pick out the phrases worth practising and note anything new worth remembering. Nothing more about that session reaches any of them after that, unless you practise a phrase from it.",
        'Automatic personal tutor memory is intended for French goals, everyday interests, practice preferences and non-sensitive family or travel context. The tutor is instructed to leave out personal health details, finances, sexuality or intimate relationships, political or religious beliefs, and identifying secrets, including from its next greeting. These instructions can miss a sensitive detail. Earlier saved greetings are skipped until a new one is prepared under this rule. You can review, edit, forget or pause personal memory in Profile. This rule does not erase older notes or details you write yourself, and it does not govern your separate learning recaps, practice packs or full conversation text you explicitly choose to save.',
        'When you check a phrase in your own words, your typed or edited transcribed answer is read by the language model too. It is sent your answer, the phrase, what the phrase means, the situation it came from and a note of your level. It checks that your words still mean the same thing and may suggest a more natural way to say it. It is not told who you are, and we keep no copy of your answer.',
        'In Fix your line, choosing Check sends the language model the original fragment, the corrected French, the reason for that correction, your edited retry and a note of your level. It checks that particular repair, not pronunciation or overall fluency. It receives no account identifier and Luvani saves no copy of the retry or its verdict. An uncertain check stays unjudged. Today this check goes directly to the language model, without TypeSafe. A separate TypeSafe shortcut can be switched on only after its French checks have been reviewed. It would receive just the original line, corrected form and retry, without your level, name, profile, account or session identifier. It answers whether that particular correction was repaired; it writes no hint. Only a sufficiently clear positive can skip the language model. An uncertain answer still goes to the language model. This shortcut is currently off.',
        'For own-words checks, when we have it switched on, a company called TypeSafe reads your answer first. It is sent the same things, without your level. It answers short questions and writes nothing: yes or no on whether your answer means the same thing, is clear and is French, and how natural it sounds. When it is sure your answer keeps the meaning, is clear French and sounds natural, the language model is not asked. Otherwise the language model reads it too.',
        'A separate TypeSafe check may be switched on after its French checks have been reviewed. After an independently finished situation, it can select one exact line from up to eight accepted French answers to support the situation’s already earned can-do. It receives the authored can-do and those answers with short source markers, without your profile, name, account or session identifier. Code decides whether the answer is clear enough and retrieves the exact original line. This optional check stops when you leave the room, and the line is not saved as a new transcript or achievement. It is currently off.',
        'A separate TypeSafe check for the live Why? link is currently off. If switched on after French review, it receives only a quoted fragment of your confirmed answer and the corrected French. It selects from short reasons written by Luvani, or chooses no reason. It writes no explanation and receives no name, account, session, level or profile. A link appears only when code accepts the selection for that exact correction; an uncertain selection shows no link. Leaving or taking another turn cancels the optional check. These fragments and the selection are not saved as a new record.',
        'Paying for Luvani brings in other companies, and none of them hears any of your French. Apple or Google takes the payment in its store, and RevenueCat handles the purchase and tells the app what was bought, so what you paid for is there for you and can be put back on a new phone. What RevenueCat is told is which account bought what. No audio, no words you said and nothing you are learning goes to any of them.',
        'Our server runs on computers we rent from Railway. Supabase runs the database that keeps your account and your learning, and the sign-in. Upstash holds the counters that hold cost and abuse in check, under a scrambled marker rather than your name. They hold what is described above so that we can, and nothing else is sent to them.',
        'What any of these companies keeps on its own side is theirs to answer and is not something we have checked, which is why this notice says what each one does for us and stops there.',
        'Luvani does not sell your learning data to advertisers or data brokers, or add an advertising tracker. The processing described here includes conversation replies, saved learning, account operations, payment handling, abuse controls and optional usage events. Provider retention and any processing under their own terms must be verified before release. Those providers may retain or review material under their own terms.',
        'There is no advertising identifier anywhere in Luvani, and no third party analytics kit inside the app. Both are absent on purpose.',
      ],
    },
    {
      heading: 'Usage data, and your choice',
      body: [
        'Luvani can record fifteen plain events, such as a situation being finished or a subscription page being opened. They carry no free text and nothing you said, and two separate checks refuse anything that is not on that short list.',
        'They include a trial being claimed, minutes being refused, a restore being started or settled, and returning from the plans page. They are off unless you turn them on. The switch is in Settings, you can change it whenever you like, and nothing in the app works differently either way.',
        'Turning the switch off stops new events from this device. An event or session start already sent can finish being recorded. It does not reach backwards: deleting your account is what removes what was recorded before.',
      ],
    },
    {
      heading: 'Keeping one free trial honest',
      body: [
        'When a free trial is claimed, our server keeps two scrambled markers for the installation it was claimed on. They are what stops one installation claiming the same free trial twice.',
        'They are made by hashing with a secret only our server holds. They are not an advertising identifier, not a device fingerprint, not your email and not your account. Nothing about your learning and nothing you said is attached to them.',
        'They are kept for two years and then deleted. They stay when an account is deleted, on purpose: a free trial that resets by signing up again is not a free trial.',
      ],
    },
    {
      heading: 'How long we keep things',
      body: [
        'Your account, your learning and your saved conversations stay for as long as your account does.',
        'When you forget a remembered detail, the app retains its normalised wording as a marker so the same wording is not stored again. These markers stay until your account is removed, even as you forget more details, and are included in your data export. A differently worded detail may still be treated as new.',
        'Usage events are kept for thirteen months. The record of speaking time per session is kept for two years, and so are the trial markers.',
        'Session grants and refund proofs keep the account, session, allowance-period marker, charged seconds and any confirmed service-failure refund. They contain no conversation text or audio. They stay for as long as the account does, are included in your export and are removed with the account. They prevent the same refund being credited twice or applied to a new allowance.',
        'Saved-phrase audio has a separate spending record: account totals and paid budget-period dates, without the phrase text or audio. Account deletion removes that record. The overall spending total contains no account identifier and can remain after deletion. These limits are separate from your speaking minutes.',
        'Counters that hold cost and abuse in check expire on their own, within a day at most.',
        'Deleting your account removes what is tied to it sooner than any of these.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'Download my data writes a file with your account details, every row we hold for you on our server, and everything the app keeps for you on this phone. It includes conversation text you chose to save and word-free deletion markers. No learner audio is stored or included.',
        'Your saved-phrase audio spending record is included. The private tutor-audio cache is temporary playback storage and is not part of the text download.',
        'Delete account removes your account and, with it, your learning, your usage events, your entitlement, your speaking time records and your saved conversations. On this phone it erases every key kept for your account.',
        'Two things of ours are kept on purpose: the trial markers above, and the random installation id they are made from. Neither carries learning, content, or anything that names you.',
        'Paying for Luvani also leaves a record with the company that manages purchases. Account deletion asks it to erase the record of which account bought what before removing your Luvani account. That request is queued by the company; it is not a claim that every record it holds has already gone. No audio, no words you said and nothing you are learning is part of that record. Deleting your account does not cancel a store subscription. Cancel it in the store.',
        'We can tell you what deletion does. We cannot yet tell you it has been watched happen: the server side has not been run against a live database, and the erase on the phone has not been run on a real build. So this describes the mechanism rather than calling it verified.',
        ...(contact === null
          ? []
          : [`Write to us at ${contact.address} if you want a copy of something, want something corrected, or want us to stop.`]),
      ],
    },
    {
      heading: 'Age',
      body: [
        'Luvani is for learners aged thirteen and over. Starting practice, submitting account creation, choosing a sign-in provider on the create-account page or continuing profile setup accepts the linked Terms declaration. Reading a legal link does not accept it. This declaration is not age verification.',
        'A known refusal before an account blocks continuation for the rest of that app launch and stores no refusal marker. Signing in, signing out or creating a new account does not bypass it.',
        'If a signed-in learner says during a conversation that they are under thirteen, the session ends and this phone keeps the stop until they pass the return eligibility check.',
      ],
    },
    {
      heading: 'Keeping conversations safe',
      body: [
        'Some things a language app should not answer. Code reads what was said before the tutor sees it, and either steps in with a plain sentence or ends the session. It is a fixed set of rules rather than a judgement made by a model.',
        'Nobody is watching a session. Luvani is not an emergency service and no message reaches a person, so anyone in trouble should talk to somebody they trust or call their local emergency number.',
        'When that boundary acts, our server writes one line saying which rule it was. Your words are not in it.',
      ],
    },
    {
      heading: 'Changes to this notice',
      body: [
        'This notice ships inside the app, so what you are reading here matches the version you are running. When it changes, it changes with an update, and the same words go up at the address in our App Store listing.',
        LEGAL_REVIEW_PENDING,
      ],
    },
  ];
}

/** The notice as the app ships it today, with the facts that are supplied. */
export const POLICY_SECTIONS: readonly PolicySection[] = policySections();

/**
 * Every word of it, flattened, the way `REMINDER_COPY` is. The guilt scan and
 * the em-dash walk read the list, so a section added later is covered the
 * moment it is added rather than when somebody remembers to check it.
 */
export function policyCopy(facts: CompanyFacts = COMPANY): readonly string[] {
  return policySections(facts).flatMap((section) => [section.heading, ...section.body]);
}

/** The same, for the facts that are set today. */
export const POLICY_COPY: readonly string[] = policyCopy();
