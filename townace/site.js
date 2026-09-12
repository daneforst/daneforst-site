/*
 * THE ROYALE - page controller
 *
 * Three jobs:
 *   1. the faux-interactive breakdown viewer (one component, six states, data below)
 *   2. the road journal grid
 *   3. booting the real Three.js prototype, lazily, only when it is asked for
 *
 * Callout coordinates are authored in IMAGE space (percent of the original
 * photograph, origin top left). mapCover() converts them into frame space at
 * runtime using the image's own aspect ratio, so a plate stays annotated
 * correctly at every breakpoint and survives being swapped for a render of a
 * different shape.
 */

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ========================================================== STATE DATA ===
 * Drop a real render into assets/renders/ under the same filename and it
 * replaces the plate with no other change. `source` labels the plate
 * honestly; `pending:true` swaps in the manifest-driven holding plate.
 */
const STATES = [
  {
    id:'assembled', idx:'01', label:'Assembled', sub:'Complete vehicle',
    icon:'M3 15h18M5 15l1.6-5.2A2 2 0 0 1 8.5 8.4h7a2 2 0 0 1 1.9 1.4L19 15M7 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
    image:'./assets/renders/royale_state_assembled.jpg',
    alt:'The Royale in full side profile on the Oregon coast, roof box and awning fitted.',
    source:'Photograph',
    caption:'Full side profile. Thule box, ARB awning, factory Skylite roof band.',
    headline:'The complete machine.',
    body:'Four and a half metres long, cab over the front axle, engine lying flat under the floor. Everything above the floor is room. Everything below it is a small truck.',
    facts:[
      ['3Y 2.0L EFI','Four cylinder'],
      ['Hi / Low 4WD','Two speed transfer'],
      ['7 seats','Three rows'],
      ['Skylite roof','Four glass panels'],
      ['4.42 m','Overall length']
    ],
    notes:[
      {x:33, y:51, side:'left',  len:76, pri:1, t:'Skylite Roof',        s:'Iconic views anywhere'},
      {x:62, y:60, side:'right', len:54, pri:2, t:'7-Seat Modular Cabin', s:'Royal Lounge chairs'},
      {x:36, y:80, side:'right', len:150,pri:2, t:'3Y 2.0L EFI',         s:'Under the floor'},
      {x:31, y:86, side:'left',  len:62, pri:1, t:'Hi / Low 4WD',        s:'Go anywhere'}
    ]
  },
  {
    id:'exploded', idx:'02', label:'Exploded', sub:'Component atlas',
    icon:'M12 2v4m0 12v4M2 12h4m12 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8M9.5 9.5h5v5h-5z',
    image:'./assets/renders/royale_state_exploded.jpg',
    alt:'Exploded technical plate: roof furniture and roof shell lifted clear, doors swung out, seats and front clip separated from the body.',
    source:'Render',
    caption:'Roof furniture lifted, doors out, front clip forward. Cycles, studio.',
    headline:'Seventy-seven parts, one idea.',
    body:'The roof carries the load, the floor carries the room, and the mechanical half stays out of the way underneath. Pulling it apart is the fastest way to see how little of a TownAce is actually vehicle.',
    facts:[
      ['96 detail objects','Modelled from photographs'],
      ['71,520 triangles','Detail pass alone'],
      ['7 systems','Roof to powertrain'],
      ['2.235 m','Wheelbase'],
      ['Cycles','Studio environment']
    ],
    notes:[
      {x:51, y:20, side:'right', len:64, pri:1, t:'Roof Furniture', s:'Box, rack, awning'},
      {x:49, y:33, side:'left',  len:78, pri:1, tone:'dark', t:'Skylite Roof', s:'Four glass panels'},
      {x:37, y:52, side:'left',  len:62, pri:2, tone:'dark', t:'Dashboard', s:'Right-hand drive'},
      {x:70, y:45, side:'right', len:56, pri:2, tone:'dark', t:'Sliding Door', s:'Easy access'},
      {x:61, y:56, side:'right', len:52, pri:3, tone:'dark', t:'Rear Lounge', s:'Swivel chairs'},
      {x:26, y:70, side:'left',  len:58, pri:1, tone:'dark', t:'Front Clip', s:'Lamps, grille, bumper'},
      {x:56, y:75, side:'right', len:60, pri:2, tone:'dark', t:'Front Suspension', s:'Torsion bar, independent'},
      {x:47, y:82, side:'left',  len:70, pri:3, tone:'dark', t:'4WD Transfer Case', s:'Hi / low range'}
    ]
  },
  {
    id:'interior', idx:'03', label:'Interior', sub:'Cabin architecture',
    icon:'M4 18v-6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6M4 18h16M7 9V6.5A1.5 1.5 0 0 1 8.5 5h7A1.5 1.5 0 0 1 17 6.5V9M12 9v9',
    image:'./assets/renders/royale_state_interior.jpg',
    alt:'The cabin seen through the raised rear hatch: gas struts, camel headliner, three rows of seats and the right-hand-drive cockpit beyond.',
    source:'Photograph',
    caption:'Hatch raised. Full cabin depth, front cockpit to rear sill.',
    headline:'A room that happens to have wheels.',
    body:'Right-hand drive, a floor shifter and a second lever beside it for the transfer case. Behind the front pair sit two Royal Lounge chairs that swivel, and a bench that folds flat. Camel velour throughout, which in 1991 was the expensive option.',
    facts:[
      ['Right hand drive','Factory, Japan market'],
      ['3 rows','Seven seats'],
      ['Royal Lounge','Swivel captain chairs'],
      ['Camel velour','Original trim'],
      ['Rear hatch','Full height, gas strut']
    ],
    notes:[
      {x:55, y:24, side:'right', len:60, pri:1, t:'Skylite Roof',   s:'Overhead glazing'},
      {x:46, y:35, side:'left',  len:78, pri:1, t:'Right-Hand Drive', s:'Cockpit forward'},
      {x:59, y:44, side:'right', len:52, pri:2, t:'Modular Seating', s:'Chairs swivel'},
      {x:28, y:63, side:'left',  len:50, pri:3, t:'Rear Cabin',     s:'Aisle through'},
      {x:50, y:88, side:'left',  len:64, pri:2, t:'Lounge / Bed Zone', s:'Bench folds flat'}
    ]
  },
  {
    id:'camping', idx:'04', label:'Camping', sub:'Living configuration',
    icon:'M3 20h18M12 4 4 20M12 4l8 16M12 11l-4.5 9M12 11l4.5 9',
    image:'./assets/renders/royale_state_camping.jpg',
    alt:'The rear cabin loaded for a trip: velour lounge chairs turned, gear stacked, glass overhead.',
    source:'Photograph',
    caption:'Lounge configuration. Chairs turned, bench down, roof glass overhead.',
    headline:'Twenty seconds to a bedroom.',
    body:'The bench drops, the chairs turn round, and the hatch becomes a porch roof. It is not a camper conversion. It is a van that was designed by people who assumed you would sleep in it.',
    facts:[
      ['Bench','Folds flat to a bed'],
      ['Chairs','Swivel to face rear'],
      ['Hatch','Gas strut awning'],
      ['Overhead','Four glass panels']
    ],
    notes:[
      {x:46, y:13, side:'right', len:58, pri:1, t:'Skylite Overhead', s:'Light down the middle'},
      {x:84, y:31, side:'left',  len:56, pri:2, t:'Rear Hatch Access', s:'Load through'},
      {x:35, y:60, side:'left',  len:54, pri:2, t:'Modular Cabin',    s:'Seats reconfigure'},
      {x:61, y:79, side:'right', len:60, pri:1, t:'Bed / Lounge',     s:'Flat floor aft'}
    ]
  },
  {
    id:'4wd', idx:'05', label:'4WD', sub:'Running gear',
    icon:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM12 3v7.5M5.2 17.2l6.1-3.6M18.8 17.2l-6.1-3.6',
    image:'./assets/renders/royale_state_4wd.jpg',
    alt:'Low three-quarter view of the front of the Royale, all-terrain tyre and wheel arch filling the frame.',
    source:'Photograph',
    caption:'Low three-quarter. Front arch, all-terrain tyre, 4WD nose badge.',
    headline:'Low range, and no hurry.',
    body:'Part time four wheel drive with a real low ratio, a live rear axle and 782 mm all terrain tyres. Geared for gravel, boat ramps and the last mile of a forest road rather than for speed. It will not win anything. It arrives.',
    facts:[
      ['Transfer case','Two speed, hi and low'],
      ['Rear axle','Live'],
      ['Driveshafts','Front and rear'],
      ['Tyres','782 mm all terrain'],
      ['Engine','3Y 2.0L, under floor']
    ],
    notes:[
      {x:30, y:30, side:'left',  len:70, pri:1, t:'Hi / Low 4WD',     s:'Real capability'},
      {x:46, y:66, side:'left',  len:96, pri:2, t:'3Y EFI Engine',    s:'Flat, under the floor'},
      {x:57, y:73, side:'right', len:66, pri:1, t:'Front Suspension', s:'Built for real roads'},
      {x:68, y:82, side:'right', len:92, pri:2, t:'Transfer Case',    s:'Hi / low range'},
      {x:87, y:56, side:'left',  len:40, pri:3, t:'Rear Axle',        s:'Live, leaf sprung'}
    ]
  },
  {
    id:'skylite', idx:'06', label:'Skylite', sub:'Roof system',
    icon:'M3 11 12 4l9 7M5 11v9h14v-9M9.5 11.5c0 2 1 3.5 2.5 4.5 1.5-1 2.5-2.5 2.5-4.5',
    image:'./assets/renders/royale_state_skylite.jpg',
    alt:'Looking up at the Skylite roof: four fan-shaped glass panels set into a camel headliner.',
    source:'Photograph',
    caption:'Overhead. Four fan-shaped panels, factory camel headliner.',
    headline:'Four panes of unnecessary glass.',
    body:'The Skylite roof is the reason people stop and ask. Four fan-shaped panels set into a camel headliner, throwing light straight down the middle of the van. No engineer needed to do this. Somebody in 1991 simply thought it would be nice.',
    facts:[
      ['Panels','Four, fixed'],
      ['Glazing','Tinted, bronze'],
      ['Headliner','Camel, original'],
      ['Roof band','Factory Skylite decal']
    ],
    notes:[
      {x:53, y:19, side:'right', len:34, pri:2, tone:'dark', t:'Raised Roof Geometry', s:'Structure carries the glass'},
      {x:31, y:46, side:'left',  len:26, pri:1, tone:'dark', t:'Panoramic Glass',      s:'Fan-shaped panels'},
      {x:72, y:41, side:'right', len:28, pri:1, tone:'dark', t:'Skylite Roof',         s:'The signature system'},
      {x:50, y:73, side:'left',  len:56, pri:3, tone:'dark', t:'Observatory Mood',     s:'Light down the aisle'}
    ]
  }
];

/* ======================================================= ROAD JOURNAL ===
 * Captions describe only what is in the frame. `place` is deliberately
 * low-specificity: edit these strings to name the real spots.
 */
const JOURNAL = [
  { cls:'jr--wide',  img:'coast_sunset.jpg',    place:'Oregon coast',
    alt:'The Royale on gravel at the edge of the Pacific with a sea stack offshore at sunset.',
    txt:'The lot was empty, the tide was out, and the light did that thing for about four minutes.' },
  { cls:'jr--eight', img:'river_mountains.jpg', place:'River road',
    alt:'The front half of the Royale parked facing a wide river with mountains beyond.',
    txt:'Parked nose out for the view, which is the only correct way to park.' },
  { quote:'It works as transportation, room, shelter, camping space and road trip ritual. Usually in that order, and often on the same day.',
    cite:'On the point of the thing' },
  { cls:'jr--half',  img:'side_sunny.jpg',      place:'Waterfront',
    alt:'Full side profile of the Royale in bright sun beside a river.',
    txt:'The roof carries a Thule box, an awning, and most of the personality.' },
  { cls:'jr--half',  img:'side_low.jpg',        place:'Home',
    alt:'Low side view of the Royale showing the maroon and silver pinstripe band.',
    txt:'Champagne over a maroon pinstripe. Nobody specifies this any more.' },
  { cls:'jr--third', img:'skylite_roof.jpg',    place:'Skylite roof',
    alt:'The four fan-shaped Skylite panels seen from inside the cabin.',
    txt:'Four panes of glass nobody needed to put there.' },
  { cls:'jr--tall',  img:'rear_badges.jpg',     place:'Hatch',
    alt:'The rear of the Royale showing ROYAL LOUNGE and TOWN ACE badges beside the plate.',
    txt:'ROYAL LOUNGE on one side of the plate, TOWN ACE on the other. Both true.' },
  { cls:'jr--third', img:'cabin_velour.jpg',    place:'Cabin',
    alt:'Camel velour seats in the rear cabin with a dog standing on the folded bench.',
    txt:'Seven seats, and one dog with strong opinions about the middle row.' }
];

/* ================================================== breakdown viewer === */
const frame  = $('#bvFrame');
const layers = $('#bvLayers');
const notesEl= $('#bvNotes');
const pending= $('#bvPending');
let active = 0;
const imgs = [];

function buildViewer(){
  const rail = $('#bvRail'), tabs = $('#bvTabs');

  STATES.forEach((st, i) => {
    // layer
    const img = new Image();
    img.alt = st.alt;
    img.decoding = 'async';
    if (i === 0) img.src = st.image;
    img.addEventListener('load', () => { img.dataset.ar = img.naturalWidth / img.naturalHeight; if (i === active) placeNotes(); });
    img.addEventListener('error', () => { if (!st.pending) { st.pending = true; st.source = 'Plate unavailable'; if (i === active) show(i, true); } });
    layers.appendChild(img);
    imgs.push(img);

    // left rail
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round"><path d="${st.icon}"/></svg>
      <span><em>${st.label}</em><i>${st.sub}</i></span>`;
    b.addEventListener('click', () => show(i));
    rail.appendChild(b);

    // tab bar
    const t = document.createElement('button');
    t.type = 'button'; t.role = 'tab'; t.textContent = st.label;
    t.addEventListener('click', () => show(i));
    tabs.appendChild(t);
  });

  show(0, true);

  // preload the remaining plates once the page is quiet
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 900));
  idle(() => STATES.forEach((st, i) => { if (!imgs[i].src && !st.pending) imgs[i].src = st.image; }));
}

function show(i, instant){
  active = i;
  const st = STATES[i];
  if (!imgs[i].src && !st.pending) imgs[i].src = st.image;

  imgs.forEach((im, n) => im.classList.toggle('is-on', n === i && !st.pending));
  $$('#bvRail button').forEach((b, n) => b.classList.toggle('is-on', n === i));
  $$('#bvTabs button').forEach((b, n) => { b.classList.toggle('is-on', n === i); b.setAttribute('aria-selected', n === i); });

  $('#bvIdx').textContent  = st.idx;
  $('#bvCap').textContent  = st.caption;
  $('#bvSrc').textContent  = st.source;
  $('#bvHead').textContent = st.headline;
  $('#bvBody').textContent = st.body;
  $('#bvFacts').innerHTML  = st.facts.map(f => `<li><b>${f[0]}</b><span>${f[1]}</span></li>`).join('');

  pending.hidden = !st.pending;
  if (st.pending) drawPending();

  notesEl.innerHTML = '';
  st.notes.forEach((n, k) => {
    const el = document.createElement('div');
    el.className = 'bv-note';
    el.dataset.side = n.side || 'right';
    el.dataset.pri  = n.pri  || 1;
    if (n.tone) el.dataset.tone = n.tone;
    el.style.setProperty('--len', (n.len || 52) + 'px');
    el.innerHTML = `<i class="bv-dot"></i><i class="bv-lead"></i>
      <span class="bv-txt"><b>${n.t}</b><em>${n.s}</em></span>`;
    notesEl.appendChild(el);
    const delay = instant || REDUCED ? 0 : 220 + k * 90;
    setTimeout(() => el.classList.add('is-in'), delay);
  });
  placeNotes();
}

/* image-space percent -> frame-space percent, accounting for object-fit:cover */
function mapCover(x, y, ar, fr){
  if (!ar || !fr) return [x, y];
  if (ar > fr){                       // image wider than frame: cropped left/right
    const vis = fr / ar;
    return [ (x/100 - (1 - vis)/2) / vis * 100, y ];
  }
  const vis = ar / fr;                // taller than frame: cropped top/bottom
  return [ x, (y/100 - (1 - vis)/2) / vis * 100 ];
}

function placeNotes(){
  const st = STATES[active];
  if (!st.notes.length) return;
  const r = frame.getBoundingClientRect();
  const fr = r.width / r.height;
  const ar = Number(imgs[active].dataset.ar) || fr;
  Array.from(notesEl.children).forEach((el, k) => {
    const n = st.notes[k];
    const [x, y] = mapCover(n.x, n.y, ar, fr);
    el.style.left = x + '%';
    el.style.top  = y + '%';
    el.dataset.side = n.side || 'right';
    el.style.setProperty('--len', (n.len || 52) + 'px');
  });
  // A plate can be swapped for a render of another shape, and the frame
  // narrows on small screens, so labels are kept inside the frame here
  // rather than by hand-tuning every coordinate.
  const f = frame.getBoundingClientRect();
  Array.from(notesEl.children).forEach((el, k) => {
    const pad = 10;
    let r = el.getBoundingClientRect();
    if (r.left < f.left + pad || r.right > f.right - pad){
      el.dataset.side = el.dataset.side === 'left' ? 'right' : 'left';
      r = el.getBoundingClientRect();
    }
    if (r.left < f.left + pad || r.right > f.right - pad){
      el.style.setProperty('--len', '14px');
      r = el.getBoundingClientRect();
    }
    if (r.right > f.right - pad) el.style.left =
      ((r.left - f.left - (r.right - (f.right - pad))) / f.width * 100) + '%';
  });
}
if (window.ResizeObserver) new ResizeObserver(placeNotes).observe(frame);
addEventListener('resize', placeNotes);

/* holding plate for a state with no render yet: real manifest data, drawn */
let manifest = null, drawn = false;
async function drawPending(){
  if (drawn) return;
  drawn = true;
  pending.innerHTML = '<div class="ghost"></div>';
  const wrap = document.createElement('div');
  wrap.className = 'bv-strata';
  pending.appendChild(wrap);

  const ORDER = [
    ['roof',      'Roof + accessories'],
    ['exterior',  'Body + glazing'],
    ['cabin',     'Cabin'],
    ['electrical','Lighting'],
    ['chassis',   'Chassis + wheels'],
    ['powertrain','Powertrain']
  ];
  try {
    manifest = manifest || await (await fetch('./model/royale_manifest.json')).json();
  } catch { manifest = { components: [] }; }

  const groups = {};
  for (const c of manifest.components || []){
    const g = groups[c.category] || (groups[c.category] = { n:0, travel:0 });
    g.n++;
    const e = c.explode || [0, 0, 0];          // manifest stores [x, y, z]
    g.travel = Math.max(g.travel, Math.hypot(e[0] || 0, e[1] || 0, e[2] || 0));
  }
  const max = Math.max(0.001, ...Object.values(groups).map(g => g.travel));

  ORDER.forEach(([key, name]) => {
    const g = groups[key] || { n:0, travel:0 };
    const row = document.createElement('div');
    row.className = 'bv-stratum';
    row.innerHTML = `<h4>${name}</h4><div class="bv-bar"><span></span></div>`
      + `<b>${g.n} <i>&middot;</i> ${g.travel.toFixed(2)} m</b>`;
    wrap.appendChild(row);
    requestAnimationFrame(() => {
      row.querySelector('span').style.width = Math.max(4, (g.travel / max) * 100) + '%';
    });
  });

  const note = document.createElement('p');
  note.className = 'bv-pending-note';
  note.textContent = 'Separation authored per component in Blender. Bar length is travel distance. '
    + 'Drop royale_state_exploded.jpg into assets/renders/ to replace this plate.';
  pending.appendChild(note);
}

/* enlarge */
$('#bvFull').addEventListener('click', () => {
  const st = STATES[active];
  if (st.pending) return;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = `<img src="${st.image}" alt="${st.alt}"><button class="lightbox-x" aria-label="Close">Close</button>`;
  const close = () => { box.remove(); removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  box.addEventListener('click', close);
  addEventListener('keydown', esc);
  document.body.appendChild(box);
  box.querySelector('button').focus();
});

/* keyboard: 1-6 selects a plate while the viewer is the thing on screen */
addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  const n = Number(e.key);
  if (!(n >= 1 && n <= STATES.length)) return;
  const r = frame.getBoundingClientRect();
  if (r.top < innerHeight * 0.8 && r.bottom > innerHeight * 0.2) show(n - 1);
});

buildViewer();

/* ========================================================= journal === */
$('#jrGrid').innerHTML = JOURNAL.map(j => {
  if (j.quote) return `<blockquote class="jr-quote rv"><p>${j.quote}</p><span>${j.cite}</span></blockquote>`;
  return `<figure class="jr ${j.cls} rv">
    <div class="jr-media"><img src="./assets/photos/${j.img}" alt="${j.alt}" loading="lazy" decoding="async"></div>
    <figcaption><span class="jr-txt">${j.txt}</span><span class="jr-place">${j.place}</span></figcaption>
  </figure>`;
}).join('');

/* ======================================================== masthead === */
const mast = $('#mast');
const onScroll = () => mast.classList.toggle('is-stuck', scrollY > 40);
onScroll();
addEventListener('scroll', onScroll, { passive:true });

const toggle = $('#mastToggle'), drawer = $('#mastDrawer');
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  drawer.hidden = open;
});
drawer.addEventListener('click', e => {
  if (e.target.tagName === 'A'){ drawer.hidden = true; toggle.setAttribute('aria-expanded','false'); }
});

/* active section in the nav */
const navLinks = new Map($$('.mast-nav a').map(a => [a.dataset.nav, a]));
const secObs = new IntersectionObserver(es => {
  es.forEach(e => {
    if (!e.isIntersecting) return;
    const a = navLinks.get(e.target.id);
    if (!a) return;
    navLinks.forEach(x => x.classList.remove('is-on'));
    a.classList.add('is-on');
  });
}, { rootMargin:'-45% 0px -50% 0px' });
['top','breakdown','story','journal','prototype'].forEach(id => { const el = document.getElementById(id); if (el) secObs.observe(el); });

/* ========================================================== reveal === */
$$('.section .sec-head, .story-body, .bv, .proto-note, .colo-col').forEach(el => el.classList.add('rv'));
const rvObs = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting){ e.target.classList.add('is-in'); rvObs.unobserve(e.target); } });
}, { rootMargin:'0px 0px -8% 0px' });
$$('.rv').forEach(el => rvObs.observe(el));

/* ================================================== MASTER ACE deck === */
(function deck(){
  const btn = $('#deck'), read = $('#deckRead'), note = $('#deckNote');
  let on = false, t = 0, timer = null;
  btn.addEventListener('click', () => {
    on = !on;
    btn.setAttribute('aria-pressed', String(on));
    note.hidden = !on;
    clearInterval(timer);
    if (!on){ read.textContent = 'A / 000'; return; }
    t = 0;
    const tick = () => { t++; read.textContent = 'A / ' + String(t).padStart(3,'0'); };
    tick();
    if (!REDUCED) timer = setInterval(tick, 1000);
  });
})();

/* ============================================ the real 3D prototype ===
 * atlas.js is the working development model. It is a heavy module with a
 * GLB behind it, so it is only imported once someone asks for it, and the
 * canvas keeps `touch-action: pan-y` until then so the page still scrolls.
 */
(function prototype(){
  const gate = $('#protoGate'), go = $('#protoGo'), host = $('#proto');
  let booted = false;

  async function boot(){
    if (booted) return; booted = true;
    gate.classList.add('gone');
    host.classList.add('is-live');
    try {
      const atlas = await import('./atlas.js');
      // Wheel-zoom would otherwise swallow the page scroll, so it is only
      // live while the pointer is actually working the model.
      if (atlas.controls){
        const c = atlas.controls;
        c.enableZoom = false;
        const cv = $('#scene');
        cv.addEventListener('pointerenter', () => { c.enableZoom = true; });
        cv.addEventListener('pointerleave', () => { c.enableZoom = false; });
      }
    } catch (err){
      gate.classList.remove('gone');
      go.textContent = 'Model could not load';
      console.error(err);
    }
  }
  go.addEventListener('click', boot);

  // The model sits directly under the hero now, so it starts on its own as
  // the reader arrives rather than waiting behind a button. The gate stays in
  // the markup purely as a fallback if the import fails.
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)){ io.disconnect(); boot(); }
    }, { rootMargin: '300px 0px' });
    io.observe(host);
  } else {
    boot();
  }

  const cta = $('.bv-cta');
  if (cta) cta.addEventListener('click', () => setTimeout(boot, 700));
})();
