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
        'Your answer to the age question. It is a gate rather than a detail we file: the app asks once, and Luvani is for learners of thirteen and over.',
        'What you have learned. Your history, your review deck, the phrases you keep, your missions and your sound checks. It sits on your phone, and on our server for an account that syncs.',
        'Your saved conversations. After a session the app keeps a short summary with the phrases and corrections worth practising. The conversation itself, turn by turn, is never part of it.',
        'Your plan and the speaking time you have used, so a session is billed once.',
      ],
    },
    {
      heading: 'Your speech',
      body: [
        'Live conversation audio is not stored by Luvani. Daily offline practice is different: when you choose Record my take, a temporary recording stays on your device so you can listen back. It is deleted when you leave that screen, background the app, or record another take. It is never uploaded. An interrupted app may leave a temporary cache file for the operating system to clear.',
        'Nothing tees a live session to storage. Online pronunciation checks read an attempt into memory and answer with observations; daily offline practice is self-comparison and does not send an attempt to that service.',
        'Words are the same rule. What you say is turned into text so the tutor can answer, the session reads that text and drops it, and what survives is the curated summary described above.',
        "The tutor's own lines are the one exception, and they are not yours. They are synthesised once and kept as audio, so a voice service is paid once for a sentence it has already said.",
      ],
    },
    {
      heading: 'Friends is optional',
      body: [
        'If you join Friends, we store your chosen username, display name, privacy choices, requests, connections, blocks, submitted reports, challenges and encouragement. Someone with your exact username or invitation can find your profile and ask to connect. We never upload your contacts.',
        'Only accepted friends can see your weekly learning points, unless you hide your score. Milestone sharing starts off. Joining a shared challenge lets that partner see your combined challenge progress. Your recordings, corrections and saved phrases are not shared.',
        'Leaving Friends removes your connections and hides your profile. Account deletion removes your social records. Reports are available to authorised support staff, not the reported person. Social updates are in-app badges, not remote push notifications.',
      ],
    },
    {
      heading: 'Who else sees it',
      body: [
        'A live conversation needs services we pay for. One carries the audio, one turns speech into text, one gives the tutor its voice, and one scores a pronunciation attempt. Another is the language model: it reads what you said as text and writes the reply the tutor speaks, so your words are read rather than only carried.',
        "The language model is sent what you said, the turns already taken in the same session, the situation you are practising, including a moment you described in your own words when you brought one, your name where you gave one, and a short note of your level and the things to watch for in your French. It writes the tutor's answer from that. When a new situation is set up for you, the language model is also sent a few things you have told the tutor about yourself, which it remembers so it can bring them up next time, and any goals you write in Profile, and the titles of the last few situations you practised, which it wrote itself, so the next one is not a repeat. What the tutor remembers about you is yours to see, and each of those things can be removed in Profile. Your email and which sign-in you used are never part of it.",
        "What you say reaches these services during a session, so the tutor can answer you. The language model hears from us once more after a session ends: that session's turns go back to it, together with the things already on file about you, so it can pick out the phrases worth practising and note anything new worth remembering. Nothing more about that session reaches any of them after that.",
        'Paying for Luvani brings in another company, and it hears none of your French. It takes the payment and tells the app what was bought, so what you paid for is there for you and can be put back on a new phone. What it is told is which account bought what. No audio, no words you said and nothing you are learning goes to it.',
        'The server this notice calls ours runs on computers we rent. The database that keeps your account and your learning is run for us by a company we pay for exactly that, and the counters that hold cost and abuse in check sit with another, under a scrambled marker rather than your name. They hold what is described above so that we can, and nothing else is sent to them.',
        'What any of these companies keeps on its own side is theirs to answer and is not something we have checked, which is why this notice says what each one does for us and stops there.',
        'Nothing is sold. Nothing about you goes to a company for any purpose other than the ones above: carrying a conversation, answering you, keeping what you have learned, and taking a payment. Not to an advertiser, not to a data broker, not to anyone who would put it to a use of their own.',
        'There is no advertising identifier anywhere in Luvani, and no third party analytics kit inside the app. Both are absent on purpose.',
      ],
    },
    {
      heading: 'Usage data, and your choice',
      body: [
        'Luvani can record ten plain events, such as a situation being finished or a subscription page being opened. They carry no free text and nothing you said, and two separate checks refuse anything that is not on that short list.',
        'They are off unless you turn them on. The switch is in Settings, you can change it whenever you like, and nothing in the app works differently either way.',
        'Turning the switch off stops anything new being recorded. It does not reach backwards: deleting your account is what removes what was recorded before.',
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
        'Usage events are kept for thirteen months. The record of speaking time per session is kept for two years, and so are the trial markers.',
        'Counters that hold cost and abuse in check expire on their own, within a day at most.',
        'Deleting your account removes what is tied to it sooner than any of these.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'Download my data writes a file with your account details, every row we hold for you on our server, and everything the app keeps for you on this phone. There is no audio and no transcript in it, because neither is stored.',
        'Delete account removes your account and, with it, your learning, your usage events, your entitlement, your speaking time records and your saved conversations. On this phone it erases every key kept for your account.',
        'Two things of ours are kept on purpose: the trial markers above, and the random installation id they are made from. Neither carries learning, content, or anything that names you.',
        'Paying for Luvani also leaves a record with the company that took the payment, and deleting your Luvani account does not reach it. What stays with them is which account bought what. No audio, no words you said and nothing you are learning is part of it.',
        'We can tell you what deletion does. We cannot yet tell you it has been watched happen: the server side has not been run against a live database, and the erase on the phone has not been run on a real build. So this describes the mechanism rather than calling it verified.',
        ...(contact === null
          ? []
          : [`Write to us at ${contact.address} if you want a copy of something, want something corrected, or want us to stop.`]),
      ],
    },
    {
      heading: 'Age',
      body: [
        'Luvani is for learners of thirteen and over. The app asks once, in plain words, and takes the answer.',
        'If somebody says during a conversation that they are under thirteen, the session ends and this phone remembers that until the age question is answered again.',
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
