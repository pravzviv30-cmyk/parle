import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { phraseKeyOf, type ConversationPack } from '@luvani/core';
import { IconAction, Card, GhostButton, Label, PillButton } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { paper, radius, space, type, HIT, frenchText } from '../theme.ts';
import * as voice from '../speech/tutorVoice.ts';
import { loadConversationPackForLearner } from './store.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { choicesFor, matchPair, pairsFor, matchingOrder, checkRecognition, NEW_ATTEMPT, type RecognitionAttempt } from './recognition.ts';
import { ownsPracticeRead, type PracticeReadOwner } from '../practice/readOwner.ts';
import { mintPracticeId } from '../practice/history.ts';
import { recordWarmupCompleted } from '../practice/historyStore.ts';

/** Recognition is preparation, not proof of unaided recall; that follows in Drill. */
export function ConversationPracticeScreen({ packId, onBack, onRecall, previewPack, onLoadSample, initialStage = 'match' }: {
  /**
   * Where the warm-up opens (B3, 2026-10-20): Practice's "Understand it" opens
   * on matching and "Catch it by ear" on listening. Recall is never a stage
   * here; it is a Drill sitting.
   */
  initialStage?: 'match' | 'listen';
  /**
   * Development only, and only on the preview: put the labelled sample into
   * this mock account's own stores so the rest of the journey can be looked
   * at. The navigator supplies it only when `sampleAllowed` is true.
   */
  onLoadSample?: () => Promise<string>;
  packId: string;
  onBack: () => void;
  /**
   * Go on to recall. `exposed` is always true from this screen: the matching
   * stage puts every French line on screen the moment it opens, so even a
   * learner who skips straight to recall has just seen them.
   */
  onRecall: (node: { id: string; title: string; phraseKeys: string[] }, exposed: boolean) => void;
  /** Story fixture only. The navigator supplies this exclusively in development. */
  previewPack?: ConversationPack;
}) {
  const { user, adapter } = useAuth();
  const currentScope = scopeGeneration();
  const [readOwner, setReadOwner] = useState<PracticeReadOwner | null>(null);
  const ownerMatches = ownsPracticeRead(readOwner, scopeGeneration(), user?.id ?? null, activeUserId());
  const ownsNow = () => ownsPracticeRead(readOwner, scopeGeneration(), user?.id ?? null, activeUserId());
  const [pack, setPack] = useState<ConversationPack | null | undefined>(undefined);
  const [stage, setStage] = useState<'match' | 'listen' | 'ready'>(initialStage);
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [pairAttempts, setPairAttempts] = useState<Record<string, RecognitionAttempt>>({});
  const [round, setRound] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(NEW_ATTEMPT);
  const revealed = attempt.outcome === 'correct' || attempt.outcome === 'revealed';
  const [quiet, setQuiet] = useState(false);
  const [audioReady, setAudioReady] = useState<boolean | null>(null);
  const [played, setPlayed] = useState(false);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  // The warm-up ran to its end: matching and every listening round. A skip,
  // or a pack too small to warm up at all, leaves it false.
  const [warmedUp, setWarmedUp] = useState(false);
  // One id per run of this screen, minted once, so a re-render records nothing
  // twice and a second run is a second, separate fact.
  const warmupIdRef = useRef<string | null>(null);
  const warmupRecordedRef = useRef(false);
  useEffect(() => {
    // Exposure, never recall: no grade and no XP. Not for the preview, whose
    // pack is not the learner's, and only once per run.
    if (!warmedUp || previewPack || !pack || !ownsNow() || warmupRecordedRef.current) return;
    warmupRecordedRef.current = true;
    warmupIdRef.current ??= mintPracticeId(Date.now(), 'w');
    void recordWarmupCompleted({ warmupId: warmupIdRef.current, packId: pack.id, at: Date.now() });
  }, [warmedUp, previewPack, pack, ownerMatches]);
  useEffect(() => {
    let cancelled = false;
    const owner = scopeGeneration();
    const current = () => !cancelled && owner === scopeGeneration() && user?.id === activeUserId();
    setPack(undefined);
    setReadOwner(null);
    setStage(initialStage); setSelected(null); setMatched([]); setPairAttempts({}); setRound(0); setChoice(null); setAttempt(NEW_ATTEMPT); setPlayed(false); setWarmedUp(false); setQuiet(false); setNotice(''); setSampleNote(null); warmupRecordedRef.current = false; warmupIdRef.current = null;
    const ownerOfRead = { scope: owner, userId: user?.id ?? null };
    if (previewPack) { setPack(previewPack); setReadOwner(ownerOfRead); }
    else if (!user) { setPack(null); setReadOwner(ownerOfRead); }
    else void loadConversationPackForLearner(user, adapter, packId).then((result) => {
      if (current()) { setPack(result.ok && result.pack?.state === 'ready' ? result.pack : null); setReadOwner(ownerOfRead); }
    }).catch(() => { if (current()) { setPack(null); setReadOwner(ownerOfRead); } });
    void voice.available().then((available) => { if (!cancelled) setAudioReady(available); });
    return () => { cancelled = true; voice.stop(); };
  }, [packId, previewPack, user, adapter, currentScope, initialStage]);
  const visiblePack = ownerMatches ? pack : undefined;
  const pairs = useMemo(() => visiblePack ? pairsFor(visiblePack) : [], [visiblePack]);
  const right = useMemo(() => matchingOrder(pairs, `${packId}:matching`), [pairs, packId]);
  const listening = useMemo(() => visiblePack ? choicesFor(visiblePack) : [], [visiblePack]);
  const current = listening[round];
  const reading = quiet || audioReady === false;
  const readyForRecall = stage === 'ready' || pairs.length < 2;
  const progress = readyForRecall ? 1 : stage === 'match' ? 0 : (round + 1) / (listening.length + 1);
  const tile = (label: string, key: string, side: 'fr' | 'en') => {
    const done = matched.includes(key);
    const assisted = pairAttempts[key]?.outcome === 'revealed';
    const chosen = side === 'fr' && selected === key;
    return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label}${done ? assisted ? ', reviewed with help' : ', matched' : ''}`}
      accessibilityState={{ selected: chosen, disabled: done }} disabled={done}
      onPress={() => {
        if (!ownsNow()) return;
        if (side === 'fr') { setSelected(key); setNotice('Choose its English meaning.'); return; }
        if (!selected) { setNotice('Choose a French phrase first.'); return; }
        const next = checkRecognition(pairAttempts[selected] ?? NEW_ATTEMPT, matchPair(pairs, selected, key));
        setPairAttempts((held) => ({ ...held, [selected]: next }));
        if (next.outcome === 'correct') {
          setMatched((held) => [...held, key]); setSelected(null); setNotice('That pair belongs together.');
        } else if (next.outcome === 'revealed') {
          const phrase = pairs.find((p) => p.key === selected)!;
          setMatched((held) => [...held, selected]); setSelected(null);
          setNotice(`“${phrase.fr}” means: ${phrase.en}`);
        } else setNotice('Not this pair. Keep the French phrase selected and try another meaning.');
      }}
      style={{ minHeight: HIT * 1.5, justifyContent: 'center', padding: space(3), borderRadius: radius.card,
        borderWidth: chosen ? 2 : 1, borderColor: chosen ? paper.ink : paper.line,
        backgroundColor: done ? paper.groundDeep : paper.card, opacity: 1 }}>
      <Text {...(side === 'fr' ? frenchText : {})} style={[side === 'fr' ? type.frenchSm : type.small, { color: paper.ink }]}>{done && !assisted ? '✓ ' : ''}{label}</Text>
    </Pressable>;
  };
  return <ScrollScreen header={<ScreenHeader title="Practise" back={{ onPress: onBack }} />}>
    {visiblePack === undefined ? <ActivityIndicator accessibilityLabel="Loading conversation practice" /> : !pack || !ownerMatches ?
      <Card><Text style={[type.heading, { color: paper.ink }]}>This conversation isn’t available here.</Text><Text style={[type.body, { color: paper.ink }]}>Return to your conversations and refresh before trying again.</Text><IconAction layout="inline" icon="back" label="Back to practice" onPress={onBack} /></Card> :
      <View style={{ gap: space(5), paddingBottom: space(6) }}>
        <View style={{ gap: space(2) }}>
          {previewPack && <Label>Design preview, sample conversation</Label>}
          {previewPack && onLoadSample && (
            <View style={{ gap: space(1) }}>
              <IconAction layout="inline" icon="download"
                label={loadingSample ? 'Loading sample' : 'Load sample conversation'}
                disabled={loadingSample}
                onPress={() => {
        if (!ownsNow()) return;
                  if (loadingSample) return;
                  setLoadingSample(true);
                  void onLoadSample().then(setSampleNote).finally(() => setLoadingSample(false));
                }}
              />
              <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.ink }]}>
                {sampleNote ?? 'Development only. Adds a labelled sample to this local account so Practice can be tried.'}
              </Text>
            </View>
          )}
          <Label>{pack.title.en}</Label>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ height: 5, backgroundColor: paper.line, borderRadius: 3 }}>
            <View style={{ height: 5, width: `${progress * 100}%`, backgroundColor: paper.ink, borderRadius: 3 }} />
          </View>
          <Text style={[type.small, { color: paper.ink }]}>Built from the phrases saved from this conversation. No live minutes used.</Text>
        </View>
        {pack.keyPhrases.length === 0 && pack.corrections.length === 0 ? <Card>
          <Text style={[type.heading, { color: paper.ink }]}>No practice phrases were saved this time.</Text>
          <Text style={[type.body, { color: paper.ink }]}>Your conversation summary is still available. Try another conversation when you’re ready.</Text>
          <IconAction layout="inline" icon="back" label="Back to conversations" onPress={onBack} />
        </Card> : readyForRecall ? <Card>
          <Label>Now, make it yours</Label>
          <Text style={[type.heading, { color: paper.ink, marginVertical: space(3) }]}>Try it without the choices.</Text>
          <Text style={[type.body, { color: paper.ink }]}>Matching and listening help you recognise the phrases. Your next attempts feed the same review schedule used across Luvani.</Text>
          <View style={{ marginTop: space(4) }}><PillButton label={previewPack ? 'Finish preview' : 'Practise from memory'} onPress={() => {
        if (!ownsNow()) return;
            voice.stop();
            onRecall({ id: pack.id, title: pack.title.en, phraseKeys: [...new Set([
              ...pack.keyPhrases.map((p) => phraseKeyOf(p.fr)), ...pack.corrections.map((c) => phraseKeyOf(c.better)),
            ])] }, true);
          }} /></View>
        </Card> : stage === 'match' ? <>
          <Text style={[type.display, { color: paper.ink }]}>Find the pairs.</Text>
          <Text style={[type.body, { color: paper.ink }]}>Tap a French phrase, then its English meaning.</Text>
          <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: space(3) }}>{pairs.map((p) => tile(p.fr, p.key, 'fr'))}</View>
            <View style={{ flex: 1, gap: space(3) }}>{right.map((p) => tile(p.en, p.key, 'en'))}</View>
          </View>
          <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.ink }]}>{notice || 'These are phrases from your saved conversation.'}</Text>
          <PillButton label="Continue to listening" disabled={matched.length !== pairs.length} onPress={() => {
        if (!ownsNow()) return; setStage('listen'); setNotice(''); }} />
        </> : current ? <>
          <Text style={[type.display, { color: paper.ink }]}>{reading ? 'Read and choose.' : 'Listen and choose.'}</Text>
          <Card>
            {reading ? <Text style={[type.french, { color: paper.ink }]}>{current.phrase.fr}</Text> : <>
              <PillButton label={played ? 'Listen again' : 'Play the phrase'} disabled={audioReady === null} onPress={() => {
        if (!ownsNow()) return; voice.speak(current.phrase.fr); setPlayed(true); }} />
              <IconAction layout="inline" icon="speaker-slow" label="Play slowly" disabled={audioReady === null} onPress={() => {
        if (!ownsNow()) return; voice.speak(current.phrase.fr, { rate: 0.65 }); setPlayed(true); }} />
            </>}
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>{reading ? 'The same meaning, without audio.' : 'Which meaning did you hear? Audio uses your device’s French voice.'}</Text>
          </Card>
          {current.options.map((option, i) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: choice === i, disabled: revealed || (!played && !reading) }}
            disabled={revealed || (!played && !reading)} onPress={() => setChoice(i)}
            style={{ minHeight: HIT, padding: space(4), borderRadius: radius.card, borderWidth: choice === i ? 2 : 1, borderColor: choice === i ? paper.ink : paper.line, backgroundColor: paper.card }}>
            <Text style={[type.body, { color: paper.ink }]}>{option}</Text>
          </Pressable>)}
          {attempt.outcome !== 'waiting' && <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>{attempt.outcome === 'correct' ? 'That’s the meaning.' : attempt.outcome === 'revealed' ? `The meaning is: ${current.phrase.en}` : 'Not quite. Try once more before seeing the meaning.'}</Text>}
          <PillButton label={revealed ? 'Continue' : 'Check meaning'} disabled={choice === null} onPress={() => {
        if (!ownsNow()) return;
            if (!revealed) {
              if (choice === null) return;
              const next = checkRecognition(attempt, choice === current.correctIndex);
              setAttempt(next);
              if (next.outcome === 'retry') setChoice(null);
              return;
            }
            voice.stop(); setChoice(null); setAttempt(NEW_ATTEMPT); setPlayed(false);
            if (round + 1 >= listening.length) {
              // The last listening round answered: the warm-up was completed,
              // which is the only way `warmedUp` is ever raised. A skip is not.
              setWarmedUp(true);
              setStage('ready');
            } else setRound(round + 1);
          }} />
          {!reading && <IconAction layout="inline" icon="speaker-off" label="I can’t listen now" onPress={() => {
        if (!ownsNow()) return; voice.stop(); setQuiet(true); }} />}
        </> : null}
        {!readyForRecall && <IconAction layout="inline" icon="forward" label="Skip warm-up and recall" onPress={() => {
        if (!ownsNow()) return; voice.stop(); setStage('ready'); }} />}
      </View>}
  </ScrollScreen>;
}

