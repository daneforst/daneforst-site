/* ============================================================
   THE LAB: behavior for the experimental wing
   Loads after main.js, which already handles the nav, the mobile
   menu and the GSAP .reveal pass. Nothing here depends on GSAP;
   if it never loads, every section still works.

   Performance is the governing constraint: these pages carry
   dozens of clips, so no <video> gets a src until it is close to
   the viewport, and only clips actually on screen are ever
   playing. Everything pauses when the tab goes away.
   ============================================================ */
(function(){
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  /* ---------------------------------------------------------
     1. Lazy clips
     Markup contract:
       <video class="labvid" data-src="path.mp4" poster="path.jpg"
              muted loop playsinline preload="none"></video>
     The src is attached one viewport ahead of arrival, playback
     starts only once the clip is genuinely visible, and stops the
     moment it leaves. Saves both bandwidth and decoder slots,
     which is what actually stalls a page full of video.
     --------------------------------------------------------- */
  var playing = [];

  function hydrate(v){
    if(v.dataset.hydrated) return;
    v.dataset.hydrated = '1';
    v.src = v.dataset.src;
    v.load();
  }

  function start(v){
    hydrate(v);
    var p = v.play();
    if(p && p.catch) p.catch(function(){ /* autoplay refused: poster stands in */ });
    if(playing.indexOf(v) < 0) playing.push(v);
  }

  function stop(v){
    if(!v.paused) v.pause();
    var i = playing.indexOf(v);
    if(i >= 0) playing.splice(i,1);
  }

  function initLazyVideo(){
    var vids = document.querySelectorAll('video.labvid');
    if(!vids.length) return;

    if(!hasIO){
      // No observer: load them, but leave them paused behind their
      // posters rather than kicking off dozens of downloads.
      return;
    }

    // near = attach the src early so playback can begin instantly
    var near = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting) hydrate(e.target); });
    }, {rootMargin:'400px 0px'});

    // live = play/pause on real visibility
    var live = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting && !reduced) start(e.target);
        else stop(e.target);
      });
    }, {threshold:0.25});

    Array.prototype.forEach.call(vids, function(v){
      v.muted = true;               // required for autoplay everywhere
      v.setAttribute('playsinline','');
      near.observe(v);
      if(reduced) hydrate(v);       // show a real first frame, don't animate
      else live.observe(v);
    });

    document.addEventListener('visibilitychange', function(){
      if(document.hidden) playing.slice().forEach(stop);
    });
  }

  /* ---------------------------------------------------------
     2. Hero stage
     One clip on screen at a time, crossfading between two video
     elements. Every few passes the stage flinches, which is the
     only piece of deliberate strangeness in the hero.
     --------------------------------------------------------- */
  function initHeroStage(){
    var stage = document.querySelector('.lh-stage');
    if(!stage) return;
    var srcs;
    try{ srcs = JSON.parse(stage.dataset.clips || '[]'); }catch(e){ srcs = []; }
    if(!srcs.length) return;

    var a = stage.querySelector('video.a'), b = stage.querySelector('video.b');
    if(!a || !b) return;
    var i = 0, front = a, back = b, passes = 0;

    function load(v, src, then){
      v.src = src;
      v.muted = true; v.loop = true;
      v.addEventListener('canplay', function h(){
        v.removeEventListener('canplay', h);
        if(then) then();
      });
      v.load();
    }

    load(front, srcs[0], function(){
      front.play().catch(function(){});
      front.classList.add('on');
    });

    if(reduced || srcs.length < 2) return;

    setInterval(function(){
      i = (i + 1) % srcs.length;
      load(back, srcs[i], function(){
        back.play().catch(function(){});
        back.classList.add('on');
        front.classList.remove('on');
        var old = front; front = back; back = old;
        setTimeout(function(){ back.pause(); back.removeAttribute('src'); back.load(); }, 1300);

        // the flinch, roughly every third change
        passes++;
        if(passes % 3 === 0){
          stage.classList.add('jolt');
          setTimeout(function(){ stage.classList.remove('jolt'); }, 130);
        }
      });
    }, 5200);
  }

  /* ---------------------------------------------------------
     3. Specimen peek
     Hovering a row on the index drags a live preview along with
     the cursor. One <video> is reused for every row, so this
     costs a single clip no matter how long the index grows.
     --------------------------------------------------------- */
  function initPeek(){
    var index = document.querySelector('.spec-index');
    if(!index || reduced) return;

    // Built on first qualifying hover rather than at boot. Viewport width
    // is not settled at DOMContentLoaded (and the window can be resized
    // later), so testing it once up front would strand the preview.
    var peek = null, pv = null, tag = null;

    function eligible(){
      return !window.matchMedia('(hover:none)').matches && window.innerWidth >= 821;
    }

    function build(){
      if(peek) return true;
      if(!eligible()) return false;
      peek = document.createElement('div');
      peek.className = 'spec-peek';
      peek.innerHTML = '<video muted loop playsinline preload="none"></video><span class="pk-tag"></span>';
      document.body.appendChild(peek);
      pv = peek.querySelector('video');
      tag = peek.querySelector('.pk-tag');
      return true;
    }

    var x = 0, y = 0, tx = 0, ty = 0, raf = null, on = false;

    function place(){
      peek.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + (on ? 1 : 0.9) + ')';
    }

    function loop(){
      // trail behind the cursor rather than pinning to it
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      place();
      raf = requestAnimationFrame(loop);
    }

    function hide(){
      on = false;
      if(peek) peek.classList.remove('on');
      if(pv) pv.pause();
    }

    index.addEventListener('pointermove', function(e){
      if(e.pointerType === 'touch' || !peek) return;
      tx = e.clientX + 26; ty = e.clientY - 14;
      if(!raf){ x = tx; y = ty; raf = requestAnimationFrame(loop); }
    });

    index.querySelectorAll('.spec-row').forEach(function(row){
      row.addEventListener('pointerenter', function(e){
        if(e.pointerType === 'touch') return;
        var src = row.dataset.peek;
        if(!src || !build()) return;
        // First hover arrives before any pointermove. Seed the position and
        // paint it synchronously, or the panel shows up in the top-left
        // corner for a frame before the loop catches it.
        if(!raf){
          x = tx = e.clientX + 26; y = ty = e.clientY - 14;
          on = true; place();
          raf = requestAnimationFrame(loop);
        }
        if(pv.getAttribute('src') !== src){ pv.src = src; pv.load(); }
        pv.play().catch(function(){});
        tag.textContent = row.dataset.peekTag || '';
        on = true; peek.classList.add('on');
      });
      row.addEventListener('pointerleave', hide);
    });

    index.addEventListener('pointerleave', function(){
      hide();
      if(raf){ cancelAnimationFrame(raf); raf = null; }
    });
  }

  /* ---------------------------------------------------------
     4. Lightbox
     Two sources, one component:
       data-yt="ID"        -> a YouTube iframe, written on click
       data-full="path"    -> a local file with controls and sound
     Nothing from youtube.com is requested until someone asks for
     the film, so the page's cold load stays entirely first-party.
     --------------------------------------------------------- */
  function initLightbox(){
    var triggers = document.querySelectorAll('[data-play]');
    if(!triggers.length) return;

    var lb = document.createElement('div');
    lb.className = 'lab-lb';
    lb.setAttribute('role','dialog');
    lb.setAttribute('aria-modal','true');
    lb.setAttribute('aria-label','Film player');
    lb.innerHTML =
      '<div class="lb-stage">' +
        '<button class="lb-close" type="button">' +
          '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
            '<path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6"/></svg>Close</button>' +
      '</div>';
    document.body.appendChild(lb);

    var stage = lb.querySelector('.lb-stage');
    var closeBtn = lb.querySelector('.lb-close');
    var lastFocus = null;

    function clear(){
      stage.querySelectorAll('iframe,video').forEach(function(n){
        if(n.tagName === 'VIDEO'){ n.pause(); n.removeAttribute('src'); n.load(); }
        n.remove();
      });
    }

    function close(){
      lb.classList.remove('open');
      clear();
      document.body.style.overflow = '';
      if(lastFocus) lastFocus.focus();
    }

    function open(btn){
      lastFocus = btn;
      clear();
      stage.classList.toggle('portrait', btn.dataset.orient === 'portrait');

      var yt = btn.dataset.yt, full = btn.dataset.full;
      if(yt){
        var f = document.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + yt +
                '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
        f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
        f.allowFullscreen = true;
        f.title = btn.dataset.title || 'Film';
        stage.appendChild(f);
      } else if(full){
        var v = document.createElement('video');
        v.src = full; v.controls = true; v.autoplay = true;
        v.playsInline = true; v.setAttribute('playsinline','');
        if(btn.dataset.poster) v.poster = btn.dataset.poster;
        stage.appendChild(v);
        v.play().catch(function(){});
      } else {
        return; // nothing to show; the trigger should not have existed
      }

      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }

    triggers.forEach(function(t){
      t.addEventListener('click', function(e){ e.preventDefault(); open(t); });
    });
    closeBtn.addEventListener('click', close);
    lb.addEventListener('click', function(e){ if(e.target === lb) close(); });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && lb.classList.contains('open')) close();
    });
  }

  /* ---------------------------------------------------------
     5. Sound toggles on the locally hosted pieces
     Finished spots are cut with audio, so they get a way to hear
     it. They still arrive muted, because nothing should make
     noise at someone unprompted.
     --------------------------------------------------------- */
  function initSound(){
    document.querySelectorAll('[data-sound]').forEach(function(btn){
      var v = document.getElementById(btn.dataset.sound);
      if(!v) return;
      var label = btn.querySelector('.sb-t');
      btn.addEventListener('click', function(){
        v.muted = !v.muted;
        if(!v.muted){
          // an unmuted clip should not also be looping silently elsewhere
          playing.slice().forEach(function(o){ if(o !== v) stop(o); });
          v.play().catch(function(){});
        }
        if(label) label.textContent = v.muted ? 'Sound' : 'Mute';
        btn.setAttribute('aria-pressed', String(!v.muted));
      });
    });
  }

  /* ---------------------------------------------------------
     6. Toolkit churn
     The section's argument is that the tool list is disposable, so
     the list behaves that way: every few seconds one name is
     retired and another is marked current. Purely cosmetic.
     --------------------------------------------------------- */
  function initToolkit(){
    var list = document.querySelector('.tk-list');
    if(!list || reduced) return;
    var items = Array.prototype.slice.call(list.querySelectorAll('.tk-item'));
    if(items.length < 4) return;

    setInterval(function(){
      items.forEach(function(i){ i.classList.remove('gone','fresh'); });
      var a = Math.floor(Math.random() * items.length);
      var b = Math.floor(Math.random() * items.length);
      while(b === a) b = Math.floor(Math.random() * items.length);
      items[a].classList.add('gone');
      items[b].classList.add('fresh');
    }, 2600);
  }

  /* ---------------------------------------------------------
     boot
     --------------------------------------------------------- */
  function boot(){
    initLazyVideo();
    initHeroStage();
    initPeek();
    initLightbox();
    initSound();
    initToolkit();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
