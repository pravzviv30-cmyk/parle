/**
 * The settings row's hold on Slower voice. Starts with the value already in
 * memory, then the stored one, and a failed write settles back to what stuck.
 */
import { useEffect, useRef, useState } from 'react';
import { loadVoiceSpeedPreference, setVoiceSpeedPreference, voiceSpeedChoice, type VoiceSpeed, type VoiceSpeedChoice } from './voiceSpeedPreference.ts';

export function useVoiceSpeed(): { voiceSpeed: VoiceSpeedChoice; onVoiceSpeed: (value: VoiceSpeed) => void } {
  const [voiceSpeed, setVoiceSpeed] = useState<VoiceSpeedChoice>(voiceSpeedChoice);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void loadVoiceSpeedPreference().then((value) => { if (mounted.current) setVoiceSpeed(value); });
    return () => { mounted.current = false; };
  }, []);
  const onVoiceSpeed = (value: VoiceSpeed) => {
    setVoiceSpeed(value);
    void setVoiceSpeedPreference(value).then(() => { if (mounted.current) setVoiceSpeed(voiceSpeedChoice()); });
  };
  return { voiceSpeed, onVoiceSpeed };
}
