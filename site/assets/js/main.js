
(function(){
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced) document.documentElement.classList.add('reduced');
  const hasGSAP = typeof gsap !== 'undefined';
  if(hasGSAP) document.documentElement.classList.add('has-gsap');

  /* ---------- mobile menu ---------- */
  const burger=document.querySelector('.burger');
  const mnav=document.getElementById('mnav');
  if(burger && mnav){
  function setMenu(open){
    burger.classList.toggle('open',open);
    mnav.classList.toggle('open',open);
    burger.setAttribute('aria-expanded',open);
    burger.setAttribute('aria-label',open?'Close menu':'Open menu');
    document.body.style.overflow=open?'hidden':'';
  }
  burger.addEventListener('click',()=>setMenu(!mnav.classList.contains('open')));
  mnav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
  addEventListener('keydown',e=>{ if(e.key==='Escape'&&mnav.classList.contains('open')) setMenu(false); });
  }

  /* ---------- work dropdown ---------- */
  const wdTrig=document.querySelector('.wd-trigger');
  const wd=document.getElementById('wd');
  if(wdTrig && wd){
    let closeT;
    const setWd=open=>{
      wd.classList.toggle('open',open);
      wdTrig.setAttribute('aria-expanded',open);
    };
    const soon=()=>{ closeT=setTimeout(()=>setWd(false),200); };
    const hold=()=>clearTimeout(closeT);
    wdTrig.addEventListener('mouseenter',()=>{hold();setWd(true);});
    wdTrig.addEventListener('mouseleave',soon);
    wd.addEventListener('mouseenter',hold);
    wd.addEventListener('mouseleave',soon);
    wdTrig.addEventListener('click',e=>{e.preventDefault();setWd(!wd.classList.contains('open'));});
    addEventListener('keydown',e=>{ if(e.key==='Escape') setWd(false); });
    document.addEventListener('click',e=>{ if(!wd.contains(e.target)&&e.target!==wdTrig) setWd(false); });
  }

  /* ---------- split hero words into letters ---------- */
  document.querySelectorAll('[data-k]').forEach(w=>{
    w.innerHTML = w.textContent.split('').map(c=>'<span class="ltr">'+c+'</span>').join('');
  });
  const letters = document.querySelectorAll('.ltr');

  /* ---------- preloader ---------- */
  const loader = document.getElementById('loader');
  const count = loader ? loader.querySelector('.count') : null;
  let introDone=false;
  function heroIntro(){
    if(introDone) return; introDone=true;
    if(!hasGSAP || reduced){ loader.style.display='none'; return; }
    gsap.to(loader,{yPercent:-100,duration:.9,ease:'power4.inOut',onComplete:()=>loader.remove()});
    gsap.fromTo(letters,
      {fontVariationSettings:"'wdth' 62",opacity:0,yPercent:30},
      {fontVariationSettings:"'wdth' 125",opacity:1,yPercent:0,duration:1.2,ease:'power4.out',stagger:.05,delay:.35});
    gsap.from('.hero-eyebrow, .hero-foot, .hero .role',{opacity:0,y:14,duration:.8,stagger:.07,delay:.7,ease:'power2.out'});
  }
  if(loader && hasGSAP && !reduced){
    const o={v:0};
    gsap.to(o,{v:100,duration:1.1,ease:'power2.inOut',
      onUpdate:()=>count.textContent=String(Math.round(o.v)).padStart(2,'0'),
      onComplete:heroIntro});
  } else if(loader){ loader.style.display='none'; }
  // safety: never strand the loader
  if(loader) setTimeout(()=>{ const l=document.getElementById('loader'); if(l){ l.remove(); if(hasGSAP&&!reduced) heroIntro(); } },3500);

  /* ---------- kinetic letter width on hover ---------- */
  if(hasGSAP && !reduced){
    letters.forEach(l=>{
      l.addEventListener('mouseenter',()=>{
        gsap.to(l,{fontVariationSettings:"'wdth' 62",duration:.3,ease:'power2.out'});
        gsap.to(l,{fontVariationSettings:"'wdth' 125",duration:.9,ease:'elastic.out(1,.45)',delay:.25});
      });
    });
  }

  /* ---------- Three.js ink-smear hero ---------- */
  (function(){
    if(typeof THREE === 'undefined') return;
    const canvas = document.getElementById('ink');
    if(!canvas) return;
    let renderer;
    try{ renderer = new THREE.WebGLRenderer({canvas, antialias:false}); }
    catch(e){ return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

    // offscreen trail canvas — pointer paints, paint slowly dries
    const T = 256;
    const trail = document.createElement('canvas'); trail.width=trail.height=T;
    const tctx = trail.getContext('2d');
    tctx.fillStyle='#000'; tctx.fillRect(0,0,T,T);
    const trailTex = new THREE.CanvasTexture(trail);
    const mouse = {x:.5,y:.6,px:.5,py:.6,active:false};

    const uniforms = {
      uTime:{value:0},
      uTrail:{value:trailTex},
      uRes:{value:new THREE.Vector2(1,1)},
      uMask:{value:null},
      uMaskOn:{value:0},
      uMaskScale:{value:.72},
      uSun:{value:new THREE.Color('#ff8330')},
      uRose:{value:new THREE.Color('#ff4d8c')},
      uBone:{value:new THREE.Color('#E4E0D4')},
      uSoot:{value:new THREE.Color('#141310')}
    };
    // Baron Minker serpent — smoke condenses into this shape
    const serpent = new Image();
    serpent.onload = function(){
      const mc = document.createElement('canvas'); mc.width = mc.height = 1024;
      const mx = mc.getContext('2d');
      const r = Math.min(1024/serpent.width, 1024/serpent.height) * .94;
      const w = serpent.width*r, h = serpent.height*r;
      mx.drawImage(serpent, (1024-w)/2, (1024-h)/2, w, h);
      const mt = new THREE.CanvasTexture(mc);
      uniforms.uMask.value = mt;
      maskTarget = 1;
    };
    serpent.src = 'assets/img/serpent.svg';
    let maskTarget = 0;

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}',
      fragmentShader:`
        varying vec2 vUv;
        uniform float uTime; uniform sampler2D uTrail; uniform vec2 uRes;
        uniform sampler2D uMask; uniform float uMaskOn, uMaskScale;
        uniform vec3 uSun, uRose, uBone, uSoot;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                     mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
          float v=0., a=.5;
          for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; }
          return v;
        }
        void main(){
          vec2 uv=vUv;
          vec2 asp=vec2(uRes.x/uRes.y,1.);
          float t=uTime*.04;
          // slow ambient ink field
          vec2 q=vec2(fbm(uv*asp*2.2+t), fbm(uv*asp*2.2-t*1.3+5.2));
          float field=fbm(uv*asp*3.0+q*1.6);
          // serpent mask — smoke condenses into the shape
          if(uMaskOn>.001){
            vec2 p=(uv-vec2(.5,.46)); p.x*=asp.x;
            vec2 muv=p/uMaskScale+.5;
            muv+=(vec2(fbm(uv*asp*5.5+t*2.2),fbm(uv*asp*5.5-t*1.8+3.1))-.5)*.05;
            float m=0.;
            if(muv.x>0.&&muv.x<1.&&muv.y>0.&&muv.y<1.) m=texture2D(uMask,muv).a;
            // easter egg: the serpent only condenses where ink has been painted
            float reveal=smoothstep(.06,.4,texture2D(uTrail,uv).r);
            float breathe=.46+.07*sin(uTime*.5);
            field+=m*breathe*uMaskOn*reveal*(.85+.35*fbm(uv*asp*4.+t));
          }
          // painted trail displaces & reveals
          float trl=texture2D(uTrail,uv).r;
          field += trl*1.1;
          float ink=smoothstep(.62,.97,field);
          float edge=smoothstep(.58,.62,field)-smoothstep(.62,.66,field);
          // ink hue drifts between sunset orange and rose
          float hueMix=clamp(fbm(uv*asp*1.4 - t*1.1 + 9.7)*1.5-.25,0.,1.);
          vec3 inkCol=mix(uSun,uRose,hueMix);
          vec3 col=uSoot;
          col=mix(col,inkCol,ink*.93);
          col+=inkCol*edge*.45;
          // faint bone flecks where trail is strongest (wet highlight)
          col=mix(col,uBone,smoothstep(.75,1.,trl)*.12);
          // paper grain
          float g=hash(uv*uRes.xy*.5+uTime);
          col+= (g-.5)*.055;
          // vignette
          float vig=smoothstep(1.25,.45,length(uv-.5));
          col*=mix(.82,1.,vig);
          gl_FragColor=vec4(col,1.);
        }`
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat));

    function resize(){
      const w=canvas.clientWidth||innerWidth, h=canvas.clientHeight||innerHeight;
      renderer.setSize(w,h,false);
      uniforms.uRes.value.set(w,h);
      uniforms.uMaskScale.value=Math.min(.72,.88*w/h);
    }
    resize(); addEventListener('resize',resize);

    function setPointer(cx,cy){
      const r=canvas.getBoundingClientRect();
      mouse.x=(cx-r.left)/r.width; mouse.y=(cy-r.top)/r.height; mouse.active=true;
    }
    addEventListener('pointermove',e=>setPointer(e.clientX,e.clientY),{passive:true});
    addEventListener('touchmove',e=>{ if(e.touches[0]) setPointer(e.touches[0].clientX,e.touches[0].clientY); },{passive:true});

    let last=0, raf;
    function tick(now){
      raf=requestAnimationFrame(tick);
      if(reduced){ render(now); cancelAnimationFrame(raf); return; }
      if(now-last<1000/45) return; last=now;
      render(now);
    }
    function render(now){
      // dry the paint
      tctx.globalCompositeOperation='source-over';
      tctx.fillStyle='rgba(0,0,0,0.035)'; tctx.fillRect(0,0,T,T);
      // lay paint along pointer path
      if(mouse.active){
        const steps=6;
        for(let i=0;i<steps;i++){
          const x=(mouse.px+(mouse.x-mouse.px)*i/steps)*T;
          const y=(mouse.py+(mouse.y-mouse.py)*i/steps)*T;
          const grad=tctx.createRadialGradient(x,y,0,x,y,26);
          grad.addColorStop(0,'rgba(255,255,255,0.5)');
          grad.addColorStop(1,'rgba(255,255,255,0)');
          tctx.fillStyle=grad;
          tctx.beginPath(); tctx.arc(x,y,26,0,7); tctx.fill();
        }
        mouse.px=mouse.x; mouse.py=mouse.y;
      }
      trailTex.needsUpdate=true;
      uniforms.uMaskOn.value+= (maskTarget-uniforms.uMaskOn.value)*.035;
      uniforms.uTime.value=now*.001;
      renderer.render(scene,cam);
    }
    // pause when hero off-screen
    const hero=document.querySelector('.hero');
    if('IntersectionObserver' in window){
      new IntersectionObserver(([en])=>{
        if(en.isIntersecting){ cancelAnimationFrame(raf); raf=requestAnimationFrame(tick); }
        else cancelAnimationFrame(raf);
      }).observe(hero);
    } else raf=requestAnimationFrame(tick);
  })();

  /* ---------- GSAP scroll work ---------- */
  if(hasGSAP && !reduced && typeof ScrollTrigger !== 'undefined'){
    gsap.registerPlugin(ScrollTrigger);

    // reveals
    gsap.utils.toArray('.reveal').forEach(el=>{
      gsap.to(el,{opacity:1,y:0,duration:.9,ease:'power3.out',
        scrollTrigger:{trigger:el,start:'top 88%'}});
    });

    // full-page work panels
    const panels=gsap.utils.toArray('.wpanel');
    const dots=gsap.utils.toArray('.work-dots i');
    panels.forEach((p,i)=>{
      const img=p.querySelector('.bg img');
      gsap.fromTo(img,{yPercent:-8},{yPercent:8,ease:'none',
        scrollTrigger:{trigger:p,start:'top bottom',end:'bottom top',scrub:true}});
      gsap.from(p.querySelectorAll('.idx,h3,.tag'),{y:46,opacity:0,duration:1,stagger:.09,ease:'power3.out',
        scrollTrigger:{trigger:p,start:'top 62%'}});
      ScrollTrigger.create({trigger:p,start:'top 50%',end:'bottom 50%',
        onToggle(self){ if(self.isActive) dots.forEach((d,j)=>d.classList.toggle('on',j===i)); }});
    });

    // snap one project per viewport (desktop only, only while inside work section)
    const mm = gsap.matchMedia();
    mm.add('(min-width: 861px)', ()=>{
      const work = document.querySelector('.work');
      if(!work) return ()=>{};
      const panelH = ()=> window.innerHeight;
      const snapPositions = panels.map((_,i)=> work.offsetTop + i * panelH());
      const st = ScrollTrigger.create({
        trigger: '.work',
        start: 'top top',
        end: 'bottom bottom',
        snap: {
          snapTo: (value) => {
            // only snap if scroll position is actually inside the work section
            const y = window.scrollY;
            const wTop = work.offsetTop;
            const wBot = wTop + work.offsetHeight;
            if(y < wTop - 20 || y > wBot - window.innerHeight + 20) return -1; // -1 = no snap
            return Math.round(value * (panels.length-1)) / (panels.length-1);
          },
          duration: {min:.3, max:.6},
          ease: 'power2.inOut',
          delay: .12,
          inertia: false
        }
      });
      return ()=>st.kill();
    });
  } else {
    document.querySelectorAll('.reveal').forEach(el=>{el.style.opacity=1;el.style.transform='none';});
  }
})();
