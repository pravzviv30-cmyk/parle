#!/usr/bin/env python3
"""Compile C's original layered SVGs into local Rive scenes.
Requires official Rive CLI 1.5.1 and svgpathtools. SVG source is retained verbatim.
Motion tracks in motion.json come from Figma get_motion_context; playback follows the requested continuous loops.
"""
from pathlib import Path
import json,math,os,re,shutil,subprocess,xml.etree.ElementTree as E
from svgpathtools import parse_path, Line, CubicBezier, QuadraticBezier, Arc
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'apps/mobile/assets/bold-rhythm'
CLI=os.environ.get('RIVE_CLI') or shutil.which('rive')
if not CLI:raise SystemExit('Set RIVE_CLI to official Rive CLI.')
MOTION=json.loads((ART/'motion.json').read_text())
def el(tag,**attrs):return E.Element(tag,{k:str(v) for k,v in attrs.items()})
def tag(n):return n.tag.split('}')[-1]
def num(n,k,d=0):return float(n.get(k,d))
def color(v):
 v={'white':'#FFFFFF','black':'#000000'}.get(v,v)
 if not re.fullmatch(r'#[0-9a-fA-F]{6}',v):raise ValueError(f'Unsupported paint {v}')
 return 'FF'+v[1:].upper()
def geom(n):
 t=tag(n)
 if t=='path':return parse_path(n.get('d',''))
 if t in ['polygon','polyline']:
  pts=re.findall(r'-?[\d.]+',n.get('points',''));return parse_path('M'+' L'.join(' '.join(pts[i:i+2]) for i in range(0,len(pts),2))+(' Z' if t=='polygon' else ''))
 if t=='line':return parse_path(f'M{num(n,"x1")} {num(n,"y1")}L{num(n,"x2")} {num(n,"y2")}')
 return None

def bbox(n):
 t=tag(n);p=geom(n)
 if p is not None and len(p):return p.bbox()
 if t in ['ellipse','circle']:
  x,y=num(n,'cx'),num(n,'cy');rx,ry=num(n,'rx',num(n,'r')),num(n,'ry',num(n,'r'));return x-rx,x+rx,y-ry,y+ry
 if t=='rect':return num(n,'x'),num(n,'x')+num(n,'width'),num(n,'y'),num(n,'y')+num(n,'height')
 bs=[bbox(c) for c in n if tag(c) not in ['defs','title','desc']]
 return (min(b[0] for b in bs),max(b[1] for b in bs),min(b[2] for b in bs),max(b[3] for b in bs)) if bs else (0,350,0,320)

def points(shape,path):
 for sub in path.continuous_subpaths():
  segments=[]
  for s in sub:
   if isinstance(s,Arc):segments.extend(s.as_cubic_curves(4))
   elif isinstance(s,QuadraticBezier):segments.append(CubicBezier(s.start,s.start+2/3*(s.control-s.start),s.end+2/3*(s.control-s.end),s.end))
   else:segments.append(s)
  closed=sub.isclosed();vertices=[{'p':segments[0].start}]
  for segment in segments:
   prev=vertices[-1];end={'p':segment.end}
   if isinstance(segment,CubicBezier):prev['out']=segment.control1;end['in']=segment.control2
   vertices.append(end)
  if closed:
   vertices[0].update({k:v for k,v in vertices[-1].items() if k!='p'});vertices.pop()
  p=el('PointsPath',isClosed=str(closed).lower());shape.append(p)
  for v in vertices:
   z=v['p'];a={'x':z.real,'y':z.imag}
   for h in ['in','out']:
    delta=v.get(h,z)-z;a[h+'Rotation']=math.atan2(delta.imag,delta.real);a[h+'Distance']=abs(delta)
   p.append(el('CubicDetachedVertex',**a))

def expanded_frames(frames):
 out=[]
 for i,frame in enumerate(frames):
  out.append(frame)
  if i+1==len(frames) or not frame['ease'].startswith('linear('):continue
  end=frames[i+1];samples=[float(v) for v in frame['ease'][7:-1].split(',')]
  count=max(1,round((end['time']-frame['time'])*60))
  for step in range(1,count):
   p=step/count*(len(samples)-1);j=min(int(p),len(samples)-2);e=samples[j]+(samples[j+1]-samples[j])*(p-j)
   out.append({'time':frame['time']+step/60,'value':[a+(b-a)*e for a,b in zip(frame['value'],end['value'])],'ease':'linear'})
 return out

for source in sorted(ART.glob('*.svg')):
 if source.stem.startswith('orb-'):continue
 name=source.stem;project=ART/'source'/name;project.mkdir(parents=True,exist_ok=True)
 document=E.parse(source).getroot()
 root=el('Rive',version=1,kind='fragment');art=el('Artboard',name='Scene',width=document.get('width',350),height=document.get('height',320));root.append(art)
 animation=el('LinearAnimation',name='Enter',id='0:9000',fps=60,duration=288,loopValue='loop')
 ids=[0]
 def identifier():ids[0]+=1;return f'0:{ids[0]}'
 def convert(n,parent,paint=None):
  t=tag(n)
  if t in ['defs','title','desc']:return
  paint={**{k:v for k,v in (paint or {}).items() if k != 'opacity'},**n.attrib};holder=parent
  # Preserve SVG transform order through nested nodes; never flatten masks/cropping.
  for op,args in re.findall(r'(translate|scale|rotate)\(([^)]*)\)',n.get('transform','')):
   a=[float(v) for v in re.findall(r'-?[\d.]+',args)];props={}
   if op=='translate':props={'x':a[0],'y':a[1] if len(a)>1 else 0}
   if op=='scale':props={'scaleX':a[0],'scaleY':a[1] if len(a)>1 else a[0]}
   if op=='rotate':
    if len(a)>1:
     tr=el('Node',x=a[1],y=a[2]);holder.append(tr);holder=tr
    props={'rotation':math.radians(a[0])}
   tr=el('Node',**props);holder.append(tr);holder=tr
   if op=='rotate' and len(a)>1:
    tr=el('Node',x=-a[1],y=-a[2]);holder.append(tr);holder=tr
  if t in ['svg','g']:
   node=el('Node',name=n.get('id',t),id=identifier(),opacity=paint.get('opacity',1));holder.append(node)
   motion=MOTION.get(name,{}).get(n.get('id',''))
   if motion:
    x0,x1,y0,y1=bbox(n);cx,cy=(x0+x1)/2,(y0+y1)/2
    node.set('x',str(cx));node.set('y',str(cy));content=el('Node',x=-cx,y=-cy);node.append(content)
    ko=el('KeyedObject',objectId=node.get('id'));animation.append(ko)
    for kind,frames in motion['tracks'].items():
     for index,prop in enumerate({'translate':['x','y'],'rotate':['rotation'],'scale':['scaleX','scaleY'],'opacity':['opacity']}[kind]):
      kp=el('KeyedProperty',property=prop);ko.append(kp)
      for frame in expanded_frames(frames):
       values=frame['value'];value=values[min(index,len(values)-1)]
       if kind=='translate':value+=(cx if index==0 else cy)
       if kind=='rotate':value-=frames[0]['value'][0]
       kf=el('KeyFrameDouble',frame=round(frame['time']*60),value=value,interpolationType='cubic' if frame['ease']=='ease-in-out' else 'linear');kp.append(kf)
       if frame['ease']=='ease-in-out':kf.append(el('CubicEaseInterpolator',x1=.42,y1=0,x2=.58,y2=1))
    holder=content
   else:holder=node
   for child in reversed(list(n)):convert(child,holder,paint)
  else:
   shape=el('Shape',name=n.get('id',t),opacity=paint.get('opacity',1));holder.append(shape)
   p=geom(n)
   if p is not None:points(shape,p)
   elif t in ['ellipse','circle']:
    shape.set('x',str(num(n,'cx')));shape.set('y',str(num(n,'cy')));shape.append(el('Ellipse',width=2*num(n,'rx',num(n,'r')),height=2*num(n,'ry',num(n,'r'))))
   elif t=='rect':
    shape.set('x',str(num(n,'x')));shape.set('y',str(num(n,'y')));shape.append(el('Rectangle',width=num(n,'width'),height=num(n,'height'),originX=0,originY=0,cornerRadiusTL=num(n,'rx')))
   else:raise ValueError(f'Unsupported {name}: {t}')
   for mode in ['fill','stroke']:
    col=paint.get(mode,'#000000' if mode=='fill' else 'none')
    if col=='none':continue
    props={'fillRule':paint.get('fill-rule','nonZero').replace('nonzero','nonZero').replace('evenodd','evenOdd')} if mode=='fill' else {'thickness':paint.get('stroke-width',1),'cap':paint.get('stroke-linecap','butt'),'join':paint.get('stroke-linejoin','miter')}
    pa=el(mode.title(),**props);pa.append(el('SolidColor',colorValue=color(col)));shape.append(pa)
 convert(document,art)
 if not len(animation):
  keyed=el('KeyedObject',objectId='0:1');prop=el('KeyedProperty',property='opacity');prop.append(el('KeyFrameDouble',frame=0,value=1,interpolationType='linear'));keyed.append(prop);animation.append(keyed)
 machine=el('StateMachine',name='Scene',id='0:9001');layer=el('StateMachineLayer',name='Illustration',id='0:9002');machine.append(layer)
 entry=el('EntryState',x=0,y=0);entry.append(el('StateTransition',stateToId='0:9003'));layer.append(entry)
 layer.append(el('AnimationState',x=200,y=0,id='0:9003',animationId='0:9000'))
 layer.append(el('AnyState',x=200,y=-120));layer.append(el('ExitState',x=400,y=-120))
 art.set('defaultStateMachineId','0:9001');art.append(machine);art.append(animation)
 E.indent(root);E.ElementTree(root).write(project/'scene.rml',encoding='unicode')
 (project/'rive.yaml').write_text(f'name: {name}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
 subprocess.run([CLI,str(project),'--verify'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run([CLI,str(project),'--once'],check=True,stdout=subprocess.DEVNULL)
 shutil.copyfile(project/'build'/f'{name}.riv',ART/f'{name}.riv')
 print(name,'verified')

subprocess.run([os.sys.executable, str(ROOT/'scripts/build-fluid-orb.py')], check=True)
