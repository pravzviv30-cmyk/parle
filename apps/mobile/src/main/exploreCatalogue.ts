import { DAILY_SCENARIOS, MISSIONS, type DailyScenario, type Mission } from '@luvani/core';
import type { SeedTopic } from '../tutor/convoStart.ts';
import { DAILY_ITEMS, type DailyItem } from '../daily/catalogue.ts';
import { freeExploreScenarioIds } from '../purchases/exploreAccess.ts';

/** Original route keys stay valid; each topic now has an explicit scenario theme. */
export const EXPLORE_TOPICS = [
  { key: 'food', title: 'Food & cafés', theme: 'cafe-and-food', motif: 'market', tone: 'rose', synonyms: 'food café cafe coffee restaurant meal manger boire' },
  { key: 'friends', title: 'Friends & plans', theme: 'friends-and-small-talk', motif: 'plans', tone: 'plum', synonyms: 'friend ami small talk plans famille family invitation soirée' },
  { key: 'travel', title: 'On the move', theme: 'transport', motif: 'travel', tone: 'teal', synonyms: 'travel transport train métro metro bus ticket voyage gare direction trip' },
  { key: 'work', title: 'Work & study', theme: 'work-and-study', motif: 'talk', tone: 'ochre', synonyms: 'work study travail étude école school meeting réunion bureau' },
  { key: 'shops', title: 'Shops & markets', theme: 'shops-and-markets', motif: 'market', tone: 'ochre', synonyms: 'shop market shopping magasin marché courses buying return acheter' },
  { key: 'home', title: 'Home & neighbours', theme: 'home-and-neighbours', motif: 'cloud', tone: 'plum', synonyms: 'home neighbour maison voisin flat apartment logement' },
  { key: 'health', title: 'Health & pharmacy', theme: 'health-and-pharmacy', motif: 'recovery', tone: 'teal', synonyms: 'health pharmacy santé pharmacie doctor médecin ordonnance' },
  { key: 'admin', title: 'Appointments & paperwork', theme: 'admin-and-paperwork', motif: 'journal', tone: 'rose', synonyms: 'admin paperwork appointment administration banque bank hotel hôtel poste rendez-vous formulaire' },
  { key: 'out', title: 'Going out', theme: 'going-out', motif: 'plans', tone: 'ochre', synonyms: 'going out sortir sortie cinéma cinema restaurant bar booking réservation' },
  { key: 'culture', title: 'Culture & days off', theme: 'culture-and-days-off', motif: 'journal', tone: 'teal', synonyms: 'culture holiday museum musée sport weekend vacances day off loisir' },
] as const;
export type ExploreTopic = typeof EXPLORE_TOPICS[number]['key'];
const WORDS: Record<ExploreTopic, RegExp> = {
  food: /café|cafe|food|drink|order|menu|restaurant|coffee|tea|bread|meal|eat|manger|cuisine|boire/i,
  friends: /friend|ami|famille|family|plan|weekend|week-end|party|invitation|soir|journee|journée|hobby/i,
  travel: /travel|train|ticket|direction|street|rue|airport|station|voyage|chemin|route|gare|bus|métro/i,
  work: /work|study|meeting|colleague|travail|réunion|reunion|bureau|école|school|étud|etud|apprendr|learn/i,
  shops: /shop|market|marche|marché|magasin|buy|acheter|courses|price|prix|receipt|reçu|recu/i,
  home: /home|neighbour|neighbor|maison|voisin|flat|apartment|logement|rent|loyer/i,
  health: /health|pharmacy|santé|sante|pharmacie|doctor|médecin|medecin|ordonnance|malade/i,
  admin: /admin|paperwork|appointment|rendez-vous|form|formulaire|bank|banque|hotel|hôtel|poste/i,
  out: /going out|sortir|sortie|cinéma|cinema|restaurant|bar|reservation|réservation|concert/i,
  culture: /culture|holiday|museum|musée|musee|sport|weekend|vacances|loisir|book|livre|film/i,
};
const MISSION_TOPICS: Record<string, ExploreTopic> = {
  'mission:premier-cafe': 'food', 'mission:cafe': 'food', 'mission:hotel': 'admin',
  'mission:marche': 'shops', 'mission:chemin': 'travel', 'mission:journee': 'home', 'mission:amis': 'friends',
  'mission:restaurant': 'out', 'mission:pharmacie': 'health', 'mission:gare': 'travel',
  'mission:colis': 'shops', 'mission:voisin': 'home',
  'mission:week-end': 'friends', 'mission:collegues': 'work', 'mission:telephone': 'admin',
  'mission:medecin': 'health', 'mission:retour': 'shops', 'mission:appartement': 'home', 'mission:belle-famille': 'friends',
  'mission:club': 'culture', 'mission:banque': 'admin', 'mission:sortie': 'out',
  'mission:montreal': 'shops', 'mission:coup-de-main': 'work', 'mission:anniversaire': 'friends',
  'mission:fuite': 'home', 'mission:galere': 'friends', 'mission:avis': 'culture',
  'mission:entretien': 'work', 'mission:teletravail': 'work', 'mission:souvenirs': 'friends',
};
export const searchKey = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
export function isExploreTopic(value: unknown): value is ExploreTopic { return EXPLORE_TOPICS.some(t => t.key === value); }
export function topicOf(key: ExploreTopic) { return EXPLORE_TOPICS.find(t => t.key === key)!; }
export function scenarioTopic(scenario: DailyScenario) { return EXPLORE_TOPICS.find(t => t.theme === scenario.theme)!; }
/** A guided mission's topic, from the same map the search filters by (B1, 2026-10-20). */
export function missionTopic(mission: Pick<Mission, 'id'>) { const key = MISSION_TOPICS[mission.id]; return key ? topicOf(key) : undefined; }

/** Ability orders the complete catalogue; it never hides content or awards a level. */
export function orderByPitch<T extends { tier?: 1 | 2 | 3 }>(items: readonly T[], preferredTier?: 1 | 2 | 3): T[] {
  return preferredTier ? [...items].sort((a, b) => Number(b.tier === preferredTier) - Number(a.tier === preferredTier)) : [...items];
}
export function orderScenarios(items: readonly DailyScenario[], preferredTier?: 1 | 2 | 3): DailyScenario[] {
  const samples = new Set(freeExploreScenarioIds());
  return [...items].sort((a, b) => (preferredTier ? Number(b.tier === preferredTier) - Number(a.tier === preferredTier) : 0)
    || Number(samples.has(b.id)) - Number(samples.has(a.id)));
}
export function exploreScenarios(query: string, topic: ExploreTopic | null, preferredTier?: 1 | 2 | 3): readonly DailyScenario[] {
  const q = searchKey(query.trim());
  const matches = DAILY_SCENARIOS.filter(scenario => {
    const metadata = scenarioTopic(scenario);
    return (!topic || scenario.theme === topicOf(topic).theme) && (!q || searchKey([
      scenario.titleFr, scenario.titleEn, scenario.bodyEn, scenario.openingFr, scenario.openingEn,
      scenario.id.replace(/^situation:/, '').replace(/-/g, ' '),
      ...scenario.lines.flatMap(line => [line.fr, line.en]), metadata.title, metadata.synonyms,
    ].join(' ')).includes(q));
  });
  return orderScenarios(matches, preferredTier);
}
export function exploreMissions(query: string, topic: ExploreTopic | null): readonly Mission[] {
  const q = searchKey(query.trim());
  return MISSIONS.filter(m => {
    const text = `${m.title} ${m.titleEn} ${m.place} ${m.goalEn}`;
    return (!topic || MISSION_TOPICS[m.id] === topic) && (!q || searchKey(text).includes(q));
  });
}
export function explorePhrases(query: string, topic: ExploreTopic | null, preferredTier?: 1 | 2 | 3): readonly DailyItem[] {
  const q = searchKey(query.trim());
  const matches = DAILY_ITEMS.filter(item => {
    const text = `${item.fr} ${item.en} ${item.note}`;
    return (!topic || WORDS[topic].test(text)) && (!q || searchKey(text).includes(q));
  });
  return orderByPitch(matches, preferredTier);
}

/** A short search can separately become a tutor topic without losing the search. */
export function exploreTopicSeed(query: string, topic: ExploreTopic | null): SeedTopic | null {
  const text = query.trim();
  // F929: the learner's own words are the title; the instruction is the brief.
  if (text) return text.length <= 90 ? { fr: 'Une conversation à ta façon', en: text, brief: `Talk with me in French about: ${text}` } : null;
  if (!topic) return null;
  const topics: Record<ExploreTopic, SeedTopic> = {
    food: { fr: 'À table', en: 'Food and meals', brief: 'Talk with me in French about food, cafés or a meal I enjoyed.' },
    friends: { fr: 'Entre amis', en: 'With friends', brief: 'Talk with me in French about friends, making plans or a story I want to share.' },
    travel: { fr: 'En voyage', en: 'Travelling', brief: 'Talk with me in French about travelling, getting around or a trip I am planning.' },
    work: { fr: 'Au travail', en: 'At work', brief: 'Talk with me in French about my work, studies or an upcoming conversation.' },
    shops: { fr: 'Au marché', en: 'At the market', brief: 'Help me shop in French, compare choices or explain what I am looking for.' },
    home: { fr: 'Chez moi', en: 'At home', brief: 'Talk with me in French about home, my neighbours or something that needs sorting out.' },
    health: { fr: 'À la pharmacie', en: 'At the pharmacy', brief: 'Rehearse a French conversation at a pharmacy, asking clearly for what I need.' },
    admin: { fr: 'Un rendez-vous', en: 'An appointment', brief: 'Rehearse a French appointment or a conversation about paperwork.' },
    out: { fr: 'Une sortie', en: 'A night out', brief: 'Help me plan an evening out in French and discuss what I would enjoy.' },
    culture: { fr: 'Un jour de repos', en: 'A day off', brief: 'Talk with me in French about a day off, a book, a film or something I enjoy.' },
  };
  return topics[topic];
}

/**
 * The topics a piece of text names, from the same words the phrase filter
 * reads (B3, 2026-10-20), so Practice's chips and Explore's topics are one map.
 */
export function topicsOfText(text: string): ExploreTopic[] {
  return EXPLORE_TOPICS.filter(t => WORDS[t.key].test(text)).map(t => t.key);
}
