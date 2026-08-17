/**
 * Hand-authored drill bank for the café arc.
 *
 * Sources: the "Commander un café" lesson lines, and the goal phrases of the
 * café and apéro scene frames. The scene phrases are copied in as literal
 * data, never imported — core must not depend on brain, so the bank repeats
 * the words instead of reaching across that boundary. When a frame's phrasing
 * changes, this file changes by hand; that is the price of keeping the
 * dependency arrow pointing one way.
 *
 * Authoring rules. The reference forms are spoken French, because that is the
 * French these phrases were met in: the ne drops, on does the work of nous,
 * j'suis is written the way it is said. Accepted sets are generous — a learner
 * who produced a real French variant of the right phrase was right, and only
 * `normalise`-distinct variants count, since accents and apostrophes are
 * already forgiven at grading time. Every repeat-this carries its silent twin
 * so "can't speak now" is one lookup. Every entry must pass
 * `validateExercise`; the fixtures test enforces it.
 *
 * phraseKey reuses the deck's identity scheme (phrase:<fr lowercased>, the
 * same key the mobile review store writes), so drilling here reschedules the
 * very card the flashcard deck shows. One phrase, "un café, s'il vous plaît",
 * is deliberately authored at all four ramp stages as the reference ladder.
 */

import type { DrillExercise } from './types.ts';

export const DRILL_FIXTURES: readonly DrillExercise[] = [
  // ---- fill-blank, with options: the bottom of the ramp -------------------

  {
    kind: 'fill-blank',
    id: 'fb-bonjour-first',
    phraseKey: "phrase:bonjour, un café s'il vous plaît",
    difficulty: 'recognition',
    sentence: "___, un café s'il vous plaît",
    // Bonjour before anything else; the distractors are the wrong times of day,
    // not nonsense, because choosing between plausible greetings is the skill.
    options: ['Bonjour', 'Bonsoir', 'Bonne nuit'],
    accepted: ['Bonjour'],
    en: 'Hello, a coffee please',
  },
  {
    kind: 'fill-blank',
    id: 'fb-sur-place',
    phraseKey: "phrase:sur place, s'il vous plaît",
    difficulty: 'recognition',
    sentence: "___ place, s'il vous plaît",
    options: ['Sur', 'Sous', 'Sans'],
    accepted: ['Sur'],
    en: 'To have it here, please',
  },
  {
    kind: 'fill-blank',
    id: 'fb-payer-carte',
    phraseKey: 'phrase:je peux payer par carte ?',
    difficulty: 'recognition',
    sentence: 'Je peux payer par ___ ?',
    options: ['carte', 'carotte', 'porte'],
    accepted: ['carte'],
    en: 'Can I pay by card?',
  },
  {
    kind: 'fill-blank',
    id: 'fb-quoi-samedi',
    phraseKey: 'phrase:on fait quoi samedi ?',
    difficulty: 'recognition',
    // Spoken French keeps the question word in place: on fait quoi, not
    // que fait-on. Teaching the inverted form first would teach a register
    // nobody at the apéro uses.
    sentence: 'On fait ___ samedi ?',
    options: ['quoi', 'qui', 'où'],
    accepted: ['quoi'],
    en: 'What are we doing on Saturday?',
  },

  // ---- fill-blank, typed: production with a scaffold ----------------------

  {
    kind: 'fill-blank',
    id: 'fb-croissant-typed',
    phraseKey: 'phrase:je vais prendre un croissant',
    difficulty: 'production',
    sentence: 'Je vais prendre un ___',
    options: null,
    accepted: ['croissant'],
    en: "I'll take a croissant",
  },
  {
    kind: 'fill-blank',
    id: 'fb-un-cafe-typed',
    phraseKey: "phrase:un café, s'il vous plaît",
    difficulty: 'production',
    sentence: "Un ___, s'il vous plaît",
    options: null,
    accepted: ['café'],
    en: 'A coffee, please',
  },
  {
    kind: 'fill-blank',
    id: 'fb-ca-sera-tout',
    phraseKey: 'phrase:ça sera tout, merci',
    difficulty: 'production',
    sentence: 'Ça sera tout, ___',
    options: null,
    accepted: ['merci', 'merci beaucoup'],
    en: "That'll be all, thanks",
  },
  {
    kind: 'fill-blank',
    id: 'fb-creve-typed',
    phraseKey: "phrase:j'suis crevé, la semaine était longue",
    difficulty: 'production',
    // J'suis is the spoken contraction of je suis, written the way friends say
    // it. Both genders of the adjective are right, because the learner is.
    sentence: "J'suis ___, la semaine était longue",
    options: null,
    accepted: ['crevé', 'crevée', 'fatigué', 'fatiguée'],
    en: "I'm wiped, the week was long",
  },

  // ---- best-sentence ------------------------------------------------------

  {
    kind: 'best-sentence',
    id: 'bs-greet-order',
    phraseKey: "phrase:bonjour, un café s'il vous plaît",
    difficulty: 'recognition',
    prompt: 'You step up to the counter. Greet the barista and order.',
    // The distractors are both understandable and both land rudely: one skips
    // the bonjour, the other demands. Register is the thing being drilled.
    candidates: [
      { fr: "Bonjour, un café s'il vous plaît", en: 'Hello, a coffee please' },
      { fr: 'Un café.', en: 'A coffee.' },
      { fr: 'Je veux un café, vite', en: 'I want a coffee, fast' },
    ],
    correctIndex: 0,
  },
  {
    kind: 'best-sentence',
    id: 'bs-pay-card',
    phraseKey: 'phrase:je peux payer par carte ?',
    difficulty: 'recognition',
    prompt: 'Time to pay, and you would rather not dig for cash.',
    candidates: [
      { fr: 'Donnez-moi la machine', en: 'Give me the machine' },
      { fr: 'Je peux payer par carte ?', en: 'Can I pay by card?' },
      { fr: "L'argent est ici", en: 'The money is here' },
    ],
    correctIndex: 1,
  },
  {
    kind: 'best-sentence',
    id: 'bs-leaving',
    phraseKey: 'phrase:bonne journée !',
    difficulty: 'recognition',
    prompt: 'You have your coffee and you are heading out the door.',
    // Bonjour is for arriving; saying it on the way out marks you instantly as
    // a visitor. That contrast is the whole exercise.
    candidates: [
      { fr: 'Bonne nuit', en: 'Good night' },
      { fr: 'Bonjour', en: 'Hello' },
      { fr: 'Bonne journée !', en: 'Have a good day!' },
    ],
    correctIndex: 2,
  },
  {
    kind: 'best-sentence',
    id: 'bs-apero-greet',
    phraseKey: 'phrase:salut ! ça va ?',
    difficulty: 'recognition',
    prompt: "You arrive at a friend's place for evening drinks.",
    // Vous with old friends does not read as polite, it reads as distant or
    // ironic. The formal option is the trap here, not the reward.
    candidates: [
      { fr: 'Bonjour madame, comment allez-vous ?', en: 'Hello madam, how are you?' },
      { fr: 'Salut ! Ça va ?', en: 'Hey! How are you?' },
      { fr: 'Au revoir', en: 'Goodbye' },
    ],
    correctIndex: 1,
  },

  // ---- appropriate-reply --------------------------------------------------

  {
    kind: 'appropriate-reply',
    id: 'ar-what-to-drink',
    phraseKey: "phrase:un café, s'il vous plaît",
    difficulty: 'recognition',
    line: { speaker: 'Karim', fr: "Qu'est-ce que je vous sers ?", en: 'What can I get you?' },
    // Two right answers, because this drills conversation, not a single key.
    // Je veux is understandable and blunt; it is here to be left unchosen.
    options: [
      { fr: "Un café, s'il vous plaît", en: 'A coffee, please' },
      { fr: "Un thé, s'il vous plaît", en: 'A tea, please' },
      { fr: 'Je veux un café', en: 'I want a coffee' },
    ],
    acceptableIndexes: [0, 1],
  },
  {
    kind: 'appropriate-reply',
    id: 'ar-sur-place',
    phraseKey: "phrase:sur place, s'il vous plaît",
    difficulty: 'recognition',
    line: { speaker: 'Karim', fr: 'Sur place ou à emporter ?', en: 'To have here or take away?' },
    // "Oui" is the classic beginner answer to an either-or question, which is
    // exactly why it is offered.
    options: [
      { fr: "Sur place, s'il vous plaît", en: 'Here, please' },
      { fr: "À emporter, s'il vous plaît", en: 'To take away, please' },
      { fr: 'Oui', en: 'Yes' },
    ],
    acceptableIndexes: [0, 1],
  },
  {
    kind: 'appropriate-reply',
    id: 'ar-ce-sera-tout',
    phraseKey: "phrase:oui, c'est tout, merci",
    difficulty: 'recognition',
    line: { speaker: 'Karim', fr: 'Ce sera tout ?', en: 'Will that be all?' },
    options: [
      { fr: "Oui, c'est tout, merci", en: "Yes, that's all, thanks" },
      { fr: "Non, un croissant aussi, s'il vous plaît", en: 'No, a croissant too, please' },
      { fr: 'Bonne nuit', en: 'Good night' },
    ],
    acceptableIndexes: [0, 1],
  },
  {
    kind: 'appropriate-reply',
    id: 'ar-ca-marche',
    phraseKey: 'phrase:ça marche',
    difficulty: 'recognition',
    line: { speaker: 'Karim', fr: 'Je vous apporte ça tout de suite.', en: 'I will bring that right over.' },
    // Ça marche is the everyday yes of service French, and the phrase this
    // exercise exists to make familiar.
    options: [
      { fr: 'Ça marche', en: 'Works for me' },
      { fr: 'Merci beaucoup', en: 'Thank you very much' },
      { fr: 'Bonsoir', en: 'Good evening' },
    ],
    acceptableIndexes: [0, 1],
  },
  {
    kind: 'appropriate-reply',
    id: 'ar-plan-samedi',
    phraseKey: 'phrase:carrément !',
    difficulty: 'recognition',
    line: { speaker: 'Chloé', fr: 'On se fait un resto samedi ?', en: 'Shall we do a restaurant on Saturday?' },
    options: [
      { fr: 'Carrément !', en: 'Totally!' },
      { fr: 'Ouais, grave', en: 'Yeah, for sure' },
      { fr: 'Vous désirez ?', en: 'What would you like?' },
    ],
    acceptableIndexes: [0, 1],
  },

  // ---- repeat-this, each with its silent twin -----------------------------

  {
    kind: 'repeat-this',
    id: 'rt-un-cafe',
    phraseKey: "phrase:un café, s'il vous plaît",
    difficulty: 'production',
    reference: "Un café, s'il vous plaît",
    referenceEn: 'A coffee, please',
    ipa: 'œ̃ ka.fe sil vu plɛ',
    noMicTwin: {
      kind: 'listen-type',
      id: 'rt-un-cafe-silent',
      phraseKey: "phrase:un café, s'il vous plaît",
      difficulty: 'production',
      fr: "Un café, s'il vous plaît",
      accepted: ["Un café, s'il vous plaît"],
    },
  },
  {
    kind: 'repeat-this',
    id: 'rt-repetez',
    phraseKey: 'phrase:pardon, vous pouvez répéter ?',
    difficulty: 'production',
    // The most useful sentence in the whole arc: it keeps a real conversation
    // alive when the thread is lost, so it earns a spoken slot early.
    reference: 'Pardon, vous pouvez répéter ?',
    referenceEn: 'Sorry, could you say that again?',
    ipa: 'paʁ.dɔ̃ vu pu.ve ʁe.pe.te',
    noMicTwin: {
      kind: 'listen-type',
      id: 'rt-repetez-silent',
      phraseKey: 'phrase:pardon, vous pouvez répéter ?',
      difficulty: 'production',
      fr: 'Pardon, vous pouvez répéter ?',
      accepted: ['Pardon, vous pouvez répéter ?'],
    },
  },
  {
    kind: 'repeat-this',
    id: 'rt-merci-beaucoup',
    phraseKey: 'phrase:merci beaucoup',
    difficulty: 'production',
    reference: 'Merci beaucoup',
    referenceEn: 'Thank you very much',
    ipa: 'mɛʁ.si bo.ku',
    noMicTwin: {
      kind: 'fill-blank',
      id: 'rt-merci-beaucoup-silent',
      phraseKey: 'phrase:merci beaucoup',
      difficulty: 'production',
      sentence: 'Merci ___',
      options: null,
      accepted: ['beaucoup', 'bien'],
      en: 'Thank you very much',
    },
  },
  {
    kind: 'repeat-this',
    id: 'rt-sante',
    phraseKey: 'phrase:santé !',
    difficulty: 'production',
    reference: 'Santé !',
    referenceEn: 'Cheers!',
    ipa: 'sɑ̃.te',
    noMicTwin: {
      kind: 'listen-type',
      id: 'rt-sante-silent',
      phraseKey: 'phrase:santé !',
      difficulty: 'production',
      fr: 'Santé !',
      accepted: ['Santé !'],
    },
  },
  {
    kind: 'repeat-this',
    id: 'rt-bonne-journee',
    phraseKey: 'phrase:bonne journée !',
    difficulty: 'production',
    reference: 'Bonne journée !',
    referenceEn: 'Have a good day!',
    ipa: 'bɔn ʒuʁ.ne',
    noMicTwin: {
      kind: 'listen-type',
      id: 'rt-bonne-journee-silent',
      phraseKey: 'phrase:bonne journée !',
      difficulty: 'production',
      fr: 'Bonne journée !',
      accepted: ['Bonne journée !'],
    },
  },

  // ---- tap-translate ------------------------------------------------------

  {
    kind: 'tap-translate',
    id: 'tt-un-cafe',
    phraseKey: "phrase:un café, s'il vous plaît",
    difficulty: 'recognition',
    en: 'A coffee, please',
    tokens: ['un', 'café', "s'il", 'vous', 'plaît', 'thé', 'merci'],
    // Word order is freer in speech than a course admits, and merci does the
    // job of s'il vous plaît at a counter every day. All three are French a
    // barista would hear as right.
    accepted: ["un café s'il vous plaît", "s'il vous plaît, un café", 'un café, merci'],
  },
  {
    kind: 'tap-translate',
    id: 'tt-quoi-samedi',
    phraseKey: 'phrase:on fait quoi samedi ?',
    difficulty: 'recognition',
    en: 'What are we doing on Saturday?',
    // The nous tile is the lesson: spoken French says on. Reaching for nous is
    // the anglophone reflex this exercise is built to catch.
    tokens: ['on', 'fait', 'quoi', 'samedi', 'nous', 'dimanche'],
    accepted: ['on fait quoi samedi', "qu'est-ce qu'on fait samedi"],
  },
  {
    kind: 'tap-translate',
    id: 'tt-payer-carte',
    phraseKey: 'phrase:je peux payer par carte ?',
    difficulty: 'recognition',
    en: 'Can I pay by card?',
    tokens: ['je', 'peux', 'payer', 'par', 'carte', 'en', 'espèces'],
    accepted: ['je peux payer par carte'],
  },
  {
    kind: 'tap-translate',
    id: 'tt-toilettes',
    phraseKey: 'phrase:où sont les toilettes ?',
    difficulty: 'recognition',
    en: 'Where are the toilets?',
    // Les toilettes is always plural, so the singular tiles are the trap.
    tokens: ['où', 'sont', 'les', 'toilettes', 'est', 'la'],
    accepted: ['où sont les toilettes'],
  },

  // ---- listen-type --------------------------------------------------------

  {
    kind: 'listen-type',
    id: 'lt-ca-marche',
    phraseKey: 'phrase:ça marche',
    difficulty: 'production',
    fr: 'Ça marche',
    accepted: ['Ça marche'],
  },
  {
    kind: 'listen-type',
    id: 'lt-creve',
    phraseKey: "phrase:j'suis crevé, la semaine était longue",
    difficulty: 'production',
    fr: "J'suis crevé, la semaine était longue",
    // What the ear hears is j'suis; what school taught is je suis. Both
    // spellings of the same sound are honest transcriptions, in either gender.
    accepted: [
      "J'suis crevé, la semaine était longue",
      'Je suis crevé, la semaine était longue',
      "J'suis crevée, la semaine était longue",
      'Je suis crevée, la semaine était longue',
    ],
  },
  {
    kind: 'listen-type',
    id: 'lt-truc-de-ouf',
    phraseKey: "phrase:c'était un truc de ouf",
    difficulty: 'production',
    fr: "C'était un truc de ouf",
    // Ouf is verlan for fou. A learner meeting it by ear may reasonably write
    // the word it came from; that is comprehension, not error.
    accepted: ["C'était un truc de ouf", "C'était un truc de fou"],
  },
  {
    kind: 'listen-type',
    id: 'lt-ca-sera-tout',
    phraseKey: 'phrase:ça sera tout, merci',
    difficulty: 'production',
    fr: 'Ça sera tout, merci',
    // Ça sera is what gets said; ce sera is what gets written. Ears differ on
    // which they caught, and neither deserves a correction.
    accepted: ['Ça sera tout, merci', 'Ce sera tout, merci'],
  },
];
