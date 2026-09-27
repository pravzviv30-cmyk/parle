import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { phraseKeyOf, type ConversationPack } from '@luvani/core';
import { Card, GhostButton, Label, PillButton } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { paper, radius, space, type, HIT } from '../theme.ts';
import * as voice from '../speech/tutorVoice.ts';
import { loadConversationPacks } from './store.ts';
import { choicesFor, matchPair, pairsFor, matchingOrder, checkRecognition, NEW_ATTEMPT, type RecognitionAttempt } from './recognition.ts';
import { mintPracticeId } from '../practice/history.ts';
import { recordWarmupCompleted } from '../practice/historyStore.ts';

/** Recognition is preparation, not proof of unaided recall; that follows in Drill. */
export function ConversationPracticeScreen({ packId, onBack, onRecall, previewPack, onLoadSample }: {
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
  const [pack, setPack] = useState<ConversationPack | null | undefined>(undefined);
  const [stage, setStage] = useState<'match' | 'listen' | 'ready'>('match');
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
    if (!warmedUp || previewPack || !pack || warmupRecordedRef.current) return;
    warmupRecordedRef.current = true;
    warmupIdRef.current ??= mintPracticeId(Date.now(), 'w');
    void recordWarmupCompleted({ warmupId: warmupIdRef.current, packId: pack.id, at: Date.now() });
  }, [warmedUp, previewPack, pack]);
  useEffect(() => {
    let cancelled = false;
    if (previewPack) setPack(previewPack);
    else void loadConversationPacks().then((packs) => {
      if (!cancelled) setPack(packs.find((p) => p.id === packId && p.state === 'ready') ?? null);
    }).catch(() => { if (!cancelled) setPack(null); });
    void voice.available().then((available) => { if (!cancelled) setAudioReady(available); });
    return () => { cancelled = true; voice.stop(); };
  }, [packId, previewPack]);
  const pairs = useMemo(() => pack ? pairsFor(pack) : [], [pack]);
  const right = useMemo(() => matchingOrder(pairs, `${packId}:matching`), [pairs, packId]);
  const listening = useMemo(() => pack ? choicesFor(pack) : [], [pack]);
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
        backgroundColor: done ? paper.groundDeep : paper.card, opacity: done ? 0.65 : 1 }}>
      <Text style={[side === 'fr' ? type.frenchSm : type.small, { color: paper.ink }]}>{done && !assisted ? '✓ ' : ''}{label}</Text>
    </Pressable>;
  };
  return <ScrollScreen header={<ScreenHeader title="Practice" back={{ onPress: onBack }} />}>
    {pack === undefined ? <ActivityIndicator accessibilityLabel="Loading conversation practice" /> : !pack ?
      <Card><Text style={type.heading}>This conversation isn’t available here.</Text><Text style={type.body}>Return to your conversations and refresh before trying again.</Text><GhostButton label="Back to practice" onPress={onBack} /></Card> :
      <View style={{ gap: space(5), paddingBottom: space(6) }}>
        <View style={{ gap: space(2) }}>
          {previewPack && <Label>Design preview · Sample conversation</Label>}
          {previewPack && onLoadSample && (
            <View style={{ gap: space(1) }}>
              <GhostButton
                label={loadingSample ? 'Loading sample' : 'Load sample conversation'}
                disabled={loadingSample}
                onPress={() => {
                  if (loadingSample) return;
                  setLoadingSample(true);
                  void onLoadSample().then(setSampleNote).finally(() => setLoadingSample(false));
                }}
              />
              <Text accessibilityLiveRegion="polite" style={type.small}>
                {sampleNote ?? 'Development only. Adds a labelled sample to this local account so Practice can be tried.'}
              </Text>
            </View>
          )}
          <Label>{pack.title.en}</Label>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ height: 5, backgroundColor: paper.line, borderRadius: 3 }}>
            <View style={{ height: 5, width: `${progress * 100}%`, backgroundColor: paper.ink, borderRadius: 3 }} />
          </View>
          <Text style={type.small}>Built from the phrases saved from this conversation. No live minutes used.</Text>
        </View>
        {pack.keyPhrases.length === 0 && pack.corrections.length === 0 ? <Card>
          <Text style={type.heading}>No practice phrases were saved this time.</Text>
          <Text style={type.body}>Your conversation summary is still available. Try another conversation when you’re ready.</Text>
          <GhostButton label="Back to conversations" onPress={onBack} />
        </Card> : readyForRecall ? <Card>
          <Label>Now, make it yours</Label>
          <Text style={[type.heading, { marginVertical: space(3) }]}>Try it without the choices.</Text>
          <Text style={type.body}>Matching and listening help you recognise the phrases. Your next attempts feed the same review schedule used across Luvani.</Text>
          <View style={{ marginTop: space(4) }}><PillButton label={previewPack ? 'Finish preview' : 'Practise from memory'} onPress={() => {
            voice.stop();
            onRecall({ id: pack.id, title: pack.title.en, phraseKeys: [...new Set([
              ...pack.keyPhrases.map((p) => phraseKeyOf(p.fr)), ...pack.corrections.map((c) => phraseKeyOf(c.better)),
            ])] }, true);
          }} /></View>
        </Card> : stage === 'match' ? <>
          <Text style={type.display}>Find the pairs.</Text>
          <Text style={type.body}>Tap a French phrase, then its English meaning.</Text>
          <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: space(3) }}>{pairs.map((p) => tile(p.fr, p.key, 'fr'))}</View>
            <View style={{ flex: 1, gap: space(3) }}>{right.map((p) => tile(p.en, p.key, 'en'))}</View>
          </View>
          <Text accessibilityLiveRegion="polite" style={type.small}>{notice || 'These are phrases from your saved conversation.'}</Text>
          <PillButton label="Continue to listening" disabled={matched.length !== pairs.length} onPress={() => { setStage('listen'); setNotice(''); }} />
        </> : current ? <>
          <Text style={type.display}>{reading ? 'Read and choose.' : 'Listen and choose.'}</Text>
          <Card>
            {reading ? <Text style={type.french}>{current.phrase.fr}</Text> : <>
              <PillButton label={played ? 'Listen again' : 'Play the phrase'} disabled={audioReady === null} onPress={() => { voice.speak(current.phrase.fr); setPlayed(true); }} />
              <GhostButton label="Play slowly" disabled={audioReady === null} onPress={() => { voice.speak(current.phrase.fr, { rate: 0.65 }); setPlayed(true); }} />
            </>}
            <Text style={[type.small, { marginTop: space(3) }]}>{reading ? 'The same meaning, without audio.' : 'Which meaning did you hear? Audio uses your device’s French voice.'}</Text>
          </Card>
          {current.options.map((option, i) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: choice === i, disabled: revealed || (!played && !reading) }}
            disabled={revealed || (!played && !reading)} onPress={() => setChoice(i)}
            style={{ minHeight: HIT, padding: space(4), borderRadius: radius.card, borderWidth: choice === i ? 2 : 1, borderColor: choice === i ? paper.ink : paper.line, backgroundColor: paper.card }}>
            <Text style={type.body}>{option}</Text>
          </Pressable>)}
          {attempt.outcome !== 'waiting' && <Text accessibilityLiveRegion="polite" style={type.body}>{attempt.outcome === 'correct' ? 'That’s the meaning.' : attempt.outcome === 'revealed' ? `The meaning is: ${current.phrase.en}` : 'Not quite. Try once more before seeing the meaning.'}</Text>}
          <PillButton label={revealed ? 'Continue' : 'Check meaning'} disabled={choice === null} onPress={() => {
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
          {!reading && <GhostButton label="I can’t listen now" onPress={() => { voice.stop(); setQuiet(true); }} />}
        </> : null}
        {!readyForRecall && <GhostButton label="Skip warm-up and recall" onPress={() => { voice.stop(); setStage('ready'); }} />}
      </View>}
  </ScrollScreen>;
}
