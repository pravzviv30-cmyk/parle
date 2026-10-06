import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, View } from 'react-native';
import { Illustration } from '../art/flat/Illustration.tsx';
import { decorative } from '../theme.ts';
import { NATIVE_DRIVER, useReduceMotion } from '../motion.ts';

/** First earned can-do only; one fall, no loop and no touch interception. */
export function OnceConfetti({ active }: { active: boolean }) {
  const focused = useIsFocused();
  const reduced = useReduceMotion(true);
  const used = useRef(false);
  const fall = useRef(new Animated.Value(-70)).current;
  const [show,setShow] = useState(false);
  useEffect(()=>{
    if (!active || !focused || AppState.currentState === 'background' || AppState.currentState === 'inactive' || reduced === null || used.current) return;
    used.current=true;
    if (reduced) return;
    let live=true;
    setShow(true);
    const animation=Animated.timing(fall,{toValue:140,duration:650,useNativeDriver:NATIVE_DRIVER});
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') { animation.stop(); setShow(false); } });
    animation.start(()=>{if(live)setShow(false);});
    return ()=>{live=false;animation.stop();subscription.remove();setShow(false);};
  },[active,focused,reduced,fall]);
  useEffect(()=>{if(reduced){fall.stopAnimation();setShow(false);}},[reduced,fall]);
  if(!show || reduced) return null;
  return <View {...decorative} style={{position:'absolute',top:0,left:0,right:0,overflow:'hidden',pointerEvents:'none'}}>
    <Animated.View style={{transform:[{translateY:fall}]}}><Illustration name="celebrate-confetti" /></Animated.View>
  </View>;
}
