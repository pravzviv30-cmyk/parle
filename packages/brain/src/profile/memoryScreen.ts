/**
 * Deterministic screen for tutor-noted memory (LEARN-008).
 *
 * The prompt rule in `prompt/memoryPolicy.ts` asks the extraction to leave out
 * personal health details, finances, sexuality or intimate relationships,
 * political or religious beliefs, and identifying secrets. This is the code
 * check behind that rule: a keyword and pattern screen over French and English,
 * run on what the extraction returns before anything is stored.
 *
 * Conservative on purpose: a false positive costs one forgotten sentence, a
 * false negative stores something the learner never agreed to. It is a word
 * list, not a classifier, so paraphrase ("is not well lately") gets through;
 * the prompt rule stays the first line of defence. Pure, and it never logs.
 */

export type SensitiveMemoryCategory = 'health' | 'finances' | 'intimate' | 'beliefs' | 'secret';

/** Lowercase, accents stripped, apostrophes to spaces (l'hôpital -> l hopital).
 * Other punctuation is kept so emails, phone numbers and IBANs stay visible. */
function screenText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Whole words or phrases; each alternative is a regex fragment over screened text. */
function words(...alternatives: string[]): RegExp {
  return new RegExp(`(?<![a-z0-9])(?:${alternatives.join('|')})(?![a-z0-9])`);
}

const SEP = '[\\s-]+';

const HEALTH = words(
  'maladies?', 'malades?', 'illness(?:es)?', 'sick(?:ness)?', 'diagnos\\w*', 'cancers?', 'tumou?rs?', 'tumeurs?',
  'chemo\\w*', 'chimio\\w*', 'diabet\\w*', 'depress\\w*', 'anxiety', 'anxious', 'anxiete', 'anxieu\\w*',
  'panic attacks?', 'crises? d angoisse', 'angoisses?', 'medications?', 'medicaments?', 'traitements? medica\\w*',
  'treatment for', 'therap\\w*', 'psy', 'psychiatr\\w*', 'psycholog\\w*', 'pregnan\\w*', 'enceinte', 'grossesses?',
  'hospital\\w*', 'hopita(?:l|ux)', 'surger(?:y|ies)', 'chirurg\\w*', 'operations? chirurgicales?',
  'disabilit\\w*', 'disabled', 'handicap\\w*', 'hiv', 'vih', 'sida', 'seropositi\\w*',
  `mental${SEP}health`, `sante${SEP}mentale`, `(?:doctors?|gp|dentists?)${SEP}appointments?`,
  `rendez${SEP}vous (?:chez|avec) (?:le|la|un|une|mon|ma) (?:medecin|docteur|dentiste|gyneco\\w*|psy\\w*)`,
  'medecin traitant', 'allerg\\w*', 'autis\\w*', 'adhd', 'tdah', 'asthm\\w*', 'alzheimer\\w*', 'epilep\\w*',
  'migraines?', 'insomni\\w*', `burn(?:${SEP})?out`, 'rehab', 'addict\\w*', 'alcoholi\\w*', 'alcooli\\w*',
  'abortions?', 'avortement\\w*', 'ivg', 'fausses? couches?', 'miscarr\\w*', 'bipola\\w*', 'schizo\\w*',
  'antidepress\\w*', 'suicid\\w*', 'drogues?', 'drugs', 'drug (?:use|user|users|addict\\w*|habit)', 'cocaine',
  'heroin\\w*', 'cannabis', 'covid\\w*',
  // "règles" is also "rules" (les règles du jeu): only a possessive, not followed by du/de.
  '(?:mes|tes|ses|leurs) regles(?! d)',
);

const FINANCES = words(
  'debts?', 'indebted', 'dettes?', 'endett\\w*', 'salar(?:y|ies)', 'salaires?', 'loans?',
  'prets? (?:bancaires?|immobiliers?|etudiants?|a la consommation)', 'credits? (?:immobiliers?|a la consommation)',
  'mortgag\\w*', 'bankrupt\\w*', 'faillites?', 'overdra\\w*', 'decouverts? bancaires?', 'decouvert a la banque',
  'un decouvert', 'en decouvert', 'incomes?',
  // "revenu" is also the participle of revenir ("est revenu de Lyon"), so it
  // counts as income only after a determiner or before a money qualifier.
  '(?:mon|ma|mes|ton|tes|son|ses|notre|nos|votre|vos|leur|leurs|un|le|les|des|du|de|aux|a faibles?|petits?|gros|bons?) revenus?',
  'revenus? (?:mensuels?|annuels?|fixes?|net|nets|brut|bruts|modestes?|faibles?|eleves?|bas|minimum|universel|de solidarite)', `bank${SEP}accounts?`, 'comptes? bancaires?',
  'comptes? en banque', 'unemploy\\w*', 'chomage', 'chomeu\\w*', 'savings', 'epargne',
  'fauches?', '(?:is|am|are|was|were|be|being|been|so|flat|totally|completely) broke(?! up)',
  'no money', '(?:pas|plus|peu|sans) d argent',
);

const PARTNER = '(?:girlfriend|boyfriend|wife|husband|partner|fiance\\w*|copine|copain|femme|mari|conjointe?|compagne|compagnon|petite? amie?)';

const INTIMATE = words(
  'homos?', `${PARTNER} (?:just )?(?:left|dumped|cheated on) (?:him|her|me|them)`,
  `${PARTNER} (?:l|m|t) a (?:quitte\\w*|largue\\w*|trompe\\w*)`,
  'sex', 'sexe', 'sexual\\w*', 'sexuel\\w*', 'gays?', 'lesbians?', 'lesbiennes?', 'bisexu\\w*', 'queer', 'lgbt\\w*',
  'transgend\\w*', 'transgenres?', 'homosexu\\w*', 'dating', 'sites? de rencontres?', 'rencontres? amoureuses?',
  'tinder', 'bumble', 'grindr', 'divorc\\w*', `break(?:${SEP})?ups?`, 'broke up', 'ruptures?', 'affair',
  'liaisons? (?:amoureuses?|avec)', 'infidel\\w*', 'cheat(?:ed|ing|s)? on', 'intimate', 'intimes?', 'intimit\\w*',
);

const BELIEFS = words(
  'politic\\w*', 'politiques?', 'elections?', 'electora\\w*',
  'vot(?:e|es|ed|ing|er|ers|ent|ait|ais|ons|ez)', `(?:left|right)${SEP}wing`, 'de gauche', 'de droite',
  'extreme (?:gauche|droite)', 'far (?:left|right)', 'democrats?', 'republicans?', 'religio\\w*', 'religieu\\w*',
  'church(?:es)?', 'eglises?', 'mosques?', 'mosquees?', 'synagogues?', 'temples?', 'pray(?:s|ed|ing|ers?)?',
  'prieres?', 'prier', 'gods?', 'dieux?', 'muslims?', 'musulman\\w*', 'islam\\w*', 'christian\\w*', 'chretien\\w*',
  'catholi\\w*', 'protestant\\w*', 'jewish', 'jews?', 'juifs?', 'juives?', 'judaism\\w*', 'buddhis\\w*',
  'bouddhis\\w*', 'hindu\\w*', 'hindou\\w*', 'atheis\\w*', 'athees?', 'ramadan', 'bible', 'coran', 'quran', 'koran',
  'torah', 'messe', 'sikh\\w*',
  // Parties and politicians. "rn" and "lfi" only as whole words; trump not trumpet.
  'le pen', 'macron\\w*', 'melenchon\\w*', 'zemmour', 'rn', 'lfi', 'trump(?:s|ist|ists|isme)?', 'biden',
  'harris', 'labour', 'tor(?:y|ies)', 'croyante?s?', 'believers?', 'faith', 'pratiquante?s?',
);

const SECRET_WORDS = words(
  'passwords?', 'mots? de passe', 'passcodes?', 'pin', 'iban', `account${SEP}numbers?`, 'numeros? de compte',
  `card${SEP}numbers?`, 'numeros? de carte', 'social security', 'securite sociale', 'ssn',
  'passport number', 'numero de passeport', 'codes? de (?:la )?carte', `card${SEP}codes?`,
  // Identifying legal status.
  `sans${SEP}papiers?`, 'undocumented', 'criminal records?', 'casiers? judiciaires?', 'prisons?', 'jail\\w*',
  `garde${SEP}a${SEP}vue`,
);
/** Six or more digits, a single space, dot or dash allowed between them: phones, card and account numbers.
 * Years ("2027"), times ("10:30") and small counts stay clear. */
const LONG_NUMBER = /(?<!\d)\d(?:[\s.-]?\d){5,}(?!\d)/;
/** A money amount: digits then k, a currency word or sign, or a sign then digits. "5 km" stays clear. */
const MONEY = /(?<![a-z0-9])\d+(?:[.,\s]\d+)*\s?(?:k|eur|euros?|dollars?|livres?|pounds?)(?![a-z0-9])|\d\s?[€$£]|[€$£]\s?\d/;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/;
const STREET = '(?:rue|avenue|av|boulevard|bd|blvd|street|st|road|rd|chemin|allee|place|impasse|quai|lane|drive|cours)';
/** A house number, then a street word, directly ("12 rue") or after a name ("221b baker street"). */
const ADDRESS = new RegExp(`(?<![a-z0-9])\\d{1,4}[a-z]?(?:\\s*(?:bis|ter))?,?\\s+(?:[a-z]+\\s+){0,3}${STREET}(?![a-z0-9])`);

const SCREENS: ReadonlyArray<[SensitiveMemoryCategory, readonly RegExp[]]> = [
  ['health', [HEALTH]],
  ['finances', [FINANCES, MONEY]],
  ['intimate', [INTIMATE]],
  ['beliefs', [BELIEFS]],
  ['secret', [SECRET_WORDS, LONG_NUMBER, EMAIL, ADDRESS]],
];

/** The first sensitive category the text touches, or null when it reads as clean. */
export function sensitiveMemoryCategory(text: string | null): SensitiveMemoryCategory | null {
  if (text === null || text.length === 0) return null;
  const screened = screenText(text);
  for (const [category, patterns] of SCREENS) {
    if (patterns.some((pattern) => pattern.test(screened))) return category;
  }
  return null;
}
