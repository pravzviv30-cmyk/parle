import { Text, View } from 'react-native';
import { ColourCard, SceneMark } from '../components.tsx';
import { onColour, paper, space, type } from '../theme.ts';
import type { LevelPathView } from './notebook.ts';

/** Only core's earned scene evidence decides the marks. */
export function LevelCard({ path, onPress, hasFinish = false, hasEarned = false }: { path: LevelPathView; onPress: () => void; hasFinish?: boolean; hasEarned?: boolean }) {
  const current = path.levels.find((level) => level.level === path.level);
  const next = path.levels[path.levels.findIndex((level) => level.level === path.level) + 1];
  return (
    <ColourCard ground="blue" onPress={onPress} accessibilityLabel={`${hasEarned ? 'Your scene path' : hasFinish ? 'Working on beginner scenes' : 'Your starting path'}, ${path.level}. See your scenes.`}>
      <Text style={[type.small, { color: onColour.blue }]}>{hasEarned ? 'Your scene path' : hasFinish ? 'Working on beginner scenes' : 'Your starting path'}</Text>
      <Text style={[type.display, { color: paper.onInk }]}>{path.level}</Text>
      {current?.stops.map((stop, index) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <SceneMark state={stop.state} />
          <Text style={[type.body, { color: paper.onInk, flex: 1 }]}>{stop.canDo}{stop.state === 'here' ? ', your next scene' : ''}</Text>
        </View>
      ))}
      <Text style={[type.small, { color: onColour.blue }]}>
        {next ? `${next.level} holds ${next.stops.length} scenes. See your scenes.` : 'See your scenes.'}
      </Text>
      <Text style={[type.small, { color: onColour.blue }]}>A0 and A1 name Luvani's current beginner scene path. They are not a certified French level.</Text>
    </ColourCard>
  );
}
