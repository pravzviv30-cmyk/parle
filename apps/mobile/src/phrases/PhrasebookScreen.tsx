import { needsPhraseSearch, searchPhrases } from './search.ts';
import { Feedback } from '../motion/Feedback.tsx';
import { EmptyStateCard } from '../empty/EmptyStateCard.tsx';
import { NOTEBOOK_ART } from '../empty/emptyStates.ts';
/**
 * Your phrases — every line that has become the learner's, as a route (F575).
 *
 * It was an early return inside My French: rendered in place, reachable from
 * one screen, with a back arrow that was really a piece of component state.
 * That was fine while nothing else had to link to it, which stopped being true
 * the moment My French folded down to a shelf row and Settings grew a door of
 * its own. It is a stack route now, above the tabs like every other pushed
 * screen, so the bar goes with the push and an address can carry it.
 *
 * ## Three things, in the order a learner wants them
 *
 * One line to say right now, which is the only place in this part of the app
 * where a learner produces French and is deliberately the smallest possible
 * version of that (`myfrench/OneLineCard.tsx` explains why it is one card and
 * never a queue). Then the lines that came out in real conversations, grouped
 * by the conversation they came out of, each with a way to hear it said. Then
 * the words that buy a moment, which are authored, so the page has a section on
 * a first morning rather than an apology.
 *
 * Every section is absent until it is real. There is no empty state and no
 * count: the learner is looking at the list, so a total over it would be a
 * number asking to be compared with last month's, and this screen refuses
 * numbers for the reason `phrases/phrasebook.ts` already gives.
 *
 * ## What is drawn here and what is not
 *
 * `phrases/phrasebook.ts` decides which lines exist and how they are grouped,
 * `myfrench/oneLine.ts` deals the card, `myfrench/cadence.ts` owns the
 * connectors, and `phrases/phrasebookView.ts` holds the two words this screen
 * says for itself. This file reads, gates on null, and lays out.
 *
 * The voice stops when the screen goes. One that follows a learner onto
 * another tab is F304.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { IconAction, Card, Field, GhostButton, Label } from '../components.tsx';
import { SpeakerGlyph } from '../glyphs.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useRecordedLine } from '../practice/recordedPlayer.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { dailyTutorVoice, tutorAudioForFrench } from '../daily/tutorAudio.ts';
import { tutorVoice, type ConversationPack } from '@luvani/core';
import { sourceForKeptFrench } from './phraseAudioSource.ts';
import { useKeptPhraseAudio } from './useKeptPhraseAudio.ts';
import { paper, radius, space, type, HAIRLINE, HIT } from '../theme.ts';
import { loadDeck } from '../review/store.ts';
import { loadTopics } from '../topics/store.ts';
import { CadenceCard } from '../myfrench/CadenceCard.tsx';
import { OneLineCard } from '../myfrench/OneLineCard.tsx';
import { cadenceFrom, type Cadence } from '../myfrench/cadence.ts';
import { LEDGER } from '../myfrench/ledger.ts';
import { oneLineFrom, type OneLine } from '../myfrench/oneLine.ts';
import { buildPhrasebook, hasPhrases, hasSaved, SAVED_NOTE, SAVED_TITLE, type Phrasebook, type SavedPhrase } from './phrasebook.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { CADENCE_NOTE, PHRASEBOOK_TITLE, cadenceToggleLabel, hasCadence, speakerLabel } from './phrasebookView.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';

let nextVisit = 0;

export function PhrasebookScreen({ onBack }: { onBack: () => void }) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  const nav = useNavigation<{ navigate: (screen: string) => void }>();
  const [book, setBook] = useState<Phrasebook | null>(null);
  const [bookScope, setBookScope] = useState<number | null>(null);
  const [unread, setUnread] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [visit, setVisit] = useState(0);
  const [sourcePacks, setSourcePacks] = useState<ConversationPack[]>([]);
  const [oneLine, setOneLine] = useState<OneLine | null>(null);
  const [cadence, setCadence] = useState<Cadence | null>(null);
  // Which line is sounding, so its own button offers to stop it and no other
  // button claims to. Null is silence.
  const [playingId, setPlayingId] = useState<string | null>(null);
  const { profile } = useProfile();
  const selectedVoice = dailyTutorVoice(profile.tutorVoice);
  const voiceRef = useRef(selectedVoice);
  voiceRef.current = selectedVoice;
  const owner = scopeGeneration();
  const visibleBook = bookScope === owner ? book : null;
  const displayBook = visibleBook === null ? null : searchPhrases(visibleBook, query);
  const recorded = useRecordedLine({ isCurrent: () => owner === scopeGeneration() && selectedVoice === voiceRef.current });
  const keptAudio = useKeptPhraseAudio(selectedVoice);
  const dynamicAudio = process.env.EXPO_PUBLIC_LUVANI_KEPT_PHRASE_AUDIO === '1';
  const sourceFor = (french: string) => dynamicAudio ? sourceForKeptFrench(french, sourcePacks, activeUserId()) : null;
  const canHear = (phrase: SavedPhrase) => assetFor(phrase.front) !== undefined || sourceFor(phrase.front) !== null;
  const audioPlaying = (phrase: SavedPhrase) => (playingId === phrase.id && recorded.playing === assetFor(phrase.front)) || keptAudio.playingId === phrase.id;
  const audioNote = (phrase: SavedPhrase) => keptAudio.loadingId === phrase.id ? 'Preparing tutor audio…' : keptAudio.failedId === phrase.id || !canHear(phrase) ? 'Tutor audio is not ready for this phrase yet.' : voiceLabel;
  const assetFor = (french: string) => tutorAudioForFrench(TUTOR_DAILY_AUDIO, DAILY_ITEMS, french, selectedVoice);
  const voiceLabel = `${tutorVoice(selectedVoice).persona.name}'s voice`;
  // Bumped after a grade, so the page re-reads the deck it has just written to.
  const [graded, setGraded] = useState(0);
  // The authored connectors are an optional collection, closed on every visit.
  const [cadenceOpen, setCadenceOpen] = useState(false);

  useEffect(() => {
    recorded.stop();
    setPlayingId(null);
  }, [selectedVoice, owner, recorded.stop]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const account = scopeGeneration();
      setVisit(++nextVisit);
      setQuery('');
      setBook(null); setBookScope(null); setOneLine(null); setCadence(null); setSourcePacks([]); setUnread(false);
      void Promise.all([loadDeck(), loadTopics(), loadConversationPacks()])
        .then(([deck, topics, packs]) => {
          if (cancelled || account !== scopeGeneration()) return;
          const now = Date.now();
          setBook(buildPhrasebook(deck, topics, now, packs));
          setBookScope(account);
          setSourcePacks(packs);
          setOneLine(oneLineFrom({ deck, now }));
          setCadence(cadenceFrom({ deck }));
        })
        .catch(() => {
          if (!cancelled && account === scopeGeneration()) setUnread(true);
        });
      return () => {
        cancelled = true;
      };
    }, [graded, attempt, owner]),
  );

  const say = (phrase: SavedPhrase) => {
    const asset = assetFor(phrase.front);
    if (asset === undefined) {
      const source = sourceFor(phrase.front);
      if (!source) return;
      recorded.stop(); setPlayingId(null);
      void keptAudio.hear(phrase.id, phrase.front, source);
      return;
    }
    keptAudio.stop();
    if (playingId === phrase.id && recorded.playing === asset) {
      recorded.stop();
      setPlayingId(null);
      return;
    }
    setPlayingId(phrase.id);
    recorded.play(asset);
  };

  return (
    <ScrollScreen bottom="inset" header={<ScreenHeader back={{ onPress: onBack }} />}>
      <View style={st.head}>
        <Text accessibilityRole="header" style={st.title}>
          {PHRASEBOOK_TITLE}
        </Text>
      </View>

      {visibleBook !== null && needsPhraseSearch(visibleBook) && <Field label="Find a phrase" value={query} onChangeText={setQuery} placeholder="French or English" maxLength={120} />}
      {visibleBook !== null && query.trim() !== '' && displayBook !== null && !hasPhrases(displayBook) && !hasSaved(displayBook) && <Text accessibilityLiveRegion="polite" style={[type.small, { color: t.text }]}>No matching phrases.</Text>}

      {unread && <Card><Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text }]}>Your phrases could not be loaded. They may still be saved; try again.</Text><IconAction layout="inline" icon="refresh" label="Retry phrases" onPress={() => setAttempt(value => value + 1)} /></Card>}

      {visibleBook !== null && !hasPhrases(visibleBook) && !hasSaved(visibleBook) && query.trim() === '' && <EmptyStateCard art={NOTEBOOK_ART} title="Your first kept phrase lands here." body={null} action={{ label: 'Choose a scene', onPress: () => nav.navigate('Missions') }} />}

      {/* The one card this visit deals, at the top, so the thing worth doing is
          never below a list of things already done. */}
      {visibleBook !== null && query.trim() === '' && oneLine !== null && <OneLineCard line={oneLine} onGraded={() => setGraded((n) => n + 1)} />}

      {displayBook !== null && hasPhrases(displayBook) && (
        <Feedback kind="reopened" active appear eventKey={`phrasebook-${visit}`}><View style={st.block}>
          <Label>{LEDGER.rowsLabel}</Label>
          <View style={st.groups}>
            {displayBook.groups.map((group) => (
              <Card key={group.id}>
                <Label color={t.muted}>{group.title}</Label>
                <View style={st.rows}>
                  {group.phrases.map((phrase, index) => (
                    <PhraseRow
                      key={phrase.id}
                      phrase={phrase}
                      first={index === 0}
                      playing={audioPlaying(phrase)}
                      audioLabel={audioNote(phrase)}
                      source={group.id === 'lessons' ? null : group.title}
                      onHear={canHear(phrase) ? () => say(phrase) : undefined}
                    />
                  ))}
                </View>
              </Card>
            ))}
          </View>
        </View></Feedback>
      )}

      {/* Saved but not yet recalled, apart from the lines above and under a
          name that claims nothing about holding them. A saved phrase used to
          vanish here, because the list above is recalled lines only. */}
      {displayBook !== null && hasSaved(displayBook) && (
        <Feedback kind="reopened" active appear eventKey={`phrasebook-${visit}`}><View style={st.block}>
          <Label>{SAVED_TITLE}</Label>
          <Text style={st.savedNote}>{SAVED_NOTE}</Text>
          <Card style={st.savedCard}>
            {displayBook.saved.map((phrase, index) => (
              <PhraseRow
                key={phrase.id}
                phrase={phrase}
                first={index === 0}
                playing={audioPlaying(phrase)}
                audioLabel={audioNote(phrase)}
                source={phrase.source ?? null}
                onHear={canHear(phrase) ? () => say(phrase) : undefined}
              />
            ))}
          </Card>
        </View></Feedback>
      )}

      {/* Authored, so it is here on a first morning too, but it is an optional
          collection now (Stage 3): one quiet row, closed until asked for, so
          the learner's own lines lead and the glossary never outweighs them. */}
      {visibleBook !== null && query.trim() === '' && hasCadence(cadence) && (
        <View style={st.block}>
          <Pressable
            onPress={() => setCadenceOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: cadenceOpen }}
            style={({ pressed }) => [st.disclosure, pressed && st.speakerPressed]}
          >
            <Text style={[type.bodyStrong, { color: t.text }]}>{cadenceToggleLabel(cadenceOpen)}</Text>
            {!cadenceOpen && <Text style={st.savedNote}>{CADENCE_NOTE}</Text>}
          </Pressable>
          {cadenceOpen && <CadenceCard cadence={cadence} />}
        </View>
      )}
    </ScrollScreen>
  );
}

/**
 * One kept line, and a way to hear it.
 *
 * No mark, and that is deliberate. The old screen drew a dot per phrase in the
 * practice path's three-state vocabulary, which turned a page of the learner's
 * own French into a rail of how well they are holding it. The scheduler already
 * knows; a learner reading their own sentences does not need to be told which
 * ones are slipping while they read them.
 */
function PhraseRow({
  phrase,
  first,
  playing,
  audioLabel,
  source,
  onHear,
}: {
  /** A recalled phrase or a saved one; the row reads only the words, never a shelf. */
  phrase: SavedPhrase;
  /** The first row in a card carries no rule above it. */
  first: boolean;
  playing: boolean;
  audioLabel: string;
  source: string | null;
  onHear?: () => void;
}) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  return (
    <View style={[st.row, !first && st.ruled]}>
      <View style={st.words}>
        <Text style={[type.french, { color: t.text }]}>{phrase.front}</Text>
        <Text style={[type.small, { color: t.muted, marginTop: space(1) }]}>{phrase.back}</Text>
        {source !== null && <Text style={[type.small, { color: t.muted, marginTop: space(1) }]}>From {source}</Text>}
        <Text style={[type.small, { color: t.muted, marginTop: space(1) }]}>{audioLabel}</Text>
      </View>
      {onHear !== undefined && <Pressable
        onPress={onHear}
        accessibilityRole="button"
        accessibilityLabel={speakerLabel(phrase.front, playing)}
        style={({ pressed }) => [st.speaker, pressed && st.speakerPressed]}
      >
        <SpeakerGlyph color={t.text} />
      </Pressable>}
    </View>
  );
}

function makeSt(t: B) {
  return StyleSheet.create({
  // The title and the scene share a row, both sitting on the same baseline, so
  // the drawing reads as part of the heading rather than as a banner over it.
  // On the page itself (notebook Phase 4, 2026-09-27): no feature paper and no
  // ink outline, so the heading is a heading rather than a panel.
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(3), marginTop: space(2) },
  title: { ...type.display, color: t.text, flexGrow: 1, flexBasis: 160, minWidth: 0 },
  // Placement only. The size is the registry's, never a number written here.
  art: { flexShrink: 0 },
  block: { marginTop: space(7) },
  groups: { marginTop: space(3), gap: space(3) },
  rows: { marginTop: space(2) },
  savedNote: { ...type.small, color: t.muted, marginTop: space(1) },
  savedCard: { marginTop: space(3) },
  // The collection's row: a full-width target at the touch floor, no card of
  // its own, so it reads as a quiet door rather than another block of content.
  disclosure: { minHeight: HIT, justifyContent: 'center', paddingVertical: space(2), borderRadius: radius.row },
  // The words take the room and the button keeps its floor, so a long line
  // wraps rather than squeezing the control under the touch minimum.
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, paddingVertical: space(2) },
  ruled: { borderTopWidth: HAIRLINE, borderTopColor: t.line },
  words: { flex: 1, minWidth: 0 },
  // The ink speaker on a white disc under a paper hairline, which is what makes
  // it read as a button on a white card now the whisper has retired. It is the
  // thing you press, not a state being reported.
  speaker: {
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    backgroundColor: t.card,
    borderWidth: HAIRLINE,
    borderColor: t.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerPressed: { backgroundColor: t.skeleton },
});
}
