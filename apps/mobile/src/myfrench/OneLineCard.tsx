import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { IconAction, Card, GhostButton, Label, OutlineButton, PillButton } from '../components.tsx';
import { HAIRLINE, HIT, font, paper, radius, space, type } from '../theme.ts';
import { CARD_START, SAID_IT, cardView, typedAttemptReady, type ReviewTurn } from '../review/cardView.ts';
import { gradeCard } from '../review/store.ts';
import { CHECK, CLOSING_LINE, GRADE_LABELS, ONE_LINE_LABEL, TYPE_LABEL, TYPE_PROMPT, type OneLine } from './oneLine.ts';
import { LEDGER } from './ledger.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';

/**
 * One line, asked for and then let go of.
 *
 * This is the only place in My French where the learner produces French, and it
 * is deliberately the smallest possible version of that. One card. No queue, no
 * position, no second card after the grade, and no way to ask for another. The
 * sitting already has a screen; this is the sixty seconds a learner spends on a
 * page they opened to look at.
 *
 * ## What is borrowed rather than rebuilt
 *
 * `cardView` decides which face is the question and whether the answer may be
 * shown; `gradeCard` writes the grade through the one scheduler. Neither is
 * reimplemented here, because a second copy of the reveal gate is how one
 * surface starts handing out the French for a keystroke while the other still
 * asks for it. `dealtAt` is frozen at mount for the same reason ReviewScreen
 * freezes it: a card must not change its mind about being due while the learner
 * is looking at it.
 *
 * ## Two ways to answer, and no microphone
 *
 * Revamp A gave the card the field the sitting has. Both ways are on screen at
 * once and neither is the right one: typing suits a quiet carriage, saying it
 * suits a kitchen, and "I said it" is taken on trust because the alternative is
 * a microphone this page is never going to grow. Both land the same attempt
 * through `cardView`, so the reveal gate is identical either way and nothing
 * here records, listens or scores.
 */
export function OneLineCard({ line, onGraded }: { line: OneLine; onGraded: () => void }) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  const dealtAt = useRef(Date.now());
  const [turn, setTurn] = useState<ReviewTurn>(CARD_START);
  const [done, setDone] = useState(false);
  const view = cardView(line.card, dealtAt.current, turn);

  // The settled tier is shown and never asked for, so it skips the attempt and
  // the grades alike: a card the scheduler is not asking for is a gift, and
  // grading it would put it back in a queue the learner had got out of.
  const asks = line.askable && view.asksForAttempt;
  const grades = line.askable && view.grades && !done;

  return (
    <Card style={{ marginTop: space(6) }}>
      <Label>{ONE_LINE_LABEL}</Label>
      <Text style={[type.small, { color: t.muted, marginTop: space(2) }]}>{line.reason}</Text>

      <Text style={[type.title, { color: t.text, marginTop: space(3) }]}>{view.prompt}</Text>
      {view.ask !== null && !view.revealed && line.askable && (
        <Text style={[type.small, { color: t.muted, marginTop: space(1) }]}>{view.ask}</Text>
      )}

      {/* The French, once it has been earned or when it was never withheld. */}
      {(view.answer !== null || !line.askable) && (
        <View style={st.answer}>
          <Text style={[type.french, { color: t.text }]}>
            {view.answer?.text ?? line.card.front}
          </Text>
          {(view.answer?.ipa ?? '') !== '' && (
            <Text style={[type.notation, { color: t.muted }]}>{view.answer?.ipa}</Text>
          )}
          {(view.answer?.context ?? '') !== '' && (
            <Text style={[type.small, { color: t.muted }]}>
              {LEDGER.noteLabel} {view.answer?.context}
            </Text>
          )}
        </View>
      )}

      {asks && (
        <View style={st.attempt}>
          <TextInput
            value={turn.typed}
            onChangeText={(typed) => setTurn((t) => ({ ...t, typed }))}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (typedAttemptReady(turn.typed)) setTurn((t) => ({ ...t, attempt: 'typed' }));
            }}
            placeholder={TYPE_PROMPT}
            placeholderTextColor={t.muted}
            accessibilityLabel={TYPE_LABEL}
            style={[st.input, { fontFamily: font.regular, fontSize: type.body.fontSize }]}
          />
          <OutlineButton
            label={CHECK}
            disabled={!typedAttemptReady(turn.typed)}
            onPress={() => setTurn((t) => ({ ...t, attempt: 'typed' }))}
          />
          <PillButton label={SAID_IT} onPress={() => setTurn((t) => ({ ...t, attempt: 'said' }))} />
        </View>
      )}

      {grades && (
        <View style={st.grades}>
          <OutlineButton
            label={GRADE_LABELS.good}
            onPress={() => {
              void gradeCard(line.card.id, 'good', view.gradeContext);
              setDone(true);
              onGraded();
            }}
          />
          <IconAction layout="inline" icon="replay"
            label={GRADE_LABELS.again}

            onPress={() => {
              void gradeCard(line.card.id, 'again', view.gradeContext);
              setDone(true);
              onGraded();
            }}
          />
        </View>
      )}

      {done && <Text style={[type.small, { color: t.muted, marginTop: space(4) }]}>{CLOSING_LINE}</Text>}
    </Card>
  );
}

function makeSt(t: B) {
  return StyleSheet.create({
  answer: { marginTop: space(3), gap: space(1) },
  // The two ways to answer, stacked: the field and its outline, then the word.
  attempt: { marginTop: space(4), gap: space(2.5) },
  // The paper text field, in the Field anatomy the drills and the deck use.
  // Type styles from the theme, minus lineHeight, which clips a single-line
  // TextInput on iOS.
  input: {
    minHeight: HIT + 8,
    backgroundColor: t.card,
    borderWidth: HAIRLINE,
    borderColor: t.field,
    borderRadius: radius.input,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    color: t.text,
  },
  // The two grade controls, stacked rather than in a row: "That was it" is a
  // sentence and a row of two sentences wraps into nonsense at the largest
  // reading size, which is the defect F383 already found on this tab.
  grades: { marginTop: space(4), gap: space(1) },
});
}
