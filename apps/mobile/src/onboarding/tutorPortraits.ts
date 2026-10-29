import type { TutorVoiceKey } from '@luvani/core';
import { colour, paper } from '../palette.ts';

const portraits: Record<TutorVoiceKey, { ground: string; shirt: string; hair: string; style: number }> = {
  alexandre: { ground: colour.sun, shirt: colour.blue, hair: paper.ink, style: 0 },
  emilie: { ground: colour.mint, shirt: colour.coral, hair: paper.ink, style: 1 },
  guillaume: { ground: colour.coral, shirt: colour.sun, hair: paper.inkSoft, style: 2 },
  marie: { ground: colour.sun, shirt: colour.mint, hair: colour.coral, style: 3 },
  anatole: { ground: colour.mint, shirt: colour.blue, hair: paper.ink, style: 4 },
  sarah: { ground: colour.blue, shirt: colour.coral, hair: paper.ink, style: 5 },
};

/** The colour behind a tutor's portrait, so a surface can check its edge against it. */
export function portraitGround(voice: TutorVoiceKey): string {
  return portraits[voice].ground;
}

/** The ring drawn round a portrait on any surface, so its edge never relies on the ground. */
export const PORTRAIT_RING = 2;

/** Original illustrated AI characters. The same editable SVGs are used in Figma. */
export function tutorPortraitSvg(voice: TutorVoiceKey): string {
  const p = portraits[voice];
  const hair = [
    'M17 31C13 14 25 9 35 12C47 8 52 17 48 31L44 23C33 25 29 18 21 24Z',
    'M15 45V27C15 7 49 7 49 27V45H41V28L37 20C31 27 24 28 22 27V45Z',
    'M17 30C12 23 17 15 25 15C26 9 36 9 39 14C49 12 54 25 47 31L43 24C34 29 29 21 21 27Z',
    'M14 45C8 22 17 10 32 10C49 10 55 25 49 45L41 42V27C34 28 27 23 24 20L22 42Z',
    'M17 29C13 14 22 10 29 13C32 6 47 9 48 18L46 30L41 22L36 25L31 19L21 26Z',
    'M13 43C8 34 12 24 15 23C9 12 26 6 32 12C43 4 55 17 48 24C56 31 51 40 47 44L40 38V25L33 20L23 27V40Z',
  ][p.style];
  const glasses = p.style === 0 || p.style === 2
    ? `<g fill="none" stroke="${paper.ink}" stroke-width="1.7"><rect x="22" y="28" width="8" height="6" rx="2"/><rect x="34" y="28" width="8" height="6" rx="2"/><path d="M30 30H34"/></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="23" fill="${p.ground}"/><path d="M10 64C10 48 19 43 32 43C45 43 54 48 54 64" fill="${p.shirt}"/><path d="M27 39H37V49C35 53 29 53 27 49Z" fill="${paper.ground}"/><path d="${hair}" fill="${p.hair}"/><ellipse cx="32" cy="31" rx="13" ry="16" fill="${paper.ground}"/><path d="${hair}" fill="${p.hair}"/><g fill="${paper.ink}"><circle cx="26" cy="31" r="1.2"/><circle cx="38" cy="31" r="1.2"/></g>${glasses}<path d="M28 38Q32 42 36 38" fill="none" stroke="${paper.ink}" stroke-width="1.5" stroke-linecap="round"/><path d="M31 32L30 35H33" fill="none" stroke="${paper.inkSoft}" stroke-width="1" stroke-linecap="round"/></svg>`;
}
