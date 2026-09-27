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
 * is deliberately authored at all four ramp stages as the reference ladder.
 *
 * The mission sections below exist because a path node with nothing behind it is
 * a door onto an empty room, which path.ts:183 records as a bug that shipped
 * rather than a theoretical one. Every phrase an authored mission leaves behind
 * gets one recognition exercise and one production exercise, so the ramp has
 * somewhere to walk it. No mission phrase is authored at all four stages: that
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
];
