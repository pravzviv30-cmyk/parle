/**
 * Hand-written scenario frames.
 *
 * Two jobs. First, the offline path: the playground opens on one of these with
 * zero model calls, the mock client and every engine test run against them, and
 * a learner with no key still gets a real scene. Second, they are the quality
 * bar — what a model-built frame should look like. One transactional scene in
 * vous-territory, one friends scene where the argot lives, so both ends of the
 * register range are exercised.
 */

import type { ScenarioFrame } from './contract/types.ts';

export const CAFE_FRAME: ScenarioFrame = {
  title: 'Au café du coin',
  titleEn: 'At the corner café',
  setting: 'A small café in Lyon, mid-morning. A short queue, one barista working the counter.',
  learnerRole: 'A customer ordering a coffee and something to eat.',
  characters: [{ name: 'Karim', role: 'the barista behind the counter, friendly and quick', register: 'courant' }],
  registerGuidance:
    'Service French: warm but vous. Short transactional lines. Bonjour before anything else. ' +
    "Real spoken French all the same: the ne drops, y a for il y a, ça marche as the everyday yes.",
  beats: [
    { id: 'greet', goal: 'Échanger un bonjour', goalEn: 'Trade hellos' },
    { id: 'order-drink', goal: 'Commander une boisson', goalEn: 'Order a drink' },
    { id: 'order-food', goal: 'Choisir quelque chose à manger', goalEn: 'Pick something to eat' },
    { id: 'pay', goal: 'Payer', goalEn: 'Pay' },
    { id: 'leave', goal: 'Prendre congé', goalEn: 'Say goodbye and leave' },
  ],
  goalPhrases: [
    { fr: "Bonjour, un café s'il vous plaît", frWritten: null, en: 'Hello, a coffee please', register: 'courant' },
    { fr: 'Je vais prendre un croissant', frWritten: null, en: "I'll take a croissant", register: 'courant' },
    { fr: 'Ça sera tout, merci', frWritten: null, en: "That'll be all, thanks", register: 'courant' },
    { fr: 'Je peux payer par carte ?', frWritten: null, en: 'Can I pay by card?', register: 'courant' },
    { fr: 'Ça marche', frWritten: null, en: 'Works for me', register: 'courant' },
    { fr: 'Bonne journée !', frWritten: null, en: 'Have a good day!', register: 'courant' },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: 'Imaginez la scène. Vous poussez la porte d’un petit café à Lyon. Derrière le comptoir, le barista lève les yeux vers vous.',
    frWritten: null,
    en: 'Imagine the scene. You push open the door of a small café in Lyon. Behind the counter, the barista looks up at you.',
  },
  openingLine: {
    speaker: 'Karim',
    fr: "Bonjour ! Qu'est-ce que je vous sers ?",
    frWritten: null,
    en: 'Hello! What can I get you?',
  },
  openingSupport: {
    fullLine: { fr: "Bonjour, un café s'il vous plaît", frWritten: null, en: 'Hello, a coffee please' },
    options: [
      { fr: "Un café, s'il vous plaît", en: 'A coffee, please' },
      { fr: "Un thé, s'il vous plaît", en: 'A tea, please' },
      { fr: "Un café allongé, s'il vous plaît", en: 'A long black, please' },
    ],
    hintEn: 'Greet him back, then order a drink.',
  },
  cultureNotes: [
    'Say bonjour before anything else. Skipping it reads as rude everywhere in France.',
    'Un café is a small espresso. Closer to an American coffee is un café allongé.',
    'You use vous with anyone serving you, however friendly the vibe.',
  ],
};

export const APERO_FRAME: ScenarioFrame = {
  title: "L'apéro entre potes",
  titleEn: 'Drinks with friends',
  setting: "A Friday-evening apéro on a friend's balcony in Paris. Crisps, a bottle of something cold.",
  learnerRole: 'One of the friends, just arrived.',
  characters: [
    { name: 'Chloé', role: 'your friend since forever, quick and teasing', register: 'familier' },
    { name: 'Sami', role: "Chloé's flatmate, laid back, full of stories", register: 'argot' },
  ],
  registerGuidance:
    'Full friends-mode: tu with everyone, the ne dropped everywhere, fillers all over (bah, du coup, genre), ' +
    'argot welcome (kiffer, ouf, relou). Formal French here would land as distant or ironic.',
  beats: [
    { id: 'arrive', goal: "Dire bonsoir et s'installer", goalEn: 'Say hi and settle in' },
    { id: 'news', goal: 'Raconter sa semaine', goalEn: 'Swap news about the week' },
    { id: 'plans', goal: 'Monter un plan pour samedi', goalEn: 'Make a plan for Saturday' },
    { id: 'toast', goal: 'Trinquer', goalEn: 'Raise a glass' },
  ],
  goalPhrases: [
    { fr: 'Salut ! Ça va ?', frWritten: null, en: 'Hey! How are you?', register: 'familier' },
    {
      fr: "J'suis crevé, la semaine était longue",
      frWritten: 'Je suis crevé, la semaine était longue',
      en: "I'm wiped, long week",
      register: 'familier',
    },
    { fr: 'On fait quoi samedi ?', frWritten: null, en: 'What are we doing Saturday?', register: 'familier' },
    { fr: 'Carrément !', frWritten: null, en: 'Totally!', register: 'familier' },
    { fr: "C'était un truc de ouf", frWritten: null, en: 'It was wild', register: 'argot' },
    { fr: 'Santé !', frWritten: null, en: 'Cheers!', register: 'courant' },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: 'Imaginez la scène. Vendredi soir, un balcon à Paris. Votre amie Chloé vous ouvre la porte, un verre à la main.',
    frWritten: null,
    en: 'Imagine the scene. Friday evening, a balcony in Paris. Your friend Chloé opens the door, glass in hand.',
  },
  openingLine: {
    speaker: 'Chloé',
    fr: 'Ah bah te voilà ! Alors, ta semaine ?',
    frWritten: null,
    en: 'There you are! So, how was your week?',
  },
  openingSupport: {
    fullLine: {
      fr: "Salut ! Bah écoute, ça va. Et vous ?",
      frWritten: null,
      en: 'Hey! Not too shabby. And you two?',
    },
    options: [
      { fr: 'Ça va, et toi ?', en: 'Good, you?' },
      { fr: "J'suis crevé !", en: "I'm wiped!" },
      { fr: 'Ça fait plaisir de vous voir !', en: 'So good to see you two!' },
    ],
    hintEn: 'Greet them like friends and say how your week went.',
  },
  cultureNotes: [
    "L'apéro is its own institution: drinks and snacks before dinner, sometimes instead of it.",
    'With friends, tu always. Switching to vous mid-apéro would read as a joke.',
    'When glasses touch, look people in the eye. Skipping that gets theatrical outrage.',
  ],
};

export const FIXTURE_FRAMES: readonly ScenarioFrame[] = [CAFE_FRAME, APERO_FRAME];

/**
 * Keep a failed scenario build on the learner's subject.
 *
 * A provider outage, timeout or malformed structured reply leaves us without
 * enough intelligence to translate an arbitrary request into a rich scene.
 * It does not leave us without the request itself. This small, deliberately
 * general frame carries that request into every later turn through
 * `frameMessage`, so a healthy turn model can still play inside it. The fixed
 * French is useful in almost any situation and, crucially, never substitutes a
 * café or another stock scene the learner did not choose.
 */
export function requestFallbackFrame(request: string): ScenarioFrame {
  const cleaned = request.replace(/\s+/g, ' ').trim();
  const subject = cleaned.length > 0 ? cleaned.slice(0, 240).trim() : 'a conversation of your choice';
  const titleEn = subject.length <= 96 ? subject : `${subject.slice(0, 93).trimEnd()}...`;

  return {
    title: 'Conversation sur mesure',
    titleEn,
    setting: `The learner chose this exact situation: "${subject}". Stay inside that situation and do not replace it with a stock scene.`,
    learnerRole: 'Themself, in the exact situation they requested.',
    characters: [
      {
        name: 'Camille',
        role: "a friendly French-speaking conversation partner who belongs naturally in the learner's requested situation",
        register: 'courant',
      },
    ],
    registerGuidance:
      'Natural everyday spoken French. Follow the relationship and setting in the learner request. Keep each turn short and make the first words easy to reuse.',
    beats: [
      { id: 'set-the-scene', goal: 'Situer la scène', goalEn: 'Say where you are and what is happening' },
      { id: 'notice-details', goal: 'Décrire ce qui se passe', goalEn: 'Describe what you notice' },
      { id: 'react', goal: 'Réagir et donner son avis', goalEn: 'React and share an opinion' },
      { id: 'keep-talking', goal: 'Poser une question et poursuivre', goalEn: 'Ask a question and keep the exchange going' },
    ],
    goalPhrases: [
      { fr: 'Alors, voilà ce qui se passe', frWritten: null, en: "So, here's what's happening", register: 'courant' },
      { fr: 'Regarde ça', frWritten: null, en: 'Look at that', register: 'courant' },
      { fr: "Qu'est-ce que t'en penses ?", frWritten: null, en: 'What do you think?', register: 'familier' },
      { fr: 'Moi, je trouve ça intéressant', frWritten: null, en: 'I find that interesting', register: 'courant' },
      { fr: 'Et toi ?', frWritten: null, en: 'And you?', register: 'courant' },
      { fr: 'Et après, il se passe quoi ?', frWritten: null, en: 'And what happens next?', register: 'familier' },
    ],
    openingNarration: {
      speaker: 'narration',
      fr: 'Imaginez la situation que vous avez choisie. Vous y êtes. La conversation commence.',
      frWritten: null,
      en: `Imagine the situation you chose: ${subject}. You are there, and the conversation begins.`,
    },
    openingLine: {
      speaker: 'Camille',
      fr: "Alors, raconte. Qu'est-ce qui se passe ?",
      frWritten: null,
      en: "So, tell me. What's happening?",
    },
    openingSupport: {
      fullLine: { fr: 'Alors, voilà ce qui se passe', frWritten: null, en: "So, here's what's happening" },
      options: [
        { fr: 'Je vais te raconter', en: "I'll tell you" },
        { fr: 'Regarde autour de toi', en: 'Look around you' },
        { fr: 'On commence ?', en: 'Shall we start?' },
      ],
      hintEn: 'Start by saying where you are and what is happening.',
    },
    cultureNotes: [],
  };
}
