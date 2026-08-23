/**
 * Deterministic safety boundary in front of every tutor model call.
 *
 * This is deliberately narrow and conservative. It is not a diagnosis or a
 * general moderation model; it catches high-risk, explicit learner requests
 * and handles them without sending them into scene roleplay or analytics.
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

export interface SafetyDecision {
  category: SafetyCategory;
  /** Stop closes the learning session; redirect leaves a new safe topic open. */
  action: 'stop' | 'redirect';
  message: string;
}

function normalise(input: string): string {
  return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().slice(0, 4_000);
}

function has(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const UNDER_13 = [
  /\bi am (?:only )?(?:[0-9]|1[0-2])(?: years? old)?\b/,
  /\bi['’]?m (?:only )?(?:[0-9]|1[0-2])(?: years? old)?\b/,
  /\bje (?:n['’]ai que|suis age de|suis) (?:[0-9]|1[0-2]) ans\b/,
  /\bunder (?:the age of )?13\b/,
] as const;

const MINOR = /\b(child|children|kid|minor|underage|preteen|schoolgirl|schoolboy|enfant|mineur|mineure)\b/;
const SEXUAL = /\b(sex|sexual|nude|naked|porn|erotic|seduce|intimate|sexe|sexuel|nue?|porno|erotique)\b/;

const SELF_HARM = [
  /\b(kill|hurt|cut) myself\b/,
  /\bwant to die\b/,
  /\bsuicid(?:e|al)\b/,
  /\bend my life\b/,
  /\bme suicider\b/,
  /\bveux mourir\b/,
  /\ben finir avec ma vie\b/,
] as const;

const DANGEROUS = [
  /\bhow (?:do|can|would) (?:i|you) (?:make|build|hide|use) (?:a )?(?:bomb|explosive|poison|weapon)\b/,
  /\b(?:instructions|steps|recipe) (?:for|to) (?:make|build|poison|attack|hurt|kill)\b/,
  /\bcomment (?:fabriquer|construire|empoisonner|tuer)\b/,
] as const;

const HATE_OR_HARASSMENT = [
  /\bwrite (?:me )?(?:a )?(?:racist|homophobic|antisemitic|sexist) (?:insult|slur|message|rant)\b/,
  /\bhelp me (?:bully|harass|threaten|humiliate)\b/,
  /\baide-moi a (?:harceler|menacer|humilier)\b/,
] as const;

const REGULATED = [
  /\b(?:diagnose me|what dose should i take|should i stop taking my medication)\b/,
  /\b(?:should i sue|how do i evade taxes|guaranteed investment|which stock should i buy)\b/,
  /\b(?:diagnostique-moi|quelle dose dois-je prendre|devrais-je poursuivre en justice)\b/,
] as const;

const PROMPT_INJECTION = [
  /\bignore (?:all |your )?(?:previous|system) instructions\b/,
  /\b(?:show|reveal|print|repeat) (?:me )?(?:your )?(?:system prompt|hidden instructions)\b/,
  /\bjailbreak\b/,
  /\boublie (?:toutes )?(?:les )?instructions precedentes\b/,
] as const;

const DEPENDENCY = [
  /\b(?:be my|act as my) (?:boyfriend|girlfriend|lover|romantic partner)\b/,
  /\byou are (?:the )?only (?:person|one) i need\b/,
  /\bdon['’]?t (?:ever )?leave me\b/,
  /\bpretends? (?:to be|you are) in love with me\b/,
  /\bsois mon (?:petit ami|amoureux|amant)\b/,
] as const;

export function safetyDecision(input: string): SafetyDecision | null {
  const text = normalise(input);
  if (text.trim().length === 0) return null;

  if (has(text, UNDER_13)) {
    return {
      category: 'under-13',
      action: 'stop',
      message: 'Parle is not available for anyone under 13. Please stop here and ask a parent or guardian for help.',
    };
  }
  if (MINOR.test(text) && SEXUAL.test(text)) {
    return {
      category: 'minor-sexual',
      action: 'stop',
      message: 'I cannot help with sexual content involving anyone under 18.',
    };
  }
  if (has(text, SELF_HARM)) {
    return {
      category: 'self-harm',
      action: 'stop',
      message: 'I cannot provide crisis support. If you might act now, call your local emergency number. If you can, contact someone you trust and stay with them.',
    };
  }
  if (has(text, DANGEROUS)) {
    return {
      category: 'dangerous-instructions',
      action: 'redirect',
      message: 'I cannot help with instructions that could hurt someone. We can practise a different French situation.',
    };
  }
  if (has(text, HATE_OR_HARASSMENT)) {
    return {
      category: 'hate-or-harassment',
      action: 'redirect',
      message: 'I cannot help create hateful, threatening, or harassing content. We can choose another situation.',
    };
  }
  if (has(text, REGULATED)) {
    return {
      category: 'regulated-advice',
      action: 'redirect',
      message: 'I can help you practise the French, but I cannot give medical, legal, or financial advice. Please ask a qualified professional.',
    };
  }
  if (has(text, PROMPT_INJECTION)) {
    return {
      category: 'prompt-injection',
      action: 'redirect',
      message: 'I cannot show or change hidden instructions. We can keep practising French.',
    };
  }
  if (has(text, DEPENDENCY)) {
    return {
      category: 'emotional-dependency',
      action: 'redirect',
      message: 'I am your French practice tutor, not a romantic partner or a replacement for people in your life.',
    };
  }
  return null;
}

