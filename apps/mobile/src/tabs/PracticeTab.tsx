/**
 * Practice, built to direction B (2026-10-21 UI-008, artboards B-Practice and
 * B-Empty-Practice), in light and dark. The learner goes back to their own
 * conversations: a search over this page's conversations, topic tabs, the
 * sitting they stopped, the pattern that comes up often (authored copy only,
 * never a count), the newest conversation drawn large with its fixes, three
 * practice steps and revisit, older ones drawn small, the mix, saved phrases
 * and saved text, and the honest doors to sound practice. A learner with no
 * conversation yet meets the empty page and its one start.
 *
 * Every decision is `practice/practiceTabView.ts`'s and every part is
 * `practice/PracticeParts.tsx`'s; this file is layout. The stores are read by
 * `practice/useLibraryData.ts`, which recovers a half-done completion first and
 * fences every read and tap to the account that made it. Lock badges come only
 * from the access seam.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Skeleton } from '../components.tsx';
import { Columns, ScrollScreen, TabHeader } from '../layout.tsx';
import { HIT, bType, radius, space } from '../theme.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { UNREAD } from '../practice/archive.ts';
import { PRACTICE_TITLE } from '../practice/copy.ts';
import { LocalPracticeCard } from '../practice/LocalPracticeCard.tsx';
import { TuneSoundCard } from '../practice/TuneSoundCard.tsx';
import {
  CompactConversationCard,
  ConversationsHead,
  EmptyCard,
  LargeConversationCard,
  MixCard,
  Notice,
  PageLink,
  PatternCard,
  PracticeSearch,
  QuietRow,
  ReadyRow,
  ResumeCard,
  SavedBox,
  SavedTiles,
  SubHead,
  TopicTabs,
} from '../practice/PracticeParts.tsx';
import { useLibraryData } from '../practice/useLibraryData.ts';
import { useRecordedLine } from '../practice/recordedPlayer.ts';
import { soundLead } from '../practice/soundLead.ts';
import {
  COMES_UP_TITLE,
  CONVERSATIONS_TITLE,
  EMPTY,
  EMPTY_SUBTITLE,
  MIX_TITLE,
  NEWEST,
  OLDER,
  PATTERN_FREE,
  PICK_UP_TITLE,
  PRACTICE_SUBTITLE,
  PRACTISE_CONVERSATION,
  PRACTISE_IT,
  PRACTISE_THIS,
  SAVED_FIRST,
  SAVED_PHRASES,
  SAVED_TEXT,
  SEARCH_NONE,
  SEARCH_PLACEHOLDER,
  TALK_AGAIN_SHORT,
  cafeRow,
  chosenTopic,
  conversationCard,
  isNewLearner,
  mixCard,
  packsInTopic,
  packsMatching,
  patternCard,
  pickUp,
  revisitedLines,
  savedPhrasesLine,
  soundsRow,
  thisWeekLine,
  topicChips,
  type PracticeRoute,
} from '../practice/practiceTabView.ts';
import type { ExploreTopic } from '../main/exploreCatalogue.ts';
import { useContinueArc } from '../purchases/useContinueArc.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useFeatureAccess } from '../access/useFeatureAccess.ts';
import { tapThrough } from '../access/featureAccess.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { TUTOR_OFFLINE, lessonStart, tutorGate } from '../tutor/gate.ts';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { shadowingPhrase } from '../daily/shadowing.ts';
import { dailyTutorVoice } from '../daily/tutorAudio.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';

export function PracticeTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { recheck } = useLive();
  const { user, adapter } = useAuth();
  // The lock seam: re-renders on a standing change, opens the Wall on a locked tap.
  const locks = useFeatureAccess(user?.id);
  const sounds = soundsRow(locks.access);
  const cafe = cafeRow(locks.access);
  const t = useB();
  const st = useThemedStyles(makeStyles);
  const { profile } = useProfile();
  // The learner's chosen tutor, whose bundled recordings are the only native
  // audio this page plays. Never another voice filling a gap.
  const voice = dailyTutorVoice(profile.tutorVoice);
  const recorded = useRecordedLine();
  const shadowPhrase = shadowingPhrase(DAILY_ITEMS, TUTOR_DAILY_AUDIO, voice);
  // Whether this plan opens the tutor revisit, through the one shared helper.
  const revisitAllowed = useContinueArc() === true;
  const library = useLibraryData();
  const { data } = library;
  const [topic, setTopic] = useState<ExploreTopic | null>(null);
  // The search over this page's conversations, on the device. Never stored.
  const [query, setQuery] = useState('');
  // A probe is in flight, so a second tap cannot queue a second navigation.
  const [checking, setChecking] = useState(false);
  // The start that did not happen, so the retry is the same start.
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  // A new account starts on All, with no probe or refusal of the last one's.
  const accountScope = scopeGeneration();
  useEffect(() => { setTopic(null); setQuery(''); setChecking(false); setHeldBack(null); }, [accountScope]);
  // Drawn only for the account that made the read (useLibraryData's fence).
  const ownerMatches = data !== null;
  const ownsReadNow = () => library.ownsNow();

  // A voice started here stops when the tab goes.
  useEffect(() => () => tutorVoice.stop(), []);
  useFocusEffect(useCallback(() => () => recorded.stop(), [recorded.stop]));

  /** Every door on the page, through the account fence. */
  const go = (route: PracticeRoute) => {
    if (!ownsReadNow()) return;
    recorded.stop();
    nav.navigate(route.screen, 'params' in route ? route.params : undefined);
  };

  /**
   * A live conversation, probed the way the hero's start is (F555). A refusal
   * is answered on the tab with the same start.
   */
  const startFirst = () => {
    if (checking || !ownsReadNow()) return;
    setChecking(true);
    void recheck().then((answered) => {
      if (!ownsReadNow()) return;
      setChecking(false);
      const decision = tutorGate(answered, false);
      if (!decision.go) {
        setHeldBack(decision.heldBack);
        return;
      }
      setHeldBack(null);
      nav.navigate(decision.screen, decision.params);
    }).catch(() => {
      if (!ownsReadNow()) return;
      setChecking(false);
      setHeldBack({ textMode: false });
    });
  };

  /**
   * The café lesson, opened the way the chooser opens it. The probe refreshes
   * whether a real tutor is reachable. An unavailable lesson stays here with
   * genuine local practice rather than simulated speech.
   */
  const openLesson = () => {
    if (checking || !ownsReadNow()) return;
    setChecking(true);
    const go = () => {
      if (!ownsReadNow()) return;
      setChecking(false);
      const start = lessonStart('speak');
      nav.navigate(start.screen, start.params);
    };
    void recheck().then(answered => { if (answered) go(); else { if (!ownsReadNow()) return; setChecking(false); setHeldBack({ textMode: false }); } }, () => { if (!ownsReadNow()) return; setChecking(false); setHeldBack({ textMode: false }); });
  };

  /** Play the sound's recording, or stop it. Never the synthesiser. */
  const hearRecording = (asset: number) => {
    if (!ownsReadNow()) return;
    tutorVoice.stop();
    recorded.toggle(asset);
  };

  const now = Date.now();
  const newLearner = data !== null && isNewLearner(data);
  const lead = data === null ? null : soundLead({ checks: data.checks, now, voice, recordings: TUTOR_DAILY_AUDIO, items: DAILY_ITEMS });

  const refused = heldBack !== null && (
    <View style={st.refused}>
      <Text style={[bType.meta, { color: t.secondary }]}>{TUTOR_OFFLINE.body}</Text>
      <LocalPracticeCard />
      <PageLink label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} disabled={checking} onPress={startFirst} />
    </View>
  );

  const savedTiles = data !== null && (
    <SavedTiles tiles={[
      { key: 'phrases', title: SAVED_PHRASES, line: savedPhrasesLine(data.deck), onPress: () => go({ screen: 'Phrasebook' }) },
      ...(adapter.kind === 'supabase' ? [{ key: 'text', title: SAVED_TEXT.title, line: SAVED_TEXT.gloss, onPress: () => go({ screen: 'SavedConversationText' }) }] : []),
    ]} />
  );

  return (
    <ScrollScreen
      bottom="tab"
      topGap={8}
      // The F154 checking receipt, kept in the frame header so a tap that waits
      // on the network stays acknowledged when the title scrolls away.
      header={ownerMatches && checking && (
        <Text
          accessibilityLiveRegion="polite"
          style={[bType.note, { color: t.muted, marginTop: space(1) }]}
        >
          {TUTOR_OFFLINE.checking}
        </Text>
      )}
    >
      <View style={newLearner ? st.emptyPage : st.page}>
        <TabHeader title={PRACTICE_TITLE} purpose={newLearner ? EMPTY_SUBTITLE : PRACTICE_SUBTITLE} trailing={<ProfileButton />} />

        {/* The read did not finish. Said plainly, with the same work offered again. */}
        {library.failed && (
          <Notice title={UNREAD.title} body={UNREAD.body} action={UNREAD.retry} disabled={library.loading} onPress={library.retry} />
        )}
        {library.cached && (
          <Notice live title={null} body="Showing what is saved on this phone. Connect and try again to check for newer conversations." action="Try again" disabled={library.loading} onPress={library.retry} />
        )}
        {data === null && !library.failed && (
          <View accessibilityLabel="Loading your practice">
            <Skeleton blocks={[{ height: space(30), radius: radius.feature }, { height: space(40), radius: radius.feature }]} />
          </View>
        )}

        {data !== null && newLearner && (
          <View style={st.emptyPage}>
            <EmptyCard title={EMPTY.title} body={EMPTY.body} start={EMPTY.start} disabled={checking} onStart={startFirst}>
              {refused}
            </EmptyCard>
            <View style={st.list}>
              <SubHead title={EMPTY.readyNow} />
              {/* "free" is left out: the lesson uses live minutes, said in its own line (founder, 2026-10-21). */}
              <ReadyRow title={cafe.title} lines={[cafe.line, cafe.cost]} art="phrasebook" ground="butter" locked={cafe.locked} disabled={checking} onPress={openLesson} />
              <ReadyRow title={sounds.title} lines={[sounds.gloss]} art="voice-chat" ground="peach" locked={sounds.locked} onPress={() => go({ screen: 'SoundCheck' })} />
            </View>
            <View style={st.list}>
              <SubHead title={SAVED_PHRASES} />
              <SavedBox line={data.deck.length === 0 ? SAVED_FIRST : savedPhrasesLine(data.deck)} onPress={() => go({ screen: 'Phrasebook' })} />
            </View>
          </View>
        )}

        {data !== null && !newLearner && (() => {
          const chips = topicChips(data.page);
          const chosen = chosenTopic(data.page, topic);
          const shown = packsMatching(packsInTopic(data.page, chosen), query);
          const resume = pickUp({ saved: data.session, packs: data.packs, deck: data.deck, bank: data.bank, now });
          const pattern = patternCard({ patterns: profile.brain.errorPatterns, packs: data.packs, bank: data.bank, access: locks.access });
          const mix = mixCard({ deck: data.deck, bank: data.bank, topics: data.topics, now, access: locks.access });
          const week = thisWeekLine(data.page, now);
          return (
            <Columns>
              <View style={st.page}>
                <View style={st.searchBlock}>
                  <PracticeSearch value={query} onChangeText={setQuery} placeholder={SEARCH_PLACEHOLDER} />
                  {chips.length > 0 && (
                    <TopicTabs tabs={chips} chosen={chosen} onChoose={setTopic} />
                  )}
                </View>

                {resume !== null && (
                  <ResumeCard title={PICK_UP_TITLE} line={resume.line} onPress={() => go(resume.route)} />
                )}

                {/* 2026-10-21 UI-008, artboard B-Practice, founder: Comes up often shows, authored copy only, never a count. */}
                {pattern !== null && (
                  <PatternCard eyebrow={COMES_UP_TITLE} title={pattern.row.title} hint={pattern.row.hint} note={PATTERN_FREE} practise={PRACTISE_THIS} locked={pattern.row.locked}
                    onCard={pattern.fixes === null ? null : () => go(pattern.fixes!)}
                    onPractise={pattern.row.practise === null ? null : () => tapThrough(locks.access, 'fixes', locks.open, () => go(pattern.row.practise!))} />
                )}

                <ConversationsHead title={CONVERSATIONS_TITLE} week={week} />
                {library.olderPage && <Text style={[bType.note, { color: t.muted }]}>An older page. Topics apply to this page.</Text>}
                {shown.length === 0 && query.trim() !== '' && <Text style={[bType.meta, { color: t.secondary }]}>{SEARCH_NONE}</Text>}
                {shown.map((pack, index) => {
                  const card = conversationCard({ pack, packs: data.packs, deck: data.deck, bank: data.bank, now, revisitAllowed, access: locks.access, index });
                  const revisited = card.revisited === null ? null : revisitedLines(card.revisited);
                  const talk = card.revisit === null ? null : {
                    label: card.revisit.label,
                    uses: card.revisit.uses,
                    locked: card.revisit.locked,
                    onPress: () => tapThrough(locks.access, card.revisit!.feature, locks.open, () => go(card.revisit!.route)),
                  };
                  if (index === 0) {
                    return (
                      <LargeConversationCard key={card.id} title={card.title} meta={card.meta} summary={card.summary} kept={card.kept} more={card.more} revisited={revisited}
                        fixes={card.fixes === null ? null : { title: card.fixes.title, gloss: card.fixes.gloss, locked: card.fixes.locked, onPress: () => go(card.fixes!.route) }}
                        stepsLabel={PRACTISE_CONVERSATION}
                        steps={card.steps === null ? null : card.steps.map((step) => ({ key: step.key, title: step.title, gloss: step.gloss, onPress: () => go(step.route) }))}
                        stepsLocked={card.stepsLocked}
                        revisit={talk} />
                    );
                  }
                  return (
                    <CompactConversationCard key={card.id} title={card.title} meta={card.meta} summary={card.summary} art={card.art} revisited={revisited}
                      practise={card.practiseIt === null ? null : { label: PRACTISE_IT, locked: card.practiseIt.locked, onPress: () => tapThrough(locks.access, card.practiseIt!.feature, locks.open, () => go(card.practiseIt!.route)) }}
                      talk={talk === null ? null : { ...talk, label: TALK_AGAIN_SHORT }} />
                  );
                })}
                {data.unavailable.length > 0 && (
                  <PageLink label="Some conversations need a closer look" onPress={() => { if (ownsReadNow()) nav.navigate('Conversations'); }} />
                )}
                {library.nextCursor !== null && <PageLink label={library.loading ? 'Loading…' : OLDER} disabled={library.loading} onPress={library.older} />}
                {library.olderPage && <PageLink label={NEWEST} disabled={library.loading} onPress={library.newest} />}
              </View>

              <View style={st.page}>
                {mix !== null && (
                  <MixCard title={MIX_TITLE} line={mix.line} locked={mix.locked} onPress={() => tapThrough(locks.access, mix.feature, locks.open, () => go(mix.route))} />
                )}

                {savedTiles}

                {/* The honest doors to sound practice, below what the artboard draws: the
                    bundled recording to hear, say and compare, and one sound with its mouth guide. */}
                {shadowPhrase && (
                  <QuietRow title="Hear, say and compare" line="Free offline practice with your chosen tutor’s recording. Your take is temporary and is not graded." onPress={() => { if (ownsReadNow()) nav.navigate('DailyPractice', { id: shadowPhrase.id, mode: 'shadowing' }); }} />
                )}
                {ownerMatches && lead !== null && (
                  <TuneSoundCard lead={lead} playing={recorded.playing} onHear={hearRecording} onCheck={(missionId) => { if (ownsReadNow()) nav.navigate('SoundCheck', { missionId }); }} />
                )}
              </View>
            </Columns>
          );
        })()}
      </View>
    </ScrollScreen>
  );
}

// Section gaps from the artboards: Practice 20, the empty page 22.
const makeStyles = (_t: B) =>
  StyleSheet.create({
    page: { gap: space(5) },
    emptyPage: { gap: space(5.5) },
    searchBlock: { gap: space(2.5) },
    list: { gap: space(2.5) },
    refused: { gap: space(2), alignSelf: 'stretch', minHeight: HIT },
  });
