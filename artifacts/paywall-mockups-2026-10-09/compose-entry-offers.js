for(const spec of SPECS){
 const s=await shell(spec,spec.key==='free-settings'?'Plan and subscription':spec.kind==='offer'?'Speaking practice':'Your French');const p=s.content,f=s.foot;
 if(spec.kind==='offer'){
  const max=spec.selected==='max',eligible=spec.selected==='yearly'&&spec.eligible===true;
  title(p,max?'Make more room for French.':spec.key==='return'?'Your French is still here.':spec.selected==='weekly'?'Find your weekly rhythm.':'Keep finding your voice.');
  if(spec.key==='checkout-cancelled')txt(p,'No purchase completed. Your weekly choice is still selected.','small',342,'soft');
  if(spec.key==='payment-failed')txt(p,'The payment did not complete. Try again or choose another plan.','small',342,'ink');
  if(spec.key==='return')txt(p,'Your saved phrases and review are ready when you are.','body',342,'soft');
  const benefits=box(p,'Included in every plan','VERTICAL',342,null,0,'s4');bullet(benefits,'Practise real French situations','Microphone');bullet(benefits,'Get tutor help and feedback','Check');bullet(benefits,'Keep earned phrases and review for free','Book');
  const rows=box(p,'Choose a practice rhythm','VERTICAL',342,null,0,'s8');
  const order=max?['MaxMonthly']:spec.partial?['Monthly','Weekly']:spec.key==='two-offer'?['Yearly','Weekly']:['Yearly','Monthly','Weekly'];
  for(const offer of order){const selected=spec.selected===({Yearly:'yearly',Monthly:'monthly',Weekly:'weekly',MaxMonthly:'max'})[offer];const def=COMP.offers[offer+(selected?'-selected':'-default')];const v={Yearly:{Title:spec.key==='two-offer'?'Yearly':'Yearly · Save 12% vs monthly',Price:'$199.99 every year',Allowance:'180 minutes refreshed each month'},Monthly:{Title:'Monthly',Price:'$19 every month',Allowance:'180 minutes each monthly cycle'},Weekly:{Title:'Weekly · Lowest payment today',Price:'$5.49 every seven days',Allowance:'45 minutes refreshed every seven days'},MaxMonthly:{Title:'Max Monthly',Price:'$29 every month',Allowance:'300 minutes each monthly cycle'}}[offer];const n=inst(rows,def.id,values(def,v));action(n,offer==='Yearly'?(spec.eligible===true?'yearly-trial':'yearly-paid'):offer==='Weekly'?'weekly':offer==='Monthly'?'monthly':'max');}
  if(eligible){inst(p,COMP.timeline);txt(p,'After the trial, 180 minutes refresh monthly. About $16.67/month, billed yearly.','small',342,'soft');}
  if(spec.unknown)txt(p,'Trial eligibility could not be confirmed. This offer is paid today.','small',342,'soft');
  if(spec.partial)txt(p,'The yearly offer is unavailable right now. Restore and manage existing purchases below.','small',342,'soft');
  if(spec.selected==='weekly')txt(p,'About four ten-minute conversations each week. Use your 45 minutes in the way that suits you.','small',342,'soft');
  info(p,'What counts as speaking time?','Live time, refreshes and free earned review','metering');
  button(p,max?'See Starter options':'Need more speaking time?',max?'unselected':'max','Quiet');
  txt(p,'Unused live minutes do not roll over.','small',342,'soft');
  const summaries={yearly:eligible?'$0 today · 45 live minutes across 7 days.\nThen $199.99/year from 16 Oct.\nRenews unless cancelled in the store.':'$199.99 due today. Renews every year.\n180 minutes refresh monthly.\nCancel renewal in the store.',monthly:'$19 due today. Renews every month.\n180 minutes per monthly cycle.\nCancel renewal in the store.',weekly:'$5.49 due today. Renews every seven days.\n45 minutes refresh every seven days.\nCancel renewal in the store.',max:'$29 due today. Renews every month.\n300 minutes per monthly cycle.\nCancel renewal in the store.'};
  txt(f,spec.selected?summaries[spec.selected]:'Choose a plan to see its payment terms.','small');
  const cta=eligible?'Start my seven-day trial':spec.selected==='yearly'?'Subscribe yearly · $199.99':spec.selected==='monthly'?'Subscribe monthly · $19':spec.selected==='weekly'?'Subscribe weekly · $5.49':max?'Subscribe to Max · $29':'Choose a plan';
  const dest=eligible?'store-opening':spec.selected==='weekly'?'success-weekly':spec.selected==='monthly'?'success-monthly':max?'success-max':'success-yearly';
  button(f,cta,dest,'Primary',spec.selected?'Default':'Disabled');button(f,'Continue with free practice','home','Quiet');linksFooter(f);
  await finish(spec,s,(eligible?'Trial appears only after verified eligibility. Proposed trial grant: 45 minutes once. ':spec.unknown?'Unknown eligibility never promises free access. ':'')+'Row selection updates allowance, charge and CTA together. Native confirmation follows the CTA. Prices are sample US candidates. '+(spec.key==='two-offer'?'Experiment A removes monthly; Max remains equally discoverable. ':spec.partial?'Recovery is independent of offer availability. ':'')+'Scrollable details; selected terms stay visible.');
 }else if(spec.key==='first-recap'){
  title(p,'Your first French conversation.');evidenceCard(p,'Un café, s’il vous plaît.','A coffee, please.','coral');
  txt(p,'You made the first step. Your next conversation can build on it.','body',342,'soft');
  const invite=card(p,'Keep the conversation going.','Explore a seven-day trial on the yearly plan. See the live allowance and yearly charge before starting.');button(invite,'See the seven-day trial','yearly-trial','Quiet');
  txt(p,'22 of 30 welcome minutes remain. This is a one-time sample with no automatic billing.','small',342,'soft');
  button(f,'Continue with free practice','home');button(f,'Review my phrase','metering','Quiet');
  await finish(spec,s,'Show actual learner evidence in production. Illustrative phrase here. Invitation follows the earned recap, once per account. Decline keeps remaining welcome access.');
 }else if(spec.key==='home'){
  title(p,'Bonjour, Praveen.','Ready for your next real conversation?');
  const next=card(p,'Le prochain café','Order your coffee, then ask for a table.','blue');txt(next,'Your next scene · about 3 minutes','small',302,'white');button(next,'Start speaking','locked');
  const invite=card(p,'A little French, more often.','Explore weekly, monthly or yearly speaking practice. Eligible yearly includes a seven-day trial.');button(invite,'See speaking plans','yearly-trial','Quiet');button(invite,'Not now','home','Quiet');
  txt(p,'22 welcome minutes left · no automatic billing','small',342,'soft');
  const nav=box(f,'App tabs','HORIZONTAL',342,null,0,'s8');for(const [label,ic]of [['Home','Home'],['Speak','Microphone'],['Practice','Practice'],['Progress','Progress']]){const t=box(nav,label,'VERTICAL',78,null,0,'s4');t.counterAxisAlignItems='CENTER';icon(t,ic);const x=txt(t,label,'small',78);x.textAlignHorizontal='CENTER';}
  await finish(spec,s,'Optional card after meaningful practice; lesson start stays primary. Dismissal invokes shared cooldown. Sample user and scene. No launch modal.');
 }else if(spec.key==='later-recap'){
  title(p,'One more real moment.');evidenceCard(p,'Est-ce qu’il y a une table ?','Is there a table?','coral');
  txt(p,'A useful next step: take your French from the café to checking in.','body',342,'soft');const c=card(p,'Next stop: your hotel.','Build on what you just practised with a new real situation.');button(c,'Explore speaking plans','yearly-trial','Quiet');
  button(f,'Continue to review','home');button(f,'Close recap','home','Quiet');
  await finish(spec,s,'Context comes from a completed scene or stated goal. Invitation waits until recap reading is finished; suppress for paid/trial users and recent dismissers.');
 }else if(spec.key==='locked'){
  title(p,'Check in with confidence.');const c=card(p,'À la réception','Say who you are, ask about your room and check the breakfast time.','blue');txt(c,'A real hotel situation · about 5 minutes','small',302,'white');
  card(p,'Live tutor practice','Choose a speaking plan to practise this situation with your tutor.', 'white','Lock');txt(p,'Your saved phrases and earned review stay available for free.','body',342,'soft');
  button(f,'See speaking plans','unselected');button(f,'Back to available practice','home','Quiet');linksFooter(f);
  await finish(spec,s,'Explain the requested situation before paid live work. Return to the original situation after usable entitlement is verified. No AI cost before access.');
 }else if(spec.key==='welcome-empty'){
  title(p,'Your first chapter is underway.');allowance(p,{Plan:'Welcome speaking time',Status:'One-time sample completed',Amount:'0 minutes',Cap:'of 30 welcome minutes remaining',Date:'No automatic billing'});card(p,'Ready for the next conversation?','Choose a practice rhythm that works for you. Eligible yearly includes a seven-day trial.');
  button(f,'See speaking plans','unselected');button(f,'Review my saved French','home','Quiet');linksFooter(f);
  await finish(spec,s,'No repeat welcome grant. Restore remains available. Free earned review is a real primary alternative, with no urgent countdown.');
 }else if(spec.key==='free-settings'){
  title(p,'Your speaking practice.');allowance(p,{Plan:'Welcome speaking time',Status:'One-time sample · no renewal',Amount:'22 minutes',Cap:'of 30 welcome minutes remaining',Date:'No automatic billing'});info(p,'Choose a practice rhythm','Weekly, monthly or yearly','unselected');info(p,'Restore purchases','Recover an existing subscription','reinstall');info(p,'Billing help','Help with your store or account');txt(p,'Your earned phrases and review stay available.','small',342,'soft');
  button(f,'See speaking plans','unselected');button(f,'Back to Settings','home','Quiet');
  await finish(spec,s,'Settings opens the duration rows directly. Distinguish the unbilled 30-minute welcome sample from a store-backed yearly trial.');
 }else if(spec.key==='reinstall'){
  title(p,'Already have a speaking plan?','Restore the subscription you bought in the store.');card(p,'Use your original Luvani account','You are signed in as Praveen. If you subscribed with another Luvani account, switch to it before restoring.','white','Refresh');info(p,'Restore purchases','Check the store and verify your current access','restore-found');info(p,'Use another account','Sign in to your original Luvani account','restore-linked');info(p,'Billing help','Trouble finding your subscription?');
  button(f,'Restore my purchase','restore-found');button(f,'I’m new · See plans','unselected','Quiet');
  await finish(spec,s,'Restore first on reinstall, new device or account switch. Authenticate before grant. Do not blindly transfer allowance. Also see linked-account and no-purchase results.');
 }
}
return {createdNodeIds,mutatedNodeIds,links,evidence,screenCount:evidence.length};
