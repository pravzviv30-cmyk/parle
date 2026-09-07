import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, GhostButton, Label, OutlineButton, PillButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { CARD_START, SAID_IT, cardView, type ReviewTurn } from '../review/cardView.ts';
import { gradeCard } from '../review/store.ts';
import { CLOSING_LINE, GRADE_LABELS, ONE_LINE_LABEL, type OneLine } from './oneLine.ts';
import { LEDGER } from './ledger.ts';

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
 * ## No keyboard, and no microphone
 *
 * ReviewScreen offers a text field beside "I said it" because a sitting is
 * long enough to type into. This is not, so there is one affordance. The
 * invariant that a learner is never forced to speak aloud is already kept by
 * the ask itself, which says out loud or in your head, and nothing here
 * records, listens or scores.
 */
export function OneLineCard({ line, onGraded }: { line: OneLine; onGraded: () => void }) {
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
      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{line.reason}</Text>

      <Text style={[type.title, { color: paper.ink, marginTop: space(3) }]}>{view.prompt}</Text>
      {view.ask !== null && !view.revealed && line.askable && (
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{view.ask}</Text>
      )}

      {/* The French, once it has been earned or when it was never withheld. */}
      {(view.answer !== null || !line.askable) && (
        <View style={st.answer}>
          <Text style={[type.french, { color: paper.ink }]}>
            {view.answer?.text ?? line.card.front}
          </Text>
          {(view.answer?.ipa ?? '') !== '' && (
            <Text style={[type.notation, { color: paper.inkSoft }]}>{view.answer?.ipa}</Text>
          )}
          {(view.answer?.context ?? '') !== '' && (
            <Text style={[type.small, { color: paper.inkSoft }]}>
              {LEDGER.noteLabel} {view.answer?.context}
            </Text>
          )}
        </View>
      )}

      {asks && (
        <View style={{ marginTop: space(4) }}>
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
          <GhostButton
            label={GRADE_LABELS.again}
            color={paper.ink}
            onPress={() => {
              void gradeCard(line.card.id, 'again', view.gradeContext);
              setDone(true);
              onGraded();
            }}
          />
        </View>
      )}

      {done && <Text style={[type.small, { color: paper.inkSoft, marginTop: space(4) }]}>{CLOSING_LINE}</Text>}
    </Card>
  );
}

const st = StyleSheet.create({
  answer: { marginTop: space(3), gap: space(1) },
  // The two grade controls, stacked rather than in a row: "That was it" is a
  // sentence and a row of two sentences wraps into nonsense at the largest
  // reading size, which is the defect F383 already found on this tab.
  grades: { marginTop: space(4), gap: space(1) },
});
