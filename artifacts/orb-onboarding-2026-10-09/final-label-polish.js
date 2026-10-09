
for(const style of ["Regular","Medium","SemiBold","Bold","ExtraBold"])await figma.loadFontAsync({family:"Outfit",style});
const changed=[],created=[];
async function finalLabels(ids){
 for(const id of ids){const n=await figma.getNodeByIdAsync(id);const texts=n.findAllWithCriteria({types:["TEXT"]});
  for(const t of texts){
    if(t.characters==="Next"||t.characters==="See my plan"){t.characters="Continue";changed.push(t.id);}
    if(t.characters==="Start practice"){t.characters="Try this practice";changed.push(t.id);}
    if(t.characters==="Ask the way"){t.characters="Ask for directions";t.textAutoResize="HEIGHT";changed.push(t.id);
      const row=t.parent;if(!row.findAllWithCriteria({types:["TEXT"]}).some(x=>x.characters==="2 exchanges")){
        const label=figma.createText();row.appendChild(label);label.name="First practice exchanges";label.fontName={family:"Outfit",style:"SemiBold"};label.fontSize=14;label.lineHeight={unit:"PIXELS",value:20};label.characters="2 exchanges";label.fills=t.fills;label.textAutoResize="HEIGHT";label.resize(t.width,20);label.layoutSizingHorizontal="FILL";created.push(label.id);
      }
    }
    if(t.characters==="Travel · New to French"){t.characters="Trips, New to French";t.layoutSizingHorizontal="FILL";t.textAutoResize="HEIGHT";changed.push(t.id);}
    if(t.characters==="Alexandre · AI tutor"){t.characters="Alexandre, AI tutor";t.layoutSizingHorizontal="FILL";t.textAutoResize="HEIGHT";changed.push(t.id);}
    if(t.characters==="Edit"&&t.parent.name==="Edit"){t.parent.resize(104,44);t.parent.layoutSizingHorizontal="FIXED";t.resize(104,20);t.layoutSizingHorizontal="FILL";t.characters="Change plan";changed.push(t.id,t.parent.id);}
    if(t.characters==="Choose"&&t.parent.name==="Choose"){t.parent.resize(112,44);t.parent.layoutSizingHorizontal="FIXED";t.resize(112,20);t.layoutSizingHorizontal="FILL";t.characters="Choose tutor";changed.push(t.id,t.parent.id);}
  }
 }
}
