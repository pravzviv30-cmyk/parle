for(const spec of SPECS){const s=await shell(spec,spec.key==='free-settings'?'Plan and subscription':'Your French'),p=s.content,f=s.foot; if(spec.key==='first-recap'){
  title(p,'Your first French conversation.');evidenceCard(p,'Un café, s’il vous plaît.','A coffee, please.','coral');
  
  const invite=card(p,'Keep the conversation going.','45 live minutes over seven days. See the yearly plan before starting.');button(invite,'See the seven-day trial','yearly-trial','Quiet');
  txt(p,'22 of 30 welcome minutes remain. This is a one-time sample with no automatic billing.','small',342,'soft');
  button(f,'Continue with free practice','home');button(f,'Review my phrase','metering','Quiet');
  await finish(spec,s,'Show actual learner evidence in production. Illustrative phrase here. Invitation follows the earned recap, once per account. Decline keeps remaining welcome access.');
 }else if(spec.key==='home'){
  title(p,'Bonjour, Praveen.','Ready for your next real conversation?');
  const next=card(p,'Le prochain café','Order your coffee, then ask for a table.','blue');txt(next,'Your next scene · about 3 minutes','small',302,'white');button(next,'Start speaking','locked');
  const invite=card(p,'A little French, more often.','Find a practice rhythm that fits your day.');button(invite,'See speaking plans','yearly-trial','Quiet');button(invite,'Not now','home','Quiet');
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
  txt(p,'Your saved phrases and earned review stay available for free.','body',342,'soft');
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
