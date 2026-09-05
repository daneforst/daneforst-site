/* ---------------------------------------------------------------
   app.js: the shell. Splash, tabs, menu, dish sheet, table ticket,
   and a small "kitchen" panel so the 86 board can be demoed live.
   No backend: everything persists to localStorage.
   --------------------------------------------------------------- */
(function () {
  'use strict';

  /* ---- the menu, copied verbatim from the July 27 flyer ---------------
     `say` and `about` are additions for the app; `note` is a slot for the
     chef's own words. Nothing here overwrites the printed menu copy.     */
  var MENU = [
    {
      section: 'APPETIZERS',
      items: [
        {
          id: 'lortcha',
          name: 'LORT CHA',
          tags: ['v'],
          desc: 'stir-fried pin noodles, mushrooms, bean sprouts, garlic chives, dark soy',
          say: 'lort chah',
          about: 'The street-cart stir-fry. Short, chewy pin noodles go into a screaming wok so the outsides char while the middles stay springy.'
        },
        {
          id: 'poat',
          name: 'POAT',
          tags: ['gf', 'vgn'],
          desc: 'corn ribs, shishito peppers, coconut cream, scallions',
          say: 'poh-at',
          about: 'Poat is corn. Cut into ribs it curls and crisps at the edges, and the coconut cream sits underneath to cool the shishitos.'
        },
        {
          id: 'sachko',
          name: 'SACH-KO ANG',
          tags: ['gf'],
          desc: 'grilled lemongrass beef skewers,chrok khmer-style pickles',
          say: 'sahk koh ahng',
          about: 'Sach ko is beef, ang is grilled. Lemongrass marinade, live coals, and chrok pickles cutting straight through the fat.'
        }
      ]
    },
    {
      section: 'ENTRÉES',
      note: 'includes rice',
      items: [
        {
          id: 'slabmuon',
          name: 'SLAB MUON BAOK',
          tags: ['gf'],
          desc: 'stuffed chicken wing, lemongrass pork sausage, beanthread vermicelli',
          say: 'slap moo-un bawk',
          about: 'A wing boned out by hand, packed with sausage and vermicelli, then fried back to shape. Patient cooking, one wing at a time.'
        },
        {
          id: 'prahet',
          name: 'PRAHET TREI ANG',
          tags: ['gf'],
          desc: 'banana leaf-wrapped fried fish cakes, green mango salad',
          say: 'pra-het trei ahng',
          about: 'Fish cakes wrapped in banana leaf so they steam as they fry. Green mango salad on the side to keep every bite sharp.'
        }
      ]
    }
  ];

  var TAG_LABEL = { v: 'vegetarian', gf: 'gluten free', vgn: 'vegan' };

  var ALL = MENU.reduce(function (a, s) { return a.concat(s.items); }, []);
  var byId = {};
  ALL.forEach(function (i) { byId[i.id] = i; });

  /* ---- state ---------------------------------------------------------- */
  var state = { table: {}, sold: {}, code: null };

  function load() {
    try {
      state.table = JSON.parse(localStorage.getItem('vv_table') || '{}');
      state.sold = JSON.parse(localStorage.getItem('vv_sold') || '{}');
      state.code = localStorage.getItem('vv_code');
    } catch (e) { /* first run, or storage blocked */ }
  }
  function save() {
    try {
      localStorage.setItem('vv_table', JSON.stringify(state.table));
      localStorage.setItem('vv_sold', JSON.stringify(state.sold));
      if (state.code) localStorage.setItem('vv_code', state.code);
    } catch (e) {}
  }

  function tableCount() {
    return Object.keys(state.table).reduce(function (n, k) { return n + state.table[k]; }, 0);
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- menu ----------------------------------------------------------- */
  function tagChips(tags) {
    return tags.map(function (t) {
      return '<span class="chip" title="' + TAG_LABEL[t] + '">' + t + '</span>';
    }).join('');
  }

  function renderMenu() {
    var host = $('#menuList');
    host.innerHTML = MENU.map(function (sec) {
      return '' +
        '<div class="sec">' +
          '<div class="sec-head">' +
            '<h2>' + sec.section + '</h2>' +
            (sec.note ? '<span class="sec-note">' + sec.note + '</span>' : '') +
          '</div>' +
          sec.items.map(dishRow).join('') +
        '</div>';
    }).join('');
  }

  function dishRow(d) {
    var sold = !!state.sold[d.id];
    var n = state.table[d.id] || 0;
    return '' +
      '<article class="dish' + (sold ? ' is-sold' : '') + '" data-id="' + d.id + '">' +
        '<button class="dish-open" data-open="' + d.id + '" aria-label="Details for ' + d.name + '">' +
          '<h3>' + d.name + ' ' + tagChips(d.tags) + (sold ? '<span class="chip chip-86">86’d</span>' : '') + '</h3>' +
          '<p>' + d.desc + '</p>' +
          '<span class="say">say it / ' + d.say + '</span>' +
        '</button>' +
        '<div class="dish-add">' +
          (n ? '<button class="qty-btn" data-dec="' + d.id + '" aria-label="Remove one">−</button><span class="qty">' + n + '</span>' : '') +
          '<button class="add" data-add="' + d.id + '"' + (sold ? ' disabled' : '') + ' aria-label="Add ' + d.name + ' to my table">' +
            (sold ? 'off' : '+') +
          '</button>' +
        '</div>' +
      '</article>';
  }

  function refreshCounts() {
    renderMenu();
    var n = tableCount();
    var fab = $('#tableFab');
    fab.classList.toggle('show', n > 0);
    $('#fabCount').textContent = n;
    save();
  }

  /* ---- dish sheet ----------------------------------------------------- */
  function openDish(id) {
    var d = byId[id];
    var sold = !!state.sold[id];
    $('#sheetBody').innerHTML = '' +
      '<span class="eyebrow">' + (MENU[0].items.indexOf(d) > -1 ? 'appetizer' : 'entrée') + '</span>' +
      '<h2 class="sheet-title">' + d.name + '</h2>' +
      '<p class="sheet-say">' + d.say + '</p>' +
      '<div class="sheet-tags">' + tagChips(d.tags) +
        (sold ? '<span class="chip chip-86">86’d tonight</span>' : '') + '</div>' +
      '<p class="sheet-desc">' + d.desc + '</p>' +
      '<div class="rule"></div>' +
      '<p class="sheet-about">' + d.about + '</p>' +
      '<div class="note-slot"><span>chef’s note</span>' +
        '<p>Vanny’s own line about this dish drops in here. Where the recipe came from, who taught it to him, what to eat it with.</p>' +
      '</div>' +
      (sold ? '' : '<button class="btn btn-primary" data-add="' + id + '">Add to my table</button>');
    document.body.classList.add('sheet-open');
    $('#sheet').classList.add('open');
  }

  function closeSheet() {
    document.body.classList.remove('sheet-open');
    $('#sheet').classList.remove('open');
    $('#ticket').classList.remove('open');
  }

  /* ---- ticket --------------------------------------------------------- */
  function makeCode() {
    var s = 'ACDEFHJKLMNPRTUVWXY3479';
    var out = '';
    for (var i = 0; i < 4; i++) out += s.charAt(Math.floor(Math.random() * s.length));
    return 'VV-' + out;
  }

  function openTicket() {
    if (!state.code) { state.code = makeCode(); save(); }
    var rows = Object.keys(state.table).filter(function (k) { return state.table[k] > 0; });
    var cleared = false;
    try { cleared = localStorage.getItem('vv_cleared') === '1'; } catch (e) {}

    $('#ticketBody').innerHTML = '' +
      '<div class="tk-head">' +
        '<img src="assets/img/seal.png" alt="" class="tk-seal">' +
        '<div><span class="eyebrow">hand this to the counter</span>' +
        '<h2 class="sheet-title">MY TABLE</h2></div>' +
      '</div>' +
      '<div class="tk-code">' + state.code + '</div>' +
      (rows.length
        ? '<ul class="tk-list">' + rows.map(function (k) {
            return '<li><span class="tk-q">' + state.table[k] + '×</span>' +
                   '<span class="tk-n">' + byId[k].name + '</span></li>';
          }).join('') + '</ul>'
        : '<p class="tk-empty">Nothing on the table yet.</p>') +
      (cleared
        ? '<div class="tk-perk"><span class="eyebrow">arcade reward</span>' +
          '<p>Cleared THE PASS. Good for one free side, just show this screen.</p></div>'
        : '<div class="tk-perk tk-perk-off"><span class="eyebrow">arcade reward</span>' +
          '<p>Clear THE PASS in the arcade and a free side unlocks here.</p></div>') +
      '<p class="tk-fine">Demo build. No payment is taken in the app: the counter reads the code, rings it in, and hands the food over.</p>' +
      '<button class="btn btn-ghost" id="clearTable">Clear the table</button>';

    document.body.classList.add('sheet-open');
    $('#ticket').classList.add('open');
  }

  /* ---- kitchen (86 board demo) ---------------------------------------- */
  function renderKitchen() {
    $('#kitchenList').innerHTML = ALL.map(function (d) {
      var on = !!state.sold[d.id];
      return '<label class="sw' + (on ? ' on' : '') + '">' +
        '<span>' + d.name + '</span>' +
        '<input type="checkbox" data-sold="' + d.id + '"' + (on ? ' checked' : '') + '>' +
        '<span class="sw-track"><span class="sw-knob"></span></span>' +
      '</label>';
    }).join('');
  }

  /* ---- splash walk ---------------------------------------------------- */
  function splashWalk() {
    var cv = $('#walkCanvas');
    if (!cv || !window.VVSprite) return;
    // half-size buffer, upscaled 2x by CSS so the pixels stay chunky
    var w = 120, h = 28;
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var x = -16, t = 0;
    (function step() {
      if (!document.body.classList.contains('splash-on')) return;
      t++;
      x += 0.3;
      if (x > w + 16) x = -16;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(155,156,158,0.3)';
      ctx.fillRect(0, 26, w, 1);
      var f = (Math.floor(t / 9) % 2) ? 'run1' : 'run2';
      VVSprite.draw(ctx, f, Math.round(x), 6, 1, false);
      VVSprite.drawSword(ctx, Math.round(x) + 12, 19, 1, false, false, false);
      requestAnimationFrame(step);
    })();
  }

  /* ---- nav ------------------------------------------------------------ */
  function show(view) {
    $$('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'view-' + view); });
    $$('.tab').forEach(function (b) {
      var on = b.getAttribute('data-view') === view;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.documentElement.setAttribute('data-vv-view', view);
    window.scrollTo(0, 0);
    if (view === 'arcade') {
      window.VVGame.start($('#gameCanvas'), $('#pad'), {
        onWin: function () { $('#arcadeWin').classList.add('show'); }
      });
    } else if (window.VVGame) {
      window.VVGame.stop();
    }
  }

  /* ---- wire up -------------------------------------------------------- */
  function init() {
    document.body.classList.add('splash-on');
    load();
    renderMenu();
    renderKitchen();
    refreshCounts();
    splashWalk();

    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-add],[data-dec],[data-open],[data-view],[data-close]');
      if (!el || el === document.body || el === document.documentElement) return;
      var id;
      if ((id = el.getAttribute('data-add'))) {
        if (state.sold[id]) return;
        state.table[id] = (state.table[id] || 0) + 1;
        refreshCounts();
        if ($('#sheet').classList.contains('open')) closeSheet();
        bump();
      } else if ((id = el.getAttribute('data-dec'))) {
        state.table[id] = Math.max(0, (state.table[id] || 0) - 1);
        if (!state.table[id]) delete state.table[id];
        refreshCounts();
      } else if ((id = el.getAttribute('data-open'))) {
        openDish(id);
      } else if (el.getAttribute('data-view')) {
        show(el.getAttribute('data-view'));
      } else if (el.hasAttribute('data-close')) {
        closeSheet();
      }
    });

    document.addEventListener('change', function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-sold');
      if (!id) return;
      if (e.target.checked) state.sold[id] = 1; else delete state.sold[id];
      save();
      renderKitchen();
      refreshCounts();
    });

    $('#tableFab').addEventListener('click', openTicket);
    $('#scrim').addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSheet();
    });
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'clearTable') {
        state.table = {}; state.code = null;
        try { localStorage.removeItem('vv_code'); } catch (err) {}
        refreshCounts(); closeSheet();
      }
    });

    $('#enter').addEventListener('click', function () {
      document.body.classList.remove('splash-on');
      $('#splash').classList.add('gone');
      show('menu');
    });

    $('#arcadeReplay').addEventListener('click', function () {
      $('#arcadeWin').classList.remove('show');
      window.VVGame.restart();
    });
    $('#arcadeTicket').addEventListener('click', function () {
      $('#arcadeWin').classList.remove('show');
      openTicket();
    });
  }

  function bump() {
    var f = $('#tableFab');
    f.classList.remove('bump');
    void f.offsetWidth;
    f.classList.add('bump');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
