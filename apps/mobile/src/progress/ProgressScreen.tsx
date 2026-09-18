/**
 * Real progress — the evidence, one level down from Home (F572).
 *
 * Home used to carry the whole of this: the week's account, the abilities, four
 * momentum cards and the day's word, under the one card that asks a learner to
 * speak tonight. The founder's revamp gives Home a single row that says how far
 * this has come, and that row opens here. So nothing was deleted; it moved,
 * and it got a screen of its own rather than a sixth of one.
 *
 * ## What it says, and who decided it
 *
 * Four blocks, in the order a person actually wants them. What happened this
 * week (`progress/story.ts`, absent entirely on a quiet week). What you can now
 * do on your own (`progress/progressView.ts` over the passport's stamps). Your
 * momentum, which is the four cards `progress/momentum.ts` words. And the day's
 * word at the foot, which is a fact about the day rather than a claim about the
 * learner.
 *
 * Not one of those decisions is in this file. It reads, it gates on null, and
 * it lays out. Every heading comes from `progressView.ts` and every sentence
 * from the module that owns the thing it describes, because there is no
 * renderer in this workspace and a sentence written here is a sentence no test
 * can read back.
 *
 * ## Null is "not read yet", never "nothing to show"
 *
 * Every block waits on its own read and draws nothing until it answers. A
 * momentum block built from an unanswered disk would show a first morning to
 * somebody who has been talking for months, which is `HomeTab`'s rule and the
 * reason the failure branch below restores the word and nothing else: a count
 * that could not be read is not a nought.
 *
 * ## Why the rows open a conversation
 *
 * A tinted row ends in a chevron, and a chevron that opens nothing is a lie
 * told in a glyph. A place the learner has already handled alone is a place
 * worth walking back into, so the row goes where the passport's own situations
 * card goes: the conversation, with the mission's id.
 */

import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import {
  DAILY_WORDS,
  dailyPick,
  levelFor,
  missionStates,
  totalXp,
  wordsForLevel,
  type DailyWord,
} from '@luvani/core';

import { Label, TintPanel, TintRow } from '../components.tsx';
import { PlaceGlyph, WaveformGlyph } from '../glyphs.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { accent, DISC, HAIRLINE, paper, space, type } from '../theme.ts';
import { missionTint } from '../missions/missionTint.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { loadDeck } from '../review/store.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { loadActivity } from './activity.ts';
import { loadHistory } from './store.ts';
import { stampsFrom } from './passport.ts';
import { momentumFrom, type Momentum } from './momentum.ts';
import { hasStory, storyFrom, type WeekStory } from './story.ts';
import { MomentumCards } from './MomentumCards.tsx';
import { WordOfDayCard } from './WordOfDayCard.tsx';
import { WORD_SCENES, type WordSceneKey } from './wordScenes.ts';
import { gentlestWord } from './gentlestWord.ts';
import {
  CAN_DO_LABEL,
  MOMENTUM_LABEL,
  POSTCARD_NOTE,
  POSTCARD_TITLE,
  PROGRESS_TITLE,
  canDoRows,
  hasCanDo,
  type CanDoRow,
} from './progressView.ts';

export function ProgressScreen({ onBack }: { onBack: () => void }) {
  // A pushed screen, so the day's scene stops the moment something is pushed
  // over the top of it. Handed down rather than asked for, exactly as Home
  // hands it down: a scene cannot ask for its own focus above the navigator.
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();

  const [story, setStory] = useState<WeekStory | null>(null);
  const [rows, setRows] = useState<readonly CanDoRow[] | null>(null);
  const [momentum, setMomentum] = useState<Momentum | null>(null);
  const [word, setWord] = useState<DailyWord | null>(null);
  const [scene, setScene] = useState<WordSceneKey | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const now = Date.now();
      // The drawing is a pure function of the day and a pool of twenty, so it
      // never waits on a disk and says nothing about the learner.
      setScene(dailyPick(WORD_SCENES, now));
      void Promise.all([
        loadActivity(),
        loadDeck(),
        loadMissionCompletions(),
        loadHistory(),
        loadConversationPacks(),
      ])
        .then(([activity, deck, completions, history, packs]) => {
          if (cancelled) return;
          const standing = levelFor(totalXp(activity));
          setWord(dailyPick(wordsForLevel(DAILY_WORDS, standing.index), now));
          setMomentum(momentumFrom({ activity, deck, profile, now }));
          const progress = missionStates(missionCompletionsFrom(completions), deck, now);
          setRows(canDoRows(stampsFrom(progress)));
          // Whole, every one of them. Which seven days count is story.ts's
          // decision and its guarantee, and narrowing here would walk past it.
          setStory(storyFrom({ sessions: history, activity, packs, completions, now }));
        })
        .catch(() => {
          if (cancelled) return;
          // The word survives, pitched at the gentlest tier, because it is a
          // fact about the day rather than a claim about this learner. The
          // week, the places and the counts do not: a nought where a real
          // number belongs is the app forgetting somebody.
          setWord(gentlestWord(now));
        });
      return () => {
        cancelled = true;
      };
    }, [profile]),
  );

  return (
    <ScrollScreen bottom="inset" header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Text accessibilityRole="header" style={st.title}>
        {PROGRESS_TITLE}
      </Text>

      {/* The week, told back. Absent on a quiet week, because a surface that
          can render empty is a quota and a quota nobody met is guilt. */}
      {story !== null && hasStory(story) && (
        <FrenchPostcard>
          {story.sentences.map((sentence) => (
            <Text key={sentence} style={st.sentence}>
              {sentence}
            </Text>
          ))}
        </FrenchPostcard>
      )}

      {rows !== null && hasCanDo(rows) && (
        <View style={st.block}>
          <Label>{CAN_DO_LABEL}</Label>
          <View style={st.rows}>
            {rows.map((row) => (
              <TintRow
                key={row.missionId}
                tint={missionTint(row.place)}
                glyph={<PlaceGlyph place={row.place} color={accent.primary} />}
                title={row.title}
                onPress={() => nav.navigate('Convo', { missionId: row.missionId })}
              />
            ))}
          </View>
        </View>
      )}

      {momentum !== null && (
        <View style={st.block}>
          <Label>{MOMENTUM_LABEL}</Label>
          <MomentumCards momentum={momentum} onReviewPhrases={() => nav.navigate('Review')} />
        </View>
      )}

      {word !== null && scene !== null && <WordOfDayCard word={word} scene={scene} paused={!focused} />}
    </ScrollScreen>
  );
}

/**
 * The existing weekly story, presented as something worth keeping rather than
 * another dashboard. The child sentences arrive whole from `story.ts`; this
 * frame adds no count, comparison, share affordance or second interpretation.
 */
function FrenchPostcard({ children }: { children: ReactNode }) {
  return (
    <View style={st.story} accessibilityRole="summary">
      <TintPanel tint="lilac" style={st.postcard}>
        <View style={st.postcardHead}>
          <View style={st.postmark}>
            <WaveformGlyph color={accent.primary} />
          </View>
          <View style={st.postcardWords}>
            <Text style={st.postcardTitle}>{POSTCARD_TITLE}</Text>
            <Text style={st.postcardNote}>{POSTCARD_NOTE}</Text>
          </View>
        </View>
        <View style={st.postcardRule} />
        <View style={st.storyWords}>{children}</View>
      </TintPanel>
    </View>
  );
}

const st = StyleSheet.create({
  title: { ...type.display, color: paper.ink, marginTop: space(2) },
  // A quiet lilac field makes the true story feel like a keepsake without
  // competing with the capability rows below it. No shadow and no signal
  // colour: this reflects; it does not report a state.
  story: { marginTop: space(5) },
  postcard: { padding: space(4) },
  postcardHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  postmark: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    backgroundColor: paper.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  postcardWords: { flex: 1, minWidth: 0 },
  postcardTitle: { ...type.cardTitle, color: paper.ink },
  postcardNote: { ...type.small, color: paper.inkSoft, marginTop: space(1) },
  postcardRule: { height: HAIRLINE, backgroundColor: paper.line, marginVertical: space(3) },
  storyWords: { gap: space(2) },
  // Sentences a learner reads, so they are set in ink at body size: soft ink
  // clears the floor for a mark and these are words.
  sentence: { ...type.body, color: paper.ink },
  block: { marginTop: space(7) },
  rows: { marginTop: space(3), gap: space(2) },
});
