/* flickwall.js — interactive "wheel of covers" carousel.
   Drifts gently when idle; grab with finger/mouse to pause and flick through,
   with momentum. Coverflow-style depth (center focused, sides angled back).
   Touch + mouse + keyboard. Progressive enhancement: without JS the cards
   simply stack. Activate on any element with [data-flickwall].
*/
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(root) {
    var viewport = root.querySelector('.fw-viewport');
    var track = root.querySelector('.fw-track');
    if (!viewport || !track) return;
    var cards = Array.prototype.slice.call(track.children);
    var n = cards.length;
    if (!n) return;
    var counter = root.querySelector('.fw-counter');

    var STEP_RATIO = 0.64; // spacing between card centers, as a fraction of card width (overlap = coverflow)
    var DRIFT = reduce ? 0 : 0.28; // idle auto-drift, px/frame
    var FRICTION = 0.94; // momentum decay
    var HOLD = 2600; // ms to hold after release before drift resumes

    var cardW = 0, step = 1, L = 1, vpW = 0;
    function measure() {
      vpW = viewport.clientWidth;
      cardW = cards[0].offsetWidth || 280;
      step = cardW * STEP_RATIO;
      L = n * step;
    }

    var p = 0;            // scroll position; increasing drifts cards left
    var v = 0;            // velocity, px/frame
    var dragging = false;
    var activePointer = null;
    var lastX = 0, dragVel = 0;
    var idleUntil = 0;
    var raf = 0;

    function frame(now) {
      if (!dragging) {
        if (now > idleUntil) v += (DRIFT - v) * 0.04; // ease back into gentle drift
        else v *= FRICTION;                            // momentum decay during hold
        p += v;
      }
      var half = L / 2, centered = 0, best = 1e9;
      for (var i = 0; i < n; i++) {
        var rel = ((i * step - p) % L + L) % L;
        if (rel > half) rel -= L;
        var d = rel / step;
        var ad = Math.min(Math.abs(d), 3.4);
        var s = 1 - ad * 0.16;
        var rotY = Math.max(-2.4, Math.min(2.4, d)) * -20;
        var tz = -ad * 90;
        var op = Math.max(0, 1 - ad * 0.2);
        var x = vpW / 2 + rel - cardW / 2;
        var c = cards[i];
        c.style.transform = 'translate(' + x.toFixed(1) + 'px,-50%) translateZ(' + tz.toFixed(1) + 'px) scale(' + s.toFixed(3) + ') rotateY(' + rotY.toFixed(2) + 'deg)';
        c.style.opacity = op.toFixed(3);
        c.style.zIndex = Math.round(1000 - Math.abs(rel));
        c.style.visibility = ad > 3.3 ? 'hidden' : 'visible';
        if (Math.abs(rel) < best) { best = Math.abs(rel); centered = i; }
      }
      if (counter) counter.textContent = pad(centered + 1) + ' / ' + pad(n);
      raf = requestAnimationFrame(frame);
    }
    function pad(x) { return (x < 10 ? '0' : '') + x; }

    // ---- drag ----
    function down(e) {
      dragging = true; v = 0; dragVel = 0; activePointer = e.pointerId; lastX = e.clientX;
      viewport.classList.add('dragging');
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
    }
    function move(e) {
      if (!dragging || (activePointer != null && e.pointerId !== activePointer)) return;
      var dx = e.clientX - lastX; lastX = e.clientX;
      p -= dx; dragVel = -dx;
    }
    function up(e) {
      if (!dragging) return;
      dragging = false; activePointer = null;
      v = Math.max(-45, Math.min(45, dragVel)); // flick momentum, clamped
      idleUntil = performance.now() + HOLD;
      viewport.classList.remove('dragging');
    }
    viewport.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    // ---- keyboard ----
    root.setAttribute('tabindex', '0');
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { p += step; v = 0; idleUntil = performance.now() + HOLD; e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { p -= step; v = 0; idleUntil = performance.now() + HOLD; e.preventDefault(); }
    });

    function start() { measure(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);

    start(); // start immediately so it's always live
    // pause the loop while fully off-screen (perf), resume when back in view
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) { if (!raf) { measure(); raf = requestAnimationFrame(frame); } }
          else { cancelAnimationFrame(raf); raf = 0; }
        });
      }, { threshold: 0 }).observe(root);
    }
  }

  function boot() {
    var nodes = document.querySelectorAll('[data-flickwall]');
    for (var i = 0; i < nodes.length; i++) init(nodes[i]);
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
