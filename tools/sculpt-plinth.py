#!/usr/bin/env python3
"""
============================================================
sculpt-plinth.py: sample each clip's own backdrop colour

    python3 tools/sculpt-plinth.py > tools/sculpt-plinths.txt

Writes "<slug>-<nn> #top #bottom" per clip.

Why this exists: the first pass assumed every sculpture was
photographed on black, so tiles letterboxed onto black. They are
not. The backdrops run black, hot pink, peach, tan, teal, and
yellow-green, and a pink clip letterboxed onto black shows two
black bars.

So each tile gets its own plinth colour, sampled from the top and
bottom edges of the clip's own poster and laid down as a vertical
gradient. Most of these backdrops ARE vertical gradients, so two
samples beat one and the letterbox disappears into the clip.
============================================================
"""
import os
import glob
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'assets', 'img', 'sculpture')
os.environ['PATH'] = '/usr/local/bin:' + os.environ.get('PATH', '')


def patch(path, x, y):
    """Average colour of a small patch at a fractional position."""
    out = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-i', path,
         '-vf', f'crop=iw*0.14:ih*0.07:iw*{x}:ih*{y},scale=1:1', '-frames:v', '1',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        capture_output=True).stdout
    return (out[0], out[1], out[2]) if len(out) >= 3 else (0, 0, 0)


def edge(path, top):
    """Backdrop colour along the top or bottom edge, read from the two
    CORNERS rather than the full strip. A centred sculpture pushes its
    base into the middle of the bottom strip, and averaging that in
    tints the plinth with the object instead of the backdrop."""
    y = 0.005 if top else 0.925
    a = patch(path, 0.02, y)
    b = patch(path, 0.84, y)
    return '#%02x%02x%02x' % tuple((a[i] + b[i]) // 2 for i in range(3))


for p in sorted(glob.glob(os.path.join(IMG, '*', '*.jpg'))):
    name = os.path.basename(p)[:-4]
    print(name, edge(p, True), edge(p, False))
