import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { checkStarter } from '@luvani/core';
import { Card, ColourCard, GhostButton, PillButton, Sheet } from '../components.tsx';
import { frenchText, paper, type } from '../theme.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { addPhrases } from '../review/store.ts';
import { arrived } from '../motion/haptics.ts';
import { continuingTask, type GuestPractice } from './guestModel.ts';
import { saveStarter } from './savedStarter.ts';
import { trackAccountStarter } from './guestPractice.ts';

/** Home resumes the introduced goal and the exact line, even without a connection. */
export function StarterContinuation({
  initial,
  onTutor,
  onPlans,
}: {
  initial: GuestPractice;
  onTutor: () => void;
  onPlans: () => void;
}) {
  const { user } = useAuth();
  const [guest, setGuest] = useState(initial);
  const [visible, setVisible] = useState(false);
  const [reply, setReply] = useState('');
  const [feedback, setFeedback] = useState<ReturnType<typeof checkStarter> | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [leaveAsked, setLeaveAsked] = useState(false);
  const [task, setTask] = useState(() => continuingTask(initial));
  const open = (retry: boolean) => {
    const next = continuingTask(guest, retry);
    setTask(next);
    setReply('');
    setFeedback(null);
    setNote('');
    setLeaveAsked(false);
    setVisible(true);
  };
  const submit = async () => {
    if (busy || !reply.trim()) return;
    const owner = scopeGeneration();
    setBusy(true);
    setNote('');
    const result = checkStarter(task, reply.trim(), 'typed');
    const next = {
      ...guest,
      attempts: [
        ...guest.attempts,
        { taskId: task.id, reply: reply.trim(), feedback: result, at: Date.now(), offline: true },
      ].slice(-100),
    };
    try {
      if (!(await saveStarter(next, owner))) {
        if (owner === scopeGeneration()) setNote('Your reply could not be saved. Try again.');
        return;
      }
      if (owner !== scopeGeneration()) return;
      setGuest(next);
      setFeedback(result);
      if (result.accepted) {
        arrived();
        if (user) void trackAccountStarter(user.id, 'useful_return', 'typed');
      }
    } catch {
      if (owner === scopeGeneration()) setNote('Your reply could not be saved. Try again.');
    } finally {
      if (owner === scopeGeneration()) setBusy(false);
    }
  };
  const keep = async () => {
    if (busy || !feedback?.accepted) return;
    const owner = scopeGeneration();
    setBusy(true);
    try {
      const saved = await addPhrases([
        {
          fr: reply.trim(),
          frWritten: null,
          en: task.meaning,
          enLiteral: null,
          register: 'courant',
          note: null,
        },
      ]);
      if (owner === scopeGeneration())
        setNote(
          saved === 'durable'
            ? 'Phrase saved in Practice.'
            : 'Your phrase could not be saved. Try again.',
        );
    } catch {
      if (owner === scopeGeneration()) setNote('Your phrase could not be saved. Try again.');
    } finally {
      if (owner === scopeGeneration()) setBusy(false);
    }
  };
  return (
    <>
      <ColourCard ground="sun">
        <Text accessibilityRole="header" style={type.heading}>
          {continuingTask(guest).title}
        </Text>
        <Text {...frenchText} style={type.french}>
          {continuingTask(guest).prompt}
        </Text>
        <Text style={type.body}>Pick up your practice where you left it.</Text>
        <PillButton label="Continue practice" onPress={() => open(false)} />
        <GhostButton label="Retry my last line" onPress={() => open(true)} />
        <GhostButton label="Speak with my tutor" onPress={onTutor} />
        <GhostButton label="See plans" onPress={onPlans} />
      </ColourCard>
      <Sheet
        visible={visible}
        title={task.title}
        onClose={() => {
          if (busy) return false;
          if (reply.trim() && !feedback) {
            setLeaveAsked(true);
            return false;
          }
          setVisible(false);
          return true;
        }}
      >
        {leaveAsked ? (
          <>
            <Text style={type.body}>Your unsent reply will be cleared if you leave.</Text>
            <PillButton label="Keep practising" onPress={() => setLeaveAsked(false)} />
            <GhostButton
              label="Leave practice"
              onPress={() => {
                setReply('');
                setLeaveAsked(false);
                setVisible(false);
              }}
            />
          </>
        ) : (
          <>
            <Text {...frenchText} style={type.frenchLg}>
              {task.prompt}
            </Text>
            <Text style={type.body}>{task.translation}</Text>
            <Text style={type.small}>
              Offline phrase practice. This checks authored replies, without assessing
              pronunciation.
            </Text>
            {feedback ? (
              <>
                <Card style={{ gap: 12 }}>
                  <Text {...frenchText} style={type.frenchLg}>
                    {reply}
                  </Text>
                  <Text style={type.body}>{feedback.text}</Text>
                  {!feedback.accepted && (
                    <Text {...frenchText} style={type.french}>
                      {feedback.model}
                    </Text>
                  )}
                </Card>
                <PillButton label="Finish" onPress={() => setVisible(false)} />
                <GhostButton
                  label="Retry this line"
                  onPress={() => {
                    setFeedback(null);
                    setReply('');
                  }}
                />
                {feedback.accepted && (
                  <GhostButton
                    label="Keep this phrase"
                    disabled={busy}
                    onPress={() => {
                      void keep();
                    }}
                  />
                )}
              </>
            ) : (
              <>
                <TextInput
                  accessibilityLabel="Your French reply"
                  value={reply}
                  onChangeText={setReply}
                  maxLength={600}
                  multiline
                  editable={!busy}
                  placeholder="Your reply in French"
                  style={{
                    ...type.body,
                    color: paper.ink,
                    minHeight: 90,
                    padding: 16,
                  backgroundColor: paper.card,
                  borderWidth: 1,
                  borderColor: paper.line,
                    borderRadius: 16,
                  }}
                />
                <PillButton
                  label={busy ? 'Saving…' : 'Check reply'}
                  disabled={busy || !reply.trim()}
                  onPress={() => {
                    void submit();
                  }}
                />
                <GhostButton
                  label="Help"
                  onPress={() => setNote(`${task.model}. ${task.meaning}`)}
                />
              </>
            )}
            {note !== '' ? (
              <Text accessibilityLiveRegion="polite" style={type.body}>
                {note}
              </Text>
            ) : null}
          </>
        )}
      </Sheet>
    </>
  );
}
