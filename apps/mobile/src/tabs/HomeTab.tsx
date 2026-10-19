import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../app/ProfileContext.tsx';
import { useMainLearning } from '../main/useMainLearning.ts';
import { useConversationStart } from '../main/useConversationStart.ts';
import { MainButton, MainFeature, MainHeading, MainRow, MainScreen, MainText } from '../main/MainUI.tsx';
import { latestReadyPack } from '../conversationPacks/model.ts';
import { recommendation } from '../practice/recommendation.ts';
import { resumableOf } from '../practice/opening.ts';
import { practiceCard } from '../practice/practiceCard.ts';
import { practiceRouteParams } from '../practice/practiceRoute.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { dailyTutorVoice } from '../daily/tutorAudio.ts';
import { offlinePractice } from '../main/offlinePractice.ts';
import { practicePreferencesOf } from '../profile/practicePreferences.ts';
import { learningSuggestions } from '../main/learningSuggestions.ts';

/** The learner's own next conversation and practice, in the approved C2 layout. */
export function HomeTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile(); const { data, failed, reload } = useMainLearning();
  const suggestions = learningSuggestions(practicePreferencesOf(profile));
  const offline = offlinePractice(DAILY_ITEMS, TUTOR_DAILY_AUDIO, dailyTutorVoice(profile.tutorVoice), suggestions.preferredTier);
  const conversation = useConversationStart(); const latest = latestReadyPack(data?.packs ?? []);
  const rec = data ? recommendation({ resumable: resumableOf(data.session, data.packs, data.bank), deck: data.deck, bank: data.bank, packs: data.packs, now: Date.now() }) : null;
  const card = data && rec && rec.kind !== 'none' ? practiceCard({ rec, deck: data.deck, packs: data.packs, now: Date.now(), resuming: data.session?.targets.map(t => t.phraseKey) ?? [] }) : null;
  const review = () => {
    if (!card) { nav.navigate('Library', { view: 'practise' }); return; }
    nav.navigate('Drill', card.action.kind === 'practice' ? card.action.params : practiceRouteParams({ origin: 'resume', packId: null, exposed: false }));
  };
  return <MainScreen title={profile.name?.trim() ? `Bonjour ${profile.name.trim()}` : 'Bonjour'}>
    <MainFeature title={'Let’s talk\nFrench.'} motif="cloud" body={suggestions.homeBody} action={{ label: conversation.checking ? 'Connecting…' : `Speak with ${tutorNameOf(profile)}`, onPress: () => conversation.start(suggestions.freeSeed ? { seedTopic: suggestions.freeSeed } : {}), disabled: conversation.checking }}/>
    {conversation.failed && <><MainText>Your tutor cannot connect right now. Try again, or practise a saved line.</MainText><MainRow title={offline ? "Hear, say and compare" : "Browse offline French"} detail="A short sound practice with a recorded example, when available." onPress={() => offline ? nav.navigate('DailyPractice', { id: offline.id, mode: 'shadowing' }) : nav.navigate('DailyLibrary')}/></>}
    {failed ? <><MainText>Your saved work could not be loaded.</MainText><MainButton label="Try loading again" tone="quiet" onPress={reload}/><MainRow title="Browse offline French" detail="Read and practise the bundled collection while your saved work is unavailable." onPress={() => nav.navigate('DailyLibrary')}/></> : !data ? <MainText muted>Finding your saved French…</MainText> : <>
      {card && <MainRow title={rec?.kind === 'resume' ? 'Finish your practice' : 'Ready to review'} detail={card.source ?? 'A short practice from your saved French.'} onPress={review}/>}
      {latest ? <><MainHeading>Your latest conversation</MainHeading><MainRow title={latest.title.en} detail={latest.summary} onPress={() => nav.navigate('Conversations', { packId: latest.id })}/><MainButton label="Practise this conversation" onPress={() => nav.navigate('ConversationPractice', { packId: latest.id })}/></> : <><MainHeading>A little French, ready for real life</MainHeading><MainText>Start a conversation. Useful language from your sessions can become personal practice in My French.</MainText></>}
    </>}
    <MainRow title="Prepare for a conversation" detail="A dinner, a meeting or a trip." onPress={() => nav.navigate('RealMoment')}/>
    <MainHeading>Explore next</MainHeading><MainFeature title="French for real life" motif="plans" tone="ochre" body="Find a conversation idea or practise a phrase for something coming up." action={{ label: 'Browse Explore', onPress: () => nav.navigate('Explore') }}/>
  </MainScreen>;
}
