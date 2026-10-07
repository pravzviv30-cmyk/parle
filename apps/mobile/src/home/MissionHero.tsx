/**
 * The scene Today leads with, drawn on the blue scene brief (F543, F571,
 * notebook Phase 3, revamp B F602).
 *
 * The card draws what `home/homeMission.ts` decided and decides nothing: one
 * meta line (the label, the minutes and the tutor, joined by `sceneMeta`), the
 * French title, the English under it, what the learner will be able to do as
 * one finished sentence, one line they will say, one white Start in the
 * learner's standing mode and a quiet link to the other one ("Type instead",
 * or "Speak instead" for a learner who prefers typing). No reason line: every
 * block is a fact about this scene. A scene on the spine carries its place
 * drawing above the meta line (Phase 4, `SceneArt`), decorative and never
 * pressable.
 *
 * The Start says what Speak's Start says, from the one `launchLabel`: "Start
 * speaking" or "Start typing", or the connection check while the tutor cannot
 * be reached. Two words for one control on two tabs would be drift.
 *
 * ## What this file keeps hold of
 *
 * The start is the gate's, in the F154 shape: one probe in flight at a time,
 * the learner told it is running, a refusal answered on the card with the same
 * start (spoken or typed) offered again. A first run's Start goes straight into
 * the scene by id; the chooser is Speak's, from its path rows. And the save is a
 * write and a read back with a flag that makes the wait visible; only the day's
 * scene can be saved, for a learner who has earned the whole spine.
 *
 * ## Why the pill is spelled here rather than in SceneBrief
 *
 * `surfaceContract.test.ts` counts primary pills per screen by reading the
 * files a tab draws. The brief takes the action as a node so this file keeps
 * the literal and the one-pill rule stays checkable.
 *
 * Everything on the blue is set in the blue ground's own colours: white words,
 * the ground's secondary for the quieter lines, and never soft ink on a colour.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { trackProductEvent } from '../analytics/track.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { loadBookmarks, setBookmark, type BookmarkItem } from '../bookmarks/store.ts';
import { bookmarkControl, bookmarkDecisions, isBookmarkedIn, type BookmarkWrite } from '../bookmarks/view.ts';
import { IconAction, BookmarkGlyph, GhostButton, MicGlyph, PillButton, SceneBrief, canDoSentence } from '../components.tsx';
import { HIT, onColour, paper, space, textOn, type } from '../theme.ts';
import { TUTOR_OFFLINE, tutorGate } from '../tutor/gate.ts';
import { launchLabel } from '../tutor/orbState.ts';
import { startModes } from '../tutor/speakView.ts';
import { prefersTyping } from '../profile/typing.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { sceneMeta } from './estimate.ts';
import { heroBookmark, heroStart, type HomeMission } from './homeMission.ts';
import { SceneArt } from './SceneArt.tsx';

export function MissionHero({ hero }: { hero: HomeMission }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { live, recheck } = useLive();
  const { profile } = useProfile();
  const tutorName = tutorNameOf(profile);
  // Profile's standing "Prefer typing" decides which way the Start opens.
  const modes = startModes(prefersTyping(profile));
  const [checking, setChecking] = useState(false);
  /** The start that did not happen, so the retry is the same start. */
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  const [bookmarks, setBookmarks] = useState<readonly BookmarkItem[]>([]);
  /** Where the bookmark tap has got to: a write and a read back. */
  const [bookmarkWrite, setBookmarkWrite] = useState<BookmarkWrite>('idle');

  // Folded once per change rather than once per render.
  const decisions = useMemo(() => bookmarkDecisions(bookmarks), [bookmarks]);
  const target = heroBookmark(hero);
  const saved = target !== null && isBookmarkedIn(decisions, target.id);
  const bookmark = bookmarkControl(saved, target?.titleEn ?? hero.title, bookmarkWrite);
  // Speak's words for Speak's control: the mode, or the check while it runs.
  const label = launchLabel({ checking, live, mode: modes.mode });

  useEffect(() => {
    let cancelled = false;
    void loadBookmarks()
      .then((rows) => {
        if (!cancelled) setBookmarks(rows);
      })
      // A shelf that could not be read is not a shelf that is empty.
      .catch(() => {
        if (!cancelled) setBookmarkWrite('refused');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Save the day's scene to come back to, or take it off the shelf. */
  const toggleBookmark = (id: string, isSaved: boolean) => {
    if (bookmarkWrite === 'writing') return;
    setBookmarkWrite('writing');
    void setBookmark(id, !isSaved)
      .then(() => loadBookmarks())
      .then((rows) => {
        setBookmarks(rows);
        setBookmarkWrite('idle');
      })
      .catch(() => setBookmarkWrite('refused'));
  };

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
        const start = heroStart(hero);
        if (start.missionId !== null) {
          void trackProductEvent({ name: 'mission_started', properties: { missionId: start.missionId, entry: 'home' } });
        }
        nav.navigate(decision.screen, { ...decision.params, ...start.params });
      })
      .catch(() => {
        // At the end of the chain, so a throw from the navigation is caught
        // too. The start is kept, so the retry is the same start.
        setChecking(false);
        setHeldBack({ textMode });
      });
  };

  return (
    <SceneBrief
      meta={sceneMeta(hero.label ?? 'Next scene', hero.minutes, tutorName)}
      french={hero.french ?? undefined}
      title={hero.title}
      canDo={hero.canDo ? canDoSentence(hero.canDo) : undefined}
      line={hero.lines[0] ? { fr: hero.lines[0] } : undefined}
      note="The estimate is for this scene's steps. The live room uses minutes while open."
      art={hero.kind === 'scene' ? <SceneArt mission={hero.mission.id} /> : undefined}
      corner={
        target === null ? undefined : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={bookmark.accessibilityLabel}
            accessibilityState={{ selected: saved }}
            disabled={bookmark.busy}
            onPress={() => toggleBookmark(target.id, saved)}
            style={st.corner}
          >
            <BookmarkGlyph size={20} color={saved ? textOn.blue : onColour.blue} />
          </Pressable>
        )
      }
      action={
        <>
          <PillButton
            tone="white"
            label={label}
            accessibilityLabel={`${label}: ${hero.title}`}
            icon={<MicGlyph size={20} color={paper.ink} />}
            disabled={checking}
            onPress={() => open(modes.textMode)}
          />

          {checking && (
            <Text accessibilityLiveRegion="polite" style={st.checking}>
              {TUTOR_OFFLINE.checking}
            </Text>
          )}

          {/* Held back, not broken. The way forward is the same start again. */}
          {heldBack !== null && (
            <View style={st.offline}>
              <Text style={st.offlineBody}>{TUTOR_OFFLINE.body}</Text>
              <IconAction layout="inline" icon="refresh" busy={checking}
                label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry}
                ground="blue"
                disabled={checking}
                onPress={() => open(heldBack.textMode)}
              />
            </View>
          )}
        </>
      }
      secondary={<IconAction layout="inline" icon="keyboard" label={modes.other.label} ground="blue" disabled={checking} onPress={() => open(modes.other.textMode)} />}
    />
  );
}

const st = StyleSheet.create({
  // The touch floor in both directions, in the brief's 44pt corner slot.
  corner: {
    minWidth: HIT,
    minHeight: HIT,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // On the blue: the ground's secondary for the passing line, white for the
  // sentence the learner has to read to know what happened.
  checking: { ...type.small, color: onColour.blue, textAlign: 'center' },
  offline: { gap: space(3) },
  offlineBody: { ...type.body, color: paper.onInk },
});
