#!/usr/bin/env python3
"""
============================================================
sculpt-trim2s.py: take two seconds off the end of every clip

    python3 tools/sculpt-trim2s.py            # report only
    python3 tools/sculpt-trim2s.py --apply

Every turntable was captured with iOS screen recording and ends
with the Control Center sliding in while Dane reaches up to stop
the capture. His call, and the right one: two seconds off the end
of everything clears about ninety percent of it, and a turntable
loop does not miss two seconds.

Clever detection was tried first and is kept in sculpt-detrail.py
for reference. It located the panel to within 0.03s, but two
things downstream kept putting the artifact back into the file,
and a blunt instrument that can be verified beats a sharp one
that cannot.

WHAT IT ACTUALLY DOES
  1. cut CUT seconds off every clip, never taking one below
     MIN_KEEP (three clips are shorter than the cut itself)
  2. re-scan the new last second of every clip for iOS control
     blue, which is what the panel's four toggles are
  3. anything still showing it gets another second, up to ROUNDS
     times

Step 3 is the part that matters. A flat cut fixes most of them;
the loop is what turns "most" into "all", and it verifies rather
than predicts. Clips that survive all rounds are listed at the
end to be looked at by hand.

Cutting uses `-c copy`: the cut is at the END and the file starts
on a keyframe, so this is lossless and takes about a second a
clip. `-t` stops on DTS, so B-frame reordering carries a few
frames past the requested time. Irrelevant at this margin, but it
is why the detector's tighter cuts kept failing.
============================================================
"""
import os
import re
import glob
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VID = os.path.join(ROOT, 'assets', 'video', 'sculpture')
MANIFEST = os.path.join(ROOT, 'tools', 'sculpt-manifest.txt')
os.environ['PATH'] = '/usr/local/bin:' + os.environ.get('PATH', '')

CUT = 2.0         # seconds off the end of everything
EXTRA = 1.0       # ...and again, for any clip still showing the panel
ROUNDS = 0        # OFF. The re-scan reads The Thing's glowing blue
                  # ring as the panel and cut three of his clips by
                  # three seconds for nothing. Verified by eye instead;
                  # set this above zero only if you also tighten has_panel.
MIN_KEEP = 1.2    # never leave a clip shorter than this
GRID = 64         # the corner crop is sampled at GRID x GRID
BLUE = 0.003      # this share of it being control blue means the panel


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'default=nw=1:nk=1', path],
                         capture_output=True, text=True).stdout.strip()
    return float(out) if out else 0.0


def has_panel(path):
    """Is iOS control blue (#0A84FF: R=10 G=132 B=255) present in the
    top-right corner over the last second? That is the Control Center's
    toggle cluster. The test is pinned tight to that colour on purpose:
    a loose 'bluish' test also catches Beast, a blue figure on red, and
    Nightcrawler's blue backdrop."""
    dur = duration(path)
    n = GRID * GRID * 3
    raw = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-ss', f'{max(0, dur - 1.0)}', '-i', path,
         '-vf', f'fps=8,crop=iw*0.45:ih*0.55:iw*0.55:0,scale={GRID}:{GRID}',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    for i in range(len(raw) // n):
        f = raw[i * n:(i + 1) * n]
        hits = sum(1 for j in range(0, n, 3)
                   if f[j + 2] > 200 and f[j] < 90
                   and 70 < f[j + 1] < 190 and f[j + 2] - f[j + 1] > 70)
        if hits / (GRID * GRID) >= BLUE:
            return True
    return False


def cut_to(path, keep):
    dst = path + '.trim.mp4'
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', path,
                    '-t', f'{keep:.2f}', '-c', 'copy', '-movflags', '+faststart', dst],
                   capture_output=True)
    if os.path.exists(dst) and os.path.getsize(dst) > 1000:
        os.replace(dst, path)
        return True
    if os.path.exists(dst):
        os.remove(dst)
    return False


def main():
    apply = '--apply' in sys.argv
    clips = sorted(glob.glob(os.path.join(VID, '*', '*.mp4')))

    plan, skipped = [], []
    for p in clips:
        d = duration(p)
        keep = round(d - CUT, 2)
        if keep < MIN_KEEP:
            skipped.append((os.path.relpath(p, VID), d))
        else:
            plan.append((p, d, keep))

    print(f'{len(plan)} clips to cut {CUT}s from, {len(skipped)} too short to touch')
    for name, d in skipped:
        print(f'  left alone: {name}  {d:.2f}s')
    if not apply:
        print('\nreport only. re-run with --apply.')
        return

    for p, d, keep in plan:
        cut_to(p, keep)
    print(f'cut {CUT}s from {len(plan)} clips')

    # --- verify, and keep cutting anything that still shows the panel ---
    stubborn = [p for p, *_ in plan]
    for rnd in range(1, ROUNDS + 1):
        stubborn = [p for p in stubborn if has_panel(p)]
        print(f'  round {rnd}: {len(stubborn)} still showing the panel')
        if not stubborn:
            break
        again = []
        for p in stubborn:
            keep = round(duration(p) - EXTRA, 2)
            if keep >= MIN_KEEP and cut_to(p, keep):
                again.append(p)
        stubborn = again
    if stubborn:
        print('\nSTILL SHOWING THE PANEL, fix these by hand:')
        for p in stubborn:
            print(f'  {os.path.relpath(p, VID)}  {duration(p):.2f}s')

    # --- manifest and dossier captions follow the new durations ---
    new = {}
    for p in clips:
        slug = os.path.basename(os.path.dirname(p))
        nn = os.path.basename(p)[-6:-4]
        new[(slug, nn)] = duration(p)

    lines = []
    for line in open(MANIFEST):
        f = line.strip().split('|')
        if len(f) == 5 and (f[0], f[1]) in new:
            f[4] = f'{new[(f[0], f[1])]:.1f}'
            line = '|'.join(f) + '\n'
        lines.append(line)
    open(MANIFEST, 'w').writelines(lines)

    for page in glob.glob(os.path.join(ROOT, 'sculpture', '*.html')):
        slug = os.path.basename(page)[:-5]
        s = open(page).read()

        def fix(m):
            code, nn = m.group(1), m.group(2)
            d = new.get((slug, nn))
            return m.group(0) if d is None else \
                f'<span class="n">{code}-{nn}</span><span>{d:.0f}s</span>'

        s2 = re.sub(r'<span class="n">([A-Z]{2})-(\d\d)</span><span>\d+s</span>', fix, s)
        if s2 != s:
            open(page, 'w').write(s2)
    print('manifest and dossier captions updated')


if __name__ == '__main__':
    main()
