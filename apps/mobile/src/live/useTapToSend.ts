/**
 * The room owner's hold on Tap to send. A room starts with the stored value
 * and hands it to useLiveSession as `tapToSend`, which tells the agent at
 * connect and again whenever it changes, a late load from the disk included.
 */
import { useEffect, useRef, useState } from 'react';
import { loadTapToSendPreference, setTapToSendPreference, tapToSendOn } from './tapToSendPreference.ts';

export function useTapToSend(): { tapToSend: boolean; onTapToSend: (on: boolean) => void } {
  const [tapToSend, setTapToSend] = useState(tapToSendOn);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void loadTapToSendPreference().then((on) => {
      if (mounted.current) setTapToSend(on);
    });
    return () => { mounted.current = false; };
  }, []);
  const onTapToSend = (on: boolean) => {
    setTapToSend(on);
    void setTapToSendPreference(on).then(() => { if (mounted.current) setTapToSend(tapToSendOn()); });
  };
  return { tapToSend, onTapToSend };
}
