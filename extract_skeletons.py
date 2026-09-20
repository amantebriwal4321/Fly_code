"""Cache the real 3D morphology of the compass circuit.

neuPrint serves a skeleton per neuron: ~1,700 points of xyz + radius, linked into
a tree. That is the neuron's ACTUAL shape. Rendering those instead of dots on a
circle is what makes the ellipsoid body and protocerebral bridge appear on screen
as themselves rather than as a diagram I drew.

Raw, the circuit is ~282k points across 63k paths, and the MEDIAN path is 2 points
long - EM skeletons are covered in tiny spine stubs. So we (1) prune terminal
branches that do not travel at least MIN_TWIG, (2) follow the longest branch at
each fork so runs stay long, and (3) simplify each run with Ramer-Douglas-Peucker.
The arbor's shape survives; only detail no camera would resolve is dropped.

Output: data/skeletons.json
  { bodyId: { "type": str, "paths": [[x,y,z,r, x,y,z,r, ...], ...] } }
Each path is one unbranched run, directly usable as a tube.
"""

import json
import os
import time
from collections import defaultdict

from dotenv import load_dotenv

load_dotenv()
from neuprint import Client, fetch_skeleton

MIN_TWIG = 900.0   # raw units; terminal branches shorter than this are spines, not structure
RDP_EPS = 90.0     # raw units; collinear detail removed along a run
TARGET_SIZE = 110.0  # world units across the circuit's longest axis


def _subtree_height(children, pos, roots):
    """Longest distance from each node down to a leaf. Iterative post-order."""
    h = {}
    for root in roots:
        stack = [(root, False)]
        while stack:
            n, done = stack.pop()
            if done:
                best = 0.0
                for ch in children[n]:
                    d = ((pos[n][0] - pos[ch][0]) ** 2 + (pos[n][1] - pos[ch][1]) ** 2
                         + (pos[n][2] - pos[ch][2]) ** 2) ** 0.5
                    best = max(best, d + h[ch])
                h[n] = best
            else:
                stack.append((n, True))
                for ch in children[n]:
                    stack.append((ch, False))
    return h


def _rdp(pts, eps):
    """Ramer-Douglas-Peucker on a polyline of (x,y,z,r) tuples."""
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ax, ay, az = a[0], a[1], a[2]
    bx, by, bz = b[0], b[1], b[2]
    dx, dy, dz = bx - ax, by - ay, bz - az
    L2 = dx * dx + dy * dy + dz * dz
    worst, wi = -1.0, 0
    for i in range(1, len(pts) - 1):
        px, py, pz = pts[i][0], pts[i][1], pts[i][2]
        if L2 == 0:
            d2 = (px - ax) ** 2 + (py - ay) ** 2 + (pz - az) ** 2
        else:
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / L2))
            qx, qy, qz = ax + t * dx, ay + t * dy, az + t * dz
            d2 = (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2
        if d2 > worst:
            worst, wi = d2, i
    if worst ** 0.5 > eps:
        return _rdp(pts[: wi + 1], eps)[:-1] + _rdp(pts[wi:], eps)
    return [a, b]


def to_paths(df, _stride=None):
    """Prune spine stubs, then split the tree into long unbranched polylines."""
    rows = {int(r.rowId): r for r in df.itertuples()}
    pos = {rid: (r.x, r.y, r.z) for rid, r in rows.items()}
    children = defaultdict(list)
    roots = []
    for rid, r in rows.items():
        link = int(r.link)
        (children[link].append(rid) if link in rows else roots.append(rid))

    height = _subtree_height(children, pos, roots)

    # Keep a child branch only if it actually goes somewhere. This is what
    # removes the 2-point stubs: EM skeletons are covered in them.
    def kept(n):
        return [ch for ch in children[n] if height[ch] >= MIN_TWIG]

    paths = []
    stack = [(r, None) for r in roots]
    while stack:
        start, parent = stack.pop()
        run = ([parent] if parent is not None else []) + [start]
        cur = start
        while True:
            ks = kept(cur)
            if not ks:
                break
            # follow the longest branch so runs stay long, spawn the rest
            ks.sort(key=lambda c: height[c], reverse=True)
            cur = ks[0]
            run.append(cur)
            for other in ks[1:]:
                stack.append((other, run[-2] if len(run) > 1 else cur))
        if len(run) >= 2:
            pts = [(rows[i].x, rows[i].y, rows[i].z, rows[i].radius) for i in run]
            paths.append(_rdp(pts, RDP_EPS))
    return paths, rows


def main():
    token = os.environ.get("NEUPRINT_APPLICATION_CREDENTIALS", "").strip()
    if not token:
        raise SystemExit('Token missing. Put it in .env as NEUPRINT_APPLICATION_CREDENTIALS="eyJ..."')
    c = Client("neuprint.janelia.org", dataset="male-cns:v1.0", token=token)

    nodes = json.load(open("data/compass_plus.json"))["nodes"]  # core + ER + PFL3
    print(f"fetching skeletons for {len(nodes)} neurons...")

    raw = {}
    t0 = time.time()
    failed = []
    for i, n in enumerate(nodes):
        bid = n["bodyId"]
        try:
            df = fetch_skeleton(bid, format="pandas", client=c)
        except Exception as e:
            failed.append((bid, type(e).__name__))
            continue
        paths, rows = to_paths(df)
        raw[bid] = {"type": n["type"], "paths": paths, "rows": rows}
        if (i + 1) % 25 == 0:
            print(f"  {i + 1}/{len(nodes)}  {time.time() - t0:.0f}s")

    if failed:
        print(f"\n{len(failed)} failed: {failed[:5]}")

    # Centre and scale the whole circuit together, so relative anatomy is kept.
    xs, ys, zs = [], [], []
    for d in raw.values():
        for r in d["rows"].values():
            xs.append(r.x)
            ys.append(r.y)
            zs.append(r.z)
    cx, cy, cz = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2
    extent = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
    scale = TARGET_SIZE / extent
    print(f"\ncentre ({cx:.0f}, {cy:.0f}, {cz:.0f})  extent {extent:.0f}  scale {scale:.5f}")

    out = {}
    total_pts = 0
    for bid, d in raw.items():
        paths = []
        for run in d["paths"]:
            flat = []
            for x, y, z, rad in run:
                flat += [
                    round((x - cx) * scale, 2),
                    round((y - cy) * scale, 2),
                    round((z - cz) * scale, 2),
                    round(max(0.25, rad * scale), 3),
                ]
            paths.append(flat)
            total_pts += len(flat) // 4
        out[str(bid)] = {"type": d["type"], "paths": paths}

    with open("data/skeletons.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))

    size = os.path.getsize("data/skeletons.json") / 1e6
    print(f"\n{len(out)} neurons, {total_pts:,} points, {size:.1f} MB")
    print(f"mean {total_pts / max(len(out), 1):.0f} points/neuron")
    print("wrote data/skeletons.json")


if __name__ == "__main__":
    main()
