import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  DAILY_SCENARIOS,
  MISSIONS,
  missionStates,
  seedTopicOf,
  suggestedMission,
  type ConversationPack,
  type DailyScenario,
  type MissionProgress,
  type ReviewCard,
} from '@luvani/core';

import { Label, Ledger, LedgerRow, LevelPath } from '../components.tsx';
import { ChatGlyph, DocumentGlyph, PlaceGlyph, QuoteGlyph, WaveformGlyph } from '../glyphs.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { paper, space, type } from '../theme.ts';
import { loadDeck } from '../review/store.ts';
import { loadTopics } from '../topics/store.ts';
import { loadActivity } from '../progress/activity.ts';
import { evidenceFrom } from '../progress/evidence.ts';
import { savedSituations } from '../bookmarks/view.ts';
import { loadBookmarks } from '../bookmarks/store.ts';
import { buildPhrasebook } from '../phrases/phrasebook.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { loadConversationPacks, refreshConversationPacks } from '../conversationPacks/store.ts';
import { myFrenchFrom, type MyFrench } from '../myfrench/model.ts';
import {
  BROWSE_LINE,
  BROWSE_OPEN,
  CONVERSATIONS_ROW,
  CONVERSATIONS_SUB,
  DAILY_LABEL,
  DAILY_LINE,
  DAILY_OPEN,
  GOALS_ROW_LABEL,
  RECENT_ALL,
  MY_FRENCH_RETRY,
  MY_FRENCH_UNREAD,
  MY_FRENCH_PURPOSE,
  MY_FRENCH_TITLE,
  SAVED_LABEL,
  SHELF_LABEL,
  SHELF_OPEN,
} from '../myfrench/copy.ts';
import { NOTEBOOK, isFirstVisit, levelLine, levelPathFrom, phraseBankFrom, soundsMapFrom } from '../myfrench/notebook.ts';
import { PhraseBank } from '../myfrench/PhraseBank.tsx';
import { SoundsMap } from '../myfrench/SoundsMap.tsx';
import { allConversations, progressStatement, recentConversations, type HistoryItem } from '../myfrench/recentConversations.ts';
import { loadPracticeHistory } from '../practice/historyStore.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { legacyMarkItems } from '../practice/history.ts';
import { loadPackMarks } from '../conversationPacks/marks.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { SOUND_FINGERPRINT_LABEL, soundFingerprint } from '../myfrench/sounds.ts';
import { soundDoorLabel, soundJourney } from '../soundcheck/journey.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { goalRouteKey, goalRows } from '../goals/rows.ts';
import { GOALS_LABEL } from '../profile/tutorMemory.ts';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { dailyTutorVoice } from '../daily/tutorAudio.ts';

/**
 * My French: the record of what has become the learner's (notebook Phase 3,
 * 2026-09-27).
 *
 * Four blocks, in this order, each only once it has something true to show:
 * the level and the can-dos earned, drawn as the level path with "you are here"
 * on the next scene (the page's one highlighter); the phrase bank, the newest
 * kept phrases with audio that says whose voice it is; the sounds map, every
 * sound in the inventory led by a word, marked only where a measured check
 * called it out; then the conversations. A first visit reads one line on what
 * will collect here. Under them sit the quiet doors that were already here:
 * the scenes the learner saved, their goals, the daily collection and the
 * whole catalogue.
 *
 * There is no rank name and no points on this page: XP stays internal, and the
 * level is the spine's A0 or A1. There is no primary pill: nothing here is a
 * task. Every judgement is a module's (`myfrench/notebook.ts`,
 * `myfrench/model.ts`, `myfrench/sounds.ts`), because there is no renderer in
 * this workspace and a rule left in a `.tsx` is a rule nothing defends.
 */
export function MyFrenchTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { user, adapter } = useAuth();
  const { profile } = useProfile();
  // The learner's chosen tutor, whose recordings are the only tutor audio here.
  const voice = dailyTutorVoice(profile.tutorVoice);
  const [deck, setDeck] = useState<readonly ReviewCard[]>([]);
  const [missions, setMissions] = useState<readonly MissionProgress[]>([]);
  const [packs, setPacks] = useState<ConversationPack[]>([]);
  const [suggested, setSuggested] = useState<MissionProgress | null>(null);
  const [saved, setSaved] = useState<readonly DailyScenario[]>([]);
  // Pronunciation evidence. Only measured checks mark anything, and the pure
  // projections below are the ones that know which those are.
  const [checks, setChecks] = useState<readonly SoundCheckEvidence[]>([]);
  const [history, setHistory] = useState<readonly HistoryItem[]>([]);
  // 'loading' and 'unread' are facts of their own: neither is an empty account.
  const [status, setStatus] = useState<'loading' | 'ready' | 'unread'>('loading');
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Bound to the account before any read.
      const scope = scopeGeneration();
      const sameAccount = (): boolean => !cancelled && scopeGeneration() === scope;
      void Promise.all([
        loadMissionCompletions(),
        loadDeck(),
        loadTopics(),
        loadActivity(),
        loadBookmarks(),
        loadSoundChecks(),
      ]).then(
        ([completions, cards, topics, activity, bookmarks, soundChecks]) => {
          if (!sameAccount()) return;
          const at = Date.now();
          const nextMissions = missionStates(missionCompletionsFrom(completions), cards, at);
          setDeck(cards);
          setMissions(nextMissions);
          setSuggested(suggestedMission(nextMissions));
          setSaved(savedSituations(bookmarks, DAILY_SCENARIOS));
          setChecks(soundChecks);
          setStatus('ready');
          // The two numbers the product event has always carried, still never drawn.
          const nextEvidence = evidenceFrom({ missions: nextMissions, book: buildPhrasebook(cards, topics, at), activity });
          void trackProductEvent({
            name: 'my_french_opened',
            properties: { situationsDone: nextEvidence.situations, linesKept: nextEvidence.lines },
          });
        },
        () => {
          // A failed read says so; what was drawn for this account stays.
          if (sameAccount()) setStatus((current) => (current === 'ready' ? 'ready' : 'unread'));
        },
      );
      void loadConversationPacks().then((stored) => {
        if (sameAccount()) setPacks(stored);
      });
      // A history that cannot be read says nothing rather than something false.
      void Promise.all([loadPracticeHistory(), loadPackMarks()])
        .then(([events, marks]) => {
          if (cancelled) return;
          setHistory(sameAccount() ? [...events, ...legacyMarkItems(marks)] : []);
        })
        .catch(() => {
          if (!cancelled) setHistory([]);
        });
      if (user) {
        void refreshConversationPacks(user, adapter).then((result) => {
          if (sameAccount() && result.ok) setPacks(result.packs);
        });
      }
      return () => {
        cancelled = true;
      };
    }, [user, adapter, attempt]),
  );

  const now = Date.now();
  const model: MyFrench = myFrenchFrom({ deck, missions, saved, packs, suggested, now });
  const path = levelPathFrom(missions);
  const bank = phraseBankFrom({ deck, voice, recordings: TUTOR_DAILY_AUDIO, items: DAILY_ITEMS });
  const map = soundsMapFrom(checks, now);
  const firstVisit = isFirstVisit({ progress: missions, deck, checks, packs: packs.length });
  const fingerprint = soundFingerprint(checks);
  // Past one measured call-out, the sound door opens the focused journey.
  const journey = soundJourney(checks, now);
  const recent = recentConversations({ packs, events: history });
  const progress = progressStatement(allConversations({ packs, events: history }));
  const goals = goalRows(profile.learnerGoals, MISSIONS);

  return (
    <ScrollScreen bottom="tab">
      <View style={st.head}>
        <TabHeader title={MY_FRENCH_TITLE} purpose={MY_FRENCH_PURPOSE} trailing={<ProfileButton />} />
      </View>

      {/* A failed read is a row like every other door, not a button. */}
      {status === 'unread' && (
        <View style={st.block}>
          <Ledger>
            <LedgerRow
              glyph={<DocumentGlyph color={paper.ink} />}
              label={MY_FRENCH_RETRY}
              title={MY_FRENCH_UNREAD}
              accessibilityLabel={`${MY_FRENCH_UNREAD} ${MY_FRENCH_RETRY}`}
              onPress={() => {
                setStatus('loading');
                setAttempt((n) => n + 1);
              }}
            />
          </Ledger>
        </View>
      )}

      {/* Your level, and the can-dos earned along the spine. */}
      {status === 'ready' && (
        <View style={st.group}>
          <Label>{NOTEBOOK.levelLabel}</Label>
          <Text style={st.level}>{levelLine(path.level)}</Text>
          <LevelPath levels={path.levels} />
        </View>
      )}

      {/* A first visit: one line on what will collect here, and nothing empty. */}
      {status === 'ready' && firstVisit && <Text style={st.firstVisit}>{NOTEBOOK.firstVisit}</Text>}

      {/* The phrase bank: the newest kept phrases, with audio, and one door to all of them. */}
      {bank.length > 0 && (
        <View style={st.group}>
          <Label>{SHELF_LABEL}</Label>
          <PhraseBank rows={bank} />
          <LedgerRow glyph={<QuoteGlyph color={paper.ink} />} title={SHELF_OPEN} onPress={() => nav.navigate('Phrasebook')} />
        </View>
      )}

      {/* The sounds map, once a measured check exists to mark it. */}
      {map.show && (
        <View style={st.group}>
          <Label>{NOTEBOOK.soundsLabel}</Label>
          <Text style={st.line}>{NOTEBOOK.soundsLine}</Text>
          <SoundsMap cells={map.cells} />
          {fingerprint !== null && (
            <Ledger>
              <LedgerRow
                glyph={<WaveformGlyph color={paper.ink} />}
                label={SOUND_FINGERPRINT_LABEL}
                title={fingerprint.line}
                accessibilityLabel={soundDoorLabel(journey)}
                onPress={() => (journey !== null ? nav.navigate('SoundJourney') : nav.navigate('SoundCheck', { missionId: fingerprint.missionId }))}
              />
            </Ledger>
          )}
        </View>
      )}

      {/* Your conversations, once one exists: the progress sentence, up to
          three recent rows, and one door into the whole library. */}
      {model.showConversations && (
        <View style={st.group}>
          <Label>{CONVERSATIONS_ROW}</Label>
          {progress !== null && <Text style={st.line}>{progress}</Text>}
          <Ledger>
            {recent.map((row) => (
              <LedgerRow
                key={row.pack.id}
                glyph={<DocumentGlyph color={paper.ink} />}
                label={row.pack.title.en} title={row.preview.join(' · ')} note={row.line} accessibilityLabel={row.accessibilityLabel}
                onPress={() => nav.navigate('Conversations', { packId: row.pack.id })}
              />
            ))}
            <LedgerRow glyph={<ChatGlyph color={paper.ink} />} title={RECENT_ALL} gloss={CONVERSATIONS_SUB} accessibilityLabel={RECENT_ALL} onPress={() => nav.navigate('Conversations')} />
          </Ledger>
        </View>
      )}

      {/* What the learner saved from Home, only when something is saved. */}
      {model.showSaved && (
        <View style={st.group}>
          <Label>{SAVED_LABEL}</Label>
          <Ledger>
            {model.saved.map((row) => (
              <LedgerRow
                key={row.scenario.id}
                glyph={<PlaceGlyph place={row.place} color={paper.ink} />}
                title={row.scenario.titleFr}
                gloss={row.scenario.titleEn}
                accessibilityLabel={row.accessibilityLabel}
                onPress={() => nav.navigate('Convo', { seedTopic: seedTopicOf(row.scenario) })}
              />
            ))}
          </Ledger>
        </View>
      )}

      {/* The learner's own goals, under the goal editor's own heading. */}
      {goals.length > 0 && (
        <View style={st.group}>
          <Label>{GOALS_LABEL}</Label>
          <Ledger>
            {goals.map((row) => (
              <LedgerRow key={row.goal} glyph={<DocumentGlyph color={paper.ink} />} label={GOALS_ROW_LABEL} title={row.goal} note={row.line} accessibilityLabel={row.spoken} onPress={() => nav.navigate('GoalStep', { key: goalRouteKey(row.goal) })} />
            ))}
          </Ledger>
        </View>
      )}

      {/* The quiet doors: the daily collection, and every situation in Missions. */}
      <View style={st.block}>
        <Ledger>
          <LedgerRow glyph={<QuoteGlyph color={paper.ink} />} label={DAILY_LABEL} title={DAILY_LINE} accessibilityLabel={DAILY_OPEN} onPress={() => nav.navigate('DailyLibrary')} />
          <LedgerRow glyph={<DocumentGlyph color={paper.ink} />} title={BROWSE_LINE} accessibilityLabel={BROWSE_OPEN} onPress={() => nav.navigate('Missions')} />
        </Ledger>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  // The blocks are the scroll's own children (F383): no wrapper that can grow.
  head: { position: 'relative' },
  block: { marginTop: space(4) },
  group: { marginTop: space(5), gap: space(3) },
  level: { ...type.body, color: paper.ink },
  line: { ...type.small, color: paper.inkSoft },
  firstVisit: { ...type.body, color: paper.inkSoft, marginTop: space(4) },
});
