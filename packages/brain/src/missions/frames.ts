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
 * because that file calls itself the quality bar. The other seventeen of the
 * nineteen are authored here to match it: the A0 and A1 scenes first, then the
 * seven A2 ones (weekend chat, first day at work, booking by phone, the doctor,
 * a shop return, a flat viewing and dinner with a partner's parents).
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
