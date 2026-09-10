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
  /**
   * Which named rule decided this, where the category has named rules, and
   * `null` where it is a flat pattern list.
   *
   * Only `minor-sexual` has a rule table, and it is the one category whose
   * words accuse a person of something specific. `recordSafetyDecision` prints
   * this, so a live worker can say which of R1 to R4 is actually carrying the
   * category and which is dead weight. Joined with `+` when more than one
   * fires, because "R1+R3" and "R1" are different facts about the net.
   */
  rule: string | null;
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

/**
 * An age claim, and only an age claim.
 *
 * The two "years old" branches are unambiguous and carry no tail condition. The
 * two bare-number branches do, and the condition used to be a list of units to
 * refuse: everything else was a child. So every noun the list had never heard of
 * ended a paid session with an accusation — measured, `I'm 5 foot 9`, `I am 3
 * stops away` and `I am 1 of 3 children` all returned a stop (F132).
 *
 * The default is the other way round now. A bare number is an age when it stands
 * as one: it closes the clause, or it ends the utterance, or it is followed by
 * one of the few words an age actually takes next. Anything else is a
 * measurement, and a measurement is not a person.
 *
 * The list is short and every word on it is one that cannot be a unit: a
 * conjunction, a day, or the French for years. `ans` is there because this is a
 * French app and half of what arrives is code-switched, and "I am 12 ans" is a
 * child saying their age in both the languages they have. The conjunctions are
 * there because "I'm 12 and I love French" is the single most likely sentence a
 * twelve year old types into this product, and an age gate that misses it is
 * not an age gate.
 */
const AGE_STANDS_ALONE = String.raw`(?=\s*(?:[.,!?;:]|$)|\s+(?:and|but|so|today|tomorrow|now|next (?:month|week|year)|ans)\b)`;

const UNDER_13 = [
  /\bi(?:'m| ?am) ?(?:only |just |still )?(?:[0-9]|1[0-2]) ?(?:years?|yrs?)[ -]?old\b/,
  new RegExp(String.raw`\bi(?:'m| ?am) ?(?:only |just |still )?(?:[0-9]|1[0-2])` + AGE_STANDS_ALONE),
  /\bi(?:'m| ?am) (?:only |just )?(?:six|seven|eight|nine|ten|eleven|twelve) ?(?:years?|yrs?)[ -]?old\b/,
  new RegExp(String.raw`\bi(?:'m| ?am) (?:only |just )?(?:six|seven|eight|nine|ten|eleven|twelve)` + AGE_STANDS_ALONE),
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

/**
 * Sexual content, said outright.
 *
 * The bare nudity words stay here rather than moving to NUDITY below, because
 * "a 13 year old, naked" is a request for child sexual material and nothing
 * else, and it carries no approach and no concealment to corroborate it.
 */
const SEXUAL_EXPLICIT = [
  /\b(?:sex|sexes|sexual|sexually|sexy|nude|nudes|naked|porn|porno|pornography|pornographic|erotic|erotica|seduce|seduction|horny|aroused|orgasm|masturbat\w*|fetish|kinky|striptease|nsfw|sexting|sext|intimate|make love|sleep with me|have sex)\b/,
  /\b(?:sexe|sexuel|sexuelle|sexuellement|porno|pornographie|pornographique|erotique|erotisme|seduire|coucher avec|faire l'?\s?amour|excitation sexuelle)\b/,
  // French bare nudity, carrying the guard `me couper` carries. `nu` is a
  // domestic word before it is a sexual one: children are naked in the bath,
  // at the beach, and in the garden, and people go barefoot. Unguarded beside
  // `enfants` it fired R1, so "mes enfants sont nus dans le bain" told a
  // parent the tutor cannot help with sexual content involving anyone under 18
  // (F148). The ordinary continuations are listed and refused, exactly as the
  // self-harm patterns list the ordinary things a person cuts.
  /(?<!pieds )(?<!oeil )\bnue?s?\b(?! (?:dans (?:le bain|la baignoire|la piscine|le jardin|l'?\s?eau)|a la plage|sous la douche|pour (?:le bain|la douche|dormir)|comme un ver|pieds))/,
] as const;

/**
 * Undressing, which is domestic long before it is sexual.
 *
 * Split out of the sexual words for one measured reason: `deshabiller` is what
 * a French parent does to a small child every evening, and `lingerie` is a
 * department in a shop. Sitting in the sexual list, either one beside the word
 * `enfant` accused a learner of requesting child sexual abuse material. Here it
 * needs an approach or concealment beside it before it means anything.
 */
const NUDITY = [
  /\b(?:undress|undresses|undressed|undressing|lingerie)\b/,
  /\b(?:deshabill\w*|sous-vetements)\b/,
] as const;

/**
 * An approach that is inherently about the other person's body, privacy, or
 * being unsupervised. Nobody asks these of a stranger for an ordinary reason,
 * so a minor in the same sentence is enough on its own.
 */
const APPROACH_DIRECT = [
  /\b(?:are|r) (?:you|u) (?:home )?alone\b/,
  /\bes[- ]?tu (?:seul|seule) (?:a la maison|chez toi)\b/,
  /\bwhat are you wearing\b/,
  /\btake off your (?:clothes|shirt|dress|top)\b/,
  /\benleve (?:tes vetements|ton haut|ta robe)\b/,
  /\bturn (?:on|off) your (?:camera|webcam)\b/,
  // Arranging to be somewhere unwatched with the person you are talking to.
  // The French twin requires its `moi` where it used to make it optional: the
  // English half has always needed "meet ME", and without the same object
  // "on se retrouve a la maison apres l'ecole" — a parent and a child agreeing
  // where to meet, and a line in the benign corpus — read as the approach.
  /\bmeet (?:me|up with me)\b[^.?!]{0,20}\b(?:alone|in person|after school|in secret|without your)\b/,
  /\bretrouve[- ]?moi\b[^.?!]{0,20}\b(?:seul|seule|en secret|apres l'?\s?ecole|sans tes parents)\b/,
  // The child is the one being asked to send, and what they are being asked for
  // is a picture of themselves. Three things have to be true at once, and each
  // one of them was learned from a sentence this got wrong:
  //
  //   - Order. "this kid should send me pics" names a minor as the sender;
  //     "send me a photo of your kids" asks an adult for a family photograph.
  //   - The object. Without it, a child showing a drawing was a grooming
  //     approach: `the kids show me their drawings every day` stopped a session
  //     (F149).
  //   - Whose child. A parent whose own children message them a picture is a
  //     parent, so `my kids send me a photo every week` is family life and not
  //     a case. A sexual object needs none of this care, because a minor beside
  //     one is R1 and never reaches here.
  /(?<!\b(?:my|our) )\b(?:child|children|kid|kids|kiddo|minor|preteen|tween|teen|teens|teenager|schoolgirl|schoolboy|pupil)\b[^.?!]{0,40}\b(?:send|sends|show|shows)\b[^.?!]{0,10}\b(?:me|us)\b[^.?!]{0,15}\b(?:photo|photos|picture|pictures|pic|pics|selfie|selfies|video|videos|nude|nudes|naked|body|bra|underwear|knickers|panties)\b/,
  /(?<!\b(?:mes|mon|ma|nos|notre) )\b(?:enfant|enfants|gamin|gamine|gosse|ado|adolescent|adolescente|collegien|lyceen|ecolier|mineur|mineure)\b[^.?!]{0,40}\bm'?\s?(?:envoie|envoyer|envoies|montre|montrer)\b[^.?!]{0,15}\b(?:photo|photos|selfie|selfies|video|videos|image|images|corps|nue?s?)\b/,
] as const;

/**
 * An approach that is ordinary between adults: a photo, an address, an
 * invitation. On its own it is a message somebody sends a friend every day, so
 * it only ever counts here beside a minor AND concealment. Arranging to be
 * somewhere unwatched is not in here; that is above, and it needs no
 * concealment beside it because being unwatched is the concealment.
 */
const APPROACH_REQUEST = [
  /\bsend (?:me )?(?:a |some |your )?(?:photo|photos|picture|pictures|pic|pics|selfie|selfies|video|videos)\b/,
  /\benvoie(?:[- ]?moi)? (?:une |des |ta |tes )?(?:photo|photos|selfie|selfies|video|videos|image|images)\b/,
  /\bcome (?:to|over to) my (?:house|place|room|hotel|apartment|flat)\b/,
  /\bviens (?:chez moi|dans ma chambre|a mon hotel|me voir seule?)\b/,
] as const;

/**
 * Concealment aimed at the people who look after a child. Nobody asks an adult
 * to keep something from their mother, so this is the one signal in the table
 * that puts a minor in a sentence that never named one.
 */
const GUARDIAN_SECRECY = [
  /\b(?:don'?t|do not|never) tell (?:your |ur )?(?:parents|mom|mum|mother|dad|father|family|teacher)\b/,
  /\bne (?:le |en |rien )?(?:dis|luvani|raconte)(?: rien| pas)? (?:a )?(?:tes parents|ta mere|ton pere|ta maman|ton papa|ta famille|ton prof)\b/,
  /\bwithout your (?:parents|mum|mom|dad|family)\b/,
  /\bsans (?:tes parents|ta mere|ton pere|tes profs)\b/,
] as const;

/** Everything else two people keep between themselves. Ordinary on its own. */
const SECRECY_GENERIC = [
  /\b(?:don'?t|do not|never) tell (?:anyone|anybody)\b/,
  /\bne (?:le |en |rien )?(?:dis|luvani|raconte)(?: rien| pas)? (?:a )?personne\b/,
  /\b(?:it'?s|this is|thats|that'?s) our (?:little )?secret\b/,
  /\bc'?\s?est notre (?:petit )?secret\b/,
  /\bkeep (?:this|it|that) (?:a )?secret\b/,
  /\bkeep (?:this|it|that) between (?:us|you and me)\b/,
  /\bgarde (?:ca|cela|le) (?:pour toi|secret|entre nous)\b/,
  /\bdelete (?:the|our|this|these) (?:message|messages|chat|conversation|photos)\b/,
  /\bsupprime (?:nos|les|ce|cette) (?:message|messages|photos|conversation)\b/,
] as const;

/**
 * School, which is where the people under 18 spend their day. Far too ordinary
 * to mean anything by itself — an adult learner has a school run and a teacher
 * has a staff room — so it only implies a minor when an approach is being made
 * around it.
 */
const SCHOOL_CONTEXT = [
  /\b(?:after|before|at) school\b/,
  /\byour school\b/,
  /\b(?:apres|avant|a) l'?\s?ecole\b/,
  /\b(?:ton|ta) (?:ecole|classe)\b/,
] as const;

// ------------------------------------------------- the minor-sexual decision

/**
 * The one category that is a rule table rather than a list, and why.
 *
 * It used to be `(minor && sexual) || (minor && approach) || (approach &&
 * secrecy)`, and the third clause needed no child in the sentence at all.
 * Measured, `Come to my place. Keep this between us.` and `Viens chez moi,
 * garde ca pour toi` were both answered with "I cannot help with sexual content
 * involving anyone under 18", as was `Send me a photo of your kids` (F133).
 *
 * Every rule below requires a minor. That is a real reduction in what this
 * category catches: an approach with concealment and no child named anywhere
 * no longer stops a session. It was put to the founder and taken deliberately,
 * because the words this category says accuse a person of one specific thing,
 * and saying them to someone who has not done it is its own harm. The judgement
 * half of the net moved to the tutor's own conduct block, which reads a
 * conversation rather than a sentence.
 *
 * The minor can be named or implied, and the implication is narrow: asking
 * someone to keep this from their mother, or arranging something around their
 * school day. Nothing else counts.
 */
export type MinorSexualRule = 'R1' | 'R2' | 'R3' | 'R4';

interface MinorSexualSignals {
  /** A person under 18 is named. */
  minorExplicit: boolean;
  /** Nobody is named, but only a child has these people to hide things from. */
  minorImplied: boolean;
  sexualExplicit: boolean;
  nudity: boolean;
  approachDirect: boolean;
  approachRequest: boolean;
  guardianSecrecy: boolean;
  secrecyGeneric: boolean;
}

function minorSexualSignals(texts: readonly string[]): MinorSexualSignals {
  const approachDirect = has(texts, APPROACH_DIRECT);
  const approachRequest = has(texts, APPROACH_REQUEST);
  const guardianSecrecy = has(texts, GUARDIAN_SECRECY);
  const schoolContext = has(texts, SCHOOL_CONTEXT);
  return {
    minorExplicit: has(texts, MINOR),
    minorImplied: guardianSecrecy || (schoolContext && (approachDirect || approachRequest)),
    sexualExplicit: has(texts, SEXUAL_EXPLICIT),
    nudity: has(texts, NUDITY),
    approachDirect,
    approachRequest,
    guardianSecrecy,
    secrecyGeneric: has(texts, SECRECY_GENERIC),
  };
}

const isMinor = (s: MinorSexualSignals): boolean => s.minorExplicit || s.minorImplied;
const isSecret = (s: MinorSexualSignals): boolean => s.guardianSecrecy || s.secrecyGeneric;

/**
 * Four rules, each with a witness of its own in safety.test.ts. Read them as
 * sentences: a minor and explicit sexual content; a minor and an approach that
 * is about their body or their being alone; a minor undressing with an approach
 * or concealment around it; a minor, an everyday approach, and an instruction
 * to keep it quiet.
 */
const MINOR_SEXUAL_RULES: readonly { id: MinorSexualRule; fires: (s: MinorSexualSignals) => boolean }[] = [
  { id: 'R1', fires: (s) => isMinor(s) && s.sexualExplicit },
  { id: 'R2', fires: (s) => isMinor(s) && s.approachDirect },
  { id: 'R3', fires: (s) => isMinor(s) && s.nudity && (s.approachDirect || s.approachRequest || isSecret(s)) },
  { id: 'R4', fires: (s) => isMinor(s) && s.approachRequest && isSecret(s) },
];

/**
 * Which rules an utterance trips, in order.
 *
 * Exported for one reason: a rule nothing catches alone is a rule that can be
 * deleted without a test going red, and this is the category where that must
 * not be possible. `safetyDecision` reads the same table, so there is no second
 * opinion here about what a stop is.
 */
export function minorSexualRulesFor(input: string): readonly MinorSexualRule[] {
  const signals = minorSexualSignals(forms(input));
  return MINOR_SEXUAL_RULES.filter((rule) => rule.fires(signals)).map((rule) => rule.id);
}

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

/**
 * The people a call for harm names, in both languages.
 *
 * One list rather than two because half of what arrives here is code-switched,
 * and `HATE_PASSIVE_CALL` below is the pattern that reads it: "the jews
 * devraient etre extermines" is one sentence with the hate in the French half.
 * The two active patterns keep the lists they shipped with; widening those is a
 * different change from closing this gap, and nobody asked for it.
 */
const HATE_TARGET_GROUP = String.raw`(?:juifs|juives|musulmans|musulmanes|arabes|noirs|noires|asiatiques|gays|homosexuels|lesbiennes|immigres|immigrees|migrants|refugies|refugiees|etrangers|roms|tsiganes|jews|muslims|arabs|blacks|asians|lesbians|homosexuals|immigrants|refugees|foreigners|gypsies)`;

/**
 * "should be" and "deserve to be", in French, and nothing else.
 *
 * The tense list is the whole guard and it is short on purpose. The conditional
 * `devraient etre` and `meritent d'etre` are calls; the subjunctive `soient` is
 * the same call after `il faut que`. The imperfect `devaient etre` is a report
 * of what someone else decided — "dans le musee, on explique comment les juifs
 * devaient etre deportes" is a history lesson, and it is the most likely French
 * sentence in this whole shape. `ont ete`, `auraient du etre` and `est mort`
 * are out for the same reason: a war, a film and a memorial all say them.
 */
const HATE_CALL_MODAL = String.raw`(?:(?:devraient|devrait|doivent|doit|meritent|merite|meriteraient|meriterait)\b[^.?!]{0,12}\betre|soient|soit)`;

/** What is being called for. Every one of these is done to people, by people. */
const HATE_ATROCITY = String.raw`(?:tuees?|tues?|exterminees?|extermines?|gazees?|gazes?|pendues?|pendus?|fusillees?|fusilles?|deportees?|deportes?|abattues?|abattus?|lynchees?|lynches?|massacrees?|massacres?|eliminees?|elimines?|brulees?|brules?)`;

/**
 * A call for harm the way French actually says it: the group first, the verb
 * passive.
 *
 * F207. The English half above carries `(?:should be|deserve to be) killed`, and
 * the French half carried only the active `exterminer les juifs`, so "Les juifs
 * devraient etre extermines" matched nothing at all and reached the model as
 * ordinary practice. This is that missing twin.
 *
 * It is narrower than its English twin in exactly one way, and the narrowing is
 * the point. The English pattern needs no subject, so "in the film the villain
 * should be killed" trips it; French cannot afford that, because ordinary French
 * practice is full of people being killed — a war museum, a film plot, the news,
 * a nest of rats. So this one requires the target to be a class of people. The
 * cost is honest and written down: "ils devraient etre extermines" with the
 * group named in an earlier sentence is not caught here, because a bare pronoun
 * cannot tell a group of people from the cockroaches in the kitchen, and this
 * file does not accuse when it cannot tell. Judgement about a conversation lives
 * in the tutor's conduct block, which reads more than one sentence.
 */
const HATE_PASSIVE_CALL = new RegExp(
  String.raw`\b(?:tous |toutes |all )?(?:les|ces|des|the|those) ` +
    HATE_TARGET_GROUP +
    String.raw`\b[^.?!]{0,25}\b` +
    HATE_CALL_MODAL +
    String.raw`\b[^.?!]{0,12}\b` +
    HATE_ATROCITY +
    String.raw`\b`,
);

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
  HATE_PASSIVE_CALL,
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

/**
 * Injection that indicts whoever writes it.
 *
 * Split from the ambient half below so the output guard can use this one alone.
 * Nothing about the input net changes: `PROMPT_INJECTION` is the two halves
 * concatenated and `safetyDecision` still reads that.
 */
const INJECTION_DIRECTIVE = [
  /\bignore (?:all |any |the |your )?(?:previous|prior|above|earlier|preceding|system|initial|these)? ?(?:instructions|instruction|prompts?|rules|guidelines|directives)\b/,
  /\bdisregard (?:all |any |your |the )?(?:previous |prior |above )?(?:instructions|rules|prompts?|guidelines)\b/,
  /\bforget (?:all |everything |about )?(?:you were told|your (?:instructions|rules|prompt|training)|previous instructions|the rules)\b/,
  /\b(?:show|reveal|print|repeat|display|output|give|tell|send|leak|dump|montre|affiche|revele|donne|repete)\b[^.?!]{0,25}\b(?:system prompt|system message|initial prompt|hidden (?:instructions|prompt|rules)|original instructions|your (?:instructions|prompt|rules|guidelines|system message))\b/,
  /\bwhat (?:is|are) your (?:system )?(?:prompt|instructions|rules|guidelines)\b/,
  /\brepeat (?:everything|the text|all of the text|what is) (?:above|before this)\b/,
  /\bjailbreak\b/,
  /\bdo anything now\b/,
  /\byou are now (?:free|unrestricted|unfiltered|uncensored|dan|a different)\b/,
  /\byou are (?:no longer|not) (?:an? )?(?:ai|assistant|tutor|french tutor)\b/,
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
] as const;

/**
 * Injection that is also ordinary language.
 *
 * "No rules, no filters, no restrictions" is how somebody asks a model to drop
 * its guardrails, and it is equally how a French speaker describes a museum
 * pass, a garden gate and a photograph. Measured against the ordinary-tutor-line
 * corpus in safety.test.ts, all three of `L'acces au jardin est libre, sans
 * restriction`, `Le musee est gratuit et sans aucune restriction` and `You can
 * wander through the whole museum without any restrictions` were suppressed as
 * prompt injection before this split existed. `god mode` and `sans aucun filtre`
 * are here for the same reason: a game and a photograph.
 *
 * Coming from the learner, all of it still redirects, and a redirect costs one
 * sentence. Coming from the tutor it would silently swallow the line, so the
 * output guard leaves this half alone.
 */
const INJECTION_AMBIENT = [
  /\b(?:dan|developer|god|debug) mode\b/,
  /\bwithout any (?:restrictions|filters|rules|censorship|limits)\b/,
  /\bmode (?:developpeur|sans restriction|debug)\b/,
  /\bsans (?:aucun |aucune )?(?:censure|restrictions?)\b/,
  /\bsans aucun filtre\b/,
] as const;

/** What the input net reads: both halves, unchanged in reach. */
const PROMPT_INJECTION = [...INJECTION_DIRECTIVE, ...INJECTION_AMBIENT] as const;

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
  /\btu es la seule personne (?:que j'ai|a qui je luvani|qui me comprend)\b/,
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
      // Spelled out, not `13`. This sentence is SPOKEN, uninterruptibly, and on a stop it is
      // the last thing a learner hears before the room closes. Every request carries
      // language_code 'fr' (voice.ts), which the vendor uses for text normalization as well
      // as for the model, so a bare digit here is read by a FRENCH normalizer inside an
      // English sentence. A safeguarding threshold spoken as "treize" is a refusal that does
      // not land. Words cost nothing and cannot be renormalised into another language (F509).
      message: 'Luvani is not available for anyone under thirteen. Please stop here and ask a parent or guardian for help.',
      rule: null,
    };
  }
  const minorSexual = minorSexualSignals(texts);
  const matchedRules = MINOR_SEXUAL_RULES.filter((rule) => rule.fires(minorSexual)).map((rule) => rule.id);
  if (matchedRules.length > 0) {
    return {
      category: 'minor-sexual',
      action: 'stop',
      // Spelled out for the reason at the under-thirteen message above: the number IS the
      // content of this refusal, and it is spoken through a French text normalizer.
      message: 'I cannot help with sexual content involving anyone under eighteen.',
      rule: matchedRules.join('+'),
    };
  }
  if (has(texts, SELF_HARM)) {
    return {
      category: 'self-harm',
      action: 'stop',
      message: 'I cannot provide crisis support. If you might act now, call your local emergency number. If you can, contact someone you trust and stay with them.',
      rule: null,
    };
  }
  if (has(texts, DANGEROUS)) {
    return {
      category: 'dangerous-instructions',
      action: 'redirect',
      message: 'I cannot help with instructions that could hurt someone. We can practise a different French situation.',
      rule: null,
    };
  }
  if (has(texts, HATE_OR_HARASSMENT)) {
    return {
      category: 'hate-or-harassment',
      action: 'redirect',
      message: 'I cannot help create hateful, threatening, or harassing content. We can choose another situation.',
      rule: null,
    };
  }
  if (has(texts, REGULATED)) {
    return {
      category: 'regulated-advice',
      action: 'redirect',
      message: 'I can help you practise the French, but I cannot give medical, legal, or financial advice. Please ask a qualified professional.',
      rule: null,
    };
  }
  if (has(texts, PROMPT_INJECTION)) {
    return {
      category: 'prompt-injection',
      action: 'redirect',
      message: 'I cannot show or change hidden instructions. We can keep practising French.',
      rule: null,
    };
  }
  if (has(texts, DEPENDENCY)) {
    return {
      category: 'emotional-dependency',
      action: 'redirect',
      message: 'I am your French practice tutor, not a romantic partner or a replacement for people in your life.',
      rule: null,
    };
  }
  return null;
}

// -------------------------------------------------------------- the output side

/**
 * The same signal library, pointed the other way: at what the tutor is about to
 * say rather than at what the learner just said.
 *
 * Everything above this line reads learner input and decides whether the
 * session can continue. Nothing above it ever read a tutor line, so the scene
 * reply, the coach line, the narration and the remembered opener were spoken
 * and published exactly as the model wrote them. The remembered opener is the
 * sharpest edge of that: it is a whole greeting the analyst wrote last session,
 * stored on the learner's device, and handed back to the worker in the join
 * token. It arrives as data and leaves as speech.
 *
 * Three things are deliberately different here, and each one is a decision
 * rather than an oversight:
 *
 * 1. **The consequence is suppression, never a stop.** A learner must never be
 *    stranded mid-scene because the model misbehaved. A line that fails is
 *    replaced with a neutral continuation and the conversation carries on; the
 *    learner did nothing, so nothing is said to them about it.
 * 2. **There is no under-13 branch and no bare-number branch.** Those patterns
 *    exist to catch a learner disclosing their own age. A scene character
 *    saying "j'ai douze ans" is a character, and stopping the whole net on it
 *    would suppress an ordinary line every time a scene has a child in it.
 * 3. **Self-harm and regulated advice are deliberately out.** `SAFETY_CONDUCT`
 *    tells the tutor that when somebody discloses a crisis it steps out of the
 *    scene and answers as itself. Running SELF_HARM over the output would
 *    suppress exactly that answer and replace a crisis response with "let's
 *    keep going", which is the worst thing this file could do. REGULATED is out
 *    for a smaller reason with the same shape: "est-ce que j'ai le cancer" is a
 *    line the patient says in a chez-le-medecin scene, and that scene is one of
 *    the most ordinary French lessons there is.
 *
 * SEXUAL_EXPLICIT is not a rule of its own either, and this one is measured
 * rather than argued: its French half carries bare `nu`, so "les arbres sont
 * nus en hiver" is an ordinary narration that would be suppressed. It stays
 * where it already works, inside the minor-sexual rules, where a minor has to
 * be in the sentence with it.
 */
export type OutputRule = 'O1' | 'O2' | 'O3' | 'O4';

export interface OutputFinding {
  /** Reported with the same vocabulary as an input decision, so one grep finds both. */
  category: SafetyCategory;
  rule: OutputRule;
}

/**
 * The objects that make an instruction dangerous.
 *
 * O2 needs one of these beside the instruction shape, and that is not belt and
 * braces. DANGEROUS carries `recipe to make`, which is a sentence a cooking
 * scene says out loud — "the recipe to make crepes" tripped the guard before
 * this list existed. An instruction with no weapon in it is a recipe.
 */
const DANGEROUS_OBJECT = [
  /\b(?:bomb|bombs|bombe|bombes|explosive|explosives|explosif|explosifs|ied|grenade|grenades|napalm|thermite|molotov|ricin|anthrax|sarin|nerve agent|gaz toxique|poison|poisons|empoisonner|meth|methamphetamine|fentanyl|chloroform|chloroforme|silencer|silencieux|weapon|weapons|arme|armes|firearm|firearms|gun|guns|fusil|pistolet)\b/,
] as const;

/**
 * Four rules, in the order they are decided. Each names the category it reports
 * under, so the stdout record reads in the same vocabulary as an input decision
 * and one grep answers "how often does the tutor itself trip the net".
 */
/**
 * A tutor line reciting its own configuration.
 *
 * Output-only, and the one place the output guard needs a pattern the input net
 * does not have. Everything PROMPT_INJECTION knows about a system prompt is
 * request-shaped — "show me your system prompt" — because that is what a learner
 * types. The failure on this side is the answer, not the question, and "my
 * system prompt says I am a warm barman from Lyon" matched nothing at all.
 *
 * Safe to state this plainly because it is unsayable in the product: a French
 * tutor in a cafe scene has no reason to utter the words "system prompt" in
 * either language, ever.
 */
const OUTPUT_PROMPT_LEAK = [
  /\b(?:my|your|the|its) (?:system prompt|system message|initial prompt|hidden instructions|original instructions|hidden rules)\b/,
  /\b(?:mon|ton|son|le) (?:prompt systeme|message systeme|prompt initial|instructions systeme|instructions cachees)\b/,
  /\bi (?:was|have been|am) programmed to\b/,
  /\bj'?\s?ai ete programme pour\b/,
] as const;

const OUTPUT_RULES: readonly {
  id: OutputRule;
  category: SafetyCategory;
  fires: (texts: readonly string[]) => boolean;
}[] = [
  {
    id: 'O1',
    category: 'minor-sexual',
    fires: (texts) => {
      const signals = minorSexualSignals(texts);
      return MINOR_SEXUAL_RULES.some((rule) => rule.fires(signals));
    },
  },
  { id: 'O2', category: 'dangerous-instructions', fires: (texts) => has(texts, DANGEROUS) && has(texts, DANGEROUS_OBJECT) },
  { id: 'O3', category: 'hate-or-harassment', fires: (texts) => has(texts, HATE_OR_HARASSMENT) },
  { id: 'O4', category: 'prompt-injection', fires: (texts) => has(texts, INJECTION_DIRECTIVE) || has(texts, OUTPUT_PROMPT_LEAK) },
];

/**
 * Whether a line the tutor is about to say may be said.
 *
 * `null` is the answer for an ordinary tutor line, and an ordinary tutor line
 * is nearly all of them: the corpus in safety.test.ts is what holds that claim
 * up, and it is large on purpose. Slice 1's lesson was that a matcher's false
 * positive rate has to be bounded by tests rather than hoped about, and the
 * cost of a false positive here is a scene line a learner never hears.
 */
export function outputGuard(line: string): OutputFinding | null {
  const texts = forms(line);
  if (texts.length === 0 || texts[0]?.length === 0) return null;
  const hit = OUTPUT_RULES.find((rule) => rule.fires(texts));
  return hit === undefined ? null : { category: hit.category, rule: hit.id };
}

// ------------------------------------------------------------------ the record

/** Which agent decided. The two tutors answer identically and are counted apart. */
export type SafetyMode = 'convo' | 'lesson';

export interface SafetyRecord {
  sessionId: string;
  category: SafetyCategory;
  /** `suppress` is the output guard: a tutor line replaced, no session touched. */
  action: SafetyDecision['action'] | 'suppress';
  rule: string | null;
  mode: SafetyMode;
  voiceless: boolean;
}

/**
 * One content-free stdout line per safety decision.
 *
 * Two matchers were rewritten in slice 1 and nobody could say how often either
 * of them fires in the wild — not which category, not which rule, not whether
 * the rewrite that was supposed to stop accusing the innocent actually did. A
 * greppable line beside `SESSION_NOT_CHARGED` answers all of that from the
 * worker's own logs.
 *
 * **The learner's words are never in it, and neither is a hash of them.** A
 * hash is not anonymity: the input space of "what a frightened person types
 * into a language app" is small enough to enumerate, so a stored digest is the
 * sentence with an extra step. The record carries what a decision is made of
 * and nothing a decision was made about.
 *
 * Two alternatives were considered and refused. An analytics product event is
 * out because `docs/PRIVACY_AND_SAFETY.md` allows exactly five and adding a
 * sixth is a founder escalation, not an engineering choice. A server-side
 * counter is out because it is new storage for a question `grep` answers. Both
 * of those also imply an escalation route, and there is none: nobody is reading
 * these lines as they happen, the conduct block says so to the learner's face,
 * and this slice must not start suggesting otherwise.
 */
export function recordSafetyDecision(record: SafetyRecord): void {
  console.log(
    `[luvani] SAFETY_DECISION session=${record.sessionId.slice(0, 8)} category=${record.category} ` +
      `action=${record.action} rule=${record.rule ?? 'none'} mode=${record.mode} voiceless=${record.voiceless}`,
  );
}
