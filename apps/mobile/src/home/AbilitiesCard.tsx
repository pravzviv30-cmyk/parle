/**
 * Real progress, on Home (F545, F572).
 *
 * One white row: a green mark, the caps heading, and one sentence saying what
 * this learner can now do in French. It draws `home/abilities.ts` and decides
 * nothing, including what it is called and what it says to somebody listening
 * to it, because a row that joined its own heading to its own sentence would be
 * a second opinion about a claim the module is careful with.
 *
 * The whole row is the way in, not the chevron: the arrow is a sign, and a row
 * whose only target is its arrow was the F545 defect. It opens Progress, where
 * the same passport is one situation per line with the week beneath it.
 *
 * Green, because green means ground the learner has already covered. It is a
 * mark rather than a word, so it is held to 3 against the disc it sits on; the
 * words beside it are ink.
 */

import { StyleSheet, View } from 'react-native';

import { BadgeGlyph } from '../components.tsx';
import { IconRowCard } from '../surface/IconRowCard.tsx';
import { signal, space } from '../theme.ts';
import type { CanDo } from './abilities.ts';

export function AbilitiesCard({ can, onOpen }: { can: CanDo; onOpen: () => void }) {
  return (
    <View style={st.card}>
      <IconRowCard
        glyph={<BadgeGlyph size={24} color={signal.good} />}
        label={can.label}
        line={can.line}
        onPress={onOpen}
        accessibilityLabel={can.spoken}
      />
    </View>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(4) },
});
