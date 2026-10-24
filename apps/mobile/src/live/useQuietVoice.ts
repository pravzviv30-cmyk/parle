/**
 * The room owner's hold on Quiet voice. A room starts with the stored value,
 * and turning it on (or starting with it on) opens the transcript, so a soft
 * voice the learner cannot hear back is still readable on screen.
 */
import { useEffect, useRef, useState } from 'react';
import { loadQuietVoicePreference, quietVoiceOn, setQuietVoicePreference } from './quietVoicePreference.ts';

export function useQuietVoice(onTranscriptVisibility: (visible: boolean) => void): { quietVoice: boolean; onQuietVoice: (on: boolean) => void } {
  const [quietVoice, setQuietVoice] = useState(quietVoiceOn);
  const show = useRef(onTranscriptVisibility);
  show.current = onTranscriptVisibility;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (quietVoiceOn()) show.current(true);
    void loadQuietVoicePreference().then((on) => {
      if (!mounted.current) return;
      setQuietVoice(on);
      if (on) show.current(true);
    });
    return () => { mounted.current = false; };
  }, []);
  const onQuietVoice = (on: boolean) => {
    setQuietVoice(on);
    if (on) show.current(true);
    void setQuietVoicePreference(on).then(() => { if (mounted.current) setQuietVoice(quietVoiceOn()); });
  };
  return { quietVoice, onQuietVoice };
}
