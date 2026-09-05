/* ---------------------------------------------------------------
   sprite.js: pixel art derived from the Van Van character.
   The source art was 32x37. These are 14x20 reductions that keep
   the reads that matter: horned hood, cream band, sword, chibi head.
   Palette is brand: black / skin / cream / maroon / tan / grey.
   --------------------------------------------------------------- */
(function (global) {
  'use strict';

  var PAL = {
    K: '#17120f', // outline + hood
    S: '#ffdbb3', // skin (sampled from the original art)
    C: '#fcf0d8', // cream (sampled from the logo)
    M: '#7a4444', // maroon shirt
    D: '#54302f', // maroon shadow
    B: '#b28758', // belt (sampled from the original art)
    G: '#9b9c9e', // grey (sampled from the logo lockup)
    W: '#6e6f71', // grey shadow
    N: '#5a3f26', // coconut dark
    T: '#8a6a3f'  // coconut light
  };

  // 14 wide. Every row must be exactly 14 characters.
  var HERO_IDLE = [
    '..K........K..',
    '.KKK......KKK.',
    '.KKKK.KK.KKKK.',
    '.KKKKKKKKKKKK.',
    '.KKCKKKKKKCKK.',
    '.KCCCCCCCCCCK.',
    '.KSSSSSSSSSSK.',
    '.KSSKSSSSKSSK.',
    '.KSSSSSSSSSSK.',
    '.KSSSKKKKSSSK.',
    '..KSSSSSSSSK..',
    '..KMMMCCMMMK..',
    '.KSMMMMMMMMSK.',
    '.KSMMMMMMMMSK.',
    '.KSMMMMMMMMSK.',
    '..KBBBBBBBBK..',
    '..KKKKKKKKKK..',
    '..KKKK..KKKK..',
    '..KKKK..KKKK..',
    '.KCCK....KCCK.'
  ];

  var HERO_RUN1 = [
    '..K........K..',
    '.KKK......KKK.',
    '.KKKK.KK.KKKK.',
    '.KKKKKKKKKKKK.',
    '.KKCKKKKKKCKK.',
    '.KCCCCCCCCCCK.',
    '.KSSSSSSSSSSK.',
    '.KSSKSSSSKSSK.',
    '.KSSSSSSSSSSK.',
    '.KSSSKKKKSSSK.',
    '..KSSSSSSSSK..',
    '..KMMMCCMMMK..',
    '.KSMMMMMMMMMK.',
    '.KSMMMMMMMMSK.',
    '..KMMMMMMMMSK.',
    '..KBBBBBBBBK..',
    '..KKKKKKKKKK..',
    '...KKKKKKKK...',
    '..KKKK...KKK..',
    '.KCCK.....KCC.'
  ];

  var HERO_RUN2 = [
    '..K........K..',
    '.KKK......KKK.',
    '.KKKK.KK.KKKK.',
    '.KKKKKKKKKKKK.',
    '.KKCKKKKKKCKK.',
    '.KCCCCCCCCCCK.',
    '.KSSSSSSSSSSK.',
    '.KSSKSSSSKSSK.',
    '.KSSSSSSSSSSK.',
    '.KSSSKKKKSSSK.',
    '..KSSSSSSSSK..',
    '..KMMMCCMMMK..',
    '.KMMMMMMMMMSK.',
    '.KSMMMMMMMMSK.',
    '.KSMMMMMMMMK..',
    '..KBBBBBBBBK..',
    '..KKKKKKKKKK..',
    '...KKKKKKKK...',
    '..KKK...KKKK..',
    '.CCK.....KCCK.'
  ];

  var HERO_JUMP = [
    '..K........K..',
    '.KKK......KKK.',
    '.KKKK.KK.KKKK.',
    '.KKKKKKKKKKKK.',
    '.KKCKKKKKKCKK.',
    '.KCCCCCCCCCCK.',
    '.KSSSSSSSSSSK.',
    '.KSSKSSSSKSSK.',
    '.KSSSSSSSSSSK.',
    '.KSSSKKKKSSSK.',
    '..KSSSSSSSSK..',
    'KSKMMMCCMMMKSK',
    '.SKMMMMMMMMKS.',
    '..KMMMMMMMMK..',
    '..KMMMMMMMMK..',
    '..KBBBBBBBBK..',
    '..KKKKKKKKKK..',
    '.KKKK....KKKK.',
    'KCCK......KCCK',
    '..............'
  ];

  // Back view for ladders: hood and shoulders, arms up on the rails.
  var HERO_CLIMB1 = [
    '..K........K..',
    '.KKK......KKK.',
    '.KKKK.KK.KKKK.',
    '.KKKKKKKKKKKK.',
    '.KKKKKKKKKKKK.',
    '.KCCCCCCCCCCK.',
    '.KKKKKKKKKKKK.',
    '.KKKKKKKKKKKK.',
    '.KKKKKKKKKKKK.',
    '.KKKKKKKKKKKK.',
    '..KKKKKKKKKK..',
    'SK.KMMMMMMK.KS',
    'SK.KMMMMMMK.KS',
    '.KMMMMMMMMMMK.',
    '.KMMMMMMMMMMK.',
    '..KBBBBBBBBK..',
    '..KKKKKKKKKK..',
    '..KKKK..KKKK..',
    '..KKKK..KKKK..',
    '.KCCK....KCCK.'
  ];

  var HERO_CLIMB2 = [
    '..K........K..',
    '.KKK......KKK.',
    '.KKKK.KK.KKKK.',
    '.KKKKKKKKKKKK.',
    '.KKKKKKKKKKKK.',
    '.KCCCCCCCCCCK.',
    '.KKKKKKKKKKKK.',
    '.KKKKKKKKKKKK.',
    '.KKKKKKKKKKKK.',
    '.KKKKKKKKKKKK.',
    '..KKKKKKKKKK..',
    '.K.KMMMMMMK.K.',
    'SK.KMMMMMMK.KS',
    'SKMMMMMMMMMMKS',
    '.KMMMMMMMMMMK.',
    '..KBBBBBBBBK..',
    '..KKKKKKKKKK..',
    '..KKKK..KKKK..',
    '.KKKK....KKKK.',
    'KCCK......KCCK'
  ];

  // The pot at the top of the line, lobbing coconuts down the girders.
  var POT = [
    '.KKKKKKKKKKKKKK.',
    '.KGGGGGGGGGGGGK.',
    '.KKKKKKKKKKKKKK.',
    'KMMMMMMMMMMMMMMK',
    'KMMCCMMMMMMCCMMK',
    'KMMCCMMMMMMCCMMK',
    'KMMMMMMMMMMMMMMK',
    'KMMMMKKKKKKMMMMK',
    'KMMMMMMMMMMMMMMK',
    '.KMMMMMMMMMMMMK.',
    '..KMMMMMMMMMMK..',
    '...KKMMMMMMKK...',
    '.....KKKKKK.....'
  ];

  // The last order on the pass, which is what you are climbing toward.
  var BOWL = [
    '....CCCC....',
    '..CCCCCCCC..',
    'GGGGGGGGGGGG',
    'GWWWWWWWWWWG',
    '.GWWWWWWWWG.',
    '..GGGGGGGG..',
    '....GGGG....'
  ];

  // Chili, the sword lighter.
  var CHILI = [
    '.C...',
    '.CC..',
    '.MM..',
    '.MMM.',
    '..MMM',
    '..MM.',
    '..M..'
  ];

  var HEART = [
    'K...K',
    'KKKKK',
    'KCCCK',
    'KSSSK',
    '.KKK.'
  ];

  var SPRITES = {
    idle: HERO_IDLE,
    run1: HERO_RUN1,
    run2: HERO_RUN2,
    jump: HERO_JUMP,
    climb1: HERO_CLIMB1,
    climb2: HERO_CLIMB2,
    pot: POT,
    bowl: BOWL,
    chili: CHILI,
    heart: HEART
  };

  function draw(ctx, name, x, y, scale, flip) {
    var f = typeof name === 'string' ? SPRITES[name] : name;
    if (!f) return;
    var s = scale || 1;
    var w = f[0].length;
    for (var r = 0; r < f.length; r++) {
      var row = f[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c);
        if (ch === '.') continue;
        var col = PAL[ch];
        if (!col) continue;
        var cx = flip ? (w - 1 - c) : c;
        ctx.fillStyle = col;
        ctx.fillRect(x + cx * s, y + r * s, s, s);
      }
    }
  }

  /* The sword is drawn rather than baked into the frames so it can swing
     and so it can light up when he grabs a chili. */
  function drawSword(ctx, hx, hy, s, flip, lit, tilt) {
    var d = flip ? -1 : 1;
    var blade = lit ? '#fcf0d8' : '#e8dcc4';
    var edge = lit ? '#ffdbb3' : '#9b9c9e';
    var i, bx, by;

    if (lit) {
      var ph = Math.floor(Date.now() / 90) % 4;
      ctx.fillStyle = 'rgba(252,240,216,0.55)';
      ctx.fillRect(hx + d * (3 + ph) * s, hy - (4 + ph) * s, s, s);
      ctx.fillRect(hx + d * (7 - ph) * s, hy - (5 - ph) * s, s, s);
    }
    // grip + guard
    ctx.fillStyle = PAL.K;
    ctx.fillRect(hx, hy, 2 * s, 2 * s);
    ctx.fillStyle = PAL.M;
    ctx.fillRect(hx - (flip ? 1 : 1) * s, hy - s, 4 * s, s);
    // blade, stepped diagonally forward and up (or forward and flat mid-swing)
    for (i = 0; i < 8; i++) {
      bx = hx + d * (i + 1) * s;
      by = hy - (tilt ? Math.round(i * 0.35) : i) * s - s;
      ctx.fillStyle = blade;
      ctx.fillRect(bx, by, s, s);
      ctx.fillStyle = edge;
      ctx.fillRect(bx, by + s, s, s);
    }
  }

  function drawCoconut(ctx, x, y, s, spin) {
    var mask = [
      '..KKKK..',
      '.KTTTTK.',
      'KTTTTTTK',
      'KTTTTTTK',
      'KTTTTTTK',
      'KTTTTTTK',
      '.KTTTTK.',
      '..KKKK..'
    ];
    draw(ctx, mask, x, y, s, false);
    // two husk stripes that travel around the shell as it rolls
    var off = ((spin % 8) + 8) % 8;
    ctx.fillStyle = PAL.N;
    for (var i = 0; i < 8; i++) {
      var rr = (i + off) % 8;
      if (rr === 2 || rr === 5) ctx.fillRect(x + s, y + i * s, 6 * s, s);
    }
    ctx.fillStyle = PAL.C;
    ctx.fillRect(x + 2 * s, y + ((off + 1) % 8) * s, 2 * s, s);
  }

  global.VVSprite = {
    PAL: PAL,
    SPRITES: SPRITES,
    draw: draw,
    drawSword: drawSword,
    drawCoconut: drawCoconut
  };
})(window);
