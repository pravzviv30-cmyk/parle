/** Context-bound spelling repair for speech recognition, never pronunciation grading. */
const words = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Include elided negation (n'), compound numbers and plural hundreds. A close
// spelling must never turn thirteen coffees into sixteen, or lose a refusal.
const protectedWords = /^(?:non|pas|ne|n|ni|rien|personne|jamais|sans|plus|aucuns?|aucunes?|zero|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingts?|trente|quarante|cinquante|soixante|septante|huitante|octante|nonante|cents?|mille|millions?|milliards?|no|not|never|without|\d+)$/;
const protectedMeaning = (text: string) => words(text).split(' ').filter(word => protectedWords.test(word)).join('|');
// These were observed during the café acceptance session. Approximate edit
// distance alone cannot distinguish a misrecognition from another valid word
// (train/pain, partir/parler), so new non-equivalent repairs need evidence.
const observedConfusions: Readonly<Record<string, string>> = {
  suplesse: 'sur place', souplesse: 'sur place', surplus: 'sur place',
};

function sound(text: string): string {
  return words(text).split(' ').map(word => word
    .replace(/eaux?$/g, 'o').replace(/au/g, 'o').replace(/ou/g, 'u')
    .replace(/ph/g, 'f').replace(/qu/g, 'k').replace(/c(?=[eiy])/g, 's')
    .replace(/ç/g, 's').replace(/y/g, 'i').replace(/([a-z])\1/g, '$1')
    .replace(/e$/g, '')).join('');
}

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1]! + 1, row[j]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length]!;
}

/** Small current-turn vocabulary, not every answer from the lesson. */
export function recognitionPhrases(lines: readonly string[]): string[] {
  const result = new Map<string, string>();
  for (const line of lines.slice(0, 12)) {
    if (!line.trim() || line.length > 100 || /[?\n\r]/.test(line)) continue;
    // A near-sound match must not add courtesy words that were never spoken.
    const short = line.replace(/^(?:oui[, ]+|bonjour[, ]+)/i, '').replace(/[, ]+(?:s['’]il vous pla[iî]t|merci)[.!]?$/i, '').trim();
    for (const candidate of [line.trim(), short]) {
      const key = words(candidate);
      if (key && !result.has(key)) result.set(key, candidate);
    }
  }
  let bytes = 0;
  return [...result.values()].slice(0, 16).filter(candidate => {
    const length = new TextEncoder().encode(candidate).length;
    if (bytes + length > 400) return false;
    bytes += length;
    return true;
  });
}

export function repairRecognizedFrench(text: string, context: readonly string[]): { text: string; interpreted: boolean } {
  const unchanged = { text, interpreted: false };
  if (text.length > 100 || /[\d?\n\r]/.test(text)) return unchanged;
  const key = sound(text);
  if (key.length < 5 || key.length > 50) return unchanged;
  const choices = recognitionPhrases(context);
  if (choices.some(candidate => words(candidate) === words(text))) return unchanged;
  const matches = choices.filter(candidate => protectedMeaning(candidate) === protectedMeaning(text))
    .map(candidate => ({ candidate, score: distance(key, sound(candidate)), length: Math.max(key.length, sound(candidate).length) }))
    .filter(match => match.score <= 2 && match.score / match.length <= 0.30)
    .sort((a, b) => a.score - b.score);
  const best = matches[0];
  // A tie or near-tie is uncertainty, not permission to pick the expected answer.
  if (!best || (matches[1] && matches[1].score - best.score < 2)) return unchanged;
  if (best.score !== 0 && observedConfusions[words(text)] !== words(best.candidate)) return unchanged;
  return { text: best.candidate, interpreted: true };
}
