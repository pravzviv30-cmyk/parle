// Uses the bundled collection helper and the app's current Revamp B tokens.
const page = await figma.getNodeByIdAsync('0:1');
await figma.setCurrentPageAsync(page);
if (page.children.length) throw new Error('Foundation phase already has content; inspect the ledger before retrying.');
const createdNodeIds = [], variableIds = [], styleIds = [];
page.name = 'Paywall journeys';
await Promise.all(['Regular','Medium','SemiBold','Bold','ExtraBold'].map(style=>figma.loadFontAsync({family:'Outfit',style})));
const prim = await createVariableCollection('Luvani / Primitives',['Value']);
const sem = await createVariableCollection('Luvani / Paywall',['Light']);
const vals={paper:'#FFF6E9',white:'#FFFFFF',ink:'#16123A',soft:'#5C5A74',line:'#EADFCB',field:'#8A8499',blue:'#3B2FE0',coral:'#D63A22',sun:'#FFC93C',mint:'#2FD18B',highlight:'#D8FF54',skeleton:'#EFE6D6'};
const vars={};
function rgb(hex){return {r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255};}
for(const [key,value] of Object.entries(vals)){
 const p=figma.variables.createVariable('color/'+key,prim.collection,'COLOR');p.scopes=[];p.setValueForMode(prim.modeIds.Value,rgb(value));p.setVariableCodeSyntax('WEB','var(--luvani-'+key+')');variableIds.push(p.id);
 const v=figma.variables.createVariable('color/'+key,sem.collection,'COLOR');v.scopes=['FRAME_FILL','SHAPE_FILL','TEXT_FILL','STROKE_COLOR'];v.setValueForMode(sem.modeIds.Light,{type:'VARIABLE_ALIAS',id:p.id});v.setVariableCodeSyntax('WEB','var(--luvani-'+key+')');v.setVariableCodeSyntax('iOS',key==='paper'?'paper.ground':key==='blue'?'colour.blue':'paper.'+key);variableIds.push(v.id);vars[key]=v;
}
for(const [key,value] of Object.entries({s4:4,s8:8,s12:12,s16:16,s20:20,s24:24,s32:32,r16:16,r20:20,r24:24,r28:28,pill:999})){
 const v=figma.variables.createVariable((key.startsWith('r')||key==='pill'?'radius/':'spacing/')+key,sem.collection,'FLOAT');v.scopes=[key.startsWith('s')?'GAP':'CORNER_RADIUS'];v.setValueForMode(sem.modeIds.Light,value);v.setVariableCodeSyntax('WEB','var(--luvani-'+key+')');v.setVariableCodeSyntax('iOS',key.startsWith('s')?'space('+value/4+')':'radius.'+(key==='pill'?'pill':'card'));variableIds.push(v.id);vars[key]=v;
}
function fill(key){return [figma.variables.setBoundVariableForPaint({type:'SOLID',color:rgb(vals[key])},'color',vars[key])];}
const styles={};
for(const [key,cut,size,line,tracking] of [['display','ExtraBold',44,44,-1.3],['title','ExtraBold',30,33,-.6],['heading','Bold',20,25,-.2],['body','Regular',17,25,0],['strong','SemiBold',17,25,0],['label','SemiBold',16,20,0],['small','Medium',14,20,0],['french','SemiBold',28,34,-.3],['stat','ExtraBold',36,36,-.7]]){
 const s=figma.createTextStyle();s.name='Luvani/'+key;s.fontName={family:'Outfit',style:cut};s.fontSize=size;s.lineHeight={unit:'PIXELS',value:line};s.letterSpacing={unit:'PIXELS',value:tracking};styles[key]=s;styleIds.push(s.id);
}
function track(n){createdNodeIds.push(n.id);return n;}
function box(parent,name,dir,w,bg,pad=0,gap=16){const n=track(figma.createAutoLayout(dir));n.name=name;n.resize(w,10);n.layoutSizingHorizontal='FIXED';n.layoutSizingVertical='HUG';n.fills=bg?fill(bg):[];n.itemSpacing=gap;n.paddingTop=pad;n.paddingBottom=pad;n.paddingLeft=pad;n.paddingRight=pad;if(parent)parent.appendChild(n);return n;}
function text(parent,value,style,width,color='ink'){const t=track(figma.createText());t.name=value.slice(0,55);t.fontName=styles[style].fontName;t.textStyleId=styles[style].id;t.characters=value;t.resize(width,10);t.textAutoResize='HEIGHT';t.fills=fill(color);parent.appendChild(t);return t;}
const cover=box(page,'Start here / Design scope','VERTICAL',2520,'blue',48,24);cover.x=200;cover.y=160;cover.cornerRadius=28;
text(cover,'A little practice. A lot more French.','display',2200,'white');
text(cover,'Luvani paywall journeys · 56 editable states · 9 October 2026','heading',2200,'white');
text(cover,'Current app style: Outfit, warm paper, white cards, one purposeful colour, ink actions. Added clarity: a trial timeline, a tangible example week, transparent selected terms and calm subscription aftercare.','body',1800,'white');
text(cover,'Design preview only. Sample US terms: Weekly $5.49 / 45 minutes is the founder-selected target. Monthly $19, Yearly $199.99, Max $29 and the once-only 45-minute yearly trial cap are unverified or provisional. All dates, balances and learner phrases are illustrative. Live screens must use verified store/server data.','body',1800,'white');
text(cover,'Based on the supplied report, sections 20–28. No live purchase configuration. No family, lifetime, artificial discount, exit-offer chain, or acquisition popup for active subscribers.','small',1800,'white');
let y=cover.y+cover.height+100;
const groups=[...new Set(SCREEN_SPECS.map(s=>s.group))], screens={}, boards={};
for(const group of groups){
 const specs=SCREEN_SPECS.filter(s=>s.group===group);
 const board=box(page,group,'VERTICAL',2520,'skeleton',32,24);board.x=200;board.y=y;board.cornerRadius=28;boards[group]=board.id;
 text(board,group,'display',2456);text(board,'Sample data · Editable UI · Refer to the notes beneath each screen','small',2456,'soft');
 let row=null;
 for(let i=0;i<specs.length;i++){
  if(i%6===0)row=box(board,'Screen row '+(Math.floor(i/6)+1),'HORIZONTAL',2456,null,0,20);
  const spec=specs[i], cell=box(row,spec.name+' / Review','VERTICAL',390,null,0,12);
  text(cell,String(SCREEN_SPECS.indexOf(spec)+1).padStart(2,'0')+' · '+spec.name,'label',390);
  const screen=box(cell,spec.key,'VERTICAL',390,'paper',0,0);screen.resize(390,844);screen.layoutSizingHorizontal='FIXED';screen.layoutSizingVertical='FIXED';screen.cornerRadius=28;screen.clipsContent=true;screen.placeholder=true;
  screens[spec.key]={id:screen.id,cell:cell.id,group};
 }
 y=board.y+board.height+100;
}
const assetArea=box(page,'Shared paywall components','VERTICAL',2520,'skeleton',32,32);assetArea.x=200;assetArea.y=y;assetArea.cornerRadius=28;
text(assetArea,'Shared paywall components','display',2400);
text(assetArea,'Components and current app tokens. Used as instances throughout the review screens.','body',2400,'soft');
figma.viewport.scrollAndZoomIntoView([cover]);
return {createdNodeIds,mutatedNodeIds:[page.id],variableIds,styleIds,collectionIds:[prim.collection.id,sem.collection.id],pageId:page.id,coverId:cover.id,boards,screens,assetAreaId:assetArea.id,vars:Object.fromEntries(Object.entries(vars).map(([k,v])=>[k,v.id])),styles:Object.fromEntries(Object.entries(styles).map(([k,v])=>[k,v.id])),screenCount:Object.keys(screens).length,font:'Outfit'};
