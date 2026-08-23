/**
 * What the tutor is called, in one place.
 *
 * The app used to say "your tutor" in twenty-odd places, which is a role, not a
 * person, and a learner who is told they have a French friend and then read at
 * by "your tutor" can hear the difference. He has a name now.
 *
 * One home rather than twenty literals, for the reason F8 gave about the token
 * server address: twenty copies agree about nothing today and would eventually
 * disagree about something. The name also lives in the tutor's own prompt
 * (packages/brain/src/prompt/system.ts), and that one is held by its own test,
 * so a rename is two deliberate edits rather than a hunt.
 *
 * Where he is NOT used, deliberately: failure screens. "Luc did not pick up"
 * blames a person for a dead server, and that copy already goes out of its way
 * to say this one is on us, not on you.
 */
export const TUTOR_NAME = 'Luc';
