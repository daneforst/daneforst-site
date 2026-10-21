// Shared chrome: mobile nav + scroll reveal. No framework, matches the rest of the DEF toolchain.
(function(){
  var burger = document.querySelector('.nav-burger');
  var mnav = document.querySelector('.mnav');
  if (burger && mnav){
    burger.addEventListener('click', function(){
      var open = mnav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mnav.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        mnav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  if (prefersReduced || !('IntersectionObserver' in window)){
    targets.forEach(function(el){ el.classList.add('is-visible'); });
    return;
  }

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(function(el){ io.observe(el); });
})();
