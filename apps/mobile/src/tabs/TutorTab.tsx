import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../app/ProfileContext.tsx';
import { MainButton, MainFeature, MainHeading, MainRow, MainScreen, MainText } from '../main/MainUI.tsx';
import { useConversationStart } from '../main/useConversationStart.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { practicePreferencesOf } from '../profile/practicePreferences.ts';
import { learningSuggestions } from '../main/learningSuggestions.ts';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { dailyTutorVoice } from '../daily/tutorAudio.ts';
import { offlinePractice } from '../main/offlinePractice.ts';
/** Free conversation stays a first-class destination; existing admission owns every start. */
export function TutorTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile(); const suggestions = learningSuggestions(practicePreferencesOf(profile)); const offline = offlinePractice(DAILY_ITEMS, TUTOR_DAILY_AUDIO, dailyTutorVoice(profile.tutorVoice), suggestions.preferredTier);
  const conversation = useConversationStart();
  return <MainScreen title="Speak">
    <MainFeature title={'What would you\nlike to talk about?'} motif="talk" body={`Talk with ${tutorNameOf(profile)} about whatever’s on your mind.`} action={{ label: conversation.checking ? 'Connecting…' : 'Just talk', onPress: () => conversation.start(suggestions.freeSeed ? { seedTopic: suggestions.freeSeed } : {}), disabled: conversation.checking }}/>
    <MainButton label="Write instead" tone="quiet" onPress={() => conversation.start(suggestions.freeSeed ? { seedTopic: suggestions.freeSeed } : {}, true)} disabled={conversation.checking}/>
    {conversation.failed && <><MainText>Your tutor cannot connect right now. Try again, or practise a bundled line offline.</MainText><MainButton label={offline ? "Hear, say and compare" : "Browse offline French"} onPress={() => offline ? nav.navigate('DailyPractice', { id: offline.id, mode: 'shadowing' }) : nav.navigate('DailyLibrary')}/></>}
    <MainText muted>{suggestions.support}</MainText>
    <MainRow title={suggestions.fluent ? "Revisit the guided basics" : "See an example first"} detail="A guided beginner situation, with help whenever you need it." onPress={() => nav.navigate('Missions')}/>
    <MainRow title="Prepare for a conversation" detail="Prepare for something coming up." onPress={() => nav.navigate('RealMoment')}/>
    <MainRow title="Revisit a conversation" detail="Choose a topic from a saved conversation." onPress={() => nav.navigate('Library', { view: 'conversations' })}/>
    <MainHeading>Need an idea?</MainHeading>
    {suggestions.ideas.map(idea => <MainRow key={idea.fr} title={idea.title} detail={idea.detail} onPress={() => conversation.start({ seedTopic: { fr: idea.fr, en: idea.en } })} disabled={conversation.checking}/>)}
    <MainText muted>{`${tutorNameOf(profile)} is your virtual French tutor. You can ask questions, change topic and use help at any point.`}</MainText>
    <MainRow title="Your tutor and speaking preferences" onPress={() => nav.navigate('Profile', { sheet: 'tutorVoice' })}/>
  </MainScreen>;
}
