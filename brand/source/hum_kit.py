"""Hum: the Luvani mark. One generator for every master, raster and the app's geometry module.

The mark is the tutor's orb, humming: a solid core inside a ring that ripples like a voice.
Run with the scratch env (fontTools-free; needs skia-pathops):  python hum_kit.py <out_dir>
"""
import sys, os, math, json
sys.path.insert(0, os.path.dirname(__file__))
from geom import *
import wordmark2

BLUE, CORAL, SUN, INK, PAPER, WHITE = "#3B2FE0", "#D63A22", "#FFC93C", "#16123A", "#FFF6E9", "#FFFFFF"

# ---- geometry (256 grid). A lobe points straight up, so the still mark is mirror-symmetric.
C = 128.0
CORE_R = 60.0
RING = dict(R=90.0, amp=8.0, n=7, width=20.0)
SMALL_CORE_R = 56.0
SMALL_RING = dict(R=92.0, amp=9.0, n=7, width=24.0)

def ring_path(spec):
    return wavy_ring(C, C, spec["R"], spec["amp"], spec["n"], spec["width"], 4, 0.0)

def mark(small=False):
    ring = ring_path(SMALL_RING if small else RING)
    core = circle(C, C, SMALL_CORE_R if small else CORE_R)
    return ring, core

def wordmark():
    parts, meta = wordmark2.build(32, False)
    word = union(*[p for _, p in parts])
    return word

def svg(path, layers, vb, title, bg=None, bg_shape=None):
    pre = []
    if bg_shape is not None:
        pre = [(to_d(bg_shape), bg)]
    elif bg:
        pre = [(to_d(rect(vb[0], vb[1], vb[0] + vb[2], vb[1] + vb[3])), bg)]
    open(path, "w").write(svg_doc(pre + [(to_d(p), c) for p, c in layers], vb, title))

def fit(paths, frac, size=256.0):
    """Scale paths about the centre so the union spans `frac` of the canvas."""
    allp = union(*paths)
    x0, y0, x1, y1 = bounds(allp)
    s = frac * size / max(x1 - x0, y1 - y0)
    out = [scale(p, s) for p in paths]
    x0, y0, x1, y1 = bounds(union(*out))
    return [translate(p, size / 2 - (x0 + x1) / 2, size / 2 - (y0 + y1) / 2) for p in out]

def lockup(ring, core, word, colours, layout="horizontal", pad=0.0):
    """Mark + wordmark, centred on each other; returns (layers, viewBox)."""
    rc, cc, wc = colours
    x0, y0, x1, y1 = bounds(word)
    wh = y1 - y0
    if layout == "horizontal":
        k = (wh * 1.18) / 216.0                   # mark spans 1.18x the wordmark's full height
        r2, c2 = scale(ring, k), scale(core, k)
        mx0, my0, mx1, my1 = bounds(union(r2, c2))
        gap = 0.30 * wh
        dx = -mx0; mid_word = (y0 + y1) / 2
        r2 = translate(r2, dx, mid_word - (my0 + my1) / 2); c2 = translate(c2, dx, mid_word - (my0 + my1) / 2)
        w2 = translate(word, (mx1 - mx0) + gap - x0, 0)
    else:  # stacked: mark above, wordmark below, both centred
        k = (wh * 1.9) / 216.0
        r2, c2 = scale(ring, k), scale(core, k)
        mx0, my0, mx1, my1 = bounds(union(r2, c2))
        gap = 0.42 * wh
        ww = x1 - x0
        r2 = translate(r2, -(mx0 + mx1) / 2, -my1 - gap); c2 = translate(c2, -(mx0 + mx1) / 2, -my1 - gap)
        w2 = translate(word, -(x0 + x1) / 2, -y0)
    layers = [(r2, rc), (c2, cc), (w2, wc)]
    ax0, ay0, ax1, ay1 = bounds(union(*[p for p, _ in layers]))
    layers = [(translate(p, -ax0 + pad, -ay0 + pad), c) for p, c in layers]
    vb = (0, 0, round(ax1 - ax0 + 2 * pad, 2), round(ay1 - ay0 + 2 * pad, 2))
    return layers, vb

if __name__ == "__main__":
    OUT = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    ring, core = mark()
    sring, score = mark(small=True)
    word = wordmark()
    # ---- symbol masters (256, mark spans 224 = 16 units of padding)
    r1, c1 = fit([ring, core], 224 / 256)
    svg(f"{OUT}/hum-symbol.svg", [(r1, SUN), (c1, CORAL)], (0, 0, 256, 256), "Luvani mark")
    svg(f"{OUT}/hum-symbol-light.svg", [(r1, CORAL), (c1, BLUE)], (0, 0, 256, 256), "Luvani mark, for light backgrounds")
    svg(f"{OUT}/hum-symbol-ink.svg", [(union(r1, c1), INK)], (0, 0, 256, 256), "Luvani mark, one colour ink")
    svg(f"{OUT}/hum-symbol-white.svg", [(union(r1, c1), WHITE)], (0, 0, 256, 256), "Luvani mark, one colour white")
    sr, sc = fit([sring, score], 224 / 256)
    svg(f"{OUT}/hum-symbol-small.svg", [(sr, SUN), (sc, CORAL)], (0, 0, 256, 256), "Luvani mark, small-size cut")
    # ---- app icon (full-bleed square; the OS applies its own mask) and a rounded preview tile
    r2, c2 = fit([ring, core], 0.70)
    svg(f"{OUT}/hum-app-icon.svg", [(r2, SUN), (c2, CORAL)], (0, 0, 256, 256), "Luvani app icon", bg=BLUE)
    svg(f"{OUT}/hum-app-icon-tile.svg", [(r2, SUN), (c2, CORAL)], (0, 0, 256, 256), "Luvani app icon tile", bg=BLUE, bg_shape=smooth_square(0, 0, 256))
    svg(f"{OUT}/hum-app-icon-dark.svg", [(r2, SUN), (c2, CORAL)], (0, 0, 256, 256), "Luvani app icon, dark")
    svg(f"{OUT}/hum-app-icon-tinted.svg", [(r2, "#FFFFFF"), (c2, "#B8B8B8")], (0, 0, 256, 256), "Luvani app icon, tinted", bg="#000000")
    # favicon tile from the small-size cut
    r3, c3 = fit([sring, score], 0.74)
    svg(f"{OUT}/hum-favicon.svg", [(r3, SUN), (c3, CORAL)], (0, 0, 256, 256), "Luvani", bg=BLUE, bg_shape=smooth_square(0, 0, 256, r_frac=0.22))
    # ---- Android adaptive layers: logo inside the 66dp safe circle (reach <= 33/108 of the width)
    r4, c4 = fit([ring, core], 0.548)   # sized by the lobe tips: reach 0.29 of the width, inside 33/108
    svg(f"{OUT}/hum-adaptive-foreground.svg", [(r4, SUN), (c4, CORAL)], (0, 0, 256, 256), "Luvani adaptive icon foreground")
    svg(f"{OUT}/hum-adaptive-monochrome.svg", [(union(r4, c4), WHITE)], (0, 0, 256, 256), "Luvani adaptive icon monochrome")
    # ---- splash image: the same 256 canvas as the launch screen's Svg, so the hand-off is exact
    svg(f"{OUT}/hum-splash.svg", [(r1, SUN), (c1, CORAL)], (0, 0, 256, 256), "Luvani launch mark")
    # ---- wordmark
    wx0, wy0, wx1, wy1 = bounds(word)
    w0 = translate(word, -wx0, -wy0)
    wvb = (0, 0, round(wx1 - wx0, 2), round(wy1 - wy0, 2))
    svg(f"{OUT}/hum-wordmark-ink.svg", [(w0, INK)], wvb, "luvani wordmark")
    svg(f"{OUT}/hum-wordmark-white.svg", [(w0, WHITE)], wvb, "luvani wordmark, white")
    # ---- lockups
    for lay in ("horizontal", "stacked"):
        L, vb = lockup(ring, core, word, (SUN, CORAL, WHITE), lay, pad=0)
        svg(f"{OUT}/hum-logo-{lay}-on-blue.svg", L, vb, f"Luvani logo, {lay}, on blue")
        L, vb = lockup(ring, core, word, (CORAL, BLUE, INK), lay, pad=0)
        svg(f"{OUT}/hum-logo-{lay}-light.svg", L, vb, f"Luvani logo, {lay}, for light backgrounds")
        L, vb = lockup(ring, core, word, (INK, INK, INK), lay, pad=0)
        svg(f"{OUT}/hum-logo-{lay}-ink.svg", L, vb, f"Luvani logo, {lay}, one colour ink")
        L, vb = lockup(ring, core, word, (WHITE, WHITE, WHITE), lay, pad=0)
        svg(f"{OUT}/hum-logo-{lay}-white.svg", L, vb, f"Luvani logo, {lay}, one colour white")
    # ---- geometry for the app (launch screen): ring and core on the 256 canvas, wordmark on its own box
    geo = {
        "viewBox": 256,
        "ring": to_d(r1),
        "core": {"cx": 128, "cy": 128, "r": round(bounds(c1)[2] - 128, 3)},
        "wordmark": {"d": to_d(w0), "width": wvb[2], "height": wvb[3]},
    }
    json.dump(geo, open(f"{OUT}/hum-geometry.json", "w"))
    print("ok", OUT, "core r", geo["core"]["r"], "ring segments", geo["ring"].count("C") + geo["ring"].count("Q"))
