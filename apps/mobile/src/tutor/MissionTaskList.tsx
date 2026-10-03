import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { MissionTasks } from '@luvani/core';
import { paper, colour, space, type } from '../theme.ts';
import { CheckGlyph } from '../components.tsx';

/** Quiet, session-local goal observations; uncertainty stays unticked. */
export function MissionTaskList({ items }: { items: MissionTasks['items'] }) {
  if (items.length === 0) return null;
  return (
    <ScrollView style={{ flexGrow: 0, maxHeight: 104 }} contentContainerStyle={{ gap: space(1), paddingVertical: space(2) }}>
      {items.map(item => (
        <View key={item.id} accessible accessibilityLabel={`${item.goalEn}. ${item.achieved ? 'Achieved in this conversation' : 'To practise'}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <View importantForAccessibility="no" style={{ width: 20, height: 20, borderRadius: 10,
            backgroundColor: item.achieved ? colour.mint : paper.card, borderWidth: 1,
            borderColor: item.achieved ? colour.mint : paper.line, alignItems: 'center', justifyContent: 'center' }}>
            {item.achieved ? <CheckGlyph size={14} color={paper.ink} /> : null}
          </View>
          <Text style={[type.small, { color: paper.ink, flex: 1 }]}>{item.goalEn}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
