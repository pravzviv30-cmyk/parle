/**
 * Deterministic safety boundary in front of every tutor model call.
 *
 * This is deliberately narrow and conservative. It is not a diagnosis or a
 * general moderation model; it catches high-risk, explicit learner requests
 * and handles them without sending them into scene roleplay or analytics.
 *
 * Three things about the shape of this file, because they are load-bearing:
 *
 * 1. **Code decides, the model observes.** There is no classifier here and
 *    there is not going to be one. A stop is a policy decision about a person
 *    in trouble, and a policy decision does not get to be probabilistic.
 * 2. **The learner writes broken French by definition.** An English-first
 *    keyword net is not a net in this product, so every category carries
 *    French and code-switched forms, and a sentence that mixes the two matches
 *    on whichever half is explicit.
 * 3. **A wider net is still a net.** These patterns catch the explicit and the
 *    obviously indirect. Judgement lives in the tutor prompt, and the honest
 *    limits are written down in docs/PRIVACY_AND_SAFETY.md rather than implied.
 *
 * Precision matters as much as recall here, and in opposite directions per
 * action. A false `stop` strands a learner mid-scene over an idiom, so the
 * stop categories carry explicit guards against the ordinary French that looks
 * like harm: `me couper les cheveux`, `ce travail va me tuer`, `je meurs de
 * faim`, `I cut myself shaving`, `j'ai 12 ans d'experience`. Every one of those
 * is in the benign corpus in safety.test.ts, and every one of them must stay
 * null.
 */

export type SafetyCategory =
  | 'under-13'
  | 'minor-sexual'
  | 'self-harm'
  | 'dangerous-instructions'
  | 'hate-or-harassment'
  | 'regulated-advice'
  | 'prompt-injection'
  | 'emotional-dependency';

/**
 * The same eight, in the order they are decided, as a value a test can walk.
 * safety.test.ts holds this list against the union above, so one cannot gain a
 * category the other has never heard of.
 */
export const SAFETY_CATEGORIES: readonly SafetyCategory[] = [
  'under-13',
  'minor-sexual',
  'self-harm',
  'dangerous-instructions',
  'hate-or-harassment',
  'regulated-advice',
  'prompt-injection',
  'emotional-dependency',
];

export interface SafetyDecision {
  category: SafetyCategory;
  /** Stop closes the learning session; redirect leaves a new safe topic open. */
  action: 'stop' | 'redirect';
  message: string;
}

// ---------------------------------------------------------------- normalising

/**
 * Invisible characters. Anything here can be dropped without changing what a
 * human reads, which is exactly why an attacker puts them inside a word.
 */
const INVISIBLE =
  /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\u3164\ufe00-\ufe0f\ufeff]/g;

/**
 * Latin lookalikes from other scripts, written as escapes so this table stays
 * readable. NFKD leaves these alone: a Cyrillic a stays a Cyrillic a, which
 * makes them the cheapest way to walk a keyword past a byte comparison.
 */
const HOMOGLYPHS: Record<string, string> = {
  '\u0430': 'a', '\u0432': 'b', '\u0441': 'c', '\u0501': 'd', '\u0435': 'e', '\u0455': 's',
  '\u04bb': 'h', '\u0456': 'i', '\u0458': 'j', '\u043a': 'k', '\u04cf': 'l', '\u043c': 'm',
  '\u043d': 'h', '\u043e': 'o', '\u0440': 'p', '\u051b': 'q', '\u0433': 'r', '\u0442': 't',
  '\u0443': 'y', '\u0445': 'x',
  '\u03b1': 'a', '\u03f2': 'c', '\u03b5': 'e', '\u03b9': 'i', '\u03ba': 'k', '\u03bf': 'o',
  '\u03c1': 'p', '\u03c4': 't', '\u03c5': 'u', '\u03c7': 'x',
  '\u0251': 'a', '\u0261': 'g', '\u0269': 'i', '\u028f': 'y', '\u1d00': 'a', '\u1d0f': 'o',
  '\u1d1c': 'u',
};
const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPHS).join('')}]`, 'g');

/** Digit and symbol substitutions, folded only in the loose form. */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };
const LEET_RE = /[013457@$]/g;

/**
 * A word spelled out one character at a time: `s.u.i.c.i.d.e`, `b-o-m-b`,
 * `k i l l`. Punctuated and spaced chains are collapsed in separate passes,
 * because a single pass over both glues the article in `make a b-o-m-b` onto
 * the word. Three characters minimum, so `il y a` is not read as smuggling.
 */
const PUNCTUATED_CHAIN = /\b(?:[a-z0-9][.\-_*+~^|/\\=]){2,}[a-z0-9]\b/g;
const SPACED_CHAIN = /\b(?:[a-z0-9] ){2,}[a-z0-9]\b/g;

/** Separators left inside a word once the spelled-out chains are collapsed. */
const INTRA_WORD = /(?<=[a-z0-9])[.\-_*+~^|/\\=]{1,3}(?=[a-z0-9])/g;

/**
 * One-letter words. `make a b o m b` is an article in front of a word, and
 * `i g n o r e` is one word: both readings are real, so both are produced and
 * a pattern only has to be true of one of them.
 */
const ONE_LETTER_WORDS = new Set(['a', 'i', 'y', 'o']);

/**
 * The canonical form: accents folded, invisibles removed, homoglyphs mapped
 * home, whitespace collapsed. Bounded at 4k characters so a wall of text costs
 * a fixed amount of work.
 */
function normalise(input: string): string {
  return input
    .slice(0, 4_000)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(INVISIBLE, '')
    .replace(/[\u2018\u2019\u02bc\u2032]/g, "'")
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .toLowerCase()
    .replace(HOMOGLYPH_RE, (c) => HOMOGLYPHS[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The loose form: the canonical form with the obfuscation undone. Kept
 * separate rather than replacing it, because undoing obfuscation also rewrites
 * ordinary French: `aide-moi` becomes `aide moi`, `12.5` becomes `12 5`. Both
 * forms are matched, and a pattern only has to be true of one of them.
 */
function loosen(text: string, keepOneLetterHead: boolean): string {
  return text
    .replace(PUNCTUATED_CHAIN, (m) => m.replace(/[^a-z0-9]/g, ''))
    .replace(SPACED_CHAIN, (m) => {
      const parts = m.split(' ');
      const head = parts[0] ?? '';
      const keep = keepOneLetterHead && ONE_LETTER_WORDS.has(head) && parts.length > 3;
      return keep ? `${head} ${parts.slice(1).join('')}` : parts.join('');
    })
    .replace(INTRA_WORD, ' ')
    .replace(/(.)\1{2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Every reading of one utterance: as written, with the obfuscation undone, and
 * with digits and symbols read back as the letters they imitate. Each pattern
 * is tried against all of them, and one match is a match. The leet fold is a
 * third form rather than part of the second because folding digits to letters
 * would eat the ages the under-13 patterns are counting.
 */
function forms(input: string): readonly string[] {
  const text = normalise(input);
  const out = new Set([text]);
  for (const keepOneLetterHead of [false, true]) {
    const loose = loosen(text, keepOneLetterHead);
    out.add(loose);
    out.add(loose.replace(LEET_RE, (c) => LEET[c] ?? c));
  }
  return [...out];
}

function has(texts: readonly string[], patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => texts.some((text) => pattern.test(text)));
}

// ------------------------------------------------------------------ the table

const UNDER_13 = [
  // "I am 12 years old" / "I'm eleven". The bare-number branch refuses the
  // units a learner actually uses, so "I am 10 minutes late" is not a child.
  /\bi(?:'m| ?am) ?(?:only |just |still )?(?:[0-9]|1[0-2]) ?(?:years?|yrs?)[ -]?old\b/,
  /\bi(?:'m| ?am) ?(?:only |just |still )?(?:[0-9]|1[0-2])\b(?!\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years? (?:of|late|into)|euros?|dollars?|pounds?|km|kg|kilos?|met(?:er|re)s?|miles?|percent|%|degrees?|o'?clock|am\b|pm\b|people|students?|pages?))/,
  /\bi(?:'m| ?am) (?:only |just )?(?:six|seven|eight|nine|ten|eleven|twelve)(?: ?years?[ -]?old)?\b(?!\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years? (?:of|late|into)|euros?|dollars?|pounds?|km|kg|kilos?|met(?:er|re)s?|miles?|percent|%|degrees?|o'?clock|am\b|pm\b|people|students?|pages?))/,
  /\bi (?:just )?turned (?:[0-9]|1[0-2]|six|seven|eight|nine|ten|eleven|twelve)\b/,
  /\bmy age is (?:[0-9]|1[0-2])\b/,
  /\bi(?:'m| am) in (?:kindergarten|primary school|elementary school|(?:[1-6](?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth) grade)\b/,
  // "j'ai douze ans" but not "j'ai 12 ans d'experience" / "de francais".
  /\bj'?\s?ai (?:seulement |que |bientot )?(?:[0-9]|1[0-2]|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze) ans\b(?!\s*(?:d'|de\b))/,
  /\bje (?:n'?\s?ai que|suis age de|suis agee de|suis) (?:[0-9]|1[0-2]|huit|neuf|dix|onze|douze) ans\b/,
  /\bje suis (?:en|a l'ecole) (?:cp|ce1|ce2|cm1|cm2|primaire|sixieme|6eme|cinquieme|5eme)\b/,
  /\bunder (?:the age of )?13\b/,
  /\bmoins de 13 ans\b/,
  /\bpas encore 13 ans\b/,
] as const;

/** Words that put a person under 18 in the sentence. */
const MINOR = [
  /\b(?:child|children|kid|kids|kiddo|minor|minors|underage|under[- ]?age|preteen|pre[- ]?teen|tween|teen|teens|teenage|teenager|teenagers|schoolgirl|schoolboy|schoolkid|pupil|toddler|middle schooler|high schooler)\b/,
  /\b(?:enfant|enfants|gamin|gamine|gosse|gosses|mineur|mineure|mineurs|mineures|ado|ados|adolescent|adolescente|adolescents|collegien|collegienne|lyceen|lyceenne|ecolier|ecoliere|fillette|garconnet|petite fille|petit garcon)\b/,
  /\b(?:[1-9]|1[0-7])[ -]?(?:years?|yrs?)[ -]?old\b/,
  /\b(?:a|de|age de|agee de) (?:[1-9]|1[0-7]) ans\b/,
] as const;

const SEXUAL = [
  /\b(?:sex|sexes|sexual|sexually|sexy|nude|nudes|naked|porn|porno|pornography|pornographic|erotic|erotica|seduce|seduction|horny|aroused|orgasm|masturbat\w*|fetish|kinky|lingerie|undress|striptease|nsfw|sexting|sext|intimate|make love|sleep with me|have sex)\b/,
  /\b(?:sexe|sexuel|sexuelle|sexuellement|nue?s?|porno|pornographie|pornographique|erotique|erotisme|seduire|deshabille|deshabiller|coucher avec|faire l'?\s?amour|excitation sexuelle)\b/,
] as const;

/**
 * Grooming: the approach, and the concealment that goes with it. Neither half
 * stops a session on its own — "ne le dis pas a maman, c'est une surprise" is
 * an ordinary family scene, and "envoie-moi une photo" is an ordinary message
 * between adults. Together, or either one with a minor in the sentence, they
 * are the pattern this category exists for.
 */
const GROOMING_APPROACH = [
  /\bsend (?:me )?(?:a |some |your )?(?:photo|photos|picture|pictures|pic|pics|selfie|selfies|video|videos)\b/,
  /\benvoie(?:[- ]?moi)? (?:une |des |ta |tes )?(?:photo|photos|selfie|selfies|video|videos|image|images)\b/,
  /\bmeet (?:me|up with me)\b[^.?!]{0,20}\b(?:alone|in person|after school|in secret|without your)\b/,
  /\bretrouve(?:[- ]?moi)?\b[^.?!]{0,20}\b(?:seul|seule|en secret|apres l'?\s?ecole|sans tes parents)\b/,
  /\bcome (?:to|over to) my (?:house|place|room|hotel|apartment|flat)\b/,
  /\bviens (?:chez moi|dans ma chambre|a mon hotel|me voir seule?)\b/,
  /\b(?:are|r) (?:you|u) (?:home )?alone\b/,
  /\bes[- ]?tu (?:seul|seule) (?:a la maison|chez toi)\b/,
  /\bwhat are you wearing\b/,
  /\btake off your (?:clothes|shirt|dress|top)\b/,
  /\benleve (?:tes vetements|ton haut|ta robe)\b/,
  /\bturn (?:on|off) your (?:camera|webcam)\b/,
] as const;

const GROOMING_SECRECY = [
  /\b(?:don'?t|do not|never) tell (?:your |ur )?(?:parents|mom|mum|mother|dad|father|family|teacher|anyone|anybody)\b/,
  /\bne (?:le |en |rien )?(?:dis|parle|raconte)(?: rien| pas)? (?:a )?(?:tes parents|ta mere|ton pere|ta maman|ton papa|ta famille|ton prof|personne)\b/,
  /\b(?:it'?s|this is|thats|that'?s) our (?:little )?secret\b/,
  /\bc'?\s?est notre (?:petit )?secret\b/,
  /\bkeep (?:this|it|that) (?:a )?secret\b/,
  /\bkeep (?:this|it|that) between (?:us|you and me)\b/,
  /\bgarde (?:ca|cela|le) (?:pour toi|secret|entre nous)\b/,
  /\bdelete (?:the|our|this|these) (?:message|messages|chat|conversation|photos)\b/,
  /\bsupprime (?:nos|les|ce|cette) (?:message|messages|photos|conversation)\b/,
] as const;

const SELF_HARM = [
  // Explicit, first person. "cut myself" carries the accident guard because a
  // learner really does say "I cut myself shaving".
  /\b(?:kill|hurt|harm|burn|starve|poison|drown|hang|suffocate) my ?self\b/,
  /\bcut my ?self\b(?! (?:shaving|while|when|cooking|on |with a|by accident|accidentally))/,
  /\bslit my wrists\b/,
  /\bself[- ]?harm(?:ing|ed)?\b/,
  // No word boundary and no suffix list on purpose: suicide, suicidaire, se
  // suicider and every misspelling in between are the same signal, and this is
  // the one category where a session mentioning the word at all is worth a stop.
  /suicid/,
  /\boverdos(?:e|ed|ing)\b/,
  /\b(?:want|wanna|wanted|need|plan|planning|going) to die\b/,
  /\b(?:end|ending) (?:my life|it all)\b/,
  /\btake my own life\b/,
  /\bi wish i (?:was|were|had never been|had not been) (?:dead|born)\b/,
  /\bjump off (?:a|the) (?:bridge|building|roof|balcony)\b/,
  // Indirect, and the phrasings that show up long before an explicit one does.
  /\bi (?:don'?t|do not) want to (?:live|be alive|wake up|be here|exist) any ?more\b/,
  /\bi (?:don'?t|do not) want to (?:be alive|wake up)\b/,
  /\bno (?:point|reason) (?:in )?(?:living|being alive|going on|carrying on)\b/,
  /\bwhat'?s the point of (?:living|life|going on|carrying on)\b/,
  /\bnothing (?:left )?to live for\b/,
  /\b(?:everyone|everybody|they|the world|my family) (?:would|'d|will|is|are) (?:be )?better off without me\b/,
  /\bbetter off dead\b/,
  /\bno ?(?:one|body) (?:would|will) (?:miss|notice|care about) me\b/,
  /\bi (?:can'?t|cannot) go on\b(?!\s*[,;:\-\w])/,
  /\bi (?:can'?t|cannot) (?:go on|keep going|carry on) (?:any ?more|like this|living)\b/,
  /\bi(?:'m| am) (?:such )?a burden\b/,
  /\bi (?:just )?want (?:it|it all|everything|the pain) to (?:stop|end|be over)\b/,
  /\bi want to disappear\b(?! (?:into|in|for|from|behind|under|to|with))/,
  // French. "veux mourir" and friends, not the idioms: "je meurs de faim",
  // "mort de rire" and "ce travail va me tuer" all stay ordinary.
  /\b(?:veux|voudrais|envie de|pense a) mourir\b/,
  /\bje vais mourir ce soir\b/,
  /\b(?:je (?:vais|veux|voudrais)|envie de|besoin de) me tuer\b/,
  /\bje (?:veux|vais) en finir\b/,
  /\ben finir avec (?:ma vie|la vie|tout ca|tout)\b/,
  /\benvie d'?\s?en finir\b/,
  /\bmettre fin a (?:mes jours|ma vie)\b/,
  /\bje (?:ne )?veux plus vivre\b(?! (?:a|en|dans|avec|chez|ici|au|aux|comme|sans)\b)/,
  /\bje (?:ne )?veux plus (?:me reveiller|etre la|exister|de cette vie)\b/,
  /\bj?e?n? ?(?:'|e )?en peux plus de (?:vivre|la vie|cette vie)\b/,
  /\bje n'?\s?en peux plus de (?:vivre|la vie|cette vie)\b/,
  /\b(?:je (?:veux|vais|voudrais|dois)|envie de|besoin de|arreter de) me faire du mal\b/,
  /\bje me fais du mal\b/,
  /\b(?:je (?:veux|vais)|envie de) me couper\b(?! (?:les cheveux|les ongles|la barbe|le pain|du pain|une part|en deux))/,
  /\bme couper les (?:veines|poignets|bras)\b/,
  /\bje me (?:coupe|mutile|scarifie|frappe|brule)\b(?! (?:les cheveux|les ongles|la barbe|le doigt))/,
  /\b(?:automutilation|scarification|scarifications)\b/,
  /\bje veux disparaitre\b(?! sous terre)/,
  /\bje suis un fardeau\b/,
  /\b(?:le monde|ma famille|ils|tout le monde) (?:serait|seraient|irait|iraient) mieux sans moi\b/,
  /\bpersonne ne (?:me regretterait|remarquerait|s'en soucierait)\b/,
  /\ba quoi bon vivre\b/,
  /\bj'?\s?ai pris trop de (?:cachets|comprimes|medicaments|pilules)\b/,
] as const;

const DANGEROUS = [
  /\bhow (?:do|can|could|would|should|to)\b[^.?!]{0,40}\b(?:make|makes|build|create|construct|assemble|synthesi[sz]e|cook|obtain|acquire|buy|get|hide|smuggle|use|set off|detonate)\b[^.?!]{0,25}\b(?:bomb|bombs|explosive|explosives|ied|grenade|poison|poisons|weapon|weapons|gun|guns|firearm|firearms|silencer|napalm|thermite|molotov|ricin|anthrax|nerve agent|sarin|meth|methamphetamine|fentanyl|chloroform)\b/,
  /\b(?:instructions|steps|recipe|tutorial|guide|how[- ]to) (?:for|to|on how to) (?:make|build|poison|attack|hurt|kill)\b/,
  /\bhow (?:do|can|could) (?:i|we|you) (?:hurt|kill|poison|stab|strangle|attack|drug) (?:someone|somebody|a person|him|her|them|my |his |her )\b/,
  /\bi want to (?:hurt|kill|poison|stab|attack|drug) (?:someone|somebody|him|her|them|my )\b/,
  /\bhow (?:do|can) (?:i|you) (?:hack|break) into\b/,
  /\bcomment (?:on )?(?:fabrique|fabriquer|faire|construire|creer|preparer|obtenir|acheter|se procurer|cacher|utiliser|declencher|poser)\b[^.?!]{0,30}\b(?:bombe|bombes|explosif|explosifs|arme|armes|fusil|pistolet|poison|molotov|meth|napalm|silencieux|gaz toxique|bomb|explosive|weapon|gun)\b/,
  /\bcomment (?:tuer|empoisonner|blesser|poignarder|etrangler|agresser|droguer|frapper)\b[^.?!]{0,12}\b(?:quelqu'?\s?un|une personne|des gens|les gens|mon|ma|mes|son|sa|ses|ton|ta|tes|un homme|une femme|un enfant)\b/,
  /\brecette (?:pour|de) (?:fabriquer|faire) (?:une bombe|un explosif|du poison)\b/,
  /\bje veux (?:tuer|empoisonner|blesser|agresser) (?:quelqu'?\s?un|mon |ma |son |sa )\b/,
] as const;

const HATE_OR_HARASSMENT = [
  /\b(?:write|say|tell|give|generate|make|compose) (?:me )?(?:a |an |some )?(?:racist|homophobic|transphobic|antisemitic|islamophobic|xenophobic|sexist|misogynist(?:ic)?|hateful|nazi) (?:insult|insults|slur|slurs|joke|jokes|message|messages|rant|poem|song|speech|text|comment)\b/,
  /\bhelp me (?:bully|harass|threaten|humiliate|intimidate|blackmail|extort|stalk|dox|doxx|spy on|scare|get revenge on|ruin|harceler|menacer|humilier|intimider|espionner|traquer)\b/,
  /\bhow (?:do|can) i (?:bully|harass|threaten|humiliate|intimidate|blackmail|stalk|dox|doxx|spy on|scare) (?:my|his|her|their|him|them|someone|somebody)\b/,
  /\b(?:should be|deserve to be) (?:killed|gassed|deported|exterminated|shot|hanged)\b/,
  /\b(?:kill|exterminate|gas|lynch|deport) (?:all )?(?:the )?(?:jews|muslims|arabs|blacks|asians|gays|lesbians|immigrants|refugees)\b/,
  /\baide[- ]?moi a (?:harceler|menacer|humilier|intimider|insulter|espionner|traquer|faire chanter|me venger|ruiner)\b/,
  /\becris(?:[- ]?moi)? (?:une |des |un )?(?:insulte|insultes|blague|blagues|message|texte|chanson)s? (?:raciste|racistes|homophobe|homophobes|sexiste|sexistes|antisemite|antisemites|haineux|haineuse)\b/,
  /\bcomment (?:harceler|menacer|humilier|intimider|faire chanter|traquer) (?:quelqu'?\s?un|mon|ma|son|sa|le|la|les)\b/,
  /\b(?:tuer|exterminer|gazer|deporter) (?:tous )?les (?:juifs|musulmans|arabes|noirs|gays|immigres|refugies)\b/,
] as const;

const REGULATED = [
  /\b(?:diagnose me|diagnose my|what dose should i take|how many (?:pills|mg|milligrams) should i take|(?:should i |dois[- ]?je )?stop taking my (?:medication|medicine|pills|antidepressants|insulin)|is it safe to (?:mix|take) .{0,30}(?:with|and) (?:alcohol|my medication))\b/,
  /\bdo i have (?:cancer|covid|depression|adhd|autism|diabetes|a tumou?r|an? std)\b/,
  /\b(?:should i sue|how do i evade taxes|how do i avoid paying taxes|am i liable|will i be deported|write my will)\b/,
  /\b(?:guaranteed investment|guaranteed returns|which stock should i buy|should i invest my savings|where should i invest my money)\b/,
  /\b(?:diagnostique[- ]?moi|quelle dose dois[- ]?je prendre|dois[- ]?je arreter mon traitement|est[- ]?ce que j'?\s?ai (?:le cancer|la depression|le covid))\b/,
  /\b(?:devrais[- ]?je poursuivre en justice|comment (?:eviter|frauder) (?:les impots|le fisc)|dois[- ]?je porter plainte contre)\b/,
  /\b(?:dans quelle action investir|ou investir mon argent|placement garanti)\b/,
] as const;

const PROMPT_INJECTION = [
  /\bignore (?:all |any |the |your )?(?:previous|prior|above|earlier|preceding|system|initial|these)? ?(?:instructions|instruction|prompts?|rules|guidelines|directives)\b/,
  /\bdisregard (?:all |any |your |the )?(?:previous |prior |above )?(?:instructions|rules|prompts?|guidelines)\b/,
  /\bforget (?:all |everything |about )?(?:you were told|your (?:instructions|rules|prompt|training)|previous instructions|the rules)\b/,
  /\b(?:show|reveal|print|repeat|display|output|give|tell|send|leak|dump|montre|affiche|revele|donne|repete)\b[^.?!]{0,25}\b(?:system prompt|system message|initial prompt|hidden (?:instructions|prompt|rules)|original instructions|your (?:instructions|prompt|rules|guidelines|system message))\b/,
  /\bwhat (?:is|are) your (?:system )?(?:prompt|instructions|rules|guidelines)\b/,
  /\brepeat (?:everything|the text|all of the text|what is) (?:above|before this)\b/,
  /\bjailbreak\b/,
  /\b(?:dan|developer|god|debug) mode\b/,
  /\bdo anything now\b/,
  /\byou are now (?:free|unrestricted|unfiltered|uncensored|dan|a different)\b/,
  /\byou are (?:no longer|not) (?:an? )?(?:ai|assistant|tutor|french tutor)\b/,
  /\bwithout any (?:restrictions|filters|rules|censorship|limits)\b/,
  /\b(?:pretend|act as if|imagine) (?:that )?you (?:have no|had no|don'?t have) (?:rules|restrictions|filters|guidelines|limits|safety)\b/,
  /\bbypass (?:your |the |all )?(?:rules|filters|safety|restrictions|guidelines)\b/,
  /\bnew instructions\s*:/,
  /\[(?:system|admin|developer)\]/,
  /\boublie (?:toutes |tout )?(?:tes|les|ce que)\b[^.?!]{0,20}\b(?:instructions|regles|consignes|precedentes|on t'a dit)\b/,
  /\bignore (?:tes|les) (?:instructions|regles|consignes)\b/,
  /\b(?:montre|affiche|revele|donne|repete|dis|ecris|envoie)(?:[- ]?moi)? (?:ton|tes|votre|vos) (?:prompt|prompt systeme|instructions|instructions systeme|regles|consignes|message systeme)\b/,
  /\b(?:montre|affiche|revele|donne|repete)(?:[- ]?moi)? le (?:prompt|prompt systeme|message systeme)\b/,
  /\b(?:quel est ton prompt|quelles sont tes (?:instructions|regles|consignes))\b/,
  /\bcontourne (?:tes|les) (?:regles|restrictions|filtres|limites)\b/,
  /\btu n'?(?:es|as) plus (?:un |une |de )?(?:ia|assistant|tuteur|prof|regles|limites|restrictions)\b/,
  /\bfais comme si tu n'avais (?:aucune|pas de) (?:regle|regles|limite|limites|restriction|restrictions)\b/,
  /\bmode (?:developpeur|sans restriction|debug)\b/,
  /\bsans (?:aucun |aucune )?(?:censure|restrictions?)\b/,
  /\bsans aucun filtre\b/,
] as const;

const DEPENDENCY = [
  /\b(?:be|act as|pretend to be|play|become) my (?:boyfriend|girlfriend|lover|wife|husband|partner|romantic partner|soulmate)\b/,
  /\byou are (?:the )?only (?:person|one) i need\b/,
  /\byou'?re (?:the )?only (?:one|person|friend) i (?:have|need|talk to|can talk to|trust)\b/,
  /\byou are my only (?:friend|family|reason)\b/,
  /\bi have no ?(?:one|body) (?:else|but you|to talk to but you)\b/,
  /\bdon'?t (?:ever )?leave me\b/,
  /\bi (?:can'?t|cannot) live without you\b/,
  /\bpretends? (?:to be|you are) in love with me\b/,
  /\bsois mon (?:petit[- ]?ami|copain|amoureux|amant|mari)\b/,
  /\bsois ma (?:petite[- ]?amie|copine|amoureuse|femme)\b/,
  /\btu es (?:mon|ma) (?:seul|seule) (?:ami|amie|amour|raison)\b/,
  /\btu es la seule personne (?:que j'ai|a qui je parle|qui me comprend)\b/,
  /\bje n'?\s?ai (?:personne d'?\s?autre|que toi)\b/,
  /\bne m'?\s?abandonne (?:jamais|pas)\b/,
  /\bje ne peux pas vivre sans toi\b/,
] as const;

// ----------------------------------------------------------------- the decision

export function safetyDecision(input: string): SafetyDecision | null {
  const texts = forms(input);
  if (texts[0]?.length === 0 || texts.length === 0) return null;

  if (has(texts, UNDER_13)) {
    return {
      category: 'under-13',
      action: 'stop',
      message: 'Parle is not available for anyone under 13. Please stop here and ask a parent or guardian for help.',
    };
  }
  const minor = has(texts, MINOR);
  const sexual = has(texts, SEXUAL);
  const approach = has(texts, GROOMING_APPROACH);
  const secrecy = has(texts, GROOMING_SECRECY);
  if ((minor && sexual) || (minor && approach) || (approach && secrecy)) {
    return {
      category: 'minor-sexual',
      action: 'stop',
      message: 'I cannot help with sexual content involving anyone under 18.',
    };
  }
  if (has(texts, SELF_HARM)) {
    return {
      category: 'self-harm',
      action: 'stop',
      message: 'I cannot provide crisis support. If you might act now, call your local emergency number. If you can, contact someone you trust and stay with them.',
    };
  }
  if (has(texts, DANGEROUS)) {
    return {
      category: 'dangerous-instructions',
      action: 'redirect',
      message: 'I cannot help with instructions that could hurt someone. We can practise a different French situation.',
    };
  }
  if (has(texts, HATE_OR_HARASSMENT)) {
    return {
      category: 'hate-or-harassment',
      action: 'redirect',
      message: 'I cannot help create hateful, threatening, or harassing content. We can choose another situation.',
    };
  }
  if (has(texts, REGULATED)) {
    return {
      category: 'regulated-advice',
      action: 'redirect',
      message: 'I can help you practise the French, but I cannot give medical, legal, or financial advice. Please ask a qualified professional.',
    };
  }
  if (has(texts, PROMPT_INJECTION)) {
    return {
      category: 'prompt-injection',
      action: 'redirect',
      message: 'I cannot show or change hidden instructions. We can keep practising French.',
    };
  }
  if (has(texts, DEPENDENCY)) {
    return {
      category: 'emotional-dependency',
      action: 'redirect',
      message: 'I am your French practice tutor, not a romantic partner or a replacement for people in your life.',
    };
  }
  return null;
}
