const page=figma.currentPage;
for(const style of ['Regular','Medium','SemiBold','Bold','ExtraBold']) await figma.loadFontAsync({family:'Outfit',style});
const created=[],mutated=[];
const get=async id=>{const n=await figma.getNodeByIdAsync(id);mutated.push(id);return n};
const paint=async id=>figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:1,g:1,b:1}},'color',await figma.variables.getVariableByIdAsync(id));
const sun=await paint('VariableID:3:8'),ink=await paint('VariableID:3:14'),white=await paint('VariableID:3:10');
function collect(n){created.push(n.id,...n.findAll().map(x=>x.id))}
function find(n,name){return n.findOne(x=>x.name===name)}
function rotate(n,deg){const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);n.relativeTransform=[[c,-s,64-64*c+64*s],[s,c,64-64*s-64*c]]}
function button(parent){const b=figma.createAutoLayout('HORIZONTAL',{name:'Get Started',itemSpacing:8,primaryAxisAlignItems:'CENTER',counterAxisAlignItems:'CENTER',fills:[sun],cornerRadius:16});parent.appendChild(b);b.resize(342,56);b.x=24;b.y=726;b.primaryAxisSizingMode='FIXED';b.counterAxisSizingMode='FIXED';const t=figma.createText();t.fontName={family:'Outfit',style:'SemiBold'};t.fontSize=17;t.characters='Get Started';t.fills=[ink];b.appendChild(t);const arrow=figma.createNodeFromSvg('<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="#16123A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');arrow.name='Forward arrow';b.appendChild(arrow);collect(b);return b}
const texts={'4:78':'Still orb → moving ring → Luvani → Get Started','4:79':'First launch, section by section. Open the prototype link to watch the complete welcome.','4:85':'A moment of stillness','4:103':'0–1,500 ms / still','4:104':'The orb and sugary ring rest at the centre of the screen.','4:127':'1,500 ms / motion begins','4:128':'The ring begins turning clockwise as the logo starts its reveal.','4:151':'1,700 ms / name arriving','4:152':'The mark lifts gently; Luvani fades and settles beneath it.','4:157':'Ready when you are','4:175':'2,260 ms / Get Started','4:176':'The logo stays centred. The ring keeps turning and the bottom action waits for a tap.','4:185':'Starts at 1.5 s / settles over 380 ms','4:188':'New: Get Started. Returning: restore Home.','4:207':'Play the welcome','4:208':'Open the prototype to see the still orb, rotating ring, name reveal and responsive Get Started.','4:209':'First launch · 1.5 s still → name → button\nThe ring keeps moving while you decide.'};
for(const[id,value]of Object.entries(texts)){const n=await get(id);n.characters=value}
const ringStage=await get('4:38');rotate(ringStage,0);
const ringGroup=await get('4:37');ringGroup.y=358;
const ringWord=await get('4:41');ringWord.opacity=0;
const nameGroup=await get('4:53');nameGroup.y=320.46;
const nameWord=await get('4:57');nameWord.y=146.28;nameWord.opacity=.894;
rotate(await get('4:54'),30);
button(await get('4:10'));
const original=await get('4:190');
// Keep an editable, exact-timing motion reference alongside the playable flow.
const motion=original.clone();motion.name='Motion reference / first launch';motion.x=2116;motion.y=1900;collect(motion);
const mb=button(motion);
for(const n of motion.findAll()){for(const[field,track]of Object.entries(n.manualKeyframeTracks)){let updated={...track,keyframes:track.keyframes.map(k=>({...k,timelinePosition:field==='ROTATION'?(k.timelinePosition===0?1.5:6.3):(k.timelinePosition===.24?1.5:1.88)}))};n.applyManualKeyframeTrack({type:"PROPERTY",name:field},updated)}}
mb.applyManualKeyframeTrack({type:'PROPERTY',name:'OPACITY'},{keyframes:[{timelinePosition:1.88,value:{type:'FLOAT',value:0},easing:{type:'LINEAR'}},{timelinePosition:2.26,value:{type:'FLOAT',value:1},easing:{type:'EASE_OUT'}}]});
motion.setTimelineDuration(motion.timelines[0].id,6.3);
// Classic prototype states autoplay on a direct /proto link.
for(const n of original.findAll())for(const field of Object.keys(n.manualKeyframeTracks)){n.removeManualKeyframeTrack({type:"PROPERTY",name:field});mutated.push(n.id)}
original.name='01 / Still orb · 1.5 seconds';
const b=button(original);b.opacity=0;
find(original,'Logo group').y=358;
find(original,'luvani · name reveal').opacity=0;
find(original,'luvani · name reveal').y=157;
const frames=[original];
for(let i=1;i<=5;i++){const n=original.clone();n.x=2116+i*470;n.y=326;collect(n);frames.push(n)}
const names=['01 / Still orb · 1.5 seconds','02 / Luvani settles in','03 / Get Started fades in','04 / Welcome · orbit 2','05 / Welcome · orbit 3','06 / Button pressed'];
for(let i=1;i<frames.length;i++){const n=frames[i];n.name=names[i];find(n,'Logo group').y=316;const w=find(n,'luvani · name reveal');w.opacity=1;w.y=145;find(n,'Get Started').opacity=i===1?0:1;rotate(find(n,'Sun ring · clockwise'),[0,57,114,234,354,114][i]);}
const pressed=find(frames[5],'Get Started');pressed.resize(331.74,54.32);pressed.x=29.13;pressed.y=726.84;
const end=figma.createFrame();end.name='Preview complete / onboarding handoff';end.resize(390,844);end.x=2116+6*470;end.y=326;end.fills=original.fills;end.cornerRadius=36;
const copy=figma.createAutoLayout('VERTICAL',{name:'Preview handoff',itemSpacing:16,fills:[],primaryAxisAlignItems:'CENTER',counterAxisAlignItems:'CENTER'});end.appendChild(copy);copy.resize(326,200);copy.x=32;copy.y=322;
for(const [label,size,style]of [['Boot preview complete',27,'Bold'],['Get Started continues to onboarding in the app.',17,'Regular']]){const t=figma.createText();t.fontName={family:'Outfit',style};t.fontSize=size;t.characters=label;t.fills=[white];copy.appendChild(t);t.textAutoResize='HEIGHT';t.resize(326,t.height);t.textAlignHorizontal='CENTER'}
const replay=button(end);find(replay,'Get Started');replay.children[0].characters='Replay welcome';collect(end);
async function link(from,to,trigger,duration=.38,easing='EASE_OUT'){await from.setReactionsAsync([{trigger,actions:[{type:'NODE',destinationId:to.id,navigation:'NAVIGATE',transition:{type:'SMART_ANIMATE',easing:{type:easing},duration},resetScrollPosition:true}]}]);mutated.push(from.id)}
await link(frames[0],frames[1],{type:'AFTER_TIMEOUT',timeout:1.5});
await link(frames[1],frames[2],{type:'AFTER_TIMEOUT',timeout:.001});
await link(frames[2],frames[3],{type:'AFTER_TIMEOUT',timeout:.001},.8,'LINEAR');
await link(frames[3],frames[4],{type:'AFTER_TIMEOUT',timeout:.001},.8,'LINEAR');
await link(frames[4],frames[2],{type:'AFTER_TIMEOUT',timeout:.001},.8,'LINEAR');
for(let i=2;i<=4;i++)await link(find(frames[i],'Get Started'),frames[5],{type:'ON_CLICK'},.1);
await link(frames[5],end,{type:'AFTER_TIMEOUT',timeout:.1},.38);
await link(replay,original,{type:'ON_CLICK'},.2);
page.flowStartingPoints=[...page.flowStartingPoints.filter(x=>x.nodeId!==original.id),{nodeId:original.id,name:'Luvani / First launch'}];mutated.push(page.id);
figma.viewport.scrollAndZoomIntoView([frames[2]]);
await frames[2].screenshot({scale:1});
return {createdNodeIds:[...new Set(created)],mutatedNodeIds:[...new Set(mutated)],prototypeStart:original.id,idle:frames[2].id,motion:motion.id,frames:frames.map(x=>({id:x.id,name:x.name,reactions:x.reactions})),end:end.id};
