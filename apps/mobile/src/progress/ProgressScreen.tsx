/** The former Progress destination is now an expandable section on Home. */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GhostButton, Label, TintPanel, TintRow } from '../components.tsx';
import { PlaceGlyph } from '../glyphs.tsx';
import { accent, paper, space, type } from '../theme.ts';
import { missionTint } from '../missions/missionTint.ts';
import { hasStory, type WeekStory } from './story.ts';
import { CAN_DO_LABEL, POSTCARD_TITLE, POSTCARD_NOTE, hasCanDo, type CanDoRow } from './progressView.ts';
import { REFLECTION_COPY, hasReflection, type Reflection } from './reflection.ts';

export function HomeProgressDetails({ story, rows, reflection }: { story: WeekStory | null; rows: readonly CanDoRow[] | null; reflection: Reflection | null }) {
  const [expanded, setExpanded] = useState(false);
  const nav = useNavigation<{ navigate: (screen: string, params: object) => void }>();
  const hasWeek = story !== null && hasStory(story);
  const hasAbilities = rows !== null && hasCanDo(rows);
  // Stage 4: one improvement, one focus, one next place, or nothing at all.
  const hasWeekly = reflection !== null && hasReflection(reflection);
  if (!hasWeek && !hasAbilities && !hasWeekly) return null;
  return <View style={{ marginTop: space(2) }}>
    <GhostButton label={expanded ? 'Hide my weekly story' : 'My weekly story & what I can do'} onPress={() => setExpanded(v => !v)} />
    {expanded && <View style={{ gap: space(3), marginTop: space(2) }}>
      {hasWeek && <TintPanel tint="lilac" style={{ padding: space(4) }}>
        <Text style={[type.cardTitle, { color: paper.ink }]}>{POSTCARD_TITLE}</Text>
        <Text style={[type.small, { color: paper.inkSoft, marginVertical: space(2) }]}>{POSTCARD_NOTE}</Text>
        {story.sentences.map(sentence => <Text key={sentence} style={[type.body, { color: paper.ink, marginTop: space(2) }]}>{sentence}</Text>)}
      </TintPanel>}
      {hasWeekly && <View style={{ gap: space(2) }}>
        <Label>{REFLECTION_COPY.label}</Label>
        {reflection.improvement !== null && <View>
          <Text style={[type.small, { color: paper.inkSoft }]}>{REFLECTION_COPY.improvement}</Text>
          <Text style={[type.body, { color: paper.ink }]}>{reflection.improvement}</Text>
        </View>}
        {reflection.focus !== null && <View>
          <Text style={[type.small, { color: paper.inkSoft }]}>{REFLECTION_COPY.focus}</Text>
          <Text style={[type.body, { color: paper.ink }]}>{reflection.focus}</Text>
        </View>}
        {reflection.next !== null && <TintRow tint={missionTint(reflection.next.place)} glyph={<PlaceGlyph place={reflection.next.place} color={accent.primary} />} title={reflection.next.title} gloss={REFLECTION_COPY.next} onPress={() => nav.navigate('Convo', { missionId: reflection.next!.missionId })} />}
      </View>}
      {hasAbilities && <View style={{ gap: space(2) }}><Label>{CAN_DO_LABEL}</Label>
        {rows.map(row => <TintRow key={row.missionId} tint={missionTint(row.place)} glyph={<PlaceGlyph place={row.place} color={accent.primary} />} title={row.title} onPress={() => nav.navigate('Convo', { missionId: row.missionId })} />)}
      </View>}
    </View>}
  </View>;
}
