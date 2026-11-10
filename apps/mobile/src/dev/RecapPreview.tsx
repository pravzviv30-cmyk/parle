/**
 * The conversation recap as a screen preview (`?preview=recap-*`), so the same
 * fixtures can be shot before and after the rebuild (UI-020). Each key mounts
 * the real RecapScreen with a fixed payload, under a preview-only storage
 * scope holding one finished profile. Nothing is sent or charged.
 *
 * The two sheet keys draw the scrolled recap with its sheet open over it: the
 * focus sheet on the fixture's sound, and the fix sheet on its first fix. The
 * sheets are mounted here, beside the screen, so the screen takes no preview
 * prop. `recap-reminder` draws the full recap, because REMINDERS_AVAILABLE is
 * false on the web build.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContext } from '@react-navigation/native';
import { closureFromRecap } from '../conversationPacks/closure.ts';
import { FixLineSheet } from '../drill/FixLineSheet.tsx';
import { RecapScreen } from '../RecapScreen.tsx';
import { FocusSheet } from '../recap/FocusSheet.tsx';
import { Screen } from '../layout.tsx';
import { ModeScope } from '../main/bTheme.tsx';
import type { MainMode } from '../main/appearanceModel.ts';
import { ProfileGate } from '../app/ProfileContext.tsx';
import { createStoredProfile, saveProfile } from '../profile/store.ts';
import { recordMissionCompletion } from '../missions/store.ts';
import { setActiveUser, userKey } from '../storage/scope.ts';
import * as F from './recapFixtures.ts';

export const RECAP_PREVIEW_KEYS = [
  'recap-full', 'recap-scrolled', 'recap-sound-sheet', 'recap-fix-sheet', 'recap-earned', 'recap-earned-first-stamp',
  'recap-no-reply', 'recap-not-saved', 'recap-settlement-not-charged', 'recap-left-early', 'recap-typed', 'recap-no-sound',
  'recap-progress-unreadable', 'recap-reminder',
] as const;
export type RecapPreviewKey = typeof RECAP_PREVIEW_KEYS[number];

const noop = () => {};
const PREVIEW_NAVIGATION = new Proxy({} as Record<string, unknown>, {
  get: (_target, key) => (key === 'isFocused' ? () => true : key === 'addListener' ? () => noop : key === 'getState' ? () => undefined : noop),
}) as never;

export function RecapPreview({ preview, mode }: { preview: RecapPreviewKey; mode: MainMode }) {
  const [scope] = useState(() => `screen-preview-${preview}-${Date.now()}`);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setActiveUser(scope);
    const seed = async () => {
      await saveProfile(createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: null }));
      // An envelope the strict sound-check read refuses, so the progress reads fail.
      if (preview === 'recap-progress-unreadable') await AsyncStorage.setItem(userKey('soundChecks'), '{"version":-1}');
      // The earned keys' scene, finished on the learner's own, so the recap reads the can-do as earned.
      if (preview === 'recap-earned' || preview === 'recap-earned-first-stamp') await recordMissionCompletion(F.RECAP_MISSION_ID, 4);
    };
    void seed().catch(noop).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [scope, preview]);
  return (
    <ModeScope mode={mode}>
      <NavigationContext.Provider value={PREVIEW_NAVIGATION}>
        {ready ? <ProfileGate onSignOut={noop} onboarding={() => <View />}>{body(preview)}</ProfileGate> : <Screen><View /></Screen>}
      </NavigationContext.Provider>
    </ModeScope>
  );
}

function body(preview: RecapPreviewKey) {
  const scrolled = preview === 'recap-scrolled' || preview === 'recap-sound-sheet' || preview === 'recap-fix-sheet';
  const earned = preview === 'recap-earned' || preview === 'recap-earned-first-stamp';
  const empty = preview === 'recap-no-reply' || preview === 'recap-settlement-not-charged';
  const early = preview === 'recap-left-early';
  const recap = scrolled ? F.RECAP_SCROLLED : empty ? F.RECAP_NO_REPLY : early ? F.RECAP_LEFT_EARLY : preview === 'recap-no-sound' ? F.RECAP_NO_SOUND : F.RECAP_FULL;
  const focus = closureFromRecap(F.RECAP_SCROLLED, null).focus;
  const fix = F.RECAP_SCROLLED.fixes[0]!;
  return (<>
    <RecapScreen
      recap={recap}
      completedMissionId={earned ? F.RECAP_MISSION_ID : undefined}
      firstEarned={preview === 'recap-earned-first-stamp'}
      independentFinish={earned}
      lines={empty ? [] : early ? F.RECAP_LINES.slice(0, 1) : F.RECAP_LINES}
      delta={empty || early ? null : F.RECAP_DELTA}
      activeSec={empty ? 70 : early ? 40 : 250}
      goals={F.RECAP_GOALS}
      evidenceQuote={scrolled ? F.RECAP_EVIDENCE_QUOTE : null}
      settlementMessage={preview === 'recap-settlement-not-charged' ? F.RECAP_NOT_CHARGED : null}
      onDone={noop}
      onPractice={noop}
      onSeeJourney={noop}
      onSave={async () => preview !== 'recap-not-saved'}
    />
    {preview === 'recap-sound-sheet' && focus !== null ? <FocusSheet focus={focus} onClose={noop} /> : null}
    {preview === 'recap-fix-sheet' ? <FixLineSheet repair={{ quote: fix.quote, better: fix.better, betterEn: fix.betterEn, why: fix.why }} onClose={noop} /> : null}
  </>);
}
