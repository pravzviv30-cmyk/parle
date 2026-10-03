import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { HeroNumber } from '../components.tsx';
import { useReduceMotion } from '../motion.ts';
/** Real recap total. Assistive technology always receives the final total. */
export function OnceCount({ value }: { value: number }) {
  const reduced=useReduceMotion(true);
  const used=useRef(false);
  const [shown,setShown]=useState(value);
  useEffect(()=>{
    if (reduced === null || used.current) return;
    used.current=true;
    if (reduced || value<2) return;
    const start=Date.now();setShown(1);
    const timer=setInterval(()=>{
      const fraction=Math.min(1,(Date.now()-start)/600);
      setShown(Math.max(1,Math.ceil(value*fraction)));
      if(fraction===1) clearInterval(timer);
    },40);
    return ()=>{clearInterval(timer);setShown(value);};
  },[value,reduced]);
  return <View accessible accessibilityLabel={`${value} ${value===1?'line you said':'lines you said'}`}><View importantForAccessibility="no-hide-descendants" aria-hidden><HeroNumber value={String(reduced?value:shown)} unit={value===1?'line you said':'lines you said'} ground="coral" /></View></View>;
}
