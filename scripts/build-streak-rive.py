#!/usr/bin/env python3
"""Compile only the original streak flame and its shared editable geometry.

RIVE_CLI=/path/to/rive python3 scripts/build-streak-rive.py
Uses official Rive CLI 1.5.1. The five drawn layers, resting SVG, vertex
keyframes and TypeScript web interpolation all come from geometry.json.
"""
from pathlib import Path
import json, math, os, shutil, subprocess, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'apps/mobile/assets/rive/source/streak'
GEOMETRY = json.loads((SOURCE / 'geometry.json').read_text())
CLI = os.environ.get('RIVE_CLI') or shutil.which('rive')
if not CLI:
    raise SystemExit('Set RIVE_CLI to the installed official Rive CLI.')


def warp(x, y, amount):
    gain = max(0, min(1, (278 - y) / 236))
    return [
        x + amount * (6 * (.2 + .8 * gain) * (1 + .25 * math.sin(y / 40)) + 3 * gain * math.sin((x - 160) / 35 + y / 90)),
        y + amount * 2.5 * gain * math.cos(x / 26 + y / 55),
    ]


def pose(layer, amount):
    values = [*layer['start'], *[v for c in layer['curves'] for v in c]]
    result = []
    for x, y in zip(values[::2], values[1::2]):
        result.extend(round(v, 5) for v in warp(x, y, amount))
    return result


def vertices(values):
    curves = [values[i:i+6] for i in range(2, len(values), 6)]
    points = [values[:2], *[c[4:6] for c in curves[:-1]]]
    output = []
    for i, (x, y) in enumerate(points):
        in_x, in_y = curves[i-1][2:4]
        out_x, out_y = curves[i][:2]
        output.append(dict(x=x-166, y=y-278,
            inRotation=math.atan2(in_y-y, in_x-x), inDistance=math.hypot(in_x-x, in_y-y),
            outRotation=math.atan2(out_y-y, out_x-x), outDistance=math.hypot(out_x-x, out_y-y)))
    return output


def sub(parent, tag, **attrs):
    return ET.SubElement(parent, tag, {k: str(v) for k, v in attrs.items()})


root = ET.Element('Rive', version='1', kind='fragment')
art = sub(root, 'Artboard', width=320, height=320, styleId='0:5', defaultStateMachineId='0:7', name='streak', id='0:2')
sub(art, 'LayoutComponentStyle', name='Artboard Style', id='0:5')
flame = sub(art, 'Node', x=166, y=278, name='Flame layers', id='0:20')
vertex_groups = []
for li, layer in reversed(list(enumerate(GEOMETRY['layers']))):
    shape = sub(flame, 'Shape', name=layer['name'], opacity=layer.get('opacity', 1), id=f'0:{30+li}')
    path = sub(shape, 'PointsPath', isClosed='true', name='Contour')
    base_vertices = vertices(pose(layer, 0))
    vertex_ids = []
    for vi, values in enumerate(base_vertices):
        identifier = f'0:{100+li*20+vi}'
        sub(path, 'CubicDetachedVertex', id=identifier, **values)
        vertex_ids.append(identifier)
    fill = sub(shape, 'Fill', name='Fill')
    sub(fill, 'SolidColor', colorValue='FF'+layer['color'][1:], name='Color')
    vertex_groups.append((layer, vertex_ids))
shadow = GEOMETRY['shadow']
shape = sub(art, 'Shape', x=shadow['cx'], y=shadow['cy'], opacity=shadow['opacity'], name='Grounding shadow', id='0:21')
sub(shape, 'Ellipse', width=shadow['rx']*2, height=shadow['ry']*2, originX=.5, originY=.5, name='Shadow')
shadow_fill = sub(shape, 'Fill', fillRule='clockwise', name='Shadow')
sub(shadow_fill, 'SolidColor', colorValue='FF'+shadow['color'][1:], name='Color')
sub(shadow_fill, 'Feather', strength=3.5, name='Soft edge')

# A finite ignition enters the quiet contour loop. A second machine begins at
# the loop, so foreground changes never replay the original reward moment.
for name, mid, lid, entry_id, idle_id in [('Celebrate', 7, 8, 12, 13), ('Idle', 70, 71, 73, 73)]:
    machine = sub(art, 'StateMachine', name=name, id=f'0:{mid}')
    layer = sub(machine, 'StateMachineLayer', name='Flame', id=f'0:{lid}')
    sub(layer, 'AnyState', x=200, y=-120)
    sub(layer, 'ExitState', x=650, y=-120)
    sub(sub(layer, 'EntryState', x=0, y=0), 'StateTransition', stateToId=f'0:{entry_id}')
    if name == 'Celebrate':
        ignition = sub(layer, 'AnimationState', x=200, y=0, animationId='0:9', id=f'0:{entry_id}')
        sub(ignition, 'StateTransition', stateToId=f'0:{idle_id}', duration=0, enableExitTime='true', exitTimeIsPercetange='true', exitTime=100)
    sub(layer, 'AnimationState', x=430, y=0, animationId='0:6', id=f'0:{idle_id}')


def keys(animation, identifier, prop, times, values):
    obj = sub(animation, 'KeyedObject', objectId=identifier)
    keyed = sub(obj, 'KeyedProperty', property=prop)
    for time, value in zip(times, values):
        key = sub(keyed, 'KeyFrameDouble', frame=time, value=round(value, 6), interpolationType='cubic')
        sub(key, 'CubicEaseInterpolator', x1=.42, y1=0, x2=.58, y2=1)


def deform_keys(animation, times, amounts):
    for layer, identifiers in vertex_groups:
        poses = [vertices(pose(layer, a)) for a in amounts]
        # atan2 wraps at +/-pi. Unwrap every pose against the authored handle
        # direction so a nearly horizontal handle cannot rotate a full turn.
        base = vertices(pose(layer, 0))
        for values in poses:
            for vi, vertex in enumerate(values):
                for prop in ['inRotation', 'outRotation']:
                    while vertex[prop] - base[vi][prop] > math.pi:
                        vertex[prop] -= 2 * math.pi
                    while vertex[prop] - base[vi][prop] < -math.pi:
                        vertex[prop] += 2 * math.pi
        for vi, identifier in enumerate(identifiers):
            for prop in ['x', 'y', 'inRotation', 'inDistance', 'outRotation', 'outDistance']:
                keys(animation, identifier, prop, times, [v[vi][prop] for v in poses])


idle = sub(art, 'LinearAnimation', loopValue='loop', duration=240, fps=60, name='Idle', id='0:6')
deform_keys(idle, [0, 60, 120, 180, 240], [0, 1, 0, -1, 0])
for li, layer in enumerate(GEOMETRY['layers']):
    if layer['drift']:
        keys(idle, f'0:{30+li}', 'y', [0, 60, 120, 180, 240], [0, layer['drift'], 0, -layer['drift'], 0])
keys(idle, '0:20', 'scaleX', [0, 60, 120, 180, 240], [1, .996, 1, 1.004, 1])
keys(idle, '0:20', 'scaleY', [0, 60, 120, 180, 240], [1, 1.006, 1, .994, 1])
keys(idle, '0:21', 'scaleX', [0, 60, 120, 180, 240], [1, 1.025, 1, .985, 1])
keys(idle, '0:21', 'opacity', [0, 60, 120, 180, 240], [.2, .17, .2, .21, .2])
ignite = sub(art, 'LinearAnimation', loopValue='oneShot', duration=48, fps=60, name='Ignition', id='0:9')
deform_keys(ignite, [0, 20, 34, 48], [-.3, 1.8, -.65, 0])
keys(ignite, '0:20', 'scaleX', [0, 20, 34, 48], [.56, 1.065, .985, 1])
keys(ignite, '0:20', 'scaleY', [0, 20, 34, 48], [.38, 1.05, .98, 1])
keys(ignite, '0:20', 'opacity', [0, 12, 48], [.25, 1, 1])
ET.indent(root, space='    ')
(SOURCE/'scene.rml').write_text(ET.tostring(root, encoding='unicode')+'\n')

# Preserve the art's resting frame exactly for Figma and reduced motion.
def svg_path(values):
    return 'M'+' '.join(map(str, values[:2]))+' '+' '.join('C'+' '.join(map(str, values[i:i+6])) for i in range(2, len(values), 6))+' Z'
svg_parts = [f'<defs><radialGradient id="streak-shadow"><stop offset="0" stop-color="{shadow["color"]}" stop-opacity="0.28"/><stop offset="0.65" stop-color="{shadow["color"]}" stop-opacity="0.18"/><stop offset="1" stop-color="{shadow["color"]}" stop-opacity="0"/></radialGradient></defs><ellipse cx="{shadow["cx"]}" cy="{shadow["cy"]}" rx="{shadow["rx"]}" ry="{shadow["ry"]}" fill="url(#streak-shadow)"/>']
for layer in GEOMETRY['layers']:
    svg_parts.append(f'<path d="{svg_path(pose(layer,0))}" fill="{layer["color"]}" opacity="{layer.get("opacity",1)}"/>')
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">'+''.join(svg_parts)+'</svg>'
(SOURCE/'resting.svg').write_text(svg+'\n')

# Production source colors are named palette tokens, never duplicated hex.
tokens = ['flame', 'orange', 'gold', 'tipHighlight', 'coreHighlight']
lines=['/** Generated from streak/geometry.json by scripts/build-streak-rive.py. */', "import { streakCelebration } from '../palette.ts';", 'export const FLAME_LAYERS = [']
for layer, token in zip(GEOMETRY['layers'], tokens):
    lines.append('  { name: '+json.dumps(layer['name'])+', color: streakCelebration.'+token+', opacity: '+str(layer.get('opacity',1))+', drift: '+str(layer.get('drift',0))+', poses: '+json.dumps([pose(layer,a) for a in [0,1,-1]])+' },')
lines += ['] as const;', 'export const FLAME_SHADOW = { cx: 166, cy: 288, rx: 62, ry: 10, color: streakCelebration.shadow, opacity: 0.2 } as const;', '']
(ROOT/'apps/mobile/src/streak/flameGeometry.ts').write_text('\n'.join(lines))

subprocess.run([CLI, str(SOURCE), '--verify'], check=True)
report=json.loads(subprocess.check_output([CLI, 'inspect', str(SOURCE), '--summary']))
if report['problems']:
    raise SystemExit(f'Streak scene inspect reported problems: {report["problems"]}')
subprocess.run([CLI, str(SOURCE), '--once'], check=True)
shutil.copyfile(SOURCE/'build/streak.riv', ROOT/'apps/mobile/assets/rive/streak.riv')
print('Compiled streak: finite ignition, 4-second deforming idle, resting SVG and shared web geometry.')
