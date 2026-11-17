/** Authored first-use tasks. The same target, prompts and checks serve guest and offline practice. */
import { normalise } from './lessons/types.ts';
import { LEARNER_GOALS, type LearnerGoal } from './firstPractice.ts';
export const STARTER_GOALS = LEARNER_GOALS;
export type StarterGoal = LearnerGoal;
export type StarterDrink = 'coffee' | 'tea';
export interface StarterTask {
  id: string;
  title: string;
  prompt: string;
  translation: string;
  model: string;
  meaning: string;
  starter: string;
  success: string;
  correction: string;
}
const task = (
  id: string,
  title: string,
  prompt: string,
  translation: string,
  model: string,
  meaning: string,
  starter: string,
  success: string,
  correction: string,
): StarterTask => ({
  id,
  title,
  prompt,
  translation,
  model,
  meaning,
  starter,
  success,
  correction,
});
export function starterTasks(
  goal: StarterGoal | null,
  drink: StarterDrink = 'coffee',
  minutes: 5 | 10 | 15 | 'none' | null = 5,
): readonly StarterTask[] {
  const item = drink === 'tea' ? 'thé' : 'café';
  const routes: Record<StarterGoal, StarterTask[]> = {
    food: [
      task(
        'drink',
        `Order a ${drink}`,
        'Bonjour ! Qu’est-ce que je vous sers ?',
        'Hello! What can I get you?',
        `Bonjour, je vais prendre un ${item}.`,
        `Hello, I will have a ${drink}.`,
        'Bonjour, je vais…',
        `You asked for a ${drink}.`,
        `Ask for a ${drink} with « un ${item} ». Add « bonjour » to greet the person.`,
      ),
      task(
        'food',
        'Order something to eat',
        'Et avec ça ?',
        'Anything with that?',
        'Un croissant, s’il vous plaît.',
        'A croissant, please.',
        'Un…',
        'You asked for a croissant.',
        'Use « un croissant » for a croissant.',
      ),
      task(
        'pay',
        'Ask to pay',
        'Vous avez terminé ?',
        'Have you finished?',
        'L’addition, s’il vous plaît.',
        'The bill, please.',
        'L’addition…',
        'You asked to pay.',
        'Ask for the bill with « l’addition, s’il vous plaît ».',
      ),
    ],
    family: [
      task(
        'family-hello',
        'Greet someone you know',
        'Salut ! Ça va ?',
        'Hi! How are you?',
        'Ça va bien, merci. Et toi ?',
        'I’m well, thank you. And you?',
        'Ça va…',
        'You answered the greeting.',
        'Answer with « ça va bien », then ask « et toi ? ».',
      ),
      task(
        'family-day',
        'Ask about their day',
        'J’ai passé une bonne journée.',
        'I had a good day.',
        'Qu’est-ce que tu as fait ?',
        'What did you do?',
        'Qu’est-ce que…',
        'You asked about their day.',
        'Ask « qu’est-ce que tu as fait ? ».',
      ),
      task(
        'family-see',
        'Arrange to meet',
        'On se voit quand ?',
        'When shall we see each other?',
        'Demain, si tu veux.',
        'Tomorrow, if you like.',
        'Demain…',
        'You suggested a day to meet.',
        'Suggest a day, for example « demain ».',
      ),
    ],
    trip: [
      task(
        'directions',
        'Ask for directions',
        'Bonjour, vous cherchez quelque chose ?',
        'Hello, are you looking for something?',
        'Où est la gare, s’il vous plaît ?',
        'Where is the station, please?',
        'Où est…',
        'You asked where the station is.',
        'Ask « où est la gare, s’il vous plaît ? ».',
      ),
      task(
        'ticket',
        'Ask for a ticket',
        'Bonjour, vous allez où ?',
        'Hello, where are you going?',
        'Un billet pour Paris, s’il vous plaît.',
        'A ticket to Paris, please.',
        'Un billet…',
        'You asked to travel to Paris.',
        'Use « un billet pour Paris ».',
      ),
      task(
        'hotel',
        'Ask for your room',
        'Bonsoir, vous avez une réservation ?',
        'Good evening, do you have a booking?',
        'Oui, j’ai une réservation.',
        'Yes, I have a booking.',
        'Oui, j’ai…',
        'You said you have a booking.',
        'Say « oui, j’ai une réservation ».',
      ),
    ],
    moving: [
      task(
        'introduce',
        'Introduce yourself nearby',
        'Bonjour, vous habitez ici ?',
        'Hello, do you live here?',
        'Oui, je viens d’arriver.',
        'Yes, I’ve just arrived.',
        'Oui, je…',
        'You introduced yourself as a neighbour.',
        'Say « oui, je viens d’arriver ».',
      ),
      task(
        'errand',
        'Ask about opening hours',
        'Bonjour, je peux vous aider ?',
        'Hello, can I help you?',
        'À quelle heure fermez-vous ?',
        'What time do you close?',
        'À quelle heure…',
        'You asked about closing time.',
        'Ask « à quelle heure fermez-vous ? ».',
      ),
      task(
        'bag',
        'Ask for a bag',
        'Vous voulez un sac ?',
        'Would you like a bag?',
        'Oui, un sac, s’il vous plaît.',
        'Yes, a bag, please.',
        'Oui, un…',
        'You asked for a bag.',
        'Say « oui, un sac, s’il vous plaît ».',
      ),
    ],
    work: [
      task(
        'colleague',
        'Greet a new colleague',
        'Bonjour ! Vous êtes nouveau ici ?',
        'Hello! Are you new here?',
        'Bonjour, oui. Enchanté.',
        'Hello, yes. Nice to meet you.',
        'Bonjour, oui…',
        'You greeted your colleague.',
        'Start with « bonjour ». Add « enchanté » or « enchantée » for nice to meet you.',
      ),
      task(
        'team',
        'Introduce your role',
        'Vous travaillez dans quelle équipe ?',
        'Which team do you work in?',
        'Je travaille dans cette équipe.',
        'I work in this team.',
        'Je travaille…',
        'You introduced your team.',
        'Start with « je travaille dans… ».',
      ),
      task(
        'work-help',
        'Ask a colleague for help',
        'Vous avez une question ?',
        'Do you have a question?',
        'Vous pouvez m’aider, s’il vous plaît ?',
        'Can you help me, please?',
        'Vous pouvez…',
        'You asked your colleague for help.',
        'Ask « vous pouvez m’aider, s’il vous plaît ? ».',
      ),
    ],
    because: [],
  };
  routes.because = routes.food;
  return routes[goal ?? 'food'].slice(0, minutes === 15 ? 3 : minutes === 10 ? 2 : 1);
}
export interface StarterFeedback {
  accepted: boolean;
  text: string;
  model: string;
  evidence: 'typed' | 'spoken' | 'model';
}
/** This bounded check recognises authored target phrases. It is not pronunciation or an open-ended proficiency assessment. */
const concise = (text: string) =>
  normalise(text)
    .replace(/^(bonjour|bonsoir|salut|excusez moi)\s+/, '')
    .replace(/\s+(sil vous plait|sil te plait|merci)$/, '')
    .trim();
const variants: Readonly<Record<string, readonly string[]>> = {
  drink: [
    'un café',
    'un thé',
    'je voudrais un café',
    'je voudrais un thé',
    'je prends un café',
    'je prends un thé',
  ],
  food: ['un croissant', 'je voudrais un croissant'],
  pay: ['l’addition', 'je peux payer', 'je voudrais payer'],
  'family-hello': ['ça va', 'ça va bien', 'je vais bien', 'bien merci', 'ça va bien merci et toi'],
  'family-day': ['qu’est-ce que tu as fait', 'comment était ta journée'],
  'family-see': ['demain', 'samedi', 'dimanche', 'demain si tu veux'],
  directions: ['où est la gare', 'je cherche la gare'],
  ticket: ['un billet pour Paris', 'je voudrais un billet pour Paris', 'je vais à Paris'],
  hotel: ['oui j’ai une réservation', 'j’ai une réservation'],
  introduce: [
    'oui je viens d’arriver',
    'je viens d’arriver',
    'je suis nouveau',
    'je suis nouvelle',
    'oui j’habite ici',
  ],
  errand: [
    'à quelle heure fermez-vous',
    'à quelle heure vous fermez',
    'vous fermez à quelle heure',
  ],
  bag: ['oui un sac', 'un sac', 'oui'],
  colleague: [
    'bonjour',
    'bonjour oui enchanté',
    'bonjour oui enchantée',
    'oui enchanté',
    'oui enchantée',
    'enchanté',
    'enchantée',
  ],
  team: ['je travaille dans cette équipe', 'je travaille dans votre équipe'],
  'work-help': ['vous pouvez m’aider', 'pouvez-vous m’aider', 'aidez-moi', 'tu peux m’aider'],
};
/**
 * Conservative whole-line matching. Unrecognised alternatives receive a model, never a claim they are invalid French.
 *
 * A reply that is the tutor's own line read back is not an answer, however it
 * normalises (F716). "Salut ! Ça va ?" loses its accent, its punctuation and
 * then its greeting on the way to "ca va", which is one of family-hello's real
 * answers. Comparing the whole normalised line to the prompt first stops that
 * without touching "Ça va" said on its own, which is an answer.
 *
 * Known cost, accepted by the founder on 2026-10-06 (D20): "Salut, ça va."
 * typed as a statement is also refused, because without punctuation it is the
 * same words as the question, and on the spoken path the punctuation is the
 * recogniser's guess rather than the learner's. Refusing it shows the model
 * answer; accepting a read-back question would praise a copy as a first win.
 */
export function checkStarter(
  task: StarterTask,
  reply: string,
  evidence: StarterFeedback['evidence'],
): StarterFeedback {
  const echoed = normalise(reply) === normalise(task.prompt);
  const line = concise(reply);
  const forms = [task.model, ...(variants[task.id] ?? [])];
  const chosen =
    task.id === 'drink'
      ? forms.filter((form) =>
          normalise(form).includes(normalise(task.model).includes('the') ? 'the' : 'cafe'),
        )
      : forms;
  const accepted = !echoed && chosen.some((form) => line === concise(form));
  return {
    accepted,
    text: accepted
      ? task.success
      : echoed
        ? `That repeats the question. Here is one way to answer: « ${task.model} »`
        : `Here is one reply for this task. ${task.correction}`,
    model: task.model,
    evidence,
  };
}
