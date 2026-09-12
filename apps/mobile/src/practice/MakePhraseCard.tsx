/**
 * Make this phrase yours (F554, F557).
 *
 * One phrase the learner actually needed: its French in the serif, its
 * meaning, where it came from, whether it is in their phrase bank, and one
 * way to work it. Say it opens a drill scoped to the phrase only when a
 * sitting would have something in it; otherwise the card offers to hear it,
 * because an empty sitting that ends the moment it opens is the defect this
 * tab's tests were written against.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card, GhostButton, Label, OutlineButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { MADE_FROM, type PhraseToOwn } from './madeFrom.ts';

export function MakePhraseCard({
  phrase,
  saving,
  onSay,
  onHear,
  onSave,
}: {
  phrase: PhraseToOwn;
  /** A save is a write and a read back; the button says so while it runs. */
  saving: boolean;
  onSay: () => void;
  onHear: () => void;
  onSave: () => void;
}) {
  return (
    <Card style={st.card}>
      <Label>{MADE_FROM.phrase.label}</Label>
      <Text style={st.fr}>{phrase.fr}</Text>
      <Text style={st.en}>{phrase.en}</Text>
      <Text style={st.from}>{phrase.from}</Text>
      <View style={st.actions}>
        {phrase.sayable ? (
          <OutlineButton label={MADE_FROM.phrase.say} onPress={onSay} />
        ) : (
          <OutlineButton label={MADE_FROM.phrase.hear} onPress={onHear} />
        )}
        {phrase.saved ? (
          <Text style={st.saved}>{MADE_FROM.phrase.saved}</Text>
        ) : (
          <GhostButton label={MADE_FROM.phrase.save} disabled={saving} onPress={onSave} />
        )}
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(3) },
  fr: { ...type.french, color: paper.ink, marginTop: space(2) },
  en: { ...type.small, color: paper.inkSoft, marginTop: space(1) },
  from: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  actions: { marginTop: space(4), gap: space(2) },
  saved: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
});
