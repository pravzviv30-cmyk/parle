"""Playful wordmark: chunkier, round-ended 'luvani' with an optional gentle bounce."""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from geom import *
from wordmark import letters

SIDE = {"l": (0.40, 0.36), "u": (0.36, 0.36), "v": (0.06, 0.06), "a": (0.24, 0.36), "n": (0.36, 0.36), "i": (0.36, 0.40)}
KERN = {("u", "v"): -0.04, ("v", "a"): -0.06}
BOUNCE = {"l": (0, -3), "u": (3, 2.5), "v": (-2, -2), "a": (-3, 3), "n": (2.5, -2), "i": (-3, 2.5)}   # (rotate deg, dy)

def round_v(S, X, vw):
    """v with round terminals and a round vertex: a stroked skeleton, outer extents 0..vw, -X..0."""
    sk = new()
    sk.moveTo(S / 2, -X + S / 2); sk.lineTo(vw / 2, -S / 2); sk.lineTo(vw - S / 2, -X + S / 2)
    return stroke(sk, S, "round", "round")


def build(S=32.0, bounce=False, word="luvani", colours=None, vw=98.0, idot=None):
    g = letters(S=S, ends="round", vjoin="round", ucounter=38, vwidth=100)
    X = g["_meta"]["X"]
    g["v"] = (round_v(S, X, vw), vw)
    if idot is not None:
        # replace the i's dot with a custom shape builder(cx, cy, r) -> path
        A = g["_meta"]["A"]; rd = S * 1.12 / 2.0
        s_ = new(); s_.moveTo(S / 2, -X + S / 2); s_.lineTo(S / 2, -S / 2)
        stem = stroke(s_, S, "round", "round")
        g["i"] = (stem, S)
        g["_idot"] = idot(S / 2, -A + rd, rd)
    x = 0.0; prev = None; parts = []
    for ch in word:
        lft, rgt = SIDE[ch]
        if prev: x += KERN.get((prev, ch), 0) * S
        shape, w = g[ch]
        x += lft * S
        p = translate(shape, x, 0)
        if bounce:
            rot, dy = BOUNCE[ch]
            cx = x + w / 2; cy = -X / 2
            p = translate(rotate(p, rot, cx, cy), 0, dy)
        parts.append((ch, p))
        if ch == "i" and "_idot" in g:
            parts.append(("idot", translate(g["_idot"], x, 0) if not bounce else translate(rotate(translate(g["_idot"], x, 0), BOUNCE["i"][0], x + w / 2, -X / 2), 0, BOUNCE["i"][1])))
        x += w + rgt * S
        prev = ch
    return parts, g["_meta"]

def save(parts, name, out, colour="#16123A", colours=None, pad=10, title="luvani wordmark"):
    allp = union(*[p for _, p in parts])
    x0, y0, x1, y1 = bounds(allp)
    layers = []
    for i, (ch, p) in enumerate(parts):
        c = colours[i % len(colours)] if colours else colour
        layers.append((translate(p, -x0 + pad, -y0 + pad), c))
    if not colours:
        layers = [(translate(allp, -x0 + pad, -y0 + pad), colour)]
    w, h = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    open(f"{out}/{name}.svg", "w").write(svg_doc([(to_d(p), c) for p, c in layers], (0, 0, round(w, 2), round(h, 2)), title))
    return w, h

if __name__ == "__main__":
    OUT = sys.argv[1]
    p, m = build(32, False); print("steady", save(p, "wm-steady", OUT))
    p, m = build(32, True); print("bouncy", save(p, "wm-bouncy", OUT))
    p, m = build(32, True); print("bouncy-colour", save(p, "wm-bouncy-colour", OUT, colours=["#D63A22", "#3B2FE0", "#FFC93C", "#2FD18B", "#D63A22", "#3B2FE0"]))
    p, m = build(34, False); print("steady34", save(p, "wm-steady34", OUT))
