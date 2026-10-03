import { useAuth } from '../auth/useAuth.tsx';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { missionStates } from '@luvani/core';
import { Illustration } from '../art/flat/Illustration.tsx';
import { GhostButton, PillButton, ProgressDots } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { loadHistory } from './store.ts';
import { loadActivity } from './activity.ts';
import { hasStory, storyFrom, type WeekStory } from './story.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadDeck } from '../review/store.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { nextTimeLine } from '../live/keepsake.ts';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { colour as palette, paper, space, type } from '../theme.ts';

/** The existing seven-day evidence projection; never a week-over-week loss. */
export function WeekWrappedScreen() {
  const back = useBackToHome();
  const {user} = useAuth();
  const nav = useNavigation<{navigate:(screen:string)=>void}>();
  const [model,setModel] = useState<{story:WeekStory;next:string|null}|null>(null);
  const [page,setPage] = useState(0);
  const [failed,setFailed] = useState(false);
  const [readAttempt,setReadAttempt] = useState(0);
  const [readOwner,setReadOwner] = useState(() => scopeGeneration());
  useFocusEffect(useCallback(()=>{
    const owner=scopeGeneration(); let live=true;
    setReadOwner(owner);
    setModel(null);setFailed(false);setPage(0);
    void Promise.all([loadHistory(),loadActivity({ strict: true }),loadConversationPacks(),loadMissionCompletions(),loadDeck()]).then(([sessions,activity,packs,completions,deck])=>{
      if (!live || owner !== scopeGeneration()) return;
      const now=Date.now();
      setModel({story:storyFrom({sessions,activity,packs,completions,now}),next:nextTimeLine(missionStates(missionCompletionsFrom(completions),deck,now))});
    }).catch(()=>{if(live && owner===scopeGeneration()) setFailed(true);});
    return ()=>{live=false;};
  },[user?.id,readAttempt]));
  const current=readOwner===scopeGeneration();
  const populated=current && model!==null && hasStory(model.story);
  return <ScrollScreen ground={populated ? palette.blue : paper.ground} bottom="inset" header={<ScreenHeader title={populated ? <Text style={[type.heading,{color:paper.onInk}]}>Your week in French</Text> : "Your week in French"} back={{onPress:back}} />} footer={populated ? <View style={{gap:space(2)}}>
    <PillButton label={page===1?'Done':'Next'} tone="white" onPress={()=>page===1?back():setPage(page+1)} />
    {page===1 && <GhostButton label="Choose a scene" color={paper.onInk} onPress={()=>nav.navigate('Missions')} />}
    {page>0 && <GhostButton label="Previous" color={paper.onInk} onPress={()=>setPage(page-1)} />}
  </View> : undefined}>
    {current && failed ? <View style={{gap:space(3)}}><Text style={type.body}>Your week could not be read.</Text><GhostButton label="Try loading your week again" onPress={()=>setReadAttempt((n)=>n+1)} /></View> : populated ? <View style={{gap:space(5)}}>
      <ProgressDots total={2} index={page} ground="blue" />
      {page===0 ? <><Illustration name="celebrate-wrapped" fit="small" /><Text style={[type.small,{color:paper.onInk}]}>From your last seven days</Text><Text style={[type.title,{color:paper.onInk}]}>{model.story.sentences[0]}</Text>{model.story.sentences.slice(1).map(line=><Text key={line} style={[type.body,{color:paper.onInk}]}>{line}</Text>)}</> : <Text style={[type.heading,{color:paper.onInk}]}>{model.next ?? "Choose a scene that interests you next."}</Text>}
    </View> : current && model ? <View style={{gap:space(4)}}><Illustration name="state-notebook" fit="small" /><Text style={type.body}>Your week will take shape as you practise. Start with a scene that interests you.</Text><PillButton label="Choose a scene" onPress={()=>nav.navigate('Missions')} /></View> : <Text style={type.body}>Finding your week.</Text>}
  </ScrollScreen>;
}
