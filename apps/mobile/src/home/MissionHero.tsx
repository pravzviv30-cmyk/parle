/**
 * The scene Today leads with, drawn on the scene brief (F543, F571, notebook
 * Phase 3).
 *
 * The card draws what `home/homeMission.ts` decided and decides nothing: the
 * level, the French title as the serif hero, "You'll be able to" and the
 * can-do, two or three lines the learner will say, the minutes, the tutor, one
 * Start in the learner's standing mode and a quiet link to the other one
 * ("Type instead", or "Speak instead" for a learner who prefers typing). No picture, no tint, no reason
 * line: every block is a fact about this scene.
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
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { trackProductEvent } from '../analytics/track.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { loadBookmarks, setBookmark, type BookmarkItem } from '../bookmarks/store.ts';
import { bookmarkControl, bookmarkDecisions, isBookmarkedIn, type BookmarkWrite } from '../bookmarks/view.ts';
import { BookmarkGlyph, GhostButton, MicGlyph, OutlineButton, PillButton, SceneBrief } from '../components.tsx';
import { ClockGlyph } from '../glyphs.tsx';
import { HIT, paper, space, type } from '../theme.ts';
import { TUTOR_OFFLINE, tutorGate } from '../tutor/gate.ts';
import { startModes, withTutor } from '../tutor/speakView.ts';
import { prefersTyping } from '../profile/typing.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { minutesLine } from './estimate.ts';
import { START, heroBookmark, heroStart, type HomeMission } from './homeMission.ts';

export function MissionHero({ hero }: { hero: HomeMission }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { recheck } = useLive();
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
      level={hero.level ?? undefined}
      label={hero.label ?? undefined}
      french={hero.french ?? undefined}
      title={hero.title}
      summary={hero.summary ?? undefined}
      canDo={hero.canDo ?? undefined}
      lines={hero.lines}
      minutes={minutesLine(hero.minutes)}
      minutesMark={<ClockGlyph size={16} color={paper.inkSoft} />}
      tutor={withTutor(tutorName)}
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
            <BookmarkGlyph size={20} color={saved ? paper.ink : paper.inkSoft} />
          </Pressable>
        )
      }
      action={
        <>
          <PillButton
            label={START}
            accessibilityLabel={`${START}: ${hero.title}`}
            icon={<MicGlyph size={20} color={paper.onInk} />}
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
              <OutlineButton
                label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry}
                disabled={checking}
                onPress={() => open(heldBack.textMode)}
              />
            </View>
          )}
        </>
      }
      secondary={<GhostButton label={modes.other.label} color={paper.ink} disabled={checking} onPress={() => open(modes.other.textMode)} />}
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
  checking: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  offline: { gap: space(3) },
  offlineBody: { ...type.body, color: paper.ink },
});
