/** Isolated local review. Production index.ts must continue to register App.tsx. */
import { useState } from 'react';
import { useWindowDimensions, Text, View, Pressable, ScrollView } from 'react-native';
import { SafeAreaProvider, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { PreAccountOnboarding } from '../../apps/mobile/src/onboarding/PreAccountOnboarding.tsx';
import { freshPreAccountDraft } from '../../apps/mobile/src/onboarding/preAccountDraft.ts';
import { VoiceOrb, type OrbState } from '../../apps/mobile/src/tutor/VoiceOrb.tsx';
import { paper, colour, type } from '../../apps/mobile/src/theme.ts';
import { ReduceMotionBridge } from '../../apps/mobile/src/motion/ReduceMotionBridge.tsx';
import { WallYoursPage } from '../../apps/mobile/src/wall/WallYoursPage.tsx';
import { WallPlansPage, WallPlansAtButton } from '../../apps/mobile/src/wall/WallPlansPage.tsx';
import { previewCatalogue, previewOffering } from '../../apps/mobile/src/wall/preview.ts';
import { chosenOffer, wallPlanRows, storeTrialMinutes } from '../../apps/mobile/src/wall/wallPlans.ts';
import { trialTimeline } from '../../apps/mobile/src/wall/trialTimeline.ts';
import { ScrollScreen, ScreenHeader } from '../../apps/mobile/src/layout.tsx';
import { PillButton } from '../../apps/mobile/src/components.tsx';
const states: OrbState[] = ['ready','connecting','listening','speaking','thinking','idle','error'];
const previewEnv={EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT:'1',EXPO_PUBLIC_LUVANI_WALL_PREVIEW:'1',NODE_ENV:'development'};
const offering=previewOffering(previewEnv)!;
const catalogue=previewCatalogue(previewEnv)!;
const rows=wallPlanRows(offering,catalogue)!;
export default function NativeDesignReview() {
 const params=typeof window==='undefined'?null:new URLSearchParams(window.location.search);
 const phoneMode=params?.has('review')??false;
 const [screen,setScreen]=useState(params?.get('review')??'onboarding');
 const [orb,setOrb]=useState<OrbState>('ready');
 const size=useWindowDimensions();
 const [selected,setSelected]=useState<string|null>(rows[0]?.offers[0]?.productId ?? null);
 const [trialEligible,setTrialEligible]=useState(true);
 const [loaded]=useFonts({
  'Outfit-Regular':require('../../apps/mobile/assets/fonts/Outfit-Regular.ttf'),
  'Outfit-Medium':require('../../apps/mobile/assets/fonts/Outfit-Medium.ttf'),
  'Outfit-SemiBold':require('../../apps/mobile/assets/fonts/Outfit-SemiBold.ttf'),
  'Outfit-Bold':require('../../apps/mobile/assets/fonts/Outfit-Bold.ttf'),
  'Outfit-ExtraBold':require('../../apps/mobile/assets/fonts/Outfit-ExtraBold.ttf'),
 });
 const chosen=chosenOffer(rows,selected);
 const trial=trialTimeline({offer:chosen===null?null:{...chosen,trialDays:trialEligible?chosen.trialDays:null},minutes:chosen===null?null:storeTrialMinutes(catalogue,chosen.plan),remind:false});
 if(!loaded)return null;
 return <View style={{alignItems:'center',backgroundColor:'#e5e5e5',height:size.height}}>
  {!phoneMode && <View style={{flexDirection:'row',flexWrap:'wrap',backgroundColor:paper.card,gap:12,padding:12}}>
   {['onboarding','orb','value','plans'].map(v=><Pressable key={v} accessibilityRole="button" accessibilityLabel={`Preview ${v}`} onPress={()=>setScreen(v)}><Text style={type.label}>{v}</Text></Pressable>)}
   <Pressable accessibilityRole="button" onPress={()=>setTrialEligible(!trialEligible)}><Text style={type.label}>{trialEligible?'Eligible trial':'Returning subscriber'}</Text></Pressable>
  </View>}
  {!phoneMode && <Text style={type.small}>Design fixtures. Purchase and registration disabled.</Text>}
  <View testID="review-phone" style={{width:size.width,height:size.height,marginTop:phoneMode?0:8,overflow:'hidden'}}>
   <SafeAreaProvider><SafeAreaInsetsContext.Provider value={{top:44,bottom:34,left:0,right:0}}><ReduceMotionBridge />
   {screen==='onboarding'?<PreAccountOnboarding initialDraft={freshPreAccountDraft()} onDraftChange={()=>{}} onCreateAccount={async()=>false} onSignIn={()=>{}} />:
    screen==='orb'?<ScrollView contentContainerStyle={{padding:24,gap:32,alignItems:'center',backgroundColor:paper.ground,flexGrow:1}}>
     <Text style={type.display}>Meet your AI tutor.</Text><VoiceOrb state={orb} size={264}/>
     <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,paddingTop:24}}>{states.map(v=><Pressable key={v} accessibilityRole="button" accessibilityLabel={`Show ${v}`} style={{backgroundColor:colour.sun,borderRadius:16,padding:12,minHeight:44}} onPress={()=>setOrb(v)}><Text style={type.label}>{v}</Text></Pressable>)}</View>
     <Text style={type.small}>State specimens. The live room supplies input and output meters.</Text>
    </ScrollView>:
    <ScrollScreen ground={screen==='value'?colour.sun:paper.ground} header={<ScreenHeader leave={{label:'Not now',onPress:()=>setScreen('value')}} />}
     footer={<><PillButton label={screen==='value'?'See the plans':trial?.cta??'Subscribe'} onPress={()=>{if(screen==='value')setScreen('plans');}} />{screen==='plans'&&<WallPlansAtButton trialTerms={trial?.terms??null} priceTerms={chosen===null?null:`${chosen.price} a ${chosen.period==='year'?'year':'month'}`} />}</>}>
     {screen==='value'?<WallYoursPage canBuy onLeave={()=>setScreen('onboarding')} />:<WallPlansPage rows={rows} account={null} selected={selected} trial={trial} onSelect={offer=>setSelected(offer.productId)} onRestore={()=>{}} onOpenPolicy={()=>{}} onOpenTerms={()=>{}} onLeave={()=>setScreen('value')} />}
    </ScrollScreen>}
   </SafeAreaInsetsContext.Provider></SafeAreaProvider>
  </View>
 </View>;
}
