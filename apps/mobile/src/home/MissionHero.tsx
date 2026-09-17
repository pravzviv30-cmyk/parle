/**
 * Tonight's French: the one thing Home leads with, drawn (F543, F544, F571).
 *
 * The card draws what `home/homeMission.ts` decided and decides nothing: the
 * kind of offer as its caps line, the name of the thing in the serif, what is
 * happening in plain English, the picture of the place it happens in, how long
 * it is likely to take, and the tab's one pill. Revamp A made the picture the
 * middle of the card, so the tint went and the white card came back: a place is
 * named by its own watercolour now rather than by a colour behind the words.
 *
 * ## What this file keeps hold of
 *
 * Two things, and both are the same argument. The start is the gate's, in the
 * F154 shape: one probe in flight at a time, the learner told it is running, a
 * refusal answered on the card with the same start offered again. And the save
 * is a write and a read back, with the flag that makes the wait visible,
 * because without it the learner tapped, nothing moved for two bridge
 * crossings, and they tapped again. Neither of those is a decision this file
 * makes; both are chains this file is the only caller of.
 *
 * The bookmark moved here from the tab in Revamp A along with the situation it
 * saves. It is a 44pt corner of the card now rather than an outline button
 * under it, which is what the founder's mockup asks for, so it says what it is
 * to a screen reader rather than in a word beside a mark.
 *
 * ## Why the pill is spelled here rather than in HeroCard
 *
 * `surfaceContract.test.ts` counts primary pills per screen by reading the
 * files a tab draws. A `<PillButton` folded into the shared hero card would
 * move every tab's count into one component and the one-pill rule would stop
 * being checkable. So the card takes the action as a node and this file keeps
 * the literal.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { trackProductEvent } from '../analytics/track.ts';
import { useLive } from '../app/LiveContext.tsx';
import { loadBookmarks, setBookmark, type BookmarkItem } from '../bookmarks/store.ts';
import { bookmarkControl, bookmarkDecisions, isBookmarkedIn, type BookmarkWrite } from '../bookmarks/view.ts';
import { BookmarkGlyph, MicGlyph, OutlineButton, PillButton } from '../components.tsx';
import { HeroCard } from '../surface/HeroCard.tsx';
import { HIT, paper, space, type } from '../theme.ts';
import { TUTOR_OFFLINE, tutorGate } from '../tutor/gate.ts';
import { readyLine } from './estimate.ts';
import { START_CONVERSATION, heroBookmark, heroStart, type HomeMission } from './homeMission.ts';

export function MissionHero({ hero }: { hero: HomeMission }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { recheck } = useLive();
  const [checking, setChecking] = useState(false);
  /** The start that did not happen, so the retry is the same start. */
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  const [bookmarks, setBookmarks] = useState<readonly BookmarkItem[]>([]);
  /**
   * Where the bookmark tap has got to. A save is a write and a read back, which
   * is two trips over the storage bridge, and the button said the same word for
   * the whole of it.
   */
  const [bookmarkWrite, setBookmarkWrite] = useState<BookmarkWrite>('idle');

  // Folded once per change rather than once per render. This was a whole Map
  // rebuilt on every render to answer one boolean.
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
      // A shelf that could not be read is not a shelf that is empty, so the
      // button says the store is where it was and stays live rather than
      // claiming this scene is not saved.
      .catch(() => {
        if (!cancelled) setBookmarkWrite('refused');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Save a situation to come back to, or take it off the shelf.
   *
   * Written, then read back, so what is drawn is what the store holds rather
   * than what this card assumed it would hold. A write that will not land says
   * so and leaves the button live, because the way to try again is the thing
   * they already pressed. Nothing tells them they did anything wrong, because
   * they did not.
   */
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

  const open = () => {
    // A second tap while the connection check runs cannot open a second room.
    if (checking) return;
    setChecking(true);
    void recheck()
      .then((answered) => {
        setChecking(false);
        const decision = tutorGate(answered, false);
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
        // At the end of the chain rather than beside the handler, so a throw
        // from the navigation above is caught too. The start is kept, so the
        // retry is the same start rather than a guess at what they were doing.
        setChecking(false);
        setHeldBack({ textMode: false });
      });
  };

  return (
    <HeroCard
      label={hero.label}
      title={hero.title}
      body={hero.body}
      art={hero.art}
      timeLine={readyLine(hero.minutes)}
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
            label={START_CONVERSATION}
            icon={<MicGlyph size={20} color={paper.onInk} />}
            disabled={checking}
            onPress={open}
          />

          {checking && (
            <Text accessibilityLiveRegion="polite" style={st.checking}>
              {TUTOR_OFFLINE.checking}
            </Text>
          )}

          {/* Held back, not broken. The learner asked, the answer is in, and
              the way forward is the same start again rather than a smaller
              one. */}
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
        </>
      }
    />
  );
}

const st = StyleSheet.create({
  // The touch floor in both directions, pulled back into the card's own padding
  // so the mark sits in the corner the mockup draws it in without the target
  // shrinking to the size of the mark.
  corner: {
    minWidth: HIT,
    minHeight: HIT,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: -space(2),
    marginRight: -space(2),
  },
  checking: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  offline: { gap: space(3) },
  offlineBody: { ...type.body, color: paper.ink },
});
