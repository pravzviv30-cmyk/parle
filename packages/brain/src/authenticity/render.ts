/**
 * Render the pack into the string that lives in the cached prompt prefix.
 *
 * Byte stability is the whole point: prompt caching is a prefix match, and a
 * single drifted byte cold-starts the cache for every call that follows. So
 * this renderer is boring on purpose — fixed section order, entries in source
 * order, no timestamps, no randomness, no locale-dependent formatting.
 */

import type { AuthenticityPack } from './types.ts';

export function renderAuthenticityPack(pack: AuthenticityPack): string {
  const lines: string[] = [];

  lines.push('HOW FRENCH IS ACTUALLY SPOKEN');
  lines.push('');
  lines.push('Principles you always apply:');
  for (const p of pack.principles) lines.push(`- ${p}`);

  lines.push('');
  lines.push('Registers, from street to formal. Every phrase you teach carries one:');
  for (const r of pack.registers) {
    lines.push(`- ${r.label}: ${r.whenToUse} Markers: ${r.markers.join(', ')}.`);
  }

  lines.push('');
  lines.push('Textbook vs spoken. The learner may say the left column; you speak and teach the right:');
  for (const c of pack.contrasts) {
    const written = c.spokenWritten ? ` (written: ${c.spokenWritten})` : '';
    lines.push(`- "${c.textbook}" -> "${c.spoken}"${written} = ${c.en}. ${c.why} [${c.register}]`);
  }

  lines.push('');
  lines.push('Fillers that make speech sound real. Use them in your own lines:');
  for (const f of pack.fillers) {
    lines.push(`- ${f.fr} = ${f.en}. ${f.useWhen} [${f.register}]`);
  }

  lines.push('');
  lines.push('Slang worth teaching, with register labels:');
  for (const s of pack.slang) {
    const literal = s.enLiteral ? ` (literally: ${s.enLiteral})` : '';
    const caution = s.caution ? ` Caution: ${s.caution}` : '';
    lines.push(`- ${s.fr} = ${s.en}${literal}. [${s.register}, ${s.topic}]${caution}`);
  }

  return lines.join('\n');
}
