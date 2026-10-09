const page=await figma.getNodeByIdAsync(LEDGER.pageId);await figma.setCurrentPageAsync(page);
const fonts=new Map();for(const t of page.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))fonts.set(JSON.stringify(s.fontName),s.fontName);await Promise.all([...fonts.values()].map(f=>figma.loadFontAsync(f)));
const createdNodeIds=[],mutatedNodeIds=[],vars={},styles={};
await Promise.all(Object.entries(LEDGER.vars).map(async([k,id])=>vars[k]=await figma.variables.getVariableByIdAsync(id)));
const localStyles=await figma.getLocalTextStylesAsync();for(const[k,id]of Object.entries(LEDGER.styles))styles[k]=localStyles.find(s=>s.id===id);
function track(n){createdNodeIds.push(n.id);return n;}
function paint(k){return [figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}},'color',vars[k])];}
function box(p,name,dir,w,gap='s4'){const n=track(figma.createAutoLayout(dir));n.name=name;p.appendChild(n);n.resize(w,10);n.layoutSizingVertical='HUG';n.fills=[];n.setBoundVariable('itemSpacing',vars[gap]);return n;}
function text(p,v,key,w,color,name,ref){const t=track(figma.createText());t.fontName=styles[key].fontName;t.textStyleId=styles[key].id;t.characters=v;t.name=name;p.appendChild(t);t.resize(w,10);t.textAutoResize='HEIGHT';t.fills=paint(color);if(ref)t.componentPropertyReferences={characters:ref};return t;}
const evidence=[];
for(const [key,def]of Object.entries(COMP.offers)){
 const c=await figma.getNodeByIdAsync(def.id),selected=key.endsWith('selected'),year=key.startsWith('Yearly');mutatedNodeIds.push(c.id,...c.findAll(()=>true).map(n=>n.id));for(const n of [...c.children])n.remove();c.resize(342,84);c.layoutMode='HORIZONTAL';c.primaryAxisSizingMode='FIXED';c.counterAxisSizingMode='FIXED';c.primaryAxisAlignItems='MIN';c.counterAxisAlignItems='CENTER';c.itemSpacing=12;c.fills=paint(selected?'blue':'white');c.strokes=[];c.setBoundVariable('cornerRadius',vars.r20);for(const k of ['paddingTop','paddingBottom','paddingLeft','paddingRight'])c.setBoundVariable(k,vars.s16);
 const radio=track(figma.createEllipse());radio.name=selected?'Selected option':'Available option';radio.resize(22,22);radio.fills=selected?paint('white'):[];radio.strokes=selected?[]:paint('field');radio.strokeWeight=1.5;c.appendChild(radio);
 const terms=box(c,'Offer terms','VERTICAL',272),top=box(terms,'Plan and billed total','HORIZONTAL',272,'s8');
 const type=key.split('-')[0],d={Yearly:['Yearly','$199.99 / year','180 live min / month'],Monthly:['Monthly','$19 / month','180 live min / month'],Weekly:['Weekly','$5.49 / 7 days','45 live min / 7 days'],MaxMonthly:['Max','$29 / month','300 live min / month']}[type];
 text(top,d[0],'label',100,selected?'white':'ink','Title',def.props.Title);const price=text(top,d[1],'strong',164,selected?'white':'ink','Price',def.props.Price);price.textAlignHorizontal='RIGHT';
 const bottom=box(terms,'Allowance and saving','HORIZONTAL',272,'s8');text(bottom,d[2],'small',190,selected?'white':'soft','Allowance',def.props.Allowance);const save=text(bottom,year?'Save 12%':'','small',74,selected?'white':'soft','Saving');save.textAlignHorizontal='RIGHT';
 c.resize(342,84);evidence.push({id:c.id,width:c.width,height:c.height});
}
const a=await figma.getNodeByIdAsync(COMP.allowance.id);mutatedNodeIds.push(a.id,...a.findAll(()=>true).map(n=>n.id));a.setBoundVariable('itemSpacing',vars.s4);for(const k of ['paddingTop','paddingBottom','paddingLeft','paddingRight'])a.setBoundVariable(k,vars.s16);for(const t of a.findAllWithCriteria({types:['TEXT']})){t.resize(310,10);t.textAutoResize='HEIGHT';}a.primaryAxisSizingMode='AUTO';a.resize(342,a.height);a.layoutSizingVertical='HUG';
for(const [key,d]of Object.entries(COMP.buttons)){const c=await figma.getNodeByIdAsync(d.id);mutatedNodeIds.push(c.id);c.resize(342,key.includes('Quiet')?44:52);c.primaryAxisSizingMode='FIXED';c.counterAxisSizingMode='FIXED';}
return {createdNodeIds,mutatedNodeIds,evidence,allowance:{id:a.id,height:a.height}};
