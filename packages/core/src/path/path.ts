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
        phraseKeys: ["phrase:bonjour, un café s'il vous plaît", "phrase:un café, s'il vous plaît"],
      },
      {
        id: 'cafe:order',
        title: 'Ordering',
        sub: 'Here or away, and what else',
        kind: 'phrases',
        phraseKeys: [
          "phrase:sur place, s'il vous plaît",
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
        phraseKeys: ['phrase:je peux payer par carte ?', 'phrase:merci beaucoup', 'phrase:bonne journée !'],
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
