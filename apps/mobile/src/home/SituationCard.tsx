/**
 * Today's situation, and the one way into a spoken conversation from Home.
 *
 * The scene is `dailyPick(DAILY_SCENARIOS, now)`, chosen by the day and never
 * stored, so this card is handed its subject and picks nothing. What it does
 * own is the door: the pill runs the same gate the Tutor tab runs, in the same
 * order, with the same words on the way back.
 *
 * ## Why the gate is copied rather than invented
 *
 * `tutorGate` is the only place that decides whether a start starts anything,
 * and `TUTOR_OFFLINE` is the only place the answer is worded. Two surfaces
 * saying different things about one dead server is how a learner stops
 * believing either of them, so this reads `TutorTab`'s `open()` shape line for
 * line: refuse a second tap while the probe is in flight, `recheck()`, ask
 * `tutorGate`, and either navigate or keep the held-back start so the retry can
 * be the same start rather than a guess.
 *
 * The one difference is the seed topic. `seedTopicOf` turns the scenario into
 * the two plain strings the token server already carries, so the tutor opens on
 * this scene without anything new being taught to the agent.
 *
 * ## What the founder took off this card
 *
 * No "Listen to accent", no "Immersive audio" and no level pill. The removals
 * are named in `tabs/HomeTab.test.ts` so putting one back fails by name rather
 * than drifting back in. What is left is two controls: the quiet one saves the
 * scene into My French, and the loud one opens the conversation.
 *
 * The demo label went with them, and it is the interesting one. It reported a
 * server state on the first screen of the app, to a learner who had not asked
 * about a server and could do nothing with the answer, and it did it before
 * they had tried anything. The honest signal is the one below: the learner taps
 * Start oral session, sees the probe run, and gets the module's own sentence
 * about why it could not open along with the way to try again. That path is
 * pinned by F392 and none of it moved. A badge is not a signal; an answer to a
 * tap is.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { seedTopicOf, type DailyScenario } from '@luvani/core';

import { BookmarkGlyph, Card, Label, MicGlyph, OutlineButton, PillButton } from '../components.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { bookmarkAccessibilityLabel, bookmarkLabel } from '../bookmarks/view.ts';
import { MissionDisc } from '../missions/MissionDisc.tsx';
import { paper, radius, space, type } from '../theme.ts';
import { TUTOR_OFFLINE, tutorGate } from '../tutor/gate.ts';

export function SituationCard({
  scenario,
  saved,
  onToggleBookmark,
}: {
  scenario: DailyScenario;
  /** Whether the learner has this scene saved. Decided in `bookmarks/view.ts`. */
  saved: boolean;
  onToggleBookmark: () => void;
}) {
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
      nav.navigate(decision.screen, { ...decision.params, seedTopic: seedTopicOf(scenario) });
    });
  };

  return (
    <Card style={st.card}>
      {/* The eyebrow, and it says one thing: what this card is. */}
      <View style={st.eyebrow}>
        <View style={st.eyebrowWords}>
          <Label>{"Today's situation"}</Label>
        </View>
      </View>

      <Text style={st.title}>{scenario.titleEn}</Text>
      <Text style={st.body}>{scenario.bodyEn}</Text>

      {/* The first thing the learner could say, on the page's own paper so it
          reads as something lifted out of the card rather than another line of
          it. Spoken and written: the tutor will say this, and it is here. */}
      <View style={st.inset}>
        <MissionDisc place={scenario.place} size={48} />
        <View style={st.insetWords}>
          <Label>Starting line</Label>
          <Text style={st.openingFr}>{scenario.openingFr}</Text>
          <Text style={st.openingEn}>{scenario.openingEn}</Text>
        </View>
      </View>

      <View style={st.actions}>
        {/* Not disabled while the probe runs: saving a scene to come back to
            has nothing to do with whether a server answered. */}
        <OutlineButton
          label={bookmarkLabel(saved)}
          accessibilityLabel={bookmarkAccessibilityLabel(saved, scenario.titleEn)}
          icon={<BookmarkGlyph />}
          onPress={onToggleBookmark}
        />
        <PillButton
          label="Start oral session"
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
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(5) },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  eyebrowWords: { flex: 1, minWidth: 0 },
  // English, in the serif. The French of this scene is the starting line below.
  title: { ...type.title, color: paper.ink, marginTop: space(2) },
  body: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  inset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    marginTop: space(4),
    padding: space(3),
    backgroundColor: paper.ground,
    borderRadius: radius.chip,
  },
  insetWords: { flex: 1, minWidth: 0 },
  openingFr: { ...type.french, color: paper.ink, marginTop: space(1) },
  openingEn: { ...type.small, color: paper.inkSoft, marginTop: space(1) },
  actions: { marginTop: space(4), gap: space(2) },
  checking: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  offline: { marginTop: space(3), gap: space(3) },
  offlineBody: { ...type.body, color: paper.ink },
});
