import { useAuth } from '../auth/useAuth.tsx';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { missionStates, type MissionProgress } from '@luvani/core';
import { Illustration } from '../art/flat/Illustration.tsx';
import { IconAction, Card, GhostButton, PillButton } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadDeck } from '../review/store.ts';
import { earnedPostcards } from '../recap/evidence.ts';
import { postcardIllustration } from '../recap/postcardArt.ts';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { colour, paper, space, type } from '../theme.ts';

/** A place keepsake for earned independence, with no locked collection slots. */
export function PostcardsScreen() {
  const back = useBackToHome();
  const {user} = useAuth();
  const nav = useNavigation<{navigate:(screen:string,params?:object)=>void}>();
  const [cards, setCards] = useState<MissionProgress[] | null>(null);
  const [failed, setFailed] = useState(false);
  useFocusEffect(useCallback(() => {
    const owner = scopeGeneration(); let live = true;
    setCards(null); setFailed(false);
    void Promise.all([loadMissionCompletions(),loadDeck()]).then(([completions,deck]) => {
      if (live && owner === scopeGeneration()) setCards(earnedPostcards(missionStates(missionCompletionsFrom(completions),deck,Date.now())));
    }).catch(() => {if(live && owner === scopeGeneration()) setFailed(true);});
    return () => {live=false;};
  }, [user?.id]));
  return <ScrollScreen ground={cards && cards.length > 0 ? colour.mint : paper.ground} bottom="inset" header={<ScreenHeader title="Place postcards" back={{onPress:back}} />}>
    {failed ? <Text style={type.body}>Your postcards could not be read. Please open this page again.</Text> : cards?.length === 0 ? <View style={{gap:space(4)}}>
      <Illustration name="state-notebook" fit="small" />
      <Text style={type.body}>A place postcard comes with a scene you finish on your own. Practice with help is welcome, too.</Text>
      <PillButton label="Choose a scene" onPress={()=>nav.navigate('Missions')} />
    </View> : cards?.map(card => <Card key={card.mission.id} style={{backgroundColor:paper.card,marginBottom:space(5),gap:space(3)}}>
      <Illustration name={postcardIllustration(card.mission.id)} />
      <Text style={[type.heading,{color:paper.ink}]}>{card.mission.titleEn}</Text>
      <Text style={[type.body,{color:paper.ink}]}>{card.mission.earnedEn}</Text>
      <Text style={[type.small,{color:paper.inkSoft}]}>Earned by finishing this scene independently.</Text>
      <IconAction layout="inline" icon="forward" label="See scene details" onPress={()=>nav.navigate('Missions', { focus: card.mission.id })} />
    </Card>)}
  </ScrollScreen>;
}
