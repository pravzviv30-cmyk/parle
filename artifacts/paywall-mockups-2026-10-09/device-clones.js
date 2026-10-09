// Applied only to accessibility fixtures; ordinary screens retain shared instances.
// Load the fixture's fonts before calling. Keep text at the requested scale.
function largeTextLayout(root, createdNodeIds, mutatedNodeIds, removedNodeIds) {
  const touched = new Set();
  const touch = n => { if (n) touched.add(n.id); };
  const fillText = t => {
    t.layoutSizingHorizontal = 'FILL';
    t.textAutoResize = 'HEIGHT';
    t.textAlignHorizontal = 'LEFT';
    touch(t);
  };
  const hero = root.findOne(n => n.name === 'French speaking');
  if (hero) {
    hero.layoutMode = 'VERTICAL';
    hero.layoutSizingVertical = 'HUG';
    hero.clipsContent = false;
    touch(hero);
    for (const c of hero.children) {
      if (c.type === 'TEXT') fillText(c);
      else { c.visible = false; touch(c); } // Decorative illustration yields to text.
    }
  }
  const more = root.findOne(n => n.type === 'FRAME' && n.name === 'More time');
  if (more) {
    more.resize(144, 44);
    more.minHeight = 44;
    more.layoutSizingVertical = 'HUG';
    touch(more);
    for (const t of more.children) if (t.type === 'TEXT') fillText(t);
  }
  const nav = root.findOne(n => n.name === 'Navigation');
  if (nav) { nav.minHeight = 44; nav.layoutSizingVertical = 'HUG'; touch(nav); }
  for (const offer of root.findAll(n => n.type === 'INSTANCE' && n.name === 'Paywall/Offer row')) {
    removedNodeIds.push(offer.id, ...offer.findAll(() => true).map(n => n.id));
    const card = offer.detachInstance();
    createdNodeIds.push(card.id, ...card.findAll(() => true).map(n => n.id));
    card.counterAxisAlignItems = 'MIN';
    card.layoutSizingVertical = 'HUG';
    card.minHeight = 84;
    touch(card);
    for (const row of card.findAll(n => n.type === 'FRAME' && ['Plan and billed total', 'Allowance and saving'].includes(n.name))) {
      row.layoutMode = 'VERTICAL';
      row.itemSpacing = 4;
      row.layoutSizingHorizontal = 'FILL';
      row.layoutSizingVertical = 'HUG';
      touch(row);
      for (const t of row.children) if (t.type === 'TEXT') {
        fillText(t);
        if (!t.characters.trim()) { t.visible = false; touch(t); }
      }
    }
  }
  const timeline = root.findOne(n => n.name === 'Seven-day trial');
  if (timeline) for (const row of timeline.children) {
    row.layoutMode = 'VERTICAL'; row.itemSpacing = 4; touch(row);
    for (const t of row.children) if (t.type === 'TEXT') fillText(t);
  }
  const legal = root.findOne(n => n.name === 'Recovery and legal');
  if (legal) {
    legal.layoutWrap = 'WRAP';
    legal.itemSpacing = 12;
    legal.counterAxisSpacing = 8;
    touch(legal);
    for (const hit of legal.children) {
      hit.resize((legal.width - 12) / 2, 44);
      hit.layoutSizingHorizontal = 'FIXED';
      hit.layoutSizingVertical = 'HUG';
      hit.minHeight = 44; touch(hit);
      for (const t of hit.children) if (t.type === 'TEXT') fillText(t);
    }
  }
  const stats = root.findOne(n => n.name === 'Your progress');
  if (stats) {
    stats.layoutMode = 'VERTICAL';
    stats.layoutSizingVertical = 'HUG';
    touch(stats);
    for (const card of stats.children) {
      card.layoutSizingHorizontal = 'FILL';
      card.layoutSizingVertical = 'HUG'; touch(card);
      for (const t of card.children) if (t.type === 'TEXT') fillText(t);
    }
  }
  mutatedNodeIds.push(...touched);
}

await Promise.all(['Regular','Medium','SemiBold','Bold','ExtraBold'].map(style=>figma.loadFontAsync({family:'Outfit',style})));
const createdNodeIds=[],mutatedNodeIds=[],removedNodeIds=[],pending=[],evidence=[];
for(const s of SPECS){const source=await figma.getNodeByIdAsync(s.id),copy=source.clone();createdNodeIds.push(copy.id,...copy.findAll(()=>true).map(n=>n.id));copy.name=s.key+' · '+s.width+'×'+s.height+' · '+s.scale+'× text';for(const n of [copy,...copy.findAll(()=>true)])if('reactions'in n&&n.reactions.length)await n.setReactionsAsync([]);pending.push({s,copy});}
const page=await figma.getNodeByIdAsync(PAGE);await figma.setCurrentPageAsync(page);
function flex(n){if(!('children'in n)||n.type==='INSTANCE'||n.name.startsWith('Illustration /'))return;
for(const c of n.children){if(n.layoutMode==='HORIZONTAL'&&((c.type==='TEXT'&&c.width>100)||['Words','Scene text'].includes(c.name)||n.name==='Recovery and legal'))c.layoutSizingHorizontal='FILL';flex(c);}}
for(const{s,copy:n}of pending){page.appendChild(n);n.x=500+s.index%4*490;n.y=720+Math.floor(s.index/4)*1220;if(s.index===9)n.x=1440;if(s.reduced){n.x=500;n.y=4380;}n.resize(s.width,s.height);n.layoutSizingVertical='FIXED';flex(n);
const landscape=s.width>s.height,status=n.findOne(x=>x.name==='Status safe area'||x.name==='Status bar'),bottom=n.findOne(x=>x.name==='Bottom safe area'||x.name==='Home indicator'),nav=n.findOne(x=>x.name==='Navigation'),content=n.findOne(x=>x.name==='Content'),vp=n.findOne(x=>x.name==='Content viewport'||x.name==='Scrollable content'),foot=n.findOne(x=>x.name==='Persistent actions');
status.resize(s.width,landscape?0:44);status.layoutSizingHorizontal='FILL';status.layoutSizingVertical='FIXED';status.clipsContent=true;bottom.resize(s.width,landscape?21:34);bottom.layoutSizingHorizontal='FILL';bottom.layoutSizingVertical='FIXED';const gutter=landscape?(s.width-560)/2:24;for(const v of [vp,nav,foot]){v.paddingLeft=gutter;v.paddingRight=gutter;}content.itemSpacing=Math.min(content.itemSpacing,12);
for(const wrap of n.findAll(x=>x.type==='FRAME'&&x.name.startsWith('Illustration /'))){const child=wrap.children[0];const h=Math.min(wrap.height,s.scale>1?72:(s.height-78)*.2);if(child?.type==='INSTANCE'&&h<wrap.height){child.rescale(h/wrap.height);wrap.resize(wrap.width,h);wrap.layoutSizingVertical='FIXED';}}
if(s.scale>1){for(const t of n.findAllWithCriteria({types:['TEXT']})){if(t.parent===status)continue;t.fontSize=Number(t.fontSize)*s.scale;const lh=t.lineHeight;if(lh.unit==='PIXELS')t.lineHeight={unit:'PIXELS',value:lh.value*s.scale};if(t.parent?.layoutMode==='VERTICAL')t.textAutoResize='HEIGHT';}const tab=n.findOne(x=>x.name==='Tab bar');if(tab)for(const c of tab.children)c.layoutSizingVertical='HUG';}
if(s.scale>1)largeTextLayout(n,createdNodeIds,mutatedNodeIds,removedNodeIds);
const maxFooter=(s.height-(landscape?21:78))*.38;if(foot.height>maxFooter){foot.resize(s.width,maxFooter);foot.layoutSizingHorizontal='FILL';foot.layoutSizingVertical='FIXED';foot.clipsContent=true;foot.overflowDirection='VERTICAL';}
if(s.reduced){for(const x of [n,...n.findAll(v=>v.type==='FRAME')]){let a=x.parent,inside=false;while(a&&a!==n){if(a.type==='INSTANCE'){inside=true;break;}a=a.parent;}if(!inside)for(const field of ['OPACITY','TRANSLATION_X','TRANSLATION_Y','SCALE_X','SCALE_Y'])x.removeManualKeyframeTrack({type:'PROPERTY',name:field});}}
const title=figma.createText();createdNodeIds.push(title.id);title.fontName={family:'Outfit',style:'Medium'};title.fontSize=18;title.lineHeight={unit:'PIXELS',value:24};title.characters=s.label;title.resize(s.width,24);title.textAutoResize='HEIGHT';page.appendChild(title);title.x=n.x;title.y=n.y-56;
const note=figma.createText();createdNodeIds.push(note.id);note.fontName={family:'Outfit',style:'Regular'};note.fontSize=14;note.lineHeight={unit:'PIXELS',value:20};note.characters=s.scale>1?'Large text: content and action areas scroll independently; no text is capped or truncated.':landscape?'Landscape: safe-area gutters, bounded reading width and scrolling preserve the full terms.':s.reduced?'Reduced Motion: artwork is visible without scale, translation or pulse.':'Default text: essential choices and actions fit the compact screen.';note.resize(s.width,20);note.textAutoResize='HEIGHT';page.appendChild(note);note.x=n.x;note.y=n.y+n.height+16;
evidence.push({key:s.key,id:n.id,w:n.width,h:n.height,fontScale:s.scale,contentHeight:content.height,contentViewport:vp.height-vp.paddingTop-vp.paddingBottom,footerHeight:foot.height,bodyScroll:content.height>vp.height-vp.paddingTop-vp.paddingBottom,footerScroll:foot.overflowDirection==='VERTICAL',reduced:!!s.reduced});}
return {createdNodeIds,mutatedNodeIds,removedNodeIds,evidence};
