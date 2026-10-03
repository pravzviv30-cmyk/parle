import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { Illustration } from '../art/flat/Illustration.tsx';
import { decorative } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';

/** First earned can-do only; one fall, no loop and no touch interception. */
export function OnceConfetti({ active }: { active: boolean }) {
  const reduced = useReduceMotion(true);
  const used = useRef(false);
  const fall = useRef(new Animated.Value(-70)).current;
  const [show,setShow] = useState(false);
  useEffect(()=>{
    if (!active || reduced === null || used.current) return;
    used.current=true;
    if (reduced) return;
    let live=true;
    setShow(true);
    const animation=Animated.timing(fall,{toValue:140,duration:900,useNativeDriver:true});
    animation.start(()=>{if(live)setShow(false);});
    return ()=>{live=false;animation.stop();setShow(false);};
  },[active,reduced,fall]);
  useEffect(()=>{if(reduced){fall.stopAnimation();setShow(false);}},[reduced,fall]);
  if(!show || reduced) return null;
  return <View {...decorative} pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,overflow:'hidden'}}>
    <Animated.View style={{transform:[{translateY:fall}]}}><Illustration name="celebrate-confetti" /></Animated.View>
  </View>;
}
