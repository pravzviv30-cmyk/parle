/**
 * The session side and every remaining frontend screen wear the notebook —
 * notebook Phase 4 (B1), added 2026-09-27.
 *
 * The live conversation and its thread, the guided lesson, the recap and the
 * lesson's end card, the live failure and out-of-minutes pages, the chooser,
 * the real moment, the tutor intro, the two auth screens, the age gate and the
 * account onboarding, Settings, the legal screens, and Speak. None of them may
 * draw the old kit: no tinted row or panel, no row card, no hero card, no
 * feature paper, no whisper shadow, no week rail, no card inside a card, and no
 * authored clip-art. Nothing here moves: only the orb and the highlighter do,
 * and both live in their own components. The highlighter is at most once per
 * file. The one picture allowed is a place's flat drawing, on the chooser.
 *
 * Read as source with comments stripped, because a comment may name the thing
 * it replaced. Same shape as `evidenceScreens.test.ts`, B2's half of this pass.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const read = (rel: string): string => stripComments(readFileSync(`${SRC}${rel}`, 'utf8'));

/** Every screen file this pass owns, by directory where the directory is whole. */
const WHOLE_DIRS = ['settings', 'legal'];
const SINGLE = [
  'ConvoScreen.tsx',
  'LiveSessionScreen.tsx',
  'SessionScreen.tsx',
  'SessionView.tsx',
  'RecapScreen.tsx',
  'SummaryScreen.tsx',
  'tutor/Transcript.tsx',
  'tutor/RealMomentScreen.tsx',
  'tutor/TutorIntro.tsx',
  'live/LiveErrorView.tsx',
  'live/OutOfMinutesView.tsx',
  'missions/MissionsScreen.tsx',
  'missions/ListeningPreview.tsx',
  'auth/SignInScreen.tsx',
  'auth/SignUpScreen.tsx',
  'onboarding/AgeGateScreen.tsx',
  'onboarding/OnboardingFlow.tsx',
  'tabs/TutorTab.tsx',
];
const FILES: string[] = [
  ...SINGLE,
  ...WHOLE_DIRS.flatMap((dir) =>
    readdirSync(`${SRC}${dir}`)
      .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
      .map((name) => `${dir}/${name}`),
  ),
];

/** How deep `<Card>` opens inside another `<Card>` in one file. One is a card; two is a card in a card. */
function cardDepth(source: string): number {
  let depth = 0;
  let deepest = 0;
  for (const m of source.matchAll(/<Card\b(?:[^>"']|"[^"]*"|'[^']*'|\{[^}]*\})*?(\/)?>|<\/Card>/g)) {
    if (m[0] === '</Card>') depth -= 1;
    else if (m[1] === undefined) {
      depth += 1;
      deepest = Math.max(deepest, depth);
    }
  }
  return deepest;
}

describe('the session side and the remaining screens wear the notebook — Phase 4 B1', () => {
  test('no screen in this pass draws a tint, a row card, a hero card, feature paper, the whisper or the week rail', () => {
    const OLD_KIT = [
      /<TintRow\b/,
      /<TintPanel\b/,
      /<TintDisc\b/,
      /<IconRowCard\b/,
      /<HeroCard\b/,
      /<WeekRail\b/,
      /\baccent\.feature\b/,
      /\bshadow\.whisper\b/,
      /tone="feature"/,
      /\bmissionTint\b|\bmomentTint\b/,
    ];
    assert.ok(FILES.length > SINGLE.length, 'the directory walk found nothing, so it is checking nothing');
    for (const file of FILES) {
      const body = read(file);
      for (const pattern of OLD_KIT) {
        assert.doesNotMatch(body, pattern, `${file} still draws ${pattern}`);
      }
    }
  });

  test('nothing in this pass moves, and none of it draws clip-art', () => {
    for (const file of FILES) {
      const body = read(file);
      if (file === 'onboarding/OnboardingFlow.tsx') {
        assert.match(body, /useOnboardingTransition\(\)/, 'onboarding must use the shared live reduced-motion transition');
        assert.doesNotMatch(body, /Animated\.(timing|spring|sequence|parallel)/, 'onboarding invented a second animation owner');
      } else {
        assert.doesNotMatch(body, /\bAnimated\./, `${file} animates outside the shared onboarding transition`);
      }
      assert.doesNotMatch(body, /from '(\.\.\/)*\.?\/?illustrations/, `${file} draws an authored scene`);
      // One picture is allowed: the scene's place drawing on the chooser's
      // brief (revamp B, F599: the watercolour it replaced has retired).
      assert.doesNotMatch(body, /<Art\b/, `${file} draws a retired watercolour`);
      for (const art of body.match(/<Illustration\b[^>]*>/g) ?? []) {
        assert.match(art, /name=\{sceneIllustration\(|name="state-(?:microphone|offline|notebook|waiting|headphones)"|name="celebrate-first-line"|name=\{postcardIllustration\(|name=\{failure.startsWith\('mic-'\) \? 'state-microphone' : 'state-offline'\}/, `${file} draws a picture that is not a scene's place: ${art}`);
      }
    }
  });

  test('no card sits in a card, and the highlighter is used at most once per file', () => {
    for (const file of FILES) {
      const body = read(file);
      assert.ok(cardDepth(body) <= 1, `${file} nests a Card inside a Card`);
      assert.ok((body.match(/<Highlight\b/g) ?? []).length <= 1, `${file} draws the highlighter more than once`);
    }
  });
});
