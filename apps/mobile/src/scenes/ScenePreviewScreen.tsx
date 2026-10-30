/**
 * Scene preview (2026-10-20 UI-008, artboard B-ScenePreview), in light and
 * dark: the yellow band (heroGround, radius 0 0 36 36) with the back button
 * and the scene's canvas drawing, the goal row with its mint tick, the opener
 * card, the lines with a hear button each, the 56pt Start with the tutor, the
 * 48pt white practice button and the note line.
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
import { Card, PillButton, RoundButton } from '../components.tsx';
import { ScreenHeader, ScrollScreen, TopInset } from '../layout.tsx';
import { bType, frenchText, space, type, HIT } from '../theme.ts';
import { BArt } from '../art/BArt.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BButton, BMic, CheckDisc } from '../today/TodayParts.tsx';
import { HearButton } from '../explore/ExploreParts.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { roleLine } from '../live/roleLine.ts';
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
  const t = useB();
  const st = useThemedStyles(makeStyles);
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
          <Text accessibilityRole="header" style={[type.heading, { color: t.text }]}>{PREVIEW_COPY.missingTitle}</Text>
          <Text style={[type.body, { color: t.text }]}>{PREVIEW_COPY.missingBody}</Text>
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

  const lineRow = (line: PreviewLine, index: number, all: readonly PreviewLine[], big = false) => {
    const asset = assetOf(line);
    const label = soundLabel(line.sound, asset !== undefined, sound.deviceFrench);
    return (
      <View key={line.fr} style={[st.line, index < all.length - 1 && st.divider]}>
        <View style={st.lineWords}>
          <Text {...frenchText} style={[big ? bType.bold18 : bType.bold16, { color: t.text }]}>{line.fr}</Text>
          {line.en !== null && <Text style={[big ? bType.meta : bType.note, { color: t.muted }]}>{line.en}</Text>}
        </View>
        {(asset !== undefined || sound.deviceFrench) && (
          <HearButton label={`Hear it. ${label}`} onPress={() => void sound.hear(line.fr, asset)} />
        )}
      </View>
    );
  };

  return (
    // The band is full bleed under the status bar, square at the top and
    // rounded 36 at the foot, with the back button inside it.
    <ScrollScreen bottom="inset" padded={false} bleedTop>
      <View style={st.band}>
        <TopInset />
        <BArt name={model.art} width={150} height={137} style={st.bandArt} />
        <View style={st.bandTop}>
          <RoundButton kind="back" onPress={back} accessibilityLabel="Back" />
        </View>
        <Text style={[bType.chip, st.eyebrow, { color: t.heroText }]}>{model.eyebrow}</Text>
        <Text accessibilityRole="header" style={[bType.bandTitle, st.bandWords, { color: t.heroText }]}>{model.titleEn}</Text>
        {/* French stays upright (DESIGN.md): the artboard's italic is not taken. */}
        <Text {...frenchText} style={[bType.line16, st.bandWords, { color: t.heroText }]}>{model.titleFr}</Text>
        <View style={st.pills}>
          {[minutesLine(model.minutes), PREVIEW_COPY.liveChip, ...(accessLabel !== null ? [accessLabel] : [])].map(pill => (
            <View key={pill} style={st.pill}><Text style={[bType.chip, { color: t.heroText }]}>{pill}</Text></View>
          ))}
        </View>
      </View>

      <View style={st.body}>
        <View style={st.goal}>
          <CheckDisc size={36} fill={t.mint} tick={t.onMint} />
          <View style={st.goalWords}>
            <Text style={[bType.chip, { color: t.muted }]}>{PREVIEW_COPY.practiseHeading}</Text>
            <Text style={[bType.bold18, st.goalLine, { color: t.text }]}>{model.practise}</Text>
            {model.part !== null && <Text style={[bType.meta, { color: t.muted }]}>{roleLine(tutorName, model.part)}</Text>}
          </View>
        </View>

        {model.opener !== null && <View style={st.section}>
          <Text accessibilityRole="header" style={[bType.section19, { color: t.text }]}>{model.opener.heading}</Text>
          <View style={st.opener}>{lineRow(model.opener.line, 0, [model.opener.line], true)}</View>
        </View>}

        {model.lines.length > 0 && (
          <View style={st.section}>
            <View style={st.headWords}>
              <Text accessibilityRole="header" style={[bType.section19, { color: t.text }]}>{PREVIEW_COPY.linesHeading}</Text>
              <Text style={[bType.meta, { color: t.muted }]}>{PREVIEW_COPY.linesSub}</Text>
            </View>
            <View style={st.list}>{model.lines.map((line, index, all) => lineRow(line, index, all))}</View>
          </View>
        )}

        <View style={st.actions}>
          <BButton label={startLabel(tutorName)} height={56} ground={t.primary} ink={t.onPrimary} text={bType.bold18} icon={<BMic size={20} color={t.onPrimary} />} disabled={busy} onPress={start} />
          {model.practice !== null && (
            <BButton label={model.practice.label} height={48} ground={t.card} ink={t.text} text={bType.bold16} onPress={() => { const target = model.practice!; nav.navigate(target.screen, target.params); }} />
          )}
          <Text style={[bType.note, st.centre, { color: t.muted }]}>{PREVIEW_COPY.footnote}</Text>
          {access.error !== null && <Text accessibilityLiveRegion="polite" style={[bType.meta, { color: t.text }]}>{access.error}</Text>}
          {conversation.failed && <Text accessibilityLiveRegion="polite" style={[bType.meta, { color: t.text }]}>Your tutor could not connect. You can practise the lines now, or try again when you are connected.</Text>}
        </View>
      </View>
    </ScrollScreen>
  );
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    stack: { gap: space(2.5) },
    // Edge to edge: square at the top, 36 at the foot only; padding 58 22 22 less the status bar the inset pays.
    band: { backgroundColor: t.heroGround, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, paddingHorizontal: 22, paddingBottom: 22, gap: 10, overflow: 'hidden' },
    bandArt: { position: 'absolute', right: -6, top: 70 },
    bandTop: { flexDirection: 'row', minHeight: HIT, marginTop: 4 },
    eyebrow: { marginTop: 6 },
    bandWords: { maxWidth: 200 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    pill: { backgroundColor: t.heroChip, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
    // The page gutter the frame no longer adds, so the band can reach the edges.
    body: { gap: 22, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 40 },
    goal: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    goalWords: { flex: 1, minWidth: 0, gap: 2 },
    goalLine: { lineHeight: 23 },
    section: { gap: 10 },
    headWords: { gap: 2 },
    opener: { backgroundColor: t.card, borderRadius: 20, paddingVertical: 2, paddingHorizontal: 16 },
    list: { backgroundColor: t.card, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 16 },
    line: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    divider: { borderBottomWidth: 1, borderBottomColor: t.line },
    lineWords: { flex: 1, minWidth: 0, gap: 2 },
    actions: { gap: 8 },
    centre: { textAlign: 'center' },
  });
