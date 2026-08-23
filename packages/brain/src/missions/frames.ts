/**
 * The authored mission scenes.
 *
 * A mission's frame is the same object the scenario model produces at session
 * open, written by hand instead. That one fact is what makes a mission fast: the
 * agent looks the frame up and opens the scene with **zero model calls**, so the
 * ten to twenty five seconds of unexplained waiting the ledger records as G3 is
 * simply not on this path, and neither is F37's silent fall back to a café
 * nobody asked for.
 *
 * It is emphatically NOT a script. These frames run through
 * `createConversation` exactly as a model-built frame does: the tutor still
 * writes every line live against what the learner actually said, the beats are
 * aims rather than sentences, and a learner who wants to talk about the weather
 * instead can. The frame decides where the scene starts and what finishing it
 * means. Nothing else.
 *
 * Two of the six are the frames `fixtures.ts` already carries. They are
 * referenced rather than copied, because two café scenes that drifted apart is
 * exactly the failure this file would otherwise introduce, and because that file
 * calls itself the quality bar. The other four are authored here to match it.
 *
 * The catalogue half lives in `@parle/core`'s `missions/missions.ts` and repeats
 * these phrases as literal data, because core cannot import brain.
 * `agreement.test.ts` reads both sides and fails when they disagree.
 */

import type { MissionId } from '@parle/core';

import type { ScenarioFrame } from '../contract/types.ts';
import { CAFE_FRAME, APERO_FRAME } from '../fixtures.ts';

/**
 * mission:hotel. The most transactional of the six, which is the risk: a form being filled in.
 * Martine's notebook, the television through the wall and her one question back
 * are what stop it. vous throughout, leaning formal, because that is what a
 * reception actually sounds like.
 */
const HOTEL_FRAME: ScenarioFrame = {
  title: 'Le petit hôtel du lac',
  titleEn: 'The little hotel by the lake',
  setting: 'A small family hotel above the lake in Annecy, on a warm September evening. A narrow reception, a rack of real keys on the wall, and a television on somewhere behind it.',
  learnerRole: 'A traveller arriving to check into a small family hotel.',
  characters: [
    {
      name: 'Martine',
      role: 'the owner, who checks you in and hands you the key',
      register: 'courant',
    },
  ],
  registerGuidance: 'Reception French, and vous from the first word to the last. Bonsoir before anything else, because the sun is down. Martine keeps her polite formulas whole (je vous en prie, bien sûr, très bien) and asks the professional questions the professional way (vous avez une réservation, c\'est à quel nom, vous avez une pièce d\'identité), but she is not a form: between the questions she talks like anyone else, the ne drops and il y a comes out as y a. She mentions that y a pas d\'ascenseur, tells you which floor the room is on, and warns you the door sticks and you have to lift the handle. The learner is never asked to match her polite edge. Vous, bonsoir, and a full s\'il vous plaît are enough.',
  beats: [
    {
      id: 'arrive',
      goal: 'Dire bonsoir, annoncer sa réservation et donner son nom',
      goalEn: 'Say good evening, say you have a booking, and give the name',
    },
    {
      id: 'show-id',
      goal: 'Montrer son passeport',
      goalEn: 'Hand over your passport',
    },
    {
      id: 'ask-about-stay',
      goal: 'Poser une question sur le séjour',
      goalEn: 'Ask one practical question about the stay',
    },
    {
      id: 'take-key',
      goal: 'Prendre la clé, remercier et trouver la chambre',
      goalEn: 'Take the key, say thanks, and find out where the room is',
    },
  ],
  goalPhrases: [
    {
      fr: 'Bonsoir, j\'ai une réservation',
      frWritten: null,
      en: 'Good evening, I have a booking',
      register: 'courant',
    },
    {
      fr: 'C\'est au nom de Martin',
      frWritten: null,
      en: 'It\'s under the name Martin',
      register: 'courant',
    },
    {
      fr: 'Tenez, mon passeport',
      frWritten: null,
      en: 'Here you go, my passport',
      register: 'courant',
    },
    {
      fr: 'Le petit déjeuner, c\'est à quelle heure ?',
      frWritten: null,
      en: 'What time is breakfast?',
      register: 'courant',
    },
    {
      fr: 'Faut laisser la clé quand je sors ?',
      frWritten: 'Il faut laisser la clé quand je sors ?',
      en: 'Do I have to leave the key when I go out?',
      register: 'courant',
    },
    {
      fr: 'C\'est à quel étage ?',
      frWritten: null,
      en: 'Which floor is it on?',
      register: 'courant',
    },
    {
      fr: 'Plus lentement, s\'il vous plaît',
      frWritten: null,
      en: 'Slower, please',
      register: 'courant',
    },
    {
      fr: 'Je vous remercie',
      frWritten: null,
      en: 'Thank you',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: 'La petite réception sent l\'encaustique. Derrière le mur, une télé est allumée trop fort. La patronne ferme son grand cahier et lève les yeux vers vous.',
    frWritten: null,
    en: 'The little reception smells of floor polish. Somewhere behind the wall a television is on too loud. The owner closes her big notebook and looks up at you.',
  },
  openingLine: {
    speaker: 'Martine',
    fr: 'Ah, bonsoir ! Vous avez une réservation ?',
    frWritten: null,
    en: 'Ah, good evening! Do you have a booking?',
  },
  openingSupport: {
    fullLine: {
      fr: 'Bonsoir, oui, j\'ai une réservation',
      frWritten: null,
      en: 'Good evening, yes, I have a booking',
    },
    options: [
      {
        fr: 'Oui, j\'ai la confirmation',
        en: 'Yes, I have the confirmation',
      },
      {
        fr: 'Oui, c\'est pour deux nuits',
        en: 'Yes, it is for two nights',
      },
      {
        fr: 'C\'est au nom de Martin',
        en: 'It\'s under the name Martin',
      },
    ],
    hintEn: 'Say good evening back, and tell her a room is booked for you.',
  },
  cultureNotes: [
    'After about six in the evening it is bonsoir, not bonjour. Getting that one right marks you out before you have said anything else.',
    'Reception will ask for your passport when you arrive. It is routine, it takes a moment, and it comes straight back to you.',
    'Small hotels still hand you a real key on a heavy wooden fob, and they expect it left at the desk when you go out.',
  ],
};

/**
 * mission:marche. A stall is not a shop, and the guidance has to carry markers a café does not:
 * she asks the quantity herself, closes a price with allez, tags with hein, and
 * talks past you to the queue between turns.
 */
const MARCHE_FRAME: ScenarioFrame = {
  title: 'Samedi matin, au marché',
  titleEn: 'Saturday morning at the market',
  setting: 'The Saturday-morning market on the square in Toulouse. One vegetable stall, a set of scales, and a short queue.',
  learnerRole: 'A shopper buying tomatoes at a market stall.',
  characters: [
    {
      name: 'Corinne',
      role: 'the stallholder, quick hands and quicker questions, on this square every Saturday',
      register: 'courant',
    },
  ],
  registerGuidance: 'Vous throughout, but a market is not a shop. Corinne is quick and direct: short answers, questions back while her hands keep working, half-sentences everywhere. She asks the quantity herself (« Je vous en mets combien ? ») rather than waiting for it, closes a price with « allez », tags a question with « hein ? », and follows almost anything with « et avec ça ? ». Between turns she talks straight past you to whoever is next in the queue, then comes back to you mid-thought. She never hurries you and is never close enough for tu.',
  beats: [
    {
      id: 'greet-and-ask',
      goal: 'Dire bonjour et annoncer ce qu\'on veut',
      goalEn: 'Say hello and say what you are after',
    },
    {
      id: 'how-much',
      goal: 'Se mettre d\'accord sur la quantité',
      goalEn: 'Say how much you want',
    },
    {
      id: 'pick-the-ones',
      goal: 'Choisir les tomates avec elle',
      goalEn: 'Choose which ones go in the bag',
    },
    {
      id: 'settle-up',
      goal: 'Demander le prix et payer',
      goalEn: 'Ask what it comes to and pay',
    },
    {
      id: 'sign-off',
      goal: 'Remercier et prendre congé',
      goalEn: 'Thank her and take your leave',
    },
  ],
  goalPhrases: [
    {
      fr: 'Bonjour, je voudrais un kilo de tomates',
      frWritten: null,
      en: 'Hello, I would like a kilo of tomatoes',
      register: 'courant',
    },
    {
      fr: 'Elles sont à combien, les tomates ?',
      frWritten: null,
      en: 'How much are the tomatoes?',
      register: 'courant',
    },
    {
      fr: 'Une livre, ça ira',
      frWritten: null,
      en: 'Half a kilo will do',
      register: 'courant',
    },
    {
      fr: 'Elles sont mûres ?',
      frWritten: null,
      en: 'Are they ripe?',
      register: 'courant',
    },
    {
      fr: 'Celles-là, s\'il vous plaît',
      frWritten: null,
      en: 'Those ones, please',
      register: 'courant',
    },
    {
      fr: 'C\'est pour ce soir',
      frWritten: null,
      en: 'It is for tonight',
      register: 'courant',
    },
    {
      fr: 'Ça fait combien ?',
      frWritten: null,
      en: 'How much is that?',
      register: 'courant',
    },
    {
      fr: 'Merci, bon week-end !',
      frWritten: null,
      en: 'Thanks, have a good weekend!',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: 'Samedi matin, sur la place. Ça sent le carton mouillé et les pêches. Une femme vide une caisse de tomates sur son étal, et le client devant vous s\'en va avec son sac.',
    frWritten: null,
    en: 'Saturday morning, and the square smells of wet cardboard and peaches. At the vegetable stall a woman is tipping tomatoes out of a crate with both hands. The customer ahead of you takes their bag and steps away.',
  },
  openingLine: {
    speaker: 'Corinne',
    fr: 'Bonjour ! Qu\'est-ce qu\'il vous faut aujourd\'hui ?',
    frWritten: null,
    en: 'Hello! What do you need today?',
  },
  openingSupport: {
    fullLine: {
      fr: 'Bonjour ! Je voudrais des tomates, s\'il vous plaît',
      frWritten: null,
      en: 'Hello! I would like some tomatoes, please',
    },
    options: [
      {
        fr: 'Bonjour ! Les tomates, elles sont à combien ?',
        en: 'Hello! The tomatoes, how much are they?',
      },
      {
        fr: 'Bonjour ! Elles sont belles, vos tomates',
        en: 'Hello! Your tomatoes look good.',
      },
      {
        fr: 'Bonjour ! Une livre de tomates, s\'il vous plaît',
        en: 'Hello! Half a kilo of tomatoes, please',
      },
    ],
    hintEn: 'She has asked what you need. Tell her what you came for.',
  },
  cultureNotes: [
    'Do not help yourself at a stall unless you are told to. Point at the ones you want and the stallholder picks them up for you.',
    'Une livre means half a kilo, and market stalls still sell by it.',
    'When someone asks whether it is for today or for later, that is about ripeness. Answer it and you go home with better tomatoes.',
  ],
};

/**
 * mission:chemin. The only mission whose point is COMPREHENSION: the learner has to understand an
 * answer nobody scripted. So the scene is built around a way to slow it down, and
 * Sylvie is written to shorten and repeat rather than to elaborate.
 */
const CHEMIN_FRAME: ScenarioFrame = {
  title: 'Le chemin de la gare',
  titleEn: 'The way to the station',
  setting: 'A wide Paris street after a rain shower, late afternoon. The Metro exit behind you, and no sign of the train station from here.',
  learnerRole: 'Someone on foot who has just come up out of the Metro, looking for the train station.',
  characters: [
    {
      name: 'Sylvie',
      role: 'a woman heading home with her dog, patient and used to being stopped in the street',
      register: 'courant',
    },
  ],
  registerGuidance: 'Two strangers on the pavement: vous both ways, warm and brief. Sylvie talks the way people really give directions out loud, with the ne dropped (c\'est pas loin), y a for il y a, and vous prenez, vous tournez rather than imperatives. She points while she talks. Keep her directions to two steps and to landmarks a beginner can hold: tout droit, à gauche, à droite, le feu, la boulangerie, au coin. She may name a street once, and never leans on the name alone. Asked to slow down, she does it without remarking on it, and she gives less the second time, not more. Asked straight out whether it is left or right, she answers with the word itself.',
  beats: [
    {
      id: 'say-what-you-need',
      goal: 'Dire ce qu\'on cherche',
      goalEn: 'Say what you are looking for',
    },
    {
      id: 'take-in-the-way',
      goal: 'Écouter le chemin, et le faire redire si besoin',
      goalEn: 'Take in the directions, and get them again if you need to',
    },
    {
      id: 'check-the-way',
      goal: 'Vérifier le chemin et demander si c\'est loin',
      goalEn: 'Check the way and find out how far it is',
    },
    {
      id: 'thank-and-go',
      goal: 'Remercier et repartir',
      goalEn: 'Thank her and set off',
    },
  ],
  goalPhrases: [
    {
      fr: 'Excusez-moi, je cherche la gare',
      frWritten: null,
      en: 'Excuse me, I\'m looking for the train station',
      register: 'courant',
    },
    {
      fr: 'J\'suis pas d\'ici',
      frWritten: 'Je ne suis pas d\'ici',
      en: 'I\'m not from around here',
      register: 'courant',
    },
    {
      fr: 'Plus lentement, s\'il vous plaît',
      frWritten: null,
      en: 'More slowly, please',
      register: 'courant',
    },
    {
      fr: 'C\'est à gauche ou à droite ?',
      frWritten: null,
      en: 'Is it left or right?',
      register: 'courant',
    },
    {
      fr: 'C\'est par là ?',
      frWritten: null,
      en: 'Is it that way?',
      register: 'courant',
    },
    {
      fr: 'D\'accord, je vois',
      frWritten: null,
      en: 'Okay, I see',
      register: 'courant',
    },
    {
      fr: 'C\'est loin ?',
      frWritten: null,
      en: 'Is it far?',
      register: 'courant',
    },
    {
      fr: 'Merci, c\'est gentil',
      frWritten: null,
      en: 'Thanks, that\'s kind of you',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: 'La pluie vient de s\'arrêter et le trottoir brille encore. Vous sortez du métro, dans une rue que vous ne reconnaissez pas, et votre téléphone est mort. Près de vous, une femme tient son chien en laisse, et elle lève les yeux vers vous.',
    frWritten: null,
    en: 'The rain has just stopped and the pavement is still shining. You come up out of the Metro into a street you do not recognise, with a dead phone in your pocket. Near you a woman is holding her dog on a short lead, and she looks up as you step towards her.',
  },
  openingLine: {
    speaker: 'Sylvie',
    fr: 'Vous cherchez quelque chose ?',
    frWritten: null,
    en: 'Are you looking for something?',
  },
  openingSupport: {
    fullLine: {
      fr: 'Bonjour ! Excusez-moi, je cherche la gare',
      frWritten: null,
      en: 'Hello! Excuse me, I\'m looking for the train station',
    },
    options: [
      {
        fr: 'Bonjour ! La gare, c\'est par où ?',
        en: 'Hello! Which way is the train station?',
      },
      {
        fr: 'Bonjour ! J\'suis pas d\'ici, je cherche la gare',
        en: 'Hello! I\'m not from around here, I\'m looking for the train station',
      },
      {
        fr: 'Bonjour ! Pour aller à la gare, s\'il vous plaît ?',
        en: 'Hello! How do I get to the train station?',
      },
    ],
    hintEn: 'Say hello first, then tell her what you are trying to find.',
  },
  cultureNotes: [
    'A stranger in the street gets bonjour before your question, exactly like a shopkeeper does. Excusez-moi on its own can land a little abrupt.',
    'Directions here hang on landmarks as much as street names. Listen for the traffic light, the bakery, the corner, and you have the turn even when the street name goes past you.',
    'Asking someone to speak more slowly is completely ordinary and nobody minds. Most people slow right down and start the directions again from the top.',
  ],
};

/**
 * mission:journee. The register outlier, and the one carrying tu almost alone. Its production load
 * is the lightest in the set and its comprehension load is unbounded, because
 * Nadia's day is written live: the learner must react to content nobody chose.
 */
const JOURNEE_FRAME: ScenarioFrame = {
  title: 'Ta journée, ça a été ?',
  titleEn: 'How was your day?',
  setting: 'A kitchen in Nantes, early evening on a Tuesday. The kettle is on, a bag of shopping still on the table, and a friend from downstairs who came up with the post and stayed.',
  learnerRole: 'Yourself, just home at the end of the day.',
  characters: [
    {
      name: 'Nadia',
      role: 'your friend from the flat below, who came up with the post and is in no hurry to go back down',
      register: 'familier',
    },
  ],
  registerGuidance: 'Two friends in a kitchen, so tu from the first word and nothing formal anywhere. The ne of negation is gone (j\'ai pas arrêté), fillers carry the rhythm (bah, du coup, tu vois, en fait), and a day gets talked about in fixed pieces rather than in full sentences: ça a été, comme d\'hab, j\'ai pas arrêté. Nadia fronts her own answers with bah or franchement, keeps her turns short, and reacts to what the learner actually said before adding anything of her own. She asks to be asked back rather than volunteering her day. Some of the days she has had are good and some are rough, so the learner needs both a tant mieux and an ah mince within reach. No argot here. This is a quiet weekday catch-up, not a party, and slang would make it sound like one.',
  beats: [
    {
      id: 'raconter-sa-journee',
      goal: 'Dire comment était sa journée',
      goalEn: 'Say how your day went',
    },
    {
      id: 'donner-un-detail',
      goal: 'Donner un détail de sa journée',
      goalEn: 'Give one detail about it',
    },
    {
      id: 'renvoyer-la-question',
      goal: 'Renvoyer la question à Nadia',
      goalEn: 'Ask her about her day',
    },
    {
      id: 'reagir',
      goal: 'Réagir à ce qu\'elle raconte',
      goalEn: 'React to what she tells you',
    },
    {
      id: 'se-quitter',
      goal: 'Se dire à plus tard',
      goalEn: 'Say see you later',
    },
  ],
  goalPhrases: [
    {
      fr: 'Ça a été',
      frWritten: null,
      en: 'It was alright',
      register: 'courant',
    },
    {
      fr: 'Comme d\'hab',
      frWritten: 'Comme d\'habitude',
      en: 'Same as always',
      register: 'familier',
    },
    {
      fr: 'J\'ai pas arrêté',
      frWritten: 'Je n\'ai pas arrêté',
      en: 'I didn\'t stop all day',
      register: 'familier',
    },
    {
      fr: 'J\'ai bossé toute la journée',
      frWritten: null,
      en: 'I worked all day',
      register: 'familier',
    },
    {
      fr: 'Et toi, ta journée ?',
      frWritten: null,
      en: 'And you, how was yours?',
      register: 'familier',
    },
    {
      fr: 'Tant mieux',
      frWritten: null,
      en: 'Glad to hear it',
      register: 'courant',
    },
    {
      fr: 'Ah mince',
      frWritten: null,
      en: 'Oh no',
      register: 'familier',
    },
    {
      fr: 'Allez, à plus !',
      frWritten: null,
      en: 'Right, see you!',
      register: 'familier',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: 'Vous rentrez. La bouilloire chauffe déjà. Nadia est appuyée contre le plan de travail, votre courrier à la main.',
    frWritten: null,
    en: 'You get in and the kettle is already going. Nadia is leaning on the counter with your post still in her hand. She has been waiting for you to drop your keys and sit down.',
  },
  openingLine: {
    speaker: 'Nadia',
    fr: 'Tiens, salut ! Bon, raconte. Elle était comment, ta journée ?',
    frWritten: null,
    en: 'Oh, hey! Go on then, how was your day?',
  },
  openingSupport: {
    fullLine: {
      fr: 'Bah, ça a été. J\'ai pas arrêté.',
      frWritten: 'Bah, ça a été. Je n\'ai pas arrêté.',
      en: 'Yeah, alright. I didn\'t stop all day.',
    },
    options: [
      {
        fr: 'Comme d\'hab',
        en: 'Same as always',
      },
      {
        fr: 'J\'ai bossé toute la journée',
        en: 'I worked all day',
      },
      {
        fr: 'Franchement, c\'était bien',
        en: 'Honestly, it was good',
      },
    ],
    hintEn: 'Say how your day went. Ordinary is a real answer here, and so is good.',
  },
  cultureNotes: [
    'A French friend asking about your day expects a real answer, not a bright one. Ça a été and comme d\'hab are normal, and nobody hears them as complaining.',
    'Ta journée is the day you have had. Bonne journée, the one you hear on the way out of every shop, is the day you are being wished.',
    'With friends it is tu the whole way, and the ne of negation drops. Out loud it is j\'ai pas arrêté. Je n\'ai pas arrêté is the version you write.',
  ],
};

export const MISSION_FRAMES: Record<MissionId, ScenarioFrame> = {
  'mission:cafe': CAFE_FRAME,
  'mission:hotel': HOTEL_FRAME,
  'mission:marche': MARCHE_FRAME,
  'mission:chemin': CHEMIN_FRAME,
  'mission:journee': JOURNEE_FRAME,
  'mission:amis': APERO_FRAME,
};

/**
 * The frame for a mission, or undefined when the id means nothing here.
 *
 * Undefined rather than a throw, and undefined rather than a stock café: an app
 * and an agent ship independently, so an id this worker has never heard of has
 * to degrade into the ordinary "what would you like to talk about" question
 * rather than take the session down or quietly substitute a different scene.
 */
export function missionFrame(id: string): ScenarioFrame | undefined {
  return Object.prototype.hasOwnProperty.call(MISSION_FRAMES, id)
    ? MISSION_FRAMES[id as MissionId]
    : undefined;
}
