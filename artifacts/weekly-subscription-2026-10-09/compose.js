// Design-only composition. No application, billing or store mutation.
const page=await figma.getNodeByIdAsync(STATE.pageId);await figma.setCurrentPageAsync(page);
await Promise.all(['Regular','Medium','SemiBold','Bold','ExtraBold'].map(style=>figma.loadFontAsync({family:'Outfit',style})));
const vars={},masters={},styles={},createdNodeIds=[],mutatedNodeIds=[],links=[],evidence=[];
await Promise.all(Object.entries(BASE.vars).map(async([k,id])=>vars[k]=await figma.variables.getVariableByIdAsync(id)));
const ss=await figma.getLocalTextStylesAsync();for(const s of ss)styles[s.name.split('/').pop()]=s;
await Promise.all([...new Set([...Object.values(BASE.icons),...Object.values(BASE.app.illustrations),'3:210','3:213','74:1917',...(STATE.rowMaster?[STATE.rowMaster]:[])])].map(async id=>masters[id]=await figma.getNodeByIdAsync(id)));
function track(n){createdNodeIds.push(n.id);return n;}
function paint(k,n){const v=vars[k],c=v.resolveForConsumer(n).value;return [figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:c.r,g:c.g,b:c.b}},'color',v)];}
function box(p,name,w=342,bg=null,pad=0,gap=12,dir='VERTICAL'){const n=track(figma.createAutoLayout(dir));n.name=name;n.resize(w,10);n.layoutSizingVertical='HUG';n.fills=bg?paint(bg,n):[];n.itemSpacing=gap;if(vars['s'+gap])n.setBoundVariable('itemSpacing',vars['s'+gap]);for(const k of ['paddingLeft','paddingRight','paddingTop','paddingBottom']){n[k]=pad;if(vars['s'+pad])n.setBoundVariable(k,vars['s'+pad]);}p.appendChild(n);return n;}
function text(p,words,style='body',w=342,color='ink',name=null){const t=track(figma.createText());t.fontName=styles[style].fontName;t.textStyleId=styles[style].id;t.characters=words;t.name=name||words.slice(0,35);t.resize(w,10);t.textAutoResize='HEIGHT';t.fills=paint(color,t);p.appendChild(t);return t;}
function inst(p,id){const n=track(masters[id].createInstance());createdNodeIds.push(...n.findAll(()=>true).map(x=>x.id));p.appendChild(n);return n;}
function link(n,to){if(to)links.push({id:n.id,to});return n;}
function action(p,label,to,quiet=false,bg='paper'){const n=inst(p,quiet?'3:213':'3:210');n.setProperties({'Label#3:0':label});n.resize(p.width-p.paddingLeft-p.paddingRight,quiet?44:52);n.layoutSizingHorizontal='FILL';if(!quiet&&bg==='blue'){n.fills=paint('sun',n);for(const t of n.findAllWithCriteria({types:['TEXT']}))t.fills=paint('ink',t);}else if(quiet&&bg==='blue'){for(const t of n.findAllWithCriteria({types:['TEXT']}))t.fills=paint('white',t);}return link(n,to);}
function art(p,key,h=170){const wrap=box(p,'Illustration',342,null,0,0,'HORIZONTAL');wrap.resize(342,h);wrap.layoutSizingVertical='FIXED';wrap.primaryAxisAlignItems='CENTER';wrap.counterAxisAlignItems='CENTER';const n=inst(wrap,BASE.app.illustrations[key]);n.rescale(Math.min(342/n.width,h/n.height));return wrap;}
function row(p,title,detail,to,selected=false){const n=inst(p,STATE.rowMaster);n.setProperties({[STATE.rowProps.title]:title,[STATE.rowProps.detail]:detail});n.resize(p.width-p.paddingLeft-p.paddingRight,n.height);n.layoutSizingHorizontal='FILL';if(selected){n.strokes=paint('blue',n);n.strokeWeight=2;n.fills=paint('white',n);}return link(n,to);}
if(MODE==='component'){
 // Adapted from the skill's createComponentWithVariants helper: a single family
 // with content properties; selected styling is a screen-level instance override.
 const c=track(figma.createComponent());page.appendChild(c);c.name='Evolution / Compact choice';c.resize(342,76);c.layoutMode='VERTICAL';c.primaryAxisSizingMode='AUTO';c.counterAxisSizingMode='FIXED';c.setBoundVariable('cornerRadius',vars.r20);for(const k of ['paddingLeft','paddingRight','paddingTop','paddingBottom'])c.setBoundVariable(k,vars.s16);c.setBoundVariable('itemSpacing',vars.s4);c.fills=paint('white',c);c.x=2450;c.y=400;c.description='Compact plan or task choice. Minimum 76pt; hugs content at larger text sizes. Selected plan uses blue outline plus explicit Selected text. Screen reader role radio for plans, button for navigation.';
 const title=text(c,'Weekly · $5.49','heading',310),detail=text(c,'Every 7 days · 45 live minutes','small',310,'soft');
 const props={title:c.addComponentProperty('Title','TEXT',title.characters),detail:c.addComponentProperty('Detail','TEXT',detail.characters)};title.componentPropertyReferences={characters:props.title};detail.componentPropertyReferences={characters:props.detail};return {createdNodeIds,mutatedNodeIds,rowMaster:c.id,rowProps:props};
}
for(const spec of SPECS){const root=await figma.getNodeByIdAsync(STATE.roots[spec.key]);if(root.children.length)throw Error('Already composed '+spec.key);mutatedNodeIds.push(root.id);const bg=spec.bg||'paper',fg=bg==='blue'||bg==='coral'?'white':'ink';root.fills=paint(bg,root);
 const label=text(page,spec.key+' · '+spec.label,'heading',390);label.x=root.x;label.y=root.y-50;
 const status=box(root,'Top safe area',390,null,0,0,'HORIZONTAL');status.resize(390,44);status.layoutSizingVertical='FIXED';status.paddingLeft=24;status.paddingRight=24;status.primaryAxisAlignItems='SPACE_BETWEEN';status.counterAxisAlignItems='CENTER';text(status,'9:41','label',70,fg);text(status,'•••  ▰','small',70,fg);
 const nav=box(root,'Navigation',390,null,0,0,'HORIZONTAL');nav.resize(390,44);nav.layoutSizingVertical='FIXED';nav.paddingLeft=24;nav.paddingRight=24;nav.primaryAxisAlignItems='SPACE_BETWEEN';nav.counterAxisAlignItems='CENTER';link(text(nav,spec.nav||'Back','label',240,fg),spec.back||'B-home');const close=box(nav,'Close',44,null,0,0,'HORIZONTAL');close.resize(44,44);close.layoutSizingVertical='FIXED';close.counterAxisAlignItems='CENTER';close.primaryAxisAlignItems='CENTER';const ic=inst(close,BASE.icons.Close);ic.resize(24,24);for(const t of ic.findAll(()=>true))if('strokes'in t&&Array.isArray(t.strokes)&&t.strokes.length)t.strokes=paint(fg,t);link(close,spec.back||'B-home');
 const vp=box(root,'Content viewport',390,null,24,0);vp.resize(390,400);vp.layoutSizingVertical='FILL';vp.clipsContent=true;vp.overflowDirection='VERTICAL';vp.paddingTop=12;vp.paddingBottom=12;const content=box(vp,'Content',342,null,0,16);
 text(content,spec.title,spec.kind==='paywall'?'title':'display',342,fg);
 if(spec.kind==='paywall'){
  text(content,'Starter · AI speaking practice','label',342,fg);
  if(spec.key.startsWith('B')){const call=box(content,'Allowance hero',342,'sun',16,4);call.setBoundVariable('cornerRadius',vars.r24);text(call,spec.period==='week'?'45':'180','stat',310);text(call,spec.period==='week'?'live minutes every 7 days':'live minutes refreshed monthly','label',310);}
  else text(content,'45 live minutes every 7 days','heading',342,fg);
  row(content,'Weekly · $5.49'+(spec.period==='week'?' · Selected':''),'Billed every 7 days · 45 live minutes','B-paywall',spec.period==='week');
  row(content,'Monthly · $19'+(spec.period==='month'?' · Selected':''),'Billed monthly · 180 live minutes','B-monthly',spec.period==='month');
  row(content,'Yearly · $199.99'+(spec.period==='year'?' · Selected':''),'Billed yearly · 180 live minutes / month','B-yearly',spec.period==='year');
  text(content,'Saved French stays yours. Minutes don’t roll over.','small',342,fg);
 }else{
  if(spec.art)art(content,spec.art,spec.artHeight||170);
  if(spec.kind==='live'){const orb=inst(content,'74:1917');orb.rescale(220/orb.width);text(content,'Alexandre · AI tutor','label',342,fg);text(content,'Qu’est-ce que vous prenez ?','french',342,fg);text(content,'What would you like?','body',342,fg);}
  if(spec.big)text(content,spec.big,'hero',342,fg);
  if(spec.body)text(content,spec.body,'body',342,fg);
  for(const r of spec.rows||[])row(content,...r);
 }
 const foot=box(root,'Persistent actions',390,bg,24,8);foot.paddingTop=12;foot.paddingBottom=8;
 if(spec.kind==='paywall'){text(foot,spec.period==='week'?'$5.49 today, then every 7 days.':spec.period==='month'?'$19 today, then every month.':'7 days free, then $199.99 every year.','small',342,fg);action(foot,spec.period==='year'?'Start 7-day free trial':'Subscribe '+(spec.period==='week'?'weekly':'monthly'),spec.period==='week'?'B-weekly-pending':spec.period==='year'?'38:4744':'38:4744',false,bg);text(foot,'No Commitment, Cancel Anytime','small',342,fg);const legal=box(foot,'Purchase support',342,null,0,8,'HORIZONTAL');for(const [a,b]of[['Restore','38:3709'],['Terms','38:3418'],['Privacy','38:3327']]){const h=box(legal,a,108,null,0,0);h.resize(108,44);h.layoutSizingVertical='FIXED';h.primaryAxisAlignItems='CENTER';link(text(h,a,'small',108,fg),b);}}
 else {if(spec.cta)action(foot,...spec.cta,false,bg);if(spec.secondary)action(foot,...spec.secondary,true,bg);}
 if(spec.tabs){const bar=box(root,'Tab bar',390,'white',8,0,'HORIZONTAL');for(const[a,b]of[['Home','B-home'],['Speak','35:2711'],['Practice','B-practice'],['Progress','B-progress']]){const h=box(bar,a,93.5,null,0,0);h.resize(93.5,52);h.layoutSizingVertical='FIXED';h.primaryAxisAlignItems='CENTER';const t=text(h,a,'small',93.5,a===spec.tabs?'blue':'soft');t.textAlignHorizontal='CENTER';link(h,b);}}
 const safe=box(root,'Bottom safe area',390,null,0,0);safe.resize(390,34);safe.layoutSizingVertical='FIXED';
 const note=text(page,spec.note||'Design fixture · production data replaces examples. Existing protections and routes remain. Art compresses before text; larger text may scroll.','small',390,'soft');note.x=root.x;note.y=root.y+864;
 evidence.push({key:spec.key,id:root.id,contentHeight:content.height,viewportHeight:vp.height,footerHeight:foot.height,defaultScroll:content.height>vp.height-vp.paddingTop-vp.paddingBottom});
}
return {createdNodeIds,mutatedNodeIds,links,evidence};
