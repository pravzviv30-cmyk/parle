/**
 * Replay a moment (F554, F582).
 *
 * One tinted row, not a card. The moment itself — what the learner said, the
 * better way and why — moved into the sitting it opens, where `MomentCard`
 * draws it above the exercise; a row that reprinted all four lines on Practice
 * made the tab a wall of prose and said the same thing twice.
 *
 * Tapping speaks the better line first and then opens the drill. That order is
 * the whole point of the row: hearing the line is free, offline and instant,
 * and a learner who hears it before the sitting opens arrives with the sound in
 * their ear rather than reading it cold. The voice is `speech/tutorVoice.ts`,
 * which is the platform synthesizer, so nothing is recorded, uploaded or
 * scored here — playback only, and the tab stops it when it goes.
 */

import { ReplayGlyph } from '../glyphs.tsx';
import { TintRow } from '../components.tsx';
import { accent } from '../theme.ts';
import { speak } from '../speech/tutorVoice.ts';
import { MADE_FROM, type Replay } from './madeFrom.ts';
import { MADE_FROM_TINT } from './madeFromTint.ts';

export function ReplayMomentCard({ replay, onTry }: { replay: Replay; onTry: () => void }) {
  return (
    <TintRow
      tint={MADE_FROM_TINT.replay}
      glyph={<ReplayGlyph color={accent.primary} />}
      title={MADE_FROM.replay.label}
      gloss={MADE_FROM.replay.gloss}
      accessibilityLabel={`${MADE_FROM.replay.label}, ${MADE_FROM.replay.listen}`}
      onPress={() => {
        speak(replay.better);
        onTry();
      }}
    />
  );
}
