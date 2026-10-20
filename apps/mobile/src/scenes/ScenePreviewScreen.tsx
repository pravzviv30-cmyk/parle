/**
 * Scene preview (B1, 2026-10-20, artboard B-ScenePreview).
 *
 * What a scene is before it starts: its topic and stage, the English and
 * French titles, the minutes, what you'll practise, the first line, and the
 * lines you'll likely need with a way to hear each. Every decision is
 * `scenePreview.ts`'s; this file is layout.
 *
 * The one primary is the start, through `useConversationStart`, which keeps
 * its own gate; a daily scene that is not a free sample goes through the same
 * Explore access check the collection screen uses. Practising the lines is the
 * free, quiet secondary. It reads no plan table and no continue arc.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { seedTopicOf, DAILY_SCENARIOS } from '@luvani/core';
import { Card, Chip, ColourCard, IconAction, Ledger, PillButton, RoundButton } from '../components.tsx';
import { ScreenHeader, ScrollScreen, TopInset } from '../layout.tsx';
import { frenchText, onColour, paper, space, textOn, type, HIT } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { dailyTutorVoice, tutorAudioFor } from '../daily/tutorAudio.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { TUTOR_LINE_AUDIO } from '../onboarding/tutorLineAudio.ts';
import { minutesLine } from '../home/estimate.ts';
import { useConversationStart } from '../main/useConversationStart.ts';
import { useExploreAccess } from '../purchases/useExploreAccess.ts';
import { PREVIEW_COPY, scenePreview, soundLabel, startLabel, type PreviewLine } from './scenePreview.ts';
import { useHear } from './useHear.ts';

export const SCENE_PREVIEW_TITLE = 'Scene preview';

export function ScenePreviewScreen() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void; goBack: () => void; canGoBack: () => boolean }>();
  const route = useRoute();
  const id = (route.params as { missionId?: unknown } | undefined)?.missionId;
  const { profile } = useProfile();
  const voice = dailyTutorVoice(profile.tutorVoice);
  const tutorName = tutorNameOf(profile);
  const conversation = useConversationStart();
  const access = useExploreAccess();
  const sound = useHear();
  const back = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs'));
  const header = <ScreenHeader back={{ onPress: back }} />;
  const model = scenePreview(id, { audio: TUTOR_DAILY_AUDIO, voice });

  if (model === null) {
    return (
      <ScrollScreen bottom="inset" header={header}>
        <Card style={st.stack}>
          <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{PREVIEW_COPY.missingTitle}</Text>
          <Text style={[type.body, { color: paper.ink }]}>{PREVIEW_COPY.missingBody}</Text>
          <PillButton label={PREVIEW_COPY.missingAction} onPress={() => nav.navigate('Tabs', { screen: 'Explore' })} />
        </Card>
      </ScrollScreen>
    );
  }

  const assetOf = (line: PreviewLine): number | undefined =>
    line.sound.kind === 'clip' ? tutorAudioFor(TUTOR_DAILY_AUDIO, line.sound.id, voice)
      : line.sound.kind === 'opener' ? TUTOR_LINE_AUDIO[line.sound.id]
      : undefined;
  const accessLabel = model.kind === 'scenario' ? access.label({ kind: 'scenario', id: model.id }) : null;
  const busy = access.checking || conversation.checking;
  const start = () => {
    if (model.kind === 'mission') { conversation.start({ missionId: model.id }); return; }
    const source = DAILY_SCENARIOS.find((s) => s.id === model.id);
    if (source) void access.open({ kind: 'scenario', id: source.id }, () => conversation.start({ seedTopic: seedTopicOf(source) }));
  };

  const lineRow = (line: PreviewLine) => {
    const asset = assetOf(line);
    const label = soundLabel(line.sound, asset !== undefined, sound.deviceFrench);
    return (
      <View key={line.fr} style={st.line}>
        <View style={st.lineWords}>
          <Text {...frenchText} style={[type.frenchSm, { color: paper.ink }]}>{line.fr}</Text>
          {line.en !== null && <Text style={[type.small, { color: paper.inkSoft }]}>{line.en}</Text>}
          <Text style={[type.caption, { color: paper.inkSoft }]}>{label}</Text>
        </View>
        {(asset !== undefined || sound.deviceFrench) && (
          <IconAction layout="inline" icon="speaker" label="Hear" accessibilityLabel={`Hear it. ${label}`} onPress={() => void sound.hear(line.fr, asset)} />
        )}
      </View>
    );
  };

  return (
    // 2026-10-20, sim nits: the hero is a full-bleed sun band (B-ScenePreview),
    // under the status bar with rounded bottom corners, the back button inside it.
    <ScrollScreen bottom="inset" padded={false} bleedTop>
      <View style={st.page}>
        <ColourCard ground="sun" style={st.hero}>
          {/* The status bar's height; the card's own gap follows it. */}
          <TopInset />
          <View style={st.heroTop}>
            <RoundButton kind="back" onPress={back} accessibilityLabel="Back" />
          </View>
          <Text style={[type.eyebrow, { color: textOn.sun }]}>{model.eyebrow}</Text>
          <Text accessibilityRole="header" style={[type.title, { color: textOn.sun }]}>{model.titleEn}</Text>
          <Text {...frenchText} style={[type.french, { color: textOn.sun }]}>{model.titleFr}</Text>
          <View style={st.chips}>
            <Chip variant="meta" label={minutesLine(model.minutes)} />
            <Chip variant="meta" label={PREVIEW_COPY.liveChip} />
          </View>
          {accessLabel !== null && <Text style={[type.small, { color: onColour.sun }]}>{accessLabel}</Text>}
        </ColourCard>

        <View style={st.body}>
          <View style={st.stack}>
            <Text style={[type.small, { color: paper.inkSoft }]}>{PREVIEW_COPY.practiseHeading}</Text>
            <Text style={[type.heading, { color: paper.ink }]}>{model.practise}</Text>
          </View>

          {model.opener !== null && <View style={st.stack}>
            <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{model.opener.heading}</Text>
            <Card>{lineRow(model.opener.line)}</Card>
          </View>}

          {model.lines.length > 0 && (
            <View style={st.stack}>
              <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{PREVIEW_COPY.linesHeading}</Text>
              <Text style={[type.small, { color: paper.inkSoft }]}>{PREVIEW_COPY.linesSub}</Text>
              <Ledger>{model.lines.map(lineRow)}</Ledger>
            </View>
          )}

          <View style={st.stack}>
            <PillButton label={startLabel(tutorName)} state={busy ? 'busy' : 'idle'} onPress={start} />
            {model.practice !== null && (
              <PillButton variant="secondary" label={model.practice.label} onPress={() => { const target = model.practice!; nav.navigate(target.screen, target.params); }} />
            )}
            <Text style={[type.small, st.centre, { color: paper.inkSoft }]}>{PREVIEW_COPY.footnote}</Text>
            {access.error !== null && <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.ink }]}>{access.error}</Text>}
            {conversation.failed && <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.ink }]}>Your tutor could not connect. You can practise the lines now, or try again when you are connected.</Text>}
          </View>
        </View>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  page: { gap: space(6) },
  // Edge to edge: square at the top, the feature radius at the bottom only.
  hero: { borderTopLeftRadius: 0, borderTopRightRadius: 0, paddingTop: 0, paddingHorizontal: space(5) },
  heroTop: { flexDirection: 'row', minHeight: HIT },
  // The page gutter the frame no longer adds, so the band can reach the edges.
  body: { gap: space(6), paddingHorizontal: space(5) },
  stack: { gap: space(2.5) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  line: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  lineWords: { flex: 1, minWidth: 0, gap: space(0.5) },
  centre: { textAlign: 'center' },
});
