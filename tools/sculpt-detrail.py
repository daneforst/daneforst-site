#!/usr/bin/env python3
"""
============================================================
sculpt-detrail.py: cut the screen-recording tail off each clip

    python3 tools/sculpt-detrail.py            # report only
    python3 tools/sculpt-detrail.py --apply    # rewrite the clips

Every turntable was captured with iOS screen recording, so most
end with the Control Center sliding in over a blurred, dimmed
frame while Dane reaches up to stop the capture. Half a second
to a second and a half of rubbish, on 165 clips.

HOW IT FINDS THE CUT
Four signals were tried. Three fail on their own:

  brightness  useless. The backdrops run black, hot pink, peach,
              tan, teal and yellow-green, so the overlay is not
              reliably lighter than what it covers.
  scene cut   useless. These recordings spike every third of a
              second by themselves; the overlay does not stand
              out against that.
  blur        close, but over-eager. iOS heavily blurs everything
              under the panel and edge density collapses, but it
              also collapses when a piece turns edge-on or into
              shadow. Alone it ate 6.7s of good footage off
              gambit-10.
  panel blue  works, but only if the test is narrow. The four
              toggles are iOS control blue, #0A84FF: R=10, G=132,
              B=255. A loose "bluish" test also catches Beast, a
              blue figure on red, and Nightcrawler's blue backdrop,
              which fills 17% of that corner and would have cost
              two seconds off every one of his clips. Pinned to
              the actual colour, both drop to zero and the panel
              still reads at about 1%.

So it takes BOTH: a frame counts as overlaid only if that blue is
present AND the picture behind it has gone soft. Either alone has
a failure mode; together they have not produced one. Then the run
has to reach the end of the clip, because the panel does not go
away again once Dane has reached for it.

Only the last WINDOW seconds are decoded, which is why this takes
under a second a clip instead of minutes.

HOW IT CUTS
`-c copy`. The cut is at the END and the file already starts on a
keyframe, so no re-encode is needed: exact, lossless, and about a
second a clip rather than re-running the twenty-minute encode.

Durations in tools/sculpt-manifest.txt and in the <figcaption> of
every dossier page are updated to match.
============================================================
"""
import os
import re
import glob
import statistics
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VID = os.path.join(ROOT, 'assets', 'video', 'sculpture')
MANIFEST = os.path.join(ROOT, 'tools', 'sculpt-manifest.txt')
TMP = os.path.join(ROOT, 'tools', '.detrail.tmp')
os.environ['PATH'] = '/usr/local/bin:' + os.environ.get('PATH', '')

WINDOW = 8.0      # seconds at the end to examine
FPS = 24          # full rate: the panel's blue arrives in ONE frame,
                  # and the cut wants that frame, not the one after it
GRID = 64         # the corner crop is sampled at GRID x GRID
BLUE = 0.004      # this share of that crop must be control blue
SOFT = 0.55       # ...and edges must fall below this share of the window's own
GAP = 2           # frames of doubt tolerated inside one run
MAX_SLIDE = 0.5   # the panel takes about this long to slide in
LEAD = 0.30       # cut this much before the blue starts. Has to cover
                  # the stream copy's overshoot: -t stops on DTS, so
                  # B-frame reordering carries about three extra frames
                  # past the requested time
MIN_KEEP = 1.5    # never cut a clip below this many seconds


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'default=nw=1:nk=1', path],
                         capture_output=True, text=True).stdout.strip()
    return float(out)


def tail_signals(path, dur):
    """[(t, blue_fraction, edge_density)] over the last WINDOW seconds.

    Pixels are counted here rather than in a filter graph because geq's
    escaping is a fight and this turns out to be faster regardless."""
    start = max(0.0, dur - WINDOW)
    n = GRID * GRID * 3

    raw = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-ss', f'{start}', '-i', path,
         '-vf', f'fps={FPS},crop=iw*0.45:ih*0.55:iw*0.55:0,scale={GRID}:{GRID}',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout

    blues = []
    for i in range(len(raw) // n):
        f = raw[i * n:(i + 1) * n]
        hits = sum(1 for j in range(0, n, 3)
                   if f[j + 2] > 200 and f[j] < 90
                   and 70 < f[j + 1] < 190 and f[j + 2] - f[j + 1] > 70)
        blues.append(hits / (GRID * GRID))

    subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-ss', f'{start}', '-i', path,
         '-vf', f'fps={FPS},crop=iw*0.55:ih:0:0,scale=320:-2,format=gray,'
                f'edgedetect=low=0.08:high=0.2,signalstats,'
                f'metadata=print:key=lavfi.signalstats.YAVG:file={TMP}',
         '-f', 'null', '-'], capture_output=True)
    edges, t = [], None
    with open(TMP) as f:
        for line in f:
            m = re.search(r'pts_time:([0-9.]+)', line)
            if m:
                t = float(m.group(1))
                continue
            m = re.search(r'YAVG=([0-9.]+)', line)
            if m and t is not None:
                edges.append(float(m.group(1)))

    k = min(len(blues), len(edges))
    return [(start + i / FPS, blues[i], edges[i]) for i in range(k)]


def find_cut(path):
    """Returns (cut_time, onset, duration); cut is None if there is no tail."""
    dur = duration(path)
    sig = tail_signals(path, dur)
    if len(sig) < 8:
        return None, None, dur

    # The window opens on good footage, so its own first half is the
    # reference for what "sharp" looks like on THIS clip. A global
    # baseline gets skewed by whatever the piece was doing earlier.
    half = max(4, len(sig) // 2)
    base = statistics.median(e for _, _, e in sig[:half])
    if base <= 0.01:
        return None, None, dur

    overlaid = [b >= BLUE and e < base * SOFT for _, b, e in sig]
    if not any(overlaid[-(GAP + 1):]):
        return None, None, dur       # nothing at the end: leave it alone

    doubt, onset, i = 0, None, len(sig) - 1
    while i >= 0:
        if overlaid[i]:
            onset, doubt = i, 0
        else:
            doubt += 1
            if doubt > GAP:
                break
        i -= 1
    if onset is None:
        return None, None, dur

    # The AND of blue and blur only trips once the panel is well on its
    # way in. Blue alone is precise to the frame here (0.0 to 0.8% in a
    # single step) and the gate above has already established that this
    # run is the panel, so walk back over the slide-in to its first frame.
    # BOUNDED: the slide takes about a third of a second, and The Thing
    # and Beast are blue figures on blue-lit sets, so an unbounded walk
    # chains through the sculpture's own colour and eats whole seconds.
    limit = int(MAX_SLIDE * FPS)
    while onset > 0 and limit > 0 and sig[onset - 1][1] > 0.0005:
        onset -= 1
        limit -= 1

    cut = round(sig[onset][0] - LEAD, 2)
    if cut < MIN_KEEP or cut >= dur - 0.05:
        return None, sig[onset][0], dur
    return cut, sig[onset][0], dur


def main():
    apply = '--apply' in sys.argv
    clips = sorted(glob.glob(os.path.join(VID, '*', '*.mp4')))
    rows, skipped = [], []

    for path in clips:
        cut, onset, dur = find_cut(path)
        name = os.path.relpath(path, VID)
        if cut is None:
            skipped.append((name, dur, onset))
        else:
            rows.append((name, dur, cut, dur - cut))

    trimmed = sorted(r[3] for r in rows)
    print(f'{len(rows)} clips with a detected tail, {len(skipped)} without')
    if trimmed:
        print(f'  tail length: min {trimmed[0]:.2f}s  median '
              f'{statistics.median(trimmed):.2f}s  max {trimmed[-1]:.2f}s')
        print(f'  removing {sum(trimmed):.0f}s from {sum(r[1] for r in rows):.0f}s')
    print()
    print('longest tails (check these by eye):')
    for name, dur, cut, cutlen in sorted(rows, key=lambda r: -r[3])[:10]:
        print(f'  {name:34} {dur:6.2f}s -> {cut:6.2f}s  (-{cutlen:.2f}s)')
    if skipped:
        print()
        print(f'no tail detected, left alone ({len(skipped)}):')
        for name, dur, onset in skipped[:26]:
            print(f'  {name:34} {dur:6.2f}s' +
                  (f'  (onset {onset:.2f} rejected)' if onset else ''))

    if not apply:
        print('\nreport only. re-run with --apply to cut.')
        if os.path.exists(TMP):
            os.remove(TMP)
        return

    for name, dur, cut, _ in rows:
        src = os.path.join(VID, name)
        dst = src + '.trim.mp4'
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', src,
                        '-t', f'{cut}', '-c', 'copy', '-movflags', '+faststart', dst],
                       capture_output=True)
        if os.path.exists(dst) and os.path.getsize(dst) > 1000:
            os.replace(dst, src)
        elif os.path.exists(dst):
            os.remove(dst)
    print(f'\ncut {len(rows)} clips')

    new = {}
    for name, *_ in rows:
        slug, base = name.split('/')
        new[(slug, base[-6:-4])] = duration(os.path.join(VID, name))

    lines = []
    for line in open(MANIFEST):
        p = line.strip().split('|')
        if len(p) == 5 and (p[0], p[1]) in new:
            p[4] = f'{new[(p[0], p[1])]:.1f}'
            line = '|'.join(p) + '\n'
        lines.append(line)
    open(MANIFEST, 'w').writelines(lines)

    for page in glob.glob(os.path.join(ROOT, 'sculpture', '*.html')):
        slug = os.path.basename(page)[:-5]
        s = open(page).read()

        def fix(m):
            code, n = m.group(1), m.group(2)
            d = new.get((slug, n))
            return m.group(0) if d is None else \
                f'<span class="n">{code}-{n}</span><span>{d:.0f}s</span>'

        s2 = re.sub(r'<span class="n">([A-Z]{2})-(\d\d)</span><span>\d+s</span>', fix, s)
        if s2 != s:
            open(page, 'w').write(s2)
    print('manifest and dossier captions updated')

    if os.path.exists(TMP):
        os.remove(TMP)


if __name__ == '__main__':
    main()
