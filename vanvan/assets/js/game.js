/* ---------------------------------------------------------------
   game.js: "THE PASS", one girder level.
   Climb the line, dodge the coconuts the pot is throwing, reach the
   last order sitting on the pass. Grab a chili and the sword lights.
   --------------------------------------------------------------- */
(function (global) {
  'use strict';

  var S = global.VVSprite;
  var W = 208, H = 320;              // logical playfield, scaled up whole-number
  var HUD = 26;                      // top strip reserved for score

  /* ---- level geometry -------------------------------------------------
     Girders alternate their slope so a coconut zig-zags all the way down.
     y grows downward, so the lower-numbered y is the high end.            */
  var GIRDERS = [
    { x0:   0, x1: 208, yl: 302, yr: 302, dir: -1 }, // 0 ground
    { x0:   6, x1: 202, yl: 257, yr: 267, dir:  1 }, // 1
    { x0:   6, x1: 202, yl: 227, yr: 217, dir: -1 }, // 2
    { x0:   6, x1: 202, yl: 177, yr: 187, dir:  1 }, // 3
    { x0:   6, x1: 202, yl: 147, yr: 137, dir: -1 }, // 4
    { x0:   6, x1: 202, yl:  97, yr: 107, dir:  1 }, // 5  the pot's shelf
    { x0:  72, x1: 144, yl:  62, yr:  62, dir:  0 }  // 6  the pass
  ];

  var LADDERS = [
    { x: 176, a: 0, b: 1 },
    { x:  44, a: 1, b: 2 },
    { x: 150, a: 1, b: 2 },
    { x: 170, a: 2, b: 3 },
    { x:  62, a: 2, b: 3 },
    { x:  40, a: 3, b: 4 },
    { x: 134, a: 3, b: 4 },
    { x: 162, a: 4, b: 5 },
    { x:  86, a: 4, b: 5 },
    { x: 108, a: 5, b: 6 }
  ];

  var CHILI_SPOTS = [{ g: 2, x: 26 }, { g: 4, x: 184 }];

  function surfaceY(gi, x) {
    var g = GIRDERS[gi];
    var t = (x - g.x0) / (g.x1 - g.x0);
    if (t < 0) t = 0; if (t > 1) t = 1;
    return g.yl + (g.yr - g.yl) * t;
  }
  function onGirder(gi, x) {
    var g = GIRDERS[gi];
    return x >= g.x0 - 1 && x <= g.x1 + 1;
  }

  /* ---- state ---------------------------------------------------------- */
  var cv, ctx, raf = null, running = false, t = 0;
  var keys = { l: false, r: false, u: false, d: false, j: false };
  var hero, cocos, chilis, score, lives, bonus, bonusTick, mode, msgTimer, best;
  var pot = { throwAnim: 0 };
  var spawnTimer, hooks = {};

  function reset(full) {
    hero = {
      x: 26, y: surfaceY(0, 26), vx: 0, vy: 0,
      g: 0, face: 1, state: 'ground', ladder: null, anim: 0, lit: 0, dead: 0
    };
    cocos = [];
    spawnTimer = 90;
    chilis = CHILI_SPOTS.map(function (c) {
      return { x: c.x, y: surfaceY(c.g, c.x) - 7, taken: false };
    });
    if (full) {
      score = 0; lives = 3; bonus = 5000; bonusTick = 0; mode = 'play'; msgTimer = 0;
    }
  }

  /* ---- input ---------------------------------------------------------- */
  function keyFlag(e, on) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.l = on;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.r = on;
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.u = on;
    else if (k === 'ArrowDown' || k === 's' || k === 'S') keys.d = on;
    else if (k === ' ' || k === 'z' || k === 'Z' || k === 'Enter') keys.j = on;
    else return;
    e.preventDefault();
    if (on && (mode === 'over' || mode === 'win') && (k === ' ' || k === 'Enter')) restart();
  }
  function onDown(e) { keyFlag(e, true); }
  function onUp(e) { keyFlag(e, false); }

  function bindPad(root) {
    if (!root) return;
    var btns = root.querySelectorAll('[data-k]');
    Array.prototype.forEach.call(btns, function (b) {
      var k = b.getAttribute('data-k');
      var set = function (v) {
        return function (ev) {
          ev.preventDefault();
          keys[k] = v;
          b.classList.toggle('is-down', v);
          if (v && (mode === 'over' || mode === 'win') && k === 'j') restart();
        };
      };
      b.addEventListener('pointerdown', set(true));
      b.addEventListener('pointerup', set(false));
      b.addEventListener('pointercancel', set(false));
      b.addEventListener('pointerleave', set(false));
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  }

  /* ---- hero ----------------------------------------------------------- */
  function ladderAt(x, gi, wantUp) {
    for (var i = 0; i < LADDERS.length; i++) {
      var L = LADDERS[i];
      if (Math.abs(x - L.x) > 5) continue;
      if (wantUp && L.a === gi) return L;
      if (!wantUp && L.b === gi) return L;
    }
    return null;
  }

  function stepHero() {
    var h = hero;
    if (h.dead > 0) { h.dead--; if (h.dead === 0) loseLife(); return; }

    if (h.state === 'climb') {
      var L = h.ladder;
      var top = surfaceY(L.b, L.x), bot = surfaceY(L.a, L.x);
      h.vy = 0;
      if (keys.u) { h.y -= 0.85; h.anim++; }
      else if (keys.d) { h.y += 0.85; h.anim++; }
      if (h.y <= top) { h.y = top; h.state = 'ground'; h.g = L.b; h.ladder = null; }
      else if (h.y >= bot) { h.y = bot; h.state = 'ground'; h.g = L.a; h.ladder = null; }
      return;
    }

    // walking / airborne
    var sp = 0;
    if (keys.l) { sp = -0.95; h.face = -1; }
    else if (keys.r) { sp = 0.95; h.face = 1; }

    if (h.state === 'ground') {
      h.x += sp;
      if (sp !== 0) h.anim++;
      var g = GIRDERS[h.g];
      if (h.x < g.x0 + 4) h.x = g.x0 + 4;
      if (h.x > g.x1 - 4) h.x = g.x1 - 4;
      h.y = surfaceY(h.g, h.x);

      var up = keys.u ? ladderAt(h.x, h.g, true) : null;
      var dn = keys.d ? ladderAt(h.x, h.g, false) : null;
      if (up) { h.state = 'climb'; h.ladder = up; h.x = up.x; h.y -= 1; return; }
      if (dn) { h.state = 'climb'; h.ladder = dn; h.x = dn.x; h.y += 1; return; }

      if (keys.j) { h.vy = -2.7; h.state = 'air'; keys.j = false; }
    } else {
      h.x += sp * 0.85;
      h.vy += 0.26;
      h.y += h.vy;
      if (h.x < 2) h.x = 2;
      if (h.x > W - 2) h.x = W - 2;
      if (h.vy > 0) {
        for (var i = 0; i < GIRDERS.length; i++) {
          if (!onGirder(i, h.x)) continue;
          var sy = surfaceY(i, h.x);
          if (h.y - h.vy <= sy + 1 && h.y >= sy) {
            h.y = sy; h.vy = 0; h.state = 'ground'; h.g = i; break;
          }
        }
      }
      if (h.y > H + 20) { hit(); }
    }

    if (h.lit > 0) h.lit--;

    // chilis
    for (var c = 0; c < chilis.length; c++) {
      var ch = chilis[c];
      if (ch.taken) continue;
      if (Math.abs(ch.x - h.x) < 8 && Math.abs(ch.y + 4 - (h.y - 10)) < 14) {
        ch.taken = true; h.lit = 420; score += 300; flash('SWORD LIT');
      }
    }

    // the pass
    if (h.g === 6 && h.state === 'ground' && Math.abs(h.x - 108) < 40) win();
  }

  /* ---- coconuts ------------------------------------------------------- */
  function spawn() {
    cocos.push({
      x: 44, y: surfaceY(5, 44) - 8, g: 5, dir: 1,
      vy: 0, state: 'roll', spin: 0, speed: 0.72 + Math.random() * 0.3,
      lad: null, scored: false
    });
    pot.throwAnim = 22;
  }

  function stepCocos() {
    for (var i = cocos.length - 1; i >= 0; i--) {
      var c = cocos[i];

      if (c.state === 'roll') {
        c.x += c.dir * c.speed;
        c.spin += c.dir * 0.55;
        var g = GIRDERS[c.g];
        // take a ladder down now and then
        if (c.g > 0) {
          for (var k = 0; k < LADDERS.length; k++) {
            var L = LADDERS[k];
            if (L.b === c.g && Math.abs(c.x - L.x) < 1.2 && Math.random() < 0.22) {
              c.state = 'ladder'; c.lad = L; c.x = L.x; break;
            }
          }
        }
        if (c.state === 'roll') {
          c.y = surfaceY(c.g, c.x) - 8;
          if (c.x < g.x0 - 2 || c.x > g.x1 + 2) {
            if (c.g === 0) { cocos.splice(i, 1); continue; }
            var below = GIRDERS[c.g - 1];
            c.state = 'fall'; c.vy = 0;
            c.x = Math.max(below.x0 + 3, Math.min(below.x1 - 4, c.x));
          }
        }
      } else if (c.state === 'ladder') {
        c.y += 0.9; c.spin += 0.3;
        if (c.y + 8 >= surfaceY(c.lad.a, c.lad.x)) {
          c.g = c.lad.a; c.dir = GIRDERS[c.g].dir || -1;
          c.y = surfaceY(c.g, c.x) - 8; c.state = 'roll'; c.lad = null;
        }
      } else { // fall
        c.vy += 0.28; c.y += c.vy; c.spin += 0.2;
        for (var gi = c.g - 1; gi >= 0; gi--) {
          if (!onGirder(gi, c.x)) continue;
          var sy = surfaceY(gi, c.x) - 8;
          if (c.y >= sy) {
            c.y = sy; c.g = gi; c.state = 'roll';
            c.dir = GIRDERS[gi].dir || -1;
            c.x += c.dir * 2;
            break;
          }
        }
        if (c.y > H + 30) { cocos.splice(i, 1); continue; }
      }

      // scoring a clean hop
      if (!c.scored && hero.state === 'air' && hero.dead === 0 &&
          Math.abs(c.x + 4 - hero.x) < 9 && hero.y < c.y + 4 && hero.y > c.y - 16) {
        c.scored = true; score += 100; flash('+100');
      }

      // contact
      if (hero.dead === 0 && mode === 'play' &&
          Math.abs(c.x + 4 - hero.x) < 9 &&
          c.y + 8 > hero.y - 19 && c.y < hero.y) {
        if (hero.lit > 0) { cocos.splice(i, 1); score += 200; flash('+200'); }
        else hit();
      }
    }
  }

  /* ---- flow ----------------------------------------------------------- */
  var msg = '';
  function flash(m) { msg = m; msgTimer = 60; }

  function hit() { if (hero.dead === 0) { hero.dead = 46; } }

  function loseLife() {
    lives--;
    if (lives <= 0) {
      mode = 'over';
      best = Math.max(best, score);
      try { localStorage.setItem('vv_best', String(best)); } catch (e) {}
    } else {
      reset(false);
    }
  }

  function win() {
    mode = 'win';
    score += bonus;
    best = Math.max(best, score);
    try {
      localStorage.setItem('vv_best', String(best));
      localStorage.setItem('vv_cleared', '1');
    } catch (e) {}
    if (hooks.onWin) hooks.onWin(score);
  }

  function restart() { reset(true); }

  /* ---- draw ----------------------------------------------------------- */
  function drawGirder(g, gi) {
    var x, y;
    for (x = g.x0; x <= g.x1; x++) {
      y = Math.round(surfaceY(gi, x));
      ctx.fillStyle = '#8a5252';
      ctx.fillRect(x, y, 1, 5);
      ctx.fillStyle = '#5c3535';
      ctx.fillRect(x, y + 5, 1, 1);
      ctx.fillStyle = '#a86a6a';
      ctx.fillRect(x, y, 1, 1);
    }
    for (x = g.x0 + 4; x <= g.x1 - 3; x += 9) {
      y = Math.round(surfaceY(gi, x));
      ctx.fillStyle = '#fcf0d8';
      ctx.fillRect(x, y + 2, 1, 1);
    }
  }

  function drawLadder(L) {
    var top = surfaceY(L.b, L.x), bot = surfaceY(L.a, L.x);
    ctx.fillStyle = '#9b9c9e';
    ctx.fillRect(L.x - 4, top, 1, bot - top + 5);
    ctx.fillRect(L.x + 3, top, 1, bot - top + 5);
    ctx.fillStyle = '#e8dcc4';
    for (var y = top + 2; y < bot + 4; y += 4) ctx.fillRect(L.x - 3, Math.round(y), 6, 1);
  }

  function drawHUD() {
    ctx.fillStyle = '#fcf0d8';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('SCORE', 6, 5);
    ctx.fillText(String(score).padStart(6, '0'), 6, 15);
    ctx.fillStyle = '#e8b0b0';
    ctx.fillText('BONUS', 82, 5);
    ctx.fillStyle = '#fcf0d8';
    ctx.fillText(String(Math.max(0, bonus)).padStart(5, '0'), 82, 15);
    for (var i = 0; i < lives; i++) S.draw(ctx, 'heart', 152 + i * 8, 14, 1, false);
    ctx.fillStyle = '#9b9c9e';
    ctx.fillText('L-1', 152, 5);
  }

  function heroFrame() {
    var h = hero, f;
    if (h.dead > 0) return 'jump';
    if (h.state === 'climb') return (Math.floor(h.anim / 8) % 2) ? 'climb2' : 'climb1';
    if (h.state === 'air') return 'jump';
    if (keys.l || keys.r) return (Math.floor(h.anim / 7) % 2) ? 'run1' : 'run2';
    return 'idle';
  }

  function render() {
    ctx.fillStyle = '#1a1414';
    ctx.fillRect(0, 0, W, H);
    // faint grey scanline field so the dark does not read flat
    ctx.fillStyle = 'rgba(155,156,158,0.05)';
    for (var y = HUD; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    drawHUD();
    GIRDERS.forEach(drawGirder);
    LADDERS.forEach(drawLadder);

    // pot
    var py = surfaceY(5, 30) - 13;
    S.draw(ctx, 'pot', 22, py + (pot.throwAnim > 12 ? -2 : 0), 1, false);
    if (pot.throwAnim > 0) pot.throwAnim--;

    // the pass + the last order
    var by = surfaceY(6, 108) - 7;
    S.draw(ctx, 'bowl', 102, by, 1, false);
    if (Math.floor(t / 20) % 2 === 0) {
      ctx.fillStyle = '#fcf0d8';
      ctx.fillRect(101, by - 3, 1, 1);
      ctx.fillRect(114, by - 4, 1, 1);
    }
    ctx.fillStyle = '#9b9c9e';
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText('THE PASS', 78, by - 14);

    chilis.forEach(function (c) { if (!c.taken) S.draw(ctx, 'chili', c.x - 2, c.y, 1, false); });
    cocos.forEach(function (c) { S.drawCoconut(ctx, Math.round(c.x), Math.round(c.y), 1, Math.floor(c.spin)); });

    // hero
    var hx = Math.round(hero.x) - 7, hy = Math.round(hero.y) - 20;
    if (hero.dead > 0) {
      hy -= Math.round(Math.sin(hero.dead / 46 * Math.PI) * 6);
      ctx.save();
      ctx.translate(hx + 7, hy + 10);
      ctx.rotate(((46 - hero.dead) / 46) * Math.PI);
      S.draw(ctx, 'jump', -7, -10, 1, false);
      ctx.restore();
    } else {
      S.draw(ctx, heroFrame(), hx, hy, 1, hero.face < 0);
      if (hero.state !== 'climb') {
        var handX = hero.face > 0 ? hx + 12 : hx - 1;
        S.drawSword(ctx, handX, hy + 13, 1, hero.face < 0, hero.lit > 0, hero.state === 'air');
      }
    }

    if (msgTimer > 0) {
      msgTimer--;
      ctx.fillStyle = '#fcf0d8';
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText(msg, Math.round(hero.x) - msg.length * 2, Math.round(hero.y) - 30);
    }

    if (mode === 'over') {
      ctx.fillStyle = 'rgba(26,20,20,0.86)';
      ctx.fillRect(0, 96, W, 92);
      ctx.fillStyle = '#e8b0b0';
      ctx.font = '10px "Press Start 2P", monospace';
      var title = 'GAME OVER';
      ctx.fillText(title, (W - title.length * 10) / 2, 112);
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#fcf0d8';
      var l2 = 'SCORE ' + score;
      ctx.fillText(l2, (W - l2.length * 6) / 2, 134);
      var l3 = 'BEST ' + best;
      ctx.fillStyle = '#9b9c9e';
      ctx.fillText(l3, (W - l3.length * 6) / 2, 148);
      ctx.fillStyle = '#fcf0d8';
      var l4 = Math.floor(t / 30) % 2 ? 'PRESS JUMP' : '';
      if (l4) ctx.fillText(l4, (W - l4.length * 6) / 2, 168);
    }
  }

  function loop() {
    t++;
    if (mode === 'play') {
      stepHero();
      stepCocos();
      if (--spawnTimer <= 0) {
        spawn();
        spawnTimer = Math.max(80, 190 - Math.floor(score / 90));
      }
      if (++bonusTick >= 45) {
        bonusTick = 0; bonus -= 100;
        if (bonus <= 0) { bonus = 0; lives = 1; hit(); }
      }
    }
    render();
    raf = global.requestAnimationFrame(loop);
  }

  /* ---- public --------------------------------------------------------- */
  function start(canvas, pad, opts) {
    if (running) return;
    cv = canvas;
    cv.width = W; cv.height = H;
    ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    hooks = opts || {};
    try { best = parseInt(localStorage.getItem('vv_best') || '0', 10) || 0; } catch (e) { best = 0; }
    reset(true);
    bindPad(pad);
    global.addEventListener('keydown', onDown);
    global.addEventListener('keyup', onUp);
    running = true;
    loop();
  }

  function stop() {
    if (!running) return;
    running = false;
    global.cancelAnimationFrame(raf);
    global.removeEventListener('keydown', onDown);
    global.removeEventListener('keyup', onUp);
  }

  global.VVGame = {
    start: start, stop: stop, restart: restart,
    // handy when tuning the level in a console
    peek: function () {
      return { mode: mode, score: score, lives: lives, bonus: bonus,
               running: running, keys: JSON.parse(JSON.stringify(keys)), dead: hero.dead,
               hero: { x: hero.x, y: hero.y, g: hero.g, state: hero.state, lit: hero.lit },
               cocos: cocos.map(function (c) {
                 return { x: Math.round(c.x), y: Math.round(c.y), g: c.g, s: c.state };
               }) };
    }
  };
})(window);
