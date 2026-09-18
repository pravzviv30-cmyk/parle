/**
 * The Tutor landing page — a calm moment before a live conversation.
 *
 * One circle and four rows. The circle is the way into an open conversation and
 * is the only thing on the page that moves; the first row is what the tutor
 * remembers, and the three under it are the ways in the founder's brief names:
 * an everyday mission, an open chat, rehearsing something of your own.
 *
 * Revamp A took a contents page off this tab. There were six door cards, a fold
 * that opened onto every situation, a scene to pick back up, the scripted
 * lesson and two quiet links, and a learner arriving to speak French met a
 * menu. None of it was deleted: the scene to pick back up is Home's hero, every
 * situation is on the chooser the everyday row opens, the scripted lesson is a
 * door at the foot of that chooser, and the explainer moved to Settings.
 *
 * Which rows there are and what they say is `tutor/gate.ts`; the header and the
 * line under the circle are `tutor/dashboard.ts`; what the remembers row says
 * and where it goes is `tutor/dashboard.ts` too. This file draws them and
 * decides nothing, which is the only way a screen in this workspace can be
 * checked at all: there is no renderer here.
 */

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { missionStates } from '@luvani/core';

import { Card, GhostButton, Label, OutlineButton, TintRow } from '../components.tsx';
import { ChatGlyph, CoffeeCupGlyph, DocumentGlyph } from '../glyphs.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { fetchBillingStatus } from '../purchases/client.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { loadPackMarks } from '../conversationPacks/marks.ts';
import { loadTopics } from '../topics/store.ts';
import { capabilitiesFor, type PlanTier } from '../purchases/capabilities.ts';
import { threadFrom, type Thread } from '../tutor/threads.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { MICROPHONE_NOTICE, missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadScenarioProgress } from '../missions/progressStore.ts';
import { settleIn, useReduceMotion } from '../motion.ts';
import { loadDeck } from '../review/store.ts';
import { accent, HIT, paper, space, type } from '../theme.ts';
import { TUTOR_PURPOSE, tutorHeading } from '../tutor/dashboard.ts';
import { tutorOrbState } from '../tutor/orbState.ts';
import { DOOR_TINT } from '../tutor/doorTint.ts';
import {
  ENTRY_MODES_LABEL,
  TUTOR_OFFLINE,
  entryStart,
  tutorDoors,
  tutorGate,
  type EntryModeKey,
} from '../tutor/gate.ts';
import { ContinuityCard } from '../tutor/ContinuityCard.tsx';
import { continuityFrom, continuityHeadline, type Continuity } from '../tutor/continuity.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { VoiceOrb } from '../tutor/VoiceOrb.tsx';

/**
 * The three rows, built once.
 *
 * `tutorDoors()` takes no arguments and reads nothing, so there is nothing for
 * a memo to depend on and nothing for a render to rebuild. It used to be asked
 * for the resumable scene, the size of the catalogue and a lesson title, and
 * every one of those has left this tab.
 */
const DOORS = tutorDoors();

/** UI 4's focal control, softened and kept comfortably inside a phone width. */
const TUTOR_ORB_SIZE = 218;

/** One line-art mark per way in, in the violet that means identity. */
const GLYPH: Record<EntryModeKey, ReactNode> = {
  everyday: <CoffeeCupGlyph color={accent.primary} />,
  free: <ChatGlyph color={accent.primary} />,
  rehearse: <DocumentGlyph color={accent.primary} />,
};

export function TutorTab() {
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { live, recheck } = useLive();
  const { profile } = useProfile();
  const tutorName = tutorNameOf(profile);
  const reduced = useReduceMotion();
  const entry = useRef(new Animated.Value(0)).current;

  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  /** What the tutor remembers, from a real record only, or null. */
  const [continuity, setContinuity] = useState<Continuity | null>(null);
  /** The one thread to pick up, or null. */
  const [thread, setThread] = useState<Thread | null>(null);
  /** The plan the server answered, for the one row that is the plan's. */
  const [plan, setPlan] = useState<{ tier: PlanTier; lapsed: boolean }>({ tier: 'unknown', lapsed: false });
  // Core's answer to "may a session start", read from the server on focus, or
  // null when nobody could ask. The circle reads it through `tutor/orbState.ts`
  // and a null reads as ready there on purpose: the server refuses a start it
  // cannot afford, and a circle that went quiet because a status read failed
  // would refuse a learner the server would have let in.
  const [canStart, setCanStart] = useState<boolean | null>(null);
  const { user } = useAuth();

  // The page settles in when the tab is opened. The voice orb carries its own
  // slower breathing loop; this is only the page arriving, and it lands on the
  // final frame immediately for learners who reduce motion.
  useEffect(() => {
    if (!focused) return;
    entry.setValue(0);
    const animation = settleIn(entry, reduced);
    return () => animation?.stop();
  }, [entry, focused, reduced]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadMissionCompletions(), loadDeck(), loadScenarioProgress(), loadConversationPacks(), loadPackMarks(), loadTopics()])
        .then(([completions, deck, scenes, packs, marks, topics]) => {
          if (cancelled) return;
          // One projection of where every scene stands, handed to the memory
          // line and to the thread, so the two cannot disagree.
          const progress = missionStates(missionCompletionsFrom(completions), deck, Date.now());
          setContinuity(continuityFrom({ brain: profile.brain, packs, records: scenes, progress }));
          setThread(threadFrom({ records: scenes, progress, packs, marks, topics }));
        })
        // A disk that will not answer takes the remembers row with it and
        // nothing else. The circle and the three ways in are all on this page
        // without reading anything, so the tab stays a way into French rather
        // than becoming a message about storage. Nothing is cleared here on
        // purpose: a re-read that failed is not evidence that the thread the
        // learner walked away from is gone.
        //
        // `.catch` at the end of the chain rather than a second argument to
        // `.then`, because a throw inside the handler above rejects the promise
        // `.then` returns and an onRejected passed alongside it never sees it.
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [profile]),
  );

  /**
   * The conversation, probed before it opens.
   *
   * The rejection path is the whole reason this is not three lines. `checking`
   * disables the circle, every row and the quiet link at the foot, so a probe
   * that ever threw would not fail one tap: it would retire the tab for the
   * rest of the session with nothing on screen saying why.
   *
   * `.catch` at the end of the chain rather than a second argument to `.then`,
   * because a throw inside the fulfilment handler rejects the promise `.then`
   * returns and an onRejected passed beside it never sees that throw. The
   * handler navigates, so it is a real thrower.
   */
  const open = (textMode: boolean) => {
    // A second tap while the connection check runs cannot open a second room.
    if (checking) return;
    setChecking(true);
    void recheck()
      .then((answered) => {
        setChecking(false);
        const decision = tutorGate(answered, textMode);
        if (!decision.go) {
          setHeldBack(decision.heldBack);
          return;
        }
        setHeldBack(null);
        nav.navigate(decision.screen, decision.params);
      })
      .catch(() => {
        // A probe that threw is a probe that did not answer, so the start is
        // held back rather than lost: the flag goes down, the tab is live
        // again, and the retry is the same start the learner asked for.
        setChecking(false);
        setHeldBack({ textMode });
      });
  };

  // The plan, on its own read. Not folded into the storage effect above,
  // because that effect's rejection path is pinned to the disk: a status the
  // server would not give must not look like a thread the learner lost.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!live || user === null) return;
      void fetchBillingStatus(user.id)
        .then((status) => {
          if (cancelled) return;
          setCanStart(status === null ? null : status.canStart);
          setPlan(status === null ? { tier: 'unknown', lapsed: false } : { tier: status.plan, lapsed: status.lapsed });
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [live, user]),
  );

  const orb = tutorOrbState({ live, checking, canStart });

  // Where a row leads is `gate.ts`'s answer, not this screen's. The open chat
  // runs the same probe the circle runs, because it opens the same room; the
  // other two push a screen that needs no server at all.
  const enter = (key: EntryModeKey) => {
    const start = entryStart(key);
    if (start.probe) {
      open(false);
      return;
    }
    nav.navigate(start.screen);
  };

  const entryStyle = {
    opacity: entry,
    transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };

  return (
    <ScrollScreen bottom="tab">
      <Animated.View style={entryStyle}>
        <TabHeader title={tutorHeading(tutorName)} purpose={TUTOR_PURPOSE} />

        {/* No card behind it. The circle is the page's one focal point, and a
            white rectangle around it would be a second edge competing with the
            one shape that matters. The short state sits directly in the mist;
            only a longer non-ready explanation is allowed underneath. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Start a spoken conversation with ${tutorName}`}
          accessibilityHint="Opens a conversation when the connection is ready"
          disabled={checking}
          onPress={() => open(false)}
          style={({ pressed }) => [st.orb, pressed && !checking && st.pressed]}
        >
          <VoiceOrb
            state={orb.state}
            size={TUTOR_ORB_SIZE}
            announce={false}
            withCaption={false}
            paused={!focused}
            embeddedLabel={orb.title}
          />
          {orb.state !== 'ready' && <Text style={st.orbSubline}>{orb.subline}</Text>}
        </Pressable>

        {checking && <Text accessibilityLiveRegion="polite" style={st.checking}>{TUTOR_OFFLINE.checking}</Text>}

        {!live && (
          <Card style={st.offline}>
            <Label>{TUTOR_OFFLINE.label}</Label>
            <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{TUTOR_OFFLINE.headline}</Text>
            {heldBack !== null && (
              <>
                <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{TUTOR_OFFLINE.body}</Text>
                <View style={{ marginTop: space(3) }}>
                  <OutlineButton label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} disabled={checking} onPress={() => open(heldBack.textMode)} />
                </View>
              </>
            )}
          </Card>
        )}

        {/* What the tutor remembers, from a real record only. Absent for a
            learner with nothing behind them, because the fold answers null. */}
        {continuity !== null && (
          <View style={st.remembers}>
            <ContinuityCard
              headline={continuityHeadline(tutorName)}
              line={continuity.line}
              thread={thread}
              continueAllowed={capabilitiesFor(plan.tier, plan.lapsed).continueArc}
              disabled={checking}
              onPress={(route) => {
                // Carry the pack's identity into the room instead of retiring
                // it on this tap. ConvoScreen writes the mark only after the
                // first live view arrives, so an offline gate or failed join
                // leaves the remembered thread exactly where it was.
                if (route.screen === 'Convo' && route.markPack !== null) {
                  nav.navigate(route.screen, { ...route.params, continuationPackId: route.markPack });
                  return;
                }
                nav.navigate(route.screen, route.params);
              }}
            />
          </View>
        )}

        {/* The three ways in, as rows under one heading. A row that opens a
            screen says so with a chevron; none of them is a button, because
            the circle above is the tab's one primary action. */}
        <View style={st.doors}>
          <Label>{ENTRY_MODES_LABEL}</Label>
          {DOORS.map((door) => (
            <View key={door.key} style={st.row}>
              <TintRow
                tint={DOOR_TINT[door.key]}
                glyph={GLYPH[door.key]}
                title={door.label}
                gloss={door.gloss}
                disabled={checking}
                onPress={() => enter(door.key)}
              />
            </View>
          ))}
        </View>

        <View style={st.quiet}>
          <GhostButton label="Unable to speak right now?" disabled={checking} onPress={() => open(true)} />
          <Text style={st.notice}>{MICROPHONE_NOTICE}</Text>
        </View>
      </Animated.View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  orb: { alignItems: 'center', alignSelf: 'center', minWidth: TUTOR_ORB_SIZE, minHeight: TUTOR_ORB_SIZE, paddingVertical: space(1) },
  pressed: { transform: [{ scale: 0.985 }, { translateY: 1 }] },
  orbSubline: { ...type.small, color: paper.inkSoft, marginTop: space(1), textAlign: 'center' },
  checking: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  offline: { marginTop: space(4) },
  // The remembers row stands on its own above the heading, so it carries the
  // gap the list below gets from its container.
  remembers: { marginTop: space(5), minHeight: HIT },
  doors: { marginTop: space(5), gap: space(2) },
  // The touch floor, declared where the row is placed rather than left to the
  // component that draws it. A row this tab hands to `TintRow` can never fall
  // under 44pt, whatever a future restyle does to the shared one.
  row: { minHeight: HIT },
  quiet: { marginTop: space(6), gap: space(1) },
  notice: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
});
