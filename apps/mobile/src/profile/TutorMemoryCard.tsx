/**
 * What the tutor remembers, on Profile (F562).
 *
 * One card in the French life block: the tutor's name over one sentence in
 * words about how much is held, and a row into the screen where each fact can
 * be seen and forgotten and a goal written. Every word is `tutorMemory.ts`'s
 * and the facts are read through `memory.ts`, so this file draws and decides
 * nothing. It reads the live profile from context rather than the disk: a
 * forget made on the screen is visible here the moment the learner comes back.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { SettingsRow } from '../settings/SettingsRow.tsx';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { MEMORY_ROW, MEMORY_ROW_SUB, memoryLabel, memorySummary } from './tutorMemory.ts';

export function TutorMemoryCard() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();
  const name = tutorNameOf(profile);
  return (
    <Card style={st.card}>
      <Label>{memoryLabel(name)}</Label>
      <Text style={st.summary}>{memorySummary(profile, name)}</Text>
      <View style={st.rows}>
        <SettingsRow first label={MEMORY_ROW} value={MEMORY_ROW_SUB} onPress={() => nav.navigate('TutorMemory')} />
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(2.5) },
  summary: { ...type.body, color: paper.ink, marginTop: space(2) },
  rows: { marginTop: space(3) },
});
