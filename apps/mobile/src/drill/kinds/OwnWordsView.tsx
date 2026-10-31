/** Say it your own way, and what an attempt came back with. Moved from DrillScreen with no change. */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { OwnWordsExercise, SettledVerdict } from '@luvani/core';
import { space, type } from '../../theme.ts';
import { useB, useThemedStyles } from '../../main/bTheme.tsx';
import { Card, CheckGlyph, IconAction, Label } from '../../components.tsx';
import { DrillFrame, DrillPrompt, type DrillShell } from '../DrillFrame.tsx';
import { drillStage } from '../drillStage.ts';
import { SpokenAttempt } from '../SpokenAttempt.tsx';
import { ownWordsLook } from '../answerSheet.ts';
import type { OwnWordsDecided } from '../combo.ts';
import { MADE_FROM } from '../../practice/madeFrom.ts';
import { OWN_WORDS_ANOTHER, OWN_WORDS_FIELD_LABEL, OWN_WORDS_HINT, OWN_WORDS_NOT_KEPT, OWN_WORDS_PROMPT } from '../ownWordsCopy.ts';
import { CAN_RECORD, CheckPill, TypedAnswer, kindTag, outcomeGround } from './shared.tsx';
import { makeDs } from './styles.ts';

/**
 * What one own-words attempt came back with.
 *
 * Held as a value rather than as the timed feedback beat every other kind
 * uses, because there is more to read here than a word: a second way to say
 * it, or the judge's own sentence, or the line itself when nobody could read
 * the attempt. A 1.6 second beat would take all three away mid-sentence.
 */
export interface OwnWordsOutcome {
  /** The exercise it belongs to, so the card survives the sitting finishing. */
  exercise: OwnWordsExercise;
  /** Core's settled verdict, or null when nobody judged it and nothing moved. */
  verdict: SettledVerdict | null;
  /** How core decided it, which sets the card's tone; null when nobody judged it. */
  decided: OwnWordsDecided | null;
  /** Core's own feedback line, or the line that says the tutor is unreachable. */
  message: string;
  /** The judge's sentence, before a second go. */
  note: string | null;
  /** A better way, offered after a success and never instead of one. */
  another: string | null;
  /** The taught line, when the attempt is let go or nobody could read it. */
  reveal: string | null;
  /** They said it their own way: offer to keep the phrase. */
  keep: boolean;
  /** The learner's checked words, held only on this screen for comparison. */
  attempt: string | null;
}

/**
 * Say it your own way.
 *
 * The one drill kind with no right string. The situation sets the scene, the
 * English says what has to get across, and the field takes whatever French the
 * learner has. A temporary take can supply editable text. Checking meaning
 * still uses the text judge, and never claims a pronunciation score.
 *
 * It borrows `TypedAnswer` rather than growing a field of its own, which is
 * also what keeps the drill's Check at exactly two shared pills.
 */
export function OwnWordsView({
  exercise,
  typed,
  onChange,
  onCheck,
  onTake,
  quiet = false,
  busy,
  outcome,
  onKeep,
  keeping,
  kept,
  keepFailed,
  shell,
}: {
  exercise: OwnWordsExercise;
  typed: string;
  onChange: (t: string) => void;
  onCheck: () => void;
  onTake: (uri: string | null) => void;
  quiet?: boolean;
  /** A judge is reading it. The field and the pill are off until it answers. */
  busy: boolean;
  outcome: OwnWordsOutcome | null;
  onKeep: () => void;
  keeping: boolean;
  /** The phrasebook said its write is durable. Only then is it called saved. */
  kept: boolean;
  /** The last keep was refused; it can be tried again. */
  keepFailed: boolean;
  shell: DrillShell;
}) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  const [typing, setTyping] = useState(!CAN_RECORD || quiet);
  const typeInstead = useCallback(() => setTyping(true), []);
  const look = ownWordsLook(outcome?.decided ?? null);
  const ground = look.tone === null ? null : outcomeGround(look.tone, bt);
  const soft = ground === null ? bt.muted : ground.soft;
  // Words on every outcome ground follow the theme (drill B v2).
  const ink = ground === null ? bt.text : ground.ink;
  const field = typing || typed !== '' || outcome !== null;
  return (
    <DrillFrame
      {...shell}
      stage={drillStage(exercise.kind, bt.mode)}
      eyebrow={kindTag(exercise)}
      prompt={<>
        <Text style={[type.small, { color: bt.muted }]}>{exercise.situation}</Text>
        <DrillPrompt>{exercise.en}</DrillPrompt>
      </>}
      english={OWN_WORDS_HINT}
      primary={field ? <CheckPill typed={typed} locked={busy} onSubmit={onCheck} /> : undefined}
    >
      {!typing && typed === '' && outcome === null && <SpokenAttempt onTake={onTake} onTyping={typeInstead} busy={busy} />}
      {field && <TypedAnswer
        typed={typed}
        onChange={onChange}
        onSubmit={onCheck}
        locked={busy}
        placeholder={OWN_WORDS_PROMPT}
        accessibilityLabel={OWN_WORDS_FIELD_LABEL}
      />}
      {busy && <ActivityIndicator color={bt.muted} />}
      {outcome !== null && (
        <Card style={[ds.outcome, ground !== null && { backgroundColor: ground.fill }]}>
          {outcome.attempt !== null && <View style={{ gap: space(1) }}>
            <Label color={soft}>Your words</Label>
            <Text style={[type.body, { color: ink }]}>{outcome.attempt}</Text>
          </View>}
          <View style={ds.outcomeRow} accessibilityLiveRegion="polite">
            {/* Same rule as the answer sheet: no mark on a miss, and a retry
                is not a pass. A drawing scolds louder than a word, and this
                card is read for longer. */}
            {look.mark && (
              <View style={ds.verdictMark}><CheckGlyph size={18} color={bt.text} /></View>
            )}
            <Text style={[type.bodyStrong, { color: ink, flex: 1 }]}>
              {outcome.message}
            </Text>
          </View>
          {outcome.note !== null && <Text style={[type.body, { color: ink }]}>{outcome.note}</Text>}
          {outcome.another !== null && (
            <Text style={[type.body, { color: ink }]}>{OWN_WORDS_ANOTHER(outcome.another)}</Text>
          )}
          {outcome.reveal !== null && <Text style={[type.french, { color: ink }]}>{outcome.reveal}</Text>}
          {/* Kept means the phrasebook's write came back durable, and only
              then does the bookmark fill and the label say so (F762). A
              refused write says it plainly and leaves the way to try again. */}
          {outcome.keep && (
            <IconAction
              layout="inline"
              ground={look.tone === 'good' ? 'mint' : 'paper'}
              icon="bookmark"
              animate="bookmark-fill"
              selected={kept}
              busy={keeping}
              label={kept ? MADE_FROM.phrase.saved : MADE_FROM.phrase.save}
              onPress={onKeep}
            />
          )}
          {outcome.keep && keepFailed && !kept && (
            <Text accessibilityLiveRegion="polite" style={[type.small, { color: soft }]}>{OWN_WORDS_NOT_KEPT}</Text>
          )}
        </Card>
      )}
    </DrillFrame>
  );
}
