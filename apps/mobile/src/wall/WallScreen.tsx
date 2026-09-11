import { useEffect, useState } from 'react';

import { useProfile } from '../app/ProfileContext.tsx';
import { trackProductEvent } from '../analytics/track.ts';
import { PillButton, ProgressDots } from '../components.tsx';
import { ScreenHeader, ScrollScreen } from '../layout.tsx';
import { missionStates, type MissionProgress } from '@luvani/core';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { loadActivity } from '../progress/activity.ts';
import { momentumFrom } from '../progress/momentum.ts';
import { purchases, type StoreOffering } from '../purchases/adapter.ts';
import { paywallSurface } from '../purchases/paywallView.ts';
import { loadDeck } from '../review/store.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { WallFrenchPage } from './WallFrenchPage.tsx';
import { WallMapPage } from './WallMapPage.tsx';
import { WallYoursPage } from './WallYoursPage.tsx';
import { WALL_DONE, WALL_NEXT, YOURS_NEXT } from './wallCopy.ts';
import { wallFrench, type WallFrench } from './wallFrench.ts';
import { wallMap, type WallMapRow } from './wallMap.ts';
import { endsOnPlans, wallPages, type WallEntry } from './wallPages.ts';

/**
 * The subscription wall: a short paged report that ends in a price, or does not.
 *
 * The frame owns the paging, the one primary button and the two analytics
 * events. Every page under it is null gates and a stylesheet, and every decision
 * either page draws was made in a module a test can call, because apps/mobile
 * has no renderer.
 *
 * Three of the four pages need no store at all, which is not a convenience. The
 * purchase half cannot be switched on until the RevenueCat keys exist and
 * F263 and F266 close, and a wall nobody could look at until then is a wall
 * nobody could correct. So the value sequence stands alone, on web as well, and
 * ends on the free promise when there is nothing to sell.
 */
export function WallScreen({
  entry,
  onLeave,
  onOpenBank,
  onSeePlans,
}: {
  entry: WallEntry;
  onLeave: () => void;
  onOpenBank: () => void;
  onSeePlans: () => void;
}) {
  const { profile } = useProfile();
  const [index, setIndex] = useState(0);
  const [rows, setRows] = useState<readonly WallMapRow[] | null>(null);
  const [french, setFrench] = useState<WallFrench | null>(null);
  const [offering, setOffering] = useState<StoreOffering>({ available: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    void Promise.all([loadActivity(), loadDeck(), loadMissionCompletions()]).then(
      ([activity, deck, completions]) => {
        if (cancelled) return;
        // Through the same door every other screen uses. The store's own
        // MissionCompletion carries `id: string`, because a disk read cannot
        // promise the id names a mission this build has, and this drops the ones
        // that do not along with any rung outside the ladder.
        const progress: readonly MissionProgress[] = missionStates(missionCompletionsFrom(completions), deck, now);
        setRows(wallMap({ progress, deck, tutorName: profile === null ? null : tutorNameOf(profile) }));
        setFrench(wallFrench(momentumFrom({ activity, deck, profile, now })));
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    // A store that answers nothing is the expected answer today, and the page
    // list is built from it rather than around it.
    void purchases.offering('wall').then((next) => {
      if (!cancelled) setOffering(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const storeHasPlans = paywallSurface(offering) !== null;
  const pages = wallPages({ entry, storeHasPlans });
  const page = pages[index];
  const last = index === pages.length - 1;

  // Fired once per showing, with the door and the length, because a drop-off at
  // page two says nothing without knowing how many pages there were.
  useEffect(() => {
    if (!loaded) return;
    void trackProductEvent({ name: 'wall_shown', properties: { entry, pages: pages.length } });
    // The page count is settled by the time this runs, and re-firing on a page
    // turn would make one showing look like several.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    if (!loaded || page === undefined) return;
    void trackProductEvent({ name: 'wall_page_seen', properties: { page, index } });
  }, [loaded, page, index]);

  const back = () => (index > 0 ? setIndex((at) => at - 1) : onLeave());
  useHardwareBack(true, back);

  const forward = () => {
    if (!last) {
      setIndex((at) => at + 1);
      return;
    }
    if (endsOnPlans(pages)) {
      onSeePlans();
      return;
    }
    onLeave();
  };

  const label = !last ? WALL_NEXT : endsOnPlans(pages) ? YOURS_NEXT : WALL_DONE;

  // Nothing is drawn from a half loaded disk: a map with no rows would be the
  // empty opening this whole design exists to refuse.
  if (!loaded || rows === null || french === null || page === undefined) return null;

  return (
    <ScrollScreen
      bottom="inset"
      header={<ScreenHeader back={{ onPress: back }} title={<ProgressDots total={pages.length} index={index} />} />}
      footer={<PillButton label={label} onPress={forward} />}
    >
      {page === 'map' && <WallMapPage rows={rows} />}
      {page === 'french' && <WallFrenchPage french={french} onOpenBank={onOpenBank} />}
      {page === 'yours' && <WallYoursPage canBuy={storeHasPlans} />}
    </ScrollScreen>
  );
}
