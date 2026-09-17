/**
 * Tune one sound (F554, F558).
 *
 * One tinted row. The acoustic panel — the sound, its cue, the physical trick
 * and the minimal pair — lives on the sound-check screen the row opens, and
 * printing it on Practice as well was the same words in two places.
 *
 * Behaviour is unchanged from the card it replaces: with a check behind it the
 * row opens that check again, and with none it offers the way to the next
 * situation, which is what will name a sound. Nothing here scores anything and
 * nothing here calls an accent wrong.
 */

import { WaveformGlyph } from '../glyphs.tsx';
import { TintRow } from '../components.tsx';
import { accent } from '../theme.ts';
import { MADE_FROM, type SoundToTune } from './madeFrom.ts';
import { MADE_FROM_TINT } from './madeFromTint.ts';

export function TuneSoundCard({
  sound,
  onCheck,
  onChoose,
}: {
  sound: SoundToTune | null;
  onCheck: (missionId: string) => void;
  onChoose: () => void;
}) {
  return (
    <TintRow
      tint={MADE_FROM_TINT.sound}
      glyph={<WaveformGlyph color={accent.primary} />}
      title={MADE_FROM.sound.label}
      gloss={sound === null ? MADE_FROM.sound.none : MADE_FROM.sound.gloss}
      accessibilityLabel={sound === null ? `${MADE_FROM.sound.label}, ${MADE_FROM.sound.go}` : `${MADE_FROM.sound.label}, ${sound.acoustic.heading}`}
      onPress={() => {
        if (sound === null) onChoose();
        else onCheck(sound.missionId);
      }}
    />
  );
}
