/**
 * The guided lesson's out-of-minutes page, on the scrolling frame.
 *
 * The lesson file stays on the still frame (F444): its live scene is a circle,
 * a card and a transcript that must not move under the learner mid-turn. This
 * page is not that scene. It is where the session has ended, and since Stage 3
 * of the whole-app upgrade the paywall inside it always says something: an
 * offer with its renewal terms and documents, or a store-unavailable block with
 * Restore. At a large text size on a small phone that is taller than the
 * window. Like the safety stop, it is a terminal page whose words must be
 * readable at any size, so it lives in its own file and scrolls here, and Back
 * stays outside the paywall so a free way out is always on the screen (Stage 3
 * Fable review, 2026-09-25).
 *
 * The same white card the conversation draws, so the two live surfaces say
 * this in one voice: the caps line names the state, the store's own words fill
 * the card, and Back is the quiet outline because the offer inside the card is
 * the thing worth doing.
 */

import { View, Text, StyleSheet } from 'react-native';
import { paper, space, type } from '../theme.ts';
import { Card, Label, OutlineButton } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { Paywall } from '../purchases/Paywall.tsx';

export function OutOfMinutesView({ message, userId, onExit }: { message: string; userId: string; onExit: () => void }) {
  return (
    <ScrollScreen center bottom="inset">
      <Card style={st.card}>
        <Label color={paper.inkSoft}>Out of minutes</Label>
        <Text style={[type.body, { color: paper.ink, marginTop: space(2) }]}>{message}</Text>
        <Paywall userId={userId} />
      </Card>
      <View style={st.back}>
        <OutlineButton label="Back" onPress={onExit} />
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  card: { alignSelf: 'stretch' },
  back: { marginTop: space(6), alignSelf: 'stretch' },
});
