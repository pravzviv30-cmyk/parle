/**
 * Practice, built to direction B (B3, 2026-10-20, artboards B-Practice and
 * B-Empty-Practice). The learner goes back to their own conversations: topic
 * chips over the page, the sitting they stopped ("Comes up often" is hidden until Phase C),
 * each conversation with its fixes, three practice steps and a revisit,
 * the mix, saved phrases and saved text, and one honest door to sound practice.
 * A learner with no conversation yet meets the empty page and one pill.
 *
 * Every decision is `practice/practiceTabView.ts`'s; this file is layout. The
 * stores are read by `practice/useLibraryData.ts` (ported from ce1fa976),
 * which recovers a half-done completion first and fences every read and tap to
 * the account that made it. Lock badges come only from the access seam.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Card, Chip, ColourCard, Label, Ledger, LedgerRow, LOCK_BADGE_LABEL, LockBadge, OutlineButton, PillButton, Skeleton } from '../components.tsx';
import { DocumentGlyph } from '../glyphs.tsx';
import { Columns, ScrollScreen, TabHeader } from '../layout.tsx';
import { HIT, onColour, paper, radius, space, textOn, type } from '../theme.ts';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { UNREAD } from '../practice/archive.ts';
import { PRACTICE_TITLE } from '../practice/copy.ts';
import { LocalPracticeCard } from '../practice/LocalPracticeCard.tsx';
import { TuneSoundCard } from '../practice/TuneSoundCard.tsx';
import { useLibraryData } from '../practice/useLibraryData.ts';
import { useRecordedLine } from '../practice/recordedPlayer.ts';
import { soundLead } from '../practice/soundLead.ts';
import {
  CONVERSATIONS_TITLE,
  EMPTY,
  EMPTY_SUBTITLE,
  MIX_TITLE,
  NEWEST,
  OLDER,
  PICK_UP_TITLE,
  PRACTICE_SUBTITLE,
  PRACTISE_CONVERSATION,
  SAVED_PHRASES,
  SAVED_TEXT,
  chosenTopic,
  conversationCard,
  isNewLearner,
  mixCard,
  packsInTopic,
  pickUp,
  revisitedLines,
  savedPhrasesLine,
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
  // A probe is in flight, so a second tap cannot queue a second navigation.
  const [checking, setChecking] = useState(false);
  // The start that did not happen, so the retry is the same start.
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  // A new account starts on All, with no probe or refusal of the last one's.
  const accountScope = scopeGeneration();
  useEffect(() => { setTopic(null); setChecking(false); setHeldBack(null); }, [accountScope]);
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
      const start = lessonStart(false);
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
    <View style={st.stack}>
      <Text style={[type.small, { color: paper.inkSoft }]}>{TUTOR_OFFLINE.body}</Text>
      <LocalPracticeCard />
      <OutlineButton label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} disabled={checking} onPress={startFirst} />
    </View>
  );

  const savedRows = data !== null && (
    <Ledger>
      <LedgerRow glyph={<DocumentGlyph color={paper.ink} />} title={SAVED_PHRASES} gloss={savedPhrasesLine(data.deck)} onPress={() => go({ screen: 'Phrasebook' })} />
      {adapter.kind === 'supabase' && <LedgerRow title={SAVED_TEXT.title} gloss={SAVED_TEXT.gloss} onPress={() => go({ screen: 'SavedConversationText' })} />}
    </Ledger>
  );

  return (
    <ScrollScreen
      bottom="tab"
      // The F154 checking receipt, kept in the frame header so a tap that waits
      // on the network stays acknowledged when the title scrolls away.
      header={ownerMatches && checking && (
        <Text
          accessibilityLiveRegion="polite"
          style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}
        >
          {TUTOR_OFFLINE.checking}
        </Text>
      )}
    >
      <View style={st.page}>
        <TabHeader title={PRACTICE_TITLE} purpose={newLearner ? EMPTY_SUBTITLE : PRACTICE_SUBTITLE} trailing={<ProfileButton />} />

        {/* The read did not finish. Said plainly, with the same work offered again. */}
        {library.failed && (
          <Card style={st.stack}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{UNREAD.title}</Text>
            <Text style={[type.small, { color: paper.inkSoft }]}>{UNREAD.body}</Text>
            <OutlineButton label={UNREAD.retry} disabled={library.loading} onPress={library.retry} />
          </Card>
        )}
        {library.cached && (
          <View accessibilityLiveRegion="polite" style={st.stack}>
            <Text style={[type.small, { color: paper.inkSoft }]}>Showing what is saved on this phone. Connect and try again to check for newer conversations.</Text>
            <OutlineButton label="Try again" disabled={library.loading} onPress={library.retry} />
          </View>
        )}
        {data === null && !library.failed && (
          <View accessibilityLabel="Loading your practice">
            <Skeleton blocks={[{ height: space(30), radius: radius.feature }, { height: space(40), radius: radius.feature }]} />
          </View>
        )}

        {data !== null && newLearner && (
          <View style={st.page}>
            <Card style={st.stack}>
              <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{EMPTY.title}</Text>
              <Text style={[type.body, { color: paper.inkSoft }]}>{EMPTY.body}</Text>
              <PillButton label={EMPTY.start} disabled={checking} onPress={startFirst} />
              {refused}
            </Card>
            <View style={st.stack}>
              <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{EMPTY.readyNow}</Text>
              <Ledger>
                <LedgerRow title={EMPTY.cafe.title} gloss={EMPTY.cafe.line} note={EMPTY.cafe.cost} disabled={checking} onPress={openLesson} />
                <LedgerRow title={EMPTY.sounds.title} gloss={EMPTY.sounds.gloss} onPress={() => go({ screen: 'SoundCheck' })} />
              </Ledger>
            </View>
            {savedRows}
          </View>
        )}

        {data !== null && !newLearner && (() => {
          const chips = topicChips(data.page);
          const chosen = chosenTopic(data.page, topic);
          const shown = packsInTopic(data.page, chosen);
          const resume = pickUp({ saved: data.session, packs: data.packs, deck: data.deck, bank: data.bank, now });
          const mix = mixCard({ deck: data.deck, bank: data.bank, topics: data.topics, now, access: locks.access });
          const week = thisWeekLine(data.page, now);
          return (
            <Columns>
              <View style={st.page}>
                {chips.length > 0 && (
                  <View accessibilityRole="tablist" accessibilityLabel="Topics" style={st.chips}>
                    {chips.map((chip) => (
                      <Chip key={chip.key ?? 'all'} variant="filter" label={chip.label} selected={chip.key === chosen} onPress={() => setTopic(chip.key)} />
                    ))}
                  </View>
                )}

                {resume !== null && (
                  <ColourCard ground="blue" onPress={() => go(resume.route)} accessibilityLabel={`${PICK_UP_TITLE}, ${resume.line}`}>
                    <View style={st.titleRow}>
                      <Text style={[type.label, st.grow, { color: textOn.blue }]}>{PICK_UP_TITLE}</Text>
                    </View>
                    <Text style={[type.body, { color: onColour.blue }]}>{resume.line}</Text>
                  </ColourCard>
                )}

                {/* 2026-10-20, B3.1, founder: hide until Phase C. "Comes up often" returns built from a stored correction reason. */}

                <View style={st.stack}>
                  <View style={st.titleRow}>
                    <Text accessibilityRole="header" style={[type.heading, st.grow, { color: paper.ink }]}>{CONVERSATIONS_TITLE}</Text>
                    {week !== null && <Chip variant="meta" tone="lavender" label={week} />}
                  </View>
                  {library.olderPage && <Label>An older page. Topics apply to this page.</Label>}
                  {shown.map((pack) => {
                    const card = conversationCard({ pack, packs: data.packs, deck: data.deck, bank: data.bank, now, revisitAllowed, access: locks.access });
                    return (
                      <View key={card.id} style={st.stack}>
                        <Card style={st.stack}>
                          <View style={st.small}>
                            <Text accessibilityRole="header" style={[type.bodyStrong, { color: paper.ink }]}>{card.title}</Text>
                            {card.meta !== '' && <Text style={[type.small, { color: paper.inkSoft }]}>{card.meta}</Text>}
                          </View>
                          {card.summary !== '' && <Text style={[type.body, { color: paper.ink }]}>{card.summary}</Text>}
                          {card.revisited !== null && revisitedLines(card.revisited).map((line) => (
                            <Text key={line} style={[type.small, { color: paper.inkSoft }]}>{line}</Text>
                          ))}
                          {card.kept.length > 0 && (
                            <View style={st.chips}>
                              {card.kept.map((fr) => <Chip key={fr} variant="meta" lang="fr" label={fr} />)}
                              {card.more !== null && <Chip variant="meta" label={card.more} />}
                            </View>
                          )}
                        </Card>
                        {(card.fixes !== null || card.steps !== null || card.revisit !== null) && (
                          <Ledger accessibilityLabel={card.title}>
                            {card.fixes !== null && <LedgerRow title={card.fixes.title} gloss={card.fixes.gloss} onPress={() => go(card.fixes!.route)} />}
                            {card.steps?.map((step, i) => (
                              <LedgerRow key={step.key} label={i === 0 ? PRACTISE_CONVERSATION : undefined} title={step.title} gloss={step.gloss}
                                accessibilityLabel={`${PRACTISE_CONVERSATION}, ${step.title}, ${step.gloss}${card.stepsLocked ? `, ${LOCK_BADGE_LABEL}` : ''}`}
                                trailing={card.stepsLocked ? <LockBadge form="round" said /> : undefined}
                                onPress={() => go(step.route)} />
                            ))}
                            {card.revisit !== null && (
                              <LedgerRow title={card.revisit.label} gloss={card.revisit.uses}
                                accessibilityLabel={`${card.revisit.label}. ${card.revisit.uses}${card.revisit.locked ? `, ${LOCK_BADGE_LABEL}` : ''}`}
                                trailing={card.revisit.locked ? <LockBadge form="round" said /> : undefined}
                                onPress={() => tapThrough(locks.access, card.revisit!.feature, locks.open, () => go(card.revisit!.route))} />
                            )}
                          </Ledger>
                        )}
                      </View>
                    );
                  })}
                  {data.unavailable.length > 0 && (
                    <OutlineButton label="Some conversations need a closer look" onPress={() => { if (ownsReadNow()) nav.navigate('Conversations'); }} />
                  )}
                  {library.nextCursor !== null && <OutlineButton label={library.loading ? 'Loading…' : OLDER} disabled={library.loading} onPress={library.older} />}
                  {library.olderPage && <OutlineButton label={NEWEST} disabled={library.loading} onPress={library.newest} />}
                </View>
              </View>

              <View style={st.page}>
                {mix !== null && (
                  <ColourCard ground="blue" onPress={() => tapThrough(locks.access, mix.feature, locks.open, () => go(mix.route))} accessibilityLabel={`${MIX_TITLE}, ${mix.line}${mix.locked ? `, ${LOCK_BADGE_LABEL}` : ''}`}>
                    <View style={st.titleRow}>
                      <Text style={[type.label, st.grow, { color: textOn.blue }]}>{MIX_TITLE}</Text>
                      {mix.locked && <LockBadge ground="card" said />}
                    </View>
                    <Text style={[type.body, { color: onColour.blue }]}>{mix.line}</Text>
                  </ColourCard>
                )}

                {savedRows}

                {/* The honest doors to sound practice: the bundled recording to
                    hear, say and compare, and one sound with its mouth guide. */}
                {shadowPhrase && (
                  <Ledger>
                    <LedgerRow glyph={<DocumentGlyph color={paper.ink} />} title="Hear, say and compare" gloss="Free offline practice with your chosen tutor’s recording. Your take is temporary and is not graded." onPress={() => { if (ownsReadNow()) nav.navigate('DailyPractice', { id: shadowPhrase.id, mode: 'shadowing' }); }} />
                  </Ledger>
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

const st = StyleSheet.create({
  page: { gap: space(6) },
  stack: { gap: space(3) },
  small: { gap: space(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(2), minHeight: HIT },
  grow: { flex: 1, minWidth: 0 },
});
