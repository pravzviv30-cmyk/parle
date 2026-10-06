"""Small geometry kit for building logo outlines with exact arcs, strokes and boolean unions.

Everything is built in a y-down coordinate system (SVG). Skeleton paths are stroked into
outlines with skia-pathops, then united, so the masters are clean filled paths with no
overlaps, no strokes and no live text.
"""
import math
import pathops

CAP = {"butt": pathops.LineCap.BUTT_CAP, "round": pathops.LineCap.ROUND_CAP, "square": pathops.LineCap.SQUARE_CAP}
JOIN = {"miter": pathops.LineJoin.MITER_JOIN, "round": pathops.LineJoin.ROUND_JOIN, "bevel": pathops.LineJoin.BEVEL_JOIN}


def new():
    return pathops.Path()


def arc(path, cx, cy, r, a0, a1, move=False):
    """Append a circular arc (degrees, y-down: 0=+x, 90=+y/down) as cubic segments of <= 90 degrees."""
    n = max(1, int(math.ceil(abs(a1 - a0) / 90.0 - 1e-9)))
    da = (a1 - a0) / n
    for i in range(n):
        t0 = math.radians(a0 + i * da)
        t1 = math.radians(a0 + (i + 1) * da)
        h = 4.0 / 3.0 * math.tan((t1 - t0) / 4.0) * r
        x0, y0 = cx + r * math.cos(t0), cy + r * math.sin(t0)
        x1, y1 = cx + r * math.cos(t1), cy + r * math.sin(t1)
        if i == 0 and move:
            path.moveTo(x0, y0)
        path.cubicTo(x0 - h * math.sin(t0), y0 + h * math.cos(t0),
                     x1 + h * math.sin(t1), y1 - h * math.cos(t1), x1, y1)
    return path


def pt_on(cx, cy, r, a):
    t = math.radians(a)
    return cx + r * math.cos(t), cy + r * math.sin(t)


def circle(cx, cy, r):
    p = new()
    arc(p, cx, cy, r, 0, 360, move=True)
    p.close()
    return p


def rect(x0, y0, x1, y1):
    p = new()
    p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.close()
    return p


def polyline(points, closed=False):
    p = new()
    p.moveTo(*points[0])
    for q in points[1:]:
        p.lineTo(*q)
    if closed:
        p.close()
    return p


def stroke(skel, width, cap="round", join="round", miter=10.0):
    """Return the filled outline of a stroked skeleton path."""
    out = pathops.Path()
    out.addPath(skel)
    out.stroke(width, CAP[cap], JOIN[join], miter)
    out.convertConicsToQuads()
    return simplify(out)


def simplify(p):
    q = pathops.Path()
    q.addPath(p)
    q.convertConicsToQuads()
    q.simplify(fix_winding=True)
    return q


def _q(p):
    q = pathops.Path()
    q.addPath(p)
    q.convertConicsToQuads()
    return q


def union(*paths):
    acc = pathops.Path()
    for p in paths:
        if p is None:
            continue
        acc = pathops.op(_q(acc), _q(p), pathops.PathOp.UNION)
    return acc


def diff(a, b):
    return pathops.op(_q(a), _q(b), pathops.PathOp.DIFFERENCE)


def inter(a, b):
    return pathops.op(_q(a), _q(b), pathops.PathOp.INTERSECTION)


def transform(p, a=1, b=0, c=0, d=1, e=0, f=0):
    q = pathops.Path()
    q.addPath(p)
    return q.transform(a, b, c, d, e, f)


def translate(p, dx, dy):
    return transform(p, 1, 0, 0, 1, dx, dy)


def scale(p, s, cx=0.0, cy=0.0):
    return transform(p, s, 0, 0, s, cx - s * cx, cy - s * cy)


def rotate(p, deg, cx=0.0, cy=0.0):
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    return transform(p, c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy)


def bounds(p):
    return p.bounds  # (xMin, yMin, xMax, yMax)


def to_d(p, nd=2):
    """SVG path data (absolute), conics converted to quadratics."""
    q = pathops.Path()
    q.addPath(p)
    q.convertConicsToQuads()
    fmt = lambda v: (f"{v:.{nd}f}").rstrip("0").rstrip(".") if "." in f"{v:.{nd}f}" else f"{v:.{nd}f}"
    out = []
    for verb, pts in q.segments:
        if verb == "moveTo":
            out.append("M" + " ".join(f"{fmt(x)} {fmt(y)}" for x, y in pts))
        elif verb == "lineTo":
            out.append("L" + " ".join(f"{fmt(x)} {fmt(y)}" for x, y in pts))
        elif verb == "qCurveTo":
            # pen-style qCurveTo may carry several off-curve points; expand to Q segments
            pts = list(pts)
            if len(pts) == 2:
                out.append("Q" + " ".join(f"{fmt(x)} {fmt(y)}" for x, y in pts))
            else:
                offs, on = pts[:-1], pts[-1]
                for i in range(len(offs) - 1):
                    mx = (offs[i][0] + offs[i + 1][0]) / 2
                    my = (offs[i][1] + offs[i + 1][1]) / 2
                    out.append(f"Q{fmt(offs[i][0])} {fmt(offs[i][1])} {fmt(mx)} {fmt(my)}")
                out.append(f"Q{fmt(offs[-1][0])} {fmt(offs[-1][1])} {fmt(on[0])} {fmt(on[1])}")
        elif verb == "curveTo":
            out.append("C" + " ".join(f"{fmt(x)} {fmt(y)}" for x, y in pts))
        elif verb == "closePath":
            out.append("Z")
        elif verb == "endPath":
            pass
        else:
            raise ValueError(verb)
    return "".join(out)


def svg_doc(layers, vb, title="", bg=None, size=None):
    """layers: list of (d, fill). vb: (x, y, w, h)."""
    x, y, w, h = vb
    W = size[0] if size else w
    H = size[1] if size else h
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:g} {y:g} {w:g} {h:g}" width="{W:g}" height="{H:g}" role="img" aria-labelledby="title">',
             f'<title id="title">{title}</title>']
    if bg:
        parts.append(f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" fill="{bg}"/>')
    for d, fill in layers:
        parts.append(f'<path fill="{fill}" d="{d}"/>')
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def ring(cx, cy, r_out, r_in):
    return diff(circle(cx, cy, r_out), circle(cx, cy, r_in))


def tapered_bar(x1, y1, r1, x2, y2, r2):
    """Convex hull of two discs: a bar with round ends that tapers from r1 to r2."""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    th = math.degrees(math.atan2(dy, dx))
    ph = math.degrees(math.acos((r1 - r2) / L))
    p = new()
    a_hi, a_lo = th + ph, th - ph
    p.moveTo(*pt_on(x1, y1, r1, a_hi))
    p.lineTo(*pt_on(x2, y2, r2, a_hi))
    arc(p, x2, y2, r2, a_hi, a_lo)            # around the far end of disc 2 (through th)
    p.lineTo(*pt_on(x1, y1, r1, a_lo))
    arc(p, x1, y1, r1, a_lo, a_hi - 360)      # around the far end of disc 1 (through th+180)
    p.close()
    return simplify(p)


def flat_tapered_bar(x1, y1, w1, x2, y2, w2):
    """Quadrilateral bar with flat ends perpendicular to its axis, width w1 -> w2."""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    nx, ny = -dy / L, dx / L
    pts = [(x1 + nx * w1 / 2, y1 + ny * w1 / 2), (x2 + nx * w2 / 2, y2 + ny * w2 / 2),
           (x2 - nx * w2 / 2, y2 - ny * w2 / 2), (x1 - nx * w1 / 2, y1 - ny * w1 / 2)]
    return simplify(polyline(pts, closed=True))


def squircle(x0, y0, size, n=5.0, steps=360):
    """iOS-like continuous-curvature tile approximated by a superellipse (preview use)."""
    a = size / 2.0
    cx, cy = x0 + a, y0 + a
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        ct, st = math.cos(t), math.sin(t)
        x = cx + a * math.copysign(abs(ct) ** (2.0 / n), ct)
        y = cy + a * math.copysign(abs(st) ** (2.0 / n), st)
        pts.append((x, y))
    return simplify(polyline(pts, closed=True))


def smooth_square(x0, y0, size, r_frac=0.2237, smooth=0.6):
    """Rounded square with smoothed (long-handle) cubic corners, few anchors (iOS-like tile)."""
    r = r_frac * size
    d = min(r * (1 + smooth), size / 2)
    h = d * 0.72
    x1, y1 = x0 + size, y0 + size
    p = new()
    p.moveTo(x0 + d, y0)
    p.lineTo(x1 - d, y0)
    p.cubicTo(x1 - d + h, y0, x1, y0 + d - h, x1, y0 + d)
    p.lineTo(x1, y1 - d)
    p.cubicTo(x1, y1 - d + h, x1 - d + h, y1, x1 - d, y1)
    p.lineTo(x0 + d, y1)
    p.cubicTo(x0 + d - h, y1, x0, y1 - d + h, x0, y1 - d)
    p.lineTo(x0, y0 + d)
    p.cubicTo(x0, y0 + d - h, x0 + d - h, y0, x0 + d, y0)
    p.close()
    return p


def catmull_closed(points, close=True):
    """Smooth closed (or open) path through points using Catmull-Rom -> cubic Bezier segments."""
    n = len(points)
    p = new()
    p.moveTo(*points[0])
    rng = range(n) if close else range(n - 1)
    for i in rng:
        p0 = points[(i - 1) % n] if (close or i > 0) else points[0]
        p1 = points[i]
        p2 = points[(i + 1) % n]
        p3 = points[(i + 2) % n] if (close or i + 2 < n) else points[-1]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6.0, p1[1] + (p2[1] - p0[1]) / 6.0)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6.0, p2[1] - (p3[1] - p1[1]) / 6.0)
        p.cubicTo(*c1, *c2, *p2)
    if close:
        p.close()
    return p


def wavy_ring(cx, cy, R, amp, n, width, samples_per_wave=4, phase=0.0):
    """Ring whose centre-line radius ripples: r = R + amp*sin(n*theta + phase)."""
    pts = []
    total = n * samples_per_wave
    for k in range(total):
        t = 2 * math.pi * k / total
        r = R + amp * math.sin(n * t + phase)
        pts.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    skel = catmull_closed(pts, close=True)
    return stroke(skel, width, "round", "round")


def wavy_disc(cx, cy, R, amp, n, samples_per_wave=4, phase=0.0):
    pts = []
    total = n * samples_per_wave
    for k in range(total):
        t = 2 * math.pi * k / total
        r = R + amp * math.sin(n * t + phase)
        pts.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    return simplify(catmull_closed(pts, close=True))
