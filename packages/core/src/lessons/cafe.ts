/**
 * "Commander un café" — the first lesson.
 *
 * Chosen because ordering coffee is the first real transaction almost every
 * visitor to France attempts, and because the phrases are short enough for a
 * complete beginner to actually say out loud in session one.
 *
 * The phonetic design is deliberate rather than incidental. Working through this
 * one scene forces the learner through nearly the whole hard-for-anglophones set:
 *
 *   /ʁ/   bonjour, sur, pardon, croissant, merci, carte, revoir  (unavoidable)
 *   /ɔ̃/   bonjour, pardon, non, combien, sont
 *   /ɛ̃/   combien
 *   /ɑ̃/   croissant
 *   /œ̃/   un
 *   /y/   sur, excusez
 *   /ʒ/   bonjour, journée
 *   /e/   café, répéter, journée
 *
 * Two turns exist for survival rather than for the scene: asking someone to
 * repeat themselves, and asking where the toilets are. A beginner who can do
 * those two things can rescue almost any real conversation, and no beginner
 * course teaches them early enough.
 */

import type { Lesson } from './types.ts';
import { RUNGS } from '../ladder/ladder.ts';

export const CAFE_LESSON: Lesson = {
  id: 'cafe-01',
  title: 'Commander un café',
  titleEn: 'Ordering a coffee',
  cefr: 'A0',
  tutorRole: 'A warm, unhurried barista in a neighbourhood café in Lyon.',
  scenario:
    'The learner walks into a small French café mid-morning and orders a coffee and a pastry, ' +
    'pays by card, asks where the toilets are, and leaves. Play the barista. Stay in the scene ' +
    'throughout. Speak slowly and clearly, but never in a babyish register — treat them as an ' +
    'adult who simply does not have the words yet.',
  openingRung: RUNGS.ECHO,
  premise: 'You are going to walk into a café in Lyon and order a coffee, in French, out loud. It takes about five minutes.',
  targetPhonemes: ['ʁ', 'ɔ̃', 'ɛ̃', 'ɑ̃', 'œ̃', 'y', 'ʒ', 'e'],
  culturalNotes: [
    'In France you say "bonjour" before anything else. Skip it and go straight to your order and the whole room decides you are rude.',
    'In France "un café" means a small, strong espresso. If you want something closer to an American coffee, ask for "un café allongé".',
    'Sitting down really does cost more than standing at the bar. Table service is priced separately on the menu.',
    'You use "vous" with anyone serving you. "Tu" with a stranger behind a counter would land badly, however friendly you meant it.',
  ],

  turns: [
    {
      id: 't1-greet',
      tutor: 'Bonjour !',
      tutorEn: 'Hello!',
      target: 'Bonjour',
      targetEn: 'Hello',
      targetIpa: 'bɔ̃.ʒuʁ',
      reference: 'Bonjour',
      focusPhonemes: ['ɔ̃', 'ʒ', 'ʁ'],
      options: [
        { text: 'Bonjour', en: 'Hello', acceptable: true },
        { text: 'Bonjour, madame', en: 'Hello, madam', acceptable: true },
        { text: 'Bonsoir', en: 'Good evening', acceptable: false },
      ],
      hint: 'Greet them back. It is mid-morning.',
      accepts: ['bonjour madame', 'bonjour monsieur', 'salut'],
      note: 'Three of the hardest French sounds live in this one word: the nasal /ɔ̃/, the /ʒ/ of "measure", and the throaty /ʁ/. Get "bonjour" right and a lot of French follows.',
    },
    {
      id: 't2-order',
      tutor: "Qu'est-ce que je vous sers ?",
      tutorEn: 'What can I get you?',
      target: "Un café, s'il vous plaît",
      targetEn: 'A coffee, please',
      targetIpa: 'œ̃ ka.fe sil vu plɛ',
      reference: "Un café, s'il vous plaît",
      focusPhonemes: ['œ̃', 'e', 'u', 'ɛ'],
      options: [
        { text: "Un café, s'il vous plaît", en: 'A coffee, please', acceptable: true },
        { text: "Un thé, s'il vous plaît", en: 'A tea, please', acceptable: true },
        { text: 'Je veux un café', en: 'I want a coffee', acceptable: false },
      ],
      hint: 'Order a coffee. Remember to say please.',
      accepts: ['un cafe sil vous plait', 'un café merci', 'je voudrais un café'],
      note: '"Je veux" means "I want". People will understand it, but it sounds blunt. Add "s\'il vous plaît" and you are safe.',
    },
    {
      id: 't3-sur-place',
      tutor: 'Très bien. Sur place ou à emporter ?',
      tutorEn: 'Very good. To have here or take away?',
      target: "Sur place, s'il vous plaît",
      targetEn: 'To have here, please',
      targetIpa: 'syʁ plas sil vu plɛ',
      reference: "Sur place, s'il vous plaît",
      focusPhonemes: ['y', 'ʁ'],
      options: [
        { text: "Sur place, s'il vous plaît", en: 'Here, please', acceptable: true },
        { text: "À emporter, s'il vous plaît", en: 'Takeaway, please', acceptable: true },
        { text: 'Sur place', en: 'Here', acceptable: true },
      ],
      hint: 'Tell them you will drink it there rather than take it away.',
      accepts: ['sur place', 'a emporter', 'à emporter'],
      note: 'The "u" in "sur" needs rounded lips with your tongue kept forward. Say it with English lips and you get a different word.',
    },
    {
      id: 't4-repeat',
      tutor: "D'accord. Et avec ceci, vous voulez quelque chose à manger ?",
      tutorEn: 'All right. And with that, would you like something to eat?',
      target: 'Pardon, vous pouvez répéter ?',
      targetEn: 'Sorry, could you repeat that?',
      targetIpa: 'paʁ.dɔ̃ vu pu.ve ʁe.pe.te',
      reference: 'Pardon, vous pouvez répéter ?',
      focusPhonemes: ['ʁ', 'ɔ̃', 'u', 'e'],
      options: [
        { text: 'Pardon, vous pouvez répéter ?', en: 'Sorry, could you repeat that?', acceptable: true },
        { text: 'Plus lentement, s\'il vous plaît', en: 'More slowly, please', acceptable: true },
        { text: 'Je ne comprends pas', en: "I don't understand", acceptable: true },
      ],
      hint: 'You did not catch that. Ask them to say it again.',
      accepts: ['pardon vous pouvez repeter', 'pouvez vous répéter', 'répétez sil vous plait', 'je ne comprends pas', 'plus lentement'],
      note: 'This is the most useful sentence in the lesson. When you lose the thread of a real conversation, this one line keeps it alive and buys you time.',
    },
    {
      id: 't5-croissant',
      tutor: 'Bien sûr. Est-ce que vous voulez quelque chose à manger ?',
      tutorEn: 'Of course. Would you like something to eat?',
      target: "Un croissant, s'il vous plaît",
      targetEn: 'A croissant, please',
      targetIpa: 'œ̃ kʁwa.sɑ̃ sil vu plɛ',
      reference: "Un croissant, s'il vous plaît",
      focusPhonemes: ['œ̃', 'ʁ', 'w', 'ɑ̃'],
      options: [
        { text: "Un croissant, s'il vous plaît", en: 'A croissant, please', acceptable: true },
        { text: "Un pain au chocolat, s'il vous plaît", en: 'A pain au chocolat, please', acceptable: true },
        { text: 'Non, merci', en: 'No, thank you', acceptable: true },
      ],
      hint: 'Order a croissant as well.',
      accepts: ['un croissant', 'un pain au chocolat', 'non merci'],
      note: 'The "nt" at the end of "croissant" is silent. The word ends on the nasal vowel. Nearly every English speaker adds a "t" that French never says.',
    },
    {
      id: 't6-thats-all',
      tutor: 'Parfait. Ce sera tout ?',
      tutorEn: 'Perfect. Will that be all?',
      target: "Oui, c'est tout, merci",
      targetEn: "Yes, that's all, thank you",
      targetIpa: 'wi sɛ tu mɛʁ.si',
      reference: "Oui, c'est tout, merci",
      focusPhonemes: ['ɛ', 'u', 'ʁ'],
      options: [
        { text: "Oui, c'est tout, merci", en: "Yes, that's all, thanks", acceptable: true },
        { text: "Non, c'est tout", en: "No, that's everything", acceptable: false },
        { text: 'Oui, merci', en: 'Yes, thank you', acceptable: true },
      ],
      hint: 'Confirm that is everything, and thank them.',
      accepts: ['oui cest tout', 'cest tout merci', 'oui merci', 'c est tout'],
    },
    {
      id: 't7-how-much',
      tutor: 'Voilà votre café et votre croissant.',
      tutorEn: 'Here is your coffee and your croissant.',
      target: "C'est combien ?",
      targetEn: 'How much is it?',
      targetIpa: 'sɛ kɔ̃.bjɛ̃',
      reference: "C'est combien ?",
      focusPhonemes: ['ɛ', 'ɔ̃', 'ɛ̃'],
      options: [
        { text: "C'est combien ?", en: 'How much is it?', acceptable: true },
        { text: 'Ça fait combien ?', en: 'How much does that come to?', acceptable: true },
        { text: 'Combien ?', en: 'How much?', acceptable: false },
      ],
      hint: 'Ask how much it costs.',
      accepts: ['cest combien', 'ca fait combien', 'ça fait combien', 'c est combien'],
      note: '"Combien" has two different nasal vowels back to back. If yours come out the same, this is the word that shows it.',
    },
    {
      id: 't8-pay',
      tutor: 'Quatre euros vingt.',
      tutorEn: 'Four euros twenty.',
      target: "Par carte, s'il vous plaît",
      targetEn: 'By card, please',
      targetIpa: 'paʁ kaʁt sil vu plɛ',
      reference: "Par carte, s'il vous plaît",
      focusPhonemes: ['ʁ'],
      options: [
        { text: "Par carte, s'il vous plaît", en: 'By card, please', acceptable: true },
        { text: "En espèces, s'il vous plaît", en: 'In cash, please', acceptable: true },
        { text: 'Carte', en: 'Card', acceptable: false },
      ],
      hint: 'Say you will pay by card.',
      accepts: ['par carte', 'en especes', 'en espèces', 'carte bancaire'],
      note: '"Par carte" has two French R sounds in three syllables, both right after a consonant. That is the hardest spot for an English speaker, so this is where your R gets tested.',
    },
    {
      id: 't9-thanks',
      tutor: 'Bien sûr. Voilà.',
      tutorEn: 'Of course. There you go.',
      target: 'Merci beaucoup',
      targetEn: 'Thank you very much',
      targetIpa: 'mɛʁ.si bo.ku',
      reference: 'Merci beaucoup',
      focusPhonemes: ['ʁ', 'o', 'u'],
      options: [
        { text: 'Merci beaucoup', en: 'Thank you very much', acceptable: true },
        { text: 'Merci bien', en: 'Thanks a lot', acceptable: true },
        { text: 'Merci', en: 'Thanks', acceptable: true },
      ],
      hint: 'Thank them warmly.',
      accepts: ['merci', 'merci bien', 'merci beaucoup madame'],
      note: 'The "p" at the end of "beaucoup" is silent. Most French words drop their last consonant like this.',
    },
    {
      id: 't10-toilets',
      tutor: 'Je vous en prie.',
      tutorEn: "You're welcome.",
      target: 'Excusez-moi, où sont les toilettes ?',
      targetEn: 'Excuse me, where are the toilets?',
      targetIpa: 'ɛks.ky.ze mwa u sɔ̃ le twa.lɛt',
      reference: 'Excusez-moi, où sont les toilettes ?',
      focusPhonemes: ['y', 'e', 'w', 'u', 'ɔ̃'],
      options: [
        { text: 'Excusez-moi, où sont les toilettes ?', en: 'Excuse me, where are the toilets?', acceptable: true },
        { text: 'Où sont les toilettes ?', en: 'Where are the toilets?', acceptable: true },
        { text: 'Les toilettes ?', en: 'The toilets?', acceptable: false },
      ],
      hint: 'Ask politely where the toilets are.',
      accepts: ['ou sont les toilettes', 'où sont les toilettes', 'excusez moi ou sont les toilettes'],
      note: 'The second most useful sentence you will learn today. Note "les toilettes" is always plural in French, even for a single room.',
    },
    {
      id: 't11-good-day',
      tutor: 'Au fond à droite. Bonne journée !',
      tutorEn: 'At the back on the right. Have a good day!',
      target: 'Bonne journée',
      targetEn: 'Have a good day',
      targetIpa: 'bɔn ʒuʁ.ne',
      reference: 'Bonne journée',
      focusPhonemes: ['ʒ', 'ʁ', 'e'],
      options: [
        { text: 'Bonne journée', en: 'Have a good day', acceptable: true },
        { text: 'Bonne journée à vous aussi', en: 'You too', acceptable: true },
        { text: 'Bonne nuit', en: 'Good night', acceptable: false },
      ],
      hint: 'Wish them a good day too.',
      accepts: ['bonne journee', 'vous aussi', 'bonne journée à vous', 'merci vous aussi'],
      note: 'Note the contrast with "bonjour": "bonne journée" is for leaving, "bonjour" for arriving. Saying "bonjour" on the way out marks you instantly as a visitor.',
    },
    {
      id: 't12-goodbye',
      tutor: 'Au revoir !',
      tutorEn: 'Goodbye!',
      target: 'Au revoir, madame',
      targetEn: 'Goodbye, madam',
      targetIpa: 'o ʁə.vwaʁ ma.dam',
      reference: 'Au revoir, madame',
      focusPhonemes: ['o', 'ʁ', 'ə', 'w'],
      options: [
        { text: 'Au revoir, madame', en: 'Goodbye, madam', acceptable: true },
        { text: 'Au revoir', en: 'Goodbye', acceptable: true },
        { text: 'Salut', en: 'Bye (casual)', acceptable: false },
      ],
      hint: 'Say goodbye politely on your way out.',
      accepts: ['au revoir', 'au revoir monsieur', 'merci au revoir'],
      note: '"Salut" is for friends. It sounds too familiar for someone who just served you. "Au revoir" is the safe choice every time.',
    },
  ],
};
