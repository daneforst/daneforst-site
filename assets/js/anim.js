/* ============================================================
   ANIMATION: behaviour for the animation wing.
   Loads after main.js (nav, mobile menu, GSAP reveal pass) and
   after lab.js (lazy .labvid clips, the .lh-stage hero). Neither
   of those needs anything from here, and nothing here needs GSAP.

   There are exactly two jobs, and both are the same job: do not
   download a film until somebody asks for it.
   ============================================================ */
(function(){
  'use strict';

  /* ---------------------------------------------------------
     1. Embedded films (YouTube)
     Markup contract:
       <div class="an-stage" data-yt="VIDEOID">
         <img src="poster.jpg" alt="">
         <button class="an-play" type="button"> ... </button>
       </div>

     Until the button is pressed this is a still and a button.
     No youtube.com request, no player script, no cookie. On
     press we swap in a nocookie iframe already playing, which is
     what the visitor just asked for.

     The poster is one of our own frames, deliberately, rather
     than YouTube's thumbnail: a thumbnail URL is a third-party
     request, which is the exact thing this facade exists to
     avoid.
     --------------------------------------------------------- */
  function initEmbeds(){
    var stages = document.querySelectorAll('.an-stage[data-yt]');
    Array.prototype.forEach.call(stages, function(stage){
      var btn = stage.querySelector('.an-play');
      if(!btn) return;
      btn.addEventListener('click', function(){
        var id = stage.dataset.yt;
        if(!id) return;
        var f = document.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
                '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
        f.title = stage.dataset.title || 'Video';
        f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
        f.setAttribute('allowfullscreen','');
        f.setAttribute('loading','lazy');
        stage.appendChild(f);
        btn.hidden = true;
        var poster = stage.querySelector('img');
        if(poster) poster.hidden = true;
      });
    });
  }

  /* ---------------------------------------------------------
     2. Self-hosted films
     Markup contract:
       <div class="an-stage">
         <video controls preload="none" poster="poster.jpg">
           <source src="film.mp4" type="video/mp4">
         </video>
         <button class="an-play" type="button"> ... </button>
       </div>

     preload="none" already means no bytes move until play, so
     this is purely an affordance: the native poster-plus-small-
     triangle is a weak invitation for something that is the
     point of the page. The overlay stands down on play and comes
     back on end, so a finished film offers itself again rather
     than sitting on a frozen last frame.
     --------------------------------------------------------- */
  function initPlayers(){
    var stages = document.querySelectorAll('.an-stage > video');
    Array.prototype.forEach.call(stages, function(v){
      var stage = v.parentNode;
      var btn = stage.querySelector('.an-play');
      if(!btn) return;

      // The markup carries controls so the film is still playable
      // with no JS at all. Since we are here, JS did run, so the
      // control bar comes off until somebody actually starts the
      // film: a poster wearing both a big play disc and a native
      // scrubber is two invitations to do one thing.
      v.controls = false;

      btn.addEventListener('click', function(){
        btn.hidden = true;
        v.controls = true;
        var p = v.play();
        if(p && p.catch) p.catch(function(){ btn.hidden = false; });
      });
      // Pause is deliberately not handled: once somebody is in the
      // film the native controls are theirs, and putting the poster
      // overlay back over a paused frame would take them away.
      v.addEventListener('play',  function(){ btn.hidden = true;  });
      v.addEventListener('ended', function(){ btn.hidden = false; });
    });
  }

  function boot(){ initEmbeds(); initPlayers(); }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
