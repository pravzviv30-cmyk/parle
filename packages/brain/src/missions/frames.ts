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
 * Two of them, the café and the apéro, are the frames `fixtures.ts` already
 * carries. They are referenced rather than copied, because two café scenes that
 * drifted apart is exactly the failure this file would otherwise introduce, and
 * because that file calls itself the quality bar. The other twenty-three of the
 * twenty-five are authored here to match it: the A0 and A1 scenes first, then
 * the seven A2 ones (weekend chat, first day at work, booking by phone, the
 * doctor, a shop return, a flat viewing and dinner with a partner's parents),
 * then six more A2 ones (signing up for a class, a bank account, cinema plans,
 * a winter coat in Montréal, a colleague's help and a partner's sister's
 * birthday).
 *
 * The catalogue half lives in `@luvani/core`'s `missions/missions.ts` and repeats
 * these phrases as literal data, because core cannot import brain.
 * `agreement.test.ts` reads both sides and fails when they disagree.
 */

import type { MissionId } from '@luvani/core';

import type { ScenarioFrame } from '../contract/types.ts';
import { CAFE_FRAME, APERO_FRAME } from '../fixtures.ts';

/**
 * mission:premier-cafe. The first scene a brand-new learner opens on, and so the
 * smallest: three lines at the counter, order, here or to go, and what it costs.
 * Karim is the same barista as the full café, but slower and briefer here,
 * because the learner may never have said a French sentence to anyone.
 *
 * The three approved first-coffee lines from core's `daily/scenes/cafeAndFood.ts`
 * lead the goal phrases, less their sentence-final full stop, because they are
 * what the scene brief promises, what the bundled recordings say and the phrase
 * keys core drills. Three neighbouring café lines follow as easier fallbacks the
 * tutor can hand over; they are taught here but not drilled for this scene.
 */
const PREMIER_CAFE_FRAME: ScenarioFrame = {
  title: 'Le premier café',
  titleEn: 'Your first coffee',
  setting: 'A small café in Lyon, early morning before work. A short counter, a coffee machine, and one barista.',
  learnerRole: 'A customer ordering a coffee at the counter.',
  characters: [
    {
      name: 'Karim',
      role: 'the barista behind the counter, patient in the early hours',
      register: 'courant',
    },
  ],
  registerGuidance: 'Service French, vous throughout, and slower than a real morning rush. Bonjour before anything else. Karim keeps every turn to one short question: what you would like, here or to go, and then the price. He asks sur place ou à emporter the way every counter does, says ça marche for yes, and says the price out loud as a whole phrase. He never asks two things at once and never adds small talk the learner has to answer. Anything longer than one line from the learner is a bonus, not the goal.',
  beats: [
    {
      id: 'greet-and-order',
      goal: 'Dire bonjour et commander un café',
      goalEn: 'Say hello and order a coffee',
    },
    {
      id: 'say-where',
      goal: 'Dire si on le prend sur place',
      goalEn: 'Say whether it is for here or to go',
    },
    {
      id: 'pay',
      goal: 'Demander combien et payer',
      goalEn: 'Ask how much it is and pay',
    },
  ],
  goalPhrases: [
    {
      fr: 'Bonjour, je vais prendre un café',
      frWritten: null,
      en: 'Hello, I will have a coffee',
      register: 'courant',
    },
    {
      fr: 'Sur place, au comptoir, s\'il vous plaît',
      frWritten: null,
      en: 'Here at the counter, please',
      register: 'courant',
    },
    {
      fr: 'Je vous dois combien ?',
      frWritten: null,
      en: 'How much is that?',
      register: 'courant',
    },
    {
      fr: 'Un café, s\'il vous plaît',
      frWritten: null,
      en: 'A coffee, please',
      register: 'courant',
    },
    {
      fr: 'Sur place, s\'il vous plaît',
      frWritten: null,
      en: 'To have here, please',
      register: 'courant',
    },
    {
      fr: 'Je peux payer par carte ?',
      frWritten: null,
      en: 'Can I pay by card?',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: 'Il est tôt. Le café est presque vide, et la machine chauffe. Derrière le comptoir, Karim pose une tasse et lève les yeux vers vous.',
    frWritten: null,
    en: 'It is early, and the room is nearly empty. The coffee machine is warming up. Behind the counter, Karim sets down a cup and looks up at you.',
  },
  openingLine: {
    speaker: 'Karim',
    fr: 'Bonjour ! Qu\'est-ce que je vous sers ?',
    frWritten: null,
    en: 'Hello! What can I get you?',
  },
  openingSupport: {
    fullLine: {
      fr: 'Bonjour, je vais prendre un café',
      frWritten: null,
      en: 'Hello, I will have a coffee',
    },
    options: [
      {
        fr: 'Un café, s\'il vous plaît',
        en: 'A coffee, please',
      },
      {
        fr: 'Bonjour, un café, s\'il vous plaît',
        en: 'Hello, a coffee, please',
      },
      {
        fr: 'Un grand café, s\'il vous plaît',
        en: 'A large coffee, please',
      },
    ],
    hintEn: 'Say hello back, then ask for a coffee.',
  },
  cultureNotes: [
    'Say bonjour before you order. In France it comes before anything else, even at a busy counter.',
    'Un café is a small espresso. If you would rather have a longer one, ask for un café allongé.',
    'Standing at the counter is often cheaper than sitting at a table, and it is where regulars drink their morning coffee.',
  ],
};

/**
 * mission:hotel. The most transactional of the A0 scenes, which is the risk: a form being filled in.
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

/**
 * mission:restaurant. A booking made at the door in the afternoon, so it is
 * still bonjour. Hélène keeps working while she asks, one short question at a
 * time, and offers another time rather than a no. The name is the one line the
 * learner substitutes, so it is taught and never scored.
 */
const RESTAURANT_FRAME: ScenarioFrame = {
  title: 'Une table pour ce soir',
  titleEn: 'A table for tonight',
  setting: 'A small bistro in the Marais in Paris, at five in the afternoon. Chairs still up on half the tables, a chalkboard menu half written, and the owner setting out the terrace.',
  learnerRole: 'Someone stopping at a bistro door in the afternoon to book a table for tonight.',
  characters: [
    {
      name: 'Hélène',
      role: 'the owner, setting up the terrace before evening service and taking bookings at the door',
      register: 'courant',
    },
  ],
  registerGuidance: "Service French at the door of a bistro, vous from start to finish. It is still afternoon, so Hélène says bonjour, and the learner should too. She is friendly and busy: she keeps wiping tables while she talks, and her questions come one at a time and short (pour combien de personnes, vers quelle heure, c'est à quel nom). In her own chatter the ne drops (on est pas encore ouverts, y a de la place en terrasse), but her polite formulas stay whole: très bien, avec plaisir, je vous en prie. She says a time as a whole phrase, vingt heures, the way a booking book does. If a time is full she offers the nearest free one instead of a no. She never hurries the learner and never switches to tu.",
  beats: [
    {
      id: 'ask-for-table',
      goal: 'Demander une table pour deux ce soir',
      goalEn: 'Ask for a table for two tonight',
    },
    {
      id: 'say-the-time',
      goal: 'Dire à quelle heure on vient',
      goalEn: 'Say what time',
    },
    {
      id: 'give-the-name',
      goal: 'Donner son nom pour la réservation',
      goalEn: 'Give the name',
    },
    {
      id: 'confirm-and-go',
      goal: 'Confirmer et dire au revoir',
      goalEn: 'Confirm and say goodbye',
    },
  ],
  goalPhrases: [
    {
      fr: 'Bonjour, vous avez une table pour deux ce soir ?',
      frWritten: null,
      en: 'Hello, do you have a table for two tonight?',
      register: 'courant',
    },
    {
      fr: "Vers vingt heures, c'est possible ?",
      frWritten: null,
      en: 'Around eight, is that possible?',
      register: 'courant',
    },
    {
      fr: 'Un peu plus tard, ça va ?',
      frWritten: null,
      en: 'A little later, is that alright?',
      register: 'courant',
    },
    {
      fr: 'Au nom de Martin',
      frWritten: null,
      en: 'Under the name Martin',
      register: 'courant',
    },
    {
      fr: "En terrasse, si c'est possible",
      frWritten: null,
      en: 'Outside on the terrace, if possible',
      register: 'courant',
    },
    {
      fr: 'Très bien, merci',
      frWritten: null,
      en: 'Very good, thank you',
      register: 'courant',
    },
    {
      fr: 'À ce soir, alors',
      frWritten: null,
      en: 'See you tonight, then',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Il est cinq heures. Les chaises sont encore sur les tables, et une femme installe la terrasse du bistrot. Elle pose une ardoise contre le mur et se tourne vers vous.",
    frWritten: null,
    en: 'Five o\'clock, and the chairs are still up on the tables. A woman is setting out the bistro terrace. She props a chalkboard against the wall and turns to you.',
  },
  openingLine: {
    speaker: 'Hélène',
    fr: "Bonjour ! C'est pour réserver ?",
    frWritten: null,
    en: 'Hello! Are you here to book?',
  },
  openingSupport: {
    fullLine: {
      fr: 'Bonjour, vous avez une table pour deux ce soir ?',
      frWritten: null,
      en: 'Hello, do you have a table for two tonight?',
    },
    options: [
      {
        fr: 'Oui, une table pour deux, ce soir',
        en: 'Yes, a table for two, tonight',
      },
      {
        fr: 'Bonjour, je voudrais réserver pour ce soir',
        en: 'Hello, I would like to book for tonight',
      },
      {
        fr: "Oui, pour deux personnes, s'il vous plaît",
        en: 'Yes, for two people, please',
      },
    ],
    hintEn: 'Say hello back, then ask for a table for two tonight.',
  },
  cultureNotes: [
    'Dinner service in most bistros starts around half past seven, and booking at the door in the afternoon is completely normal.',
    'A table you book is yours for the evening. Nobody will bring the bill until you ask for it.',
    'On a warm evening the terrace fills first, so asking for it when you book is worth doing.',
  ],
};

/**
 * mission:pharmacie. A French pharmacist is the first stop for a minor
 * complaint, so Thomas asks before he hands anything over. His questions are
 * the scene's spine: what, since when, anything else. The dose is said as a
 * whole phrase, which is why the learner's own question about it is a phrase
 * worth keeping.
 */
const PHARMACIE_FRAME: ScenarioFrame = {
  title: 'À la pharmacie',
  titleEn: 'At the pharmacy',
  setting: 'A neighbourhood pharmacy in Bordeaux on a weekday morning. A green cross blinking outside, shelves of creams and herbal teas, and one pharmacist at the counter.',
  learnerRole: 'Someone with a sore throat asking a pharmacist for something to take.',
  characters: [
    {
      name: 'Thomas',
      role: 'the pharmacist, calm and careful, who asks a question before he hands anything over',
      register: 'courant',
    },
  ],
  registerGuidance: "Pharmacy French, vous throughout, calm and clear. Thomas asks short, practical questions one at a time, the way a pharmacist really does: depuis quand, vous avez de la fièvre, vous prenez déjà quelque chose. He says the dose as a whole phrase (trois fois par jour, pendant cinq jours) and repeats it gladly if asked. In his chatter the ne drops (c'est pas grave, faut pas en prendre plus), but his polite formulas stay whole: je vous en prie, bon rétablissement. He never uses a medical word a beginner cannot follow and never lists side effects. If the learner names something he does not catch, he touches his own throat or forehead and asks again. Tu never comes up.",
  beats: [
    {
      id: 'say-what-hurts',
      goal: 'Dire où on a mal',
      goalEn: 'Say what hurts',
    },
    {
      id: 'say-since-when',
      goal: 'Dire depuis quand',
      goalEn: 'Say since when',
    },
    {
      id: 'ask-how-to-take-it',
      goal: 'Demander comment prendre le médicament',
      goalEn: 'Ask how to take it',
    },
    {
      id: 'pay-and-thank',
      goal: 'Payer et remercier',
      goalEn: 'Pay and thank him',
    },
  ],
  goalPhrases: [
    {
      fr: "Bonjour, j'ai mal à la gorge",
      frWritten: null,
      en: 'Hello, I have a sore throat',
      register: 'courant',
    },
    {
      fr: "J'ai un peu de fièvre",
      frWritten: null,
      en: 'I have a bit of a temperature',
      register: 'courant',
    },
    {
      fr: 'Depuis hier soir',
      frWritten: null,
      en: 'Since last night',
      register: 'courant',
    },
    {
      fr: 'Je le prends combien de fois par jour ?',
      frWritten: null,
      en: 'How many times a day do I take it?',
      register: 'courant',
    },
    {
      fr: 'Faut une ordonnance ?',
      frWritten: 'Il faut une ordonnance ?',
      en: 'Do I need a prescription?',
      register: 'courant',
    },
    {
      fr: 'Je vous dois combien ?',
      frWritten: null,
      en: 'How much do I owe you?',
      register: 'courant',
    },
    {
      fr: 'Merci beaucoup, au revoir',
      frWritten: null,
      en: 'Thank you very much, goodbye',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Une croix verte clignote au-dessus de la porte. Dans la pharmacie, il fait bon et ça sent l'eucalyptus. Le pharmacien range une boîte et vous regarde.",
    frWritten: null,
    en: 'A green cross blinks above the door. Inside it is warm and smells of eucalyptus. The pharmacist puts a box back on the shelf and looks at you.',
  },
  openingLine: {
    speaker: 'Thomas',
    fr: "Bonjour ! Qu'est-ce qui vous amène ?",
    frWritten: null,
    en: 'Hello! What brings you in?',
  },
  openingSupport: {
    fullLine: {
      fr: "Bonjour, j'ai mal à la gorge",
      frWritten: null,
      en: 'Hello, I have a sore throat',
    },
    options: [
      {
        fr: "Bonjour, j'ai mal à la tête",
        en: 'Hello, I have a headache',
      },
      {
        fr: 'Vous avez quelque chose pour la gorge ?',
        en: 'Do you have something for a sore throat?',
      },
      {
        fr: "J'ai un peu de fièvre",
        en: 'I have a bit of a temperature',
      },
    ],
    hintEn: 'Say hello back, then tell him what hurts.',
  },
  cultureNotes: [
    'In France the pharmacist is the first person to ask about a sore throat or a cold, before any doctor.',
    'Even ordinary painkillers are kept behind the counter, so you ask for them rather than take them from a shelf.',
    'When the green cross is lit, the pharmacy is open. A notice on the door names the pharmacie de garde, the one open at night and on Sundays.',
  ],
};

/**
 * mission:gare. Picks up where mission:chemin leaves the learner, at the
 * station. Julien is efficient and reads his screen aloud, so the scene is
 * mostly comprehension of times and platforms, with two short questions the
 * learner keeps. Lyon is a substituted city, so the ticket line is never scored.
 */
const GARE_FRAME: ScenarioFrame = {
  title: 'Au guichet de la gare',
  titleEn: 'At the ticket desk',
  setting: 'The ticket hall at the Gare de Lyon in Paris, mid-morning. Rolling suitcases, an announcement echoing overhead, and one ticket desk open with a short queue.',
  learnerRole: 'A traveller buying a return ticket to Lyon at the station desk.',
  characters: [
    {
      name: 'Julien',
      role: 'the agent at the ticket desk, quick on his keyboard and used to visitors',
      register: 'courant',
    },
  ],
  registerGuidance: "Station French at a ticket desk, vous on both sides. Julien is efficient, not cold: he asks one thing at a time (pour quelle destination, aller simple ou aller-retour, vous partez quand) and reads what is on his screen out loud. He says times the way the timetable does, as whole phrases: onze heures quarante. In speech the ne drops (y a pas de changement, c'est pas direct), but his formulas stay whole: je vous en prie, bon voyage. He offers a choice of two trains, never five. If the learner hesitates, he turns his screen round and points. He may ask about a discount card, and non merci is a full answer. He never sells anything the learner did not ask for.",
  beats: [
    {
      id: 'ask-for-a-ticket',
      goal: 'Demander un aller-retour',
      goalEn: 'Ask for a return ticket',
    },
    {
      id: 'choose-a-train',
      goal: 'Choisir un train',
      goalEn: 'Choose a train',
    },
    {
      id: 'ask-the-platform',
      goal: 'Demander la voie',
      goalEn: 'Ask which platform',
    },
    {
      id: 'pay',
      goal: 'Payer le billet',
      goalEn: 'Pay',
    },
  ],
  goalPhrases: [
    {
      fr: "Un aller-retour pour Lyon, s'il vous plaît",
      frWritten: null,
      en: 'A return to Lyon, please',
      register: 'courant',
    },
    {
      fr: "Pour aujourd'hui, si possible",
      frWritten: null,
      en: 'For today, if possible',
      register: 'courant',
    },
    {
      fr: 'Le prochain train part à quelle heure ?',
      frWritten: null,
      en: 'What time does the next train leave?',
      register: 'courant',
    },
    {
      fr: "C'est un train direct ?",
      frWritten: null,
      en: 'Is it a direct train?',
      register: 'courant',
    },
    {
      fr: 'Celui-là, ça me va',
      frWritten: null,
      en: 'That one works for me',
      register: 'courant',
    },
    {
      fr: "C'est quelle voie ?",
      frWritten: null,
      en: 'Which platform is it?',
      register: 'courant',
    },
    {
      fr: "Par carte, s'il vous plaît",
      frWritten: null,
      en: 'By card, please',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Le grand tableau des départs change au-dessus de votre tête. Une annonce résonne dans le hall. Au guichet, la personne devant vous s'en va, et l'agent vous fait signe.",
    frWritten: null,
    en: 'The departures board flips over above your head, and an announcement echoes through the hall. At the ticket desk, the person ahead of you leaves, and the agent waves you over.',
  },
  openingLine: {
    speaker: 'Julien',
    fr: "Bonjour ! C'est pour quelle destination ?",
    frWritten: null,
    en: 'Hello! Where are you travelling to?',
  },
  openingSupport: {
    fullLine: {
      fr: "Bonjour, un aller-retour pour Lyon, s'il vous plaît",
      frWritten: null,
      en: 'Hello, a return to Lyon, please',
    },
    options: [
      {
        fr: "Un aller simple pour Lyon, s'il vous plaît",
        en: 'A one way ticket to Lyon, please',
      },
      {
        fr: 'Je voudrais un billet pour Lyon',
        en: 'I would like a ticket to Lyon',
      },
      {
        fr: "Pour Lyon, aujourd'hui, s'il vous plaît",
        en: 'To Lyon, today, please',
      },
    ],
    hintEn: 'Say hello back, then tell him where you are going and that you want a return.',
  },
  cultureNotes: [
    'Un aller simple is one way, and un aller-retour is there and back.',
    'The platform often only goes up on the board about twenty minutes before the train leaves, so people wait underneath it.',
    'At the desk you may be asked whether you have a discount card. Non, merci is a perfectly good answer.',
  ],
};

/**
 * mission:colis. A point relais in a tabac-presse, where parcels wait between
 * lottery tickets and newspapers. Sandrine's three questions always come in
 * the same order, which is what makes the scene learnable: the name, the code,
 * the ID. The code arrives by text, and the name is substituted, so neither
 * line is scored.
 */
const COLIS_FRAME: ScenarioFrame = {
  title: 'Au point relais',
  titleEn: 'At the parcel pickup',
  setting: 'A tabac-presse on a busy corner in Lille, late afternoon. Newspapers by the door, a lottery queue at one end of the counter, and parcels stacked on shelves behind it.',
  learnerRole: 'A customer collecting a parcel from the pickup point in a corner shop.',
  characters: [
    {
      name: 'Sandrine',
      role: 'the owner behind the counter, who runs the parcel shelf between lottery tickets',
      register: 'courant',
    },
  ],
  registerGuidance: "Shop French across a counter, vous throughout. Sandrine is quick and friendly and does three things at once. Her questions are the ones every pickup point asks, in this order: c'est à quel nom, vous avez le code, vous avez une pièce d'identité. She reads the code back to check it. In her chatter the ne drops (y a pas de souci, je le vois pas, attendez), but bonjour, merci and bonne journée stay whole. She goes to the shelves to look and keeps talking while she searches. If the parcel is not there straight away she looks again rather than saying no. When she needs a signature she turns the screen round and says là, s'il vous plaît. She never uses tu with a customer.",
  beats: [
    {
      id: 'say-why-you-came',
      goal: "Dire qu'on vient chercher un colis",
      goalEn: 'Say you are collecting a parcel',
    },
    {
      id: 'give-name-and-code',
      goal: 'Donner son nom et le code',
      goalEn: 'Give the name and code',
    },
    {
      id: 'show-id',
      goal: "Montrer une pièce d'identité",
      goalEn: 'Show ID',
    },
    {
      id: 'check-and-go',
      goal: 'Vérifier le colis et partir',
      goalEn: 'Check it and go',
    },
  ],
  goalPhrases: [
    {
      fr: 'Bonjour, je viens chercher un colis',
      frWritten: null,
      en: 'Hello, I have come to pick up a parcel',
      register: 'courant',
    },
    {
      fr: "C'est au nom de Martin",
      frWritten: null,
      en: "It's under the name Martin",
      register: 'courant',
    },
    {
      fr: "J'ai reçu un code par SMS",
      frWritten: null,
      en: 'I got a code by text message',
      register: 'courant',
    },
    {
      fr: 'Je vous montre ?',
      frWritten: null,
      en: 'Shall I show you?',
      register: 'courant',
    },
    {
      fr: "Voilà ma pièce d'identité",
      frWritten: null,
      en: 'Here is my ID',
      register: 'courant',
    },
    {
      fr: "Oui, c'est bien ça, merci",
      frWritten: null,
      en: 'Yes, that is the one, thanks',
      register: 'courant',
    },
    {
      fr: 'Bonne fin de journée !',
      frWritten: null,
      en: 'Have a good rest of the day!',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Des journaux sont empilés près de la porte. Au comptoir, deux personnes attendent pour le loto. Derrière, des colis s'entassent sur une étagère. La patronne vous fait signe d'avancer.",
    frWritten: null,
    en: 'Newspapers are stacked by the door. Two people wait at the counter for lottery tickets, and behind it parcels are piled on a shelf. The owner waves you forward.',
  },
  openingLine: {
    speaker: 'Sandrine',
    fr: "Bonjour ! Qu'est-ce que je vous donne ?",
    frWritten: null,
    en: 'Hello! What can I get you?',
  },
  openingSupport: {
    fullLine: {
      fr: 'Bonjour, je viens chercher un colis',
      frWritten: null,
      en: 'Hello, I have come to pick up a parcel',
    },
    options: [
      {
        fr: "Bonjour, j'ai un colis à retirer",
        en: 'Hello, I have a parcel to collect',
      },
      {
        fr: "Bonjour, c'est pour un colis",
        en: 'Hello, it is for a parcel',
      },
      {
        fr: "J'ai reçu un code par SMS",
        en: 'I got a code by text message',
      },
    ],
    hintEn: 'Say hello back, then tell her you are here for a parcel.',
  },
  cultureNotes: [
    'Many parcels in France go to a point relais, a local shop that holds them for you, rather than to your door.',
    'Bring the code from your text message and some ID. Without the ID, most shops will not hand the parcel over.',
    'A tabac-presse sells newspapers, stamps and lottery tickets, and people queue for all three, so the parcel counter can mean a short wait.',
  ],
};

/**
 * mission:voisin. The one A1 scene with no transaction at all: a first meeting
 * on the landing, with a neighbour who has lived there for decades and stays
 * on vous. Monique carries the conversation, so the learner's load is short
 * answers and two good questions. Where the learner is from is substituted, so
 * it is taught and never scored.
 */
const VOISIN_FRAME: ScenarioFrame = {
  title: 'Sur le palier',
  titleEn: 'On the landing',
  setting: 'The third-floor landing of an old building in Strasbourg, early evening. Moving boxes against the wall, a stairwell light on a timer, and the door opposite opening.',
  learnerRole: 'Someone who has just moved into the building, carrying the last boxes upstairs.',
  characters: [
    {
      name: 'Monique',
      role: 'the retired neighbour across the landing, who sorts the post and knows everyone in the building',
      register: 'courant',
    },
  ],
  registerGuidance: "Two neighbours who have just met, so vous, and it stays vous. Monique is warm, curious and happy to talk, and she asks one thing at a time: vous venez d'où, vous êtes là pour le travail, ça vous plaît, le quartier. She talks like anyone at home in her own building: the ne drops (c'est pas loin, y a tout ce qu'il faut), and she tells little stories about the other residents without gossiping. Bonjour, bienvenue and bonne soirée stay whole. She has opinions on the bakery, the market day and the bins, and gives one tip at a time. She never pushes for personal details and never offers tu at a first meeting. A few words from the learner are enough for her to keep going.",
  beats: [
    {
      id: 'say-you-moved-in',
      goal: "Dire qu'on vient d'emménager",
      goalEn: 'Say you just moved in',
    },
    {
      id: 'say-where-from',
      goal: "Dire d'où on vient",
      goalEn: 'Say where you are from',
    },
    {
      id: 'chat-about-the-area',
      goal: 'Parler du quartier',
      goalEn: 'Chat about the area',
    },
    {
      id: 'ask-for-a-tip',
      goal: 'Demander un bon conseil',
      goalEn: 'Ask for a tip',
    },
    {
      id: 'say-goodbye',
      goal: 'Se dire au revoir',
      goalEn: 'Say goodbye',
    },
  ],
  goalPhrases: [
    {
      fr: "Bonjour, je viens d'emménager au troisième",
      frWritten: null,
      en: 'Hello, I have just moved in on the third floor',
      register: 'courant',
    },
    {
      fr: "Je viens d'Angleterre",
      frWritten: null,
      en: 'I am from England',
      register: 'courant',
    },
    {
      fr: 'Vous habitez ici depuis longtemps ?',
      frWritten: null,
      en: 'Have you lived here long?',
      register: 'courant',
    },
    {
      fr: "Le quartier a l'air calme",
      frWritten: null,
      en: 'The area seems quiet',
      register: 'courant',
    },
    {
      fr: 'Y a une bonne boulangerie dans le coin ?',
      frWritten: 'Il y a une bonne boulangerie dans le coin ?',
      en: 'Is there a good bakery around here?',
      register: 'courant',
    },
    {
      fr: "Merci, c'est gentil",
      frWritten: null,
      en: "Thanks, that's kind of you",
      register: 'courant',
    },
    {
      fr: 'Bonne soirée, à bientôt',
      frWritten: null,
      en: 'Have a good evening, see you soon',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Vous montez le dernier carton au troisième étage, et la lumière de l'escalier s'éteint. La porte d'en face s'ouvre. Une dame aux cheveux blancs vous regarde avec curiosité.",
    frWritten: null,
    en: 'You carry the last box up to the third floor, and the stairwell light clicks off. The door opposite opens. A woman with white hair looks at you with interest.',
  },
  openingLine: {
    speaker: 'Monique',
    fr: "Bonjour ! C'est vous qui venez d'emménager ?",
    frWritten: null,
    en: 'Hello! Are you the one who just moved in?',
  },
  openingSupport: {
    fullLine: {
      fr: "Oui, bonjour, je viens d'emménager",
      frWritten: null,
      en: 'Yes, hello, I have just moved in',
    },
    options: [
      {
        fr: "Oui, c'est moi. Bonjour !",
        en: 'Yes, that is me. Hello!',
      },
      {
        fr: "Oui, j'emménage cette semaine",
        en: 'Yes, I am moving in this week',
      },
      {
        fr: "Bonjour, je viens d'emménager au troisième",
        en: 'Hello, I have just moved in on the third floor',
      },
    ],
    hintEn: 'Say hello back, and tell her you have just moved in.',
  },
  cultureNotes: [
    'Neighbours in a French building say bonjour on the stairs, even when they barely know each other.',
    'An older neighbour will often keep vous for years. Leave it to them to offer tu.',
    'A long-time neighbour knows which bakery is worth the walk and which day the market comes. Asking is the quickest way in.',
  ],
};

/**
 * mission:week-end. The first A2 scene, and the first where the learner tells
 * something that already happened. Monday at the coffee machine, so the past
 * tense is the whole point: what you did, one detail, then their turn. Lucas is
 * a colleague, not a friend yet, which is exactly why he is familier and tu
 * from the first word: that is how a French office talks by the machine.
 */
const WEEK_END_FRAME: ScenarioFrame = {
  title: 'Alors, ce week-end ?',
  titleEn: 'So, the weekend?',
  setting: 'The coffee machine on the second floor of an office in Nantes, on a Monday morning. Paper cups, a fridge covered in notes, and laptops not yet opened.',
  learnerRole: 'Someone who works in the office, getting a coffee before the first meeting.',
  characters: [
    {
      name: 'Lucas',
      role: 'a colleague from the next desk, chatty on a Monday, always with a story of his own',
      register: 'familier',
    },
  ],
  registerGuidance: "Office chat by the coffee machine, and tu from the first word: colleagues of the same level say tu in most French offices, and vous here would sound stiff. Lucas is relaxed and quick. The ne is gone everywhere (c'était pas mal, j'ai pas bougé), and he squeezes words the way people do on a Monday: t'as fait quoi, j'suis crevé, y a eu du monde. He reacts out loud to everything with ouais, trop bien, ah ouais, c'était top. He asks one follow-up question about the learner's weekend before he tells his own, and his own story is short and a little funny. He never uses argot a learner cannot follow, never switches to vous, and never turns the chat into a quiz.",
  beats: [
    {
      id: 'say-what-you-did',
      goal: 'Dire ce qu’on a fait ce week-end',
      goalEn: 'Say what you did',
    },
    {
      id: 'add-a-detail',
      goal: 'Ajouter un détail',
      goalEn: 'Add a detail',
    },
    {
      id: 'ask-about-theirs',
      goal: 'Lui demander son week-end',
      goalEn: 'Ask about theirs',
    },
    {
      id: 'react',
      goal: 'Réagir à son histoire',
      goalEn: 'React',
    },
    {
      id: 'back-to-work',
      goal: 'Retourner au travail',
      goalEn: 'Head back to work',
    },
  ],
  goalPhrases: [
    {
      fr: "Samedi, j'ai vu des amis",
      frWritten: null,
      en: 'On Saturday I saw some friends',
      register: 'courant',
    },
    {
      fr: "On a mangé au resto, c'était top",
      frWritten: null,
      en: 'We ate out, it was great',
      register: 'familier',
    },
    {
      fr: "Dimanche, j'ai rien fait",
      frWritten: "Dimanche, je n'ai rien fait",
      en: 'On Sunday I did nothing at all',
      register: 'familier',
    },
    {
      fr: "Et toi, t'as fait quoi ?",
      frWritten: 'Et toi, tu as fait quoi ?',
      en: 'And you, what did you do?',
      register: 'familier',
    },
    {
      fr: 'Ah ouais, trop bien !',
      frWritten: null,
      en: 'Oh yeah, brilliant!',
      register: 'familier',
    },
    {
      fr: "C'était comment ?",
      frWritten: null,
      en: 'How was it?',
      register: 'courant',
    },
    {
      fr: "Bon, j'y retourne",
      frWritten: null,
      en: 'Right, back to it',
      register: 'familier',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Lundi matin. La machine à café fait un bruit terrible. Lucas attend son gobelet, les yeux encore un peu fermés, et il vous voit arriver.",
    frWritten: null,
    en: 'Monday morning, and the coffee machine is making a terrible noise. Lucas is waiting for his paper cup, eyes still half shut, and he sees you coming.',
  },
  openingLine: {
    speaker: 'Lucas',
    fr: "Salut ! Alors, ce week-end, c'était comment ?",
    frWritten: null,
    en: 'Hey! So, how was the weekend?',
  },
  openingSupport: {
    fullLine: {
      fr: "Salut ! C'était top. Samedi, j'ai vu des amis",
      frWritten: null,
      en: 'Hey! It was great. On Saturday I saw some friends',
    },
    options: [
      {
        fr: "Salut ! On a mangé au resto, c'était top",
        en: 'Hey! We ate out, it was great',
      },
      {
        fr: "Pas mal ! Dimanche, j'ai rien fait",
        en: 'Pretty good! On Sunday I did nothing at all',
      },
      {
        fr: "Salut ! C'était bien, et toi ?",
        en: 'Hey! It was good, and you?',
      },
    ],
    hintEn: 'Say hi back, then say one thing you did at the weekend.',
  },
  cultureNotes: [
    'Monday morning by the coffee machine is where a French office catches up. Asking about the weekend is the usual opener.',
    'Colleagues at the same level usually say tu to each other, even on the first week. Your manager may be a different story.',
    'C’était top and trop bien are everyday praise among colleagues. Nobody expects a long story, just one detail.',
  ],
};

/**
 * mission:collegues. A first day at work, and the scene where tu is offered.
 * Isabelle is the manager, so she opens with vous and is the one who proposes
 * tu in beat three; the learner's job is to accept it and then use it. The
 * practical question after that beat is asked with tu on purpose, so the
 * switch is practised and not only described.
 */
const COLLEGUES_FRAME: ScenarioFrame = {
  title: 'Le premier jour',
  titleEn: 'The first day',
  setting: 'A bright open-plan office in Lille, at nine in the morning on a first day. A new laptop still in its box, a badge on a lanyard, and the team manager coming over with two coffees.',
  learnerRole: 'Someone starting a new job today, meeting the team manager for the first time.',
  characters: [
    {
      name: 'Isabelle',
      role: 'the team manager, warm and organised, who shows every newcomer round herself',
      register: 'courant',
    },
  ],
  registerGuidance: "Workplace French on a first morning. Isabelle starts with vous, because she is the manager and has only just met the learner. Once the learner has said who they are and what they did before, she offers tu herself, lightly: on peut se tutoyer, si vous voulez. From then on she says tu and expects tu back. In her chatter the ne drops (c'est pas compliqué, t'inquiète pas), but she speaks clearly and not fast, and she explains office words when she uses them. She asks about the learner's last job with real interest and reacts to it. She never says tu before she has offered it, never takes offence if the learner slips back to vous, and never lists rules or procedures.",
  beats: [
    {
      id: 'say-who-and-role',
      goal: 'Se présenter et dire son poste',
      goalEn: 'Say who you are and your role',
    },
    {
      id: 'say-what-before',
      goal: 'Dire ce qu’on faisait avant',
      goalEn: 'Say what you did before',
    },
    {
      id: 'accept-tu',
      goal: 'Accepter de se tutoyer',
      goalEn: 'Accept the offer of tu',
    },
    {
      id: 'ask-a-practical-thing',
      goal: 'Poser une question pratique',
      goalEn: 'Ask one practical thing',
    },
    {
      id: 'thank-her',
      goal: 'La remercier',
      goalEn: 'Thank her',
    },
  ],
  goalPhrases: [
    {
      fr: "Bonjour, je commence aujourd'hui dans l'équipe",
      frWritten: null,
      en: 'Hello, I start in the team today',
      register: 'courant',
    },
    {
      fr: "Je vais m'occuper des clients",
      frWritten: null,
      en: 'I am going to look after the clients',
      register: 'courant',
    },
    {
      fr: 'Avant, je travaillais dans une banque',
      frWritten: null,
      en: 'Before, I used to work in a bank',
      register: 'courant',
    },
    {
      fr: "D'accord, on se tutoie",
      frWritten: null,
      en: 'Sure, let us say tu to each other',
      register: 'courant',
    },
    {
      fr: 'Tu peux me montrer la cantine ?',
      frWritten: null,
      en: 'Can you show me the canteen?',
      register: 'courant',
    },
    {
      fr: 'On mange à quelle heure, en général ?',
      frWritten: null,
      en: 'What time do people usually eat?',
      register: 'courant',
    },
    {
      fr: "Merci pour l'accueil",
      frWritten: null,
      en: 'Thanks for the welcome',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Votre badge pend encore à son cordon tout neuf. Un ordinateur attend dans sa boîte sur votre bureau. Une femme arrive avec deux cafés et vous en tend un.",
    frWritten: null,
    en: 'Your badge is still hanging from a brand new lanyard, and a laptop waits in its box on your desk. A woman walks over with two coffees and hands you one.',
  },
  openingLine: {
    speaker: 'Isabelle',
    fr: "Bonjour ! Vous êtes la nouvelle recrue, c'est ça ? Moi, c'est Isabelle.",
    frWritten: null,
    en: 'Hello! You are the new recruit, right? I am Isabelle.',
  },
  openingSupport: {
    fullLine: {
      fr: "Oui, bonjour, je commence aujourd'hui dans l'équipe",
      frWritten: null,
      en: 'Yes, hello, I start in the team today',
    },
    options: [
      {
        fr: "Oui, c'est moi. Bonjour, Isabelle !",
        en: 'Yes, that is me. Hello, Isabelle!',
      },
      {
        fr: "Bonjour ! Je vais m'occuper des clients",
        en: 'Hello! I am going to look after the clients',
      },
      {
        fr: 'Oui, bonjour, merci pour le café',
        en: 'Yes, hello, thanks for the coffee',
      },
    ],
    hintEn: 'Say hello back, and tell her you are starting today.',
  },
  cultureNotes: [
    'Tu is offered, not taken. At work the manager or the older person usually proposes it, and accepting is the friendly answer.',
    'Once you have agreed to say tu, going back to vous can feel cold, so it is fine to slip once and then stick with tu.',
    'Lunch is a real break in most French offices, and a newcomer is often taken along by the team on the first day.',
  ],
};

/**
 * mission:telephone. Booking an appointment by phone, which is hard for the one
 * reason a face-to-face scene is not: there is no face. Nathalie spells and
 * repeats whenever asked, so asking her to is part of the scene, not a failure
 * of it. The learner spells their own name, so the name is taught and never
 * scored. The appointment booked here is the one mission:medecin then keeps.
 */
const TELEPHONE_FRAME: ScenarioFrame = {
  title: 'Prendre rendez-vous',
  titleEn: 'Booking an appointment',
  setting: "A phone call to a doctor's practice in Toulouse, mid-morning. The learner is at home with a pen and the back of an envelope; at the other end a secretary has the diary open on her screen.",
  learnerRole: 'Someone phoning a GP practice to book an appointment for a cough that will not go away.',
  characters: [
    {
      name: 'Nathalie',
      role: 'the practice secretary, patient and precise, who has taken this call a thousand times',
      register: 'courant',
    },
  ],
  registerGuidance: "Phone French at a doctor's practice, vous throughout, and a touch more formal than at a counter, because that is how a secretary answers: cabinet médical, bonjour, je vous écoute. Nathalie speaks clearly and a little slower on the phone. She offers one slot at a time and says it in full, with the day and the time (jeudi à dix heures). In her chatter the ne sometimes drops (c'est pas grave), but her formulas stay whole: je vous en prie, ne quittez pas, je vous remercie. She asks the learner to spell the name and writes it letter by letter, saying each one back. Whenever the learner asks her to repeat, she does, gladly and more slowly. She never rushes, never sighs and never says tu.",
  beats: [
    {
      id: 'say-why-calling',
      goal: 'Dire pourquoi on appelle',
      goalEn: 'Say why you are calling',
    },
    {
      id: 'take-or-turn-down-slot',
      goal: 'Accepter ou refuser un créneau',
      goalEn: 'Take or turn down a slot',
    },
    {
      id: 'spell-your-name',
      goal: 'Épeler son nom',
      goalEn: 'Spell your name',
    },
    {
      id: 'repeat-back',
      goal: 'Répéter le jour et l’heure',
      goalEn: 'Repeat the date and time back',
    },
  ],
  goalPhrases: [
    {
      fr: 'Bonjour, je voudrais prendre rendez-vous',
      frWritten: null,
      en: 'Hello, I would like to make an appointment',
      register: 'courant',
    },
    {
      fr: "Pardon, j'ai pas bien entendu",
      frWritten: "Pardon, je n'ai pas bien entendu",
      en: 'Sorry, I did not quite catch that',
      register: 'courant',
    },
    {
      fr: 'Vous auriez quelque chose plus tôt ?',
      frWritten: null,
      en: 'Would you have anything earlier?',
      register: 'courant',
    },
    {
      fr: 'Oui, ça me va très bien',
      frWritten: null,
      en: 'Yes, that suits me fine',
      register: 'courant',
    },
    {
      fr: "Je vous l'épelle",
      frWritten: null,
      en: 'I will spell it for you',
      register: 'courant',
    },
    {
      fr: "Jeudi à dix heures, c'est bien ça ?",
      frWritten: null,
      en: 'Thursday at ten, is that right?',
      register: 'courant',
    },
    {
      fr: 'Merci, bonne journée',
      frWritten: null,
      en: 'Thank you, have a good day',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Vous tenez le téléphone d'une main et un stylo de l'autre. Ça sonne une fois, deux fois. Puis une voix calme décroche.",
    frWritten: null,
    en: 'Phone in one hand and a pen in the other, you listen to it ring once, then twice. Then a calm voice picks up.',
  },
  openingLine: {
    speaker: 'Nathalie',
    fr: 'Cabinet médical, bonjour. Je vous écoute.',
    frWritten: null,
    en: 'Medical practice, good morning. How can I help?',
  },
  openingSupport: {
    fullLine: {
      fr: 'Bonjour, je voudrais prendre rendez-vous',
      frWritten: null,
      en: 'Hello, I would like to make an appointment',
    },
    options: [
      {
        fr: 'Bonjour, je voudrais voir un médecin, si possible',
        en: 'Hello, I would like to see a doctor, if possible',
      },
      {
        fr: "Bonjour, c'est pour un rendez-vous",
        en: 'Hello, it is about an appointment',
      },
      {
        fr: "Pardon, j'ai pas bien entendu",
        en: 'Sorry, I did not quite catch that',
      },
    ],
    hintEn: 'Say hello back, then say you would like an appointment.',
  },
  cultureNotes: [
    'On the phone, French people spell with names: A comme Anatole, B comme Berthe. Saying each letter clearly works just as well.',
    'Asking someone to repeat on the phone is completely normal. A secretary would rather say it twice than book a day you did not mean.',
    'Many people now book a doctor online, but the practice phone line is still how you find a slot at short notice.',
  ],
};

/**
 * mission:medecin. Keeps the appointment mission:telephone booked. Dr Benali
 * runs a real consultation: what the trouble is, since when, any fever, then a
 * treatment. Her questions are the scene's spine, and the learner's own
 * question about how long to take it is the line worth keeping.
 */
const MEDECIN_FRAME: ScenarioFrame = {
  title: 'Chez le médecin',
  titleEn: 'At the doctor',
  setting: "A GP's consulting room in Toulouse on a weekday morning. A desk with a computer, an examination couch with paper on it, and a box of tissues within reach.",
  learnerRole: 'A patient with a cough that has lasted a week, keeping the appointment booked by phone.',
  characters: [
    {
      name: 'Dr Benali',
      role: 'the GP, kind and direct, who listens first and types while she listens',
      register: 'courant',
    },
  ],
  registerGuidance: "Consultation French, vous throughout. Dr Benali is calm, direct and kind. She asks one question at a time, the ones a doctor really asks: qu'est-ce qui vous amène, depuis quand, vous avez de la fièvre, vous dormez bien. She listens, says d'accord or je vois, and types while the learner talks. She explains the treatment in a short whole phrase (un sirop, trois fois par jour, pendant une semaine) and repeats it if asked. In her speech the ne drops now and then (c'est pas grave, faut pas vous inquiéter), but her formulas stay whole. She never uses a medical word a learner at this level cannot follow without explaining it, never alarms, never lists side effects, and never says tu.",
  beats: [
    {
      id: 'say-what-is-wrong',
      goal: 'Dire ce qui ne va pas',
      goalEn: 'Say what the trouble is',
    },
    {
      id: 'say-since-when',
      goal: 'Dire depuis quand',
      goalEn: 'Say since when',
    },
    {
      id: 'answer-her-questions',
      goal: 'Répondre à ses questions',
      goalEn: 'Answer her questions',
    },
    {
      id: 'ask-about-treatment',
      goal: 'Poser une question sur le traitement',
      goalEn: 'Ask about the treatment',
    },
    {
      id: 'thank-her',
      goal: 'La remercier',
      goalEn: 'Thank her',
    },
  ],
  goalPhrases: [
    {
      fr: 'Je tousse beaucoup, surtout la nuit',
      frWritten: null,
      en: 'I cough a lot, especially at night',
      register: 'courant',
    },
    {
      fr: 'Depuis la semaine dernière',
      frWritten: null,
      en: 'Since last week',
      register: 'courant',
    },
    {
      fr: 'Ça a commencé il y a trois jours',
      frWritten: null,
      en: 'It started three days ago',
      register: 'courant',
    },
    {
      fr: "Non, j'ai pas de fièvre",
      frWritten: "Non, je n'ai pas de fièvre",
      en: 'No, I do not have a temperature',
      register: 'courant',
    },
    {
      fr: 'Je dors mal',
      frWritten: null,
      en: 'I am not sleeping well',
      register: 'courant',
    },
    {
      fr: 'Je dois le prendre pendant combien de temps ?',
      frWritten: null,
      en: 'How long do I need to take it for?',
      register: 'courant',
    },
    {
      fr: 'Merci beaucoup, docteur',
      frWritten: null,
      en: 'Thank you very much, doctor',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "C'est le rendez-vous pris au téléphone. La docteure Benali vous fait entrer, ferme la porte et s'assoit derrière son bureau.",
    frWritten: null,
    en: 'This is the appointment you booked on the phone. Dr Benali shows you in, closes the door and sits down behind her desk.',
  },
  openingLine: {
    speaker: 'Dr Benali',
    fr: "Bonjour, asseyez-vous. Qu'est-ce qui ne va pas ?",
    frWritten: null,
    en: 'Hello, have a seat. What seems to be the trouble?',
  },
  openingSupport: {
    fullLine: {
      fr: 'Bonjour, je tousse beaucoup, surtout la nuit',
      frWritten: null,
      en: 'Hello, I cough a lot, especially at night',
    },
    options: [
      {
        fr: 'Je tousse depuis la semaine dernière',
        en: 'I have been coughing since last week',
      },
      {
        fr: "J'ai mal à la gorge et je dors mal",
        en: 'I have a sore throat and I am not sleeping well',
      },
      {
        fr: "Bonjour, docteur. Ça a commencé il y a une semaine",
        en: 'Hello, doctor. It started a week ago',
      },
    ],
    hintEn: 'Say hello back, then tell her what the trouble is.',
  },
  cultureNotes: [
    'In France you usually pay the doctor at the end of the visit. With a carte Vitale, the Assurance Maladie pays most of it back within a few days.',
    'A French doctor will often ask about sleep and appetite as well as the main problem. It is routine, not a worry.',
    'The prescription goes to the pharmacy, where the pharmacist explains it again. Asking twice is normal.',
  ],
};

/**
 * mission:retour. Taking something back that does not work, and the first
 * scene where the learner has to hold a position politely. Mehdi offers a
 * credit note first, because that is what shops do; the learner's job is to
 * ask for a refund and, if needed, a manager, without raising their voice.
 */
const RETOUR_FRAME: ScenarioFrame = {
  title: 'Rapporter un article',
  titleEn: 'Taking something back',
  setting: 'The returns counter of a household goods shop in Marseille, on a Saturday afternoon. Shelves of pans and lamps, a queue at the tills, and a kettle in a box on the counter.',
  learnerRole: 'A customer bringing back a kettle that stopped working after two days.',
  characters: [
    {
      name: 'Mehdi',
      role: 'the sales assistant at the returns counter, polite and by the book, who offers a credit note first',
      register: 'courant',
    },
  ],
  registerGuidance: "Shop French at a returns counter, vous on both sides. Mehdi is polite and a little by the book. He asks what the problem is, asks for the receipt, and then offers what the shop prefers: un avoir or an exchange. In his chatter the ne drops (ça marche pas, c'est pas possible), but his formulas stay whole: je vous en prie, pas de souci, je comprends. If the learner insists on a refund calmly, he hesitates once, then says he will check with his manager, and comes back with a yes. He keeps every sentence short. He never argues, never suggests the learner broke it, never refuses outright and never says tu. Polite insistence is what works here, and he rewards it by moving.",
  beats: [
    {
      id: 'explain-it-does-not-work',
      goal: 'Expliquer que ça ne marche pas',
      goalEn: 'Explain it does not work',
    },
    {
      id: 'show-the-receipt',
      goal: 'Montrer le ticket de caisse',
      goalEn: 'Show the receipt',
    },
    {
      id: 'ask-exchange-or-refund',
      goal: 'Demander un échange ou un remboursement',
      goalEn: 'Ask for an exchange or refund',
    },
    {
      id: 'insist-politely',
      goal: 'Insister poliment',
      goalEn: 'Insist politely',
    },
    {
      id: 'leave',
      goal: 'Remercier et partir',
      goalEn: 'Leave',
    },
  ],
  goalPhrases: [
    {
      fr: "Bonjour, j'ai un problème avec cette bouilloire",
      frWritten: null,
      en: 'Hello, I have a problem with this kettle',
      register: 'courant',
    },
    {
      fr: 'Elle marche pas',
      frWritten: 'Elle ne marche pas',
      en: 'It does not work',
      register: 'courant',
    },
    {
      fr: "J'ai gardé le ticket de caisse",
      frWritten: null,
      en: 'I kept the receipt',
      register: 'courant',
    },
    {
      fr: 'Je préfère un remboursement',
      frWritten: null,
      en: 'I would rather have a refund',
      register: 'courant',
    },
    {
      fr: "Je comprends, mais un avoir, ça m'arrange pas",
      frWritten: "Je comprends, mais un avoir, ça ne m'arrange pas",
      en: 'I understand, but a credit note does not really suit me',
      register: 'courant',
    },
    {
      fr: "C'est possible de voir avec un responsable ?",
      frWritten: null,
      en: 'Could you check with a manager?',
      register: 'courant',
    },
    {
      fr: 'Merci pour votre aide',
      frWritten: null,
      en: 'Thank you for your help',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Vous posez la boîte de la bouilloire sur le comptoir des retours. Derrière, un vendeur finit d'étiqueter des lampes et relève la tête.",
    frWritten: null,
    en: 'Setting the kettle box down on the returns counter, you wait. Behind it a sales assistant finishes labelling some lamps and looks up.',
  },
  openingLine: {
    speaker: 'Mehdi',
    fr: 'Bonjour ! Vous venez pour un retour ?',
    frWritten: null,
    en: 'Hello! Are you here to return something?',
  },
  openingSupport: {
    fullLine: {
      fr: "Oui, bonjour, j'ai un problème avec cette bouilloire",
      frWritten: null,
      en: 'Yes, hello, I have a problem with this kettle',
    },
    options: [
      {
        fr: 'Oui, elle marche pas',
        en: 'Yes, it does not work',
      },
      {
        fr: "Bonjour, je l'ai achetée ici, et elle marche pas",
        en: 'Hello, I bought it here, and it does not work',
      },
      {
        fr: "Oui, j'ai gardé le ticket de caisse",
        en: 'Yes, I kept the receipt',
      },
    ],
    hintEn: 'Say hello back, then say what the problem is with what you bought.',
  },
  cultureNotes: [
    'Shops often offer un avoir first, a credit note to spend in the same shop. You can politely ask for a refund instead.',
    'Keep the ticket de caisse. Without it, many shops will not take the item back at all.',
    'Asking to see un responsable, the manager, is normal and not rude, as long as it is asked calmly.',
  ],
};

/**
 * mission:appartement. A flat viewing, which is mostly the learner asking and
 * Céline answering. The four questions that matter in France are the scene's
 * spine: is the rent charges comprises, when is it free, what goes in the
 * dossier, and is a garant needed. Céline answers each one plainly, because
 * she has twelve more viewings that day.
 */
const APPARTEMENT_FRAME: ScenarioFrame = {
  title: 'Visiter un appartement',
  titleEn: 'Viewing a flat',
  setting: 'An empty two-room flat on the fourth floor of an old building in Lyon, on a Saturday morning. Bare floorboards, tall windows, a radiator ticking, and the letting agent with a folder under her arm.',
  learnerRole: 'Someone looking for a flat to rent, at a viewing with the letting agent.',
  characters: [
    {
      name: 'Céline',
      role: 'the letting agent, brisk and friendly, with a folder of listings and a busy morning',
      register: 'courant',
    },
  ],
  registerGuidance: "Letting-agent French at a viewing, vous throughout. Céline is brisk and friendly: she walks ahead, opens doors and names each room as she goes. She answers each question plainly and with the figure first (sept cent cinquante euros, charges comprises). In her chatter the ne drops (y a pas d'ascenseur, faut un garant), but her formulas stay whole: je vous en prie, n'hésitez pas. She explains the dossier in one short list (pièce d'identité, trois fiches de paie, un garant) and repeats it if asked. She expects the learner to ask the questions, so she waits after each room. She never pressures the learner to sign, never guesses at things she does not know, and never says tu.",
  beats: [
    {
      id: 'ask-about-rent',
      goal: 'Demander le loyer',
      goalEn: 'Ask about the rent',
    },
    {
      id: 'ask-about-the-flat',
      goal: 'Poser une question sur l’appartement',
      goalEn: 'Ask about the flat',
    },
    {
      id: 'ask-when-free',
      goal: 'Demander quand il est libre',
      goalEn: 'Ask when it is free',
    },
    {
      id: 'ask-about-the-file',
      goal: 'Demander ce qu’il faut pour le dossier',
      goalEn: 'Ask what the file needs',
    },
    {
      id: 'say-you-are-interested',
      goal: 'Dire que l’appartement plaît',
      goalEn: 'Say you are interested',
    },
  ],
  goalPhrases: [
    {
      fr: "Le loyer, c'est charges comprises ?",
      frWritten: null,
      en: 'Does the rent include the bills?',
      register: 'courant',
    },
    {
      fr: "Y a un ascenseur ?",
      frWritten: 'Il y a un ascenseur ?',
      en: 'Is there a lift?',
      register: 'courant',
    },
    {
      fr: 'Il est libre à partir de quand ?',
      frWritten: null,
      en: 'When is it free from?',
      register: 'courant',
    },
    {
      fr: "Qu'est-ce qu'il faut pour le dossier ?",
      frWritten: null,
      en: 'What do you need for the application?',
      register: 'courant',
    },
    {
      fr: 'Faut un garant ?',
      frWritten: 'Il faut un garant ?',
      en: 'Do I need a guarantor?',
      register: 'courant',
    },
    {
      fr: 'Il me plaît beaucoup',
      frWritten: null,
      en: 'I like it a lot',
      register: 'courant',
    },
    {
      fr: 'Je vous envoie mon dossier ce soir',
      frWritten: null,
      en: 'I will send you my application tonight',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "La porte s'ouvre sur un appartement vide. Le parquet craque, le soleil entre par deux grandes fenêtres. L'agente pose son dossier sur le rebord et se retourne.",
    frWritten: null,
    en: 'Sunlight pours through two tall windows into an empty flat, and the floorboards creak. The letting agent sets her folder on the sill and turns round.',
  },
  openingLine: {
    speaker: 'Céline',
    fr: 'Bonjour ! Alors, voilà le salon. Vous avez des questions ?',
    frWritten: null,
    en: 'Hello! So, this is the living room. Do you have any questions?',
  },
  openingSupport: {
    fullLine: {
      fr: "Bonjour ! Le loyer, c'est charges comprises ?",
      frWritten: null,
      en: 'Hello! Does the rent include the bills?',
    },
    options: [
      {
        fr: 'Oui, il est libre à partir de quand ?',
        en: 'Yes, when is it free from?',
      },
      {
        fr: "Oui, y a un ascenseur ?",
        en: 'Yes, is there a lift?',
      },
      {
        fr: 'Il est très clair, il me plaît beaucoup',
        en: 'It is very bright, I like it a lot',
      },
    ],
    hintEn: 'Say hello back, then ask whether the rent includes the bills.',
  },
  cultureNotes: [
    'Charges comprises means the rent includes shared building costs such as heating or bins. Hors charges means they come on top.',
    'Landlords in France ask for a dossier: ID, recent payslips and often a garant, someone who agrees to pay if you cannot.',
    'Good flats go fast in big cities. Having your dossier ready on the day of the viewing makes a real difference.',
  ],
};

/**
 * mission:belle-famille. Dinner with a partner's parents, the last and warmest
 * A2 scene. Two characters, both vous, because that is the safe default with a
 * partner's parents until they offer otherwise. The beats are the evening
 * itself: the gift at the door, questions about you, the food, plans for the
 * summer in the futur proche, and thanks at the end of the night.
 */
const BELLE_FAMILLE_FRAME: ScenarioFrame = {
  title: 'Dîner chez ses parents',
  titleEn: "Dinner at your partner's parents",
  setting: "A family house outside Rennes on a Saturday evening. A table laid for four, a roast in the oven, and your partner's parents at the door, curious and a little formal.",
  learnerRole: "Someone meeting their partner's parents for dinner for the first time.",
  characters: [
    {
      name: 'Françoise',
      role: "your partner's mother, warm and curious, who cooked all afternoon",
      register: 'courant',
    },
    {
      name: 'Bernard',
      role: "your partner's father, quieter, with a dry sense of humour and opinions about wine",
      register: 'courant',
    },
  ],
  registerGuidance: "Family dinner French with a partner's parents, vous on both sides. Françoise and Bernard say vous to the learner and expect vous back; if tu ever comes up, it is because one of them offers it, not before dessert. Françoise leads: she asks about the learner's work, family and plans, one question at a time, and reacts warmly. Bernard says less, teases gently and pours the wine. In their speech the ne drops (c'est pas grand-chose, y a encore du gratin), but polite formulas stay whole: je vous en prie, avec plaisir. They talk about their own summer plans in the futur proche and ask about the learner's. They never ask about money or politics, never talk over each other for long, and never say tu first.",
  beats: [
    {
      id: 'arrive-with-a-gift',
      goal: 'Arriver avec un cadeau',
      goalEn: 'Arrive with a gift',
    },
    {
      id: 'answer-about-yourself',
      goal: 'Répondre aux questions sur soi',
      goalEn: 'Answer questions about yourself',
    },
    {
      id: 'compliment-the-food',
      goal: 'Faire un compliment sur le repas',
      goalEn: 'Compliment the food',
    },
    {
      id: 'talk-about-plans',
      goal: 'Parler de ses projets',
      goalEn: 'Talk about your plans',
    },
    {
      id: 'thank-and-leave',
      goal: 'Remercier et partir',
      goalEn: 'Thank them and leave',
    },
  ],
  goalPhrases: [
    {
      fr: "Bonsoir ! Tenez, c'est pour vous",
      frWritten: null,
      en: 'Good evening! Here, this is for you',
      register: 'courant',
    },
    {
      fr: "Je travaille dans l'informatique",
      frWritten: null,
      en: 'I work in IT',
      register: 'courant',
    },
    {
      fr: "C'est délicieux, c'est vous qui l'avez fait ?",
      frWritten: null,
      en: 'This is delicious, did you make it?',
      register: 'courant',
    },
    {
      fr: 'Je veux bien, merci',
      frWritten: null,
      en: 'Yes please, thank you',
      register: 'courant',
    },
    {
      fr: "On va passer l'été dans le Sud",
      frWritten: null,
      en: 'We are spending the summer in the South',
      register: 'courant',
    },
    {
      fr: 'Et vous, vous partez cet été ?',
      frWritten: null,
      en: 'And you, are you going away this summer?',
      register: 'courant',
    },
    {
      fr: 'Merci beaucoup pour cette soirée',
      frWritten: null,
      en: 'Thank you very much for this evening',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Il est huit heures. Vous tenez un bouquet de fleurs devant une maison éclairée. La porte s'ouvre, et une femme souriante s'essuie les mains sur son tablier.",
    frWritten: null,
    en: 'Eight o\'clock, a bunch of flowers in your hand, outside a house with every window lit. The door opens, and a smiling woman wipes her hands on her apron.',
  },
  openingLine: {
    speaker: 'Françoise',
    fr: 'Bonsoir ! Entrez, entrez, on vous attendait !',
    frWritten: null,
    en: 'Good evening! Come in, come in, we were expecting you!',
  },
  openingSupport: {
    fullLine: {
      fr: "Bonsoir ! Tenez, c'est pour vous",
      frWritten: null,
      en: 'Good evening! Here, this is for you',
    },
    options: [
      {
        fr: 'Bonsoir, madame. Merci pour l’invitation',
        en: 'Good evening. Thank you for having me',
      },
      {
        fr: 'Bonsoir ! Ça sent très bon',
        en: 'Good evening! It smells lovely',
      },
      {
        fr: 'Bonsoir ! Tenez, des fleurs pour vous',
        en: 'Good evening! Here, some flowers for you',
      },
    ],
    hintEn: 'Say good evening back, and give her the flowers.',
  },
  cultureNotes: [
    'Flowers, chocolates or a good dessert are the usual gifts. Wine is fine too, though the hosts may already have chosen one for the meal.',
    'Keep vous with a partner’s parents until they offer tu. Some will within the hour, some never will, and both are normal.',
    'A French dinner can last three hours. Complimenting the food, and asking who made it, is the warmest thing you can say.',
  ],
};

/**
 * mission:club. Signing up for a class at a maison de quartier, the TCF-style
 * interaction task: ask the times, the price and what to bring. Sophie answers
 * each question with the fact first and waits, because the learner leads.
 */
const CLUB_FRAME: ScenarioFrame = {
  title: "S'inscrire au club",
  titleEn: 'Signing up for a class',
  setting: 'The welcome desk of a maison de quartier in Toulouse on a Tuesday evening. A notice board of yoga, choir and French conversation evenings, a stack of forms, and music from the hall upstairs.',
  learnerRole: 'Someone new to the area, signing up for a weekly class at the local community centre.',
  characters: [
    {
      name: 'Sophie',
      role: 'the welcome desk at the maison de quartier, friendly and organised, with every timetable in front of her',
      register: 'courant',
    },
  ],
  registerGuidance: "Welcome-desk French at a community centre, vous throughout. Sophie is friendly and organised, with the timetable printed in front of her. She answers each question with the fact first (le mardi, de sept heures à huit heures et demie), then waits for the next one, because the learner is the one asking. In her speech the ne drops (y a plus de place le jeudi, c'est pas cher), but her formulas stay whole: je vous en prie, n'hésitez pas. She lists what to bring in two or three items (un tapis, une bouteille d'eau, une tenue confortable) and repeats a time or a price if asked. When the learner signs up she asks for a name and an email, one at a time. She never rushes the learner, never pushes a dearer option, and never says tu.",
  beats: [
    {
      id: 'say-what-you-want',
      goal: 'Dire à quel cours on veut s’inscrire',
      goalEn: 'Say what you want to join',
    },
    {
      id: 'ask-the-times',
      goal: 'Demander les jours et les horaires',
      goalEn: 'Ask about the times',
    },
    {
      id: 'ask-the-price',
      goal: 'Demander le prix',
      goalEn: 'Ask the price',
    },
    {
      id: 'ask-what-to-bring',
      goal: 'Demander ce qu’il faut apporter',
      goalEn: 'Ask what to bring',
    },
    {
      id: 'sign-up',
      goal: 'S’inscrire',
      goalEn: 'Sign up',
    },
  ],
  goalPhrases: [
    {
      fr: "Je voudrais m'inscrire au cours de yoga",
      frWritten: null,
      en: 'I would like to sign up for the yoga class',
      register: 'courant',
    },
    {
      fr: "C'est quel jour, et à quelle heure ?",
      frWritten: null,
      en: 'Which day is it, and at what time?',
      register: 'courant',
    },
    {
      fr: 'Y a encore de la place ?',
      frWritten: 'Il y a encore de la place ?',
      en: 'Are there still places left?',
      register: 'courant',
    },
    {
      fr: "Ça coûte combien pour l'année ?",
      frWritten: null,
      en: 'How much is it for the year?',
      register: 'courant',
    },
    {
      fr: "Qu'est-ce qu'il faut apporter ?",
      frWritten: null,
      en: 'What do I need to bring?',
      register: 'courant',
    },
    {
      fr: "On peut faire un cours d'essai ?",
      frWritten: null,
      en: 'Can I try a class first?',
      register: 'courant',
    },
    {
      fr: "D'accord, je m'inscris",
      frWritten: null,
      en: 'All right, I will sign up',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Une affiche annonce le cours de yoga du mardi. Derrière le bureau d'accueil, une femme range des formulaires et lève la tête.",
    frWritten: null,
    en: 'A poster by the door announces the Tuesday yoga class. Behind the welcome desk, a woman is tidying a pile of forms, and she looks up.',
  },
  openingLine: {
    speaker: 'Sophie',
    fr: 'Bonsoir ! Je peux vous renseigner ?',
    frWritten: null,
    en: 'Good evening! Can I help you with anything?',
  },
  openingSupport: {
    fullLine: {
      fr: "Bonsoir ! Je voudrais m'inscrire au cours de yoga",
      frWritten: null,
      en: 'Good evening! I would like to sign up for the yoga class',
    },
    options: [
      {
        fr: 'Bonsoir, y a encore de la place au cours de yoga ?',
        en: 'Good evening, are there still places in the yoga class?',
      },
      {
        fr: 'Oui, le cours de conversation, c’est quel jour ?',
        en: 'Yes, which day is the conversation class?',
      },
      {
        fr: 'Bonsoir, je voudrais des informations sur les cours',
        en: 'Good evening, I would like some information about the classes',
      },
    ],
    hintEn: 'Say good evening back, then say which class you want to join.',
  },
  cultureNotes: [
    'A maison de quartier or an MJC runs low-cost classes for the neighbourhood: sport, music, languages, cooking. It is one of the easiest ways to meet people after a move.',
    'Most classes start in September, at the rentrée, but many still take people later in the year. Asking for a cours d’essai, a first class to try, is normal.',
    'Sport classes often ask for a certificat médical, a short note from a doctor saying you can take part.',
  ],
};

/**
 * mission:banque. Opening an account just after a move. Antoine is the most
 * formal character at A2: vous, the ne kept more than most, and every
 * document named in turn. The RIB, which every landlord and employer asks
 * for, goes in a culture note rather than a beat.
 */
const BANQUE_FRAME: ScenarioFrame = {
  title: 'Ouvrir un compte',
  titleEn: 'Opening a bank account',
  setting: 'A small bank branch in Bordeaux on a weekday morning. A glass-walled office with two chairs, a screen turned towards the customer, and a pot plant on the filing cabinet.',
  learnerRole: 'Someone who has just moved to France, opening a bank account at a local branch.',
  characters: [
    {
      name: 'Antoine',
      role: 'a bank adviser, polite and precise, who goes through each document in turn',
      register: 'courant',
    },
  ],
  registerGuidance: "Bank-adviser French in a branch office, vous throughout, courant leaning towards soutenu. Antoine is polite and precise. He keeps the ne more often than most people (je ne vois pas de problème), uses whole formulas (je vous en prie, tout à fait, je vous écoute) and asks one question at a time. He names each document plainly (une pièce d'identité, un justificatif de domicile de moins de trois mois) and explains a word if the learner hesitates. He answers questions about the card and the online account with the fact first, then offers a next appointment to sign. He never sells extra products, never uses banking jargon without explaining it, never hurries the learner, and never says tu.",
  beats: [
    {
      id: 'say-you-want-an-account',
      goal: 'Dire qu’on veut ouvrir un compte',
      goalEn: 'Say you want an account',
    },
    {
      id: 'say-you-just-moved',
      goal: 'Dire qu’on vient d’arriver',
      goalEn: 'Say you just moved here',
    },
    {
      id: 'ask-what-documents',
      goal: 'Demander quels documents il faut',
      goalEn: 'Ask what documents',
    },
    {
      id: 'ask-about-the-card',
      goal: 'Poser une question sur la carte',
      goalEn: 'Ask about the card',
    },
    {
      id: 'book-the-next-step',
      goal: 'Prendre le prochain rendez-vous',
      goalEn: 'Book the next step',
    },
  ],
  goalPhrases: [
    {
      fr: 'Bonjour, je voudrais ouvrir un compte',
      frWritten: null,
      en: 'Hello, I would like to open an account',
      register: 'courant',
    },
    {
      fr: 'Je viens de déménager dans le quartier',
      frWritten: null,
      en: 'I have just moved to the area',
      register: 'courant',
    },
    {
      fr: 'Vous avez besoin de quels documents ?',
      frWritten: null,
      en: 'Which documents do you need?',
      register: 'courant',
    },
    {
      fr: "J'ai mon passeport et une facture d'électricité",
      frWritten: null,
      en: 'I have my passport and an electricity bill',
      register: 'courant',
    },
    {
      fr: 'Et la carte bancaire, je la reçois quand ?',
      frWritten: null,
      en: 'And the bank card, when do I get it?',
      register: 'courant',
    },
    {
      fr: 'Je peux avoir un RIB ?',
      frWritten: null,
      en: 'Can I have my bank details?',
      register: 'courant',
    },
    {
      fr: 'Mardi prochain, ça me va très bien',
      frWritten: null,
      en: 'Next Tuesday suits me very well',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "La porte vitrée du bureau se referme sans bruit. Le conseiller tourne son écran vers vous et ouvre un nouveau dossier.",
    frWritten: null,
    en: 'The glass door of the little office closes without a sound. The adviser turns his screen towards you and opens a new file.',
  },
  openingLine: {
    speaker: 'Antoine',
    fr: 'Bonjour, asseyez-vous. Je vous écoute.',
    frWritten: null,
    en: 'Hello, have a seat. How can I help?',
  },
  openingSupport: {
    fullLine: {
      fr: 'Bonjour, je voudrais ouvrir un compte',
      frWritten: null,
      en: 'Hello, I would like to open an account',
    },
    options: [
      {
        fr: 'Bonjour. Je viens de déménager, je voudrais ouvrir un compte',
        en: 'Hello. I have just moved, I would like to open an account',
      },
      {
        fr: 'Merci. Je voudrais ouvrir un compte, s’il vous plaît',
        en: 'Thank you. I would like to open an account, please',
      },
      {
        fr: 'Bonjour, j’ai rendez-vous pour ouvrir un compte',
        en: 'Hello, I have an appointment to open an account',
      },
    ],
    hintEn: 'Say hello back, then say you would like to open an account.',
  },
  cultureNotes: [
    'A justificatif de domicile is proof of address: a recent energy bill, a rent receipt or a home insurance certificate. If you live with someone, they can sign an attestation d’hébergement.',
    'A RIB, relevé d’identité bancaire, is a slip with your account details. Landlords, employers and phone companies ask for one, so keep a copy handy.',
    'Opening an account in a branch usually means an appointment with a conseiller. Online banks are quicker, but some ask for a French address first.',
  ],
};

/**
 * mission:sortie. Planning a cinema evening with a friend on the phone, the
 * TCF invitation task: suggest, turn down a day and offer another, agree a
 * time and a place. Léa is familier and tu, and her speech bends spelling,
 * so the frame carries frWritten where it does.
 */
const SORTIE_FRAME: ScenarioFrame = {
  title: 'On se fait un ciné ?',
  titleEn: 'Making plans with a friend',
  setting: 'A Wednesday evening at home, phone to your ear. Your friend Léa picks up on her bus home, with traffic and a beeping door behind her.',
  learnerRole: 'Someone phoning a friend to plan an evening at the cinema.',
  characters: [
    {
      name: 'Léa',
      role: 'a friend, chatty on the phone, whose week is already half full',
      register: 'familier',
    },
  ],
  registerGuidance: "Phone French between friends, tu from the first word: Léa is a friend, and vous would sound like a joke. She is relaxed and quick. The ne is gone (je peux pas, c'est pas grave), and she squeezes words the way people do on the phone: t'es libre, t'as vu, j'sais pas. She reacts out loud with ouais, trop bien, ah mince. She is busy one of the days the learner offers, says so plainly and lets the learner offer another, then settles a time and a meeting place. She repeats a time if the line crackles, and she says à dimanche or à plus to close. She never uses argot a learner cannot follow, never switches to vous, and never talks for long without letting the learner in.",
  beats: [
    {
      id: 'suggest-going-out',
      goal: 'Proposer une sortie',
      goalEn: 'Suggest going out',
    },
    {
      id: 'turn-down-and-offer',
      goal: 'Refuser un jour et en proposer un autre',
      goalEn: 'Turn down a day and offer another',
    },
    {
      id: 'agree-time-and-place',
      goal: 'Se mettre d’accord sur l’heure et le lieu',
      goalEn: 'Agree on a time and place',
    },
    {
      id: 'confirm',
      goal: 'Confirmer',
      goalEn: 'Confirm',
    },
  ],
  goalPhrases: [
    {
      fr: "T'es libre samedi soir ?",
      frWritten: 'Tu es libre samedi soir ?',
      en: 'Are you free on Saturday evening?',
      register: 'familier',
    },
    {
      fr: 'On se fait un ciné ?',
      frWritten: null,
      en: 'Shall we go to the cinema?',
      register: 'familier',
    },
    {
      fr: 'Samedi, je peux pas, mais dimanche, ça te va ?',
      frWritten: 'Samedi, je ne peux pas, mais dimanche, ça te va ?',
      en: 'I cannot do Saturday, but does Sunday work for you?',
      register: 'familier',
    },
    {
      fr: 'On se retrouve devant le cinéma ?',
      frWritten: null,
      en: 'Shall we meet outside the cinema?',
      register: 'courant',
    },
    {
      fr: 'Vers huit heures, ça marche ?',
      frWritten: null,
      en: 'Around eight, does that work?',
      register: 'courant',
    },
    {
      fr: 'Ça marche, à dimanche !',
      frWritten: null,
      en: 'Sounds good, see you Sunday!',
      register: 'familier',
    },
    {
      fr: "Trop bien, j'ai hâte !",
      frWritten: null,
      en: 'Brilliant, I cannot wait!',
      register: 'familier',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Ça sonne deux fois. Derrière la voix de Léa, on entend un bus qui freine et une porte qui bipe.",
    frWritten: null,
    en: 'The phone rings twice. Behind the voice that answers, a bus brakes and a door beeps open.',
  },
  openingLine: {
    speaker: 'Léa',
    fr: 'Allô ? Salut, ça va ?',
    frWritten: null,
    en: 'Hello? Hey, how are you?',
  },
  openingSupport: {
    fullLine: {
      fr: 'Salut ! Ça va. On se fait un ciné ?',
      frWritten: null,
      en: 'Hey! I am good. Shall we go to the cinema?',
    },
    options: [
      {
        fr: "Salut ! T'es libre samedi soir ?",
        en: 'Hey! Are you free on Saturday evening?',
      },
      {
        fr: 'Ça va, et toi ? Tu veux aller au cinéma ce week-end ?',
        en: 'Good, and you? Do you want to go to the cinema this weekend?',
      },
      {
        fr: 'Salut ! Dis, on se fait un ciné ce week-end ?',
        en: 'Hey! Say, shall we go to the cinema this weekend?',
      },
    ],
    hintEn: 'Say hi back, then suggest going to the cinema.',
  },
  cultureNotes: [
    'On se fait un ciné is the casual way to suggest a film. Ciné is short for cinéma, and nobody says the long form between friends.',
    'Turning down a day is easy and never rude: say you cannot, then offer another. Je peux pas, mais is all it takes.',
    'Many French cinemas show foreign films in VO, the original language with subtitles. VF means dubbed into French.',
  ],
};

/**
 * mission:montreal. The one Quebec scene: buying a first winter coat in a
 * Montréal shop. Standard Quebec French in the courant register, vous by
 * default. Marc-André uses a few local words naturally and lets context carry
 * them; there is no joual and no sacre. The learner's lines stay standard
 * French that works on both sides of the Atlantic.
 */
const MONTREAL_FRAME: ScenarioFrame = {
  title: "Un manteau pour l'hiver",
  titleEn: 'A coat for the winter',
  setting: 'A clothing shop on rue Sainte-Catherine in Montréal at the start of November. Racks of parkas, a wall of tuques, wet boots on a mat by the door, and the first snow outside.',
  learnerRole: 'Someone who has just arrived in Montréal, buying a first real winter coat.',
  characters: [
    {
      name: 'Marc-André',
      role: 'a sales assistant in a Montréal clothing shop, warm and quick, who knows what a real winter needs',
      register: 'courant',
    },
  ],
  registerGuidance: "Montréal shop French: standard Quebec French in the courant register, vous by default. Marc-André is warm and quick, and he sounds more relaxed than a sales assistant in Paris, but he keeps vous unless the learner offers tu. He uses a few everyday Quebec words naturally and lets the context explain them: magasiner for shopping, une tuque for a winter hat, c'est correct for it is fine, and il fait frette when he talks about the cold. When thanked he says bienvenue. He gives sizes and prices plainly, says the taxes are added at the till, and asks how the learner gets around in winter. He never uses joual or sacres, never teases the learner's French from France, and never switches to English.",
  beats: [
    {
      id: 'say-what-you-look-for',
      goal: 'Dire ce qu’on cherche',
      goalEn: 'Say what you are looking for',
    },
    {
      id: 'ask-for-your-size',
      goal: 'Demander sa taille',
      goalEn: 'Ask for your size',
    },
    {
      id: 'say-how-it-fits',
      goal: 'L’essayer et dire comment il va',
      goalEn: 'Try it on and say how it fits',
    },
    {
      id: 'ask-the-price',
      goal: 'Demander le prix',
      goalEn: 'Ask the price',
    },
    {
      id: 'decide',
      goal: 'Se décider',
      goalEn: 'Decide',
    },
  ],
  goalPhrases: [
    {
      fr: "Bonjour, je cherche un manteau pour l'hiver",
      frWritten: null,
      en: 'Hello, I am looking for a winter coat',
      register: 'courant',
    },
    {
      fr: "Vous l'avez dans une plus grande taille ?",
      frWritten: null,
      en: 'Do you have it in a bigger size?',
      register: 'courant',
    },
    {
      fr: "Je peux l'essayer ?",
      frWritten: null,
      en: 'Can I try it on?',
      register: 'courant',
    },
    {
      fr: 'Il est un peu serré aux épaules',
      frWritten: null,
      en: 'It is a bit tight across the shoulders',
      register: 'courant',
    },
    {
      fr: 'Il coûte combien, avec les taxes ?',
      frWritten: null,
      en: 'How much is it, with the taxes?',
      register: 'courant',
    },
    {
      fr: 'Je vais le prendre',
      frWritten: null,
      en: 'I will take it',
      register: 'courant',
    },
    {
      fr: 'Je vais réfléchir, merci',
      frWritten: null,
      en: 'I will think about it, thanks',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Dehors, la première neige tombe sur la rue. Vous tapez vos bottes sur le tapis, et un vendeur pose une pile de tuques sur le comptoir.",
    frWritten: null,
    en: 'Outside, the first snow is falling on the street. You stamp your boots on the mat, and a sales assistant sets a pile of woolly hats on the counter.',
  },
  openingLine: {
    speaker: 'Marc-André',
    fr: 'Bonjour ! Je peux vous aider ?',
    frWritten: null,
    en: 'Hello! Can I help you?',
  },
  openingSupport: {
    fullLine: {
      fr: "Bonjour, je cherche un manteau pour l'hiver",
      frWritten: null,
      en: 'Hello, I am looking for a winter coat',
    },
    options: [
      {
        fr: "Oui, merci. Je cherche un manteau chaud pour l'hiver",
        en: 'Yes, thanks. I am looking for a warm coat for the winter',
      },
      {
        fr: 'Bonjour ! Je regarde les manteaux, merci',
        en: 'Hello! I am looking at the coats, thanks',
      },
      {
        fr: "Oui, c'est mon premier hiver ici. Il me faut un manteau",
        en: 'Yes, it is my first winter here. I need a coat',
      },
    ],
    hintEn: 'Say hello back, then say you are looking for a winter coat.',
  },
  cultureNotes: [
    'In Quebec the price on the tag does not include sales tax. The TPS and the TVQ are added at the till, so the total is always a little higher.',
    'Quebec French says bienvenue for you are welcome, and c’est correct for it is fine. Magasiner means to go shopping, and a tuque is a woolly winter hat.',
    'Winter coats are made for real cold, and staff often ask how you get around. Many people take a size up so a thick sweater fits underneath.',
  ],
};

/**
 * mission:coup-de-main. Asking a colleague for help with something practical,
 * here booking a meeting room, though the learner may name the shared drive
 * or the printer instead. Inès is on tu, as colleagues of the same level are.
 * The scene's real skill is checking you understood: si j'ai bien compris.
 */
const COUP_DE_MAIN_FRAME: ScenarioFrame = {
  title: 'Un petit coup de main ?',
  titleEn: 'A little help?',
  setting: 'An open-plan office in Lille in the middle of the afternoon. Rows of desks, a printer blinking orange in the corner, and Inès two desks away with her headphones round her neck.',
  learnerRole: 'Someone a few weeks into a new job, stuck on booking a meeting room in the office software.',
  characters: [
    {
      name: 'Inès',
      role: 'a colleague in the open space, patient and quick with the office tools',
      register: 'courant',
    },
  ],
  registerGuidance: "Open-space French between colleagues, tu from the first word: Inès and the learner work at the same level, and vous would sound distant. She is patient and quick. In her speech the ne drops (c'est pas compliqué, t'inquiète pas), and she says t'as and ouais, but she stays clear rather than slangy. She lets the learner explain what is stuck before she touches the mouse, then shows one step at a time with tu cliques ici, après tu choisis, et voilà. When the learner says back what they understood, she confirms or corrects one detail. If the learner is stuck on the printer or the shared drive instead, she helps with that. She never takes over the keyboard without asking, never makes the learner feel slow, and never switches to vous.",
  beats: [
    {
      id: 'ask-if-she-has-a-minute',
      goal: 'Lui demander si elle a une minute',
      goalEn: 'Ask if she has a minute',
    },
    {
      id: 'explain-what-you-are-trying',
      goal: 'Expliquer ce qu’on essaie de faire',
      goalEn: 'Explain what you are trying to do',
    },
    {
      id: 'ask-her-to-show-you',
      goal: 'Lui demander de montrer',
      goalEn: 'Ask her to show you',
    },
    {
      id: 'check-you-understood',
      goal: 'Vérifier qu’on a compris',
      goalEn: 'Check you understood',
    },
    {
      id: 'thank-her',
      goal: 'La remercier',
      goalEn: 'Thank her',
    },
  ],
  goalPhrases: [
    {
      fr: "T'as deux minutes ?",
      frWritten: 'Tu as deux minutes ?',
      en: 'Have you got a minute?',
      register: 'familier',
    },
    {
      fr: "J'arrive pas à réserver une salle",
      frWritten: "Je n'arrive pas à réserver une salle",
      en: 'I cannot manage to book a room',
      register: 'courant',
    },
    {
      fr: 'Tu peux me montrer comment tu fais ?',
      frWritten: null,
      en: 'Can you show me how you do it?',
      register: 'courant',
    },
    {
      fr: 'Alors, je clique ici, et après ?',
      frWritten: null,
      en: 'So, I click here, and then?',
      register: 'courant',
    },
    {
      fr: "Si j'ai bien compris, il faut d'abord choisir la date",
      frWritten: null,
      en: 'If I understand, I pick the date first',
      register: 'courant',
    },
    {
      fr: 'Le dossier partagé, il est où ?',
      frWritten: null,
      en: 'Where is the shared folder?',
      register: 'courant',
    },
    {
      fr: "Merci, c'est super gentil",
      frWritten: null,
      en: 'Thanks, that is really kind',
      register: 'familier',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "L'écran affiche encore le même message d'erreur. Vous vous levez et vous approchez du bureau d'Inès, qui enlève son casque.",
    frWritten: null,
    en: 'The screen is showing the same error message again. You get up and go over to the desk where Inès is sliding off her headphones.',
  },
  openingLine: {
    speaker: 'Inès',
    fr: 'Oui ? Dis-moi.',
    frWritten: null,
    en: 'Yes? What is it?',
  },
  openingSupport: {
    fullLine: {
      fr: "Salut ! T'as deux minutes ?",
      frWritten: null,
      en: 'Hi! Have you got a minute?',
    },
    options: [
      {
        fr: "Pardon de te déranger. J'arrive pas à réserver une salle",
        en: 'Sorry to bother you. I cannot manage to book a room',
      },
      {
        fr: 'Salut, tu peux m’aider deux minutes ?',
        en: 'Hi, can you help me for a minute?',
      },
      {
        fr: "Oui, t'as deux minutes ? C'est pour la salle de réunion",
        en: 'Yes, have you got a minute? It is about the meeting room',
      },
    ],
    hintEn: 'Say hi, then ask if she has a minute.',
  },
  cultureNotes: [
    'T’as deux minutes ? is the usual way into a colleague’s time. It rarely means exactly two minutes, and nobody times it.',
    'Asking someone to show you, rather than to do it for you, goes down well in a French office. It says you plan to manage next time.',
    'Saying back what you understood, starting with si j’ai bien compris, shows you listened and gives the other person a chance to fix a detail.',
  ],
};

/**
 * mission:anniversaire. A partner's sister's birthday, which widens
 * mission:belle-famille to the partner's own generation. Everyone is on tu
 * from the start, which is the contrast with the parents' vous. The learner
 * tells how the couple met in the passé composé: on s'est rencontrés, the
 * default spoken form, which sounds the same whatever the couple.
 */
const ANNIVERSAIRE_FRAME: ScenarioFrame = {
  title: "L'anniversaire de sa sœur",
  titleEn: "Your partner's sister's birthday",
  setting: "A garden outside Angers on a Saturday afternoon in June. Paper garlands in the trees, a long table, a chocolate cake waiting for its candles, and your partner's sister at the gate.",
  learnerRole: "Someone at their partner's sister's birthday party, meeting part of the family for the first time.",
  characters: [
    {
      name: 'Manon',
      role: "your partner's sister, whose birthday it is, warm and teasing",
      register: 'familier',
    },
    {
      name: 'Maxime',
      role: 'a cousin, curious and talkative, who wants to know everything about you',
      register: 'familier',
    },
  ],
  registerGuidance: "Birthday-party French among people your own age, tu from the first word: Manon is the partner's sister and Maxime is a cousin, and vous here would sound cold. Both are familier and quick. The ne is gone (c'est pas vrai, j'savais pas), and they say t'as, ouais and trop bien. Manon opens the present at once, is touched by it, and teases a little about how the couple met. Maxime is curious: he asks what the learner does and where they come from, one question at a time, and tells a short story of his own. Someone offers more cake and insists once, the French way. They never use argot the learner cannot follow, never switch to vous, and never ask about money or politics.",
  beats: [
    {
      id: 'wish-happy-birthday',
      goal: 'Lui souhaiter un joyeux anniversaire',
      goalEn: 'Wish her happy birthday',
    },
    {
      id: 'say-how-you-met',
      goal: 'Raconter comment on s’est rencontrés',
      goalEn: 'Say how you met your partner',
    },
    {
      id: 'chat-with-a-cousin',
      goal: 'Discuter avec un cousin',
      goalEn: 'Chat with a cousin',
    },
    {
      id: 'accept-a-second-helping',
      goal: 'Accepter d’en reprendre',
      goalEn: 'Accept a second helping',
    },
    {
      id: 'say-goodbye',
      goal: 'Dire au revoir',
      goalEn: 'Say goodbye',
    },
  ],
  goalPhrases: [
    {
      fr: "Joyeux anniversaire ! C'est pour toi",
      frWritten: null,
      en: 'Happy birthday! This is for you',
      register: 'familier',
    },
    {
      fr: "On s'est rencontrés par des amis",
      frWritten: null,
      en: 'We met through friends',
      register: 'courant',
    },
    {
      fr: 'On est ensemble depuis deux ans',
      frWritten: null,
      en: 'We have been together for two years',
      register: 'courant',
    },
    {
      fr: 'Et toi, tu fais quoi dans la vie ?',
      frWritten: null,
      en: 'And you, what do you do for a living?',
      register: 'familier',
    },
    {
      fr: 'Allez, juste un petit peu alors',
      frWritten: null,
      en: 'Go on then, just a little',
      register: 'familier',
    },
    {
      fr: "Il est trop bon, ce gâteau",
      frWritten: null,
      en: 'This cake is so good',
      register: 'familier',
    },
    {
      fr: 'Bon, on va y aller. Merci pour tout !',
      frWritten: null,
      en: 'Right, we are going to head off. Thanks for everything!',
      register: 'familier',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Des guirlandes en papier bougent dans les arbres. Manon ouvre le portail en riant, et vous cachez un petit paquet derrière votre dos.",
    frWritten: null,
    en: 'Paper garlands sway in the trees. Manon opens the gate laughing, and you hide a small parcel behind your back.',
  },
  openingLine: {
    speaker: 'Manon',
    fr: 'Salut ! Entre, entre, tout le monde est dans le jardin !',
    frWritten: null,
    en: 'Hi! Come in, come in, everyone is in the garden!',
  },
  openingSupport: {
    fullLine: {
      fr: "Salut ! Joyeux anniversaire ! C'est pour toi",
      frWritten: null,
      en: 'Hi! Happy birthday! This is for you',
    },
    options: [
      {
        fr: 'Joyeux anniversaire, Manon ! Tiens, un petit cadeau',
        en: 'Happy birthday, Manon! Here, a little present',
      },
      {
        fr: "Salut ! Bon anniversaire ! C'est trop joli ici",
        en: 'Hi! Happy birthday! It is so pretty here',
      },
      {
        fr: 'Merci ! Joyeux anniversaire !',
        en: 'Thanks! Happy birthday!',
      },
    ],
    hintEn: 'Say hi back, wish her happy birthday, and give her the present.',
  },
  cultureNotes: [
    'At a French birthday the present is often opened straight away, in front of everyone. A small thoughtful gift is plenty.',
    'Hosts usually offer a second helping and insist once. Juste un petit peu is a friendly yes that does not ask for a full plate.',
    'With a partner’s brothers, sisters and cousins of your own age, tu is normal from the first hello, even with the parents still on vous.',
  ],
};

/**
 * mission:fuite. B1: explaining a problem on the phone, with what happened
 * (passé composé), what is happening now and a polite request in the
 * conditional (un plombier pourrait passer quand ?). Follows
 * mission:appartement once the learner lives there. Patrick is on vous.
 */
const FUITE_FRAME: ScenarioFrame = {
  title: 'Il y a une fuite',
  titleEn: 'There is a leak',
  setting: 'A rented flat in Nantes on a weekday evening. A towel on the kitchen floor, a bucket under the sink, the cupboard doors open, and the phone in your hand ringing the landlord.',
  learnerRole: 'A tenant phoning the landlord about a leak under the kitchen sink.',
  characters: [
    {
      name: 'Patrick',
      role: 'the landlord, calm on the phone, who wants the facts before he sends anyone',
      register: 'courant',
    },
  ],
  registerGuidance: "Phone French between a tenant and a landlord, vous on both sides from the first word. Patrick is polite, calm and practical, a little formal but never cold. He lets the learner explain before he asks questions, and he asks one at a time: where exactly, since when, is the water off, is it reaching the neighbours. He speaks clearly and repeats a time or a day if the learner hesitates. He reassures without promising too much, and suggests a slot for the plumber, then checks it suits the learner. If the learner mentions the insurance or the neighbours, he says what to do next in one sentence. He never blames the tenant, never rushes the call, never switches to tu and never uses technical plumbing words without explaining them.",
  beats: [
    {
      id: 'explain-the-problem',
      goal: 'Expliquer le problème',
      goalEn: 'Explain the problem',
    },
    {
      id: 'say-since-when',
      goal: 'Dire depuis quand, et ce qu’on a fait',
      goalEn: 'Say since when and what you tried',
    },
    {
      id: 'say-what-it-damages',
      goal: 'Dire ce que ça abîme',
      goalEn: 'Say what it is damaging',
    },
    {
      id: 'ask-when-someone-can-come',
      goal: 'Demander quand quelqu’un peut venir',
      goalEn: 'Ask when someone can come',
    },
    {
      id: 'agree-on-a-time',
      goal: 'Se mettre d’accord sur un horaire',
      goalEn: 'Agree on a time',
    },
  ],
  goalPhrases: [
    {
      fr: "Il y a une fuite sous l'évier de la cuisine",
      frWritten: null,
      en: 'There is a leak under the kitchen sink',
      register: 'courant',
    },
    {
      fr: "Ça a commencé hier soir, et j'ai coupé l'eau",
      frWritten: null,
      en: 'It started last night, and I turned the water off',
      register: 'courant',
    },
    {
      fr: 'Ça goutte sans arrêt',
      frWritten: null,
      en: 'It keeps dripping',
      register: 'courant',
    },
    {
      fr: "L'eau coule chez le voisin du dessous",
      frWritten: null,
      en: 'The water is running into the flat below',
      register: 'courant',
    },
    {
      fr: 'Le placard est complètement mouillé',
      frWritten: null,
      en: 'The cupboard is soaking wet',
      register: 'courant',
    },
    {
      fr: 'Un plombier pourrait passer quand ?',
      frWritten: null,
      en: 'When could a plumber come round?',
      register: 'courant',
    },
    {
      fr: 'Demain matin, ça me va très bien',
      frWritten: null,
      en: 'Tomorrow morning suits me very well',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Le seau sous l'évier est presque plein. Vous appelez votre propriétaire, et il décroche à la deuxième sonnerie.",
    frWritten: null,
    en: 'The bucket under the sink is almost full. You call your landlord, and he picks up on the second ring.',
  },
  openingLine: {
    speaker: 'Patrick',
    fr: 'Allô, oui, bonjour ?',
    frWritten: null,
    en: 'Hello, yes?',
  },
  openingSupport: {
    fullLine: {
      fr: "Bonjour, monsieur. Il y a une fuite sous l'évier de la cuisine",
      frWritten: null,
      en: 'Hello. There is a leak under the kitchen sink',
    },
    options: [
      {
        fr: "Bonjour, c'est votre locataire. J'ai un problème de fuite",
        en: 'Hello, it is your tenant. I have a leak',
      },
      {
        fr: "Bonjour, je vous appelle pour une fuite dans la cuisine",
        en: 'Hello, I am calling about a leak in the kitchen',
      },
      {
        fr: "Bonjour. Il y a de l'eau partout sous l'évier",
        en: 'Hello. There is water everywhere under the sink',
      },
    ],
    hintEn: 'Say hello, then tell him there is a leak under the sink.',
  },
  cultureNotes: [
    'When you move in and out of a rented flat in France, you sign an état des lieux, a room-by-room record of its condition. It decides later who pays for what.',
    'The landlord pays for big repairs such as a burst pipe or an old boiler. Small upkeep, like a washer on a tap, is usually the tenant’s job.',
    'Every tenant must have home insurance, the assurance habitation. When water reaches a neighbour, both of you fill in a form called a constat amiable for the insurers.',
  ],
};

/**
 * mission:galere. B1: a story told over a drink. The imparfait sets the scene
 * (il pleuvait, j'étais à la gare), the passé composé moves it on (le train a
 * été annulé), and du coup, et là and finalement hold it together. Hugo is
 * familier, so frWritten carries the written form where the ne drops.
 */
const GALERE_FRAME: ScenarioFrame = {
  title: 'Tu vas pas me croire',
  titleEn: 'You will not believe me',
  setting: 'A bar terrace in Bordeaux on a Monday evening. Two glasses on a wobbly table, the last sun on the square, and Hugo leaning back, waiting for the story.',
  learnerRole: 'Someone telling a friend over a drink about a weekend where everything went sideways.',
  characters: [
    {
      name: 'Hugo',
      role: 'a friend, a great listener who always has a worse story of his own',
      register: 'familier',
    },
  ],
  registerGuidance: "Easy French between friends over a drink, tu from the first word. Hugo is relaxed and familier: the ne drops (c'est pas vrai, t'as fait comment), he says ouais, sérieux and la galère, and he reacts to every twist with a short noise or question. He lets the learner tell the story in order and nudges it on with et après ? or et là ?, so the imparfait sets the scene and the passé composé carries the events. He never finishes the learner's sentences and never corrects a tense out loud; he just uses the right one in his reply. Once the story ends, he tells a short mishap of his own so the learner can react. He never uses argot the learner cannot follow and never switches to vous.",
  beats: [
    {
      id: 'set-the-scene',
      goal: 'Planter le décor',
      goalEn: 'Set the scene',
    },
    {
      id: 'say-what-happened',
      goal: 'Dire ce qui s’est passé',
      goalEn: 'Say what happened',
    },
    {
      id: 'say-how-you-reacted',
      goal: 'Dire comment on a réagi',
      goalEn: 'Say how you reacted',
    },
    {
      id: 'say-how-it-ended',
      goal: 'Dire comment ça s’est fini',
      goalEn: 'Say how it ended',
    },
    {
      id: 'react-to-his-story',
      goal: 'Réagir à son histoire',
      goalEn: 'React to his story',
    },
  ],
  goalPhrases: [
    {
      fr: 'Tu vas pas me croire',
      frWritten: 'Tu ne vas pas me croire',
      en: 'You will not believe this',
      register: 'familier',
    },
    {
      fr: "Il pleuvait, et j'étais à la gare",
      frWritten: null,
      en: 'It was raining, and I was at the station',
      register: 'courant',
    },
    {
      fr: 'Et là, le train a été annulé',
      frWritten: null,
      en: 'And then the train got cancelled',
      register: 'courant',
    },
    {
      fr: "J'en revenais pas",
      frWritten: "Je n'en revenais pas",
      en: 'I could not believe it',
      register: 'familier',
    },
    {
      fr: "Du coup, j'ai pris le bus de nuit",
      frWritten: null,
      en: 'So I took the night bus',
      register: 'familier',
    },
    {
      fr: "Finalement, j'ai dormi chez des amis",
      frWritten: null,
      en: 'In the end, I slept at some friends’ place',
      register: 'courant',
    },
    {
      fr: 'Non, sérieux ? Et après ?',
      frWritten: null,
      en: 'No, really? And then what?',
      register: 'familier',
    },
    {
      fr: "Ah, la galère ! Ça m'est déjà arrivé aussi",
      frWritten: null,
      en: 'Oh, what a nightmare! That has happened to me too',
      register: 'familier',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Hugo pose deux verres sur la table et s'installe. Il vous regarde avec un grand sourire.",
    frWritten: null,
    en: 'Hugo puts two glasses on the table and settles in. He looks at you with a big grin.',
  },
  openingLine: {
    speaker: 'Hugo',
    fr: 'Alors, ce week-end ? Raconte !',
    frWritten: null,
    en: 'So, the weekend? Tell me everything!',
  },
  openingSupport: {
    fullLine: {
      fr: "Tu vas pas me croire ! Il pleuvait, et j'étais à la gare",
      frWritten: null,
      en: 'You will not believe this! It was raining, and I was at the station',
    },
    options: [
      {
        fr: "Oh là là, quelle galère ! Il pleuvait, et j'étais à la gare",
        en: 'Oh dear, what a nightmare! It was raining, and I was at the station',
      },
      {
        fr: "Alors, samedi, j'étais à la gare, et il pleuvait",
        en: 'So, on Saturday, I was at the station, and it was raining',
      },
      {
        fr: "Tu vas pas me croire. Le train a été annulé !",
        en: 'You will not believe this. The train got cancelled!',
      },
    ],
    hintEn: 'Start the story: say where you were and what the weather was like.',
  },
  cultureNotes: [
    'La galère is everyday French for a hassle that drags on. Quelle galère ! is the usual sympathetic reaction to a friend’s run of trouble.',
    'French storytellers mark the turn with et là, and the consequence with du coup. Both are so common that a story without them can sound written.',
    'Listeners are expected to react as the story goes, with non ?, sérieux ? or et après ?. Silence can read as boredom, not politeness.',
  ],
};

/**
 * mission:avis. B1: opinion and justification after a film, which
 * mission:sortie planned. À mon avis and ce qui m'a plu, c'est give the
 * opinion and its reason; pas mal, mais adds the nuance; pas tout à fait
 * d'accord disagrees without a fight. Yasmine is familier, on tu.
 */
const AVIS_FRAME: ScenarioFrame = {
  title: 'Alors, ce film ?',
  titleEn: 'So, that film?',
  setting: 'A small bar next to a cinema in Toulouse, late on a Friday evening. Two coats on the back of the chairs, the film tickets still on the table, and Yasmine stirring her drink.',
  learnerRole: 'Someone coming out of the cinema with a friend, over a drink next door.',
  characters: [
    {
      name: 'Yasmine',
      role: 'a friend who loves films and enjoys a friendly argument about them',
      register: 'familier',
    },
  ],
  registerGuidance: "Relaxed French between friends after a film, tu from the first word. Yasmine is familier and lively: the ne drops (c'était pas terrible, j'ai pas compris la fin), she says franchement, bof and trop bien. She asks what the learner thought and always follows with pourquoi ?, so every opinion gets a reason. She disagrees on purpose about one thing, the ending or the length, to give the learner a chance to answer politely, and she welcomes a nuance such as pas mal, mais. She takes a polite disagreement well and finds one point to agree on. Near the end she asks what to see next. She never says the learner's opinion is silly, never lectures about cinema, never spoils another film and never switches to vous.",
  beats: [
    {
      id: 'give-your-opinion',
      goal: 'Donner son avis',
      goalEn: 'Give your opinion',
    },
    {
      id: 'say-why',
      goal: 'Dire pourquoi',
      goalEn: 'Say why',
    },
    {
      id: 'add-a-nuance',
      goal: 'Nuancer',
      goalEn: 'Add a nuance',
    },
    {
      id: 'agree-or-disagree',
      goal: 'Être d’accord ou pas, poliment',
      goalEn: 'Agree or disagree politely',
    },
    {
      id: 'suggest-what-next',
      goal: 'Proposer le prochain film',
      goalEn: 'Suggest what to see next',
    },
  ],
  goalPhrases: [
    {
      fr: "À mon avis, c'était vraiment réussi",
      frWritten: null,
      en: 'If you ask me, it was really well done',
      register: 'courant',
    },
    {
      fr: "Ce qui m'a plu, c'est l'histoire",
      frWritten: null,
      en: 'What I liked was the story',
      register: 'courant',
    },
    {
      fr: "J'ai trouvé que les acteurs jouaient super bien",
      frWritten: null,
      en: 'I thought the actors were really good',
      register: 'familier',
    },
    {
      fr: "C'était pas mal, mais un peu long",
      frWritten: "Ce n'était pas mal, mais un peu long",
      en: 'It was pretty good, but a bit long',
      register: 'familier',
    },
    {
      fr: "Je suis pas tout à fait d'accord",
      frWritten: "Je ne suis pas tout à fait d'accord",
      en: 'I do not quite agree',
      register: 'familier',
    },
    {
      fr: 'Là, par contre, je suis d’accord avec toi',
      frWritten: null,
      en: 'On that, though, I agree with you',
      register: 'courant',
    },
    {
      fr: 'Et si on allait voir une comédie, la prochaine fois ?',
      frWritten: null,
      en: 'How about we see a comedy next time?',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: 'Les billets de cinéma traînent encore sur la table. Yasmine enlève sa veste et vous regarde, curieuse.',
    frWritten: null,
    en: 'The cinema tickets are still lying on the table. Yasmine takes off her jacket and looks at you, curious.',
  },
  openingLine: {
    speaker: 'Yasmine',
    fr: "Alors ? T'en as pensé quoi ?",
    frWritten: null,
    en: 'So? What did you think?',
  },
  openingSupport: {
    fullLine: {
      fr: "À mon avis, c'était vraiment réussi",
      frWritten: null,
      en: 'If you ask me, it was really well done',
    },
    options: [
      {
        fr: "J'ai bien aimé. Ce qui m'a plu, c'est l'histoire",
        en: 'I liked it. What I liked was the story',
      },
      {
        fr: "C'était pas mal, mais un peu long",
        en: 'It was pretty good, but a bit long',
      },
      {
        fr: "Franchement, j'ai adoré ! Et toi ?",
        en: 'Honestly, I loved it! And you?',
      },
    ],
    hintEn: 'Say whether you liked the film, in a few words.',
  },
  cultureNotes: [
    'Talking a film over afterwards, often over a drink, is part of the outing in France. Friends expect a real opinion, not just yes, it was nice.',
    'Pas mal is warmer than it sounds: it means pretty good. Bof, with a shrug, means not really.',
    'Disagreeing about a film is a friendly sport. Starting with je suis pas tout à fait d’accord keeps it light, and nobody takes it personally.',
  ],
};

/**
 * mission:entretien. B1: a short first interview. The learner sums up their
 * background in the passé composé, gives one reason and one strength, and
 * asks a question with j'aimerais savoir. No salary talk: that comes later in
 * a French hiring process. Point fort keeps the strength gender-neutral.
 */
const ENTRETIEN_FRAME: ScenarioFrame = {
  title: "L'entretien d'embauche",
  titleEn: 'The job interview',
  setting: 'A meeting room on the third floor of an office in Rennes, on a Tuesday morning. A glass of water, a printed CV on the table, and Claire Lefèvre opening her notebook.',
  learnerRole: 'A candidate in a first interview for a job in a French company.',
  characters: [
    {
      name: 'Claire Lefèvre',
      role: 'a recruiter, friendly but precise, who listens for examples',
      register: 'courant',
    },
  ],
  registerGuidance: "Interview French, vous on both sides throughout, courant leaning soutenu. Claire Lefèvre keeps the ne (ce n'est pas un problème), speaks clearly and at a steady pace, and uses polite forms such as je vous en prie and pourriez-vous. She asks one open question at a time: tell me about yourself, why this job, a strength with an example. When an answer is vague she asks for a concrete case, gently. She nods along, sums up what she heard in a few words, and leaves room for the learner's question at the end. She keeps the interview short and realistic. She never asks about salary, age, family or nationality, never sounds like an exam, never hurries the learner and never switches to tu.",
  beats: [
    {
      id: 'sum-up-your-background',
      goal: 'Résumer son parcours',
      goalEn: 'Sum up your background',
    },
    {
      id: 'say-why-this-job',
      goal: 'Dire pourquoi ce poste',
      goalEn: 'Say why this job',
    },
    {
      id: 'give-an-example',
      goal: 'Donner un exemple d’un point fort',
      goalEn: 'Give an example of a strength',
    },
    {
      id: 'ask-about-the-role',
      goal: 'Poser une question sur le poste',
      goalEn: 'Ask about the role',
    },
    {
      id: 'close-and-thank',
      goal: 'Conclure et remercier',
      goalEn: 'Close and thank her',
    },
  ],
  goalPhrases: [
    {
      fr: "J'ai travaillé plusieurs années dans la vente",
      frWritten: null,
      en: 'I worked in sales for several years',
      register: 'courant',
    },
    {
      fr: "Ce poste m'intéresse parce que j'aime le travail en équipe",
      frWritten: null,
      en: 'This job interests me because I like teamwork',
      register: 'courant',
    },
    {
      fr: "Mon point fort, c'est l'organisation",
      frWritten: null,
      en: 'My strong point is organisation',
      register: 'courant',
    },
    {
      fr: "Par exemple, l'année dernière, j'ai organisé un grand salon",
      frWritten: null,
      en: 'For example, last year I organised a big trade fair',
      register: 'courant',
    },
    {
      fr: "J'aimerais savoir à quoi ressemble une journée type",
      frWritten: null,
      en: 'I would like to know what a typical day looks like',
      register: 'soutenu',
    },
    {
      fr: "Quelles seraient les prochaines étapes ?",
      frWritten: null,
      en: 'What would the next steps be?',
      register: 'soutenu',
    },
    {
      fr: 'Merci beaucoup pour votre temps',
      frWritten: null,
      en: 'Thank you very much for your time',
      register: 'soutenu',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Claire Lefèvre vous fait entrer dans une petite salle de réunion. Elle pose votre CV sur la table et vous sourit.",
    frWritten: null,
    en: 'Claire Lefèvre shows you into a small meeting room. She puts your CV on the table and smiles at you.',
  },
  openingLine: {
    speaker: 'Claire Lefèvre',
    fr: 'Asseyez-vous, je vous en prie. Alors, parlez-moi un peu de vous.',
    frWritten: null,
    en: 'Please, have a seat. So, tell me a little about yourself.',
  },
  openingSupport: {
    fullLine: {
      fr: "Merci. Alors, j'ai travaillé plusieurs années dans la vente",
      frWritten: null,
      en: 'Thank you. Well, I worked in sales for several years',
    },
    options: [
      {
        fr: "Bien sûr. J'ai travaillé plusieurs années dans la vente",
        en: 'Of course. I worked in sales for several years',
      },
      {
        fr: "Merci de me recevoir. Je travaille dans la vente depuis plusieurs années",
        en: 'Thank you for seeing me. I have been working in sales for several years',
      },
      {
        fr: "Oui, alors, je viens de la vente, et j'aime beaucoup le contact",
        en: 'Yes, well, my background is in sales, and I really enjoy dealing with people',
      },
    ],
    hintEn: 'Thank her, then say what kind of work you have done.',
  },
  cultureNotes: [
    'French interviews usually open with parlez-moi de vous. A short summary of your path, in order, works better than a list of qualities.',
    'Recruiters like a strength backed by a real example, told in the past: what happened, what you did, how it turned out.',
    'Salary is rarely raised in a first interview in France. Asking about the next steps is a safe and expected way to close.',
  ],
};

/**
 * mission:teletravail. B1: the polite conditional (ce serait possible de,
 * j'aimerais, je serais là). Isabelle is the manager from mission:collegues,
 * who offered tu on the first day, so it is tu both ways here. Her concern
 * is the team meetings; the answer is a trial.
 */
const TELETRAVAIL_FRAME: ScenarioFrame = {
  title: 'Demander du télétravail',
  titleEn: 'Asking to work from home',
  setting: "The manager's glass-walled office at the end of the open space, late on a Thursday afternoon. A plant on the windowsill, the team calendar on the screen, and Isabelle closing her laptop.",
  learnerRole: 'Someone a few months into the job, asking their manager about working from home.',
  characters: [
    {
      name: 'Isabelle',
      role: 'the team manager from the first day, open to it but worried about team meetings',
      register: 'courant',
    },
  ],
  registerGuidance: "Office French between a manager and a team member who are already on tu, because Isabelle offered it on the learner's first day. She stays on tu and expects tu back, and if the learner slips into vous she smiles and carries on in tu. She is courant and warm: the ne drops at times (c'est pas un souci), but she listens carefully and takes the request seriously. She asks why, and lets the learner give reasons. She raises one real concern, the team meetings and being reachable, and waits for an answer before she decides. She welcomes a suggestion such as a trial and agrees a next step. She never refuses outright, never makes the learner justify their private life and never talks about contracts or law.",
  beats: [
    {
      id: 'ask-for-a-moment',
      goal: 'Demander un moment',
      goalEn: 'Ask for a moment',
    },
    {
      id: 'make-the-request',
      goal: 'Faire la demande',
      goalEn: 'Make the request',
    },
    {
      id: 'give-your-reasons',
      goal: 'Donner ses raisons',
      goalEn: 'Give your reasons',
    },
    {
      id: 'answer-her-concern',
      goal: 'Répondre à son inquiétude',
      goalEn: 'Answer her concern',
    },
    {
      id: 'agree-a-next-step',
      goal: 'Se mettre d’accord sur la suite',
      goalEn: 'Agree on a next step',
    },
  ],
  goalPhrases: [
    {
      fr: "T'as un moment ? J'aimerais te parler de quelque chose",
      frWritten: "Tu as un moment ? J'aimerais te parler de quelque chose",
      en: 'Have you got a moment? I would like to talk to you about something',
      register: 'familier',
    },
    {
      fr: 'Est-ce que ce serait possible de télétravailler ?',
      frWritten: null,
      en: 'Would it be possible to work from home?',
      register: 'courant',
    },
    {
      fr: "J'aimerais travailler de chez moi deux jours par semaine",
      frWritten: null,
      en: 'I would like to work from home two days a week',
      register: 'courant',
    },
    {
      fr: "À la maison, j'arrive mieux à me concentrer",
      frWritten: null,
      en: 'At home, I find it easier to concentrate',
      register: 'courant',
    },
    {
      fr: 'Ça me ferait gagner beaucoup de temps de transport',
      frWritten: null,
      en: 'It would save me a lot of travel time',
      register: 'courant',
    },
    {
      fr: "Pour les réunions d'équipe, je serais toujours là",
      frWritten: null,
      en: 'For the team meetings, I would always be here',
      register: 'courant',
    },
    {
      fr: 'Et si on faisait un essai, pour voir ?',
      frWritten: null,
      en: 'What if we tried it out, to see?',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "La porte du bureau d'Isabelle est ouverte. Vous frappez doucement, et elle lève les yeux de son écran.",
    frWritten: null,
    en: 'The door to the manager’s office is open. You knock softly, and Isabelle looks up from her screen.',
  },
  openingLine: {
    speaker: 'Isabelle',
    fr: "Oui, entre ! Qu'est-ce qui se passe ?",
    frWritten: null,
    en: 'Yes, come in! What is up?',
  },
  openingSupport: {
    fullLine: {
      fr: "Salut. J'aimerais te parler de quelque chose",
      frWritten: null,
      en: 'Hi. I would like to talk to you about something',
    },
    options: [
      {
        fr: "T'as un moment ? C'est à propos du télétravail",
        en: 'Have you got a moment? It is about working from home',
      },
      {
        fr: 'Merci. Est-ce que ce serait possible de télétravailler ?',
        en: 'Thanks. Would it be possible to work from home?',
      },
      {
        fr: "Rien de grave ! J'ai juste une petite question",
        en: 'Nothing serious! I just have a quick question',
      },
    ],
    hintEn: 'Say hi, then say you would like to talk to her about something.',
  },
  cultureNotes: [
    'Working from home, le télétravail, is common in French offices now, often for a few days a week. It is usually agreed with your manager, then written down.',
    'The conditional softens a request: ce serait possible de and j’aimerais sound polite and open, where je veux would sound like a demand.',
    'Proposing a trial period, une période d’essai, is a classic way to get a yes. It lets the manager agree without committing for good.',
  ],
};

/**
 * mission:souvenirs. B1: the imparfait for descriptions and habits (quand
 * j'étais enfant, on jouait), then and now (aujourd'hui, tout va plus vite).
 * Widens mission:belle-famille to the grandparents. A real asymmetry: Jeannine
 * says tu to the learner, the learner says vous to her. Quand j'étais enfant
 * keeps the learner's line gender-neutral.
 */
const SOUVENIRS_FRAME: ScenarioFrame = {
  title: 'Chez la grand-mère',
  titleEn: "At grandmother's house",
  setting: "A small house in a village in Burgundy on a Sunday afternoon. Lace on the table, coffee in flowered cups, a tin of biscuits, and an old photo album on Jeannine's knees.",
  learnerRole: "Someone spending an afternoon with their partner's grandmother, over coffee and old photos.",
  characters: [
    {
      name: 'Jeannine',
      role: "your partner's grandmother, who says tu to you and loves to tell stories",
      register: 'courant',
    },
  ],
  registerGuidance: "Warm family French across generations, with a real asymmetry: Jeannine says tu to the learner from the start, as many grandparents do with a grandchild's partner, and the learner says vous to her, out of respect. She never asks for vous and never minds it; if the learner slips into tu she takes it kindly. She speaks clearly and slowly, keeps the ne more often than younger people do, and uses a few older words such as à l'époque and de mon temps. She asks where the learner grew up and what it was like, then tells short stories of her own youth in the imparfait. She leaves room for questions and comparisons. She never lectures about how things were better, never talks about illness or money, and never rushes.",
  beats: [
    {
      id: 'say-where-you-grew-up',
      goal: 'Dire où on a grandi',
      goalEn: 'Say where you grew up',
    },
    {
      id: 'describe-what-it-was-like',
      goal: 'Décrire comment c’était',
      goalEn: 'Describe what it was like',
    },
    {
      id: 'ask-about-her-youth',
      goal: 'Lui poser des questions sur sa jeunesse',
      goalEn: 'Ask about her youth',
    },
    {
      id: 'compare-then-and-now',
      goal: 'Comparer avant et maintenant',
      goalEn: 'Compare then and now',
    },
    {
      id: 'thank-her-for-the-stories',
      goal: 'La remercier pour ses histoires',
      goalEn: 'Thank her for the stories',
    },
  ],
  goalPhrases: [
    {
      fr: "J'ai grandi dans une petite ville au bord de la mer",
      frWritten: null,
      en: 'I grew up in a small town by the sea',
      register: 'courant',
    },
    {
      fr: "Quand j'étais enfant, on jouait dehors tout le temps",
      frWritten: null,
      en: 'When I was a child, we played outside all the time',
      register: 'courant',
    },
    {
      fr: "Et vous, comment c'était, quand vous étiez jeune ?",
      frWritten: null,
      en: 'And you, what was it like when you were young?',
      register: 'courant',
    },
    {
      fr: 'Il y avait pas encore de portables',
      frWritten: "Il n'y avait pas encore de portables",
      en: 'There were no mobile phones yet',
      register: 'familier',
    },
    {
      fr: "Aujourd'hui, tout va beaucoup plus vite",
      frWritten: null,
      en: 'Today, everything moves much faster',
      register: 'courant',
    },
    {
      fr: "Ça devait être joli, à l'époque",
      frWritten: null,
      en: 'It must have been lovely back then',
      register: 'courant',
    },
    {
      fr: "Merci de m'avoir raconté tout ça",
      frWritten: null,
      en: 'Thank you for telling me all that',
      register: 'courant',
    },
  ],
  openingNarration: {
    speaker: 'narration',
    fr: "Jeannine ouvre un vieil album photo sur ses genoux. Le café fume dans des tasses à fleurs.",
    frWritten: null,
    en: 'Jeannine opens an old photo album on her knees. Coffee steams in flowered cups.',
  },
  openingLine: {
    speaker: 'Jeannine',
    fr: 'Viens t’asseoir à côté de moi. Alors, tu as grandi où, toi ?',
    frWritten: null,
    en: 'Come and sit next to me. So, where did you grow up?',
  },
  openingSupport: {
    fullLine: {
      fr: "Merci. J'ai grandi dans une petite ville au bord de la mer",
      frWritten: null,
      en: 'Thank you. I grew up in a small town by the sea',
    },
    options: [
      {
        fr: "Avec plaisir. J'ai grandi à la campagne",
        en: 'With pleasure. I grew up in the countryside',
      },
      {
        fr: "Merci. J'ai grandi dans une grande ville, très loin d'ici",
        en: 'Thank you. I grew up in a big city, very far from here',
      },
      {
        fr: "J'ai grandi au bord de la mer. Et vous, toujours ici ?",
        en: 'I grew up by the sea. And you, always here?',
      },
    ],
    hintEn: 'Thank her, then say where you grew up.',
  },
  cultureNotes: [
    'Many French grandparents say tu to a grandchild’s partner straight away, while the partner keeps vous. It is a sign of welcome, not of rank.',
    'An afternoon with the grandparents often means coffee, biscuits and the photo albums. Asking about the old photos is one of the kindest things you can do.',
    'De mon temps and à l’époque open a story about the past. Then the imparfait takes over: on allait, on faisait, il y avait.',
  ],
};

export const MISSION_FRAMES: Record<MissionId, ScenarioFrame> = {
  'mission:premier-cafe': PREMIER_CAFE_FRAME,
  'mission:cafe': CAFE_FRAME,
  'mission:hotel': HOTEL_FRAME,
  'mission:marche': MARCHE_FRAME,
  'mission:chemin': CHEMIN_FRAME,
  'mission:journee': JOURNEE_FRAME,
  'mission:amis': APERO_FRAME,
  'mission:restaurant': RESTAURANT_FRAME,
  'mission:pharmacie': PHARMACIE_FRAME,
  'mission:gare': GARE_FRAME,
  'mission:colis': COLIS_FRAME,
  'mission:voisin': VOISIN_FRAME,
  'mission:week-end': WEEK_END_FRAME,
  'mission:collegues': COLLEGUES_FRAME,
  'mission:telephone': TELEPHONE_FRAME,
  'mission:medecin': MEDECIN_FRAME,
  'mission:retour': RETOUR_FRAME,
  'mission:appartement': APPARTEMENT_FRAME,
  'mission:belle-famille': BELLE_FAMILLE_FRAME,
  'mission:club': CLUB_FRAME,
  'mission:banque': BANQUE_FRAME,
  'mission:sortie': SORTIE_FRAME,
  'mission:montreal': MONTREAL_FRAME,
  'mission:coup-de-main': COUP_DE_MAIN_FRAME,
  'mission:anniversaire': ANNIVERSAIRE_FRAME,
  'mission:fuite': FUITE_FRAME,
  'mission:galere': GALERE_FRAME,
  'mission:avis': AVIS_FRAME,
  'mission:entretien': ENTRETIEN_FRAME,
  'mission:teletravail': TELETRAVAIL_FRAME,
  'mission:souvenirs': SOUVENIRS_FRAME,
};

type OpeningNarration = ScenarioFrame['openingNarration'];
type OpeningLine = ScenarioFrame['openingLine'];

type MissionOpeningDeck = {
  narrations: readonly [OpeningNarration, OpeningNarration, OpeningNarration, OpeningNarration, OpeningNarration];
  lines: readonly [OpeningLine, OpeningLine, OpeningLine];
};

const narration = (fr: string, en: string): OpeningNarration => ({
  speaker: 'narration',
  fr,
  frWritten: null,
  en,
});

const line = (speaker: string, fr: string, en: string): OpeningLine => ({
  speaker,
  fr,
  frWritten: null,
  en,
});

/**
 * Five physical arrivals and three natural first lines per mission make fifteen
 * coherent openings. They stay authored rather than generated for two reasons:
 * the first sound must be immediate, and a provider outage must not make every
 * mission fall back to the same café. The live model still owns every turn after
 * this one.
 */
const MISSION_OPENING_DECKS: Record<MissionId, MissionOpeningDeck> = {
  'mission:premier-cafe': {
    narrations: [
      narration(
        'Il est tôt et le café est presque vide. Karim allume la machine, puis se tourne vers vous.',
        'It is early and the room is nearly empty. Karim switches on the machine, then turns to you.',
      ),
      narration(
        'Vous entrez avant le travail. Au comptoir, Karim range des tasses et vous fait un petit signe.',
        'You come in before work. At the counter, Karim is putting cups away and gives you a small wave.',
      ),
      narration(
        'Une seule personne boit son café au comptoir. Karim essuie le bar devant vous et attend.',
        'One person is drinking their coffee at the counter. Karim wipes the bar in front of you and waits.',
      ),
      narration(
        'La machine siffle doucement. Karim finit de moudre le café et lève les yeux vers vous.',
        'The machine hisses quietly. Karim finishes grinding the beans and looks up at you.',
      ),
      narration(
        'Il fait encore frais dehors. Dans le café, Karim pose une soucoupe sur le comptoir et vous sourit.',
        'It is still cool outside. Inside, Karim puts a saucer on the counter and gives you a smile.',
      ),
    ],
    lines: [
      line('Karim', 'Bonjour ! Qu’est-ce que je vous sers ?', 'Hello! What can I get you?'),
      line('Karim', 'Bonjour ! Vous désirez ?', 'Hello! What would you like?'),
      line('Karim', 'Bonjour ! Pour vous, ce sera ?', 'Hello! What will it be for you?'),
    ],
  },
  'mission:cafe': {
    narrations: [
      narration(
        'La porte du café se referme derrière vous. Karim pose une tasse sur le comptoir et vient prendre votre commande.',
        'The café door swings shut behind you. Karim sets a cup on the counter and comes over to take your order.',
      ),
      narration(
        'La machine à café souffle derrière le comptoir. La personne devant vous prend son gobelet, et Karim se tourne vers vous.',
        'The coffee machine hisses behind the counter. The person ahead takes their cup, and Karim turns to you.',
      ),
      narration(
        'Une petite table vient de se libérer près de la fenêtre. Au comptoir, Karim essuie ses mains et vous fait signe d’avancer.',
        'A small table has just opened up by the window. At the counter, Karim dries his hands and waves you forward.',
      ),
      narration(
        'Des cuillères tintent dans une soucoupe. Karim finit une commande, glisse le ticket de côté et lève les yeux vers vous.',
        'Spoons clink in a saucer. Karim finishes an order, slides the receipt aside, and looks up at you.',
      ),
      narration(
        'Le café est calme entre deux coups de feu. Karim aligne deux croissants dans la vitrine, puis revient devant la caisse.',
        'The café is quiet between rushes. Karim straightens two pastries in the display, then comes back to the till.',
      ),
    ],
    lines: [
      line('Karim', 'Bonjour ! Qu’est-ce que je vous sers ?', 'Hello! What can I get you?'),
      line('Karim', 'Bonjour ! Vous prenez quoi ?', 'Hello! What are you having?'),
      line('Karim', 'Bonjour ! Qu’est-ce qui vous ferait plaisir ?', 'Hello! What would you like?'),
    ],
  },
  'mission:hotel': {
    narrations: [
      narration(
        'La clochette de la réception tinte quand vous entrez. Martine ferme son grand cahier et pose son stylo.',
        'The reception bell rings as you come in. Martine closes her large notebook and puts down her pen.',
      ),
      narration(
        'Votre valise roule sur le carrelage de la petite réception. Martine sort de la pièce du fond et vient derrière le comptoir.',
        'Your suitcase rolls across the tiled reception. Martine comes through from the back room and steps behind the desk.',
      ),
      narration(
        'Une télévision joue doucement derrière le mur. Martine accroche une clé au tableau, puis se tourne vers vous.',
        'A television is playing softly behind the wall. Martine hangs a key on the board, then turns to you.',
      ),
      narration(
        'Le soleil tombe sur le lac derrière vous. Dans la réception, Martine termine un appel et vous adresse un sourire.',
        'The sun is dropping over the lake behind you. At reception, Martine ends a phone call and gives you a smile.',
      ),
      narration(
        'Un ventilateur remue les fiches sur le comptoir. Martine les retient d’une main et avance le registre de l’autre.',
        'A fan stirs the forms on the desk. Martine holds them down with one hand and pulls the register closer with the other.',
      ),
    ],
    lines: [
      line('Martine', 'Ah, bonsoir ! Vous avez une réservation ?', 'Good evening! Do you have a booking?'),
      line('Martine', 'Bonsoir ! C’est pour une arrivée ?', 'Good evening! Are you checking in?'),
      line('Martine', 'Bonsoir, bienvenue. Vous venez pour une réservation ?', 'Good evening, welcome. Are you here for a booking?'),
    ],
  },
  'mission:marche': {
    narrations: [
      narration(
        'Le client devant vous range sa monnaie et s’éloigne. Corinne ramène une caisse de tomates au bord de l’étal.',
        'The customer ahead pockets their change and moves away. Corinne pulls a crate of tomatoes to the edge of the stall.',
      ),
      narration(
        'Un sac en papier claque dans le vent de la place. Corinne le rattrape, le cale sous sa balance et revient vers vous.',
        'A paper bag snaps in the breeze across the square. Corinne catches it, tucks it under her scales, and comes back to you.',
      ),
      narration(
        'Corinne vide les dernières tomates d’une caisse et repousse le carton sous la table. C’est votre tour.',
        'Corinne tips the last tomatoes out of a crate and pushes the box under the table. It is your turn.',
      ),
      narration(
        'La balance revient à zéro tandis que la file avance. Corinne prend un sac et vous regarde par-dessus les cagettes.',
        'The scales return to zero as the queue moves forward. Corinne picks up a bag and looks at you over the crates.',
      ),
      narration(
        'Une odeur de pêches mûres traverse l’étal. Corinne finit de servir un habitué, puis pose les deux mains sur le comptoir.',
        'The smell of ripe peaches drifts across the stall. Corinne finishes serving a regular, then rests both hands on the counter.',
      ),
    ],
    lines: [
      line('Corinne', 'Bonjour ! Qu’est-ce qu’il vous faut aujourd’hui ?', 'Hello! What do you need today?'),
      line('Corinne', 'Bonjour ! Je vous sers quoi ?', 'Hello! What can I get you?'),
      line('Corinne', 'Bonjour ! Vous aviez vu quelque chose ?', 'Hello! Did you have something in mind?'),
    ],
  },
  'mission:chemin': {
    narrations: [
      narration(
        'La pluie vient de s’arrêter et le trottoir brille encore. Sylvie attend que son chien finisse de renifler un arbre près de vous.',
        'The rain has just stopped and the pavement is still shining. Near you, Sylvie waits for her dog to finish sniffing a tree.',
      ),
      narration(
        'Vous remontez les marches du métro dans une rue inconnue. Sylvie ralentit avec son chien quand elle vous voit chercher un panneau.',
        'You come up the Metro steps onto an unfamiliar street. Sylvie slows down with her dog when she sees you looking for a sign.',
      ),
      narration(
        'Votre téléphone vient de s’éteindre au mauvais moment. Au coin de la rue, Sylvie remet la laisse de son chien dans son autre main.',
        'Your phone has just died at the worst moment. At the corner, Sylvie switches her dog lead to her other hand.',
      ),
      narration(
        'Un bus passe et vous cache les panneaux de l’autre côté. Quand il repart, Sylvie vous voit hésiter au bord du trottoir.',
        'A bus passes and blocks the signs across the road. When it pulls away, Sylvie sees you hesitating at the kerb.',
      ),
      narration(
        'Vous tournez votre plan dans un sens, puis dans l’autre. Sylvie retient son chien et s’arrête à votre hauteur.',
        'You turn your map one way, then the other. Sylvie holds her dog back and stops beside you.',
      ),
    ],
    lines: [
      line('Sylvie', 'Vous cherchez quelque chose ?', 'Are you looking for something?'),
      line('Sylvie', 'Vous êtes perdu ? Je peux vous aider ?', 'Are you lost? Can I help?'),
      line('Sylvie', 'Bonjour, vous cherchez votre chemin ?', 'Hello, are you looking for directions?'),
    ],
  },
  'mission:journee': {
    narrations: [
      narration(
        'Vous posez vos clés dans l’entrée. Nadia est dans la cuisine avec votre courrier, et la bouilloire vient de s’arrêter.',
        'You put your keys down in the hall. Nadia is in the kitchen with your post, and the kettle has just clicked off.',
      ),
      narration(
        'Votre sac touche à peine le sol que Nadia vous tend une tasse depuis le plan de travail. Elle a gardé votre courrier sous le bras.',
        'Your bag has barely touched the floor when Nadia holds out a mug from the counter. She still has your post under one arm.',
      ),
      narration(
        'Nadia est montée déposer votre courrier et elle est restée pour le thé. Elle pousse une chaise vers vous du bout du pied.',
        'Nadia came up to drop off your post and stayed for tea. She nudges a chair towards you with her foot.',
      ),
      narration(
        'La cuisine sent le thé et la pluie sur votre manteau. Nadia baisse le feu sous la bouilloire et vous regarde enfin.',
        'The kitchen smells of tea and rain from your coat. Nadia turns the heat down under the kettle and finally looks at you.',
      ),
      narration(
        'Vous rentrez plus tard que prévu. Nadia, encore appuyée contre le plan de travail, lève votre courrier comme preuve qu’elle vous attendait.',
        'You get home later than planned. Still leaning against the counter, Nadia holds up your post as proof that she was waiting.',
      ),
    ],
    lines: [
      line('Nadia', 'Tiens, salut ! Bon, raconte. Elle était comment, ta journée ?', 'Hey! Go on then, how was your day?'),
      line('Nadia', 'Ah, te voilà ! Ça a été, aujourd’hui ?', 'There you are! How did today go?'),
      line('Nadia', 'Salut toi. Alors, cette journée ?', 'Hey, you. So, how was the day?'),
    ],
  },
  'mission:amis': {
    narrations: [
      narration(
        'La porte du balcon est ouverte sur le bruit de la rue. Chloé vient vous ouvrir avec son verre encore à la main.',
        'The balcony door is open to the noise from the street. Chloé answers the door with her glass still in her hand.',
      ),
      narration(
        'Vous entendez Sami rire avant même que la porte s’ouvre. Chloé pousse un bol de chips sur la table pour vous faire une place.',
        'You hear Sami laughing before the door even opens. Chloé moves a bowl of crisps across the table to make room for you.',
      ),
      narration(
        'Une bouteille fraîche attend sur la petite table du balcon. Chloé vous aperçoit dans l’entrée et lève son verre.',
        'A cold bottle is waiting on the small balcony table. Chloé spots you in the doorway and raises her glass.',
      ),
      narration(
        'Le soleil descend entre les immeubles et la musique joue doucement. Chloé traverse le salon pour vous accueillir.',
        'The sun is dropping between the buildings and music is playing softly. Chloé crosses the living room to welcome you.',
      ),
      narration(
        'Sami cherche le décapsuleur pendant que vous arrivez. Chloé lui montre qu’il est devant lui, puis se tourne vers vous en riant.',
        'Sami is looking for the bottle opener as you arrive. Chloé points out that it is right in front of him, then turns to you laughing.',
      ),
    ],
    lines: [
      line('Chloé', 'Ah bah te voilà ! Alors, ta semaine ?', 'There you are! So, how was your week?'),
      line('Chloé', 'Salut ! Viens, raconte-nous ta semaine.', 'Hey! Come on, tell us about your week.'),
      line('Chloé', 'Enfin ! Ça va ? T’as survécu à ta semaine ?', 'Finally! You alright? Did you survive the week?'),
    ],
  },
  'mission:restaurant': {
    narrations: [
      narration(
        'Il est cinq heures. Les chaises sont encore sur les tables, et Hélène installe la terrasse. Elle pose une ardoise et se tourne vers vous.',
        'Five o’clock, and the chairs are still up on the tables. Hélène is setting out the terrace. She props up a chalkboard and turns to you.',
      ),
      narration(
        'La porte du bistrot est ouverte, mais la salle est encore vide. Hélène essuie une table près de l’entrée et lève les yeux.',
        'The bistro door is open, but the room is still empty. Hélène is wiping a table by the entrance and looks up.',
      ),
      narration(
        'Hélène écrit le plat du jour sur l’ardoise, une craie à la main. Elle s’arrête au milieu d’un mot quand vous approchez.',
        'Hélène is writing the dish of the day on the chalkboard, chalk in hand. She stops halfway through a word as you come up.',
      ),
      narration(
        'Sur le trottoir, Hélène aligne les tables de la terrasse. Elle en pose une dernière et vous fait un signe de tête.',
        'On the pavement, Hélène is lining up the terrace tables. She sets down the last one and gives you a nod.',
      ),
      narration(
        'Une odeur d’oignons qui cuisent sort de la cuisine. Derrière le comptoir, Hélène ouvre le grand cahier des réservations.',
        'A smell of onions cooking drifts out of the kitchen. Behind the counter, Hélène opens the big bookings diary.',
      ),
    ],
    lines: [
      line('Hélène', 'Bonjour ! C’est pour réserver ?', 'Hello! Are you here to book?'),
      line('Hélène', 'Bonjour ! Je peux vous aider ?', 'Hello! Can I help you?'),
      line('Hélène', 'Bonjour ! Vous voulez une table pour ce soir ?', 'Hello! Would you like a table for tonight?'),
    ],
  },
  'mission:pharmacie': {
    narrations: [
      narration(
        'Une croix verte clignote au-dessus de la porte. Dans la pharmacie, Thomas range une boîte et vous regarde.',
        'A green cross blinks above the door. Inside, Thomas puts a box back on the shelf and looks at you.',
      ),
      narration(
        'La porte automatique s’ouvre dans un souffle. Derrière le comptoir, Thomas finit d’écrire une étiquette et pose son stylo.',
        'The automatic door slides open. Behind the counter, Thomas finishes writing a label and puts down his pen.',
      ),
      narration(
        'Une dame sort avec un petit sac en papier. Thomas lui dit au revoir, puis se tourne vers vous.',
        'A woman leaves with a small paper bag. Thomas says goodbye to her, then turns to you.',
      ),
      narration(
        'Il fait bon dans la pharmacie, et ça sent l’eucalyptus. Thomas referme un tiroir plein de boîtes et vous sourit.',
        'It is warm in the pharmacy and it smells of eucalyptus. Thomas closes a drawer full of boxes and smiles at you.',
      ),
      narration(
        'Vous attendez près des tisanes pendant qu’un client paie. Quand il part, Thomas vous fait signe d’avancer.',
        'You wait by the herbal teas while a customer pays. When he leaves, Thomas waves you forward.',
      ),
    ],
    lines: [
      line('Thomas', 'Bonjour ! Qu’est-ce qui vous amène ?', 'Hello! What brings you in?'),
      line('Thomas', 'Bonjour, je vous écoute.', 'Hello, how can I help?'),
      line('Thomas', 'Bonjour ! Qu’est-ce que je peux faire pour vous ?', 'Hello! What can I do for you?'),
    ],
  },
  'mission:gare': {
    narrations: [
      narration(
        'Le grand tableau des départs change au-dessus de votre tête. Au guichet, la personne devant vous s’en va, et Julien vous fait signe.',
        'The departures board flips over above your head. At the ticket desk, the person ahead of you leaves, and Julien waves you over.',
      ),
      narration(
        'Une annonce résonne dans le hall de la gare. Julien attend qu’elle finisse, puis vous regarde à travers la vitre.',
        'An announcement echoes through the station hall. Julien waits for it to finish, then looks at you through the glass.',
      ),
      narration(
        'Des valises roulent derrière vous sur le carrelage. Au guichet, Julien tape quelque chose sur son clavier et lève la tête.',
        'Suitcases rattle across the tiles behind you. At the desk, Julien types something on his keyboard and looks up.',
      ),
      narration(
        'La file avance d’un pas. Julien imprime un billet pour le client précédent, le lui tend, et c’est votre tour.',
        'The queue moves up a step. Julien prints a ticket for the customer before you, hands it over, and it is your turn.',
      ),
      narration(
        'Un pigeon traverse le hall au-dessus des voyageurs. Julien le suit des yeux en souriant, puis se tourne vers vous.',
        'A pigeon flies across the hall above the travellers. Julien watches it with a smile, then turns to you.',
      ),
    ],
    lines: [
      line('Julien', 'Bonjour ! C’est pour quelle destination ?', 'Hello! Where are you travelling to?'),
      line('Julien', 'Bonjour ! Vous allez où ?', 'Hello! Where are you going?'),
      line('Julien', 'Bonjour ! Qu’est-ce qu’il vous faut ?', 'Hello! What do you need?'),
    ],
  },
  'mission:colis': {
    narrations: [
      narration(
        'Des journaux sont empilés près de la porte. Derrière le comptoir, des colis s’entassent sur une étagère, et Sandrine vous fait signe d’avancer.',
        'Newspapers are stacked by the door. Behind the counter, parcels are piled on a shelf, and Sandrine waves you forward.',
      ),
      narration(
        'Un client gratte un ticket à côté de la caisse. Sandrine rend la monnaie à quelqu’un d’autre, puis se tourne vers vous.',
        'A customer is scratching a lottery card by the till. Sandrine hands change to someone else, then turns to you.',
      ),
      narration(
        'La sonnette de la porte tinte derrière vous. Sandrine pose un paquet de magazines sur le comptoir et vous sourit.',
        'The door chime rings behind you. Sandrine sets a bundle of magazines on the counter and smiles at you.',
      ),
      narration(
        'Il y a deux personnes devant vous pour le loto. Quand elles partent, Sandrine essuie ses lunettes et lève les yeux.',
        'Two people ahead of you are buying lottery tickets. When they leave, Sandrine wipes her glasses and looks up.',
      ),
      narration(
        'Une pile de cartons attend d’être rangée derrière le comptoir. Sandrine en pousse un du pied et vient vers vous.',
        'A pile of boxes is waiting to be put away behind the counter. Sandrine nudges one aside with her foot and comes over to you.',
      ),
    ],
    lines: [
      line('Sandrine', 'Bonjour ! Qu’est-ce que je vous donne ?', 'Hello! What can I get you?'),
      line('Sandrine', 'Bonjour ! C’est à vous.', 'Hello! You are next.'),
      line('Sandrine', 'Bonjour, je vous écoute !', 'Hello, what can I do for you?'),
    ],
  },
  'mission:voisin': {
    narrations: [
      narration(
        'Vous montez le dernier carton au troisième étage, et la lumière de l’escalier s’éteint. La porte d’en face s’ouvre, et Monique vous regarde.',
        'You carry the last box up to the third floor, and the stairwell light clicks off. The door opposite opens, and Monique looks at you.',
      ),
      narration(
        'Vous posez un carton devant votre nouvelle porte pour chercher vos clés. Monique sort sur le palier avec une pile de courrier.',
        'You put a box down outside your new door to look for your keys. Monique steps onto the landing with a pile of post.',
      ),
      narration(
        'Un carton glisse et vous le rattrapez de justesse. En face, Monique a tout vu depuis sa porte entrouverte.',
        'A box slips and you catch it just in time. Across the landing, Monique has seen it all from her half-open door.',
      ),
      narration(
        'Il y a encore trois cartons contre le mur du palier. Monique remonte l’escalier avec son sac de courses et s’arrête à votre hauteur.',
        'Three boxes are still against the wall of the landing. Monique comes up the stairs with her shopping bag and stops beside you.',
      ),
      narration(
        'Vous rallumez la lumière de l’escalier pour la troisième fois. La porte d’en face s’ouvre, et une voisine aux cheveux blancs vous sourit.',
        'You switch the stairwell light back on for the third time. The door opposite opens, and a neighbour with white hair smiles at you.',
      ),
    ],
    lines: [
      line('Monique', 'Bonjour ! C’est vous qui venez d’emménager ?', 'Hello! Are you the one who just moved in?'),
      line('Monique', 'Ah, bonjour ! Vous emménagez ?', 'Oh, hello! Are you moving in?'),
      line('Monique', 'Bonjour ! Je peux vous aider avec ces cartons ?', 'Hello! Can I help you with those boxes?'),
    ],
  },
  'mission:week-end': {
    narrations: [
      narration(
        'Lundi matin. La machine à café fait un bruit terrible. Lucas attend son gobelet, les yeux encore un peu fermés, et il vous voit arriver.',
        'Monday morning, and the coffee machine is making a terrible noise. Lucas is waiting for his paper cup, eyes still half shut, and he sees you coming.',
      ),
      narration(
        'Il pleut sur les fenêtres du bureau. Près de la machine, Lucas souffle sur son café et vous fait un petit signe.',
        'Rain is running down the office windows. By the machine, Lucas blows on his coffee and gives you a little wave.',
      ),
      narration(
        'La machine refuse votre pièce une première fois. Lucas, à côté, rigole et tape sur le côté de la machine pour vous.',
        'The machine spits your coin back out the first time. Lucas, next to you, laughs and taps the side of it for you.',
      ),
      narration(
        'Quelqu’un a laissé des croissants à côté de la machine. Lucas en prend un, puis se retourne vers vous, la bouche pleine.',
        'Somebody has left croissants by the machine. Lucas takes one, then turns to you with his mouth full.',
      ),
      narration(
        'Les ordinateurs ne sont pas encore allumés. Lucas pose son sac sur une chaise, voit votre tête de lundi, et sourit.',
        'The computers are not on yet. Lucas drops his bag on a chair, sees your Monday face, and grins.',
      ),
    ],
    lines: [
      line('Lucas', 'Salut ! Alors, ce week-end, c’était comment ?', 'Hey! So, how was the weekend?'),
      line('Lucas', 'Ah, salut ! T’as fait quoi ce week-end ?', 'Oh, hey! What did you get up to at the weekend?'),
      line('Lucas', 'Salut ! Bon week-end ?', 'Hey! Good weekend?'),
    ],
  },
  'mission:collegues': {
    narrations: [
      narration(
        'Votre badge pend encore à son cordon tout neuf. Un ordinateur attend dans sa boîte sur votre bureau. Isabelle arrive avec deux cafés et vous en tend un.',
        'Your badge is still hanging from a brand new lanyard, and a laptop waits in its box on your desk. Isabelle walks over with two coffees and hands you one.',
      ),
      narration(
        'À l’accueil, on vient de vous donner un badge. Les portes vitrées s’ouvrent, et Isabelle traverse le couloir vers vous.',
        'At reception, someone has just handed you a badge. The glass doors slide open, and Isabelle comes down the corridor towards you.',
      ),
      narration(
        'Vous attendez dans une salle de réunion vide, un carnet neuf devant vous. Isabelle entre avec un dossier sous le bras.',
        'You are waiting in an empty meeting room with a new notebook in front of you. Isabelle comes in with a folder under her arm.',
      ),
      narration(
        'L’équipe lève la tête de ses écrans quand vous entrez dans l’open space. Isabelle se lève de son bureau et vient vers vous.',
        'The team looks up from their screens as you walk into the open-plan office. Isabelle gets up from her desk and comes over.',
      ),
      narration(
        'Il est neuf heures, et votre chaise grince un peu. Isabelle pose une plante sur votre bureau, pour le premier jour.',
        'Nine o’clock, and your new chair creaks a little. Isabelle puts a small plant on your desk, a first-day welcome.',
      ),
    ],
    lines: [
      line('Isabelle', 'Bonjour ! Vous êtes la nouvelle recrue, c’est ça ? Moi, c’est Isabelle.', 'Hello! You are the new recruit, right? I am Isabelle.'),
      line('Isabelle', 'Bonjour, bienvenue dans l’équipe ! Vous avez trouvé facilement ?', 'Hello, welcome to the team! Did you find us easily?'),
      line('Isabelle', 'Bonjour ! Alors, c’est le grand jour ?', 'Hello! So, it is the big day?'),
    ],
  },
  'mission:telephone': {
    narrations: [
      narration(
        'Vous tenez le téléphone d’une main et un stylo de l’autre. Ça sonne une fois, deux fois. Puis Nathalie décroche.',
        'Phone in one hand and a pen in the other, you listen to it ring once, then twice. Then Nathalie picks up.',
      ),
      narration(
        'Une petite musique d’attente tourne en boucle depuis une minute. Elle s’arrête d’un coup, et une voix calme répond.',
        'A little hold tune has been looping for a minute. It stops all at once, and a calm voice answers.',
      ),
      narration(
        'Dans la cuisine, vous avez noté le numéro du cabinet au dos d’une enveloppe. Ça décroche à la troisième sonnerie.',
        'In the kitchen you have written the practice number on the back of an envelope. Someone answers on the third ring.',
      ),
      narration(
        'Vous toussez une dernière fois avant d’appeler. La ligne grésille un peu, puis Nathalie répond.',
        'You cough one last time before you call. The line crackles a little, then Nathalie answers.',
      ),
      narration(
        'Le calendrier est ouvert sur la table devant vous. Au bout du fil, on entend un clavier, puis la voix de Nathalie.',
        'The calendar is open on the table in front of you. At the other end there is the sound of a keyboard, then Nathalie’s voice.',
      ),
    ],
    lines: [
      line('Nathalie', 'Cabinet médical, bonjour. Je vous écoute.', 'Medical practice, good morning. How can I help?'),
      line('Nathalie', 'Cabinet de la docteure Benali, bonjour !', 'Dr Benali’s practice, good morning!'),
      line('Nathalie', 'Bonjour, cabinet médical. Que puis-je faire pour vous ?', 'Good morning, medical practice. What can I do for you?'),
    ],
  },
  'mission:medecin': {
    narrations: [
      narration(
        'C’est le rendez-vous pris au téléphone. La docteure Benali vous fait entrer, ferme la porte et s’assoit derrière son bureau.',
        'This is the appointment you booked on the phone. Dr Benali shows you in, closes the door and sits down behind her desk.',
      ),
      narration(
        'Dans la salle d’attente, quelqu’un feuillette un vieux magazine. La porte s’ouvre, et la docteure Benali appelle votre nom.',
        'In the waiting room, somebody is leafing through an old magazine. The door opens, and Dr Benali calls your name.',
      ),
      narration(
        'Vous toussez dans votre écharpe. La docteure Benali lève les yeux de son écran et vous montre la chaise en face d’elle.',
        'You cough into your scarf. Dr Benali looks up from her screen and points you to the chair across from her.',
      ),
      narration(
        'Le cabinet sent le savon. La docteure Benali enlève ses lunettes, les pose sur le bureau et vous regarde.',
        'The consulting room smells of soap. Dr Benali takes off her glasses, sets them on the desk and looks at you.',
      ),
      narration(
        'La docteure Benali raccompagne un patient à la porte, lui dit au revoir, puis se tourne vers vous en souriant.',
        'Dr Benali sees a patient out to the door, says goodbye, then turns to you with a smile.',
      ),
    ],
    lines: [
      line('Dr Benali', 'Bonjour, asseyez-vous. Qu’est-ce qui ne va pas ?', 'Hello, have a seat. What seems to be the trouble?'),
      line('Dr Benali', 'Bonjour ! Alors, qu’est-ce qui vous arrive ?', 'Hello! So, what is going on?'),
      line('Dr Benali', 'Bonjour, entrez. Dites-moi tout.', 'Hello, come in. Tell me everything.'),
    ],
  },
  'mission:retour': {
    narrations: [
      narration(
        'Vous posez la boîte de la bouilloire sur le comptoir des retours. Derrière, Mehdi finit d’étiqueter des lampes et relève la tête.',
        'Setting the kettle box down on the returns counter, you wait. Behind it Mehdi finishes labelling some lamps and looks up.',
      ),
      narration(
        'Le magasin est plein, et il y a la queue aux caisses. Au comptoir des retours, Mehdi est seul et vous fait signe.',
        'The shop is packed and there is a queue at the tills. At the returns counter, Mehdi is on his own and waves you over.',
      ),
      narration(
        'Une cliente repart avec une lampe neuve. Mehdi range son ticket dans un tiroir et se tourne vers vous.',
        'A customer leaves with a new lamp. Mehdi puts her receipt away in a drawer and turns to you.',
      ),
      narration(
        'Vous sortez le ticket de caisse froissé de votre poche. Mehdi regarde la boîte de la bouilloire, puis vous.',
        'You pull a crumpled receipt out of your pocket. Mehdi looks at the kettle box, then at you.',
      ),
      narration(
        'Une annonce parle de promotions sur les casseroles. Au comptoir, Mehdi raccroche le téléphone et vous sourit.',
        'An announcement is going on about saucepans on offer. At the counter, Mehdi hangs up the phone and smiles at you.',
      ),
    ],
    lines: [
      line('Mehdi', 'Bonjour ! Vous venez pour un retour ?', 'Hello! Are you here to return something?'),
      line('Mehdi', 'Bonjour, qu’est-ce que je peux faire pour vous ?', 'Hello, what can I do for you?'),
      line('Mehdi', 'Bonjour ! Il y a un souci avec votre article ?', 'Hello! Is there a problem with your item?'),
    ],
  },
  'mission:appartement': {
    narrations: [
      narration(
        'La porte s’ouvre sur un appartement vide. Le parquet craque, le soleil entre par deux grandes fenêtres. Céline pose son dossier sur le rebord et se retourne.',
        'Sunlight pours through two tall windows into an empty flat, and the floorboards creak. Céline sets her folder on the sill and turns round.',
      ),
      narration(
        'L’ascenseur est tout petit. En haut, Céline sort ses clés et ouvre la porte.',
        'The lift is tiny. At the top, Céline gets out her keys and opens the door.',
      ),
      narration(
        'Un radiateur fait tic tic dans le salon vide. Céline ouvre une fenêtre, et on entend le marché dans la rue.',
        'A radiator ticks in the empty living room. Céline opens a window, and the market drifts up from the street.',
      ),
      narration(
        'Deux autres personnes visitent juste avant vous. Quand elles partent, Céline referme la porte et vous fait entrer.',
        'Two other people are viewing just before you. When they leave, Céline closes the door behind them and shows you in.',
      ),
      narration(
        'Céline allume la lumière de la cuisine. Les placards sont vides, et une vieille horloge est restée au mur.',
        'Céline switches on the kitchen light. The cupboards are empty, and an old clock has been left on the wall.',
      ),
    ],
    lines: [
      line('Céline', 'Bonjour ! Alors, voilà le salon. Vous avez des questions ?', 'Hello! So, this is the living room. Do you have any questions?'),
      line('Céline', 'Bonjour, entrez ! Je vous laisse regarder.', 'Hello, come in! I will let you have a look round.'),
      line('Céline', 'Bonjour ! Il est lumineux, hein ?', 'Hello! It is bright, isn’t it?'),
    ],
  },
  'mission:belle-famille': {
    narrations: [
      narration(
        'Il est huit heures. Vous tenez un bouquet de fleurs devant une maison éclairée. La porte s’ouvre, et Françoise s’essuie les mains sur son tablier.',
        'Eight o’clock, a bunch of flowers in your hand, outside a house with every window lit. The door opens, and Françoise wipes her hands on her apron.',
      ),
      narration(
        'Une odeur de rôti arrive jusqu’au jardin. Bernard ouvre la porte, et Françoise arrive juste derrière lui.',
        'The smell of a roast reaches all the way to the garden. Bernard opens the door, and Françoise is right behind him.',
      ),
      narration(
        'Le chien aboie avant même que vous sonniez. Françoise le retient par le collier et vous sourit sur le pas de la porte.',
        'The dog barks before you have even rung. Françoise holds it back by the collar and smiles at you from the doorstep.',
      ),
      narration(
        'La table est mise pour quatre, avec les belles assiettes. Françoise enlève son tablier en vous voyant entrer.',
        'The table is laid for four, with the good plates. Françoise takes off her apron as she sees you come in.',
      ),
      narration(
        'Dans l’entrée, Bernard prend vos manteaux. Françoise sort de la cuisine, un torchon sur l’épaule.',
        'In the hallway, Bernard takes your coats. Françoise comes out of the kitchen with a tea towel over her shoulder.',
      ),
    ],
    lines: [
      line('Françoise', 'Bonsoir ! Entrez, entrez, on vous attendait !', 'Good evening! Come in, come in, we were expecting you!'),
      line('Françoise', 'Bonsoir ! Ah, enfin, on fait connaissance !', 'Good evening! At last, we get to meet you!'),
      line('Françoise', 'Bonsoir ! Vous avez trouvé facilement ?', 'Good evening! Did you find us easily?'),
    ],
  },
  'mission:club': {
    narrations: [
      narration(
        'Une affiche annonce le cours de yoga du mardi. Derrière le bureau d’accueil, Sophie range des formulaires et lève la tête.',
        'A poster by the door announces the Tuesday yoga class. Behind the welcome desk, Sophie is tidying a pile of forms, and she looks up.',
      ),
      narration(
        'On entend de la musique dans la salle du haut. Sophie raccroche le téléphone et vous fait signe d’approcher.',
        'Music drifts down from the hall upstairs. Sophie hangs up the phone and waves you over.',
      ),
      narration(
        'Un groupe sort du cours de chant en riant. Quand le couloir se vide, Sophie vous sourit derrière son bureau.',
        'A group comes out of the choir class laughing. When the corridor empties, Sophie smiles at you from behind her desk.',
      ),
      narration(
        'Sur le tableau, des petites annonces : théâtre, couture, soirée conversation. Sophie pose son stylo et se tourne vers vous.',
        'The notice board is full of little cards for theatre, sewing and a conversation evening. Sophie puts down her pen and turns to you.',
      ),
      narration(
        'Il fait déjà nuit dehors. Dans le hall éclairé, Sophie range une pile de plannings et vous voit entrer.',
        'It is already dark outside. In the bright entrance hall, Sophie is stacking timetables, and she sees you come in.',
      ),
    ],
    lines: [
      line('Sophie', 'Bonsoir ! Je peux vous renseigner ?', 'Good evening! Can I help you with anything?'),
      line('Sophie', 'Bonsoir, vous venez pour une inscription ?', 'Good evening, are you here to sign up?'),
      line('Sophie', 'Bonsoir ! Vous cherchez un cours ?', 'Good evening! Are you looking for a class?'),
    ],
  },
  'mission:banque': {
    narrations: [
      narration(
        'La porte vitrée du bureau se referme sans bruit. Antoine tourne son écran vers vous et ouvre un nouveau dossier.',
        'The glass door of the little office closes without a sound. Antoine turns his screen towards you and opens a new file.',
      ),
      narration(
        'Dans l’agence, une imprimante crache des feuilles. Antoine vient vous chercher à l’accueil et vous montre son bureau.',
        'A printer is churning out pages in the branch. Antoine comes to fetch you from the front desk and shows you to his office.',
      ),
      narration(
        'Vous avez votre passeport et une facture dans une pochette. Antoine pose deux stylos sur la table et s’assoit en face de vous.',
        'Your passport and a bill are in a plastic sleeve. Antoine sets two pens on the table and sits down across from you.',
      ),
      narration(
        'Une cliente sort du bureau avec un grand sourire. Antoine range son dossier, puis il vous invite à entrer.',
        'A customer leaves the office with a broad smile. Antoine puts her file away, then invites you in.',
      ),
      narration(
        'Il est neuf heures, l’agence vient d’ouvrir. Antoine finit son café, ferme un tiroir et vous salue.',
        'Nine in the morning, and the branch has just opened. Antoine finishes his coffee, shuts a drawer and greets you.',
      ),
    ],
    lines: [
      line('Antoine', 'Bonjour, asseyez-vous. Je vous écoute.', 'Hello, have a seat. How can I help?'),
      line('Antoine', 'Bonjour, qu’est-ce que je peux faire pour vous ?', 'Hello, what can I do for you?'),
      line('Antoine', 'Bonjour ! Installez-vous. C’est pour quoi ?', 'Hello! Make yourself comfortable. What brings you in?'),
    ],
  },
  'mission:sortie': {
    narrations: [
      narration(
        'Ça sonne deux fois. Derrière la voix de Léa, on entend un bus qui freine et une porte qui bipe.',
        'The phone rings twice. Behind the voice that answers, a bus brakes and a door beeps open.',
      ),
      narration(
        'Vous êtes sur le canapé, le programme du cinéma ouvert sur l’ordinateur. Léa décroche à la troisième sonnerie.',
        'You are on the sofa with the cinema listings open on the laptop. Léa picks up on the third ring.',
      ),
      narration(
        'Il pleut sur la fenêtre de la cuisine. Vous appelez Léa, et elle répond en mangeant quelque chose.',
        'Rain is running down the kitchen window. You call Léa, and she answers with her mouth full.',
      ),
      narration(
        'Léa répond tout de suite. On entend de la musique chez elle, puis elle baisse le son.',
        'Léa answers straight away. There is music playing at her place, and then she turns it down.',
      ),
      narration(
        'Vous venez de voir la bande-annonce d’un film. Vous appelez Léa, et elle décroche, un peu essoufflée.',
        'You have just watched a trailer for a new film. You call Léa, and she picks up a little out of breath.',
      ),
    ],
    lines: [
      line('Léa', 'Allô ? Salut, ça va ?', 'Hello? Hey, how are you?'),
      line('Léa', 'Ouais, allô ? Ah, salut toi !', 'Yeah, hello? Oh, hey you!'),
      line('Léa', 'Salut ! Quoi de neuf ?', 'Hey! What is new?'),
    ],
  },
  'mission:montreal': {
    narrations: [
      narration(
        'Dehors, la première neige tombe sur la rue. Vous tapez vos bottes sur le tapis, et Marc-André pose une pile de tuques sur le comptoir.',
        'Outside, the first snow is falling on the street. You stamp your boots on the mat, and Marc-André sets a pile of woolly hats on the counter.',
      ),
      narration(
        'La porte s’ouvre et l’air froid entre avec vous. Entre deux rangées de parkas, Marc-André plie un chandail et lève les yeux.',
        'The door opens and the cold air comes in with you. Between two rows of parkas, Marc-André is folding a sweater, and he looks up.',
      ),
      narration(
        'Le magasin est chaud et sent la laine neuve. Marc-André accroche des manteaux sur un présentoir et vous remarque.',
        'The shop is warm and smells of new wool. Marc-André is hanging coats on a rack, and he notices you.',
      ),
      narration(
        'Vos mains sont rouges de froid. Près des caisses, Marc-André range des mitaines et vous fait un grand sourire.',
        'Your hands are red with cold. Near the tills, Marc-André is tidying a basket of mittens, and he gives you a big smile.',
      ),
      narration(
        'Une famille sort avec trois gros sacs. Marc-André remet les cintres en place, puis il vient vers vous.',
        'A family leaves with three big bags. Marc-André puts the hangers back in place, then comes over to you.',
      ),
    ],
    lines: [
      line('Marc-André', 'Bonjour ! Je peux vous aider ?', 'Hello! Can I help you?'),
      line('Marc-André', 'Bonjour ! Vous magasinez pour l’hiver ?', 'Hello! Shopping for the winter?'),
      line('Marc-André', 'Bonjour ! Il fait frette dehors, hein ? Je peux vous aider ?', 'Hello! Freezing out there, isn’t it? Can I help you?'),
    ],
  },
  'mission:coup-de-main': {
    narrations: [
      narration(
        'L’écran affiche encore le même message d’erreur. Vous vous levez et vous approchez du bureau d’Inès, qui enlève son casque.',
        'The screen is showing the same error message again. You get up and go over to the desk where Inès is sliding off her headphones.',
      ),
      narration(
        'L’imprimante clignote orange depuis dix minutes. Inès passe avec son mug et s’arrête à côté de vous.',
        'The printer has been blinking orange for ten minutes. Inès walks past with her mug and stops beside you.',
      ),
      narration(
        'La réunion est dans une heure et vous n’avez pas de salle. Inès tape sur son clavier, deux bureaux plus loin.',
        'The meeting is in an hour and you still have no room. Inès is typing away, two desks further down.',
      ),
      narration(
        'Vous cherchez un fichier depuis un quart d’heure. Inès revient de la machine à café et vous voit froncer les sourcils.',
        'You have been hunting for a file for a quarter of an hour. Inès comes back from the coffee machine and sees you frowning.',
      ),
      narration(
        'Le bureau est calme, tout le monde a son casque. Inès lève la tête de son écran quand vous approchez votre chaise.',
        'The office is quiet, everyone in headphones. Inès looks up from her screen as you roll your chair over.',
      ),
    ],
    lines: [
      line('Inès', 'Oui ? Dis-moi.', 'Yes? What is it?'),
      line('Inès', 'Ça va ? T’as besoin d’un coup de main ?', 'You all right? Need a hand?'),
      line('Inès', 'Ouais ? Je t’écoute.', 'Yeah? I am listening.'),
    ],
  },
  'mission:anniversaire': {
    narrations: [
      narration(
        'Des guirlandes en papier bougent dans les arbres. Manon ouvre le portail en riant, et vous cachez un petit paquet derrière votre dos.',
        'Paper garlands sway in the trees. Manon opens the gate laughing, and you hide a small parcel behind your back.',
      ),
      narration(
        'On entend des rires dans le jardin et de la musique. Manon arrive en courant, une couronne en carton sur la tête.',
        'Laughter and music come from the garden. Manon runs over with a cardboard crown on her head.',
      ),
      narration(
        'La grande table est couverte de salades et de bouteilles. Manon pose un plat et vient vous embrasser.',
        'The long table is covered in salads and bottles. Manon puts down a dish and comes over to kiss you on both cheeks.',
      ),
      narration(
        'Un cousin allume le barbecue, la fumée monte. Manon vous voit arriver avec votre cadeau et lève les bras.',
        'A cousin is lighting the barbecue, and smoke rises. Manon sees you arrive with your present and throws up her arms.',
      ),
      narration(
        'Le gâteau au chocolat attend sur la table, avec ses bougies. Manon ouvre la porte du jardin et vous fait un grand sourire.',
        'The chocolate cake waits on the table with its candles. Manon opens the garden door and gives you a huge smile.',
      ),
    ],
    lines: [
      line('Manon', 'Salut ! Entre, entre, tout le monde est dans le jardin !', 'Hi! Come in, come in, everyone is in the garden!'),
      line('Manon', 'Ah, te voilà ! Trop bien !', 'Oh, there you are! Brilliant!'),
      line('Manon', 'Salut ! Trop contente de te voir !', 'Hi! So happy to see you!'),
    ],
  },
  'mission:fuite': {
    narrations: [
      narration(
        "Le seau sous l'évier est presque plein. Vous appelez votre propriétaire, et il décroche à la deuxième sonnerie.",
        'The bucket under the sink is almost full. You call your landlord, and he picks up on the second ring.',
      ),
      narration(
        'Une flaque s’étale sur le carrelage de la cuisine. Vous tenez une serpillière d’une main et le téléphone de l’autre.',
        'A puddle is spreading across the kitchen tiles. You hold a mop in one hand and the phone in the other.',
      ),
      narration(
        'Le voisin du dessous vient de sonner : il y a une tache au plafond chez lui. Vous composez le numéro du propriétaire.',
        'The neighbour from downstairs has just rung the bell about a stain on his ceiling. You dial the landlord’s number.',
      ),
      narration(
        'Toute la nuit, vous avez entendu un petit bruit de goutte. Ce matin, le placard sous l’évier est trempé.',
        'All night you heard a small dripping sound. This morning the cupboard under the sink is soaked.',
      ),
      narration(
        'L’eau est coupée, les serviettes sont par terre. Vous vous asseyez sur une chaise et vous appelez le propriétaire.',
        'The water is off and the towels are on the floor. You sit down on a chair and call the landlord.',
      ),
    ],
    lines: [
      line('Patrick', 'Allô, oui, bonjour ?', 'Hello, yes?'),
      line('Patrick', 'Bonjour ! Tout va bien dans l’appartement ?', 'Hello! Is everything all right in the flat?'),
      line('Patrick', 'Allô ? Oui, je vous écoute.', 'Hello? Yes, I am listening.'),
    ],
  },
  'mission:galere': {
    narrations: [
      narration(
        "Hugo pose deux verres sur la table et s'installe. Il vous regarde avec un grand sourire.",
        'Hugo puts two glasses on the table and settles in. He looks at you with a big grin.',
      ),
      narration(
        'La terrasse est pleine, le soleil descend sur la place. Hugo tire une chaise et s’assoit en face de vous.',
        'The terrace is full, and the sun is going down over the square. Hugo pulls out a chair and sits facing you.',
      ),
      narration(
        'Le serveur apporte les boissons. Hugo trinque avec vous, puis s’accoude à la table.',
        'The waiter brings the drinks. Hugo clinks glasses with you, then leans on the table.',
      ),
      narration(
        'Vous bâillez encore à cause du week-end. Hugo le remarque tout de suite et hausse un sourcil.',
        'You are still yawning from the weekend. Hugo notices straight away and raises an eyebrow.',
      ),
      narration(
        'Hugo range son téléphone et pousse un bol de chips vers vous. Il a envie d’une histoire.',
        'Hugo puts his phone away and pushes a bowl of crisps towards you. He is in the mood for a story.',
      ),
    ],
    lines: [
      line('Hugo', 'Alors, ce week-end ? Raconte !', 'So, the weekend? Tell me everything!'),
      line('Hugo', 'T’as une tête, toi ! Il s’est passé quoi ?', 'Look at you! What happened?'),
      line('Hugo', 'Alors, c’était comment, ton week-end ?', 'So, how was your weekend?'),
    ],
  },
  'mission:avis': {
    narrations: [
      narration(
        'Les billets de cinéma traînent encore sur la table. Yasmine enlève sa veste et vous regarde, curieuse.',
        'The cinema tickets are still lying on the table. Yasmine takes off her jacket and looks at you, curious.',
      ),
      narration(
        'Le générique vient de finir et la salle se rallume. Yasmine s’étire et attrape son manteau.',
        'The credits have just finished and the lights come back up. Yasmine stretches and grabs her coat.',
      ),
      narration(
        'Dehors, il fait frais et la rue est calme. Yasmine marche à côté de vous, les mains dans les poches.',
        'Outside it is cool and the street is quiet. Yasmine walks beside you, hands in her pockets.',
      ),
      narration(
        'Le bar à côté du cinéma est presque vide. Yasmine commande deux verres et se tourne vers vous.',
        'The bar next to the cinema is almost empty. Yasmine orders two drinks and turns to you.',
      ),
      narration(
        'Une affiche du film est collée sur la vitre du bar. Yasmine la montre du doigt en riant.',
        'A poster for the film is stuck on the bar window. Yasmine points at it, laughing.',
      ),
    ],
    lines: [
      line('Yasmine', "Alors ? T'en as pensé quoi ?", 'So? What did you think?'),
      line('Yasmine', 'Bon, moi, j’ai mon avis. Mais toi d’abord !', 'Right, I have my opinion. But you first!'),
      line('Yasmine', 'Alors, verdict ? Tu as aimé ?', 'So, the verdict? Did you like it?'),
    ],
  },
  'mission:entretien': {
    narrations: [
      narration(
        'Claire Lefèvre vous fait entrer dans une petite salle de réunion. Elle pose votre CV sur la table et vous sourit.',
        'Claire Lefèvre shows you into a small meeting room. She puts your CV on the table and smiles at you.',
      ),
      narration(
        'Une carafe d’eau et deux verres attendent sur la table. Claire Lefèvre ferme la porte et s’assoit en face de vous.',
        'A jug of water and two glasses wait on the table. Claire Lefèvre closes the door and sits down opposite you.',
      ),
      narration(
        'Par la fenêtre, on voit les toits de la ville. Claire Lefèvre ouvre son carnet et prend un stylo.',
        'Through the window you can see the rooftops. Claire Lefèvre opens her notebook and picks up a pen.',
      ),
      narration(
        'Vous attendez dans le hall depuis quelques minutes. Claire Lefèvre arrive, vous serre la main et vous emmène au calme.',
        'You have been waiting in the lobby for a few minutes. Claire Lefèvre arrives, shakes your hand and leads you somewhere quiet.',
      ),
      narration(
        'La salle est lumineuse, avec une plante dans un coin. Claire Lefèvre relit votre CV une dernière fois, puis lève les yeux.',
        'The room is bright, with a plant in one corner. Claire Lefèvre reads your CV through one last time, then looks up.',
      ),
    ],
    lines: [
      line('Claire Lefèvre', 'Asseyez-vous, je vous en prie. Alors, parlez-moi un peu de vous.', 'Please, have a seat. So, tell me a little about yourself.'),
      line('Claire Lefèvre', 'Merci d’avoir fait le déplacement. Pour commencer, pouvez-vous me présenter votre parcours ?', 'Thank you for coming in. To start, could you walk me through your background?'),
      line('Claire Lefèvre', 'Bonjour, et bienvenue. Racontez-moi un peu votre parcours.', 'Hello, and welcome. Tell me a little about your background.'),
    ],
  },
  'mission:teletravail': {
    narrations: [
      narration(
        "La porte du bureau d'Isabelle est ouverte. Vous frappez doucement, et elle lève les yeux de son écran.",
        'The door to the manager’s office is open. You knock softly, and Isabelle looks up from her screen.',
      ),
      narration(
        'La réunion d’équipe vient de finir. Isabelle range ses affaires et vous fait signe de rester un instant.',
        'The team meeting has just ended. Isabelle gathers her things and signals you to stay a moment.',
      ),
      narration(
        'Isabelle est à la machine à café, seule pour une fois. Vous vous approchez avec votre tasse.',
        'Isabelle is at the coffee machine, alone for once. You walk over with your mug.',
      ),
      narration(
        'Le planning de l’équipe est affiché sur l’écran du bureau. Isabelle le regarde en fronçant les sourcils, puis vous voit arriver.',
        'The team schedule is up on the office screen. Isabelle frowns at it, then sees you coming.',
      ),
      narration(
        'Il est tard, le plateau se vide. Isabelle ferme son ordinateur portable quand vous passez la tête par la porte.',
        'It is late and the floor is emptying. Isabelle closes her laptop as you put your head round the door.',
      ),
    ],
    lines: [
      line('Isabelle', "Oui, entre ! Qu'est-ce qui se passe ?", 'Yes, come in! What is up?'),
      line('Isabelle', 'Ah, salut ! Tu voulais me voir ?', 'Oh, hi! Did you want to see me?'),
      line('Isabelle', 'Oui ? J’ai cinq minutes, vas-y.', 'Yes? I have got five minutes, go ahead.'),
    ],
  },
  'mission:souvenirs': {
    narrations: [
      narration(
        'Jeannine ouvre un vieil album photo sur ses genoux. Le café fume dans des tasses à fleurs.',
        'Jeannine opens an old photo album on her knees. Coffee steams in flowered cups.',
      ),
      narration(
        'Une horloge sonne dans le salon. Jeannine pose une boîte de biscuits sur la nappe et tapote la chaise à côté d’elle.',
        'A clock chimes in the living room. Jeannine puts a tin of biscuits on the tablecloth and pats the chair beside her.',
      ),
      narration(
        'Le jardin sent la lavande et les volets sont à moitié fermés. Jeannine s’installe dans son fauteuil préféré.',
        'The garden smells of lavender and the shutters are half closed. Jeannine settles into her favourite armchair.',
      ),
      narration(
        'Une vieille photo en noir et blanc glisse de l’album et tombe à vos pieds. Jeannine sourit en la voyant.',
        'An old black and white photo slips out of the album and lands at your feet. Jeannine smiles when she sees it.',
      ),
      narration(
        'Tout le monde est parti se promener, et vous restez avec Jeannine dans la cuisine. Elle verse le café.',
        'Everyone else has gone for a walk, and you stay behind with Jeannine in the kitchen. She pours the coffee.',
      ),
    ],
    lines: [
      line('Jeannine', 'Viens t’asseoir à côté de moi. Alors, tu as grandi où, toi ?', 'Come and sit next to me. So, where did you grow up?'),
      line('Jeannine', 'Alors, raconte-moi. Tu viens d’où, toi ?', 'So, tell me. Where are you from?'),
      line('Jeannine', 'Tu sais, j’aime bien qu’on me pose des questions. Mais toi d’abord : tu as grandi où ?', 'You know, I like being asked questions. But you first: where did you grow up?'),
    ],
  },
};

function openingIndex(id: MissionId, seed: string): number {
  // FNV-1a gives stable distribution without importing randomness, storing
  // state, or making the caller coordinate an integer variant id.
  let hash = 0x811c9dc5;
  for (const char of `${id}:${seed}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 15;
}

/**
 * The frame for a mission, or undefined when the id means nothing here.
 *
 * Undefined rather than a throw, and undefined rather than a stock café: an app
 * and an agent ship independently, so an id this worker has never heard of has
 * to degrade into the ordinary "what would you like to talk about" question
 * rather than take the session down or quietly substitute a different scene.
 */
export function missionFrame(id: string, sessionSeed?: string): ScenarioFrame | undefined {
  if (!Object.prototype.hasOwnProperty.call(MISSION_FRAMES, id)) return undefined;

  const missionId = id as MissionId;
  const frame = MISSION_FRAMES[missionId];
  if (sessionSeed === undefined) return frame;

  const deck = MISSION_OPENING_DECKS[missionId];
  const selected = openingIndex(missionId, sessionSeed);
  return {
    ...frame,
    openingNarration: deck.narrations[Math.floor(selected / 3)]!,
    openingLine: deck.lines[selected % 3]!,
  };
}
