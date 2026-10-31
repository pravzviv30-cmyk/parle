/**
 * The gated start of the day's scene (F154), shared by the scene hero and
 * Today's scene row (UI-015). Moved out of `MissionHero.tsx` unchanged.
 *
 * One probe in flight at a time; the learner is told it is running; a refusal
 * is answered with the same start (spoken or typed) offered again; a visit,
 * account or scene change makes a slow answer stale, so it cannot open a room.
 * The accepted start records `mission_started` and navigates to the gate's
 * screen with the scene's own params.
 *
 * The label is Speak's, from the one `launchLabel`, and `modes` the learner's
 * standing mode with the other one as a quiet link.
 */

import { useEffect, useRef, useState } from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';

import { trackProductEvent } from '../analytics/track.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { prefersTyping } from '../profile/typing.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { tutorGate } from '../tutor/gate.ts';
import { launchLabel } from '../tutor/orbState.ts';
import { startModes } from '../tutor/speakView.ts';
import { heroStart, type HomeMission } from './homeMission.ts';

export interface SceneStart {
  /** Start the scene, typed or spoken. A tap during the check does nothing. */
  open: (textMode: boolean | undefined) => void;
  checking: boolean;
  /** The start the tutor could not take, kept so the retry is the same start. */
  heldBack: { textMode?: boolean } | null;
  /** "Start speaking", "Start typing", or the check while it runs. */
  label: string;
  modes: ReturnType<typeof startModes>;
}

export function useSceneStart(hero: HomeMission): SceneStart {
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { live, recheck } = useLive();
  const { profile } = useProfile();
  // Profile's standing "Prefer typing" decides which way the Start opens.
  const modes = startModes(prefersTyping(profile));
  const [checking, setChecking] = useState(false);
  const owner = scopeGeneration();
  const launchPending = useRef<object | null>(null);
  const launchContext = useRef({ mounted: true, focused, owner, hero, revision: 0 });
  // A return to this card is a new visit. A previous visit's slow health
  // response cannot start a room, even if focus has already returned.
  if (launchContext.current.focused !== focused || launchContext.current.owner !== owner || launchContext.current.hero !== hero) {
    launchContext.current = { ...launchContext.current, focused, owner, hero, revision: launchContext.current.revision + 1 };
  }
  useEffect(() => {
    launchContext.current.mounted = true;
    return () => { launchContext.current.mounted = false; launchContext.current.revision++; launchPending.current = null; };
  }, []);
  useEffect(() => { launchPending.current = null; setChecking(false); }, [focused, owner, hero]);
  /** The start that did not happen, so the retry is the same start. */
  const [heldBack, setHeldBack] = useState<{ textMode?: boolean } | null>(null);
  // Speak's words for Speak's control: the mode, or the check while it runs.
  const label = launchLabel({ checking, live, mode: modes.mode });

  const open = (textMode: boolean | undefined) => {
    // A second tap while the connection check runs cannot open a second room.
    if (checking) return;
    if (launchPending.current || !launchContext.current.mounted || !launchContext.current.focused) return;
    const ticket = {};
    const { owner, revision } = launchContext.current;
    const owns = () => launchPending.current === ticket && launchContext.current.mounted && launchContext.current.focused
      && launchContext.current.revision === revision && launchContext.current.owner === owner && scopeGeneration() === owner;
    launchPending.current = ticket;
    setChecking(true);
    void recheck()
      .then((answered) => {
        if (!owns()) return;
        setChecking(false);
        const decision = tutorGate(answered, textMode);
        if (!decision.go) {
          launchPending.current = null;
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
        if (!owns()) return;
        launchPending.current = null;
        setChecking(false);
        setHeldBack({ textMode });
      });
  };

  return { open, checking, heldBack, label, modes };
}
