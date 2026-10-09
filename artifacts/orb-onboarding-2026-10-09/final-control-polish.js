
for (const s of ["Regular","Medium","SemiBold","Bold","ExtraBold"]) await figma.loadFontAsync({family:"Outfit",style:s});
const changed=[],created=[];
async function paint(name,node){ const v=await figma.variables.getVariableByIdAsync({"white":"VariableID:2:7","ink":"VariableID:2:9","sun":"VariableID:2:21"}[name]);const c=v.resolveForConsumer(node).value; return figma.variables.setBoundVariableForPaint({type:"SOLID",color:{r:c.r,g:c.g,b:c.b}},"color",v);}
async function polish(roots){
 for (const id of roots){const root=await figma.getNodeByIdAsync(id);
  const labels=root.findAllWithCriteria({types:["TEXT"]});
  for(const t of labels.filter(t=>t.characters==="Make my plan")){t.fills=[await paint("ink",t)];t.parent.fills=[await paint("white",t.parent)];changed.push(t.id,t.parent.id);}
  if(id=== "78:2018" || id==="99:3455"){const tea=labels.find(t=>t.characters==="Tea");if(tea){tea.parent.fills=[await paint("sun",tea.parent)]; changed.push(tea.parent.id);}}
  const row=root.query('FRAME[name="Choose each time"]').first();
  if(row&&!row.findAllWithCriteria({types:["TEXT"]}).length){
    const t=figma.createText();row.appendChild(t);t.name="Choose each time";t.fontName={family:"Outfit",style:"SemiBold"};t.fontSize=14;t.characters="Choose each time";t.lineHeight={unit:"PIXELS",value:20};t.fills=[await paint("ink",t)];t.textAutoResize="HEIGHT";t.resize(310,20);t.layoutSizingHorizontal="FILL";t.layoutSizingVertical="HUG";row.itemSpacing=8; row.counterAxisAlignItems="CENTER"; created.push(t.id);changed.push(row.id);
  }
 }
}
