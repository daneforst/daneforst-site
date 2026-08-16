#!/usr/bin/env python3
"""
build_site.py — DEF Studios site generator
===========================================
Manages nav sync across all pages and generates stub case study pages
for new projects. Completed pages are protected by .bak files.

USAGE
-----
  python3 build_site.py           # sync nav everywhere + generate any new stubs
  python3 build_site.py --dry-run # preview what would change, write nothing
  python3 build_site.py --nav-only # only sync nav, skip stub generation

HOW PROTECTION WORKS
--------------------
When a case study page is complete and ready to lock, save a copy as:
  site/work/<slug>.html.bak

The generator will still update the nav blocks inside the completed page,
but will NEVER overwrite the content (hero, copy, gallery) of a page that
has a matching .bak file. New stubs are only written for projects that
have NO existing .html file at all.

ADDING A NEW PROJECT
--------------------
1. Add an entry to PROJECTS below (in display order).
2. Run: python3 build_site.py
3. A stub page is created at site/work/<slug>.html
4. Add your images to site/assets/img/<slug>/
5. Fill in the stub with real copy and gallery.
6. When done, save a .bak: cp site/work/<slug>.html site/work/<slug>.html.bak
"""

import os
import re
import sys
import shutil
from pathlib import Path

# ---------------------------------------------------------------------------
# CONFIGURATION — edit here to add/reorder projects
# ---------------------------------------------------------------------------

SITE_DIR = Path(__file__).parent / "site"

# Master project list — ORDER MATTERS (determines numbering)
# Fields:
#   slug        filename without .html  (site/work/<slug>.html)
#   title       display title (use \n for <br> in headings)
#   category    shown in nav drawer and idx span
#   tagline     italic subhead on case study and homepage panel
#   hero_img    path relative to site/ root for homepage panel bg
#               (use None to leave a placeholder comment)
#   role        pmeta Role field
#   scope       pmeta Scope field
PROJECTS = [
    {
        "slug": "dead-comics-society",
        "title": "Dead Comics\nSociety",
        "category": "Brand Identity + Event Identity",
        "tagline": "a brand with a sense of humor about mortality",
        "hero_img": "https://static.wixstatic.com/media/31c583_62fc45097c1d4741b2effeff7544fb19~mv2.jpg/v1/fill/w_1920,h_1080,al_c,q_90,enc_auto/file.jpg",
        "role": "Creative Direction / Design",
        "scope": "Identity · Animation · Event",
    },
    {
        "slug": "club-tattoo",
        "title": "Club\nTattoo",
        "category": "Illustration",
        "tagline": "ink culture, drawn by hand",
        "hero_img": "https://static.wixstatic.com/media/31c583_28e97960a50948b6b2f9ade9605c79e7~mv2.jpg/v1/fill/w_1920,h_1281,al_c,q_90,enc_auto/file.jpg",
        "role": "Illustration / Art Direction",
        "scope": "Illustration · Print",
    },
    {
        "slug": "haystack-wines",
        "title": "Haystack\nWines",
        "category": "Brand Identity + Packaging",
        "tagline": "coastal character in every detail",
        "hero_img": "https://static.wixstatic.com/media/31c583_f78f137d50bd49ae887d2708c3e4bcd7~mv2.jpg/v1/fill/w_1920,h_1133,al_c,q_90,enc_auto/file.jpg",
        "role": "Brand Identity / Packaging",
        "scope": "Identity · Packaging · Illustration",
    },
    {
        "slug": "museum-of-failure",
        "title": "Museum\nof Failure",
        "category": "Exhibition Branding + Experiential",
        "tagline": "an exhibition built to celebrate the misses",
        "hero_img": "https://static.wixstatic.com/media/31c583_76946c45c93b4591bd742eb96f4408c9~mv2.jpg/v1/fill/w_1920,h_1440,al_c,q_90,enc_auto/file.jpg",
        "role": "Art Direction / Fabrication",
        "scope": "Exhibition · Environmental · Print",
    },
    {
        "slug": "2b-farming",
        "title": "2B\nFarming",
        "category": "Brand Identity + Photography",
        "tagline": "rooted in the land, built to last",
        "hero_img": "assets/img/2b-farming/2b-farming-hero.jpg",
        "role": "Brand Identity / Art Direction",
        "scope": "Identity · Photography · Print",
    },
    {
        "slug": "rabbit-hole-wines",
        "title": "Rabbit Hole\nWines",
        "category": "Brand Identity + Packaging",
        "tagline": "follow it all the way down",
        "hero_img": "assets/img/rabbit-hole-wines/rabbit-hole-wines-5.jpg",
        "role": "Brand Identity / Packaging",
        "scope": "Identity · Label Design · Illustration",
    },
    {
        "slug": "tame-impala",
        "title": "Tame\nImpala",
        "category": "Poster Design + Illustration",
        "tagline": "psychedelia, pushed through print",
        "hero_img": "assets/img/tame-impala/tame-impala-hero.jpg",
        "role": "Illustration / Poster Design",
        "scope": "Print · Illustration · Screenprint",
    },
    {
        "slug": "ashwood-tattoo-studios",
        "title": "Ashwood\nTattoo Studio",
        "category": "Brand Identity",
        "tagline": "a mark worth wearing",
        "hero_img": "assets/img/ashwood-tattoo-studios/ashwood-logo-a.jpg",
        "role": "Brand Identity / Art Direction",
        "scope": "Identity · Motion · Print",
    },
    {
        "slug": "experiments",
        "title": "Selected\nExperiments",
        "category": "3D • Sculpture • Fabrication",
        "tagline": "the lab — where the next thing gets made",
        "hero_img": "assets/img/experiments/exp-05-magitrax.jpg",
        "role": "Everything / All at once",
        "scope": "3D · Sculpture · Fabrication · Packaging",
    },
]

# ---------------------------------------------------------------------------
# SHARED FRAGMENTS
# ---------------------------------------------------------------------------

ARROW_SVG = '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 13L13 1M13 1H4M13 1v9" stroke="currentColor" stroke-width="1.5"/></svg>'

SOCIALS_HTML = """\
  <a href="https://www.linkedin.com/in/daneforst" target="_blank" rel="noopener" aria-label="LinkedIn">
    <svg viewBox="0 0 24 24" fill="url(#sgrad)"><path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.4 8.2h4.2V23H.4V8.2zm7.1 0h4v2h.06c.56-1.06 1.93-2.18 3.97-2.18 4.25 0 5.03 2.8 5.03 6.44V23h-4.2v-7.4c0-1.77-.03-4.05-2.47-4.05-2.47 0-2.85 1.93-2.85 3.92V23H7.5V8.2z"/></svg>
  </a>
  <a href="https://www.instagram.com/dan3_4st" target="_blank" rel="noopener" aria-label="Instagram @dan3_4st">
    <svg viewBox="0 0 24 24" fill="none" stroke="url(#sgrad)" stroke-width="2"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.6" cy="6.4" r="1.4" fill="url(#sgrad)" stroke="none"/></svg>
  </a>
  <a href="https://www.youtube.com/@baronminker656" target="_blank" rel="noopener" aria-label="YouTube">
    <svg viewBox="0 0 24 24" fill="url(#sgrad)"><path d="M23.5 7.2a3 3 0 0 0-2.1-2.1C19.5 4.5 12 4.5 12 4.5s-7.5 0-9.4.6A3 3 0 0 0 .5 7.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-4.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>
  </a>"""

SGRAD_DEF = """\
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs><linearGradient id="sgrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff8330"/><stop offset="1" stop-color="#ff4d8c"/>
  </linearGradient></defs>
</svg>"""

FOOT_META = """\
  <div class="meta-row" style="margin-top:1.6rem;padding-top:1.2rem;border-top:1px solid var(--line-light);display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;font-family:var(--mono);font-size:.7rem;text-transform:uppercase;letter-spacing:.13em;color:rgba(228,224,212,.65)">
    <span>© 2026 DEF Studios</span>
    <a href="mailto:daneforst@gmail.com">daneforst@gmail.com</a>
    <a href="tel:6613033945">661·303·3945</a>
    <span>Portland, Oregon</span>
  </div>"""

SCRIPTS = """\
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>"""

FONTS = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap'

# ---------------------------------------------------------------------------
# NAV BUILDERS
# ---------------------------------------------------------------------------

def build_wd_block(prefix, active_slug=None):
    """Build the .wd drawer block. prefix is '' for root pages, '../' for work/."""
    total = len(PROJECTS)
    rows = ""
    for i, p in enumerate(PROJECTS):
        n = i + 1
        active = ' active' if p["slug"] == active_slug else ""
        rows += (
            f'<a class="wd-row{active}" href="{prefix}work/{p["slug"]}.html">'
            f'<span class="n">{n:02d}</span>'
            f'<span class="t">{p["title"].replace(chr(10), " ")}</span>'
            f'<span class="c">{p["category"]}</span></a>'
        )
    return (
        f'\n<div class="wd" id="wd">\n'
        f'{rows}\n'
        f'  <div class="wd-foot"><span>Index — Selected Work</span><span>DEF Studios, Portland OR</span></div>\n'
        f'</div>'
    )


def build_mnav_block(prefix, active_slug=None):
    """Build the mobile nav block."""
    links = ""
    for i, p in enumerate(PROJECTS):
        n = i + 1
        links += f'<a href="{prefix}work/{p["slug"]}.html"><i>{n:02d}</i>{p["title"].replace(chr(10), " ")}</a>'
    return (
        f'\n<div class="mnav" id="mnav">\n'
        f'  <a href="{prefix}about.html">About</a>\n'
        f'  <div class="mlabel">Work — Index</div>\n'
        f'  <div class="msub">{links}</div>\n'
        f'  <a href="{prefix}galleries.html">Galleries</a>\n'
        f'  <a href="{prefix}contact.html">Contact</a>\n'
        f'  <div class="m-meta">\n'
        f'    <span class="avail-m"><span class="dot"></span>Open for work</span>\n'
        f'    <span>Portland, Oregon</span>\n'
        f'  </div>\n'
        f'</div>'
    )


def build_shared_nav(prefix, active_slug=None):
    """Return the <nav> element (same for all pages, prefix adjusts asset paths)."""
    return f"""\
<nav>
  <a class="logo" href="{prefix}index.html"><img src="{prefix}assets/img/def-logo.png" alt="DEF — Dane Erik Forst signature logo"></a>
  <ul>
    <li><a href="{prefix}about.html">About</a></li>
    <li><a class="wd-trigger" href="{prefix}index.html#work" aria-expanded="false" aria-controls="wd">Work</a></li>
    <li><a href="{prefix}galleries.html">Galleries</a></li>
    <li><a href="{prefix}contact.html">Contact</a></li>
  </ul>
  <div class="avail"><span class="dot"></span>Open for work</div>
  <button class="burger" aria-label="Open menu" aria-expanded="false" aria-controls="mnav">
    <span></span><span></span><span></span>
  </button>
</nav>"""


def full_nav_html(prefix, active_slug=None):
    """Combined nav + wd + mnav block."""
    return (
        build_shared_nav(prefix, active_slug)
        + build_wd_block(prefix, active_slug)
        + build_mnav_block(prefix, active_slug)
    )

# ---------------------------------------------------------------------------
# NAV SYNC — update existing pages in place
# ---------------------------------------------------------------------------

# Sentinel markers we inject/detect to scope the nav replacement
WD_START  = '\n<div class="wd" id="wd">'
WD_END    = '</div>'   # first </div> after wd block
MNAV_START = '\n<div class="mnav" id="mnav">'
MNAV_END   = '</div>\n'


def _replace_block(html, start_marker, end_marker, new_block):
    """Replace the content between start_marker and the matching end_marker."""
    si = html.find(start_marker)
    if si == -1:
        return html, False
    # Find the closing tag — we need the LAST </div> before the next major section
    # Use a simple depth counter from the start marker
    depth = 0
    i = si
    while i < len(html):
        if html[i:i+4] == '<div':
            depth += 1
        elif html[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                ei = i + 6
                return html[:si] + new_block + html[ei:], True
        i += 1
    return html, False


def sync_nav_in_file(path, prefix, active_slug=None, dry_run=False):
    """Read a file, replace wd + mnav blocks with fresh generated versions, write back."""
    html = path.read_text(encoding="utf-8")
    original = html

    new_wd   = build_wd_block(prefix, active_slug)
    new_mnav = build_mnav_block(prefix, active_slug)

    html, ok1 = _replace_block(html, WD_START,   '</div>', new_wd)
    html, ok2 = _replace_block(html, MNAV_START, '</div>', new_mnav)

    if html == original:
        print(f"  nav unchanged  {path.name}")
        return

    if dry_run:
        print(f"  [dry-run] would update nav  {path.name}")
        return

    path.write_text(html, encoding="utf-8")
    print(f"  nav synced     {path.name}")

# ---------------------------------------------------------------------------
# INDEX.HTML — sync panels + dots
# ---------------------------------------------------------------------------

def build_wpanels():
    total = len(PROJECTS)
    panels = ""
    for i, p in enumerate(PROJECTS):
        n = i + 1
        loading = "eager" if i == 0 else "lazy"
        title_html = p["title"].replace("\n", "<br>")
        # hero_img: if it looks like a full URL leave it; local paths stay as-is
        img_src = p["hero_img"] if p["hero_img"] else f"assets/img/{p['slug']}/{p['slug']}-hero.jpg"
        panels += f"""\
      <article class="wpanel">
        <div class="bg"><img src="{img_src}" alt="{p['title'].replace(chr(10),' ')} — {p['category']}" loading="{loading}"></div>
        <a class="content" href="work/{p['slug']}.html">
          <span class="idx">{n:02d} / {total:02d} — {p['category']}</span>
          <h3>{title_html}</h3>
          <p class="tag">{p['tagline']}</p>
          <span class="open-cue">Open case study
            {ARROW_SVG}
          </span>
        </a>
      </article>\n"""
    dots = '<i></i>' * total
    panels += f'      <div class="work-dots" aria-hidden="true"><div class="stick">{dots}</div></div>\n'
    return panels


def sync_index(dry_run=False):
    index_path = SITE_DIR / "index.html"
    html = index_path.read_text(encoding="utf-8")
    original = html

    # 1. Nav blocks
    new_wd   = build_wd_block("", None)
    new_mnav = build_mnav_block("", None)
    html, _ = _replace_block(html, WD_START,   '</div>', new_wd)
    html, _ = _replace_block(html, MNAV_START, '</div>', new_mnav)

    # 2. Work panels — replace everything between <section class="work ..."> open and </section>
    panels_new = build_wpanels()
    html = re.sub(
        r'(<section class="work[^"]*"[^>]*>\s*)(.+?)(\s*</section>)',
        lambda m: m.group(1) + "\n" + panels_new + "    " + m.group(3),
        html,
        flags=re.DOTALL
    )

    if html == original:
        print("  nav unchanged  index.html")
        return
    if dry_run:
        print("  [dry-run] would update  index.html")
        return
    index_path.write_text(html, encoding="utf-8")
    print("  synced         index.html")

# ---------------------------------------------------------------------------
# STUB GENERATOR
# ---------------------------------------------------------------------------

def build_stub(slug, idx, total, prev_proj, next_proj):
    """Generate a minimal but complete stub page for a new project."""
    p = next(x for x in PROJECTS if x["slug"] == slug)
    title_html = p["title"].replace("\n", "<br>")
    title_plain = p["title"].replace("\n", " ")
    img_dir = f"../assets/img/{slug}/"
    hero_local = f"{img_dir}{slug}-hero.jpg"

    nav_html   = build_shared_nav("../")
    wd_html    = build_wd_block("../", slug)
    mnav_html  = build_mnav_block("../", slug)

    prev_link = f'<a href="{prev_proj["slug"]}.html"><span class="dir">← Previous</span><span class="rt">{prev_proj["title"].replace(chr(10)," ")}</span></a>'
    next_link = f'<a href="{next_proj["slug"]}.html"><span class="dir">Next →</span><span class="rt">{next_proj["title"].replace(chr(10)," ")}</span></a>'

    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title_plain} — Dane Forst</title>
<meta name="description" content="{title_plain}: {p['category']} by Dane Forst.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{FONTS}" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/style.css">
</head>
<body class="pbody">
{nav_html}
{wd_html}
{mnav_html}

<header class="phero">
  <!-- EDIT: swap hero image path below (or replace <img> with a <video> tag) -->
  <img src="{hero_local}" alt="{title_plain} hero">
  <div class="ph-in">
    <span class="idx">{idx:02d} / {total:02d} — {p['category']}</span>
    <h1>{title_html}</h1>
    <p class="tag">{p['tagline']}</p>
  </div>
</header>

<section class="pad">
  <div class="pmeta reveal">
    <div><span>Role</span><b>{p['role']}</b></div>
    <div><span>Scope</span><b>{p['scope']}</b></div>
    <div><span>Studio</span><b>DEF Studios</b></div>
  </div>
  <!-- EDIT: replace placeholder copy below with the real project story -->
  <div class="psec reveal"><h2>Overview</h2><p>Project overview goes here.</p></div>
  <div class="psec reveal"><h2>Challenge</h2><p>The challenge description goes here.</p></div>
  <div class="psec reveal"><h2>Approach</h2><p>The approach description goes here.</p></div>
  <div class="psec reveal"><h2>Outcome</h2><p>The outcome description goes here.</p></div>

  <!-- EDIT: replace gallery images below with real project images -->
  <!-- GALLERY PATTERNS:
       Wide (full width):  <div class="wide reveal"><img src="{img_dir}FILENAME.jpg" alt="..." loading="lazy"></div>
       Half (paired):      <div class="reveal"><img src="{img_dir}FILENAME.jpg" alt="..." loading="lazy"></div>
       Tall (portrait):    <div class="reveal tall"><img src="{img_dir}FILENAME.jpg" alt="..." loading="lazy"></div>
       Video (local mp4):  <div class="pvideo reveal">
                             <div class="pvideo-wrap">
                               <video autoplay muted loop playsinline>
                                 <source src="../assets/video/{slug}/FILENAME.mp4" type="video/mp4">
                               </video>
                             </div>
                             <p class="pvideo-cap">Caption here</p>
                           </div>
  -->
  <div class="pgallery">
    <div class="wide reveal"><img src="{hero_local}" alt="{title_plain} — hero" loading="lazy"></div>
  </div>
</section>

<div class="related" role="navigation" aria-label="More projects">
  {prev_link}
  {next_link}
</div>

<footer class="foot-slim">
  {SGRAD_DEF}
  <img class="sig" src="../assets/img/def-logo.png" alt="Dane Erik Forst signature">
  <div class="socials">
{SOCIALS_HTML}
</div>
{FOOT_META}
</footer>

{SCRIPTS}
<script src="../assets/js/main.js"></script>
</body>
</html>
"""

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    dry_run  = "--dry-run"  in sys.argv
    nav_only = "--nav-only" in sys.argv

    if dry_run:
        print("=== DRY RUN — no files will be written ===\n")

    total = len(PROJECTS)
    work_dir = SITE_DIR / "work"
    work_dir.mkdir(parents=True, exist_ok=True)

    # ── 1. Sync nav in index.html ──────────────────────────────────────────
    print("index.html")
    sync_index(dry_run=dry_run)

    # ── 2. Sync nav in about.html + contact.html ───────────────────────────
    for fname in ("about.html", "contact.html"):
        fpath = SITE_DIR / fname
        if fpath.exists():
            print(fname)
            sync_nav_in_file(fpath, prefix="", active_slug=None, dry_run=dry_run)

    # ── 3. Process each work page ──────────────────────────────────────────
    print(f"\nwork/ ({total} projects)")
    for i, p in enumerate(PROJECTS):
        slug     = p["slug"]
        idx      = i + 1
        page     = work_dir / f"{slug}.html"
        bak      = work_dir / f"{slug}.html.bak"
        prev_p   = PROJECTS[(i - 1) % total]
        next_p   = PROJECTS[(i + 1) % total]

        if page.exists():
            # Always sync nav, even in completed pages
            sync_nav_in_file(page, prefix="../", active_slug=slug, dry_run=dry_run)
        elif nav_only:
            print(f"  skipped (no file)  {slug}.html")
        else:
            # New stub — only write if no .html exists yet
            print(f"  generating stub    {slug}.html")
            if not dry_run:
                stub = build_stub(slug, idx, total, prev_p, next_p)
                page.write_text(stub, encoding="utf-8")
                # Auto-save a .bak so the stub itself is protected from future runs
                # REMOVE the .bak when you're ready to allow the generator to touch it again
                # (you won't need to — just edit the .html directly)

    # ── 4. Summary ────────────────────────────────────────────────────────
    print(f"\n✓  Done — {total} projects, {'dry run only' if dry_run else 'files updated'}.")
    print("   To add a project: edit PROJECTS list, run again.")
    print("   To protect a completed page: cp site/work/<slug>.html site/work/<slug>.html.bak")


if __name__ == "__main__":
    main()
