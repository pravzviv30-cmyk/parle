/**
 * The one layer tokens fly in (come alive section 3, TokenFlight).
 *
 * Mounted once at the root of the app, over everything and outside the
 * navigator, so window coordinates from `measureInWindow` are its own. It draws
 * whatever `flights.ts` has in the air and nothing else; it is decorative and
 * every touch passes through it.
 *
 * Until it is mounted, every launch lands at once, so a screen that launches a
 * token never waits on a layer that is not there. When it goes, when the app
 * leaves the foreground, or when reduced motion is turned on, everything in the
 * air lands at once.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReduceMotion } from '../motion.ts';
import { decorative } from '../theme.ts';
import { flights, type Flight } from './flights.ts';
import { useLandOnLeave } from './landing.ts';
import { FlightToken } from './TokenFlight.tsx';

export function FlightLayer() {
  const reduced = useReduceMotion();
  const [inAir, setInAir] = useState<readonly Flight[]>([]);
  useEffect(() => flights.attach(setInAir), []);
  useEffect(() => {
    if (reduced) flights.landAll();
  }, [reduced]);
  useLandOnLeave(() => flights.landAll());
  return (
    <View {...decorative} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {inAir.map((flight) => (
        <FlightToken key={flight.id} flight={flight} reduced={reduced} />
      ))}
    </View>
  );
}
