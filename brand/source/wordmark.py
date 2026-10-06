"""Custom lowercase 'luvani' wordmark, built from one stroke weight and one radius."""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from geom import *

BIG = 10000

def letters(X=100.0, S=24.0, A=146.0, o=2.5, ends="flat", vjoin="miter", ucounter=None, vwidth=None,
            dot_scale=1.12, dot_gap=0.46, vflat=0.55, v_angle=75.0, v_foot=None):
    """Return dict of glyph -> (outline, ink_width). Baseline y=0, x-height y=-X (y down)."""
    cap = "butt" if ends == "flat" else "round"
    v_foot = v_foot if v_foot is not None else S * 0.62
    inset = 0.0 if ends == "flat" else S / 2.0
    g = {}
    # l
    s = new(); s.moveTo(S / 2, -A + inset); s.lineTo(S / 2, -inset)
    g["l"] = (stroke(s, S, cap, "round"), S)
    # u: two stems + bowl, no spur; n is its 180-degree rotation
    cu = ucounter if ucounter is not None else X * 0.50
    r = (cu + S) / 2.0
    yc = -(r + S / 2.0) + o
    s = new(); s.moveTo(S / 2, -X + inset); s.lineTo(S / 2, yc)
    arc(s, S / 2 + r, yc, r, 180, 0)          # y-down: 180 -> 90 (bottom) -> 0, decreasing? use explicit
    s.lineTo(S / 2 + 2 * r, -X + inset)
    uw = 2 * r + S
    u = stroke(s, S, cap, "round")
    g["u"] = (u, uw)
    # n = u rotated 180 about the centre of its box (0..uw, -X..0)
    n = rotate(u, 180, uw / 2.0, -X / 2.0)
    g["n"] = (n, uw)
    # v: two arms at an exact angle from horizontal, flat foot on the baseline, flat tops at x-height
    th = math.radians(v_angle)
    # outer edges: from (0,-X) down to the foot; arm horizontal thickness = S/sin(th)
    run = X / math.tan(th)
    tS = S / math.sin(th)
    foot = v_foot
    vw = 2 * run + foot
    pts = [(0, -X), (tS, -X), (vw / 2, -X + (tS / 2) * math.tan(th) + 0.0), (vw - tS, -X), (vw, -X),
           (vw - run, 0), (run, 0)]
    # inner apex: where the two inner edges meet
    # inner left edge goes from (tS,-X) with the same slope as the outer left edge
    yi = -X + ((vw / 2) - tS) * math.tan(th)
    pts[2] = (vw / 2, yi)
    vv = simplify(polyline(pts, closed=True))
    g["v"] = (vv, vw)
    # a: ring bowl + stem on the bowl's right centre-line
    R = X / 2.0 + o
    cxa = R
    bowl = ring(cxa, -X / 2.0, R, R - S)
    sx = cxa + R - S / 2.0
    s = new(); s.moveTo(sx, -X + inset - (0 if ends == 'flat' else 0)); s.lineTo(sx, -inset)
    stem = stroke(s, S, cap, "round")
    g["a"] = (union(bowl, stem), 2 * R)
    # i: stem + dot whose top aligns with the l's top
    rd = S * dot_scale / 2.0
    s = new(); s.moveTo(S / 2, -X + inset); s.lineTo(S / 2, -inset)
    dot = circle(S / 2, -A + rd, rd)
    g["i"] = (union(stroke(s, S, cap, "round"), dot), S)
    g["_meta"] = dict(X=X, S=S, A=A, o=o, R=R, sx=sx, uw=uw)
    return g


SIDE = {  # left, right sidebearings in units of S
    "l": (0.55, 0.50), "u": (0.50, 0.50), "v": (0.10, 0.10), "a": (0.32, 0.50), "n": (0.50, 0.50), "i": (0.50, 0.55),
}
KERN = {("u", "v"): -0.06, ("v", "a"): -0.10}


def setword(g, word="luvani", track=0.0, side=SIDE, kern=KERN, lig_an=False):
    S = g["_meta"]["S"]
    x = 0.0
    parts = []
    prev = None
    i = 0
    while i < len(word):
        ch = word[i]
        lft, rgt = side[ch]
        if prev is not None:
            x += kern.get((prev, ch), 0.0) * S
        if lig_an and word[i:i + 2] == "an":
            # a's stem is the n's left stem
            a, aw = g["a"]; n, nw = g["n"]
            x += lft * S
            parts.append(translate(a, x, 0))
            meta = g["_meta"]
            nx = x + meta["sx"] - S / 2.0
            parts.append(translate(n, nx, 0))
            x = nx + nw + side["n"][1] * S + track
            prev = "n"; i += 2
            continue
        shape, w = g[ch]
        x += lft * S
        parts.append(translate(shape, x, 0))
        x += w + rgt * S + track
        prev = ch
        i += 1
    word_path = union(*parts)
    return word_path


def save_word(path, name, title, out, pad=8, fill="#111111"):
    x0, y0, x1, y1 = bounds(path)
    w, h = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    p = translate(path, -x0 + pad, -y0 + pad)
    open(f"{out}/{name}.svg", "w").write(svg_doc([(to_d(p), fill)], (0, 0, round(w, 2), round(h, 2)), title))
    return w, h


if __name__ == "__main__":
    OUT = sys.argv[1]
    variants = {
        "w1": dict(ends="flat", vjoin="miter"),
        "w2": dict(ends="round", vjoin="round"),
        "w3": dict(ends="flat", vjoin="miter"),
        "w4": dict(ends="round", vjoin="round", dot_scale=1.3),
    }
    for name, kw in variants.items():
        g = letters(**kw)
        wp = setword(g, lig_an=(name == "w3"))
        print(name, save_word(wp, name, f"luvani wordmark {name}", OUT))
