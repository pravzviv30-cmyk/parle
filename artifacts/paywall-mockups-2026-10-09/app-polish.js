const roots=[];for(const [key,id]of Object.entries(IDS))roots.push({key,node:await figma.getNodeByIdAsync(id)});
const fonts=new Map();for(const{node}of roots)for(const t of node.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))fonts.set(JSON.stringify(s.fontName),s.fontName);await Promise.all([...fonts.values()].map(f=>figma.loadFontAsync(f)));
const page=await figma.getNodeByIdAsync(PAGE);await figma.setCurrentPageAsync(page);const createdNodeIds=[],mutatedNodeIds=[],removedNodeIds=[],evidence=[];
function remove(n){removedNodeIds.push(n.id,...('findAll'in n?n.findAll(()=>true).map(x=>x.id):[]));n.remove();}
function goto(id){return{type:'NODE',destinationId:id,navigation:'NAVIGATE',transition:{type:'SMART_ANIMATE',duration:.22,easing:{type:'EASE_OUT'}},resetScrollPosition:true};}
for(const{key,node:n}of roots){const content=n.findOne(x=>x.name==='Content');
if(['practice-home','settings-main'].includes(key)){content.itemSpacing=12;mutatedNodeIds.push(content.id);for(const row of content.children){if(row.type==='FRAME'&&row.layoutMode==='HORIZONTAL'&&row.paddingTop===16){row.paddingTop=12;row.paddingBottom=12;row.minHeight=44;mutatedNodeIds.push(row.id);}}}
if(key.startsWith('live-')&&['live-connecting','live-listen','live-speak','live-thinking','live-paused'].includes(key)){
const nav=n.findOne(x=>x.name==='Navigation'),back=nav.children.find(x=>x.name==='Back');if(back)remove(back);const identity=figma.createText();createdNodeIds.push(identity.id);identity.name='Tutor identity';identity.fontName={family:'Outfit',style:'Medium'};identity.fontSize=14;identity.lineHeight={unit:'PIXELS',value:20};identity.characters='Alexandre · AI tutor\n128 min left';identity.resize(230,20);identity.textAutoResize='HEIGHT';identity.fills=[{type:'SOLID',color:{r:1,g:1,b:1}}];nav.insertChild(0,identity);mutatedNodeIds.push(nav.id);
const footer=n.findOne(x=>x.name==='Persistent actions'),button=footer.children.find(x=>x.type==='INSTANCE');
if(['live-listen','live-speak'].includes(key)&&button){const label=Object.keys(button.componentProperties).find(p=>p.startsWith('Label'));button.setProperties({[label]:key==='live-listen'?'Reply':'Done speaking'});mutatedNodeIds.push(button.id);}
if(['live-connecting','live-thinking'].includes(key)){if(button)remove(button);footer.paddingTop=0;footer.paddingBottom=0;mutatedNodeIds.push(footer.id);await n.setReactionsAsync([{trigger:{type:'AFTER_TIMEOUT',timeout:key==='live-connecting'?1.2:1.6},actions:[goto(DEST_LISTEN)]}]);mutatedNodeIds.push(n.id);}
if(key==='live-connecting'){const controls=content.children.find(x=>x.name==='Conversation controls');if(controls)remove(controls);}
}
const vp=n.findOne(x=>x.name==='Content viewport');evidence.push({key,id:n.id,contentHeight:content.height,usableHeight:vp.height-vp.paddingTop-vp.paddingBottom,scroll:content.height>vp.height-vp.paddingTop-vp.paddingBottom});}
return{createdNodeIds,mutatedNodeIds,removedNodeIds,evidence};
