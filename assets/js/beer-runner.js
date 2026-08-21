/* Beer Runner: The Game
   Built out of the original comps: the 16-frame hand-drawn run cycle,
   the city world strip, the level furniture, and the two screens.
   Grab bubbles to keep your carbonation up. Space to jump, J to pop a cap. */
(function () {
  'use strict';

  /* ---------------- stage + source geometry ---------------- */
  var W = 1100, H = 685;                 // logical stage, exactly the comp aspect (880:548)
  var WORLD_W = 11184, WORLD_H = 620;    // br-world.jpg
  var WSCALE = H / WORLD_H;
  var WORLD_DRAW = WORLD_W * WSCALE;
  var GROUND = 546 * WSCALE;             // the road line in the original art
  var RUNH;                              // bubble line you can grab without jumping

  var FW = 226, FH = 300, FRAMES = 16;   // runner sheet cell
  var PH = 173, PW = FW / FH * PH;       // drawn player size
  var FOOT = 275 / FH * PH;              // feet sit this far below the frame top
  var ANCHOR = 0.381;                    // bottle centre across the frame

  var GRACE = 2600;                      // no hopsters until you are this far in

  var PLAT_SRC_W = 307, PLAT_SRC_H = 37, PLAT_CAP = 100;
  var PLAT_H = 34, PLAT_S = PLAT_H / PLAT_SRC_H;
  var PLAT_CAP_W = PLAT_CAP * PLAT_S;
  var PLAT_DECK = 14 / PLAT_SRC_H * PLAT_H;   // deck top inside the sprite

  var HOP_SRC_W = 83, HOP_SRC_H = 123;
  var HOP_H = 112, HOP_W = HOP_SRC_W / HOP_SRC_H * HOP_H;

  var BUB_R = 19, CAP_R = 16, SWIRL_R = 34, BUB_GRAB = 61;

  RUNH = GROUND - PH * 0.55;             // level with the bottle's middle

  /* ---------------- tuning ---------------- */
  var GRAV = 2600, JUMP_V = -1150, CUT = 0.42;
  var SPEED0 = 430, SPEED_RAMP = 4, SPEED_MAX = 780;
  var COYOTE = 0.09, BUFFER = 0.12;
  var FIZZ_MAX = 100, FIZZ_DRAIN = 10, FIZZ_BUBBLE = 9;
  var IMMUNE_TIME = 10, CAP_COOL = 0.3, CAP_SPEED = 980;
  var PTS_BUBBLE = 200, PTS_HOP = 800, PTS_RATE = 0.7;

  var PAL = {
    navy: '#2f3363', cream: '#f5fcdd', gold: '#bab05b',
    green: '#a8e6a0', amber: '#f7c15a', amberDk: '#e08b2e',
    ice: '#cfeaf7', iceDk: '#8ec8e4', cap: '#3f9fd0', road: '#f9e1d5'
  };

  /* ---------------- boot ---------------- */
  var root = document.getElementById('br-game');
  if (!root) return;
  var cv = root.querySelector('canvas');
  var ctx = cv.getContext('2d');
  var elTitle = root.querySelector('.br-title');
  var elOver = root.querySelector('.br-over');
  var elHiTitle = root.querySelector('[data-hi-title]');
  var elScoreOver = root.querySelector('[data-score-over]');
  var elHiOver = root.querySelector('[data-hi-over]');
  var elLoad = root.querySelector('.br-load');
  var btnSound = document.querySelector('.br-sound');

  var IMG = {}, need = 0, got = 0, ready = false;
  function load(k, src) {
    need++;
    var i = new Image();
    i.onload = function () { got++; if (got === need) { ready = true; root.classList.add('is-ready'); } };
    i.onerror = function () { got++; if (got === need) { ready = true; root.classList.add('is-ready'); } };
    i.src = src;
    IMG[k] = i;
  }
  load('runner', 'assets/img/game/runner.png');
  load('hopster', 'assets/img/game/hopster.png');
  load('plat', 'assets/img/game/platform.png');
  load('world', 'assets/img/digital/br-world.jpg');

  /* ---------------- sound ---------------- */
  var AC = null, muted = localStorage.getItem('br-muted') === '1';
  function audio() {
    if (!AC && window.AudioContext) AC = new AudioContext();
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function blip(f0, f1, dur, type, vol) {
    if (muted) return;
    var ac = audio(); if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), ac.currentTime + dur);
    g.gain.setValueAtTime((vol || 0.06), ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur + 0.02);
  }
  function setMuted(m) {
    muted = m;
    localStorage.setItem('br-muted', m ? '1' : '0');
    if (!btnSound) return;
    btnSound.setAttribute('aria-pressed', String(!m));
    btnSound.textContent = m ? 'Sound off' : 'Sound on';
  }
  setMuted(muted);
  if (btnSound) btnSound.addEventListener('click', function (e) { e.stopPropagation(); setMuted(!muted); });

  /* ---------------- state ---------------- */
  var S = {};
  var hi = parseInt(localStorage.getItem('br-hiscore') || '0', 10) || 0;
  var mode = 'title';

  function reset() {
    S = {
      t: 0, camX: 0, speed: SPEED0, score: 0, fizz: FIZZ_MAX,
      px: 300, py: GROUND, vy: 0, onGround: true, frame: 0, fclock: 0,
      coyote: 0, buffer: 0, jumpHeld: false, immune: 0, cooldown: 0,
      dead: false, deathT: 0, tilt: 0,
      plats: [], bubbles: [], hops: [], caps: [], swirls: [], bits: [],
      spawnX: 1500, lastKind: -1, popped: 0, collected: 0
    };
    // a friendly opening stretch: nothing to dodge until you have your legs
    chunkBubbles(760, RUNH, 5);
    chunkBubbles(1180, RUNH, 4, true);
  }

  /* ---------------- level generation ---------------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  function addPlat(x, y, w) { S.plats.push({ x: x, y: y, w: Math.max(184, w) }); }
  function addBubble(x, y) { S.bubbles.push({ x: x, y: y, ph: Math.random() * 6.28, got: false }); }
  function addHop(x, y, plat) {
    S.hops.push({ x: x, y: y, ph: Math.random() * 6.28, dead: false, plat: plat || null, dir: -1, t: 0 });
  }
  function addSwirl(x, y) { S.swirls.push({ x: x, y: y, ph: 0, got: false }); }

  function chunkBubbles(x, y, n, arc) {
    for (var i = 0; i < n; i++) {
      var dx = x + i * 62;
      var dy = arc ? y - Math.sin(i / (n - 1) * Math.PI) * 110 : y;
      addBubble(dx, dy);
    }
    return x + n * 62 + 90;
  }

  function generate() {
    var diff = Math.min(1, S.t / 75);            // 0 -> 1 over the first 75s
    var x = S.spawnX;
    var kinds = S.spawnX < GRACE
      ? ['bubbles', 'plats']
      : ['bubbles', 'plats', 'hops', 'plathop', 'mixed'];
    if (S.spawnX > GRACE && Math.random() < 0.10 + diff * 0.04) kinds = ['power'];
    var kind = pick(kinds);
    if (kind === S.lastKind) kind = pick(kinds);
    S.lastKind = kind;

    if (kind === 'bubbles') {
      x = chunkBubbles(x, RUNH, 5 + ((Math.random() * 3) | 0), Math.random() < 0.6);

    } else if (kind === 'plats') {
      var n = 2 + ((Math.random() * 2) | 0);
      for (var i = 0; i < n; i++) {
        var w = rnd(200, 340);
        var y = GROUND - rnd(150, 330);
        addPlat(x, y, w);
        chunkBubbles(x + 40, y - 60, Math.max(2, ((w - 80) / 62) | 0));
        x += w + rnd(150, 260);
      }
      x += 120;

    } else if (kind === 'hops') {
      var m = 1 + ((Math.random() * (1 + diff * 2)) | 0);
      for (var j = 0; j < m; j++) {
        addHop(x, GROUND, null);
        chunkBubbles(x - 150, RUNH, 3, true);
        // never closer together than a single jump can clear
        x += Math.max(rnd(430, 700) - diff * 90, S.speed * 1.05);
      }
      x += 200;

    } else if (kind === 'plathop') {
      var pw = rnd(240, 380), py = GROUND - rnd(170, 300);
      addPlat(x, py, pw);
      addHop(x + pw * 0.62, py, S.plats[S.plats.length - 1]);
      chunkBubbles(x + 30, py - 70, 3);
      x += pw + rnd(230, 340);

    } else if (kind === 'power') {
      if (Math.random() < 0.5) {
        var w2 = rnd(200, 280), y2 = GROUND - rnd(200, 320);
        addPlat(x, y2, w2);
        addSwirl(x + w2 / 2, y2 - 74);
      } else {
        addSwirl(x + 120, GROUND - rnd(160, 260));
      }
      x += 520;

    } else { // mixed
      var w3 = rnd(220, 320), y3 = GROUND - rnd(180, 280);
      addPlat(x, y3, w3);
      chunkBubbles(x + 30, y3 - 62, 3);
      addHop(x + w3 + rnd(180, 300), GROUND, null);
      x += w3 + rnd(560, 780);
    }

    // keep the fizz winnable: never leave a long dry stretch
    if (Math.random() < 0.55) chunkBubbles(x - 280, RUNH, 3, true);
    S.spawnX = x;
  }

  function cull() {
    var edge = S.camX - 400;
    function keep(a) { return a.filter(function (o) { return (o.x + (o.w || 200)) > edge; }); }
    S.plats = keep(S.plats); S.bubbles = keep(S.bubbles);
    S.hops = keep(S.hops); S.swirls = keep(S.swirls);
    S.caps = S.caps.filter(function (c) { return c.x < S.camX + W + 200 && c.life > 0; });
    S.bits = S.bits.filter(function (b) { return b.life > 0; });
  }

  /* ---------------- input ---------------- */
  var keys = {}, inView = true;
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; },
      { threshold: 0.35 }).observe(root);
  }
  function wantJump() { S.buffer = BUFFER; }
  function wantThrow() { throwCap(); }

  document.addEventListener('keydown', function (e) {
    if (!inView) return;
    if (/^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '')) return;
    var k = e.key.toLowerCase();
    if (k === ' ' || k === 'spacebar' || k === 'arrowup' || k === 'w') {
      e.preventDefault();
      if (mode === 'title') { start(); return; }
      if (mode === 'over') { start(); return; }
      if (!keys.jump) { keys.jump = true; wantJump(); }
      S.jumpHeld = true;
    }
    if (k === 'j' || k === 'f') { if (mode === 'play') wantThrow(); }
    if (k === 'escape') {
      if (mode === 'play') mode = 'paused';
      else if (mode === 'paused') { last = 0; mode = 'play'; }
    }
    if (k === 'p') {
      if (mode === 'play') mode = 'paused';
      else if (mode === 'paused') { last = 0; mode = 'play'; }
    }
  });
  document.addEventListener('keyup', function (e) {
    if (!inView) return;
    var k = e.key.toLowerCase();
    if (k === ' ' || k === 'spacebar' || k === 'arrowup' || k === 'w') { keys.jump = false; S.jumpHeld = false; }
  });

  cv.addEventListener('pointerdown', function (e) {
    if (mode !== 'play') return;
    e.preventDefault();
    wantJump(); S.jumpHeld = true;
  });
  cv.addEventListener('pointerup', function () { S.jumpHeld = false; });

  root.querySelectorAll('[data-start]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); start(); });
  });
  var padJump = root.querySelector('.br-pad-jump');
  var padCap = root.querySelector('.br-pad-cap');
  if (padJump) {
    padJump.addEventListener('pointerdown', function (e) { e.preventDefault(); if (mode === 'play') { wantJump(); S.jumpHeld = true; } });
    padJump.addEventListener('pointerup', function () { S.jumpHeld = false; });
  }
  if (padCap) padCap.addEventListener('pointerdown', function (e) { e.preventDefault(); if (mode === 'play') wantThrow(); });

  /* ---------------- actions ---------------- */
  function jump() {
    S.vy = JUMP_V; S.onGround = false; S.coyote = 0; S.buffer = 0;
    blip(320, 640, 0.13, 'square', 0.05);
  }
  function throwCap() {
    if (S.cooldown > 0 || S.dead) return;
    S.cooldown = CAP_COOL;
    S.caps.push({ x: S.px + PW * 0.30, y: S.py - PH * 0.52, vx: CAP_SPEED + S.speed, life: 1.6, spin: 0, trail: [] });
    blip(760, 300, 0.09, 'triangle', 0.045);
  }
  function burst(x, y, col, n) {
    for (var i = 0; i < n; i++) {
      S.bits.push({
        x: x, y: y, vx: rnd(-260, 260), vy: rnd(-420, -60),
        r: rnd(3, 8), life: rnd(0.4, 0.9), max: 0.9, col: col
      });
    }
  }
  function die(cause) {
    if (S.dead) return;
    S.dead = true; S.deathT = 0; S.vy = -520;
    burst(S.px, S.py - PH * 0.5, PAL.gold, 18);
    blip(340, 70, 0.5, 'sawtooth', 0.07);
    if (S.score > hi) { hi = Math.round(S.score); localStorage.setItem('br-hiscore', String(hi)); }
  }

  function start() {
    audio();
    reset();
    mode = 'play';
    root.classList.remove('is-title', 'is-over');
    root.classList.add('is-play');
    cv.focus();
  }
  function gameOver() {
    mode = 'over';
    root.classList.remove('is-play');
    root.classList.add('is-over');
    elScoreOver.textContent = fmt(Math.round(S.score));
    elHiOver.textContent = fmt(hi);
    elHiTitle.textContent = fmt(hi);
  }
  function fmt(n) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ---------------- collision helpers ---------------- */
  function playerBox() {
    var left = S.px - ANCHOR * PW;
    return {
      x: left + 0.26 * PW, w: 0.30 * PW,
      y: S.py - FOOT + 0.22 * PH, h: 0.66 * PH
    };
  }
  function hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function near(x1, y1, x2, y2, r) {
    var dx = x1 - x2, dy = y1 - y2; return dx * dx + dy * dy < r * r;
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    S.t += dt;
    S.speed = Math.min(SPEED_MAX, SPEED0 + SPEED_RAMP * S.t);

    if (S.dead) {
      S.deathT += dt;
      S.vy += GRAV * dt * 0.8;
      S.py += S.vy * dt;
      S.tilt = Math.min(1.35, S.tilt + dt * 3.2);
      if (S.py > GROUND) { S.py = GROUND; S.vy = 0; }
      stepBits(dt);
      if (S.deathT > 1.15) gameOver();
      return;
    }

    // score + fizz
    S.score += S.speed * PTS_RATE * dt;
    S.fizz -= (FIZZ_DRAIN + (S.speed - SPEED0) / 90) * dt;
    if (S.fizz <= 0) { S.fizz = 0; die('flat'); return; }
    if (S.immune > 0) S.immune = Math.max(0, S.immune - dt);
    if (S.cooldown > 0) S.cooldown = Math.max(0, S.cooldown - dt);

    // horizontal: the world moves, the player holds station
    S.camX += S.speed * dt;
    S.px = S.camX + 300;

    // jump
    if (S.buffer > 0) S.buffer -= dt;
    if (S.coyote > 0) S.coyote -= dt;
    if (S.buffer > 0 && (S.onGround || S.coyote > 0)) jump();
    if (!S.jumpHeld && S.vy < 0) S.vy += GRAV * CUT * dt;

    // vertical
    var prevFeet = S.py;
    S.vy += GRAV * dt;
    S.py += S.vy * dt;
    var wasOn = S.onGround;
    S.onGround = false;

    // one-way platforms
    for (var i = 0; i < S.plats.length; i++) {
      var p = S.plats[i];
      if (S.vy < 0) continue;
      if (S.px < p.x + 18 || S.px > p.x + p.w - 18) continue;
      if (prevFeet <= p.y + 6 && S.py >= p.y) {
        S.py = p.y; S.vy = 0; S.onGround = true;
      }
    }
    if (S.py >= GROUND) { S.py = GROUND; S.vy = 0; S.onGround = true; }
    if (wasOn && !S.onGround && S.vy >= 0) S.coyote = COYOTE;

    // run cycle: paced to ground speed
    if (S.onGround) {
      S.fclock += dt * (S.speed / 16);
      S.frame = ((S.fclock | 0) % FRAMES + FRAMES) % FRAMES;
    } else {
      S.frame = S.vy < 0 ? 3 : 7;
    }

    var pb = playerBox();

    // bubbles
    for (var b = 0; b < S.bubbles.length; b++) {
      var bu = S.bubbles[b];
      if (bu.got) continue;
      bu.ph += dt * 2.2;
      if (near(S.px, S.py - PH * 0.5, bu.x, bu.y + Math.sin(bu.ph) * 6, BUB_GRAB)) {
        bu.got = true; S.collected++;
        S.fizz = Math.min(FIZZ_MAX, S.fizz + FIZZ_BUBBLE);
        S.score += PTS_BUBBLE;
        burst(bu.x, bu.y, PAL.ice, 5);
        blip(680 + Math.min(8, S.collected % 9) * 55, 1180, 0.08, 'sine', 0.05);
      }
    }

    // swirls
    for (var s = 0; s < S.swirls.length; s++) {
      var sw = S.swirls[s];
      if (sw.got) continue;
      sw.ph += dt * 2.4;
      if (near(S.px, S.py - PH * 0.5, sw.x, sw.y, SWIRL_R + 42)) {
        sw.got = true; S.immune = IMMUNE_TIME;
        burst(sw.x, sw.y, PAL.amber, 14);
        blip(400, 1300, 0.35, 'sine', 0.06);
      }
    }

    // caps
    for (var c = 0; c < S.caps.length; c++) {
      var cp = S.caps[c];
      cp.life -= dt; cp.spin += dt * 16;
      cp.trail.unshift({ x: cp.x, y: cp.y });
      if (cp.trail.length > 7) cp.trail.pop();
      cp.x += cp.vx * dt;
    }

    // hopsters
    for (var h = 0; h < S.hops.length; h++) {
      var hp = S.hops[h];
      if (hp.dead) continue;
      hp.ph += dt * 3.1; hp.t += dt;
      if (hp.plat) {
        hp.x += hp.dir * 52 * dt;
        if (hp.x < hp.plat.x + HOP_W * 0.6) hp.dir = 1;
        if (hp.x > hp.plat.x + hp.plat.w - HOP_W * 0.6) hp.dir = -1;
      }
      var bob = Math.sin(hp.ph) * 6;
      var hb = {
        x: hp.x - HOP_W * 0.32, w: HOP_W * 0.64,
        y: hp.y - HOP_H + bob + HOP_H * 0.05, h: HOP_H * 0.66
      };
      // caps
      for (var k = 0; k < S.caps.length; k++) {
        var cc = S.caps[k];
        if (cc.life <= 0) continue;
        if (cc.x > hb.x - CAP_R && cc.x < hb.x + hb.w + CAP_R &&
            cc.y > hb.y - CAP_R && cc.y < hb.y + hb.h + CAP_R) {
          hp.dead = true; cc.life = 0; S.popped++;
          S.score += PTS_HOP;
          burst(hp.x, hp.y - HOP_H * 0.6, '#8dc63f', 16);
          blip(520, 120, 0.18, 'square', 0.06);
          break;
        }
      }
      if (hp.dead) continue;
      if (hit(pb, hb)) {
        if (S.immune > 0) {
          hp.dead = true; S.popped++; S.score += PTS_HOP;
          burst(hp.x, hp.y - HOP_H * 0.6, '#8dc63f', 16);
          blip(520, 120, 0.18, 'square', 0.06);
        } else {
          die('hopster');
          return;
        }
      }
    }

    stepBits(dt);
    while (S.spawnX < S.camX + W + 700) generate();
    cull();
  }

  function stepBits(dt) {
    for (var i = 0; i < S.bits.length; i++) {
      var b = S.bits[i];
      b.life -= dt; b.vy += 1500 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
  }

  /* ---------------- drawing ---------------- */
  /* Only the slice of the world strip under the camera gets sampled, and it
     wraps at the far end of the city back to the Beer Runner headquarters. */
  function drawWorld() {
    var img = IMG.world;
    if (!img.complete || !img.naturalWidth) {
      ctx.fillStyle = '#2fd4f6'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = PAL.road; ctx.fillRect(0, GROUND, W, H - GROUND);
      return;
    }
    var sx = (S.camX % WORLD_DRAW) / WSCALE;
    var sw = W / WSCALE;
    if (sx + sw <= WORLD_W) {
      ctx.drawImage(img, sx, 0, sw, WORLD_H, 0, 0, W, H);
    } else {
      var head = WORLD_W - sx;
      ctx.drawImage(img, sx, 0, head, WORLD_H, 0, 0, head * WSCALE, H);
      ctx.drawImage(img, 0, 0, sw - head, WORLD_H, head * WSCALE, 0, (sw - head) * WSCALE, H);
    }
  }

  function drawPlat(p) {
    var img = IMG.plat, x = p.x - S.camX, y = p.y - PLAT_DECK;
    ctx.save();
    ctx.globalAlpha = 0.16; ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x + p.w / 2, y + PLAT_H + 8, p.w * 0.42, 8, 0, 0, 6.283);
    ctx.fill();
    ctx.restore();
    if (!img.complete || !img.naturalWidth) {
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(x, y + PLAT_DECK, p.w, PLAT_H - PLAT_DECK);
      return;
    }
    var mid = p.w - PLAT_CAP_W * 2;
    ctx.drawImage(img, 0, 0, PLAT_CAP, PLAT_SRC_H, x, y, PLAT_CAP_W, PLAT_H);
    if (mid > 0) ctx.drawImage(img, 130, 0, 40, PLAT_SRC_H, x + PLAT_CAP_W, y, mid, PLAT_H);
    ctx.drawImage(img, PLAT_SRC_W - PLAT_CAP, 0, PLAT_CAP, PLAT_SRC_H,
      x + p.w - PLAT_CAP_W, y, PLAT_CAP_W, PLAT_H);
  }

  function drawBubble(x, y, r) {
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, PAL.ice);
    g.addColorStop(1, PAL.iceDk);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.32, y - r * 0.42, r * 0.3, r * 0.19, -0.7, 0, 6.283);
    ctx.fill();
  }

  /* three tapered arms, the way the power-up is drawn in the level art */
  function drawSwirl(x, y, r, rot, c1, c2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    for (var a = 0; a < 3; a++) {
      ctx.rotate(2.0944);
      ctx.fillStyle = a === 1 ? c2 : c1;
      for (var i = 0; i <= 22; i++) {
        var t = i / 22;
        var an = t * 2.35;
        var rad = r * (0.13 + 0.87 * t);
        var dot = r * 0.235 * Math.sin(Math.PI * (0.14 + 0.82 * t));
        if (dot <= 0.2) continue;
        ctx.beginPath();
        ctx.arc(Math.cos(an) * rad, Math.sin(an) * rad, dot, 0, 6.283);
        ctx.fill();
      }
    }
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.17, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  function drawCap(c) {
    var x = c.x - S.camX, y = c.y;
    ctx.save();
    for (var i = c.trail.length - 1; i >= 1; i--) {
      var f = (c.trail.length - i) / c.trail.length;
      ctx.globalAlpha = 0.30 * f;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = CAP_R * 1.5 * f;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c.trail[i].x - S.camX, c.trail[i].y);
      ctx.lineTo(c.trail[i - 1].x - S.camX, c.trail[i - 1].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.translate(x, y); ctx.rotate(c.spin);
    ctx.fillStyle = PAL.cap;
    ctx.beginPath(); ctx.arc(0, 0, CAP_R, 0, 6.283); ctx.fill();
    ctx.strokeStyle = PAL.navy; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, CAP_R - 1.2, 0, 6.283); ctx.stroke();
    ctx.strokeStyle = 'rgba(47,51,99,.55)'; ctx.lineWidth = 1.6;
    for (var k = 0; k < 12; k++) {
      var a = k / 12 * 6.283;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * CAP_R * 0.62, Math.sin(a) * CAP_R * 0.62);
      ctx.lineTo(Math.cos(a) * (CAP_R - 2.4), Math.sin(a) * (CAP_R - 2.4));
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(220,244,255,.9)';
    ctx.beginPath(); ctx.arc(0, 0, CAP_R * 0.45, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath();
    ctx.ellipse(-CAP_R * 0.16, -CAP_R * 0.2, CAP_R * 0.22, CAP_R * 0.13, -0.7, 0, 6.283);
    ctx.fill();
    ctx.restore();
  }

  function drawHopster(hp) {
    var img = IMG.hopster;
    var bob = Math.sin(hp.ph) * 6;
    var x = hp.x - S.camX - HOP_W / 2, y = hp.y - HOP_H + bob;
    ctx.save();
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x + HOP_W / 2, hp.y + 4, HOP_W * 0.34, 7, 0, 0, 6.283); ctx.fill();
    ctx.restore();
    if (img.complete && img.naturalWidth) ctx.drawImage(img, x, y, HOP_W, HOP_H);
  }

  function drawPlayer() {
    var img = IMG.runner;
    var left = S.px - S.camX - ANCHOR * PW;
    var top = S.py - FOOT;

    if (S.immune > 0) {
      var pulse = S.immune < 2.5 ? (Math.sin(S.t * 18) > -0.3 ? 1 : 0.25) : 1;
      ctx.save();
      ctx.globalAlpha = 0.75 * pulse;
      drawSwirl(left + PW * ANCHOR, top + PH * 0.55, PH * 0.62, S.t * 2.2, 'rgba(247,193,90,.85)', 'rgba(224,139,46,.85)');
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    var sh = Math.max(0.25, 1 - (GROUND - S.py) / 340);
    ctx.beginPath();
    ctx.ellipse(S.px - S.camX, GROUND + 6, PW * 0.30 * sh, 9 * sh, 0, 0, 6.283);
    ctx.fill();
    ctx.restore();

    if (!img.complete || !img.naturalWidth) return;
    ctx.save();
    if (S.dead) {
      ctx.translate(left + PW * ANCHOR, top + PH);
      ctx.rotate(S.tilt);
      ctx.drawImage(img, S.frame * FW, 0, FW, FH, -PW * ANCHOR, -PH, PW, PH);
    } else {
      ctx.drawImage(img, S.frame * FW, 0, FW, FH, left, top, PW, PH);
    }
    ctx.restore();
  }

  function drawBits() {
    for (var i = 0; i < S.bits.length; i++) {
      var b = S.bits[i];
      ctx.globalAlpha = Math.max(0, b.life / b.max);
      ctx.fillStyle = b.col;
      ctx.beginPath(); ctx.arc(b.x - S.camX, b.y, b.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---- HUD ---- */
  function hudFont(size, weight, stretch) {
    ctx.font = weight + ' ' + size + 'px Archivo, "Arial Narrow", system-ui, sans-serif';
  }
  function drawHUD() {
    var pad = 34;

    // score
    ctx.save();
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    hudFont(15, 700);
    ctx.fillStyle = 'rgba(47,51,99,.72)';
    ctx.letterSpacing = '3px';
    ctx.fillText('SCORE', W - pad, pad + 12);
    hudFont(46, 300);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = PAL.navy;
    ctx.fillText(fmt(Math.round(S.score)), W - pad, pad + 58);
    hudFont(13, 600);
    ctx.letterSpacing = '2px';
    ctx.fillStyle = 'rgba(47,51,99,.5)';
    ctx.fillText('BEST ' + fmt(hi), W - pad, pad + 80);
    ctx.restore();

    // carbonation gauge
    var gw = 260, gh = 16, gx = pad, gy = pad + 30;
    ctx.save();
    ctx.textAlign = 'left';
    hudFont(15, 700);
    ctx.letterSpacing = '3px';
    ctx.fillStyle = 'rgba(47,51,99,.72)';
    ctx.fillText('CARBONATION', gx, gy - 10);
    ctx.letterSpacing = '0px';
    var r = gh / 2;
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    rrect(gx, gy, gw, gh, r); ctx.fill();
    var f = S.fizz / FIZZ_MAX;
    var low = f < 0.25;
    var g2 = ctx.createLinearGradient(gx, 0, gx + gw, 0);
    if (low) { g2.addColorStop(0, '#ff7a5c'); g2.addColorStop(1, '#ffb08c'); }
    else { g2.addColorStop(0, PAL.iceDk); g2.addColorStop(1, '#eaf7ff'); }
    ctx.fillStyle = g2;
    if (f > 0.001) { rrect(gx, gy, Math.max(gh, gw * f), gh, r); ctx.fill(); }
    ctx.strokeStyle = 'rgba(47,51,99,.55)'; ctx.lineWidth = 2;
    rrect(gx, gy, gw, gh, r); ctx.stroke();
    // bubbles inside the gauge
    ctx.save();
    rrect(gx, gy, Math.max(gh, gw * f), gh, r); ctx.clip();
    for (var i = 0; i < 7; i++) {
      var bx = gx + ((S.t * 40 + i * 37) % (gw * f + 20));
      var by = gy + gh * 0.5 + Math.sin(S.t * 3 + i) * 3.5;
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, 6.283); ctx.fill();
    }
    ctx.restore();
    if (low && Math.sin(S.t * 9) > 0) {
      hudFont(13, 700);
      ctx.letterSpacing = '2px';
      ctx.fillStyle = '#d8452b';
      ctx.fillText('GOING FLAT! GRAB BUBBLES', gx, gy + gh + 18);
      ctx.letterSpacing = '0px';
    }

    // immunity timer
    if (S.immune > 0) {
      var iy = gy + gh + 34;
      drawSwirl(gx + 13, iy + 2, 15, S.t * 3, PAL.amber, PAL.amberDk);
      hudFont(15, 700);
      ctx.letterSpacing = '2px';
      ctx.fillStyle = PAL.amberDk;
      ctx.fillText('IMMUNE ' + S.immune.toFixed(1) + 's', gx + 34, iy + 8);
      ctx.letterSpacing = '0px';
    }

    // cap cooldown pip
    var cx0 = gx, cy0 = H - pad - 6;
    ctx.globalAlpha = S.cooldown > 0 ? 0.35 : 1;
    ctx.save(); ctx.translate(cx0 + 12, cy0 - 10);
    ctx.fillStyle = PAL.cap;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.283); ctx.fill();
    ctx.restore();
    hudFont(13, 600);
    ctx.letterSpacing = '2px';
    ctx.fillStyle = 'rgba(47,51,99,.6)';
    ctx.fillText('J = POP A CAP', cx0 + 32, cy0 - 5);
    ctx.globalAlpha = 1;
    ctx.letterSpacing = '0px';
    ctx.restore();
  }
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawWorld();

    for (var i = 0; i < S.plats.length; i++) drawPlat(S.plats[i]);

    for (var s = 0; s < S.swirls.length; s++) {
      var sw = S.swirls[s];
      if (sw.got) continue;
      drawSwirl(sw.x - S.camX, sw.y + Math.sin(sw.ph) * 5, SWIRL_R, S.t * 2, PAL.amber, PAL.amberDk);
    }
    for (var b = 0; b < S.bubbles.length; b++) {
      var bu = S.bubbles[b];
      if (bu.got) continue;
      drawBubble(bu.x - S.camX, bu.y + Math.sin(bu.ph) * 6, BUB_R);
    }
    for (var h = 0; h < S.hops.length; h++) if (!S.hops[h].dead) drawHopster(S.hops[h]);
    for (var c = 0; c < S.caps.length; c++) if (S.caps[c].life > 0) drawCap(S.caps[c]);

    drawPlayer();
    drawBits();

    // foreground road streaks for a little depth
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    var sy = GROUND + (H - GROUND) * 0.72;
    var step = 190, off = -((S.camX * 1.35) % step);
    for (var k = -1; k < W / step + 1; k++) {
      var x0 = off + k * step;
      ctx.beginPath(); ctx.moveTo(x0, sy); ctx.lineTo(x0 + 62, sy); ctx.stroke();
    }
    ctx.restore();

    drawHUD();
  }

  /* ---------------- loop ---------------- */
  var last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!last) last = ts;
    var dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (mode === 'play') { update(dt); draw(); }
    else if (mode === 'over') { draw(); }
    else if (mode === 'paused') { draw(); drawPaused(); }
  }

  function drawPaused() {
    ctx.save();
    ctx.fillStyle = 'rgba(47,51,99,.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    hudFont(44, 800);
    ctx.letterSpacing = '4px';
    ctx.fillText('PAUSED', W / 2, H / 2 - 6);
    hudFont(15, 600);
    ctx.letterSpacing = '3px';
    ctx.fillText('PRESS ESC TO KEEP RUNNING', W / 2, H / 2 + 30);
    ctx.restore();
  }

  window.addEventListener('blur', function () { if (mode === 'play') mode = 'paused'; });

  /* ---------------- fit ---------------- */
  function fit() {
    var r = root.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    root.style.setProperty('--u', (r.width / 880) + 'px');
    root.style.setProperty('--v', (r.width / 1399) + 'px');
  }
  window.addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', fit);
  document.addEventListener('webkitfullscreenchange', fit);

  var btnFull = document.querySelector('.br-full');
  if (btnFull) {
    if (!root.requestFullscreen && !root.webkitRequestFullscreen) {
      btnFull.style.display = 'none';
    } else {
      btnFull.addEventListener('click', function () {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
        }
        setTimeout(fit, 120);
      });
    }
  }

  reset();
  fit();
  elHiTitle.textContent = fmt(hi);
  root.classList.add('is-title');
  requestAnimationFrame(frame);
  if (elLoad) setTimeout(function () { root.classList.add('is-ready'); }, 4000);
})();
