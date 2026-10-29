/**
 * What a voice preview button says to a screen reader, per state (F944): a
 * plain English sentence with the tutor's name, never "Listen Émilie's voice
 * preview".
 */
export type PreviewPhase = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export function previewLabel(phase: PreviewPhase, name: string): string {
  switch (phase) {
    case 'playing': return `Pause ${name}’s voice`;
    case 'paused': return `Resume ${name}’s voice`;
    case 'loading': return `Loading ${name}’s voice`;
    case 'error': return `Try ${name}’s voice again`;
    default: return `Listen to ${name}’s voice`;
  }
}
