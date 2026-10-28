/**
 * Synthetic sessions for the memory extraction eval (extractEval.ts).
 *
 * Every person, place detail and aside here is invented for the eval. No line
 * comes from a real learner. Assistant lines use the shapes historyViewOfTurn
 * produces: `(narration) …`, `(coach) …`, `Speaker: fr`, `(noted …)`,
 * `(taught: …)`, `(beat: …)`. Learner lines are role 'user'.
 *
 * A matcher is an AND of OR-groups of lowercase keywords, tested as substrings
 * against a fact's `en` + `fr`: [["interview","entretien"],["tuesday","mardi"]]
 * means (interview OR entretien) AND (tuesday OR mardi).
 */

import type { ChatMessage, MemoryFact } from '@luvani/brain';

export type Matcher = string[][];

export interface ExpectedFact {
  kind: MemoryFact['kind'];
  match: Matcher;
  because: string;
  /** An updated version of a fact already on file: allowed, and not a repeat. */
  update?: boolean;
}

export interface ExtractFixture {
  id: string;
  label: string;
  history: ChatMessage[];
  knownFacts: MemoryFact[];
  /** Real facts a good extraction should find. Recall is measured on these. */
  expected: ExpectedFact[];
  /** Real but minor: allowed, not required, not counted as unlabelled. */
  optional: Matcher[];
  /** Things that happened only inside the scene. Each entry is an OR-group; a fact matching any group is a leak. */
  fiction: string[][];
  /** Details the memory policy forbids storing. Checked in facts and both openers. */
  sensitive: string[][];
  /** Facts already on file. A fact matching one (and no expected update) is a repeat. */
  known: string[][];
  /** Whether something real surfaced, so the openers should be non-null. */
  openerExpected: boolean;
}

const u = (text: string): ChatMessage => ({ role: 'user', text });
const a = (text: string): ChatMessage => ({ role: 'assistant', text });

export const EXTRACT_FIXTURES: ExtractFixture[] = [
  {
    id: 'interview-tuesday',
    label: 'bakery scene, real job interview mentioned in an aside',
    history: [
      a('(narration) A small bakery on a rainy morning. The baker smiles at you.'),
      a('Boulangère: Bonjour ! Qu’est-ce que je vous sers ?'),
      u('Bonjour, je voudrais un croissant, s’il vous plaît.'),
      a('Boulangère: Avec plaisir. Et avec ceci ?'),
      u('Sorry, quick thing, I need to practise because I have a job interview in French on Tuesday.'),
      a('(coach) Good luck! We can practise interview phrases after this scene.'),
      u('Merci. Et une baguette aussi.'),
      a('(noted vocab: "baguette aussi" -> "une baguette aussi, s’il vous plaît")'),
      a('Boulangère: Ça fait trois euros dix.'),
      u('Voilà. Bonne journée !'),
    ],
    knownFacts: [],
    expected: [{ kind: 'life-event', match: [['interview', 'entretien'], ['tuesday', 'mardi']], because: 'learner aside about their real week' }],
    optional: [],
    fiction: [['croissant', 'baguette', 'bakery', 'boulangerie']],
    sensitive: [],
    known: [],
    openerExpected: true,
  },
  {
    id: 'climbing-interest',
    label: 'train station scene, real hobby in an aside',
    history: [
      a('(narration) Gare de Lyon, a busy ticket counter.'),
      a('Agent: Bonjour, vous allez où ?'),
      u('Un billet pour Grenoble, s’il vous plaît.'),
      a('(taught: un aller simple = a one-way ticket)'),
      a('Agent: Aller simple ou aller-retour ?'),
      u('Aller-retour. Actually in real life I go rock climbing most weekends, Grenoble would be perfect for that.'),
      a('(coach) Nice! "Je fais de l’escalade" is how you say it.'),
      u('Je fais de l’escalade le week-end.'),
      a('Agent: Très bien. Quarante-deux euros.'),
    ],
    knownFacts: [],
    expected: [{ kind: 'interest', match: [['climb', 'escalade']], because: 'stated as real life' }],
    optional: [],
    fiction: [['ticket', 'billet', 'grenoble']],
    sensitive: [],
    known: [],
    openerExpected: true,
  },
  {
    id: 'practice-preference',
    label: 'pharmacy roleplay, learner states how they like to practise',
    history: [
      a('(narration) A pharmacy near the station.'),
      a('Pharmacien: Bonjour, je peux vous aider ?'),
      u('Can you speak a bit slower? And honestly I like it when you correct me straight away.'),
      a('(coach) Of course, I will slow down and correct you as we go.'),
      u('Je cherche quelque chose pour le mal de tête.'),
      a('(noted grammar: "pour le mal de tête" -> "contre le mal de tête")'),
      a('Pharmacien: Voici du paracétamol.'),
      u('Merci beaucoup.'),
    ],
    knownFacts: [],
    expected: [{ kind: 'preference', match: [['slow', 'lent', 'doucement']], because: 'explicit practice preference' }],
    optional: [[['correct']]],
    fiction: [['headache', 'mal de tête', 'paracétamol', 'paracetamol']],
    sensitive: [],
    known: [],
    openerExpected: true,
  },
  {
    id: 'delf-goal',
    label: 'post office scene, real exam goal',
    history: [
      a('(narration) La Poste, a short queue.'),
      a('Employée: Bonjour, c’est pour un envoi ?'),
      u('Oui, je voudrais envoyer ce colis au Canada.'),
      a('Employée: En prioritaire ?'),
      u('Oui. By the way my goal is to pass the DELF B1 in June, so push me.'),
      a('(coach) Deal. B1 means more full sentences, let us aim for those.'),
      a('(beat: the clerk weighs the parcel)'),
      u('Combien ça coûte ?'),
      a('Employée: Vingt-trois euros.'),
    ],
    knownFacts: [],
    expected: [{ kind: 'goal', match: [['delf']], because: 'explicit learning goal' }],
    optional: [],
    fiction: [['colis', 'parcel', 'canada', 'poste']],
    sensitive: [],
    known: [],
    openerExpected: true,
  },
  {
    id: 'pure-fiction-cafe',
    label: 'café scene with no asides at all',
    history: [
      a('(narration) A terrace café in the sun.'),
      a('Serveur: Bonjour, vous désirez ?'),
      u('Un café et un croissant, s’il vous plaît.'),
      a('Serveur: Tout de suite.'),
      a('(beat: the order arrives)'),
      u('L’addition, s’il vous plaît.'),
      a('(taught: l’addition = the bill)'),
      a('Serveur: Quatre euros cinquante.'),
      u('Merci, au revoir !'),
    ],
    knownFacts: [],
    expected: [],
    optional: [],
    fiction: [['coffee', 'café', 'croissant', 'terrace', 'terrasse']],
    sensitive: [],
    known: [],
    openerExpected: false,
  },
  {
    id: 'fiction-looks-like-life',
    label: 'learner plays an architect in Lyon, in the first person',
    history: [
      a('(narration) A networking evening in Lyon. You are an architect new in town.'),
      a('Claire: Enchantée ! Vous faites quoi dans la vie ?'),
      u('Je suis architecte. J’habite à Lyon depuis un mois.'),
      a('Claire: Ah, super ! Et vous aimez Lyon ?'),
      u('Oui, j’adore. Hier j’ai commandé un café sur la place Bellecour.'),
      a('(noted grammar: "sur la place" -> "place Bellecour")'),
      a('Claire: Vous avez des enfants ?'),
      u('Oui, deux garçons.'),
      a('Claire: Bonne soirée alors !'),
    ],
    knownFacts: [],
    expected: [],
    optional: [],
    fiction: [['architect'], ['lyon', 'bellecour', 'café', 'coffee', 'garçons', 'boys', 'children', 'enfants']],
    sensitive: [],
    known: [],
    openerExpected: false,
  },
  {
    id: 'sensitive-with-eligible',
    label: 'restaurant scene, health and religion asides beside an eligible trip',
    history: [
      a('(narration) A bistro, lunchtime.'),
      a('Serveuse: Vous avez choisi ?'),
      u('Sorry if I am slow today, I was just diagnosed with diabetes and it is a lot.'),
      a('(coach) That sounds like a lot. Want to keep going with the menu, or stop here?'),
      u('Let us keep going. Also as a Muslim I am fasting soon, so this is all pretend.'),
      a('(coach) Understood. Shall we order?'),
      u('Je voudrais la salade, s’il vous plaît.'),
      u('I am practising because I visit my partner’s family in Lyon next month.'),
      a('(coach) Lovely, family dinners are great practice.'),
      a('Serveuse: Très bien, une salade.'),
    ],
    knownFacts: [],
    expected: [{ kind: 'life-event', match: [['family', 'famille'], ['lyon']], because: 'ordinary family travel, named eligible by the policy' }],
    optional: [],
    fiction: [['salad', 'salade', 'bistro']],
    sensitive: [['diabet', 'diagnos', 'sugar', 'sucre', 'health', 'santé'], ['muslim', 'musulman', 'islam', 'fasting', 'jeûne', 'ramadan', 'relig']],
    known: [],
    openerExpected: true,
  },
  {
    id: 'sensitive-only',
    label: 'market scene, money and politics asides and nothing eligible',
    history: [
      a('(narration) An open-air market.'),
      a('Marchand: Bonjour ! Des pommes ?'),
      u('Oui, un kilo. Honestly I cannot afford much, I am pretty deep in debt right now.'),
      a('(coach) Thanks for telling me. Want to keep shopping in the scene?'),
      u('Yes. And I just voted for the Green party, sorry, the election is on my mind.'),
      a('(coach) Back to the market then?'),
      u('Combien pour les pommes ?'),
      a('Marchand: Deux euros.'),
    ],
    knownFacts: [],
    expected: [],
    optional: [],
    fiction: [['apple', 'pomme', 'market', 'marché']],
    sensitive: [['debt', 'dette', 'afford', 'money', 'argent', 'budget', 'financ'], ['vote', 'green', 'party', 'election', 'élection', 'politi']],
    known: [],
    openerExpected: false,
  },
  {
    id: 'known-facts-update',
    label: 'facts already on file come up again, one of them changed',
    history: [
      a('(narration) A kitchen shop.'),
      a('Vendeur: Je peux vous aider ?'),
      u('Je cherche une casserole. You know I love cooking.'),
      a('(coach) I remember! "J’adore cuisiner."'),
      u('J’adore cuisiner. Oh, and our Quebec trip moved from August to September.'),
      a('(coach) Got it, September then.'),
      a('Vendeur: Cette casserole coûte trente euros.'),
      u('Je la prends.'),
    ],
    knownFacts: [
      { kind: 'interest', en: 'They love cooking.', fr: 'Il adore cuisiner.', happensAround: null },
      { kind: 'life-event', en: 'They are going to Quebec.', fr: 'Il va au Québec.', happensAround: 'August' },
    ],
    expected: [{ kind: 'life-event', match: [['quebec', 'québec'], ['september', 'septembre']], because: 'update of a fact on file', update: true }],
    optional: [],
    fiction: [['casserole', 'saucepan', 'kitchen shop']],
    sensitive: [],
    known: [['cook', 'cuisin'], ['quebec', 'québec']],
    openerExpected: true,
  },
  {
    id: 'long-market',
    label: 'twenty-plus turn market scene with two real asides',
    history: [
      a('(narration) A Saturday market in a small town. Stalls of vegetables everywhere.'),
      a('Maraîchère: Bonjour ! Qu’est-ce qui vous ferait plaisir ?'),
      u('Bonjour ! Je voudrais des tomates.'),
      a('Maraîchère: Combien ?'),
      u('Un kilo, s’il vous plaît.'),
      a('(noted vocab: "un kilo" -> "un kilo de tomates")'),
      a('Maraîchère: Voilà. Autre chose ?'),
      u('Des courgettes aussi. I grow them myself at home actually, I love gardening.'),
      a('(coach) Lovely! "J’adore jardiner."'),
      u('J’adore jardiner.'),
      a('(taught: le potager = the vegetable garden)'),
      a('Maraîchère: Vous avez un potager ? Moi aussi !'),
      u('Oui, un petit potager.'),
      a('(beat: a dog runs past the stall)'),
      a('Maraîchère: Et des fraises ? Elles sont très bonnes.'),
      u('Oui, une barquette.'),
      a('(noted grammar: "une barquette" -> "une barquette de fraises")'),
      u('My daughter starts French at school this year, I want to be able to help her with homework.'),
      a('(coach) What a great reason. We can do school words next time.'),
      u('Merci. Combien je vous dois ?'),
      a('Maraîchère: Neuf euros quarante.'),
      u('Voilà dix euros.'),
      a('Maraîchère: Et soixante centimes. Bonne journée !'),
      u('Bonne journée !'),
    ],
    knownFacts: [],
    expected: [
      { kind: 'goal', match: [['daughter', 'fille'], ['homework', 'devoirs', 'help', 'aider', 'school', 'école']], because: 'real family goal' },
      { kind: 'interest', match: [['garden', 'jardin', 'potager', 'grow']], because: 'stated as real life' },
    ],
    optional: [],
    fiction: [['tomato', 'tomate', 'strawberr', 'fraise', 'kilo', 'market', 'marché']],
    sensitive: [],
    known: [],
    openerExpected: true,
  },
];
