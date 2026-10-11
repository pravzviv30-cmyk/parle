#!/usr/bin/env python3
"""Compile the user's soft sphere reference as local, continuously animated Rive vectors.

State colours are derived from Luvani's palette. Only the interior gradients move;
application code separately scales the sphere from measured microphone/tutor audio.
"""
import json, math, os, shutil, subprocess
from pathlib import Path
import xml.etree.ElementTree as E

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'apps/mobile/assets/bold-rhythm'
CLI = os.environ.get('RIVE_CLI') or shutil.which('rive')
if not CLI:
    raise SystemExit('Set RIVE_CLI to the official Rive CLI.')

def el(tag, **attrs):
    return E.Element(tag, {k: str(v) for k, v in attrs.items()})

def tint(hex_color, white):
    rgb = [int(hex_color[i:i+2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(v + (255-v)*white):02X}' for v in rgb)

PALETTE = {
    'ready': ('#3B2FE0', .40),
    'connecting': ('#3B2FE0', .56),
    'listening': ('#FFC93C', .02),
    'thinking': ('#3B2FE0', .02),
    'speaking': ('#D63A22', .32),
    'error': ('#F7D8C7', -.32),
}
for state, (colour, amount) in PALETTE.items():
    name = f'orb-{state}'
    # Negative tints shade the pale sage/peach without adding another brand hue.
    hue = tint(colour, amount) if amount >= 0 else '#' + ''.join(f'{round(int(colour[i:i+2],16)*(1+amount)):02X}' for i in (1,3,5))
    pale = tint(colour, .70)
    root = el('Rive', version=1, kind='fragment')
    art = el('Artboard', name='Scene', width=232, height=232, defaultStateMachineId='0:9001')
    root.append(art)
    animation = el('LinearAnimation', name='Enter', id='0:9000', fps=60, duration=480, loopValue='loop')
    # Last sibling draws first. Every overlay uses the same circle geometry,
    # keeping the silhouette perfectly round while the light moves inside it.
    layers = [
        ('Haze', 'RadialGradient', -48, 28, 108, 28, [('B3FFFFFF',0), ('35FFFFFF',.58), ('00FFFFFF',1)], '0:21'),
        ('Colour cloud', 'RadialGradient', 30, -60, 180, -60, [('DB'+hue[1:],0), ('66'+hue[1:],.48), ('00'+hue[1:],1)], '0:22'),
        ('Base', 'LinearGradient', 0, -110, 0, 110, [('FF'+tint(colour,.43)[1:],0), ('FF'+pale[1:],1)], '0:23'),
    ]
    for label, kind, sx, sy, ex, ey, stops, ident in layers:
        shape = el('Shape', name=label, x=116, y=116)
        shape.append(el('Ellipse', width=220, height=220))
        fill = el('Fill')
        gradient = el(kind, name=label, id=ident, startX=sx, startY=sy, endX=ex, endY=ey)
        for paint, position in stops:
            gradient.append(el('GradientStop', colorValue=paint, position=position))
        fill.append(gradient); shape.append(fill); art.append(shape)
        if label != 'Base' and state != 'error':
            obj = el('KeyedObject', objectId=ident)
            for prop, base, amp, phase in [('startX',sx,22,0),('endX',ex,22,0),('startY',sy,18,math.pi/2),('endY',ey,18,math.pi/2)]:
                track = el('KeyedProperty', property=prop)
                for step in range(33):
                    value = base + amp * math.sin(step/32*2*math.pi + phase)
                    track.append(el('KeyFrameDouble', frame=step*15, value=value, interpolationType='linear'))
                obj.append(track)
            animation.append(obj)
    # Error is intentionally quiet, including with motion enabled.
    if not len(animation):
        obj=el('KeyedObject',objectId='0:23');track=el('KeyedProperty',property='startX')
        track.append(el('KeyFrameDouble',frame=0,value=0,interpolationType='linear'));obj.append(track);animation.append(obj)
    machine=el('StateMachine',name='Scene',id='0:9001'); layer=el('StateMachineLayer',name='Fluid light',id='0:9002');machine.append(layer)
    entry=el('EntryState',x=0,y=0);entry.append(el('StateTransition',stateToId='0:9003'));layer.append(entry)
    layer.append(el('AnimationState',x=200,y=0,id='0:9003',animationId='0:9000'))
    layer.append(el('AnyState',x=200,y=-120));layer.append(el('ExitState',x=400,y=-120));art.append(machine);art.append(animation)
    project=ART/'source'/name;project.mkdir(parents=True,exist_ok=True)
    E.indent(root);E.ElementTree(root).write(project/'scene.rml',encoding='unicode')
    (project/'rive.yaml').write_text(f'name: {name}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    subprocess.run([CLI,str(project),'--verify'],check=True,stdout=subprocess.DEVNULL)
    subprocess.run([CLI,str(project),'--once'],check=True,stdout=subprocess.DEVNULL)
    shutil.copyfile(project/'build'/f'{name}.riv',ART/f'{name}.riv')
    defs=[];circles=[]
    for index, (label, kind, sx, sy, ex, ey, stops, _) in enumerate(reversed(layers)):
        gradient='linearGradient' if kind=='LinearGradient' else 'radialGradient'
        coordinates=f'x1="{sx+116}" y1="{sy+116}" x2="{ex+116}" y2="{ey+116}"' if gradient=='linearGradient' else f'cx="{sx+116}" cy="{sy+116}" r="{ex-sx}"'
        stop_text=''.join(f'<stop offset="{position}" stop-color="#{paint[2:]}" stop-opacity="{int(paint[:2],16)/255}"/>' for paint,position in stops)
        defs.append(f'<{gradient} id="g{index}" gradientUnits="userSpaceOnUse" {coordinates}>{stop_text}</{gradient}>')
        circles.append(f'<circle cx="116" cy="116" r="110" fill="url(#g{index})"/>')
    (ART/f'{name}.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="232" height="232" viewBox="0 0 232 232"><defs>'+''.join(defs)+'</defs>'+''.join(circles)+'</svg>')
    print(name, 'verified')
(ART/'stills.json').write_text(json.dumps({p.stem:p.read_text() for p in sorted(ART.glob('*.svg'))},ensure_ascii=False,indent=2)+'\n')
