import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { Card, Label, fitDisplay } from '../components.tsx';
import { SpeakerGlyph } from '../glyphs.tsx';
import { accent, paper, shadow, space, type, HIT } from '../theme.ts';

/**
 * One French line, large, with a way to hear it said.
 *
 * Practice opens on this and the drill's moment card wears it too. The line is
 * the point, so it is set through `fitDisplay`, which steps the serif down by
 * length the way a sign is cut to fit its longest word rather than clipping it:
 * nothing in this app caps a line count.
 *
 * The speaker is a round white disc at the touch floor with the whisper under
 * it, which is the one shadow a card is allowed and the only reason it reads as
 * a button on a white card. It says "Hear" before it sounds and "Stop" while it
 * does, the way `OptionCard`'s replay ear does, so a screen reader never offers
 * to play something that is already playing. The glyph is the identity violet
 * because the disc is the thing you press, which is what the violet has always
 * meant here; the state it is in is said in the label rather than drawn, so
 * nothing turns a colour in the corner of the eye while a learner is reading.
 *
 * `control` is whatever the screen wants under the gloss: an outline button on
 * Practice, nothing at all in a drill. It is a node so the caller keeps its own
 * button literal, which is what keeps the one-primary-action count per screen
 * readable from the screen's own file.
 */
export function PhraseCard({
  label,
  french,
  gloss,
  onHear,
  playing,
  control,
}: {
  label: string;
  /** The line to say, in French. */
  french: string;
  /** What it means, in the learner's language. */
  gloss: string;
  onHear: () => void;
  playing: boolean;
  /** A second action under the gloss, built by the caller. */
  control?: ReactNode;
}) {
  return (
    <Card tone="journal" style={s.card}>
      <Label>{label}</Label>
      <View style={s.line}>
        <Text style={[fitDisplay(french), s.french]}>{french}</Text>
        <Pressable
          onPress={onHear}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Stop' : 'Hear'}
          style={({ pressed }) => [s.speaker, pressed && s.speakerPressed]}
        >
          <SpeakerGlyph color={accent.primary} />
        </Pressable>
      </View>
      <Text style={[type.small, { color: paper.inkSoft }]}>{gloss}</Text>
      {control}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { gap: space(4), borderLeftWidth: 5, paddingVertical: space(5) },
  line: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  french: { color: paper.ink, flex: 1, minWidth: 0 },
  speaker: {
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    backgroundColor: paper.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.whisper,
  },
  speakerPressed: { backgroundColor: paper.groundDeep },
});
