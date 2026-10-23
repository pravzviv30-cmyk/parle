/**
 * The practice path.
 *
 * A content graph, and nothing else. Node state is a PROJECTION of the review
 * deck rather than a second store, which is the whole design: the deck already
 * knows what is due and what has been earned, and a path with its own
 * bookkeeping would sooner or later say "complete" about phrases the deck was
 * calling due that morning.
 *
 * On gating, deliberately against the reference design. PRODUCT.md principle 1
 * is "Never let the learner be stuck. Support is present by default and
 * withdrawn as they improve — not absent and granted on request." A path that
 * locks node four until node three is finished is the opposite of that. So
 * every authored node is open in any order, and sequence is expressed as ONE
 * node marked `next` carrying the single primary action. The only thing that
 * genuinely locks is `mine` — practice written from the learner's own
 * conversations, which does not exist until they have had one.
 */

import type { DrillExercise } from '../drill/types.ts';
import { isDue } from '../review/evidence.ts';
import type { ReviewCard } from '../review/scheduler.ts';
import type { PracticeTopic } from '../topics/topics.ts';

export type NodeKind = 'lesson' | 'phrases' | 'mine' | 'topic';

export type NodeState =
  /** Written from conversations the learner has not had yet. */
  | 'locked'
  /** Open, untouched. */
  | 'available'
  /** Some of its phrases are in the deck, not all. */
  | 'in-progress'
  /** Every phrase earned, nothing due. */
  | 'complete'
  /** Earned once, and the scheduler wants it again. */
  | 'needs-review';

export interface PathNode {
  id: string;
  title: string;
  /** What it is in one short line. */
  sub: string;
  kind: NodeKind;
  /** Which phrases this node drills. Empty for the guided lesson. */
  phraseKeys: readonly string[];
  state: NodeState;
  /**
   * The one node carrying the screen's single primary action. Kept separate
   * from `state` so being next never hides what a node actually is — a node
   * can be half-learned AND the thing to do now, and the map should say both.
   */
  isNext: boolean;
}

export interface PathUnit {
  id: string;
  title: string;
  nodes: PathNode[];
}

/** Exercises the tutor wrote carry this prefix on their id. */
export const GENERATED_PREFIX = 'gen:';

/**
 * The authored graph.
 *
 * Honest about its own size. It used to hold one lesson and one fixture bank,
 * and said so rather than drawing a map of empty rooms. It now carries a unit
 * per authored mission, because a mission's phrases have to have somewhere to
 * be practised or the card the learner taps opens onto nothing. Past that it
 * still grows where the product actually grows — from what the learner says.
 */
interface AuthoredNode {
  id: string;
  title: string;
  sub: string;
  kind: NodeKind;
  phraseKeys: readonly string[];
}

interface AuthoredUnit {
  id: string;
  title: string;
  nodes: readonly AuthoredNode[];
}

export const AUTHORED_PATH: readonly AuthoredUnit[] = [
  {
    id: 'cafe',
    title: 'Au café',
    nodes: [
      { id: 'cafe:lesson', title: 'Commander un café', sub: 'The guided lesson', kind: 'lesson', phraseKeys: [] },
      {
        id: 'cafe:greet',
        title: 'Walking in',
        sub: 'Never order before you say hello',
        kind: 'phrases',
        // 2026-09-27: the opener's first line joined the café unit, so the
        // three-line first scene drills exactly what it asks the learner to say.
        phraseKeys: [
          "phrase:bonjour, un café s'il vous plaît",
          "phrase:un café, s'il vous plaît",
          'phrase:bonjour, je vais prendre un café',
        ],
      },
      {
        id: 'cafe:order',
        title: 'Ordering',
        sub: 'Here or away, and what else',
        kind: 'phrases',
        phraseKeys: [
          "phrase:sur place, s'il vous plaît",
          "phrase:sur place, au comptoir, s'il vous plaît",
          'phrase:je vais prendre un croissant',
          "phrase:oui, c'est tout, merci",
          'phrase:ça sera tout, merci',
        ],
      },
      {
        id: 'cafe:paying',
        title: 'Paying and leaving',
        sub: 'Card, thanks, and the way out',
        kind: 'phrases',
        phraseKeys: [
          'phrase:je peux payer par carte ?',
          'phrase:je vous dois combien ?',
          'phrase:merci beaucoup',
          'phrase:bonne journée !',
        ],
      },
      {
        id: 'cafe:rescue',
        title: 'When you lose the thread',
        sub: 'The lines that keep a conversation alive',
        kind: 'phrases',
        phraseKeys: ['phrase:pardon, vous pouvez répéter ?', 'phrase:où sont les toilettes ?'],
      },
    ],
  },
  {
    id: 'amis',
    title: 'Entre amis',
    nodes: [
      {
        id: 'amis:greet',
        title: 'Saying hello',
        sub: 'How friends actually open',
        kind: 'phrases',
        phraseKeys: ['phrase:salut ! ça va ?', 'phrase:ça marche', 'phrase:carrément !'],
      },
      {
        id: 'amis:plans',
        title: 'Making a plan',
        sub: 'Agreeing, and saying how your week went',
        kind: 'phrases',
        phraseKeys: [
          'phrase:on fait quoi samedi ?',
          'phrase:santé !',
          "phrase:c'était un truc de ouf",
          "phrase:j'suis crevé, la semaine était longue",
        ],
      },
    ],
  },
  {
    id: 'hotel',
    title: 'À la réception',
    nodes: [
      {
        id: 'hotel:arriving',
        title: 'Arriving',
        sub: 'How a check-in opens, and how you thank her',
        kind: 'phrases',
        phraseKeys: ["phrase:bonsoir, j'ai une réservation", 'phrase:je vous remercie'],
      },
      {
        id: 'hotel:asking',
        title: 'Asking about the stay',
        sub: 'Breakfast, the floor, and the key',
        kind: 'phrases',
        phraseKeys: [
          "phrase:le petit déjeuner, c'est à quelle heure ?",
          "phrase:c'est à quel étage ?",
          'phrase:faut laisser la clé quand je sors ?',
        ],
      },
    ],
  },
  {
    id: 'marche',
    title: 'Au marché',
    nodes: [
      {
        id: 'marche:asking',
        title: 'Asking at the stall',
        sub: 'What you want, and what it costs',
        kind: 'phrases',
        phraseKeys: [
          'phrase:bonjour, je voudrais un kilo de tomates',
          'phrase:elles sont à combien, les tomates ?',
          'phrase:ça fait combien ?',
        ],
      },
      {
        id: 'marche:choosing',
        title: 'Choosing and leaving',
        sub: 'Those ones, for tonight, and a good weekend',
        kind: 'phrases',
        phraseKeys: ["phrase:celles-là, s'il vous plaît", "phrase:c'est pour ce soir", 'phrase:merci, bon week-end !'],
      },
    ],
  },
  {
    id: 'chemin',
    title: 'Demander son chemin',
    nodes: [
      {
        id: 'chemin:stopping',
        title: 'Stopping someone',
        sub: 'How to open, and why you are asking',
        kind: 'phrases',
        phraseKeys: ['phrase:excusez-moi, je cherche la gare', "phrase:j'suis pas d'ici"],
      },
      {
        id: 'chemin:understanding',
        title: 'Understanding the answer',
        sub: 'The lines that stop you nodding at nothing',
        kind: 'phrases',
        phraseKeys: [
          "phrase:plus lentement, s'il vous plaît",
          "phrase:c'est à gauche ou à droite ?",
          "phrase:d'accord, je vois",
          "phrase:c'est loin ?",
        ],
      },
    ],
  },
  {
    id: 'journee',
    title: 'Ta journée',
    nodes: [
      {
        id: 'journee:telling',
        title: 'Saying how it went',
        sub: 'Three answers that cover any day',
        kind: 'phrases',
        phraseKeys: ['phrase:ça a été', "phrase:comme d'hab", "phrase:j'ai pas arrêté"],
      },
      {
        id: 'journee:asking-back',
        title: 'Asking them back',
        sub: 'The lines that keep a catch-up going',
        kind: 'phrases',
        phraseKeys: ['phrase:et toi, ta journée ?', 'phrase:tant mieux', 'phrase:ah mince'],
      },
    ],
  },
  {
    id: 'restaurant',
    title: 'Une table pour ce soir',
    nodes: [
      {
        id: 'restaurant:booking',
        title: 'Asking for a table',
        sub: 'Two people, tonight, and what time',
        kind: 'phrases',
        phraseKeys: ['phrase:bonjour, vous avez une table pour deux ce soir ?', "phrase:vers vingt heures, c'est possible ?"],
      },
      {
        id: 'restaurant:settling',
        title: 'Where you sit, and goodbye',
        sub: 'Outside if you can, and see you tonight',
        kind: 'phrases',
        phraseKeys: ["phrase:en terrasse, si c'est possible", 'phrase:à ce soir, alors'],
      },
    ],
  },
  {
    id: 'pharmacie',
    title: 'À la pharmacie',
    nodes: [
      {
        id: 'pharmacie:telling',
        title: 'Saying what is wrong',
        sub: 'What hurts, and since when',
        kind: 'phrases',
        phraseKeys: ["phrase:bonjour, j'ai mal à la gorge", 'phrase:depuis hier soir'],
      },
      {
        id: 'pharmacie:asking',
        title: 'Asking about the medicine',
        sub: 'How often, and whether you need a prescription',
        kind: 'phrases',
        phraseKeys: ['phrase:je le prends combien de fois par jour ?', 'phrase:faut une ordonnance ?'],
      },
    ],
  },
  {
    id: 'gare',
    title: 'Au guichet de la gare',
    nodes: [
      {
        id: 'gare:ticket',
        title: 'Buying the ticket',
        sub: 'A return, and the next train',
        kind: 'phrases',
        phraseKeys: ["phrase:un aller-retour pour lyon, s'il vous plaît", 'phrase:le prochain train part à quelle heure ?'],
      },
      {
        id: 'gare:finding',
        title: 'Finding your train',
        sub: 'Which platform, and whether you change',
        kind: 'phrases',
        phraseKeys: ["phrase:c'est quelle voie ?", "phrase:c'est un train direct ?"],
      },
    ],
  },
  {
    id: 'colis',
    title: 'Au point relais',
    nodes: [
      {
        id: 'colis:asking',
        title: 'Asking for your parcel',
        sub: 'What you came for, and the code',
        kind: 'phrases',
        phraseKeys: ['phrase:bonjour, je viens chercher un colis', "phrase:j'ai reçu un code par sms"],
      },
      {
        id: 'colis:collecting',
        title: 'Taking it home',
        sub: 'Your ID, and checking it is yours',
        kind: 'phrases',
        phraseKeys: ["phrase:voilà ma pièce d'identité", "phrase:oui, c'est bien ça, merci"],
      },
    ],
  },
  {
    id: 'voisin',
    title: 'Sur le palier',
    nodes: [
      {
        id: 'voisin:meeting',
        title: 'Saying hello',
        sub: 'Who you are, and how long they have lived here',
        kind: 'phrases',
        phraseKeys: ["phrase:bonjour, je viens d'emménager au troisième", 'phrase:vous habitez ici depuis longtemps ?'],
      },
      {
        id: 'voisin:asking',
        title: 'A good tip, and goodbye',
        sub: 'Where the good bread is',
        kind: 'phrases',
        phraseKeys: ['phrase:y a une bonne boulangerie dans le coin ?', 'phrase:bonne soirée, à bientôt'],
      },
    ],
  },
  {
    id: 'week-end',
    title: 'Alors, ce week-end ?',
    nodes: [
      {
        id: 'week-end:telling',
        title: 'Telling your weekend',
        sub: 'What you did, and one detail',
        kind: 'phrases',
        phraseKeys: ["phrase:samedi, j'ai vu des amis", "phrase:on a mangé au resto, c'était top"],
      },
      {
        id: 'week-end:asking',
        title: 'Their turn, then back to work',
        sub: 'What they did, and heading back',
        kind: 'phrases',
        phraseKeys: ["phrase:et toi, t'as fait quoi ?", "phrase:bon, j'y retourne"],
      },
    ],
  },
  {
    id: 'collegues',
    title: 'Le premier jour',
    nodes: [
      {
        id: 'collegues:introducing',
        title: 'Who you are',
        sub: 'Starting today, and your last job',
        kind: 'phrases',
        phraseKeys: ["phrase:bonjour, je commence aujourd'hui dans l'équipe", 'phrase:avant, je travaillais dans une banque'],
      },
      {
        id: 'collegues:settling',
        title: 'Saying tu, and finding your way',
        sub: 'Accepting tu, then using it',
        kind: 'phrases',
        phraseKeys: ["phrase:d'accord, on se tutoie", 'phrase:tu peux me montrer la cantine ?'],
      },
    ],
  },
  {
    id: 'telephone',
    title: 'Prendre rendez-vous',
    nodes: [
      {
        id: 'telephone:asking',
        title: 'Asking for a slot',
        sub: 'Why you are calling, and something sooner',
        kind: 'phrases',
        phraseKeys: ['phrase:bonjour, je voudrais prendre rendez-vous', 'phrase:vous auriez quelque chose plus tôt ?'],
      },
      {
        id: 'telephone:checking',
        title: 'Hearing it right',
        sub: 'Asking again, and spelling your name',
        kind: 'phrases',
        phraseKeys: ["phrase:pardon, j'ai pas bien entendu", "phrase:je vous l'épelle"],
      },
    ],
  },
  {
    id: 'medecin',
    title: 'Chez le médecin',
    nodes: [
      {
        id: 'medecin:telling',
        title: 'Saying what the trouble is',
        sub: 'The cough, and since when',
        kind: 'phrases',
        phraseKeys: ['phrase:je tousse beaucoup, surtout la nuit', 'phrase:depuis la semaine dernière'],
      },
      {
        id: 'medecin:answering',
        title: 'Questions both ways',
        sub: 'No fever, and how long to take it',
        kind: 'phrases',
        phraseKeys: ["phrase:non, j'ai pas de fièvre", 'phrase:je dois le prendre pendant combien de temps ?'],
      },
    ],
  },
  {
    id: 'retour',
    title: 'Rapporter un article',
    nodes: [
      {
        id: 'retour:explaining',
        title: 'Saying what the problem is',
        sub: 'The problem, and the receipt',
        kind: 'phrases',
        phraseKeys: ["phrase:bonjour, j'ai un problème avec cette bouilloire", "phrase:j'ai gardé le ticket de caisse"],
      },
      {
        id: 'retour:insisting',
        title: 'Asking for your money back',
        sub: 'A refund, and a manager if needed',
        kind: 'phrases',
        phraseKeys: ['phrase:je préfère un remboursement', "phrase:c'est possible de voir avec un responsable ?"],
      },
    ],
  },
  {
    id: 'appartement',
    title: 'Visiter un appartement',
    nodes: [
      {
        id: 'appartement:rent',
        title: 'The rent and the date',
        sub: 'What is included, and when it is free',
        kind: 'phrases',
        phraseKeys: ["phrase:le loyer, c'est charges comprises ?", 'phrase:il est libre à partir de quand ?'],
      },
      {
        id: 'appartement:file',
        title: 'The application',
        sub: 'What to send, and whether you need a guarantor',
        kind: 'phrases',
        phraseKeys: ["phrase:qu'est-ce qu'il faut pour le dossier ?", 'phrase:faut un garant ?'],
      },
    ],
  },
  {
    id: 'belle-famille',
    title: 'Dîner chez ses parents',
    nodes: [
      {
        id: 'belle-famille:arriving',
        title: 'At the door and at the table',
        sub: 'The flowers, and the food',
        kind: 'phrases',
        phraseKeys: ["phrase:bonsoir ! tenez, c'est pour vous", "phrase:c'est délicieux, c'est vous qui l'avez fait ?"],
      },
      {
        id: 'belle-famille:leaving',
        title: 'Plans, and goodbye',
        sub: 'The summer, and thanks for the evening',
        kind: 'phrases',
        phraseKeys: ["phrase:on va passer l'été dans le sud", 'phrase:merci beaucoup pour cette soirée'],
      },
    ],
  },
  {
    id: 'club',
    title: "S'inscrire au club",
    nodes: [
      {
        id: 'club:asking',
        title: 'Which class, and when',
        sub: 'The class you want, and the day and time',
        kind: 'phrases',
        phraseKeys: ["phrase:je voudrais m'inscrire au cours de yoga", "phrase:c'est quel jour, et à quelle heure ?"],
      },
      {
        id: 'club:signing',
        title: 'A first class, and what to bring',
        sub: 'A first try, and what you need',
        kind: 'phrases',
        phraseKeys: ["phrase:on peut faire un cours d'essai ?", "phrase:qu'est-ce qu'il faut apporter ?"],
      },
    ],
  },
  {
    id: 'banque',
    title: 'Ouvrir un compte',
    nodes: [
      {
        id: 'banque:opening',
        title: 'Why you are here',
        sub: 'An account, and your new address',
        kind: 'phrases',
        phraseKeys: ['phrase:bonjour, je voudrais ouvrir un compte', 'phrase:je viens de déménager dans le quartier'],
      },
      {
        id: 'banque:papers',
        title: 'Papers and the card',
        sub: 'What to bring, and when the card comes',
        kind: 'phrases',
        phraseKeys: ['phrase:vous avez besoin de quels documents ?', 'phrase:et la carte bancaire, je la reçois quand ?'],
      },
    ],
  },
  {
    id: 'sortie',
    title: 'On se fait un ciné ?',
    nodes: [
      {
        id: 'sortie:suggesting',
        title: 'Asking a friend out',
        sub: 'The cinema, and another day',
        kind: 'phrases',
        phraseKeys: ['phrase:on se fait un ciné ?', 'phrase:samedi, je peux pas, mais dimanche, ça te va ?'],
      },
      {
        id: 'sortie:settling',
        title: 'Where, and when',
        sub: 'The place, and Saturday evening',
        kind: 'phrases',
        phraseKeys: ['phrase:on se retrouve devant le cinéma ?', "phrase:t'es libre samedi soir ?"],
      },
    ],
  },
  {
    id: 'montreal',
    title: "Un manteau pour l'hiver",
    nodes: [
      {
        id: 'montreal:looking',
        title: 'The coat you need',
        sub: 'What you are after, and a bigger size',
        kind: 'phrases',
        phraseKeys: ["phrase:bonjour, je cherche un manteau pour l'hiver", "phrase:vous l'avez dans une plus grande taille ?"],
      },
      {
        id: 'montreal:deciding',
        title: 'How it fits, and the price',
        sub: 'Too tight, and the taxes on top',
        kind: 'phrases',
        phraseKeys: ['phrase:il est un peu serré aux épaules', 'phrase:il coûte combien, avec les taxes ?'],
      },
    ],
  },
  {
    id: 'coup-de-main',
    title: 'Un petit coup de main ?',
    nodes: [
      {
        id: 'coup-de-main:asking',
        title: 'Asking for help',
        sub: 'A minute of her time, and what is stuck',
        kind: 'phrases',
        phraseKeys: ["phrase:t'as deux minutes ?", "phrase:j'arrive pas à réserver une salle"],
      },
      {
        id: 'coup-de-main:learning',
        title: 'Show me, and checking',
        sub: 'How she does it, and saying it back',
        kind: 'phrases',
        phraseKeys: ['phrase:tu peux me montrer comment tu fais ?', "phrase:si j'ai bien compris, il faut d'abord choisir la date"],
      },
    ],
  },
  {
    id: 'anniversaire',
    title: "L'anniversaire de sa sœur",
    nodes: [
      {
        id: 'anniversaire:arriving',
        title: 'The present, and your story',
        sub: 'Happy birthday, and how you met',
        kind: 'phrases',
        phraseKeys: ["phrase:joyeux anniversaire ! c'est pour toi", "phrase:on s'est rencontrés par des amis"],
      },
      {
        id: 'anniversaire:chatting',
        title: 'Your story, and more cake',
        sub: 'How long together, and a little more',
        kind: 'phrases',
        phraseKeys: ['phrase:on est ensemble depuis deux ans', 'phrase:allez, juste un petit peu alors'],
      },
    ],
  },
  {
    id: 'fuite',
    title: 'Il y a une fuite',
    nodes: [
      {
        id: 'fuite:explaining',
        title: 'The leak, and what you did',
        sub: 'Where it is, since when, and the water turned off',
        kind: 'phrases',
        phraseKeys: ["phrase:il y a une fuite sous l'évier de la cuisine", "phrase:ça a commencé hier soir, et j'ai coupé l'eau"],
      },
      {
        id: 'fuite:arranging',
        title: 'The damage, and the plumber',
        sub: 'The flat below, and when someone can come',
        kind: 'phrases',
        phraseKeys: ["phrase:l'eau coule chez le voisin du dessous", 'phrase:un plombier pourrait passer quand ?'],
      },
    ],
  },
  {
    id: 'galere',
    title: 'Tu vas pas me croire',
    nodes: [
      {
        id: 'galere:scene',
        title: 'Setting the scene',
        sub: 'The rain, the station, and the cancelled train',
        kind: 'phrases',
        phraseKeys: ["phrase:il pleuvait, et j'étais à la gare", 'phrase:et là, le train a été annulé'],
      },
      {
        id: 'galere:ending',
        title: 'What you did next',
        sub: 'The night bus, and how it ended',
        kind: 'phrases',
        phraseKeys: ["phrase:du coup, j'ai pris le bus de nuit", "phrase:finalement, j'ai dormi chez des amis"],
      },
    ],
  },
  {
    id: 'avis',
    title: 'Alors, ce film ?',
    nodes: [
      {
        id: 'avis:opinion',
        title: 'Your opinion, and why',
        sub: 'What you thought, and what you liked',
        kind: 'phrases',
        phraseKeys: ["phrase:à mon avis, c'était vraiment réussi", "phrase:ce qui m'a plu, c'est l'histoire"],
      },
      {
        id: 'avis:nuance',
        title: 'A nuance, and a polite no',
        sub: 'Good but long, and not quite agreeing',
        kind: 'phrases',
        phraseKeys: ["phrase:c'était pas mal, par contre c'était un peu long", "phrase:je suis pas tout à fait d'accord"],
      },
    ],
  },
  {
    id: 'entretien',
    title: "L'entretien d'embauche",
    nodes: [
      {
        id: 'entretien:background',
        title: 'Your background, and why this job',
        sub: 'What you have done, and what draws you',
        kind: 'phrases',
        phraseKeys: ["phrase:j'ai travaillé plusieurs années dans la vente", "phrase:ce poste m'intéresse parce que j'aime le travail en équipe"],
      },
      {
        id: 'entretien:strength',
        title: 'A strength, and a question',
        sub: 'What you do well, and what a day looks like',
        kind: 'phrases',
        phraseKeys: ["phrase:mon point fort, c'est l'organisation", "phrase:j'aimerais savoir à quoi ressemble une journée type"],
      },
    ],
  },
  {
    id: 'teletravail',
    title: 'Demander du télétravail',
    nodes: [
      {
        id: 'teletravail:asking',
        title: 'The request, and why',
        sub: 'Asking politely, and the reason',
        kind: 'phrases',
        phraseKeys: ['phrase:est-ce que ce serait possible de télétravailler ?', "phrase:à la maison, j'arrive mieux à me concentrer"],
      },
      {
        id: 'teletravail:settling',
        title: 'Her concern, and a trial',
        sub: 'The meetings, and trying it out',
        kind: 'phrases',
        phraseKeys: ["phrase:pour les réunions d'équipe, je serais toujours là", 'phrase:et si on faisait un essai, pour voir ?'],
      },
    ],
  },
  {
    id: 'souvenirs',
    title: 'Chez la grand-mère',
    nodes: [
      {
        id: 'souvenirs:childhood',
        title: 'Where you grew up',
        sub: 'The town, and what childhood was like',
        kind: 'phrases',
        phraseKeys: ["phrase:j'ai grandi dans une petite ville au bord de la mer", "phrase:quand j'étais enfant, on jouait dehors tout le temps"],
      },
      {
        id: 'souvenirs:then-and-now',
        title: 'Her youth, and today',
        sub: 'Asking about her, and comparing',
        kind: 'phrases',
        phraseKeys: ["phrase:et vous, comment c'était, quand vous étiez jeune ?", "phrase:aujourd'hui, tout va beaucoup plus vite"],
      },
    ],
  },
  {
    id: 'mine',
    title: 'From your conversations',
    nodes: [
      {
        id: 'mine:recent',
        title: 'What you said',
        sub: 'Written by your tutor from your own talk',
        kind: 'mine',
        phraseKeys: [],
      },
    ],
  },
];

export interface PathOptions {
  /** Whether the guided lesson has ever been finished. */
  lessonDone: boolean;
}

/**
 * Whether the bank can drill any of these phrases at all.
 *
 * The gap this closes is small and entirely reachable. A conversation banks its
 * phrases into the review deck and authors drills for them, in that order, from
 * two separate post-session calls. Close the app between the two and the topic
 * has phrases the deck knows and nothing that can drill them, so the node
 * projected as tappable and opened onto "Nothing due right now" — a door with
 * nothing behind it, at the exact moment a learner went looking for what they
 * had just said.
 */
function drillableKeys(keys: readonly string[], bank: readonly DrillExercise[]): string[] {
  return keys.filter((key) => bank.some((exercise) => exercise.phraseKey === key));
}

/**
 * Completion is unchanged from the day this file was written. What moved is
 * where "due" is decided: `isDue` in the evidence module, so the map, the
 * missions list, the deck and the phrasebook cannot end an afternoon
 * disagreeing about whether a phrase is wanted back.
 */
function stateForPhrases(keys: readonly string[], deck: readonly ReviewCard[], now: number): NodeState {
  if (keys.length === 0) return 'available';
  const cards = deck.filter((c) => keys.includes(c.id));
  if (cards.length === 0) return 'available';
  if (cards.some((c) => isDue(c, now))) return cards.length === keys.length ? 'needs-review' : 'in-progress';
  return cards.length === keys.length ? 'complete' : 'in-progress';
}

/** "Talked about" counts in words, because mid-app copy never carries numbers. */
function discussedInWords(times: number): string {
  if (times <= 1) return 'Talked about once';
  if (times === 2) return 'Talked about twice';
  if (times <= 4) return 'Talked about a few times';
  return 'One of your regulars';
}

/**
 * Derive the path from the deck, the bank and the learner's own topics.
 *
 * `now` is a parameter for the same reason it is everywhere else in core: a
 * rule about when something is due that cannot be tested across a boundary is
 * a rule nobody can trust.
 */
export function buildPath(
  deck: readonly ReviewCard[],
  bank: readonly DrillExercise[],
  topics: readonly PracticeTopic[],
  opts: PathOptions,
  now: number,
): PathUnit[] {
  const hasGenerated = bank.some((e) => e.id.startsWith(GENERATED_PREFIX));
  const generatedKeys = [...new Set(bank.filter((e) => e.id.startsWith(GENERATED_PREFIX)).map((e) => e.phraseKey))];

  const units: PathUnit[] = AUTHORED_PATH.map((unit) => ({
    id: unit.id,
    title: unit.title,
    nodes: unit.nodes.map((node): PathNode => {
      if (node.kind === 'lesson') {
        return { ...node, phraseKeys: [], state: opts.lessonDone ? 'complete' : 'available', isNext: false };
      }
      if (node.kind === 'mine') {
        return {
          ...node,
          phraseKeys: generatedKeys,
          state: hasGenerated ? stateForPhrases(generatedKeys, deck, now) : 'locked',
          isNext: false,
        };
      }
      return { ...node, state: stateForPhrases(node.phraseKeys, deck, now), isNext: false };
    }),
  }));

  // The learner's own topics replace the generic "what you said" node the
  // moment they exist: one card per topic actually talked about, each a real
  // door into a drill sitting over that topic's phrases. The generic node
  // stays only as the pre-topic fallback (old sessions produced drills but no
  // topics) and as the locked promise before any conversation has happened.
  const mine = units.find((u) => u.id === 'mine');
  if (mine !== undefined && topics.length > 0) {
    mine.nodes = topics.map(
      (topic): PathNode => ({
        id: topic.id,
        title: topic.title.en,
        sub: discussedInWords(topic.discussed.length),
        kind: 'topic',
        phraseKeys: topic.phraseKeys,
        // State is projected over the phrases that can actually be drilled,
        // not over every phrase the topic names. None of them drillable is
        // locked, and that is the one lock DESIGN.md sanctions: practice
        // written from your conversations, still being written.
        //
        // Projecting over all of them was the subtler half of the same bug: a
        // topic whose only drillable phrase was already known and not due read
        // as in-progress, because the phrase with no drill counted as missing
        // from the deck. Tappable, and nothing behind it.
        state: (() => {
          const drillable = drillableKeys(topic.phraseKeys, bank);
          return drillable.length === 0 ? 'locked' : stateForPhrases(drillable, deck, now);
        })(),
        isNext: false,
      }),
    );
  }

  // Exactly one node carries the primary action: the first thing that is not
  // finished. Anything the scheduler wants back comes first, because a phrase
  // slipping away matters more than new ground.
  const flat = units.flatMap((u) => u.nodes);
  const target =
    flat.find((n) => n.state === 'needs-review') ??
    flat.find((n) => n.state === 'in-progress') ??
    flat.find((n) => n.state === 'available');
  if (target) target.isNext = true;

  return units;
}

/** Every phrase the authored path drills. Used to prove none is orphaned. */
export function authoredPhraseKeys(): string[] {
  return AUTHORED_PATH.flatMap((u) => u.nodes.flatMap((n) => n.phraseKeys));
}
