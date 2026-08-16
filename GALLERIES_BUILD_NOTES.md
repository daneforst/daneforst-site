# Galleries build notes

New **Galleries** section for daneerikforst.com: a landing page of category tiles,
a reusable category-page template, and a home-page teaser. Built to match the
existing editorial system (Instrument Serif / Archivo / IBM Plex Mono, soot
background, sun-to-rose accents) and to reuse the case-study magazine layout.

---

## Before this goes live: export MP4s (and ideally poster stills)

The footage is currently **WebM only**, but Safari and iOS don't reliably play
WebM. Every `<video>` on these pages is already wired for both formats:

```html
<video ...>
  <source src="....webm" type="video/webm">   <!-- played by Chrome/Firefox/Edge -->
  <source src="....mp4"  type="video/mp4">    <!-- fallback for Safari/iOS -->
</video>
```

**Nothing plays until the files exist.** For each clip you need to drop **two**
web-optimized files (a `.webm` and a `.mp4`) into `assets/video/galleries/...`,
using the exact names in `assets/video/galleries/README.txt`. Poster stills
(`.jpg`) are optional but recommended (see `assets/img/galleries/README.txt`).

Source note: the raw exports in `~/Documents/Animos Portfolio Gallery Videos/`
run from about 30 to 115 MB each, which is far too big for GitHub (100 MB hard
limit) and slow on the web. Compress and resize them down to roughly the size of
the existing case-study clips (about 1 to 10 MB) before adding them here.

### Suggested source-to-target mapping (adjust freely)

Each target needs a `.webm` **and** a `.mp4`.

| Target file                          | Suggested source clip (from your Animos folder) |
|--------------------------------------|--------------------------------------------------|
| `album-art/album-art-teaser`         | `WINNERS/album art wide wheel-carousel-2160p.webm` (the wheel/carousel) |
| `album-art/album-art-01`             | `WINNERS/Album Art 4-1800p_Single Slide.webm` |
| `album-art/album-art-02`             | `WINNERS/Album Art 3-1440pWIDE.webm` |
| `album-art/album-art-03`             | `WINNERS/Album Art 4-1440p.webm` |
| `key-art/key-art-teaser`             | `WINNERS/Key Art 1-1440p wide .webm` |
| `key-art/key-art-01`                 | `WINNERS/Instagram/Key Art 2-2560p.webm` |
| `key-art/key-art-02`                 | `WINNERS/Instagram/KeyArt-2560p.webm` |
| `key-art/key-art-03`                 | `WINNERS/Instagram/KeyArt-2560p-3.webm` |
| `show-posters/show-posters-teaser`   | `WINNERS/Poster Art-1800p.webm` |
| `show-posters/show-posters-01`       | `ARCHIVE/Poster Art-1440p.webm` |
| `show-posters/show-posters-02`       | `WINNERS/Instagram/Poster Art-1800p-2.webm` |
| `show-posters/show-posters-03`       | `ARCHIVE/Poster Art-2560p.webm` |

The `-teaser` clip is the moving carousel/wheel style; it is reused in three
places (home teaser, landing tile, category-page hero). The numbered clips are
the single reveals stacked down the category page. Add or drop rows freely; the
pages hold any number of pieces.

---

## What was built / changed

**Nav (all 16 pages)** reordered to `About · Work · Galleries · Contact`. "Work"
is unchanged (same 9 case studies, same hover drawer). "Galleries" is new and now
has its **own hover/click dropdown** (`#gd`), mirroring the Work drawer, listing
Album Art / Key Art / Show Posters plus an "Index / All Galleries" link to the
landing. Only one drawer is open at a time. The mobile menu keeps a direct
Galleries link (the dropdowns are desktop-only; on mobile the landing shows the
categories as tiles).

**`galleries.html`** (new): the landing page. Grid of category tiles; launches
with Album Art, Key Art, Show Posters. The grid is auto-fill, so **Logo** and
**Various Artwork** drop in later with zero layout changes; a ready-to-uncomment
tile block for both is already in the file.

**`galleries/album-art.html`, `galleries/key-art.html`, `galleries/show-posters.html`**
(new): one reusable template (see the comment at the top of `album-art.html`).
* Case-study-style hero (teaser clip) plus intro treatment (`.project-intro` and `.psec`).
* Placeholder intro copy, **generic on purpose**, sized realistically. Replace it
  with real copy when ready; it invents no clients or claims.
* A vertical stack of reveal clips (`.gstack`, one `.gpiece` per piece). Each clip
  **autoplays muted when scrolled into view and keeps native controls**. Each
  supports an optional caption (mono label plus serif line).

**`index.html`** (home): a new "02 / Galleries" teaser section between the Work
panels and Services: one cinematic Album-Art strip linking to the gallery. It is
deliberately a contained band (not a full-viewport panel) so it doesn't compete
with the work panels. Key Art and Show Posters strips can be added the same way;
there is a comment marking where.

**`assets/css/style.css`**: one appended, commented block (`GALLERIES ...`) for
tiles, category stacks, and the home teaser. Category pages otherwise reuse the
existing `.pbody / .phero / .project-intro / .psec` case-study styles.

**`assets/js/main.js`**: the nav-dropdown handler was generalized from the single
Work drawer to drive any number of `.wd-trigger`/drawer pairs (Work and Galleries
today), so hovering one closes the other. The tiles and stacked clips otherwise
reuse the site's existing `.lazyvid` scroll-into-view autoplay behavior.

---

## Adding a new category later (e.g. Logo, Various Artwork)

1. Copy `galleries/album-art.html` to `galleries/<slug>.html`; update the title,
   hero (kicker / h1 / tag), intro copy, and the `.gpiece` blocks.
2. Uncomment (or copy) the matching tile block in `galleries.html`.
3. Optionally add a teaser strip on the home page (`index.html`).
4. Add the clips under `assets/video/galleries/<slug>/` (plus posters under
   `assets/img/galleries/<slug>/`).

---

## Testing done (Chrome, desktop 1280x720 plus mobile 375x812)

* Nav reorder verified on root and work pages; mobile menu order confirmed
  About, Work (index), Galleries, Contact.
* All routes resolve (landing, 3 category pages, tile links, hero, prev/next).
* **WebM-to-MP4 fallback confirmed** by simulating a WebM failure: with the
  `.webm` files absent, every `<video>` correctly selected the `.mp4` source
  (`currentSrc` ended in `.mp4`, `readyState` 4, no error) and played.
* Stacked category clips confirmed to carry native `controls` plus
  scroll-into-view autoplay; tile grid confirmed to auto-fill and collapse to one
  column on mobile.
* Tile / category names render in Instrument Serif; labels and indexes in IBM
  Plex Mono.

Local preview: run `python3 -m http.server 8765` from the site root, then open
`http://localhost:8765/galleries.html`.
