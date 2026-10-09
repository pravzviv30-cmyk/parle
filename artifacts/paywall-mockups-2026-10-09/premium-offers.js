for(const spec of SPECS){
 const s=await shell(spec),p=s.content,f=s.foot,max=spec.selected==='max',eligible=spec.selected==='yearly'&&spec.eligible===true;
 p.setBoundVariable('itemSpacing',vars.s8);const nav=s.root.children[1],more=smallAction(nav,max?'Starter plans':'More time',max?'unselected':'max',96);nav.insertChild(1,more);
 const tone=spec.selected==='weekly'?'sun':spec.selected==='monthly'?'coral':max?'mint':'blue';
 const hero=box(p,'French speaking','VERTICAL',342,tone,'s16','s8');hero.setBoundVariable('cornerRadius',vars.r24);
 txt(hero,max?'Room to speak.':spec.key==='return'?'Your French awaits.':spec.selected==='weekly'?'Your weekly rhythm.':spec.selected==='monthly'?'French, more often.':'Find your French.','title',310,['sun','mint'].includes(tone)?'ink':'white');
 txt(hero,'Real conversations. Live tutor help.','small',310,['sun','mint'].includes(tone)?'ink':'white');
 if(spec.key==='checkout-cancelled')txt(p,'No purchase made. Your weekly choice is saved.','small',342,'soft');
 if(spec.key==='payment-failed')txt(p,'Payment failed. Retry or choose another plan.','small',342,'ink');
 if(spec.unknown)txt(p,'Trial not confirmed. This plan is paid today.','small',342,'soft');
 if(spec.partial)txt(p,'Yearly is unavailable. Choose another plan or restore.','small',342,'soft');
 const rows=box(p,'Speaking plans','VERTICAL',342,null,0,'s8'),order=max?['MaxMonthly']:spec.partial?['Monthly','Weekly']:spec.key==='two-offer'?['Yearly','Weekly']:['Yearly','Monthly','Weekly'];
 const fields={Yearly:{Title:'Yearly',Price:'$199.99 / year',Allowance:'180 live min / month'},Monthly:{Title:'Monthly',Price:'$19 / month',Allowance:'180 live min / month'},Weekly:{Title:'Weekly',Price:'$5.49 / 7 days',Allowance:'45 live min / 7 days'},MaxMonthly:{Title:'Max',Price:'$29 / month',Allowance:'300 live min / month'}};
 for(const offer of order){const key={Yearly:'yearly',Monthly:'monthly',Weekly:'weekly',MaxMonthly:'max'}[offer],def=COMP.offers[offer+(key===spec.selected?'-selected':'-default')];const n=inst(rows,def.id,values(def,fields[offer]));n.resize(342,84);action(n,offer==='Yearly'?(spec.eligible?'yearly-trial':'yearly-paid'):key);}
 if(eligible){const t=box(p,'Seven-day trial','VERTICAL',342,null,0,'s4');for(const [when,what]of [['Today','45 live minutes once · $0'],['Day 5','Reminder, if scheduled'],['Day 7','$199.99/year unless cancelled']]){const row=box(t,when,'HORIZONTAL',342,null,0,'s8');txt(row,when,'label',64,'ink');txt(row,what,'small',270,'soft');}}
 else if(spec.selected==='weekly')txt(p,'About four 10-minute conversations a week.','small',342,'soft');
 else if(max)txt(p,'Used time carries forward on a supported upgrade.','small',342,'soft');
 txt(p,'Unused time expires. No rollover.','small',342,'soft');
 const summary=eligible?'$0 today. Then $199.99/year from 16 Oct.':spec.selected==='yearly'?'$199.99 today. Renews every year.':spec.selected==='monthly'?'$19 today. Renews every month.':spec.selected==='weekly'?'$5.49 today. Renews every seven days.':max?'$29 today. Renews every month.':'Choose a plan to see the payment terms.';
 txt(f,summary,'small');if(spec.selected)txt(f,'Cancel automatic renewal in the store.','small',342,'soft');
 const label=eligible?'Start my seven-day trial':max?'Subscribe to Max':spec.selected==='yearly'?'Subscribe yearly':spec.selected==='monthly'?'Subscribe monthly':spec.selected==='weekly'?'Subscribe weekly':'Choose a plan';
 button(f,label,eligible?'store-opening':spec.selected?'success-'+spec.selected:null,'Primary',spec.selected?'Default':'Disabled');button(f,'Not now','home','Quiet');const legal=box(f,'Recovery and legal','HORIZONTAL',342,null,0,'s4');legal.itemSpacing=0;for(const [label,dest]of [['Restore','reinstall'],['Details','metering'],['Terms',null],['Privacy',null]])smallAction(legal,label,dest,85.5);
 await finish(spec,s,'Premium revision: one headline, compact plan rows and visible allowance, billed total, recurrence, cancellation and action. Prices are provisional US fixtures. Yearly saving is 12% against 12 × $19. Trial: verified yearly eligibility only; 45 minutes once. Reminder requires permission and scheduling. Optional details: unused time does not roll over; earned review stays free. Preserve selection on return. Native checkout is a prototype handoff.');
}
return {createdNodeIds,mutatedNodeIds,links,evidence,screenCount:evidence.length};
