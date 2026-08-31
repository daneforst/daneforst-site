#!/usr/bin/env python3
"""
============================================================
sculpt-build.py: scaffolds the Sculpture wing, once.

    python3 tools/sculpt-build.py

Reads tools/sculpt-manifest.txt (written by sculpt-encode.sh)
and writes:

    sculpture.html                 the landing page
    sculpture/<slug>.html          one dossier per piece

THIS IS A SCAFFOLD, NOT A BUILD STEP. It ran once so nobody had
to hand-type 165 <figure> blocks. After that the HTML is the
source of truth, exactly like the Lab's pages. Edit the HTML
directly. Do not re-run this to "rebuild the site" or it will
flatten whatever you changed. (See build_site.py for what
happens to a generator nobody keeps up: it now points at a
directory that no longer exists.)

Every piece of prose in PIECES below is placeholder copy,
written to be replaced. Each generated page carries an HTML
comment at every spot that needs Dane's real words.
============================================================
"""
import os
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'tools', 'sculpt-manifest.txt')

# ------------------------------------------------------------------
# The collection, in page order: roughly by how much footage each
# piece has, so the fullest sets take the largest slots, and closing
# on the ship rather than on a single-clip figure.
# ALL PROSE HERE IS PLACEHOLDER.
# ------------------------------------------------------------------
PIECES = [
 dict(slug='baron-2-0', name='Baron 2.0', code='BR',
      cat='Original character &middot; Rebuild',
      tag='The Baron, built a second time, and finally right.',
      intro='The second pass at a character who has been through several. This one got turned in the round until the silhouette read from every angle, not just the one it was drawn from.',
      s1=('Why there is a second version',
          'The first Baron was a drawing that got sculpted. This one was sculpted, which turns out to be a different problem. Once a shape has to survive being spun a full three hundred and sixty degrees, every cheat you used on the front view comes due at once.'),
      s2=('What changed',
          'The proportions, mostly, and the way the whole thing sits on its base. Chrome, magenta, and a hat that still refuses to behave.'),
      tags=['Original character', 'Baron Minker', 'Rebuild', 'Turntable']),

 dict(slug='galactus', name='Galactus', code='GX',
      cat='Character study &middot; Scale',
      tag='A figure whose only real subject is size.',
      intro='Scale is the entire brief. Nothing in the anatomy tells you how big he is supposed to be, so the helmet and the proportions have to carry it alone.',
      s1=('The problem',
          'Big is not a shape. You cannot sculpt big, you can only sculpt the things that imply it, which mostly means keeping the detail coarse and letting the large forms stay large.'),
      s2=('Where the hours went',
          'The helmet, almost entirely. Everything below the collar is there to make the helmet look inevitable.'),
      tags=['Character study', 'Scale', 'Helmet', 'Turntable']),

 dict(slug='the-thing', name='The Thing', code='TT',
      cat='Character study &middot; Surface',
      tag='A rock pile that still has to have a face.',
      intro='Every plate is a decision about where the expression lives. Get the brow wrong and the whole thing reads as geology instead of a person.',
      s1=('The problem',
          'Rock is easy. A rock that can look worried is not. The plating has to break in a way that leaves room for an eyebrow to exist.'),
      s2=('What I kept',
          'The heaviest passes, and a couple of the ugly ones, because the ugly ones are where the surface language got worked out.'),
      tags=['Character study', 'Surface', 'Anatomy', 'Turntable']),

 dict(slug='beast', name='Beast', code='BE',
      cat='Character study &middot; Anatomy',
      tag='A scholar built like a wrecking ball.',
      intro='The difficulty with Beast is that he is two characters in one body, and the sculpt has to hold both at once without picking a side.',
      s1=('The problem',
          'All that bulk wants to read as a brute. The proportions have to stay heavy while the head stays articulate, and those two instincts pull in opposite directions the whole way through.'),
      s2=('Fur',
          'Fur at this scale is a lighting problem more than a sculpting one, which is most of why this set has as many passes in it as it does.'),
      tags=['Character study', 'Anatomy', 'Fur', 'Turntable']),

 dict(slug='swamp-thing', name='Swamp Thing', code='SW',
      cat='Character study &middot; Mass',
      tag='Vegetation, without sculpting every leaf.',
      intro='Mass over detail. The trick with anything overgrown is convincing the eye it is looking at a thousand small things while only ever building a few dozen.',
      s1=('The problem',
          'Detail is a trap here. Sculpt every frond and you get a bush. The read has to come from the big silhouette first, with the surface doing far less work than it feels like it should.'),
      s2=('What worked',
          'Committing to the mass early and refusing to open it back up, no matter how tempting the close pass got.'),
      tags=['Character study', 'Mass', 'Organic', 'Turntable']),

 dict(slug='nightcrawler', name='Nightcrawler', code='NC',
      cat='Character study &middot; Pose',
      tag='He should look like he is about to not be there.',
      intro='Built for the pose more than the portrait. A character defined by leaving needs a silhouette that already looks mid-departure.',
      s1=('The problem',
          'Static poses kill him. Every angle has to feel like it was caught rather than arranged, which means the balance is deliberately wrong in a way that only works from certain sides.'),
      s2=('The tail',
          'The tail does more compositional work than the figure does. It is the line that ties the pose together from behind.'),
      tags=['Character study', 'Pose', 'Silhouette', 'Turntable']),

 dict(slug='pinok', name='Pinok', code='PK',
      cat='Puppet &middot; Original character',
      tag='The rare piece with its reference sitting on the desk.',
      intro='Pinok exists as a physical puppet as well, which made this the one sculpt where the source material could be picked up and turned over by hand.',
      s1=('Working from a real object',
          'Having the thing in front of you is less helpful than you would think. A puppet is built to move and a sculpt is built to hold still, so half the job was deciding which pose was the honest one.'),
      s2=('Still open',
          'There is a version of this that goes back to being a puppet again. That has not happened yet.'),
      tags=['Original character', 'Puppet', 'Baron Minker', 'Turntable']),

 dict(slug='gambit', name='Gambit', code='GB',
      cat='Character study &middot; Attitude',
      tag='Mostly attitude, which is hard to sculpt.',
      intro='Coat, staff, posture. Nothing about this character is structural, it is all carriage, and carriage takes more passes than anatomy does.',
      s1=('The problem',
          'You cannot sculpt swagger directly. It shows up in the weight distribution, in how far the coat trails, in where the staff is planted. All indirect, all easy to overdo.'),
      s2=('Why there are so many turns',
          'Because it kept being nearly right. That is usually the sign a piece is worth another pass.'),
      tags=['Character study', 'Costume', 'Pose', 'Turntable']),

 dict(slug='magneto', name='Magneto', code='MG',
      cat='Character study &middot; Silhouette',
      tag='The helmet is the character.',
      intro='Everything below the collar exists to make the helmet look inevitable. Once that shape is right the rest of the figure mostly falls into place.',
      s1=('The problem',
          'A famous silhouette leaves very little room to move. Get the helmet a few degrees off and it stops being him, so most of these turns are the same object with small corrections.'),
      s2=('The cape',
          'The cape is there to stop the figure reading as a column. It is doing structural work, not dramatic work.'),
      tags=['Character study', 'Silhouette', 'Helmet', 'Turntable']),

 dict(slug='colossus', name='Colossus', code='CS',
      cat='Character study &middot; Metal',
      tag='Steel that still has to read as skin.',
      intro='The whole piece lives or dies on the plating, so most of the passes here went into how the panels break across the shoulders and where they stop.',
      s1=('The problem',
          'Organic metal is a contradiction you have to sell. Too regular and it becomes armour, too loose and it stops being metal at all.'),
      s2=('The tell',
          'The shoulders. If the plates break wrong there, nothing further down can save it.'),
      tags=['Character study', 'Metal', 'Surface', 'Turntable']),

 dict(slug='dharbe', name='Dharbe', code='DH',
      cat='Original character',
      tag='Started as a doodle, got out of hand.',
      intro='An original, from the same shelf as the rest of the Minker material. No brief, no reference, no particular plan, which is how most of the good ones start.',
      s1=('Where it came from',
          'A shape that would not go away. Some sculpts are solving a known character and some are finding out what the character is, and this one was firmly the second kind.'),
      s2=('Still open',
          'Dharbe does not have a story attached yet. That may or may not be a problem.'),
      tags=['Original character', 'Baron Minker', 'Concept', 'Turntable']),

 dict(slug='bretterling', name='Bretterling', code='BT',
      cat='Original character',
      tag='Somewhere between an insect and a piece of furniture.',
      intro='Another original, and roughly where it was aiming. The appeal is that you cannot immediately name what you are looking at.',
      s1=('The idea',
          'Take two categories that have nothing to do with each other and build the thing that would have to exist between them. The result is uncomfortable in a way that is hard to look away from.'),
      s2=('What I would change',
          'The legs, probably. They are the part still arguing with the rest of it.'),
      tags=['Original character', 'Concept', 'Creature', 'Turntable']),

 dict(slug='cyclops', name='Cyclops', code='CY',
      cat='Character study &middot; Restraint',
      tag='The visor first, everything else after.',
      intro='A character defined by one horizontal line is a useful exercise in restraint. There is exactly one place the eye goes and nothing else is allowed to compete with it.',
      s1=('The problem',
          'Every detail you add anywhere else weakens the visor. Most of the work on this one was subtraction.'),
      s2=('Short set',
          'It arrived quickly and there was no reason to keep pushing it.'),
      tags=['Character study', 'Restraint', 'Silhouette', 'Turntable']),

 dict(slug='minker-ship', name='Minker Ship', code='MS',
      cat='Vehicle &middot; Worldbuilding',
      tag='Not a character. A place things happen in.',
      intro='The ship from the Baron Minker universe, turned slowly so the underside gets its moment. Hard surfaces after a shelf full of anatomy, which was the point.',
      s1=('Why a vehicle',
          'Worldbuilding needs objects as much as it needs people. A ship tells you how the world moves, what it is made of, and how much it cares about comfort.'),
      s2=('The underside',
          'It is the most interesting part and the part nobody ever builds, so it got the slow pass.'),
      tags=['Baron Minker', 'Vehicle', 'Hard surface', 'Worldbuilding']),

 dict(slug='the-baron', name='The Baron', code='TB',
      cat='Original character &middot; First version',
      tag='The original, before the rebuild.',
      intro='Kept here because the first version of anything is usually where the idea is clearest, even when the execution is not.',
      s1=('Why keep it',
          'Version one is rough and it is also the most honest read on what the character was supposed to be. Everything the rebuild fixed, it fixed by moving away from something that was working here.'),
      s2=('See also',
          'Baron 2.0 is the same character, sculpted again from scratch.'),
      tags=['Original character', 'Baron Minker', 'First version', 'Turntable']),

 dict(slug='storm', name='Storm', code='ST',
      cat='Character study &middot; Motion',
      tag='The hair and the cape are the whole problem.',
      intro='Two turns only. Everything difficult about this figure is the material that is supposed to be moving, and it is all still moving.',
      s1=('The problem',
          'Wind is a lie you have to tell in a static object. It only reads if every loose element agrees on a single direction, and the moment one of them disagrees the whole illusion drops.'),
      s2=('Unfinished',
          'This one is not done and is here anyway.'),
      tags=['Character study', 'Motion', 'Cloth', 'In progress']),

 dict(slug='wolverine', name='Wolverine', code='WV',
      cat='Character study',
      tag='One pass, one angle.',
      intro='Sometimes a piece gets exactly as much time as it needs, and stopping is the correct decision rather than a failure of nerve.',
      s1=('One turn',
          'There is a single recording of this one. It said what it had to say on the first pass and there was nothing obvious left to fix.'),
      s2=('Possibly later',
          'If it comes back it will come back as a full set, not as an extension of this.'),
      tags=['Character study', 'Single pass', 'Turntable']),
]

# ------------------------------------------------------------------
# LANDING PAGE WEIGHTS. Uniform tiles read as a spreadsheet, so the
# band runs three scales and the heaviest sets take the most room:
#   feature  full width, media beside type (flip = media on the right)
#   w6 / w4  a half or a third of the bed
#   w3       a quarter, for the sets that are a turn or two long
# Rows have to add up to 12, or the bed leaves a hole.
#   feature | 6+6 | feature | 4+4+4 | feature | 6+6 | 4+4+4 | 3+3+3+3
# ------------------------------------------------------------------
WEIGHTS = {
    'baron-2-0': 'feature', 'galactus': 'w6', 'the-thing': 'w6',
    'beast': 'feature flip', 'swamp-thing': '', 'nightcrawler': '', 'pinok': '',
    'gambit': 'feature', 'magneto': 'w6', 'colossus': 'w6',
    'dharbe': '', 'bretterling': '', 'cyclops': '',
    'minker-ship': 'w3', 'the-baron': 'w3', 'storm': 'w3', 'wolverine': 'w3',
}

# clips used in the landing page hero, in order
HERO = ['baron-2-0/baron-2-0-01', 'galactus/galactus-03', 'the-thing/the-thing-02',
        'swamp-thing/swamp-thing-04', 'minker-ship/minker-ship-01']

NAV_ITEMS = [('about.html', 'About'), (None, 'Work'), ('branding.html', 'Branding'),
             ('web.html', 'Web'), ('packaging.html', 'Packaging'),
             ('sculpture.html', 'Sculpture'), (None, 'Galleries'), ('contact.html', 'Contact')]

WORK = [('dead-comics-society', 'Dead Comics Society', 'Brand Identity + Event Identity'),
        ('club-tattoo', 'Club Tattoo', 'Illustration'),
        ('haystack-wines', 'Haystack Wines', 'Brand Identity + Packaging'),
        ('museum-of-failure', 'Museum of Failure', 'Exhibition Branding + Experiential'),
        ('2b-farming', '2B Farming', 'Brand Identity + Photography'),
        ('rabbit-hole-wines', 'Rabbit Hole Wines', 'Brand Identity + Packaging'),
        ('tame-impala', 'Tame Impala', 'Poster Design + Illustration'),
        ('ashwood-tattoo-studios', 'Ashwood Tattoo Studio', 'Brand Identity'),
        ('experiments', 'Selected Experiments', '3D &bull; Sculpture &bull; Fabrication')]

GALS = [('album-art', 'Album Art', 'Covers in motion'),
        ('key-art', 'Key Art', 'Campaign key frames'),
        ('show-posters', 'Show Posters', 'Gig + event prints')]

ARROW = ('<svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">'
         '<path d="M1 13L13 1M13 1H4M13 1v9" stroke="currentColor" stroke-width="1.5"/></svg>')


# ------------------------------------------------------------------
# shared chrome
# ------------------------------------------------------------------
def head(p, title, desc):
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{p}assets/css/style.css?v=11">
<link rel="stylesheet" href="{p}assets/css/def-quote.css?v=1">
<link rel="stylesheet" href="{p}assets/css/lab.css?v=3">
<link rel="stylesheet" href="{p}assets/css/sculpt.css?v=6">
</head>'''


def nav(p):
    lis = []
    for href, label in NAV_ITEMS:
        if label == 'Work':
            lis.append(f'    <li><a class="wd-trigger" href="{p}index.html#work" aria-expanded="false" aria-controls="wd">Work</a></li>')
        elif label == 'Galleries':
            lis.append(f'    <li><a class="wd-trigger" href="{p}galleries.html" aria-expanded="false" aria-controls="gd">Galleries</a></li>')
        else:
            lis.append(f'    <li><a href="{p}{href}">{label}</a></li>')
    ul = '\n'.join(lis)

    wd = ''.join(
        f'<a class="wd-row" href="{p}work/{s}.html"><span class="n">{i:02d}</span>'
        f'<span class="t">{t}</span><span class="c">{c}</span></a>'
        for i, (s, t, c) in enumerate(WORK, 1))
    gd = ''.join(
        f'<a class="wd-row" href="{p}galleries/{s}.html"><span class="n">{i:02d}</span>'
        f'<span class="t">{t}</span><span class="c">{c}</span></a>'
        for i, (s, t, c) in enumerate(GALS, 1))
    msub = ''.join(
        f'<a href="{p}work/{s}.html"><i>{i:02d}</i>{t}</a>'
        for i, (s, t, c) in enumerate(WORK, 1))

    return f'''<nav>
  <a class="logo" href="{p}index.html"><img src="{p}assets/img/def-logo.png" alt="DEF — Dane Erik Forst signature logo"><span class="lab-mark"><span class="bl"></span>Sculpture</span></a>
  <ul>
{ul}
  </ul>
  <div class="avail"><span class="dot"></span>Open for work</div>
  <button class="burger" aria-label="Open menu" aria-expanded="false" aria-controls="mnav">
    <span></span><span></span><span></span>
  </button>
</nav>

<div class="wd" id="wd">
{wd}
  <div class="wd-foot"><span>Index — Selected Work</span><span>DEF Studios, Portland OR</span></div>
</div>

<div class="wd" id="gd">
{gd}
  <div class="wd-foot"><a href="{p}galleries.html">Index — All Galleries</a><span>DEF Studios, Portland OR</span></div>
</div>

<div class="mnav" id="mnav">
  <a href="{p}about.html">About</a>
  <div class="mlabel">Work — Index</div>
  <div class="msub">{msub}</div>
  <a href="{p}branding.html">Branding</a>
  <a href="{p}web.html">Web</a>
  <a href="{p}packaging.html">Packaging</a>
  <a href="{p}sculpture.html">Sculpture</a>
  <a href="{p}galleries.html">Galleries</a>
  <a href="{p}contact.html">Contact</a>
  <div class="m-meta">
    <span class="avail-m"><span class="dot"></span>Open for work</span>
    <span>Portland, Oregon</span>
  </div>
</div>'''


def footer(p):
    return f'''<footer class="foot-slim">
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs><linearGradient id="sgrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff8330"/><stop offset="1" stop-color="#ff4d8c"/>
  </linearGradient></defs>
</svg>
  <a href="{p}index.html" aria-label="Back to home" style="display:block;width:max-content"><img class="sig" src="{p}assets/img/def-logo.png" alt="Dane Erik Forst signature"></a>
  <div class="socials">
  <a href="https://www.linkedin.com/in/daneforst" target="_blank" rel="noopener" aria-label="LinkedIn">
    <svg viewBox="0 0 24 24" fill="url(#sgrad)"><path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.4 8.2h4.2V23H.4V8.2zm7.1 0h4v2h.06c.56-1.06 1.93-2.18 3.97-2.18 4.25 0 5.03 2.8 5.03 6.44V23h-4.2v-7.4c0-1.77-.03-4.05-2.47-4.05-2.47 0-2.85 1.93-2.85 3.92V23H7.5V8.2z"/></svg>
  </a>
  <a href="https://www.instagram.com/dan3_4st" target="_blank" rel="noopener" aria-label="Instagram @dan3_4st">
    <svg viewBox="0 0 24 24" fill="none" stroke="url(#sgrad)" stroke-width="2"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.6" cy="6.4" r="1.4" fill="url(#sgrad)" stroke="none"/></svg>
  </a>
  <a href="https://www.youtube.com/@baronminker656" target="_blank" rel="noopener" aria-label="YouTube">
    <svg viewBox="0 0 24 24" fill="url(#sgrad)"><path d="M23.5 7.2a3 3 0 0 0-2.1-2.1C19.5 4.5 12 4.5 12 4.5s-7.5 0-9.4.6A3 3 0 0 0 .5 7.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-4.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>
  </a>
</div>
  <a class="dq-foot-link" href="{p}contact.html" data-def-quote-open>Need a project quote?<svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 13L13 1M13 1H4M13 1v9" stroke="currentColor" stroke-width="1.5"/></svg></a>
  <div class="meta-row" style="margin-top:1.6rem;padding-top:1.2rem;border-top:1px solid var(--line-light);display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;font-family:var(--mono);font-size:.7rem;text-transform:uppercase;letter-spacing:.13em;color:rgba(228,224,212,.65)">
    <span>© 2026 DEF Studios</span>
    <a href="mailto:daneforst@gmail.com">daneforst@gmail.com</a>
    <a href="tel:6613033945">661·303·3945</a>
    <span>Portland, Oregon</span>
  </div>
</footer>'''


def scripts(p):
    return f'''<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script src="{p}assets/js/main.js?v=3"></script>
<script src="{p}assets/js/def-quote.js?v=1"></script>
<script src="{p}assets/js/lab.js?v=2"></script>'''


# ------------------------------------------------------------------
# manifest
# ------------------------------------------------------------------
def read_plinths():
    """Backdrop colour per clip, from tools/sculpt-plinth.py. Each tile
    letterboxes onto its own clip's colour instead of a fixed black."""
    out = {}
    path = os.path.join(ROOT, 'tools', 'sculpt-plinths.txt')
    if not os.path.exists(path):
        return out
    for line in open(path):
        p = line.split()
        if len(p) == 3:
            out[p[0]] = (p[1], p[2])
    return out


def read_manifest():
    clips = OrderedDict()
    with open(MANIFEST) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            slug, n, w, h, dur = line.split('|')
            clips.setdefault(slug, []).append(
                dict(n=n, w=int(w), h=int(h), dur=float(dur),
                     shape='ar-43' if int(w) >= int(h) else 'ar-34'))
    return clips


# Row patterns for the specimen wall, in twelfths. Cycled, so a long
# set gets variety and a short one still fills its row.
ROWS = [[4, 4, 4], [6, 6], [4, 8], [4, 4, 4], [12], [8, 4], [6, 6], [4, 4, 4]]
SPAN = {12: 'm-full', 8: 'm-two', 6: 'm-half', 4: 'm-third', 3: 'm-quarter'}


def rows_for(count):
    """Row patterns, in twelfths, that always fill whole rows."""
    out, i = [], 0
    while sum(len(r) for r in out) < count:
        row = ROWS[i % len(ROWS)]
        i += 1
        left = count - sum(len(r) for r in out)
        if len(row) > left:                       # final, partial row
            row = {1: [12], 2: [6, 6], 3: [4, 4, 4]}[left]
        out.append(row)
    return out


def spans_for(count):
    """Flat list of span classes, for tests and for reading."""
    return [SPAN[s] for row in rows_for(count) for s in row]


def mosaic(piece, clips, p, plinths):
    """Clip order is interleaved so neighbouring tiles are not
    consecutive turns of the same angle. Within each row the widest
    span goes to the widest clip: a portrait turn in an 8- or
    12-column span is mostly black, and drags the row's height up
    with it."""
    order = clips[::2] + clips[1::2]
    laid, i = [], 0
    for row in rows_for(len(order)):
        chunk = order[i:i + len(row)]
        i += len(row)
        pairs = sorted(zip(sorted(row, reverse=True),
                           sorted(chunk, key=lambda c: -c['w'] / c['h'])),
                       key=lambda pr: -pr[0])
        # keep the authored left-to-right order of the row's spans
        by_span = {}
        for s, c in pairs:
            by_span.setdefault(s, []).append(c)
        for s in row:
            laid.append((by_span[s].pop(0), SPAN[s]))

    out = []
    for c, span in laid:
        stem = f'{piece["slug"]}-{c["n"]}'
        src = f'{p}assets/video/sculpture/{piece["slug"]}/{stem}'
        pa, pb = plinths.get(stem, ('#000000', '#000000'))
        out.append(f'''    <figure class="mo-item {span} {c['shape']} reveal" style="--pa:{pa};--pb:{pb}">
      <video class="labvid" data-src="{src}.mp4" poster="{src.replace('/video/', '/img/')}.jpg" muted loop playsinline preload="none" aria-label="{piece['code']} turn {c['n']}"></video>
      <figcaption class="mo-cap"><span class="n">{piece['code']}-{c['n']}</span><span>{c['dur']:.0f}s</span></figcaption>
    </figure>''')
    return '\n'.join(out)


# ------------------------------------------------------------------
# landing page
# ------------------------------------------------------------------
def build_landing(clips, plinths):
    p = ''
    total = sum(len(v) for v in clips.values())
    originals = sum(1 for x in PIECES if 'Original' in x['cat'] or 'Baron Minker' in x['tags'])
    studies = len(PIECES) - originals

    hero = ', '.join(f'"assets/video/sculpture/{h}.mp4"' for h in HERO)
    hero_poster = f'assets/img/sculpture/{HERO[0]}.jpg'

    tiles = []
    for i, x in enumerate(PIECES, 1):
        cl = clips.get(x['slug'], [])
        if not cl:
            continue
        pick = cl[1] if len(cl) > 1 else cl[0]
        stem = f'{x["slug"]}-{pick["n"]}'
        base = f'assets/video/sculpture/{x["slug"]}/{stem}'
        pa, pb = plinths.get(stem, ('#000000', '#000000'))
        w = WEIGHTS.get(x['slug'], '')
        cls = ('sc-item ' + w).strip()
        turns = f'{len(cl)} {"turn" if len(cl) == 1 else "turns"}'
        shot = (f'    <div class="sc-shot">\n'
                f'      <video class="labvid" data-src="{base}.mp4" '
                f'poster="{base.replace("/video/", "/img/")}.jpg" muted loop playsinline '
                f'preload="none" aria-label="{x["name"]}"></video>\n'
                f'    </div>')

        if 'feature' in w:
            body = f'''{shot}
    <div class="sc-face">
      <span class="scf-idx">{i:02d} &nbsp;/&nbsp; {x['cat']}</span>
      <h3 class="scf-name">{x['name']}</h3>
      <p class="scf-note">{x['tag']}</p>
      <div class="scf-row">
        <span class="scf-cue">Open the file {ARROW}</span>
        <span class="scf-count">{turns}</span>
      </div>
    </div>'''
        else:
            body = f'''{shot}
    <div class="sc-label">
      <span class="sc-code">{x['code']}</span>
      <span class="sc-name">{x['name']}</span>
      <span class="sc-cat">{x['cat']}</span>
      <span class="sc-count">{turns}</span>
    </div>'''

        tiles.append(f'  <a class="{cls}" style="--pa:{pa};--pb:{pb}" '
                     f'href="sculpture/{x["slug"]}.html">\n{body}\n  </a>')

    rows = []
    for i, x in enumerate(PIECES, 1):
        cl = clips.get(x['slug'], [])
        if not cl:
            continue
        pk = cl[2] if len(cl) > 2 else cl[0]
        rows.append(f'''  <a class="spec-row" href="sculpture/{x['slug']}.html" data-peek="assets/video/sculpture/{x['slug']}/{x['slug']}-{pk['n']}.mp4" data-peek-tag="{x['code']} · {x['name']}">
    <span class="spec-n">{i:02d}</span>
    <span class="spec-t">{x['name']}</span>
    <span class="spec-c">{x['cat']}</span>
  </a>''')

    return f'''{head(p, 'Sculpture · Dane Erik Forst',
                     'Seventeen sculpted pieces by art director Dane Erik Forst, each one turned in the round: original characters from the Baron Minker universe alongside studies of figures he grew up drawing.')}
<body class="labbody sculptbody">
<!-- ============================================================
     SCULPTURE: landing page for the sculpture wing.
     Linked from the main navigation and from the home page.

     TO ADD A PIECE:
       1. Drop the clips in a folder and run
          ./tools/sculpt-encode.sh "/path/to/folder" <slug>
          then ./tools/sculpt-detrail.py --apply to cut the
          screen-recording tail off the new clips
       2. Copy any sculpture/<slug>.html as your starting point
       3. Add an .sc-item below AND a .spec-row further down
     THE BAND IS NOT UNIFORM, on purpose. Weights are:
       feature      full width, media beside type
       feature flip same, media on the right
       w6           half the bed
       (no class)   a third
       w3           a quarter
     Every row has to add up to twelve or the bed leaves a hole.
     As it stands: feature / 6+6 / feature / 4+4+4 / feature /
     6+6 / 4+4+4 / 3+3+3+3.
     The --pa and --pb on each card are that clip's own backdrop
     colour, so a piece shot on pink does not sit in a black
     box. Re-sample with tools/sculpt-plinth.py.

     PLACEHOLDER COPY: every sentence on this page and on the
     seventeen dossiers is written to be replaced. Search for
     the word PLACEHOLDER to find each spot.
     ============================================================ -->
<div id="loader"><span class="count">00</span><span class="word">In <em>the round</em></span></div>

{nav(p)}

<header class="lab-hero">
  <div class="lh-stage" data-clips='[{hero}]'>
    <video class="a" muted loop playsinline preload="none" poster="{hero_poster}" aria-hidden="true"></video>
    <video class="b" muted loop playsinline preload="none" aria-hidden="true"></video>
  </div>
  <div class="lh-in">
    <div class="lh-eyebrow">
      <span class="cat">DEF Studios · Sculpture</span>
      <span>Portland, Oregon</span>
    </div>
    <h1 class="lh-type">
      <span class="ln" data-k>Drawing has a front.</span>
      <span class="ln soft">Sculpture has no such mercy.</span>
    </h1>
    <div class="lh-foot">
      <p class="sub">Seventeen pieces, each one turned all the way around. PLACEHOLDER, replace with your own line.</p>
      <span class="lh-scroll"><i></i>Scroll</span>
    </div>
  </div>
</header>

<!-- PLACEHOLDER: the argument for the section. Three paragraphs, yours. -->
<section class="lab-sec">
  <div class="lab-kicker">01 · Why sculpt at all</div>
  <p class="lab-lede">A drawing only has to work <em>from one seat in the room.</em></p>
  <div class="lab-body">
    <p>I have spent eighteen years making flat things: marks, layouts, labels, posters, screens. All of it is composed for a single viewpoint, and a great deal of the craft is knowing which angle to compose for and then defending it.</p>
    <p>Sculpture takes that away. There is no front, no chosen angle, no crop to hide behind. A shape that only works from three quarters is simply a shape that does not work. That is a slower and more honest way to find out whether an idea was ever any good.</p>
    <p>Some of what follows is my own: characters and objects out of the Baron Minker universe that had nowhere else to exist. The rest are studies of figures I grew up drawing, made for no reason beyond wanting to find out whether I could get them to stand up.</p>
  </div>
</section>

<div class="sc-tally">
  <div><b>{len(PIECES)}</b><span>Pieces</span></div>
  <div><b>{total}</b><span>Turns recorded</span></div>
  <div><b>{originals}</b><span>Original characters</span></div>
  <div><b>{studies}</b><span>Studies</span></div>
</div>

<section class="lab-sec tight">
  <div class="lab-kicker">02 · The collection</div>
  <p class="lab-lede" style="max-width:24em">Seventeen pieces. <em>Every one of them turns.</em></p>
</section>
<div class="sc-band">
{chr(10).join(tiles)}
</div>

<section class="lab-sec tight">
  <div class="lab-kicker">03 · Index</div>
</section>
<div class="spec-index">
{chr(10).join(rows)}
</div>

<!-- PLACEHOLDER: how the pieces actually get made. Your process, your tools. -->
<section class="lab-sec">
  <div class="lab-kicker">04 · How they get made</div>
  <div class="tk-wrap">
    <p class="tk-line">Sculpted digitally, <b>judged the old way.</b></p>
    <div>
      <p class="tk-note">Each piece is built in the round and then recorded turning, because a still image of a sculpture is just a drawing again and hides exactly the problems the sculpting was meant to expose. What you are looking at on every page here is the same footage I use to decide whether a piece is finished. PLACEHOLDER, replace with your real process and the tools you use.</p>
    </div>
  </div>
</section>

<section class="lab-close">
  <h2>Want something built <em>in three dimensions?</em></h2>
  <p class="sub">Characters, objects, props, or a shape that only exists in your head so far.</p>
  <div class="close-paths">
    <a class="close-path" href="contact.html">
      <span class="cp-k">01 · Character work</span>
      <span class="cp-t">Design it and sculpt it</span>
      <span class="cp-d">From a brief or a scribble through to a piece that holds up from every side.</span>
    </a>
    <a class="close-path" href="contact.html">
      <span class="cp-k">02 · Objects and props</span>
      <span class="cp-t">Build the thing itself</span>
      <span class="cp-d">Products, vehicles, packaging forms, anything that needs to exist as an object first.</span>
    </a>
    <a class="close-path" href="lab.html">
      <span class="cp-k">03 · See also</span>
      <span class="cp-t">The Lab</span>
      <span class="cp-d">Where several of these pieces end up once they start moving.</span>
    </a>
  </div>
</section>

{footer(p)}

<div class="lab-grain" aria-hidden="true"></div>

{scripts(p)}
</body>
</html>
'''


# ------------------------------------------------------------------
# dossier pages
# ------------------------------------------------------------------
def build_piece(i, x, clips, plinths):
    p = '../'
    cl = clips[x['slug']]
    n = len(cl)
    hero = f'{p}assets/video/sculpture/{x["slug"]}/{x["slug"]}-{cl[0]["n"]}'
    prev = PIECES[i - 2] if i > 1 else PIECES[-1]
    nxt = PIECES[i] if i < len(PIECES) else PIECES[0]
    tags = ''.join(f'<span class="dossier-tag">{t}</span>' for t in x['tags'])
    plain_tag = x['tag'].replace('&middot;', '·')

    return f'''{head(p, f'{x["name"]} · Sculpture · Dane Erik Forst', plain_tag)}
<body class="labbody sculptbody pbody">
<!-- ============================================================
     SCULPTURE DOSSIER: {x['name']}
     To add another piece: copy this file, then update
       1. <title>, meta description, .phero (idx / h1 / tag)
       2. .project-intro, .pmeta, the .psec blocks and .dossier-tags
       3. the .mosaic, one <figure class="mo-item"> per clip
          span:   m-full / m-two / m-half / m-third / m-quarter
          shape:  ar-43 (landscape) / ar-34 (portrait)
       4. the .related prev-next links at the bottom
       5. add an .sc-tile and a .spec-row on sculpture.html
     Clips are encoded by tools/sculpt-encode.sh. Every <video>
     carries data-src rather than src so lab.js can load it on
     approach: seventeen pages of this would be unusable otherwise.
     Tiles letterbox on black rather than cropping, so no piece
     ever loses its silhouette to a tile shape.

     PLACEHOLDER COPY: every sentence below is written to be
     replaced with Dane's own.
     ============================================================ -->
{nav(p)}

<header class="phero">
  <video class="labvid" data-src="{hero}.mp4" poster="{hero.replace('/video/', '/img/')}.jpg" muted loop playsinline preload="none" aria-hidden="true"></video>
  <div class="ph-in">
    <span class="idx">Sculpture · {i:02d} / {x['name']}</span>
    <h1>{x['name']}</h1>
    <!-- PLACEHOLDER: one line, what this piece is -->
    <p class="tag">{x['tag']}</p>
  </div>
</header>

<section class="pad">
  <a class="back-lab" href="{p}sculpture.html">
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M13 1L1 13M1 13h9M1 13V4" stroke="currentColor" stroke-width="1.5"/></svg>
    All sculpture</a>
  <!-- PLACEHOLDER: the intro paragraph -->
  <p class="project-intro reveal">{x['intro']}</p>

  <!-- PLACEHOLDER: fill in Year, and correct Medium if it is wrong -->
  <div class="pmeta reveal" style="margin-top:clamp(1.8rem,4vh,2.8rem)">
    <div><span>Role</span><b>Concept, Sculpt, Art Direction</b></div>
    <div><span>Medium</span><b>Digital sculpture</b></div>
    <div><span>Turns</span><b>{n} {'clip' if n == 1 else 'clips'}</b></div>
    <div><span>Year</span><b>TBC</b></div>
  </div>

  <!-- PLACEHOLDER: two sections, headings and all -->
  <div class="psec reveal">
    <h2>{x['s1'][0]}</h2>
    <p>{x['s1'][1]}</p>
  </div>
  <div class="psec reveal">
    <h2>{x['s2'][0]}</h2>
    <p>{x['s2'][1]}</p>
  </div>

  <div class="dossier-tags reveal">{tags}</div>
</section>

<section class="pad" style="padding-top:0">
  <div class="lab-kicker">Turns · {n} {'clip' if n == 1 else 'clips'}</div>
  <div class="mosaic">
{mosaic(x, cl, p, plinths)}
  </div>
</section>

<div class="related" role="navigation" aria-label="More sculpture">
  <a href="{prev['slug']}.html"><span class="dir">← Previous</span><span class="rt">{prev['name']}</span></a>
  <a href="{nxt['slug']}.html"><span class="dir">Next →</span><span class="rt">{nxt['name']}</span></a>
</div>

<section class="page-cta">
  <h2>Need something built in the round?</h2>
  <a class="cta" href="{p}contact.html">Let&#8217;s make it
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 13L13 1M13 1H4M13 1v9" stroke="currentColor" stroke-width="1.5"/></svg>
  </a>
</section>

{footer(p)}

<div class="lab-grain" aria-hidden="true"></div>

{scripts(p)}
</body>
</html>
'''


def main():
    clips = read_manifest()
    plinths = read_plinths()
    missing = [x['slug'] for x in PIECES if x['slug'] not in clips]
    if missing:
        raise SystemExit('no clips encoded for: ' + ', '.join(missing))

    os.makedirs(os.path.join(ROOT, 'sculpture'), exist_ok=True)
    with open(os.path.join(ROOT, 'sculpture.html'), 'w') as f:
        f.write(build_landing(clips, plinths))
    print('wrote sculpture.html')
    for i, x in enumerate(PIECES, 1):
        path = os.path.join(ROOT, 'sculpture', x['slug'] + '.html')
        with open(path, 'w') as f:
            f.write(build_piece(i, x, clips, plinths))
        print('wrote sculpture/%s.html  (%d clips)' % (x['slug'], len(clips[x['slug']])))


if __name__ == '__main__':
    main()
