await Promise.all(['Regular','Medium','SemiBold','Bold','ExtraBold'].map(style=>figma.loadFontAsync({family:'Outfit',style})));
const createdNodeIds=[],mutatedNodeIds=[],frames={},linkMap={},pending=[];
for(const spec of SPECS){const source=await figma.getNodeByIdAsync(spec.id);const copy=source.clone();copy.name=spec.key;createdNodeIds.push(copy.id,...copy.findAll(()=>true).map(n=>n.id));frames[spec.key]=copy.id;copy.x=500+spec.index%8*440;copy.y=600+Math.floor(spec.index/8)*1000;pending.push(copy);
const pairs=[[source,copy]];while(pairs.length){const[a,b]=pairs.pop();if(SOURCE_LINKS[a.id])linkMap[b.id]=SOURCE_LINKS[a.id];if('children'in a&&'children'in b)for(let i=0;i<a.children.length;i++)pairs.push([a.children[i],b.children[i]]);}
}
const page=await figma.getNodeByIdAsync('8:1665');await figma.setCurrentPageAsync(page);for(const n of pending)page.appendChild(n);mutatedNodeIds.push(page.id);
return {createdNodeIds,mutatedNodeIds,frames,linkMap,count:pending.length};
