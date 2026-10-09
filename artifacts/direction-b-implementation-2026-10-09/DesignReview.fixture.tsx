import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { PLANS } from '@luvani/core';
import { ScrollScreen, ScreenHeader } from './src/layout';
import { PillButton } from './src/components';
import { WallPlansPage, WallPlansAtButton } from './src/wall/WallPlansPage';
import { wallPlanRows, chosenOffer, storeTrialMinutes } from './src/wall/wallPlans';
import { billedPrice, buyLabel } from './src/wall/wallCopy';
import { trialTimeline } from './src/wall/trialTimeline';
import { PreAccountOnboarding } from './src/onboarding/PreAccountOnboarding';
import { FlightLayer } from './src/motion/FlightLayer';
import { CelebrationHost } from './src/celebrate/CelebrationHost';
import { ReduceMotionBridge } from './src/motion/ReduceMotionBridge';
const rows=wallPlanRows({available:true,products:[{plan:'starter',period:'month',productId:'month',title:'Starter',localizedPrice:'$19',intro:null,introEligible:false}],weekly:[{plan:'starter',period:'week',productId:'week',title:'Starter',localizedPrice:'$5.49',intro:null,introEligible:false}],yearly:[{plan:'starter',period:'year',productId:'year',title:'Starter',localizedPrice:'$149',intro:{priceString:'$0',periodUnit:'DAY',periodNumberOfUnits:7,cycles:1},introEligible:true}]},PLANS)!;
export default function DesignReview(){
 const [selected,setSelected]=useState('week'); const [message,setMessage]=useState('');
 const [loaded]=useFonts({'Outfit-Regular':require('./assets/fonts/Outfit-Regular.ttf'),'Outfit-Medium':require('./assets/fonts/Outfit-Medium.ttf'),'Outfit-SemiBold':require('./assets/fonts/Outfit-SemiBold.ttf'),'Outfit-Bold':require('./assets/fonts/Outfit-Bold.ttf'),'Outfit-ExtraBold':require('./assets/fonts/Outfit-ExtraBold.ttf')});
 const offer=chosenOffer(rows,selected)!; const trial=trialTimeline({offer,minutes:storeTrialMinutes(PLANS,offer.plan),remind:false});
 if(!loaded)return null;
 return <SafeAreaProvider><ReduceMotionBridge/><View style={{flex:1}}>{window.location.search.includes('onboarding')?<PreAccountOnboarding initialDraft={null} onDraftChange={()=>{}} onCreateAccount={()=>{}} onSignIn={()=>setMessage('Sign in preview')}/>:<ScrollScreen header={<ScreenHeader leave={{label:'Not now',onPress:()=>setMessage('Closed preview')}}/>} footer={<View><PillButton label={trial?.cta??buyLabel(offer.name,offer.price,offer.period)} onPress={()=>setMessage('Preview only. No purchase was made.')}/><WallPlansAtButton trialTerms={trial?.terms??null} priceTerms={billedPrice(offer.price,offer.period)}/></View>}><WallPlansPage rows={rows} account={null} selected={selected} trial={trial} onSelect={o=>setSelected(o.productId)} onRestore={()=>setMessage('Restore preview')} onOpenPolicy={()=>setMessage('Privacy preview')} onOpenTerms={()=>setMessage('Terms preview')} onLeave={()=>{}}/>{message!==''&&<Text>{message}</Text>}</ScrollScreen>}<CelebrationHost/><FlightLayer/></View></SafeAreaProvider>
}
