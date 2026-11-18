/**
 * Today on a fixed learner (UI-015, `?preview=today-*`), for screenshots at
 * 320 and 375 in light and dark, with no storage, account or navigation.
 *
 * It draws the same `TodayLayout` composition HomeTab hands its parts to, and
 * every part in it is the real one with fixture props: the sky, the tiles, the
 * hero bodies (`FixHero`, `SceneLead`, `PlansLeadBody`, `StarterContinuation`,
 * `OfflineLeadBody`, `HeldLeadBody`, `ExploreLeadBody`, `TodayFailedHero`, `TodayLoadingHero`),
 * the rows, the three, Coming up and the week. Only the profile disc is drawn
 * as its face (`Monogram` on the sky's chip), because `ProfileButton` reads
 * navigation and the profile. Every press does nothing but say so.
 *
 * `today-starter-feedback` draws the starter sheet's checked state on the
 * Sheet's own ground (`t.card`): its prompt lines, then `StarterFeedback`
 * accepted and not accepted, because the sheet itself opens only on a tap.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Monogram, Press } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { ModeScope, useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import type { MainMode } from '../main/appearanceModel.ts';
import { BArt } from '../art/BArt.tsx';
import { HIT, bType, frenchText, space, type } from '../theme.ts';
import { SkyBand } from '../home/SkyBand.tsx';
import { TodayHeroCard } from '../home/TodayHeroCard.tsx';
import { TODAY_OVERLAP, TodayLayout } from '../home/TodayLayout.tsx';
import { FixHero, TodayFailedHero, TodayLoadingHero } from '../home/TodayHeroes.tsx';
import { ROW_ART, RouteRow } from '../home/RoutePath.tsx';
import { skyView } from '../home/skyView.ts';
import { COMING_UP_COPY, TODAY_COPY, phraseRow } from '../home/todayView.ts';
import { PLANS_LEAD } from '../home/nextAction.ts';
import { avatarInitial } from '../profile/avatar.ts';
import { TodayStatTiles, TodayStatTilesSkeleton } from '../game/TodayStatTiles.tsx';
import { QuestsCardBody } from '../game/QuestsCard.tsx';
import { threeDone } from '../home/todayView.ts';
import { ComingUpCard, SceneLead, SectionTitle, WeekCard } from '../today/TodayParts.tsx';
import { ExploreLeadBody, HeldLeadBody, LeadRow, PlansLeadBody } from '../practice/NextTaskCard.tsx';
import { heldWords, heroCarriesReview, leadStop } from '../practice/nextTask.ts';
import { OfflineLeadBody } from '../practice/LocalPracticeCard.tsx';
import { offlineNotice } from '../practice/localPractice.ts';
import { StarterContinuation, StarterFeedback } from '../onboarding/StarterContinuation.tsx';
import {
  TODAY_PREVIEW_COMING_UP, TODAY_PREVIEW_FIX, TODAY_PREVIEW_CAFE, TODAY_PREVIEW_HELD_BILLING, TODAY_PREVIEW_LAPSED_BILLING, TODAY_PREVIEW_PHRASE, TODAY_PREVIEW_REVIEW, TODAY_PREVIEW_SCENE, TODAY_PREVIEW_WEEK,
  todayPreviewGame, todayPreviewGreeting, todayPreviewHero, todayPreviewHour, todayPreviewNow, todayPreviewOpen, todayPreviewStarter, todayPreviewStarterFeedback, type TodayPreviewState,
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
  if (state === 'starter-feedback') return <StarterFeedbackSheet onBack={onBack} />;
  const hour = todayPreviewHour(state);
  const sky = skyView(hour, mode);
  const lead = todayPreviewHero(state);
  const game = todayPreviewGame(todayPreviewOpen(state));
  const loading = lead === 'loading';
  const failed = lead === 'failed';
  const quiet = loading || failed;

  const scene = (
    <SceneLead
      title={TODAY_PREVIEW_SCENE.title} french={null} rest={TODAY_PREVIEW_SCENE.line} uses={null}
      start={{ label: 'Start speaking', mode: 'speak', accessibilityLabel: `Start speaking: ${TODAY_PREVIEW_SCENE.title}, ${TODAY_PREVIEW_SCENE.time}`, disabled: false, onPress: said }}
      other={{ label: 'Type instead', disabled: false, onPress: said }}
      checking={null}
    />
  );
  const body = (() => {
    switch (lead) {
      case 'fix': return <FixHero fix={TODAY_PREVIEW_FIX} onTry={said} />;
      // A start the tutor could not take, as MissionHero draws it at Starter (F996).
      case 'tutor-unreachable': return <OfflineLeadBody notice={offlineNotice(true)} cafe bare checking={false} onTry={said} onRecheck={said} />;
      case 'plans': return <View style={s.gap}><PlansLeadBody onSun={false} body={PLANS_LEAD.body} onPlans={said} onCafe={said} /></View>;
      // Past Starter with reviews due, as NextTaskCard draws it: no café line, the review door (F946).
      case 'plans-past': return <View style={s.gap}><PlansLeadBody onSun={false} body={PLANS_LEAD.body} onPlans={said} onReview={said} reviewLabel={TODAY_PREVIEW_REVIEW.title} /></View>;
      case 'starter': return <StarterContinuation initial={starter} bare onTutor={said} onPlans={said} />;
      case 'offline': return <OfflineLeadBody notice={offlineNotice(false)} cafe bare checking={false} onTry={said} onRecheck={said} />;
      // Past Starter, so no café line: the words, then Review (F946).
      case 'held': return <HeldLeadBody bare words={heldWords(TODAY_PREVIEW_HELD_BILLING, todayPreviewNow(hour))} onPlans={said} onReview={said} reviewLabel={TODAY_PREVIEW_REVIEW.title} />;
      // Lapsed at Starter, as NextTaskCard draws it: the words and See plans; the café line is the phrase row (F996).
      case 'held-starter': return <HeldLeadBody bare words={heldWords(TODAY_PREVIEW_LAPSED_BILLING, todayPreviewNow(hour))} onPlans={said} />;
      case 'explore': return <ExploreLeadBody bare title={leadStop('explore', null).title} onExplore={said} />;
      default: return scene;
    }
  })();
  // Held past Starter the hero carries Review, so the path drops it and the hero sits on the paper (F996).
  const heroReview = (lead === 'held' || lead === 'held-starter') && heroCarriesReview({ lead: 'outOfTime', billingKnown: true, reviewDue: true, starterShown: false, cafeShown: lead === 'held-starter' });
  const hero = failed ? <TodayFailedHero onPhrase={said} onRetry={said} /> : loading ? <TodayLoadingHero /> : <TodayHeroCard plain={heroReview}>{body}</TodayHeroCard>;

  // The rows after the hero (UI-012 order): the scene when the fix leads, the
  // phrase, review.
  // Held at Starter the phrase row carries the café line (F996).
  const phrase = phraseRow({ daily: TODAY_PREVIEW_PHRASE, cafe: lead === 'held-starter' ? TODAY_PREVIEW_CAFE : null });
  const rows = quiet ? null : [
    ...(lead === 'fix' ? [<LeadRow key="scene" lead="scene" last={false} title={TODAY_PREVIEW_SCENE.title} line={TODAY_PREVIEW_SCENE.line} onPress={said} />] : []),
    <RouteRow key="phrase" mark={heroReview ? 'end' : 'stop'} last={heroReview} thumb={<BArt name="voice-chat" width={ROW_ART} height={ROW_ART} />} thumbGround={t.lavender}
      title={phrase.title} titleLang={phrase.titleLang} line={phrase.line} onPress={said} />,
    ...(heroReview ? [] : [<RouteRow key="review" mark="end" last thumb={<BArt name="phrasebook" width={ROW_ART} height={ROW_ART} />} thumbGround={t.sage}
      title={TODAY_PREVIEW_REVIEW.title} line={TODAY_PREVIEW_REVIEW.line} onPress={said} />]),
  ];

  const tiles = loading ? <TodayStatTilesSkeleton sky={sky} /> : (
    <TodayStatTiles tiles={game.tiles} labels={{ streak: game.hero.flame.label, goal: game.hero.goal.label, level: game.hero.level.label }}
      sky={sky} flamePop={false} onStreak={said} onGoal={said} onLevel={said} />
  );

  return (
    <ScrollScreen padded={false} bleedTop>
      <TodayLayout
        sky={<SkyBand sky={sky} greeting={todayPreviewGreeting(hour)} profile={<Monogram initial={avatarInitial('Léa')} ground={sky.chip} ink={t.onBrand} />} stats={tiles} nudge={loading ? null : game.nudge} overlap={heroReview ? 0 : TODAY_OVERLAP} />}
        hero={hero}
        overlap={heroReview ? 0 : TODAY_OVERLAP}
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

/** The starter sheet's body after a check, on the Sheet panel's ground and padding. */
function StarterFeedbackSheet({ onBack }: { onBack?: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const [view] = useState(todayPreviewStarterFeedback);
  const { task } = view;
  return (
    <ScrollScreen padded={false}>
      <View style={[s.panel, { backgroundColor: t.card }]}>
        <Text accessibilityRole="header" style={[type.heading, { color: t.text }]}>{task.title}</Text>
        <Text {...frenchText} style={[type.frenchLg, { color: t.text }]}>{task.prompt}</Text>
        <Text style={[type.body, { color: t.text }]}>{task.translation}</Text>
        <Text style={[type.small, { color: t.text }]}>
          Offline phrase practice. This checks your typed French, not your pronunciation.
        </Text>
        <StarterFeedback reply={view.accepted.reply} feedback={view.accepted.feedback} />
        <StarterFeedback reply={view.missed.reply} feedback={view.missed.feedback} />
      </View>
      {onBack !== undefined && (
        <View style={s.foot}>
          <Press haptic="light" accessibilityRole="button" accessibilityLabel="Back to the screen preview list" onPress={onBack} style={s.back}>
            <Text style={[bType.bold15, { color: t.link }]}>Back to screen preview</Text>
          </Press>
        </View>
      )}
    </ScrollScreen>
  );
}

const makeStyles = (_t: B) =>
  StyleSheet.create({
    gap: { gap: space(3) },
    panel: { paddingHorizontal: space(5), paddingVertical: space(6), gap: space(4) },
    section: { gap: space(3) },
    foot: { paddingHorizontal: space(4), paddingVertical: space(4), gap: space(2) },
    back: { minHeight: HIT, justifyContent: 'center', alignSelf: 'flex-start' },
  });
