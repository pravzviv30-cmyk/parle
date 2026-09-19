import { useMemo, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Card } from '../components.tsx';
import { accent, HIT, paper, radius, space, type } from '../theme.ts';
import { DailyCard } from './DailyCard.tsx';
import type { DailyItem } from './catalogue.ts';
import { DAILY_TABS, horizontalSwipe, swipedCard } from './carousel.ts';

/** One visible card. Pills are the keyboard/screen-reader alternative to swiping. */
export function DailyCarousel({ word, phrase }: { word: DailyItem; phrase: DailyItem }) {
  const [selected, setSelected] = useState(0);
  const focused = useIsFocused();
  const pan = useMemo(() => PanResponder.create({
    // On web, claim the mouse before the browser starts selecting the text.
    // Native touch waits for a horizontal movement so vertical scrolling wins.
    // Child buttons remain the first responder; this is not a capture handler.
    onStartShouldSetPanResponder: () => Platform.OS === 'web',
    onMoveShouldSetPanResponder: (_, g) => horizontalSwipe(g.dx, g.dy),
    onPanResponderRelease: (_, g) => setSelected(index => swipedCard(index, g.dx, g.dy)),
    onPanResponderTerminationRequest: () => true,
  }), []);
  const item = selected === 0 ? word : phrase;
  return <Card style={s.card}>
    <View style={s.head}>
      <Text style={[type.small, { color: paper.inkSoft }]}>A little French today</Text>
      <View accessibilityRole="tablist" style={s.pills}>
        {DAILY_TABS.map((label, index) => <Pressable key={label} accessibilityRole="tab" accessibilityLabel={`${label} of the day, ${index + 1} of 2`} accessibilityState={{ selected: selected === index }} onPress={() => setSelected(index)} style={[s.pill, selected === index && s.selected]}>
          <Text style={[type.small, { color: paper.ink }]}>{label}</Text>
        </Pressable>)}
      </View>
    </View>
    <View {...pan.panHandlers}>
      <DailyCard key={item.id} item={item} compact embedded paused={!focused} />
    </View>
    <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>Swipe between word and phrase, or tap a pill.</Text>
  </Card>;
}
const s = StyleSheet.create({
  card: { marginTop: space(3), padding: space(3) },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space(1) },
  pills: { flexDirection: 'row', marginLeft: 'auto', gap: space(1) },
  pill: { minHeight: HIT, minWidth: HIT, paddingHorizontal: space(2), justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill, backgroundColor: paper.groundDeep },
  selected: { backgroundColor: accent.feature },
});
