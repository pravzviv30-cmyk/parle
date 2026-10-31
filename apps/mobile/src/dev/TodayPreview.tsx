/**
 * Today on a fixed learner (UI-015, `?preview=today-*`), for screenshots at
 * 320 and 375 in light and dark, with no storage, account or navigation.
 *
 * It draws the same `TodayLayout` composition HomeTab hands its parts to, and
 * every part in it is the real one with fixture props: the sky, the tiles, the
 * hero bodies (`FixHero`, `SceneLead`, `PlansLeadBody`, `StarterContinuation`,
 * `OfflineLeadBody`, `ExploreLeadBody`, `TodayFailedHero`, `TodayLoadingHero`),
 * the rows, the three, Coming up and the week. Only the profile disc is drawn
 * as its face (`Monogram` on the sky's chip), because `ProfileButton` reads
 * navigation and the profile. Every press does nothing but say so.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Monogram, Press } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { ModeScope, useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import type { MainMode } from '../main/appearanceModel.ts';
import { BArt } from '../art/BArt.tsx';
import { HIT, bType, space } from '../theme.ts';
import { SkyBand } from '../home/SkyBand.tsx';
import { TodayHeroCard } from '../home/TodayHeroCard.tsx';
import { TODAY_OVERLAP, TodayLayout } from '../home/TodayLayout.tsx';
import { FixHero, TodayFailedHero, TodayLoadingHero } from '../home/TodayHeroes.tsx';
import { ROW_ART, RouteRow } from '../home/RoutePath.tsx';
import { skyView } from '../home/skyView.ts';
import { COMING_UP_COPY, TODAY_COPY } from '../home/todayView.ts';
import { PLANS_LEAD } from '../home/nextAction.ts';
import { avatarInitial } from '../profile/avatar.ts';
import { TodayStatTiles, TodayStatTilesSkeleton } from '../game/TodayStatTiles.tsx';
import { QuestsCardBody } from '../game/QuestsCard.tsx';
import { threeDone } from '../home/todayView.ts';
import { ComingUpCard, SceneLead, SectionTitle, WeekCard } from '../today/TodayParts.tsx';
import { ExploreLeadBody, LeadRow, PlansLeadBody } from '../practice/NextTaskCard.tsx';
import { leadStop } from '../practice/nextTask.ts';
import { OfflineLeadBody } from '../practice/LocalPracticeCard.tsx';
import { offlineNotice } from '../practice/localPractice.ts';
import { StarterContinuation } from '../onboarding/StarterContinuation.tsx';
import { TUTOR_OFFLINE } from '../tutor/gate.ts';
import {
  TODAY_PREVIEW_COMING_UP, TODAY_PREVIEW_FIX, TODAY_PREVIEW_PHRASE, TODAY_PREVIEW_REVIEW, TODAY_PREVIEW_SCENE, TODAY_PREVIEW_WEEK,
  todayPreviewGame, todayPreviewGreeting, todayPreviewHero, todayPreviewHour, todayPreviewOpen, todayPreviewStarter, type TodayPreviewState,
} from './todayPreviewFixtures.ts';

const NOTE = 'Preview only. Nothing opens.';

/** `onBack`, when the preview controls are on, returns to the screen list. */
export function TodayPreview({ state, mode, onBack }: { state: TodayPreviewState; mode: MainMode; onBack?: () => void }) {
  return (
    <ModeScope mode={mode}>
      <Body state={state} mode={mode} onBack={onBack} />
    </ModeScope>
  );
}

function Body({ state, mode, onBack }: { state: TodayPreviewState; mode: MainMode; onBack?: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const [note, setNote] = useState(false);
  const [starter] = useState(todayPreviewStarter);
  const said = () => setNote(true);
  const hour = todayPreviewHour(state);
  const sky = skyView(hour, mode);
  const lead = todayPreviewHero(state);
  const game = todayPreviewGame(todayPreviewOpen(state));
  const loading = lead === 'loading';
  const failed = lead === 'failed';
  const quiet = loading || failed;

  const scene = (heldBack: boolean) => (
    <SceneLead
      eyebrow={TODAY_PREVIEW_SCENE.eyebrow} title={TODAY_PREVIEW_SCENE.title} french={null} rest={TODAY_PREVIEW_SCENE.time} uses={null}
      start={{ label: 'Start speaking', mode: 'speak', accessibilityLabel: `Start speaking: ${TODAY_PREVIEW_SCENE.title}, ${TODAY_PREVIEW_SCENE.time}`, disabled: false, onPress: said }}
      other={{ label: 'Type instead', disabled: false, onPress: said }}
      checking={null}
      heldBack={heldBack ? { body: TUTOR_OFFLINE.body, retry: TUTOR_OFFLINE.retry, disabled: false, onRetry: said } : null}
    />
  );
  const body = (() => {
    switch (lead) {
      case 'fix': return <FixHero fix={TODAY_PREVIEW_FIX} onTry={said} />;
      case 'tutor-unreachable': return scene(true);
      case 'plans': return <View style={s.gap}><PlansLeadBody onSun={false} body={PLANS_LEAD.body} onPlans={said} onCafe={said} /></View>;
      case 'starter': return <StarterContinuation initial={starter} bare onTutor={said} onPlans={said} />;
      case 'offline': return <OfflineLeadBody notice={offlineNotice(false)} cafe bare checking={false} onTry={said} onRecheck={said} />;
      case 'explore': return <ExploreLeadBody bare title={leadStop('explore', null).title} onExplore={said} />;
      default: return scene(false);
    }
  })();
  const hero = failed ? <TodayFailedHero onPhrase={said} onRetry={said} /> : loading ? <TodayLoadingHero /> : <TodayHeroCard>{body}</TodayHeroCard>;

  // The rows after the hero (UI-012 order): the scene when the fix leads, the phrase, review.
  const rows = quiet ? null : [
    ...(lead === 'fix' ? [<LeadRow key="scene" lead="scene" last={false} title={TODAY_PREVIEW_SCENE.title} line={TODAY_PREVIEW_SCENE.rowLine} onPress={said} />] : []),
    <RouteRow key="phrase" mark="stop" last={false} thumb={<BArt name="voice-chat" width={ROW_ART} height={ROW_ART} />} thumbGround={t.lavender}
      eyebrow={TODAY_COPY.phrase} title={TODAY_PREVIEW_PHRASE.fr} titleLang="fr" line={TODAY_PREVIEW_PHRASE.en} action={{ label: TODAY_COPY.sayRow }} onPress={said} />,
    <RouteRow key="review" mark="end" last thumb={<BArt name="phrasebook" width={ROW_ART} height={ROW_ART} />} thumbGround={t.sage}
      title={TODAY_PREVIEW_REVIEW.title} line={TODAY_PREVIEW_REVIEW.line} action={{ label: TODAY_COPY.practise }} onPress={said} />,
  ];

  const tiles = loading ? <TodayStatTilesSkeleton sky={sky} /> : (
    <TodayStatTiles tiles={game.tiles} labels={{ streak: game.hero.flame.label, goal: game.hero.goal.label, level: game.hero.level.label }}
      sky={sky} flamePop={false} onStreak={said} onGoal={said} onLevel={said} />
  );

  return (
    <ScrollScreen padded={false} bleedTop>
      <TodayLayout
        sky={<SkyBand sky={sky} greeting={todayPreviewGreeting(hour)} profile={<Monogram initial={avatarInitial('Léa')} ground={sky.chip} ink={t.onBrand} />} stats={tiles} nudge={loading ? null : game.nudge} overlap={TODAY_OVERLAP} />}
        hero={hero}
        pathTitle={TODAY_COPY.path}
        rows={rows}
        three={quiet ? null : <QuestsCardBody card={game.three} rowKey={(row) => row.id} doneLine={<Text style={[bType.meta, { color: t.muted }]}>{threeDone(game.three.done)}</Text>} />}
        comingUp={quiet ? null : (
          <View style={s.section}>
            <SectionTitle title={COMING_UP_COPY.title} />
            <ComingUpCard view={TODAY_PREVIEW_COMING_UP} onRehearse={said} onNotNow={said} />
          </View>
        )}
        week={quiet ? null : (
          <View style={s.section}>
            <SectionTitle title={TODAY_COPY.week} />
            <WeekCard sentence={TODAY_PREVIEW_WEEK} link={TODAY_COPY.seeWeek} onLink={said} />
          </View>
        )}
      />
      <View style={s.foot}>
        {note && <Text accessibilityLiveRegion="polite" style={[bType.meta, { color: t.muted }]}>{NOTE}</Text>}
        {onBack !== undefined && (
          <Press haptic="light" accessibilityRole="button" accessibilityLabel="Back to the screen preview list" onPress={onBack} style={s.back}>
            <Text style={[bType.bold15, { color: t.link }]}>Back to screen preview</Text>
          </Press>
        )}
      </View>
    </ScrollScreen>
  );
}


const makeStyles = (_t: B) =>
  StyleSheet.create({
    gap: { gap: space(3) },
    section: { gap: space(3) },
    foot: { paddingHorizontal: space(4), paddingVertical: space(4), gap: space(2) },
    back: { minHeight: HIT, justifyContent: 'center', alignSelf: 'flex-start' },
  });
