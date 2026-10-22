/**
 * Hand-authored drill bank for the café arc and the authored missions.
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
 * is deliberately authored at all five ramp stages as the reference ladder.
 *
 * The mission sections below exist because a path node with nothing behind it is
 * a door onto an empty room, which path.ts:183 records as a bug that shipped
 * rather than a theoretical one. Every phrase an authored mission leaves behind
 * gets one recognition exercise and one production exercise, so the ramp has
 * somewhere to walk it. No other mission phrase is authored at all five stages: that
 * ladder belongs to the café line, and a second one would give the bank two
 * centres of gravity. pickForStage falls back to the nearest easier stage, so a
 * phrase with no spoken exercise gets its typed one rather than nothing.
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
    kind: 'own-words', id: 'own-cafe', phraseKey: "phrase:un café, s'il vous plaît",
    difficulty: 'production', fr: "Un café, s'il vous plaît", en: 'A coffee, please',
    situation: 'You are at a café counter. Ask politely for a coffee.',
    mustKeep: ['coffee', 'please'], accepted: [],
  },

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

  // ---- le premier café --------------------------------------------
  // 2026-09-27: the three lines of the first scene, mission:premier-cafe,
  // copied from the approved first-coffee situation in
  // `daily/scenes/cafeAndFood.ts`. Each gets the same three kinds the card
  // question has (options, best sentence, tiles), because they sit in the same
  // café unit and a beginner meets them first. Every distractor is French a
  // learner could say without harm; the point is choosing the one that fits.

  {
    kind: 'fill-blank',
    id: 'fb-premier-prendre',
    phraseKey: 'phrase:bonjour, je vais prendre un café',
    difficulty: 'recognition',
    sentence: 'Bonjour, je vais ___ un café',
    options: ['prendre', 'porter', 'donner'],
    accepted: ['prendre'],
    en: 'Hello, I will have a coffee',
  },
  {
    kind: 'best-sentence',
    id: 'bs-premier-order',
    phraseKey: 'phrase:bonjour, je vais prendre un café',
    difficulty: 'recognition',
    prompt: 'It is early morning at the counter. Greet the barista and order a coffee.',
    // Bonsoir is the right words at the wrong hour, and the bare order skips
    // the greeting. Both are understood; only one sounds right at eight.
    candidates: [
      { fr: 'Bonsoir, je vais prendre un café', en: 'Good evening, I will have a coffee' },
      { fr: 'Un café', en: 'A coffee' },
      { fr: 'Bonjour, je vais prendre un café', en: 'Hello, I will have a coffee' },
    ],
    correctIndex: 2,
  },
  {
    kind: 'tap-translate',
    id: 'tt-premier-order',
    phraseKey: 'phrase:bonjour, je vais prendre un café',
    difficulty: 'recognition',
    en: 'Hello, I will have a coffee',
    // Bonsoir and thé are the near misses: the right shape, the wrong word.
    tokens: ['bonjour', 'je', 'vais', 'prendre', 'un', 'café', 'bonsoir', 'thé'],
    accepted: ['bonjour, je vais prendre un café'],
  },
  {
    kind: 'fill-blank',
    id: 'fb-premier-comptoir',
    phraseKey: "phrase:sur place, au comptoir, s'il vous plaît",
    difficulty: 'recognition',
    sentence: "Sur place, au ___, s'il vous plaît",
    options: ['comptoir', 'bureau', 'marché'],
    accepted: ['comptoir'],
    en: 'Here at the counter, please',
  },
  {
    kind: 'best-sentence',
    id: 'bs-premier-where',
    phraseKey: "phrase:sur place, au comptoir, s'il vous plaît",
    difficulty: 'recognition',
    prompt: 'The barista asks if it is to have here or to take away. You want to drink it standing at the counter.',
    candidates: [
      { fr: "À emporter, s'il vous plaît", en: 'To take away, please' },
      { fr: "Sur place, au comptoir, s'il vous plaît", en: 'Here at the counter, please' },
      { fr: "Dans la rue, s'il vous plaît", en: 'In the street, please' },
    ],
    correctIndex: 1,
  },
  {
    kind: 'tap-translate',
    id: 'tt-premier-where',
    phraseKey: "phrase:sur place, au comptoir, s'il vous plaît",
    difficulty: 'recognition',
    en: 'Here at the counter, please',
    tokens: ['sur', 'place', 'au', 'comptoir', "s'il", 'vous', 'plaît', 'à', 'emporter'],
    // Au comptoir already says here, so the shorter answer is right too.
    accepted: ["sur place, au comptoir, s'il vous plaît", "au comptoir, s'il vous plaît"],
  },
  {
    kind: 'fill-blank',
    id: 'fb-premier-combien',
    phraseKey: 'phrase:je vous dois combien ?',
    difficulty: 'recognition',
    sentence: 'Je vous dois ___ ?',
    options: ['combien', 'comment', 'quand'],
    accepted: ['combien'],
    en: 'How much is that?',
  },
  {
    kind: 'best-sentence',
    id: 'bs-premier-combien',
    phraseKey: 'phrase:je vous dois combien ?',
    difficulty: 'recognition',
    prompt: 'Your coffee is on the counter. Find out what you owe.',
    candidates: [
      { fr: 'Je vous dois combien ?', en: 'How much is that?' },
      { fr: 'Combien de cafés ?', en: 'How many coffees?' },
      { fr: "C'est gratuit ?", en: 'Is it free?' },
    ],
    correctIndex: 0,
  },
  {
    kind: 'tap-translate',
    id: 'tt-premier-combien',
    phraseKey: 'phrase:je vous dois combien ?',
    difficulty: 'recognition',
    en: 'How much is that?',
    // Spoken French moves the question word freely, so both orders are right.
    tokens: ['je', 'vous', 'dois', 'combien', 'comment', 'tu'],
    accepted: ['je vous dois combien', 'combien je vous dois'],
  },

  // ---- à la réception --------------------------------------------
  // The distractors are both understandable and both land wrong in a way
  // a learner really lands wrong: bonjour after dark marks you as a
  // visitor, and je veux is a demand where a booking already exists.
  {
    kind: 'best-sentence',
    id: 'hotel-arrival-greet',
    phraseKey: "phrase:bonsoir, j'ai une réservation",
    difficulty: 'recognition',
    candidates: [
      {
        en: 'Good evening, I have a booking',
        fr: "Bonsoir, j'ai une réservation",
      },
      {
        en: 'Hello, I have a booking',
        fr: "Bonjour, j'ai une réservation",
      },
      {
        en: 'Good evening, I want a room',
        fr: 'Bonsoir, je veux une chambre',
      },
    ],
    correctIndex: 0,
    prompt: 'You reach the hotel desk after dark. Martine looks up.',
  },
  {
    kind: 'repeat-this',
    id: 'hotel-arrival-say',
    phraseKey: "phrase:bonsoir, j'ai une réservation",
    difficulty: 'production',
    ipa: 'bɔ̃.swaʁ ʒe yn ʁe.zɛʁ.va.sjɔ̃',
    noMicTwin: {
      kind: 'listen-type',
      id: 'hotel-arrival-say-silent',
      phraseKey: "phrase:bonsoir, j'ai une réservation",
      difficulty: 'production',
      accepted: ["Bonsoir, j'ai une réservation"],
      fr: "Bonsoir, j'ai une réservation",
    },
    reference: "Bonsoir, j'ai une réservation",
    referenceEn: 'Good evening, I have a booking',
  },
  // The quel tile is the trap: heure is feminine, so the dislocated
  // question needs quelle. Both accepted orders are real speech, since
  // the dislocated head moves to either end.
  {
    kind: 'tap-translate',
    id: 'hotel-breakfast-tap',
    phraseKey: "phrase:le petit déjeuner, c'est à quelle heure ?",
    difficulty: 'recognition',
    accepted: [
      "le petit déjeuner, c'est à quelle heure",
      "c'est à quelle heure, le petit déjeuner",
    ],
    en: 'What time is breakfast?',
    tokens: ['le', 'petit', 'déjeuner', "c'est", 'à', 'quelle', 'heure', 'quel', 'où'],
  },
  // The blank is the dislocated head, not the noun inside the question,
  // so what gets recalled is the shape of the question itself. Le petit
  // dej is what people actually say and is accepted.
  {
    kind: 'fill-blank',
    id: 'hotel-breakfast-typed',
    phraseKey: "phrase:le petit déjeuner, c'est à quelle heure ?",
    difficulty: 'production',
    accepted: ['le petit déjeuner', 'le petit dej'],
    en: 'What time is breakfast?',
    options: null,
    sentence: "___, c'est à quelle heure ?",
  },
  // Both distractors are things you could plausibly leave at a hotel
  // desk. Clef is the older spelling of the same word and is accepted,
  // though only clé is offered as a tile.
  {
    kind: 'fill-blank',
    id: 'hotel-key-blank',
    phraseKey: 'phrase:faut laisser la clé quand je sors ?',
    difficulty: 'recognition',
    accepted: ['clé', 'clef'],
    en: 'Do I have to leave the key when I go out?',
    options: ['clé', 'valise', 'porte'],
    sentence: 'Faut laisser la ___ quand je sors ?',
  },
  // The played line drops il, as speech does. A learner who writes the
  // fuller il faut heard it right, so that spelling is accepted
  // alongside.
  {
    kind: 'listen-type',
    id: 'hotel-key-listen',
    phraseKey: 'phrase:faut laisser la clé quand je sors ?',
    difficulty: 'production',
    accepted: [
      'Faut laisser la clé quand je sors ?',
      'Il faut laisser la clé quand je sors ?',
      'Faut laisser la clef quand je sors ?',
    ],
    fr: 'Faut laisser la clé quand je sors ?',
  },
  // Two right answers, because thanking her first is at least as good as
  // the bare question. The third option is the near-twin from the
  // breakfast phrase, which is exactly the confusion worth surfacing.
  {
    kind: 'appropriate-reply',
    id: 'hotel-floor-reply',
    phraseKey: "phrase:c'est à quel étage ?",
    difficulty: 'recognition',
    acceptableIndexes: [
      0,
      1,
    ],
    line: {
      en: 'Here is your key, the room is at the end of the hall.',
      fr: 'Voilà votre clé, la chambre est au fond du couloir.',
      speaker: 'Martine',
    },
    options: [
      {
        en: 'Which floor is it on?',
        fr: "C'est à quel étage ?",
      },
      {
        en: 'Thanks, and which floor is it on?',
        fr: "Merci, et c'est à quel étage ?",
      },
      {
        en: 'What time is it at?',
        fr: "C'est à quelle heure ?",
      },
    ],
  },
  {
    kind: 'repeat-this',
    id: 'hotel-floor-say',
    phraseKey: "phrase:c'est à quel étage ?",
    difficulty: 'production',
    ipa: 'sɛ ta kɛl e.taʒ',
    noMicTwin: {
      kind: 'fill-blank',
      id: 'hotel-floor-say-silent',
      phraseKey: "phrase:c'est à quel étage ?",
      difficulty: 'production',
      accepted: ['étage'],
      en: 'Which floor is it on?',
      options: null,
      sentence: "C'est à quel ___ ?",
    },
    reference: "C'est à quel étage ?",
    referenceEn: 'Which floor is it on?',
  },
  // Je te remercie is the vous-versus-tu trap the whole mission leans on,
  // and de rien is the answer to thanks rather than the thanks, which is
  // the other common mix-up.
  {
    kind: 'best-sentence',
    id: 'hotel-thanks-choose',
    phraseKey: 'phrase:je vous remercie',
    difficulty: 'recognition',
    candidates: [
      {
        en: 'Thank you',
        fr: 'Je vous remercie',
      },
      {
        en: 'Thanks a lot',
        fr: 'Je te remercie',
      },
      {
        en: 'You are welcome',
        fr: 'De rien',
      },
    ],
    correctIndex: 0,
    prompt: 'Martine has the key in your hand and the room ready. Thank her.',
  },
  {
    kind: 'listen-type',
    id: 'hotel-thanks-listen',
    phraseKey: 'phrase:je vous remercie',
    difficulty: 'production',
    accepted: ['Je vous remercie'],
    fr: 'Je vous remercie',
  },

  // ---- au marché -------------------------------------------------
  // Both distractors are understood at a market and both land badly: one
  // skips the bonjour a stallholder expects, the other states a want
  // where French softens it. Register is what is being drilled, not
  // vocabulary.
  {
    kind: 'best-sentence',
    id: 'marche-bs-kilo',
    phraseKey: 'phrase:bonjour, je voudrais un kilo de tomates',
    difficulty: 'recognition',
    candidates: [
      {
        en: 'Hello, I would like a kilo of tomatoes',
        fr: 'Bonjour, je voudrais un kilo de tomates',
      },
      {
        en: 'A kilo of tomatoes.',
        fr: 'Un kilo de tomates.',
      },
      {
        en: 'I want a kilo of tomatoes',
        fr: 'Je veux un kilo de tomates',
      },
    ],
    correctIndex: 0,
    prompt: "You stop at Corinne's stall and you want a kilo of tomatoes.",
  },
  {
    kind: 'repeat-this',
    id: 'marche-rt-kilo',
    phraseKey: 'phrase:bonjour, je voudrais un kilo de tomates',
    difficulty: 'production',
    ipa: 'bɔ̃.ʒuʁ ʒə vu.dʁɛ œ̃ ki.lo də tɔ.mat',
    noMicTwin: {
      kind: 'fill-blank',
      id: 'marche-rt-kilo-silent',
      phraseKey: 'phrase:bonjour, je voudrais un kilo de tomates',
      difficulty: 'production',
      accepted: ['kilo'],
      en: 'Hello, I would like a kilo of tomatoes',
      options: null,
      sentence: 'Bonjour, je voudrais un ___ de tomates',
    },
    reference: 'Bonjour, je voudrais un kilo de tomates',
    referenceEn: 'Hello, I would like a kilo of tomatoes',
  },
  // Tomates is feminine, so the pronoun is elles. The ils tile is the
  // anglophone reflex of reaching for the default masculine.
  {
    kind: 'tap-translate',
    id: 'marche-tt-combien-tomates',
    phraseKey: 'phrase:elles sont à combien, les tomates ?',
    difficulty: 'recognition',
    accepted: [
      'elles sont à combien, les tomates',
      'les tomates, elles sont à combien',
      'elles coûtent combien, les tomates',
    ],
    en: 'How much are the tomatoes?',
    tokens: ['elles', 'sont', 'à', 'combien', 'les', 'tomates', 'ils', 'coûtent'],
  },
  {
    kind: 'listen-type',
    id: 'marche-lt-combien-tomates',
    phraseKey: 'phrase:elles sont à combien, les tomates ?',
    difficulty: 'production',
    accepted: ['Elles sont à combien, les tomates ?'],
    fr: 'Elles sont à combien, les tomates ?',
  },
  // The tomatoes are named in the line itself, so the gender and the
  // number are both on screen and the choice is winnable. The three
  // distractors are the three real ways to get this wrong: masculine
  // plural, feminine singular, masculine singular.
  {
    kind: 'fill-blank',
    id: 'marche-fb-celles-la',
    phraseKey: "phrase:celles-là, s'il vous plaît",
    difficulty: 'recognition',
    accepted: ['Celles-là'],
    en: 'The tomatoes? Those ones, please',
    options: ['Celles-là', 'Ceux-là', 'Celle-là', 'Celui-là'],
    sentence: "Les tomates ? ___, s'il vous plaît",
  },
  {
    kind: 'repeat-this',
    id: 'marche-rt-celles-la',
    phraseKey: "phrase:celles-là, s'il vous plaît",
    difficulty: 'production',
    ipa: 'sɛl la sil vu plɛ',
    noMicTwin: {
      kind: 'tap-translate',
      id: 'marche-rt-celles-la-silent',
      phraseKey: "phrase:celles-là, s'il vous plaît",
      difficulty: 'recognition',
      accepted: ["celles-là s'il vous plaît", 'celles-là, merci'],
      en: 'Those ones, please',
      tokens: ['celles-là', "s'il", 'vous', 'plaît', 'ceux-là', 'celle-là', 'merci'],
    },
    reference: "Celles-là, s'il vous plaît",
    referenceEn: 'Those ones, please',
  },
  {
    kind: 'best-sentence',
    id: 'marche-bs-ce-soir',
    phraseKey: "phrase:c'est pour ce soir",
    difficulty: 'recognition',
    candidates: [
      {
        en: 'It is for tonight',
        fr: "C'est pour ce soir",
      },
      {
        en: 'It is for this morning',
        fr: "C'est pour ce matin",
      },
      {
        en: 'It is for the week',
        fr: "C'est pour la semaine",
      },
    ],
    correctIndex: 0,
    prompt: 'You are cooking the tomatoes tonight, and Corinne asks when they are for.',
  },
  {
    kind: 'listen-type',
    id: 'marche-lt-ce-soir',
    phraseKey: "phrase:c'est pour ce soir",
    difficulty: 'production',
    accepted: ["C'est pour ce soir"],
    fr: "C'est pour ce soir",
  },
  // The third option is the stallholder's own line, handed back to her.
  // It carries combien and sounds like it belongs, which is exactly why
  // it is the one worth offering.
  {
    kind: 'appropriate-reply',
    id: 'marche-ar-ca-fait-combien',
    phraseKey: 'phrase:ça fait combien ?',
    difficulty: 'recognition',
    acceptableIndexes: [
      0,
      1,
    ],
    line: {
      en: 'And there you go, a kilo of tomatoes.',
      fr: 'Et voilà, un kilo de tomates.',
      speaker: 'Corinne',
    },
    options: [
      {
        en: 'How much is that?',
        fr: 'Ça fait combien ?',
      },
      {
        en: 'How much is it?',
        fr: "C'est combien ?",
      },
      {
        en: 'How many would you like?',
        fr: 'Vous en voulez combien ?',
      },
    ],
  },
  {
    kind: 'fill-blank',
    id: 'marche-fb-ca-fait-combien',
    phraseKey: 'phrase:ça fait combien ?',
    difficulty: 'production',
    accepted: ['combien'],
    en: 'How much is that?',
    options: null,
    sentence: 'Ça fait ___ ?',
  },
  // Bonjour on the way out is the giveaway that marks a visitor, and it
  // is the reflex of a learner who only ever practised arriving.
  {
    kind: 'appropriate-reply',
    id: 'marche-ar-bon-week-end',
    phraseKey: 'phrase:merci, bon week-end !',
    difficulty: 'recognition',
    acceptableIndexes: [
      0,
      1,
    ],
    line: {
      en: 'Thank you, see you next week!',
      fr: 'Merci à vous, à la semaine prochaine !',
      speaker: 'Corinne',
    },
    options: [
      {
        en: 'Thanks, have a good weekend!',
        fr: 'Merci, bon week-end !',
      },
      {
        en: 'Thanks, see you next week!',
        fr: 'Merci, à la semaine prochaine !',
      },
      {
        en: 'Hello!',
        fr: 'Bonjour !',
      },
    ],
  },
  // Both spellings are in daily use and a learner typing either heard it
  // right.
  {
    kind: 'fill-blank',
    id: 'marche-fb-bon-week-end',
    phraseKey: 'phrase:merci, bon week-end !',
    difficulty: 'production',
    accepted: ['week-end', 'weekend'],
    en: 'Thanks, have a good weekend!',
    options: null,
    sentence: 'Merci, bon ___ !',
  },

  // ---- demander son chemin ---------------------------------------
  // Pardon is the real alternative opener, so its tile is a second right
  // answer, not a trap. Trouve is the trap: je trouve la gare says you
  // have already found it.
  {
    kind: 'tap-translate',
    id: 'chemin-tt-cherche-la-gare',
    phraseKey: 'phrase:excusez-moi, je cherche la gare',
    difficulty: 'recognition',
    accepted: ['excusez-moi, je cherche la gare', 'pardon, je cherche la gare'],
    en: "Excuse me, I'm looking for the train station",
    tokens: ['excusez-moi', 'je', 'cherche', 'la', 'gare', 'pardon', 'trouve'],
  },
  {
    kind: 'repeat-this',
    id: 'chemin-rt-cherche-la-gare',
    phraseKey: 'phrase:excusez-moi, je cherche la gare',
    difficulty: 'production',
    ipa: 'ɛk.sky.ze mwa ʒə ʃɛʁʃ la ɡaʁ',
    noMicTwin: {
      kind: 'listen-type',
      id: 'chemin-rt-cherche-la-gare-silent',
      phraseKey: 'phrase:excusez-moi, je cherche la gare',
      difficulty: 'production',
      accepted: ['Excusez-moi, je cherche la gare'],
      fr: 'Excusez-moi, je cherche la gare',
    },
    reference: 'Excusez-moi, je cherche la gare',
    referenceEn: "Excuse me, I'm looking for the train station",
  },
  // The street asks back. Being stopped yourself is the other half of
  // this scene, and it is where this phrase earns its keep. Option two is
  // the reflex of answering a stranger with your own question, which is
  // exactly why it is on the screen.
  {
    kind: 'appropriate-reply',
    id: 'chemin-ar-pas-d-ici',
    phraseKey: "phrase:j'suis pas d'ici",
    difficulty: 'recognition',
    acceptableIndexes: [
      0,
      1,
    ],
    line: {
      en: 'Sorry, do you know where the post office is?',
      fr: 'Pardon, vous savez où est la poste ?',
      speaker: 'Un passant',
    },
    options: [
      {
        en: "I'm not from around here",
        fr: "J'suis pas d'ici",
      },
      {
        en: 'Sorry, I have no idea',
        fr: "Désolé, j'sais pas du tout",
      },
      {
        en: "Yes, I'm looking for the train station",
        fr: 'Oui, je cherche la gare',
      },
    ],
  },
  // J'suis is the spoken contraction, written the way it is said. The
  // blank sits on the subject because that is the lesson, and the fuller
  // written forms are right too: nobody who typed je ne suis was
  // mistaken.
  {
    kind: 'fill-blank',
    id: 'chemin-fb-pas-d-ici-typed',
    phraseKey: "phrase:j'suis pas d'ici",
    difficulty: 'production',
    accepted: ["J'suis", 'Je suis', 'Je ne suis'],
    en: "I'm not from around here",
    options: null,
    sentence: "___ pas d'ici",
  },
  // Both distractors are understood perfectly and both cost you the rest
  // of the conversation: one barks, the other closes the door.
  {
    kind: 'best-sentence',
    id: 'chemin-bs-plus-lentement',
    phraseKey: "phrase:plus lentement, s'il vous plaît",
    difficulty: 'recognition',
    candidates: [
      {
        en: 'More slowly, please',
        fr: "Plus lentement, s'il vous plaît",
      },
      {
        en: 'Say it again!',
        fr: 'Répétez !',
      },
      {
        en: 'I do not speak French',
        fr: 'Je parle pas français',
      },
    ],
    correctIndex: 0,
    prompt: 'A passerby answers you fast and you catch almost none of it.',
  },
  {
    kind: 'listen-type',
    id: 'chemin-lt-plus-lentement',
    phraseKey: "phrase:plus lentement, s'il vous plaît",
    difficulty: 'production',
    accepted: ["Plus lentement, s'il vous plaît"],
    fr: "Plus lentement, s'il vous plaît",
  },
  // A real passerby leaves the turn unnamed and expects you to follow.
  // Tout droit and à droite blur into one another early, and option three
  // is what that confusion sounds like out loud: it accepts a direction
  // that was never given.
  {
    kind: 'appropriate-reply',
    id: 'chemin-ar-gauche-ou-droite',
    phraseKey: "phrase:c'est à gauche ou à droite ?",
    difficulty: 'recognition',
    acceptableIndexes: [
      0,
      1,
    ],
    line: {
      en: 'You go as far as the traffic light and you turn.',
      fr: "Vous allez jusqu'au feu et vous tournez.",
      speaker: 'Une passante',
    },
    options: [
      {
        en: 'Is it left or right?',
        fr: "C'est à gauche ou à droite ?",
      },
      {
        en: 'Which way do I turn?',
        fr: 'Je tourne de quel côté ?',
      },
      {
        en: 'Okay, straight on to the train station',
        fr: "D'accord, tout droit jusqu'à la gare",
      },
    ],
  },
  {
    kind: 'fill-blank',
    id: 'chemin-fb-gauche-ou-droite-typed',
    phraseKey: "phrase:c'est à gauche ou à droite ?",
    difficulty: 'production',
    accepted: ['droite'],
    en: 'Is it left or right?',
    options: null,
    sentence: "C'est à gauche ou à ___ ?",
  },
  // The direction is complete this time, so the right reply is the one
  // that shows it landed. Asking which side would say it did not, which
  // is why the mission's own phrase is the distractor here.
  {
    kind: 'appropriate-reply',
    id: 'chemin-ar-je-vois',
    phraseKey: "phrase:d'accord, je vois",
    difficulty: 'recognition',
    acceptableIndexes: [
      0,
      1,
    ],
    line: {
      en: 'It is simple, you take the first left and the train station is right in front of you.',
      fr: "C'est simple, vous prenez la première à gauche et la gare est juste en face.",
      speaker: 'Un passant',
    },
    options: [
      {
        en: 'Okay, I see',
        fr: "D'accord, je vois",
      },
      {
        en: 'Okay, thank you very much',
        fr: "D'accord, merci beaucoup",
      },
      {
        en: 'Is it left or right?',
        fr: "C'est à gauche ou à droite ?",
      },
    ],
  },
  {
    kind: 'listen-type',
    id: 'chemin-lt-daccord-je-vois',
    phraseKey: "phrase:d'accord, je vois",
    difficulty: 'production',
    accepted: ["D'accord, je vois"],
    fr: "D'accord, je vois",
  },
  // All three are questions a lost traveller might genuinely ask, and all
  // three sound alike at speed. Loin is the one about distance.
  {
    kind: 'fill-blank',
    id: 'chemin-fb-c-est-loin',
    phraseKey: "phrase:c'est loin ?",
    difficulty: 'recognition',
    accepted: ['loin'],
    en: 'Is it far?',
    options: ['loin', 'long', 'lourd'],
    sentence: "C'est ___ ?",
  },
  // Two words, no question word, all the work done by the voice going up.
  // Worth a spoken slot for that reason alone.
  {
    kind: 'repeat-this',
    id: 'chemin-rt-c-est-loin',
    phraseKey: "phrase:c'est loin ?",
    difficulty: 'production',
    ipa: 'sɛ lwɛ̃',
    noMicTwin: {
      kind: 'fill-blank',
      id: 'chemin-rt-c-est-loin-silent',
      phraseKey: "phrase:c'est loin ?",
      difficulty: 'production',
      accepted: ['loin'],
      en: 'Is it far?',
      options: null,
      sentence: "C'est ___ ?",
    },
    reference: "C'est loin ?",
    referenceEn: 'Is it far?',
  },

  // ---- ta journée ------------------------------------------------
  // Two honest answers to the same question, and one trap: ça marche is
  // the everyday yes of agreement, close enough in sound and shape to
  // tempt, and it answers nothing about a day.
  {
    kind: 'appropriate-reply',
    id: 'journee-ca-a-ete-reply',
    phraseKey: 'phrase:ça a été',
    difficulty: 'recognition',
    acceptableIndexes: [
      0,
      1,
    ],
    line: {
      en: 'So, how was your day?',
      fr: 'Alors, ta journée ?',
      speaker: 'Chloé',
    },
    options: [
      {
        en: 'It was alright',
        fr: 'Ça a été',
      },
      {
        en: 'Same as always',
        fr: "Comme d'hab",
      },
      {
        en: 'Works for me',
        fr: 'Ça marche',
      },
    ],
  },
  {
    kind: 'listen-type',
    id: 'journee-ca-a-ete-listen',
    phraseKey: 'phrase:ça a été',
    difficulty: 'production',
    accepted: ['Ça a été'],
    fr: 'Ça a été',
  },
  // D'hab is the clipped form friends use; d'habitude is the same phrase
  // written out, and comme toujours is what another French speaker would
  // say in the same breath. All three are right. Hier and jamais are real
  // French that answers a different question.
  {
    kind: 'tap-translate',
    id: 'journee-comme-dhab-tap',
    phraseKey: "phrase:comme d'hab",
    difficulty: 'recognition',
    accepted: ["comme d'hab", "comme d'habitude", 'comme toujours'],
    en: 'Same as always',
    tokens: ['comme', "d'hab", "d'habitude", 'toujours', 'hier', 'jamais'],
  },
  {
    kind: 'repeat-this',
    id: 'journee-comme-dhab-speak',
    phraseKey: "phrase:comme d'hab",
    difficulty: 'production',
    ipa: 'kɔm dab',
    noMicTwin: {
      kind: 'fill-blank',
      id: 'journee-comme-dhab-silent',
      phraseKey: "phrase:comme d'hab",
      difficulty: 'production',
      accepted: ["d'hab", "d'habitude"],
      en: 'Same as always',
      options: null,
      sentence: 'Comme ___',
    },
    reference: "Comme d'hab",
    referenceEn: 'Same as always',
  },
  // Both distractors are one small word away from the answer and both
  // mean something a friend would react to differently, which is the
  // point.
  {
    kind: 'best-sentence',
    id: 'journee-jai-pas-arrete-best',
    phraseKey: "phrase:j'ai pas arrêté",
    difficulty: 'recognition',
    candidates: [
      {
        en: "I didn't stop all day",
        fr: "J'ai pas arrêté",
      },
      {
        en: "I didn't get started",
        fr: "J'ai pas commencé",
      },
      {
        en: 'I dropped everything',
        fr: "J'ai tout arrêté",
      },
    ],
    correctIndex: 0,
    prompt: 'A friend asks how your day went. It ran flat out from morning to night.',
  },
  // The ne drops in speech and stays in writing. A learner who wrote it
  // back in heard the sentence.
  {
    kind: 'listen-type',
    id: 'journee-jai-pas-arrete-listen',
    phraseKey: "phrase:j'ai pas arrêté",
    difficulty: 'production',
    accepted: ["J'ai pas arrêté", "Je n'ai pas arrêté"],
    fr: "J'ai pas arrêté",
  },
  // Ton is the wrong gender, vous the wrong register with a friend, and
  // jour the wrong noun: a jour is a date on a calendar, a journée is a
  // day lived through. Three ways to be nearly right.
  {
    kind: 'tap-translate',
    id: 'journee-et-toi-tap',
    phraseKey: 'phrase:et toi, ta journée ?',
    difficulty: 'recognition',
    accepted: ['et toi, ta journée', 'et ta journée'],
    en: 'And you, how was yours?',
    tokens: ['et', 'toi', 'ta', 'journée', 'ton', 'vous', 'jour'],
  },
  {
    kind: 'repeat-this',
    id: 'journee-et-toi-speak',
    phraseKey: 'phrase:et toi, ta journée ?',
    difficulty: 'production',
    ipa: 'e twa ta ʒuʁ.ne',
    noMicTwin: {
      kind: 'listen-type',
      id: 'journee-et-toi-silent',
      phraseKey: 'phrase:et toi, ta journée ?',
      difficulty: 'production',
      accepted: ['Et toi, ta journée ?'],
      fr: 'Et toi, ta journée ?',
    },
    reference: 'Et toi, ta journée ?',
    referenceEn: 'And you, how was yours?',
  },
  // Good news, so tant mieux and génial both land. Ah mince is the same
  // length, the same shape and the opposite move, and it is here because
  // reaching for it on good news is the mistake that stings.
  {
    kind: 'appropriate-reply',
    id: 'journee-tant-mieux-reply',
    phraseKey: 'phrase:tant mieux',
    difficulty: 'recognition',
    acceptableIndexes: [
      0,
      2,
    ],
    line: {
      en: 'I got my raise!',
      fr: "J'ai eu mon augmentation !",
      speaker: 'Chloé',
    },
    options: [
      {
        en: 'Glad to hear it!',
        fr: 'Tant mieux !',
      },
      {
        en: 'Oh no',
        fr: 'Ah mince',
      },
      {
        en: 'Awesome!',
        fr: 'Génial !',
      },
      {
        en: 'Same as always',
        fr: "Comme d'hab",
      },
    ],
  },
  // Tant pis sits one word away and means the reverse, so the blank
  // carries the whole phrase even though it is one word long.
  {
    kind: 'fill-blank',
    id: 'journee-tant-mieux-typed',
    phraseKey: 'phrase:tant mieux',
    difficulty: 'production',
    accepted: ['mieux'],
    en: 'Glad to hear it',
    options: null,
    sentence: 'Tant ___',
  },
  // The mirror of the tant mieux card, on a line that went the other way.
  // Zut is the same move as mince, so both are right; tant mieux on rough
  // news reads as gloating, and ça a été answers a question nobody asked.
  {
    kind: 'appropriate-reply',
    id: 'journee-ah-mince-reply',
    phraseKey: 'phrase:ah mince',
    difficulty: 'recognition',
    acceptableIndexes: [
      0,
      2,
    ],
    line: {
      en: 'I missed my train',
      fr: "J'ai raté mon train",
      speaker: 'Chloé',
    },
    options: [
      {
        en: 'Oh no',
        fr: 'Ah mince',
      },
      {
        en: 'Glad to hear it!',
        fr: 'Tant mieux !',
      },
      {
        en: 'Oh shoot',
        fr: 'Ah zut',
      },
      {
        en: 'It was alright',
        fr: 'Ça a été',
      },
    ],
  },
  {
    kind: 'listen-type',
    id: 'journee-ah-mince-listen',
    phraseKey: 'phrase:ah mince',
    difficulty: 'production',
    accepted: ['Ah mince'],
    fr: 'Ah mince',
  },

  // ---- une table pour ce soir ------------------------------------
  // Bonsoir is the trap: at five in the afternoon it is still bonjour. Je
  // veux manger is understood and lands as a demand at somebody's door.
  {
    kind: 'best-sentence',
    id: 'restaurant-bs-table',
    phraseKey: 'phrase:bonjour, vous avez une table pour deux ce soir ?',
    difficulty: 'recognition',
    prompt: 'It is the middle of the afternoon. You stop at a bistro door to book dinner for you and a friend.',
    candidates: [
      { fr: 'Bonjour, vous avez une table pour deux ce soir ?', en: 'Hello, do you have a table for two tonight?' },
      { fr: 'Bonsoir, je veux manger ce soir', en: 'Good evening, I want to eat tonight' },
      { fr: 'Une table pour deux, vite', en: 'A table for two, quickly' },
    ],
    correctIndex: 0,
  },
  {
    kind: 'repeat-this',
    id: 'restaurant-rt-table',
    phraseKey: 'phrase:bonjour, vous avez une table pour deux ce soir ?',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'restaurant-rt-table-silent',
      phraseKey: 'phrase:bonjour, vous avez une table pour deux ce soir ?',
      difficulty: 'production',
      accepted: ['Bonjour, vous avez une table pour deux ce soir ?'],
      fr: 'Bonjour, vous avez une table pour deux ce soir ?',
    },
    reference: 'Bonjour, vous avez une table pour deux ce soir ?',
    referenceEn: 'Hello, do you have a table for two tonight?',
  },
  // Vingt heures and huit heures are the same evening, one said the way the
  // timetable says it and one the way people often do, so both land. The
  // other two answer a question she has not asked yet.
  {
    kind: 'appropriate-reply',
    id: 'restaurant-ar-vingt-heures',
    phraseKey: "phrase:vers vingt heures, c'est possible ?",
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Hélène', fr: 'Très bien. Vers quelle heure ?', en: 'Very good. Around what time?' },
    options: [
      { fr: "Vers vingt heures, c'est possible ?", en: 'Around eight, is that possible?' },
      { fr: 'Vers huit heures du soir', en: 'Around eight in the evening' },
      { fr: 'Pour deux personnes', en: 'For two people' },
      { fr: 'Au nom de Martin', en: 'Under the name Martin' },
    ],
  },
  {
    kind: 'fill-blank',
    id: 'restaurant-fb-vingt-heures-typed',
    phraseKey: "phrase:vers vingt heures, c'est possible ?",
    difficulty: 'production',
    accepted: ['vingt'],
    en: 'Around eight in the evening, is that possible?',
    options: null,
    sentence: "Vers ___ heures, c'est possible ?",
  },
  // Three words that start the same way. Only one of them is somewhere to sit.
  {
    kind: 'fill-blank',
    id: 'restaurant-fb-terrasse',
    phraseKey: "phrase:en terrasse, si c'est possible",
    difficulty: 'recognition',
    sentence: "En ___, si c'est possible",
    options: ['terrasse', 'terrain', 'tasse'],
    accepted: ['terrasse'],
    en: 'Outside on the terrace, if possible',
  },
  {
    kind: 'repeat-this',
    id: 'restaurant-rt-terrasse',
    phraseKey: "phrase:en terrasse, si c'est possible",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'restaurant-rt-terrasse-silent',
      phraseKey: "phrase:en terrasse, si c'est possible",
      difficulty: 'production',
      accepted: ["En terrasse, si c'est possible"],
      fr: "En terrasse, si c'est possible",
    },
    reference: "En terrasse, si c'est possible",
    referenceEn: 'Outside on the terrace, if possible',
  },
  // Demain and matin are the tiles a learner reaches for when à ce soir has
  // not settled yet. Bonsoir is a greeting, not a goodbye.
  {
    kind: 'tap-translate',
    id: 'restaurant-tt-a-ce-soir',
    phraseKey: 'phrase:à ce soir, alors',
    difficulty: 'recognition',
    en: 'See you tonight, then',
    tokens: ['à', 'ce', 'soir', 'alors', 'demain', 'matin', 'bonsoir'],
    accepted: ['à ce soir, alors', 'alors, à ce soir'],
  },
  {
    kind: 'listen-type',
    id: 'restaurant-lt-a-ce-soir',
    phraseKey: 'phrase:à ce soir, alors',
    difficulty: 'production',
    fr: 'À ce soir, alors',
    accepted: ['À ce soir, alors'],
  },

  // ---- à la pharmacie --------------------------------------------
  // Gare and gauche sound close enough to gorge to catch an ear that is
  // still sorting out French vowels.
  {
    kind: 'fill-blank',
    id: 'pharmacie-fb-gorge',
    phraseKey: "phrase:bonjour, j'ai mal à la gorge",
    difficulty: 'recognition',
    sentence: "Bonjour, j'ai mal à la ___",
    options: ['gorge', 'gare', 'gauche'],
    accepted: ['gorge'],
    en: 'Hello, I have a sore throat',
  },
  {
    kind: 'repeat-this',
    id: 'pharmacie-rt-gorge',
    phraseKey: "phrase:bonjour, j'ai mal à la gorge",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'pharmacie-rt-gorge-silent',
      phraseKey: "phrase:bonjour, j'ai mal à la gorge",
      difficulty: 'production',
      accepted: ["Bonjour, j'ai mal à la gorge"],
      fr: "Bonjour, j'ai mal à la gorge",
    },
    reference: "Bonjour, j'ai mal à la gorge",
    referenceEn: 'Hello, I have a sore throat',
  },
  // Any real point in time answers depuis quand. À ce soir sounds like a time
  // and is a goodbye, and the dose answers a question nobody asked yet.
  {
    kind: 'appropriate-reply',
    id: 'pharmacie-ar-depuis-hier',
    phraseKey: 'phrase:depuis hier soir',
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Thomas', fr: 'Depuis quand ?', en: 'Since when?' },
    options: [
      { fr: 'Depuis hier soir', en: 'Since last night' },
      { fr: 'Depuis ce matin', en: 'Since this morning' },
      { fr: 'À ce soir', en: 'See you tonight' },
      { fr: 'Trois fois par jour', en: 'Three times a day' },
    ],
  },
  {
    kind: 'fill-blank',
    id: 'pharmacie-fb-depuis-hier-typed',
    phraseKey: 'phrase:depuis hier soir',
    difficulty: 'production',
    accepted: ['hier'],
    en: 'Since last night',
    options: null,
    sentence: 'Depuis ___ soir',
  },
  // Heure is the trap: it turns how often into what time.
  {
    kind: 'tap-translate',
    id: 'pharmacie-tt-combien-de-fois',
    phraseKey: 'phrase:je le prends combien de fois par jour ?',
    difficulty: 'recognition',
    en: 'How many times a day do I take it?',
    tokens: ['je', 'le', 'prends', 'combien', 'de', 'fois', 'par', 'jour', 'heure', 'la'],
    accepted: ['je le prends combien de fois par jour'],
  },
  {
    kind: 'repeat-this',
    id: 'pharmacie-rt-combien-de-fois',
    phraseKey: 'phrase:je le prends combien de fois par jour ?',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'pharmacie-rt-combien-de-fois-silent',
      phraseKey: 'phrase:je le prends combien de fois par jour ?',
      difficulty: 'production',
      accepted: ['Je le prends combien de fois par jour ?'],
      fr: 'Je le prends combien de fois par jour ?',
    },
    reference: 'Je le prends combien de fois par jour ?',
    referenceEn: 'How many times a day do I take it?',
  },
  {
    kind: 'best-sentence',
    id: 'pharmacie-bs-ordonnance',
    phraseKey: 'phrase:faut une ordonnance ?',
    difficulty: 'recognition',
    prompt: 'You want to know whether you need a note from a doctor to buy this.',
    candidates: [
      { fr: 'Faut une ordonnance ?', en: 'Do I need a prescription?' },
      { fr: "C'est une ordonnance ?", en: 'Is that a prescription?' },
      { fr: 'Vous êtes médecin ?', en: 'Are you a doctor?' },
    ],
    correctIndex: 0,
  },
  // The played line drops il, as speech does. The written il faut is right too.
  {
    kind: 'listen-type',
    id: 'pharmacie-lt-ordonnance',
    phraseKey: 'phrase:faut une ordonnance ?',
    difficulty: 'production',
    fr: 'Faut une ordonnance ?',
    accepted: ['Faut une ordonnance ?', 'Il faut une ordonnance ?'],
  },

  // ---- au guichet de la gare -------------------------------------
  // Aller simple is the real alternative and the one people buy by mistake.
  {
    kind: 'best-sentence',
    id: 'gare-bs-aller-retour',
    phraseKey: "phrase:un aller-retour pour lyon, s'il vous plaît",
    difficulty: 'recognition',
    prompt: 'You are going to Lyon today and coming back at the weekend.',
    candidates: [
      { fr: "Un aller-retour pour Lyon, s'il vous plaît", en: 'A return to Lyon, please' },
      { fr: "Un aller simple pour Lyon, s'il vous plaît", en: 'A one way ticket to Lyon, please' },
      { fr: 'Je cherche la gare de Lyon', en: 'I am looking for the Lyon station' },
    ],
    correctIndex: 0,
  },
  {
    kind: 'fill-blank',
    id: 'gare-fb-aller-retour-typed',
    phraseKey: "phrase:un aller-retour pour lyon, s'il vous plaît",
    difficulty: 'production',
    accepted: ['aller-retour'],
    en: 'A return to Lyon, please',
    options: null,
    sentence: "Un ___ pour Lyon, s'il vous plaît",
  },
  // Quel is the trap tile: heure is feminine, so it needs quelle. Dernier
  // asks about a different train.
  {
    kind: 'tap-translate',
    id: 'gare-tt-prochain-train',
    phraseKey: 'phrase:le prochain train part à quelle heure ?',
    difficulty: 'recognition',
    en: 'What time does the next train leave?',
    tokens: ['le', 'prochain', 'train', 'part', 'à', 'quelle', 'heure', 'quel', 'dernier'],
    accepted: ['le prochain train part à quelle heure'],
  },
  {
    kind: 'repeat-this',
    id: 'gare-rt-prochain-train',
    phraseKey: 'phrase:le prochain train part à quelle heure ?',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'gare-rt-prochain-train-silent',
      phraseKey: 'phrase:le prochain train part à quelle heure ?',
      difficulty: 'production',
      accepted: ['Le prochain train part à quelle heure ?'],
      fr: 'Le prochain train part à quelle heure ?',
    },
    reference: 'Le prochain train part à quelle heure ?',
    referenceEn: 'What time does the next train leave?',
  },
  // Voie, voix and vue sound alike to an English ear. SNCF boards say voie.
  {
    kind: 'fill-blank',
    id: 'gare-fb-quai',
    phraseKey: "phrase:c'est quelle voie ?",
    difficulty: 'recognition',
    sentence: "C'est quelle ___ ?",
    options: ['voie', 'voix', 'vue'],
    accepted: ['voie'],
    en: 'Which platform is it?',
  },
  {
    kind: 'listen-type',
    id: 'gare-lt-quai',
    phraseKey: "phrase:c'est quelle voie ?",
    difficulty: 'production',
    fr: "C'est quelle voie ?",
    accepted: ["C'est quelle voie ?"],
  },
  // Asking whether you change is the same question from the other side, so
  // it lands too. Bonne soirée closes a conversation that has not finished.
  {
    kind: 'appropriate-reply',
    id: 'gare-ar-direct',
    phraseKey: "phrase:c'est un train direct ?",
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Julien', fr: 'Vous avez un train à onze heures quarante.', en: 'There is a train at twenty to twelve.' },
    options: [
      { fr: "C'est un train direct ?", en: 'Is it a direct train?' },
      { fr: 'Il faut changer ?', en: 'Do I have to change?' },
      { fr: 'Bonne soirée, à bientôt', en: 'Have a good evening, see you soon' },
    ],
  },
  {
    kind: 'repeat-this',
    id: 'gare-rt-direct',
    phraseKey: "phrase:c'est un train direct ?",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'gare-rt-direct-silent',
      phraseKey: "phrase:c'est un train direct ?",
      difficulty: 'production',
      accepted: ["C'est un train direct ?"],
      fr: "C'est un train direct ?",
    },
    reference: "C'est un train direct ?",
    referenceEn: 'Is it a direct train?',
  },

  // ---- au point relais -------------------------------------------
  // All three verbs make a real sentence. Only one is why you came.
  {
    kind: 'fill-blank',
    id: 'colis-fb-chercher',
    phraseKey: 'phrase:bonjour, je viens chercher un colis',
    difficulty: 'recognition',
    sentence: 'Bonjour, je viens ___ un colis',
    options: ['chercher', 'acheter', 'envoyer'],
    accepted: ['chercher'],
    en: 'Hello, I have come to pick up a parcel',
  },
  {
    kind: 'repeat-this',
    id: 'colis-rt-chercher',
    phraseKey: 'phrase:bonjour, je viens chercher un colis',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'colis-rt-chercher-silent',
      phraseKey: 'phrase:bonjour, je viens chercher un colis',
      difficulty: 'production',
      accepted: ['Bonjour, je viens chercher un colis'],
      fr: 'Bonjour, je viens chercher un colis',
    },
    reference: 'Bonjour, je viens chercher un colis',
    referenceEn: 'Hello, I have come to pick up a parcel',
  },
  // Offering to show it is as good an answer as naming it. The platform
  // question belongs to a different counter.
  {
    kind: 'appropriate-reply',
    id: 'colis-ar-code',
    phraseKey: "phrase:j'ai reçu un code par sms",
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Sandrine', fr: 'Vous avez le code ?', en: 'Do you have the code?' },
    options: [
      { fr: "J'ai reçu un code par SMS", en: 'I got a code by text message' },
      { fr: 'Oui, je vous montre', en: 'Yes, let me show you' },
      { fr: "C'est quelle voie ?", en: 'Which platform is it?' },
    ],
  },
  // Texto is what plenty of people call a text, and a learner who typed it
  // heard the meaning.
  {
    kind: 'fill-blank',
    id: 'colis-fb-code-typed',
    phraseKey: "phrase:j'ai reçu un code par sms",
    difficulty: 'production',
    accepted: ['SMS', 'texto'],
    en: 'I got a code by text message',
    options: null,
    sentence: "J'ai reçu un code par ___",
  },
  // A passport is ID too, so both assemble. Mon and carte are the gender
  // traps: pièce is feminine.
  {
    kind: 'tap-translate',
    id: 'colis-tt-piece-identite',
    phraseKey: "phrase:voilà ma pièce d'identité",
    difficulty: 'recognition',
    en: 'Here is my ID',
    tokens: ['voilà', 'ma', 'pièce', "d'identité", 'mon', 'passeport', 'carte'],
    accepted: ["voilà ma pièce d'identité", 'voilà mon passeport'],
  },
  {
    kind: 'repeat-this',
    id: 'colis-rt-piece-identite',
    phraseKey: "phrase:voilà ma pièce d'identité",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'colis-rt-piece-identite-silent',
      phraseKey: "phrase:voilà ma pièce d'identité",
      difficulty: 'production',
      accepted: ["Voilà ma pièce d'identité"],
      fr: "Voilà ma pièce d'identité",
    },
    reference: "Voilà ma pièce d'identité",
    referenceEn: 'Here is my ID',
  },
  {
    kind: 'best-sentence',
    id: 'colis-bs-bien-ca',
    phraseKey: "phrase:oui, c'est bien ça, merci",
    difficulty: 'recognition',
    prompt: 'She puts a parcel on the counter, and it has your name on it.',
    candidates: [
      { fr: "Oui, c'est bien ça, merci", en: 'Yes, that is the one, thanks' },
      { fr: "Non, c'est pas à moi", en: 'No, it is not mine' },
      { fr: 'Ça fait combien ?', en: 'How much is that?' },
    ],
    correctIndex: 0,
  },
  {
    kind: 'listen-type',
    id: 'colis-lt-bien-ca',
    phraseKey: "phrase:oui, c'est bien ça, merci",
    difficulty: 'production',
    fr: "Oui, c'est bien ça, merci",
    accepted: ["Oui, c'est bien ça, merci"],
  },

  // ---- sur le palier ---------------------------------------------
  // Salut is too close for a neighbour you have not met, and the hotel line
  // is the reflex of a learner who has only practised arriving somewhere.
  {
    kind: 'best-sentence',
    id: 'voisin-bs-emmenager',
    phraseKey: "phrase:bonjour, je viens d'emménager au troisième",
    difficulty: 'recognition',
    prompt: 'An older neighbour you have never met says hello on the stairs, by your new front door.',
    candidates: [
      { fr: "Bonjour, je viens d'emménager au troisième", en: 'Hello, I have just moved in on the third floor' },
      { fr: 'Salut, ça va ?', en: 'Hi, how are you doing?' },
      { fr: "Bonsoir, j'ai une réservation", en: 'Good evening, I have a booking' },
    ],
    correctIndex: 0,
  },
  {
    kind: 'repeat-this',
    id: 'voisin-rt-emmenager',
    phraseKey: "phrase:bonjour, je viens d'emménager au troisième",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'voisin-rt-emmenager-silent',
      phraseKey: "phrase:bonjour, je viens d'emménager au troisième",
      difficulty: 'production',
      accepted: ["Bonjour, je viens d'emménager au troisième"],
      fr: "Bonjour, je viens d'emménager au troisième",
    },
    reference: "Bonjour, je viens d'emménager au troisième",
    referenceEn: 'Hello, I have just moved in on the third floor',
  },
  // Tu and habites are the trap tiles: a first meeting with a neighbour is vous.
  {
    kind: 'tap-translate',
    id: 'voisin-tt-longtemps',
    phraseKey: 'phrase:vous habitez ici depuis longtemps ?',
    difficulty: 'recognition',
    en: 'Have you lived here long?',
    tokens: ['vous', 'habitez', 'ici', 'depuis', 'longtemps', 'tu', 'habites', 'où'],
    accepted: ['vous habitez ici depuis longtemps'],
  },
  {
    kind: 'fill-blank',
    id: 'voisin-fb-longtemps-typed',
    phraseKey: 'phrase:vous habitez ici depuis longtemps ?',
    difficulty: 'production',
    accepted: ['longtemps'],
    en: 'Have you lived here long?',
    options: null,
    sentence: 'Vous habitez ici depuis ___ ?',
  },
  // All three shops exist on most French streets. Only one sells bread.
  {
    kind: 'fill-blank',
    id: 'voisin-fb-boulangerie',
    phraseKey: 'phrase:y a une bonne boulangerie dans le coin ?',
    difficulty: 'recognition',
    sentence: 'Y a une bonne ___ dans le coin ?',
    options: ['boulangerie', 'boucherie', 'librairie'],
    accepted: ['boulangerie'],
    en: 'Is there a good bakery around here?',
  },
  // The played line says y a, as everyone does. The written il y a is right too.
  {
    kind: 'listen-type',
    id: 'voisin-lt-boulangerie',
    phraseKey: 'phrase:y a une bonne boulangerie dans le coin ?',
    difficulty: 'production',
    fr: 'Y a une bonne boulangerie dans le coin ?',
    accepted: ['Y a une bonne boulangerie dans le coin ?', 'Il y a une bonne boulangerie dans le coin ?'],
  },
  // À plus is how friends part, not how you leave a neighbour you just met.
  {
    kind: 'appropriate-reply',
    id: 'voisin-ar-bonne-soiree',
    phraseKey: 'phrase:bonne soirée, à bientôt',
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Monique', fr: 'Allez, je vous laisse vous installer.', en: 'Right, I will let you get settled in.' },
    options: [
      { fr: 'Bonne soirée, à bientôt', en: 'Have a good evening, see you soon' },
      { fr: 'Merci, bonne soirée', en: 'Thanks, have a good evening' },
      { fr: 'Salut, à plus !', en: 'Bye, see you!' },
    ],
  },
  {
    kind: 'repeat-this',
    id: 'voisin-rt-bonne-soiree',
    phraseKey: 'phrase:bonne soirée, à bientôt',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'voisin-rt-bonne-soiree-silent',
      phraseKey: 'phrase:bonne soirée, à bientôt',
      difficulty: 'production',
      accepted: ['Bonne soirée, à bientôt'],
      fr: 'Bonne soirée, à bientôt',
    },
    reference: 'Bonne soirée, à bientôt',
    referenceEn: 'Have a good evening, see you soon',
  },

  // ---- alors, ce week-end ? --------------------------------------
  // The passé composé is the point. J'ai vu is the past; je vois and je vais
  // voir are the present and the future, said on a Monday about a Saturday.
  {
    kind: 'best-sentence',
    id: 'week-end-bs-vu-des-amis',
    phraseKey: "phrase:samedi, j'ai vu des amis",
    difficulty: 'recognition',
    prompt: 'It is Monday. A colleague asks about your Saturday, which you spent with friends.',
    candidates: [
      { fr: "Samedi, j'ai vu des amis", en: 'On Saturday I saw some friends' },
      { fr: 'Samedi, je vois des amis', en: 'On Saturday I see some friends' },
      { fr: 'Samedi, je vais voir des amis', en: 'On Saturday I am going to see some friends' },
    ],
    correctIndex: 0,
  },
  {
    kind: 'fill-blank',
    id: 'week-end-fb-vu-typed',
    phraseKey: "phrase:samedi, j'ai vu des amis",
    difficulty: 'production',
    accepted: ['vu'],
    en: 'On Saturday I saw some friends',
    options: null,
    sentence: "Samedi, j'ai ___ des amis",
  },
  // Mangé and manger sound alike, and mangeons is the present a learner
  // reaches for. Only the past participle fits after on a.
  {
    kind: 'fill-blank',
    id: 'week-end-fb-mange',
    phraseKey: "phrase:on a mangé au resto, c'était top",
    difficulty: 'recognition',
    sentence: "On a ___ au resto, c'était top",
    options: ['mangé', 'manger', 'mangeons'],
    accepted: ['mangé'],
    en: 'We ate out, it was great',
  },
  {
    kind: 'repeat-this',
    id: 'week-end-rt-resto',
    phraseKey: "phrase:on a mangé au resto, c'était top",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'week-end-rt-resto-silent',
      phraseKey: "phrase:on a mangé au resto, c'était top",
      difficulty: 'production',
      accepted: ["On a mangé au resto, c'était top", "On a mangé au restaurant, c'était top"],
      fr: "On a mangé au resto, c'était top",
    },
    reference: "On a mangé au resto, c'était top",
    referenceEn: 'We ate out, it was great',
  },
  // Vous is the trap tile: a colleague by the machine is tu.
  {
    kind: 'tap-translate',
    id: 'week-end-tt-et-toi',
    phraseKey: "phrase:et toi, t'as fait quoi ?",
    difficulty: 'recognition',
    en: 'And you, what did you do?',
    tokens: ['et', 'toi', "t'as", 'fait', 'quoi', 'vous', 'avez'],
    accepted: ["et toi, t'as fait quoi", 'et toi, tu as fait quoi'],
  },
  // The played line squeezes tu as into t'as, as speech does. The written
  // form is right too.
  {
    kind: 'listen-type',
    id: 'week-end-lt-et-toi',
    phraseKey: "phrase:et toi, t'as fait quoi ?",
    difficulty: 'production',
    fr: "Et toi, t'as fait quoi ?",
    accepted: ["Et toi, t'as fait quoi ?", 'Et toi, tu as fait quoi ?'],
  },
  // Any easy way of heading back lands. The other two would end a different
  // conversation.
  {
    kind: 'appropriate-reply',
    id: 'week-end-ar-retourne',
    phraseKey: "phrase:bon, j'y retourne",
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Lucas', fr: 'Allez, la réunion commence dans cinq minutes.', en: 'Right, the meeting starts in five minutes.' },
    options: [
      { fr: "Bon, j'y retourne", en: 'Right, back to it' },
      { fr: 'Allez, à tout à l’heure', en: 'Right, see you later' },
      { fr: 'Bonne nuit', en: 'Good night' },
      { fr: 'Enchanté', en: 'Nice to meet you' },
    ],
  },
  {
    kind: 'repeat-this',
    id: 'week-end-rt-retourne',
    phraseKey: "phrase:bon, j'y retourne",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'week-end-rt-retourne-silent',
      phraseKey: "phrase:bon, j'y retourne",
      difficulty: 'production',
      accepted: ["Bon, j'y retourne"],
      fr: "Bon, j'y retourne",
    },
    reference: "Bon, j'y retourne",
    referenceEn: 'Right, back to it',
  },

  // ---- le premier jour -------------------------------------------
  // Aujourd'hui is the one that fits a first morning. Demain is a day too
  // early, and hier says you have already been here.
  {
    kind: 'fill-blank',
    id: 'collegues-fb-aujourdhui',
    phraseKey: "phrase:bonjour, je commence aujourd'hui dans l'équipe",
    difficulty: 'recognition',
    sentence: "Bonjour, je commence ___ dans l'équipe",
    options: ["aujourd'hui", 'demain', 'hier'],
    accepted: ["aujourd'hui"],
    en: 'Hello, I start in the team today',
  },
  {
    kind: 'repeat-this',
    id: 'collegues-rt-commence',
    phraseKey: "phrase:bonjour, je commence aujourd'hui dans l'équipe",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'collegues-rt-commence-silent',
      phraseKey: "phrase:bonjour, je commence aujourd'hui dans l'équipe",
      difficulty: 'production',
      accepted: ["Bonjour, je commence aujourd'hui dans l'équipe"],
      fr: "Bonjour, je commence aujourd'hui dans l'équipe",
    },
    reference: "Bonjour, je commence aujourd'hui dans l'équipe",
    referenceEn: 'Hello, I start in the team today',
  },
  // The imparfait is how French says used to. The passé composé version
  // sounds like one single day at a bank.
  {
    kind: 'best-sentence',
    id: 'collegues-bs-travaillais',
    phraseKey: 'phrase:avant, je travaillais dans une banque',
    difficulty: 'recognition',
    prompt: 'Your new manager asks what you did before. For years, you worked in a bank.',
    candidates: [
      { fr: 'Avant, je travaillais dans une banque', en: 'Before, I used to work in a bank' },
      { fr: "Avant, j'ai travaillé une banque", en: 'Before, I worked a bank' },
      { fr: 'Après, je travaille dans une banque', en: 'Afterwards, I work in a bank' },
    ],
    correctIndex: 0,
  },
  {
    kind: 'fill-blank',
    id: 'collegues-fb-travaillais-typed',
    phraseKey: 'phrase:avant, je travaillais dans une banque',
    difficulty: 'production',
    accepted: ['travaillais'],
    en: 'Before, I used to work in a bank',
    options: null,
    sentence: 'Avant, je ___ dans une banque',
  },
  // She has offered tu. Saying yes is the warm answer, and either way of
  // saying it lands. Carrying on with vous is not wrong, only colder.
  {
    kind: 'appropriate-reply',
    id: 'collegues-ar-tutoie',
    phraseKey: "phrase:d'accord, on se tutoie",
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Isabelle', fr: 'On peut se tutoyer, si vous voulez.', en: 'We can say tu to each other, if you like.' },
    options: [
      { fr: "D'accord, on se tutoie", en: 'Sure, let us say tu to each other' },
      { fr: 'Oui, avec plaisir', en: 'Yes, with pleasure' },
      { fr: 'Je vous remercie, madame', en: 'Thank you, madam' },
      { fr: 'Vous êtes très gentille', en: 'You are very kind' },
    ],
  },
  {
    kind: 'listen-type',
    id: 'collegues-lt-tutoie',
    phraseKey: "phrase:d'accord, on se tutoie",
    difficulty: 'production',
    fr: "D'accord, on se tutoie",
    accepted: ["D'accord, on se tutoie"],
  },
  // Vous and pouvez are the trap tiles: tu has just been agreed.
  {
    kind: 'tap-translate',
    id: 'collegues-tt-cantine',
    phraseKey: 'phrase:tu peux me montrer la cantine ?',
    difficulty: 'recognition',
    en: 'Can you show me the canteen?',
    tokens: ['tu', 'peux', 'me', 'montrer', 'la', 'cantine', 'vous', 'pouvez'],
    accepted: ['tu peux me montrer la cantine'],
  },
  {
    kind: 'repeat-this',
    id: 'collegues-rt-cantine',
    phraseKey: 'phrase:tu peux me montrer la cantine ?',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'collegues-rt-cantine-silent',
      phraseKey: 'phrase:tu peux me montrer la cantine ?',
      difficulty: 'production',
      accepted: ['Tu peux me montrer la cantine ?'],
      fr: 'Tu peux me montrer la cantine ?',
    },
    reference: 'Tu peux me montrer la cantine ?',
    referenceEn: 'Can you show me the canteen?',
  },

  // ---- prendre rendez-vous ---------------------------------------
  // Prendre is the verb French uses for an appointment. Faire and donner
  // are what an English speaker reaches for.
  {
    kind: 'fill-blank',
    id: 'telephone-fb-prendre',
    phraseKey: 'phrase:bonjour, je voudrais prendre rendez-vous',
    difficulty: 'recognition',
    sentence: 'Bonjour, je voudrais ___ rendez-vous',
    options: ['prendre', 'faire', 'donner'],
    accepted: ['prendre'],
    en: 'Hello, I would like to make an appointment',
  },
  {
    kind: 'repeat-this',
    id: 'telephone-rt-rendez-vous',
    phraseKey: 'phrase:bonjour, je voudrais prendre rendez-vous',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'telephone-rt-rendez-vous-silent',
      phraseKey: 'phrase:bonjour, je voudrais prendre rendez-vous',
      difficulty: 'production',
      accepted: ['Bonjour, je voudrais prendre rendez-vous', 'Bonjour, je voudrais prendre un rendez-vous'],
      fr: 'Bonjour, je voudrais prendre rendez-vous',
    },
    reference: 'Bonjour, je voudrais prendre rendez-vous',
    referenceEn: 'Hello, I would like to make an appointment',
  },
  // On the phone, saying you missed it is the move. Pretending to follow is
  // how the wrong day gets booked.
  {
    kind: 'best-sentence',
    id: 'telephone-bs-pas-entendu',
    phraseKey: "phrase:pardon, j'ai pas bien entendu",
    difficulty: 'recognition',
    prompt: 'The secretary said a day, but the line crackled and you missed it.',
    candidates: [
      { fr: "Pardon, j'ai pas bien entendu", en: 'Sorry, I did not quite catch that' },
      { fr: 'Oui, très bien, merci', en: 'Yes, very good, thank you' },
      { fr: 'Pardon, je ne comprends pas le français', en: 'Sorry, I do not understand French' },
    ],
    correctIndex: 0,
  },
  // The played line drops ne, as speech does. The written form is right too.
  {
    kind: 'listen-type',
    id: 'telephone-lt-pas-entendu',
    phraseKey: "phrase:pardon, j'ai pas bien entendu",
    difficulty: 'production',
    fr: "Pardon, j'ai pas bien entendu",
    accepted: ["Pardon, j'ai pas bien entendu", "Pardon, je n'ai pas bien entendu"],
  },
  // Plus tôt asks for something sooner; plus tard is the opposite request.
  {
    kind: 'appropriate-reply',
    id: 'telephone-ar-plus-tot',
    phraseKey: 'phrase:vous auriez quelque chose plus tôt ?',
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Nathalie', fr: 'Le premier créneau, c’est mardi prochain.', en: 'The first slot is next Tuesday.' },
    options: [
      { fr: 'Vous auriez quelque chose plus tôt ?', en: 'Would you have anything earlier?' },
      { fr: 'Il y a quelque chose avant ?', en: 'Is there anything before that?' },
      { fr: 'Vous auriez quelque chose plus tard ?', en: 'Would you have anything later?' },
      { fr: 'Je vous l’épelle', en: 'I will spell it for you' },
    ],
  },
  {
    kind: 'repeat-this',
    id: 'telephone-rt-plus-tot',
    phraseKey: 'phrase:vous auriez quelque chose plus tôt ?',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'telephone-rt-plus-tot-silent',
      phraseKey: 'phrase:vous auriez quelque chose plus tôt ?',
      difficulty: 'production',
      accepted: ['Vous auriez quelque chose plus tôt ?', 'Vous avez quelque chose plus tôt ?'],
      fr: 'Vous auriez quelque chose plus tôt ?',
    },
    reference: 'Vous auriez quelque chose plus tôt ?',
    referenceEn: 'Would you have anything earlier?',
  },
  // Appelle is the trap: it gives your name, it does not spell it.
  {
    kind: 'tap-translate',
    id: 'telephone-tt-epelle',
    phraseKey: "phrase:je vous l'épelle",
    difficulty: 'recognition',
    en: 'I will spell it for you',
    tokens: ['je', 'vous', "l'épelle", "l'appelle", 'le'],
    accepted: ["je vous l'épelle"],
  },
  {
    kind: 'repeat-this',
    id: 'telephone-rt-epelle',
    phraseKey: "phrase:je vous l'épelle",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'telephone-rt-epelle-silent',
      phraseKey: "phrase:je vous l'épelle",
      difficulty: 'production',
      accepted: ["Je vous l'épelle"],
      fr: "Je vous l'épelle",
    },
    reference: "Je vous l'épelle",
    referenceEn: 'I will spell it for you',
  },

  // ---- chez le médecin -------------------------------------------
  // Tousse and tousser and toux sound close. Only the conjugated verb fits.
  {
    kind: 'fill-blank',
    id: 'medecin-fb-tousse',
    phraseKey: 'phrase:je tousse beaucoup, surtout la nuit',
    difficulty: 'recognition',
    sentence: 'Je ___ beaucoup, surtout la nuit',
    options: ['tousse', 'tousser', 'toux'],
    accepted: ['tousse'],
    en: 'I cough a lot, especially at night',
  },
  {
    kind: 'repeat-this',
    id: 'medecin-rt-tousse',
    phraseKey: 'phrase:je tousse beaucoup, surtout la nuit',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'medecin-rt-tousse-silent',
      phraseKey: 'phrase:je tousse beaucoup, surtout la nuit',
      difficulty: 'production',
      accepted: ['Je tousse beaucoup, surtout la nuit'],
      fr: 'Je tousse beaucoup, surtout la nuit',
    },
    reference: 'Je tousse beaucoup, surtout la nuit',
    referenceEn: 'I cough a lot, especially at night',
  },
  // Any real stretch of time answers depuis quand. Prochaine points forward,
  // and the dose answers a question she has not asked.
  {
    kind: 'appropriate-reply',
    id: 'medecin-ar-semaine-derniere',
    phraseKey: 'phrase:depuis la semaine dernière',
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Dr Benali', fr: 'Vous toussez depuis quand ?', en: 'How long have you been coughing?' },
    options: [
      { fr: 'Depuis la semaine dernière', en: 'Since last week' },
      { fr: 'Depuis quelques jours', en: 'For a few days' },
      { fr: 'La semaine prochaine', en: 'Next week' },
      { fr: 'Trois fois par jour', en: 'Three times a day' },
    ],
  },
  {
    kind: 'fill-blank',
    id: 'medecin-fb-derniere-typed',
    phraseKey: 'phrase:depuis la semaine dernière',
    difficulty: 'production',
    accepted: ['dernière'],
    en: 'Since last week',
    options: null,
    sentence: 'Depuis la semaine ___',
  },
  {
    kind: 'best-sentence',
    id: 'medecin-bs-fievre',
    phraseKey: "phrase:non, j'ai pas de fièvre",
    difficulty: 'recognition',
    prompt: 'The doctor asks if you have a temperature. You took it this morning and it was normal.',
    candidates: [
      { fr: "Non, j'ai pas de fièvre", en: 'No, I do not have a temperature' },
      { fr: "Oui, j'ai de la fièvre", en: 'Yes, I have a temperature' },
      { fr: "Non, j'ai pas faim", en: 'No, I am not hungry' },
    ],
    correctIndex: 0,
  },
  // The played line drops ne, as speech does. The written form is right too.
  {
    kind: 'listen-type',
    id: 'medecin-lt-fievre',
    phraseKey: "phrase:non, j'ai pas de fièvre",
    difficulty: 'production',
    fr: "Non, j'ai pas de fièvre",
    accepted: ["Non, j'ai pas de fièvre", "Non, je n'ai pas de fièvre"],
  },
  // Combien de fois asks how often, which is the pharmacy question. This
  // one asks for how long.
  {
    kind: 'tap-translate',
    id: 'medecin-tt-combien-de-temps',
    phraseKey: 'phrase:je dois le prendre pendant combien de temps ?',
    difficulty: 'recognition',
    en: 'How long do I need to take it for?',
    tokens: ['je', 'dois', 'le', 'prendre', 'pendant', 'combien', 'de', 'temps', 'fois'],
    accepted: ['je dois le prendre pendant combien de temps'],
  },
  {
    kind: 'repeat-this',
    id: 'medecin-rt-combien-de-temps',
    phraseKey: 'phrase:je dois le prendre pendant combien de temps ?',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'medecin-rt-combien-de-temps-silent',
      phraseKey: 'phrase:je dois le prendre pendant combien de temps ?',
      difficulty: 'production',
      accepted: ['Je dois le prendre pendant combien de temps ?', 'Je le prends pendant combien de temps ?'],
      fr: 'Je dois le prendre pendant combien de temps ?',
    },
    reference: 'Je dois le prendre pendant combien de temps ?',
    referenceEn: 'How long do I need to take it for?',
  },

  // ---- rapporter un article --------------------------------------
  // Opening on the problem is the polite way in. Leading with what you
  // want back, or with blame, starts an argument.
  {
    kind: 'best-sentence',
    id: 'retour-bs-probleme',
    phraseKey: "phrase:bonjour, j'ai un problème avec cette bouilloire",
    difficulty: 'recognition',
    prompt: 'You are back at the shop with a kettle that stopped working. The assistant greets you.',
    candidates: [
      { fr: "Bonjour, j'ai un problème avec cette bouilloire", en: 'Hello, I have a problem with this kettle' },
      { fr: 'Votre bouilloire est nulle', en: 'Your kettle is useless' },
      { fr: 'Je veux mon argent', en: 'I want my money' },
    ],
    correctIndex: 0,
  },
  {
    kind: 'fill-blank',
    id: 'retour-fb-probleme-typed',
    phraseKey: "phrase:bonjour, j'ai un problème avec cette bouilloire",
    difficulty: 'production',
    accepted: ['problème'],
    en: 'Hello, I have a problem with this kettle',
    options: null,
    sentence: "Bonjour, j'ai un ___ avec cette bouilloire",
  },
  // Ticket is the receipt. Billet is a train ticket or a banknote.
  {
    kind: 'fill-blank',
    id: 'retour-fb-ticket',
    phraseKey: "phrase:j'ai gardé le ticket de caisse",
    difficulty: 'recognition',
    sentence: "J'ai gardé le ___ de caisse",
    options: ['ticket', 'billet', 'carnet'],
    accepted: ['ticket'],
    en: 'I kept the receipt',
  },
  {
    kind: 'repeat-this',
    id: 'retour-rt-ticket',
    phraseKey: "phrase:j'ai gardé le ticket de caisse",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'retour-rt-ticket-silent',
      phraseKey: "phrase:j'ai gardé le ticket de caisse",
      difficulty: 'production',
      accepted: ["J'ai gardé le ticket de caisse", "J'ai gardé le ticket"],
      fr: "J'ai gardé le ticket de caisse",
    },
    reference: "J'ai gardé le ticket de caisse",
    referenceEn: 'I kept the receipt',
  },
  // He offers a credit note. Asking for the refund, either way, holds your
  // ground politely. Accepting the credit note is fine, just not what you came for.
  {
    kind: 'appropriate-reply',
    id: 'retour-ar-remboursement',
    phraseKey: 'phrase:je préfère un remboursement',
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Mehdi', fr: 'Je peux vous faire un avoir, si vous voulez.', en: 'I can give you a credit note, if you like.' },
    options: [
      { fr: 'Je préfère un remboursement', en: 'I would rather have a refund' },
      { fr: "Merci, mais je voudrais un remboursement, s'il vous plaît", en: 'Thank you, but I would like a refund, please' },
      { fr: "J'ai gardé le ticket de caisse", en: 'I kept the receipt' },
      { fr: 'Bonne journée', en: 'Have a good day' },
    ],
  },
  {
    kind: 'repeat-this',
    id: 'retour-rt-remboursement',
    phraseKey: 'phrase:je préfère un remboursement',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'retour-rt-remboursement-silent',
      phraseKey: 'phrase:je préfère un remboursement',
      difficulty: 'production',
      accepted: ['Je préfère un remboursement'],
      fr: 'Je préfère un remboursement',
    },
    reference: 'Je préfère un remboursement',
    referenceEn: 'I would rather have a refund',
  },
  // Patron and directeur are words a learner reaches for. Responsable is
  // what a shop floor says.
  {
    kind: 'tap-translate',
    id: 'retour-tt-responsable',
    phraseKey: "phrase:c'est possible de voir avec un responsable ?",
    difficulty: 'recognition',
    en: 'Could you check with a manager?',
    tokens: ["c'est", 'possible', 'de', 'voir', 'avec', 'un', 'responsable', 'patron'],
    accepted: ["c'est possible de voir avec un responsable"],
  },
  {
    kind: 'listen-type',
    id: 'retour-lt-responsable',
    phraseKey: "phrase:c'est possible de voir avec un responsable ?",
    difficulty: 'production',
    fr: "C'est possible de voir avec un responsable ?",
    accepted: ["C'est possible de voir avec un responsable ?", 'Est-ce que je peux voir un responsable ?'],
  },

  // ---- visiter un appartement ------------------------------------
  // Comprises means the bills are in. Payées and chères answer a question
  // nobody asked.
  {
    kind: 'fill-blank',
    id: 'appartement-fb-comprises',
    phraseKey: "phrase:le loyer, c'est charges comprises ?",
    difficulty: 'recognition',
    sentence: "Le loyer, c'est charges ___ ?",
    options: ['comprises', 'payées', 'chères'],
    accepted: ['comprises'],
    en: 'Does the rent include the bills?',
  },
  {
    kind: 'repeat-this',
    id: 'appartement-rt-loyer',
    phraseKey: "phrase:le loyer, c'est charges comprises ?",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'appartement-rt-loyer-silent',
      phraseKey: "phrase:le loyer, c'est charges comprises ?",
      difficulty: 'production',
      accepted: ["Le loyer, c'est charges comprises ?", 'Le loyer est charges comprises ?'],
      fr: "Le loyer, c'est charges comprises ?",
    },
    reference: "Le loyer, c'est charges comprises ?",
    referenceEn: 'Does the rent include the bills?',
  },
  {
    kind: 'best-sentence',
    id: 'appartement-bs-libre',
    phraseKey: 'phrase:il est libre à partir de quand ?',
    difficulty: 'recognition',
    prompt: 'You like the flat and want to know the first day you could move in.',
    candidates: [
      { fr: 'Il est libre à partir de quand ?', en: 'When is it free from?' },
      { fr: 'Il est libre ce soir ?', en: 'Is he free tonight?' },
      { fr: 'Vous partez quand ?', en: 'When are you leaving?' },
    ],
    correctIndex: 0,
  },
  {
    kind: 'repeat-this',
    id: 'appartement-rt-libre',
    phraseKey: 'phrase:il est libre à partir de quand ?',
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'appartement-rt-libre-silent',
      phraseKey: 'phrase:il est libre à partir de quand ?',
      difficulty: 'production',
      accepted: ['Il est libre à partir de quand ?', 'Il est disponible à partir de quand ?'],
      fr: 'Il est libre à partir de quand ?',
    },
    reference: 'Il est libre à partir de quand ?',
    referenceEn: 'When is it free from?',
  },
  // Any way of asking about the paperwork lands. The other two are
  // questions for a different moment.
  {
    kind: 'appropriate-reply',
    id: 'appartement-ar-dossier',
    phraseKey: "phrase:qu'est-ce qu'il faut pour le dossier ?",
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Céline', fr: 'Si ça vous intéresse, il faut monter un dossier.', en: 'If you are interested, you need to put an application together.' },
    options: [
      { fr: "Qu'est-ce qu'il faut pour le dossier ?", en: 'What do you need for the application?' },
      { fr: 'Il faut quels papiers ?', en: 'Which papers do you need?' },
      { fr: 'Y a un ascenseur ?', en: 'Is there a lift?' },
      { fr: "C'est où, la cuisine ?", en: 'Where is the kitchen?' },
    ],
  },
  {
    kind: 'fill-blank',
    id: 'appartement-fb-dossier-typed',
    phraseKey: "phrase:qu'est-ce qu'il faut pour le dossier ?",
    difficulty: 'production',
    accepted: ['dossier'],
    en: 'What do you need for the application?',
    options: null,
    sentence: "Qu'est-ce qu'il faut pour le ___ ?",
  },
  // Gardien is a caretaker, not a guarantor.
  {
    kind: 'tap-translate',
    id: 'appartement-tt-garant',
    phraseKey: 'phrase:faut un garant ?',
    difficulty: 'recognition',
    en: 'Do I need a guarantor?',
    tokens: ['il', 'faut', 'un', 'garant', 'gardien'],
    accepted: ['faut un garant', 'il faut un garant'],
  },
  // The played line drops il, as speech does. The written il faut is right too.
  {
    kind: 'listen-type',
    id: 'appartement-lt-garant',
    phraseKey: 'phrase:faut un garant ?',
    difficulty: 'production',
    fr: 'Faut un garant ?',
    accepted: ['Faut un garant ?', 'Il faut un garant ?'],
  },

  // ---- dîner chez ses parents ------------------------------------
  // It is evening, so bonsoir. Tu is too soon with a partner's parents.
  {
    kind: 'best-sentence',
    id: 'belle-famille-bs-fleurs',
    phraseKey: "phrase:bonsoir ! tenez, c'est pour vous",
    difficulty: 'recognition',
    prompt: "It is evening. Your partner's mother opens the door, and you are holding flowers for her.",
    candidates: [
      { fr: "Bonsoir ! Tenez, c'est pour vous", en: 'Good evening! Here, this is for you' },
      { fr: "Salut ! C'est pour toi", en: 'Hi! This is for you' },
      { fr: 'Bonjour, des fleurs, voilà', en: 'Hello, flowers, there you go' },
    ],
    correctIndex: 0,
  },
  {
    kind: 'repeat-this',
    id: 'belle-famille-rt-fleurs',
    phraseKey: "phrase:bonsoir ! tenez, c'est pour vous",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'belle-famille-rt-fleurs-silent',
      phraseKey: "phrase:bonsoir ! tenez, c'est pour vous",
      difficulty: 'production',
      accepted: ["Bonsoir ! Tenez, c'est pour vous", "Bonsoir ! C'est pour vous", "Bonsoir ! C'est pour vous, des fleurs"],
      fr: "Bonsoir ! Tenez, c'est pour vous",
    },
    reference: "Bonsoir ! Tenez, c'est pour vous",
    referenceEn: 'Good evening! These are for you, some flowers',
  },
  // Délicieux is the compliment. Dégoûtant and froid say the opposite.
  {
    kind: 'fill-blank',
    id: 'belle-famille-fb-delicieux',
    phraseKey: "phrase:c'est délicieux, c'est vous qui l'avez fait ?",
    difficulty: 'recognition',
    sentence: "C'est ___, c'est vous qui l'avez fait ?",
    options: ['délicieux', 'dégoûtant', 'froid'],
    accepted: ['délicieux'],
    en: 'This is delicious, did you make it?',
  },
  {
    kind: 'repeat-this',
    id: 'belle-famille-rt-delicieux',
    phraseKey: "phrase:c'est délicieux, c'est vous qui l'avez fait ?",
    difficulty: 'production',
    ipa: null,
    noMicTwin: {
      kind: 'listen-type',
      id: 'belle-famille-rt-delicieux-silent',
      phraseKey: "phrase:c'est délicieux, c'est vous qui l'avez fait ?",
      difficulty: 'production',
      accepted: ["C'est délicieux, c'est vous qui l'avez fait ?", "C'est délicieux, vous l'avez fait vous-même ?"],
      fr: "C'est délicieux, c'est vous qui l'avez fait ?",
    },
    reference: "C'est délicieux, c'est vous qui l'avez fait ?",
    referenceEn: 'This is delicious, did you make it?',
  },
  // The futur proche: aller plus the verb. Passé and passons are the past
  // and the present.
  {
    kind: 'tap-translate',
    id: 'belle-famille-tt-ete',
    phraseKey: "phrase:on va passer l'été dans le sud",
    difficulty: 'recognition',
    en: 'We are spending the summer in the South',
    tokens: ['on', 'va', 'passer', "l'été", 'dans', 'le', 'Sud', 'passé', 'a'],
    accepted: ["on va passer l'été dans le Sud"],
  },
  {
    kind: 'fill-blank',
    id: 'belle-famille-fb-va-typed',
    phraseKey: "phrase:on va passer l'été dans le sud",
    difficulty: 'production',
    accepted: ['va'],
    en: 'We are spending the summer in the South',
    options: null,
    sentence: "On ___ passer l'été dans le Sud",
  },
  // Any warm thank you for the evening lands. Bonne nuit is for bedtime, and
  // à demain promises a visit nobody has planned.
  {
    kind: 'appropriate-reply',
    id: 'belle-famille-ar-soiree',
    phraseKey: 'phrase:merci beaucoup pour cette soirée',
    difficulty: 'recognition',
    acceptableIndexes: [0, 1],
    line: { speaker: 'Bernard', fr: 'Alors, vous repartez déjà ?', en: 'So, you are off already?' },
    options: [
      { fr: 'Merci beaucoup pour cette soirée', en: 'Thank you very much for this evening' },
      { fr: "Oui, merci pour tout, c'était délicieux", en: 'Yes, thank you for everything, it was delicious' },
      { fr: 'Bonne nuit', en: 'Good night' },
      { fr: 'À demain', en: 'See you tomorrow' },
    ],
  },
  {
    kind: 'listen-type',
    id: 'belle-famille-lt-soiree',
    phraseKey: 'phrase:merci beaucoup pour cette soirée',
    difficulty: 'production',
    fr: 'Merci beaucoup pour cette soirée',
    accepted: ['Merci beaucoup pour cette soirée', 'Merci pour cette soirée'],
  },
];
