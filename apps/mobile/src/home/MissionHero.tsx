/**
 * Tonight's French: the one situation Home leads with, drawn (F543, F544).
 *
 * The card draws what `home/homeMission.ts` decided and decides nothing: the
 * kind of offer as its caps line, the scene's French title in the serif, its
 * English name, what the learner will be able to do, why this scene, the
 * tutor's one line of memory when there is a real one, how long it takes, and
 * the tab's one pill. It sits on the tint of the place the scene happens in,
 * the way a situation row on My French does, so a screen names a place and
 * never a colour.
 *
 * The start is the gate's, in the F154 shape the situation card already keeps:
 * one probe in flight at a time, the learner told it is running, a refusal
 * answered on the card with the same start offered again. The conversation
 * opens on the scene directly rather than through the chooser, which is what
 * My French already does with its own pill, and the start is recorded as the
 * chooser records its own.
 *
 * Every word on the tint is ink. The softer inks are held to the ground and
 * the card, and nothing here has checked them against six tints.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { trackProductEvent } from '../analytics/track.ts';
import { useLive } from '../app/LiveContext.tsx';
import { Label, MicGlyph, OutlineButton, PillButton, TintPanel, fitDisplay } from '../components.tsx';
import { MissionDisc } from '../missions/MissionDisc.tsx';
import { missionTint } from '../missions/missionTint.ts';
import { paper, space, type } from '../theme.ts';
import { TUTOR_OFFLINE, tutorGate } from '../tutor/gate.ts';
import { START_CONVERSATION, type HomeMission } from './homeMission.ts';

export function MissionHero({ hero, continuity }: { hero: HomeMission; continuity: string | null }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { recheck } = useLive();
  const [checking, setChecking] = useState(false);
  /** The start that did not happen, so the retry is the same start. */
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);

  const open = () => {
    // A second tap while the connection check runs cannot open a second room.
    if (checking) return;
    setChecking(true);
    void recheck().then((answered) => {
      setChecking(false);
      const decision = tutorGate(answered, false);
      if (!decision.go) {
        setHeldBack(decision.heldBack);
        return;
      }
      setHeldBack(null);
      void trackProductEvent({ name: 'mission_started', properties: { missionId: hero.mission.id, entry: 'home' } });
      nav.navigate(decision.screen, { ...decision.params, missionId: hero.mission.id });
    }).catch(() => {
      // At the end of the chain rather than beside the handler, so a throw from
      // the navigation above is caught too. The start is kept, so the retry is
      // the same start rather than a guess at what they were doing.
      setChecking(false);
      setHeldBack({ textMode: false });
    });
  };

  return (
    <TintPanel tint={missionTint(hero.mission.place)} style={st.panel}>
      <View style={st.head}>
        <View style={st.words}>
          <Label>{hero.label}</Label>
          <Text style={[fitDisplay(hero.mission.title), st.title]}>{hero.mission.title}</Text>
          <Text style={st.titleEn}>{hero.mission.titleEn}</Text>
        </View>
        <MissionDisc place={hero.mission.place} size={72} />
      </View>

      <Text style={st.goal}>{hero.mission.goalEn}</Text>
      <Text style={st.line}>{hero.reason}</Text>
      {continuity !== null && <Text style={st.line}>{continuity}</Text>}
      <Text style={st.time}>{hero.timeLine}</Text>

      <View style={st.action}>
        <PillButton
          label={START_CONVERSATION}
          icon={<MicGlyph size={20} color={paper.onInk} />}
          disabled={checking}
          onPress={open}
        />
      </View>

      {checking && (
        <Text accessibilityLiveRegion="polite" style={st.checking}>
          {TUTOR_OFFLINE.checking}
        </Text>
      )}

      {/* Held back, not broken. The learner asked, the answer is in, and the
          way forward is the same start again rather than a smaller one. */}
      {heldBack !== null && (
        <View style={st.offline}>
          <Text style={st.offlineBody}>{TUTOR_OFFLINE.body}</Text>
          <OutlineButton
            label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry}
            disabled={checking}
            onPress={open}
          />
        </View>
      )}
    </TintPanel>
  );
}

const st = StyleSheet.create({
  panel: { marginTop: space(5), padding: space(4) },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  // The words take what is left and can shrink, so a long French title wraps
  // beside the disc instead of pushing it off the screen at large text.
  words: { flex: 1, minWidth: 0 },
  title: { color: paper.ink, marginTop: space(2) },
  titleEn: { ...type.body, color: paper.ink, marginTop: space(1) },
  goal: { ...type.body, color: paper.ink, marginTop: space(3) },
  line: { ...type.small, color: paper.ink, marginTop: space(2) },
  time: { ...type.small, color: paper.ink, marginTop: space(2) },
  action: { marginTop: space(4) },
  checking: { ...type.small, color: paper.ink, textAlign: 'center', marginTop: space(2) },
  offline: { marginTop: space(3), gap: space(3) },
  offlineBody: { ...type.body, color: paper.ink },
});
