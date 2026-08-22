(function(){
  "use strict";

  /* ==================================================================
     CONFIG
     ================================================================== */

  /* The launcher is opt-in per page rather than global: the service pages want
     it, the project and gallery pages should stay clean. A page turns it on by
     adding data-launcher to its script tag:

       <script src="assets/js/def-quote.js?v=1" data-launcher></script>

     Everything else here is site-wide. */

  var TAG = document.currentScript ||
            document.querySelector('script[src*="def-quote.js"]');

  var CONFIG = {
    TO: "daneforst@gmail.com",
    FORM_ENDPOINT: "https://formspree.io/f/xqeowkby",  // same endpoint as the contact form
    LAUNCHER: !!(TAG && TAG.hasAttribute("data-launcher")),
    LAUNCHER_TEXT: (TAG && TAG.getAttribute("data-launcher-text")) || "Need a quote?",
    LAUNCHER_AFTER_SCROLL: 0.18, // show once this fraction of the page is scrolled
    LAUNCHER_AFTER_MS: 12000,    // or after this long, whichever comes first
    OPEN_TAB: "scope"          // "scope" or "pricing"
  };

  var TIER_WORD = ["Tier 1","Tier 2","Tier 3"];

  /* ==================================================================
     PRICING DATA
     Verbatim from the Dane Erik Forst Design Sales Sheets V2.
     Prices, bullets, and notes unedited.
     ================================================================== */

  var DATA = [
    {id:"logo", name:"Logo Design", desc:"Professional identity design for brands, artists, and businesses",
     note:"Additional revisions or expanded scope billed at hourly rate.",
     tiers:[
      {name:"Logo Essentials", best:"Best for logo refreshes and simple brand marks", price:800,
       items:["Simple logo design or existing logo refresh","2-3 concepts","Up to 3 revision rounds","Print & web-ready logo files (vector + raster formats)"]},
      {name:"Custom Logo Design", best:"Ideal for new businesses and growing brands", price:1500,
       items:["Custom logo design with icon or symbol","2-3 concepts","Up to 3 revision rounds","Print & web-ready logo files (vector + raster formats)"]},
      {name:"Signature Logo Design", best:"For brands that need a distinctive illustrated identity", price:2500,
       items:["Fully illustrated/custom type logo","2-3 concepts","Up to 3 revision rounds","Print & web-ready logo files (vector + raster formats)"]}
     ]},
    {id:"branding", name:"Branding Design", desc:"Expand your brand identity",
     note:"Additional revisions or expanded scope billed at hourly rate.",
     tiers:[
      {name:"Brand Starter Kit", best:"Essential visual tools to launch your brand", price:1500,
       items:["Color pallete / pantone selection","Logo usage guidelines","Business card template","Letterhead template"]},
      {name:"Brand Identity System", best:"A cohesive identity system for consistent brand presence", price:3000,
       items:["Color pallete / pantone selection","Typography system (primary + secondary fonts)","Mid-level brand guide","Business card template","Letterhead template","Social media profile graphics","Email signature design"]},
      {name:"Complete Brand Package", best:"A full brand framework designed for long-term growth", price:5000,
       items:["Color pallete / pantone selection","Comprehensive brand guide","Business card design template","Letterhead template","Social media post templates","Brand pattern or texture","Brand asset kit"]}
     ]},
    {id:"photo", name:"Photography & Videography", desc:"Custom photo and video production for artists, brands, events, and promotional campaigns",
     tiers:[
      {name:"Short Session", best:"Best for simple promotional shoots or quick content creation", price:800,
       note:"Additional, editing, extended shoot time, or expanded scope billed separately.",
       items:["Up to 2 hour photo or video shoot","Basic lighting and direction","Selection of edited images or short video clips","Up to 3 revision rounds on final edits","Web-ready digital delivery"]},
      {name:"Half Day Production", best:"Ideal for promotional shoots, brand content, or music visuals", price:1500,
       note:"Additional, editing, extended shoot time, or expanded scope billed separately.",
       items:["Up to 4 hour photo or video shoot","Creative direction and shot planning","Professional lighting setup if required","10-20 edited photos or short edited video","Up to 3 revision rounds","Web-ready and social media formats"]},
      {name:"Full Production", best:"For full promotional campaigns, music visuals, or larger productions", price:5000,
       note:"Final quote determined by production scope.",
       items:["Full day photo or video shoot","Pre-production planning and shot list","Multiple setups or locations if required","Expanded edited photo set or finished video piece","Up to 3 revision rounds","Final files delivered for web, social, or promotional use"]}
     ]},
    {id:"social", name:"Social Video & Digital Ads", desc:"Designed for Instagram, TikTok, YouTube Shorts, and digital advertising.",
     note:"Extended video length or expanded scope quoted per project.",
     tiers:[
      {name:"Short Promo Video", best:"Best for simple social media promotion", price:600,
       items:["Up to 30 seconds of video","Ideal for Instagram, TikTok, or ads","Custom visuals and motion graphics","One core concept","Up to 3 revision rounds"]},
      {name:"Promotional Video", best:"Ideal for marketing and brand promotion", price:1000,
       items:["Up to 60 seconds of video","Custom visual direction and editing","Motion graphics and transitions","Optimized for social media and ads","Up to 3 revision rounds"]},
      {name:"Campaign Video Package", best:"For brands running social campaigns or launches", price:2500,
       items:["Up to 60-90 second main video","Alternate short cuts for social media","Custom visuals and motion graphics","Multiple format exports (Reels / TikTok / Ads)","Up to 3 revision rounds"]}
     ]},
    {id:"album", name:"Album Art", desc:"Artwork services for musicians, labels, and independent artists",
     note:"Additional revisions or expanded scope billed at hourly rate.",
     tiers:[
      {name:"Digital Essentials", best:"Ideal for digital streaming releases", price:1200,
       items:["Single piece of art","Up to 3 revisions","Final digital formats"]},
      {name:"Physical Release", best:"Designed for physical media releases", price:2000,
       items:["Single piece of art","Up to 3 revisions","Final digital formats","Packaging layout for vinyl, CD, or cassette (inserts priced separately)"]},
      {name:"Full Campaign", best:"For full album launches and promotional campaigns", price:3500,
       items:["Single piece of art","Up to 3 revisions","Final digital formats","Packaging design for vinyl, CD or cassette (inserts extra)","Matching t-shirt & poster design","Social media promo graphics"]}
     ]},
    {id:"poster", name:"Poster & Key Art", desc:"Poster design for concerts, events, film, and promotional campaigns",
     note:"Custom sizing and print specifications included.",
     tiers:[
      {name:"Event & Promo Poster", best:"Best for straightforward event or promotional posters", price:900,
       note:"Additional revisions or expanded scope billed at hourly rate.",
       items:["Single poster design","Typography-driven layout or simple graphic elements","Up to 3 revision rounds","Print-ready and digital formats"]},
      {name:"Custom Poster Design", best:"Ideal for posters requiring custom graphics or illustrated elements", price:1500,
       note:"Additional revisions or expanded scope billed at hourly rate.",
       items:["Fully custom poster design","Custom illustration or graphic elements","Up to 3 revision rounds","Print-ready and digital formats","Alternate social media version"]},
      {name:"Key Art / Campaign Poster", best:"For posters that anchor a larger promotional campaign", price:3000,
       note:"Additional revisions or expanded scope billed at hourly rate.",
       items:["Highly detailed or illustrated poster design","Up to 3 revision rounds","Print-ready and digital formats","Social media promo graphics","Alternate layout variations"]}
     ]},
    {id:"web", name:"Web Design", desc:"Custom website design for businesses, artists, and organizations",
     note:"Development and hosting handled separately or in collaboration with developers.",
     tiers:[
      {name:"Starter Website", best:"Best for simple websites and small businesses", price:4000,
       note:"Additional revisions or expanded scope billed at hourly rate.",
       items:["Homepage + internal page layouts","Mobile-responsive design","Up to 3 revision rounds","Figma / Sketch design files"]},
      {name:"Business Website", best:"Ideal for growing businesses and more complex websites", price:6000,
       note:"Additional revisions or expanded scope billed at hourly rate.",
       items:["Design of a 6-10 page website","Homepage + multiple custom page layouts","Mobile-responsive design","Basic UX planning / site structure","Up to 3 revision rounds","Figma / Sketch design files"]},
      {name:"Custom Web Platform", best:"For complex websites, applications, and bespoke digital experiences", price:10000,
       note:"Additional revisions or expanded scope billed at hourly rate.",
       items:["Fully custom website","Advanced UX planning and wireframes","Custom page templates and interface systems","Mobile-responsive design","Collaboration with developers if required"]}
     ]},
    {id:"app", name:"App Design", desc:"Interface and UX design for mobile apps and digital platforms",
     note:"Additional revisions or expanded scope billed at hourly rate.",
     tiers:[
      {name:"App Prototype", best:"Best for early-stage apps and concept validation", price:6000,
       items:["Design of core app interface screens","Basic user flow planning","Mobile interface layouts","Up to 3 revision rounds","Figma / Sketch design files"]},
      {name:"App Interface System", best:"Ideal for startups and apps preparing for development", price:8000,
       items:["Design of multiple app screens and flows","Interface component system","Mobile UX planning and screen structure","Up to 3 revision rounds","Figma / Sketch design files"]},
      {name:"Full App Experience", best:"For complex applications and fully developed product concepts", price:15000,
       items:["Complete app interface design","Advanced UX planning and user journeys","Interface design system and components","Multiple screen templates and states","Collaboration with development teams if required"]}
     ]},
    {id:"packaging", name:"Packaging Design", desc:"Custom packaging and label design for beverages, retail products, and specialty goods",
     note:"Additional revisions or expanded scope billed at hourly rate.",
     tiers:[
      {name:"Single Product Label", best:"Best for individual product releases or small runs", price:1500,
       items:["Design of a single product label or package","Custom typography and layout","Print-ready production files","Up to 3 revision rounds","Coordination with printer specifications if needed"]},
      {name:"Product Line Packaging", best:"Ideal for brands launching multiple products or variations", price:4000,
       items:["Label design for 2-4 product variations","Cohesive packaging system across products","Custom typography and graphic elements","Print-ready production files","Up to 3 revision rounds"]},
      {name:"Complete Packaging System", best:"For brands developing a full product line and packaging identity", price:10000,
       items:["Packaging design system for multiple products","Label + packaging layout structure","Custom typography and graphic elements","Coordination with printers / manufacturers","Packaging mockups for marketing"]}
     ]}
  ];

  /* ==================================================================
     DIAGNOSTIC
     Each answer carries points. Points decide the tier. Some answers
     carry a hard floor: the result cannot resolve below that tier no
     matter what else is said. `why` is echoed back as the reasoning.
     cuts = [max score for Tier 1, max score for Tier 2]
     ================================================================== */

  var DIAG = {

    logo: { cuts:[2,5], qs:[
      { q:"Is there an existing logo, or are we starting from nothing?",
        a:[{l:"Refreshing something that exists",p:0},
           {l:"Starting from scratch",p:2,why:"Starting from scratch instead of refreshing"},
           {l:"There's a rough sketch or idea",p:1,why:"Working from a rough concept"}]},
      { q:"What does the mark need to be?",
        a:[{l:"Text only, a clean wordmark",p:0},
           {l:"A wordmark plus an icon or symbol",p:2,why:"Wordmark plus a custom icon or symbol"},
           {l:"Illustrated, or custom-drawn lettering",p:5,floor:2,why:"Illustrated or custom-drawn lettering, which is Tier 3 work by definition"},
           {l:"Not sure yet",p:2,why:"The mark's form is still open, which widens the exploration"}]},
      { q:"How many separate pieces or elements does it need to hold? Think icons, badges, sub-marks, text lockups.",
        a:[{l:"One clean mark",p:0},
           {l:"Two or three related pieces",p:2,why:"Multiple related marks rather than one"},
           {l:"Four or more elements in one identity",p:4,floor:2,why:"Four or more elements in a single identity, which is a system, not a mark"}]},
      { q:"Where does it have to work?",
        a:[{l:"Mostly digital, a few basics",p:0},
           {l:"Web, print, and signage",p:1,why:"Needs to hold up across print and signage, not just screens"},
           {l:"Everywhere, including merch and small sizes",p:2,why:"Merch and small-size applications, which need extra lockups"}]},
      { q:"Who has to sign off?",
        a:[{l:"Me, or me and one other person",p:0},
           {l:"A small team",p:1,why:"Team sign-off, which usually means more rounds"},
           {l:"A committee, board, or client of yours",p:2,why:"Committee or third-party approval, which usually means more rounds"}]}
    ]},

    branding: { cuts:[2,6], qs:[
      { q:"What already exists?",
        a:[{l:"A finished logo, nothing else",p:0},
           {l:"A logo and a couple of pieces",p:1,why:"Some pieces exist but nothing ties them together"},
           {l:"Nothing yet",p:2,why:"Building the system from nothing"}]},
      { q:"Who else has to use these files?",
        a:[{l:"Just me",p:0},
           {l:"A few collaborators",p:1,why:"Multiple people using the files"},
           {l:"A team or outside vendors who need rules to follow",p:3,why:"Outside vendors need documented rules, which means a real brand guide"}]},
      { q:"Where does the brand need to show up?",
        a:[{l:"Cards and letterhead",p:0},
           {l:"Those plus a social presence",p:2,why:"Social presence on top of print basics"},
           {l:"Everything, including ongoing social templates",p:4,floor:2,why:"Ongoing social templates and asset needs, which is a full framework"}]},
      { q:"Do you need patterns, textures, or a reusable asset kit?",
        a:[{l:"No, keep it lean",p:0},
           {l:"Maybe, if it fits",p:1,why:"Possible pattern or texture work"},
           {l:"Yes, that's the point",p:3,why:"Patterns, textures, and a reusable asset kit"}]}
    ]},

    photo: { cuts:[2,6], qs:[
      { q:"How much needs to get shot?",
        a:[{l:"One setup, in and out",p:0},
           {l:"A handful of looks or scenes",p:2,why:"Multiple looks or scenes in one session"},
           {l:"A full day, possibly multiple locations",p:5,floor:2,why:"Full day and multiple locations, which is a full production"}]},
      { q:"Is there a concept to build, or are we documenting what's there?",
        a:[{l:"Just capture it cleanly",p:0},
           {l:"Some direction and shot planning",p:1,why:"Creative direction and shot planning required"},
           {l:"It needs pre-production, a shot list, and coordination",p:3,why:"Pre-production, shot list, and coordination"}]},
      { q:"Lighting?",
        a:[{l:"Available light is fine",p:0},
           {l:"Controlled lighting setup",p:2,why:"Professional lighting setup"}]},
      { q:"How much finished material do you need out of it?",
        a:[{l:"A small selection",p:0},
           {l:"Ten to twenty images, or a short edit",p:1,why:"A substantial edited set"},
           {l:"An expanded set or a finished video piece",p:3,why:"An expanded photo set or a finished video piece"}]}
    ]},

    social: { cuts:[2,5], qs:[
      { q:"How long is the main video?",
        a:[{l:"Under 30 seconds",p:0},
           {l:"Around a minute",p:2,why:"Roughly a minute of finished video"},
           {l:"60 to 90 seconds, plus shorter cuts",p:4,floor:2,why:"A main video plus alternate cutdowns"}]},
      { q:"How many versions do you need?",
        a:[{l:"One",p:0},
           {l:"A couple of aspect ratios",p:1,why:"Multiple aspect ratios"},
           {l:"Exports for every platform, plus alternates",p:3,why:"Platform-specific exports and alternate cuts"}]},
      { q:"What's happening visually?",
        a:[{l:"Simple text and transitions",p:0},
           {l:"Custom visuals and motion graphics",p:2,why:"Custom visuals and motion graphics"}]},
      { q:"Is this a one-off, or part of a launch?",
        a:[{l:"One-off post",p:0},
           {l:"Part of a campaign or launch",p:2,why:"Part of a campaign rollout rather than a single post"}]}
    ]},

    album: { cuts:[2,5], qs:[
      { q:"How is this releasing?",
        a:[{l:"Streaming only",p:0},
           {l:"Physical: vinyl, CD, or cassette",p:3,floor:1,why:"Physical release, which needs packaging layout, not just a square"},
           {l:"Physical plus a full campaign rollout",p:6,floor:2,why:"Physical release inside a full campaign rollout"}]},
      { q:"Beyond the cover art, what else do you need?",
        a:[{l:"Just the cover",p:0},
           {l:"A few social assets",p:1,why:"Social promo assets alongside the cover"},
           {l:"Merch, posters, and promo graphics",p:3,floor:2,why:"Merch and poster design on top of the record"}]},
      { q:"Inserts, gatefold, lyric sheet, anything inside the package?",
        a:[{l:"No",p:0},
           {l:"Yes",p:2,why:"Interior package pieces"},
           {l:"Not sure yet",p:1,why:"Interior pieces still undecided"}]},
      { q:"Is the artwork illustrated, photographic, or type-driven?",
        a:[{l:"Type-driven or photo I'm supplying",p:0},
           {l:"Illustrated or heavily manipulated",p:2,why:"Illustrated or heavily manipulated artwork"}]}
    ]},

    poster: { cuts:[2,5], qs:[
      { q:"What carries the design?",
        a:[{l:"Typography and layout, photo supplied",p:0},
           {l:"Custom graphics or illustrated elements",p:3,floor:1,why:"Custom graphics or illustration, not just layout"},
           {l:"A highly detailed illustrated piece",p:6,floor:2,why:"A highly detailed illustrated poster"}]},
      { q:"How many versions come out of it?",
        a:[{l:"Print only",p:0},
           {l:"Print plus a social version",p:1,why:"An alternate social version"},
           {l:"Multiple layout variations and promo graphics",p:3,floor:2,why:"Multiple layout variations and promo graphics"}]},
      { q:"Is this standalone, or anchoring something bigger?",
        a:[{l:"One poster, one event",p:0},
           {l:"It anchors a larger campaign",p:2,why:"The poster anchors a larger campaign"}]},
      { q:"How many names, logos, or credits have to fit on it?",
        a:[{l:"Just a few",p:0},
           {l:"A full bill with sponsor logos",p:2,why:"A dense credit block and sponsor logos to resolve"}]}
    ]},

    web: { cuts:[2,6], qs:[
      { q:"How many pages?",
        a:[{l:"A homepage plus two or three",p:0},
           {l:"Six to ten",p:3,floor:1,why:"Six to ten pages"},
           {l:"More than ten, or I can't say yet",p:6,floor:2,why:"More than ten pages, or a page count that isn't settled"}]},
      { q:"How custom does it need to be?",
        a:[{l:"A familiar layout is fine",p:0},
           {l:"Custom layouts per section",p:2,why:"Custom layouts rather than repeating templates"},
           {l:"Bespoke interactions and custom systems",p:4,floor:2,why:"Bespoke interactions and custom interface systems"}]},
      { q:"Is the site structure already decided?",
        a:[{l:"Yes, I know exactly what goes where",p:0},
           {l:"Roughly",p:1,why:"Site structure needs some planning"},
           {l:"No, it needs wireframing",p:3,why:"Wireframing and advanced UX planning"}]},
      { q:"Anything beyond pages? Store, booking, logins, database?",
        a:[{l:"No, it's a marketing site",p:0},
           {l:"One of those",p:2,why:"Functional features beyond static pages"},
           {l:"Several",p:4,floor:2,why:"Several functional systems, which pushes this toward a platform"}]}
    ]},

    app: { cuts:[2,6], qs:[
      { q:"Where is this in its life?",
        a:[{l:"An idea I need to see and validate",p:0},
           {l:"Real, and getting ready for development",p:3,floor:1,why:"Preparing for handoff to development"},
           {l:"A funded product being built now",p:6,floor:2,why:"A product in active development"}]},
      { q:"How many screens?",
        a:[{l:"A handful of core screens",p:0},
           {l:"Multiple flows",p:2,why:"Multiple user flows rather than a few screens"},
           {l:"Many screens with states and edge cases",p:4,floor:2,why:"Many screens with states and edge cases"}]},
      { q:"Do developers need a reusable component system?",
        a:[{l:"No",p:0},
           {l:"Yes",p:3,why:"A reusable interface component system"}]},
      { q:"Is the user journey mapped out already?",
        a:[{l:"Yes",p:0},
           {l:"Partly",p:1,why:"User journeys need work"},
           {l:"No, that's part of the job",p:3,why:"Advanced UX planning and user journey mapping"}]}
    ]},

    packaging: { cuts:[2,6], qs:[
      { q:"How many products?",
        a:[{l:"One",p:0},
           {l:"Two to four variations",p:3,floor:1,why:"Multiple product variations that have to work as a set"},
           {l:"A full line, more than four",p:6,floor:2,why:"A full product line, which needs a packaging system"}]},
      { q:"Does a packaging look already exist?",
        a:[{l:"Yes, I'm matching it",p:0},
           {l:"No, we're building it",p:2,why:"Establishing the packaging identity from scratch"}]},
      { q:"Who's producing it?",
        a:[{l:"I've got the printer handled",p:0},
           {l:"I'll need help with printer specs",p:1,why:"Coordination with printer specifications"},
           {l:"Multiple printers or manufacturers",p:3,why:"Coordination across printers and manufacturers"}]},
      { q:"Do you need mockups for marketing or retail pitches?",
        a:[{l:"No",p:0},
           {l:"Yes",p:2,why:"Packaging mockups for marketing"}]}
    ]}
  };

  /* Keyword listener for the opening free-text answer. Patterns are
     padded with spaces where a bare substring would false-match
     ("help" contains "lp", "headshots" contains "ads"). */
  var KEYS = [
    {id:"album",  k:["album","cover art","vinyl","cassette"," ep "," lp ","my single","new single","the single","record label art","streaming art","spotify"]},
    {id:"poster", k:["poster","gig ","show flyer","flyer","key art","one sheet","tour art","handbill"]},
    {id:"packaging",k:["packag","label design","bottle","cans","beverage","product line","pouch"," box ","carton","can design"]},
    {id:"logo",   k:["logo","wordmark","monogram","emblem","brand mark","identity mark"]},
    {id:"branding",k:["branding","rebrand","brand identity","identity system","style guide","brand guide","brand system"]},
    {id:"web",    k:["website","web site"," site ","landing page","webpage","homepage","web design"]},
    {id:"app",    k:[" app ","app design","mobile app"," ios ","android","user interface","ux "]},
    {id:"social", k:["reel","tiktok"," short","promo video","commercial"," ads ","digital ad","social video","instagram video"]},
    {id:"photo",  k:["photo","shoot","headshot","videograph","photograph","film ","footage","video"]}
  ];

  /* ==================================================================
     HELPERS
     ================================================================== */

  function money(n){ return n.toLocaleString("en-US"); }
  function esc(s){
    return String(s).replace(/[&<>"]/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];
    });
  }
  function svcById(id){
    for (var i=0;i<DATA.length;i++){ if(DATA[i].id===id) return DATA[i]; }
    return null;
  }
  function el(tag, cls, html){
    var n=document.createElement(tag);
    if(cls) n.className=cls;
    if(html!==undefined) n.innerHTML=html;
    return n;
  }

  var PANEL_HTML =
      '<div class="dq-head">'
    +   '<div class="dq-head-top">'
    +     '<div class="dq-id">'
    +       '<div>'
    +         '<div class="dq-who">Scoping Desk</div>'
    +         '<div class="dq-status">Dane Erik Forst · Portland, OR</div>'
    +       '</div>'
    +     '</div>'
    +     '<div class="dq-head-right">'
    +       '<div class="dq-tally" data-tally>Scoped so far<b data-tally-amt>$0</b></div>'
    +       '<button class="dq-close" data-close aria-label="Close">✕</button>'
    +     '</div>'
    +   '</div>'
    +   '<div class="dq-tabs">'
    +     '<button class="dq-tab on" data-tab="scope">Scope my project</button>'
    +     '<button class="dq-tab" data-tab="pricing">See all pricing</button>'
    +   '</div>'
    + '</div>'
    + '<div class="dq-view on" data-view="scope">'
    +   '<div class="dq-log" data-log role="log" aria-live="polite"></div>'
    +   '<div class="dq-chips" data-chips></div>'
    +   '<div class="dq-prog" data-prog></div>'
    +   '<div class="dq-composer">'
    +     '<input data-input type="text" placeholder="Describe your project to get started" autocomplete="off">'
    +     '<button class="dq-send" data-send>Send</button>'
    +   '</div>'
    + '</div>'
    + '<div class="dq-view" data-view="pricing">'
    +   '<div class="dq-browse" data-browse></div>'
    + '</div>';

  /* ==================================================================
     INSTANCE
     Each mount (inline panel, modal panel) gets its own state, so an
     inline contact-page panel and the modal never fight over one
     conversation.
     ================================================================== */

  function Desk(root, opts){
    opts = opts || {};

    root.innerHTML = PANEL_HTML;

    var q = function(sel){ return root.querySelector(sel); };
    var log    = q("[data-log]");
    var chips  = q("[data-chips]");
    var prog   = q("[data-prog]");
    var input  = q("[data-input]");
    var sendEl = q("[data-send]");
    var tally  = q("[data-tally]");
    var tallyA = q("[data-tally-amt]");
    var browse = q("[data-browse]");
    var closeBtn = q("[data-close]");

    if (!opts.closable) closeBtn.style.display = "none";

    var cart=[], lead={name:"",email:"",org:"",when:"",notes:"",opening:""};
    var svc=null, qi=0, score=0, floor=0, reasons=[], awaiting="opening";
    var timers=[];

    function later(fn,ms){ var t=setTimeout(fn,ms); timers.push(t); return t; }
    function clearTimers(){ timers.forEach(clearTimeout); timers=[]; }

    /* ---------- tabs ---------- */

    root.querySelectorAll("[data-tab]").forEach(function(btn){
      btn.addEventListener("click", function(){
        showTab(btn.getAttribute("data-tab"));
      });
    });

    function showTab(name){
      root.querySelectorAll("[data-tab]").forEach(function(b){
        b.classList.toggle("on", b.getAttribute("data-tab")===name);
      });
      root.querySelectorAll("[data-view]").forEach(function(v){
        v.classList.toggle("on", v.getAttribute("data-view")===name);
      });
    }

    closeBtn.addEventListener("click", function(){
      if (opts.onClose) opts.onClose();
    });

    /* ---------- pricing browser ---------- */

    function buildBrowse(){
      browse.innerHTML = "";
      browse.appendChild(el("div","dq-browse-note",
        "Every price below reflects typical project scope. To find out which tier your project actually lands in, run it through the scoping questions."));

      DATA.forEach(function(s){
        var low = Math.min.apply(null, s.tiers.map(function(t){ return t.price; }));
        var acc = el("div","dq-acc");

        var btn = el("button","dq-acc-btn",
            '<span class="dq-acc-name">'+esc(s.name)+'</span>'
          + '<span class="dq-acc-from">From $'+money(low)+'</span>');

        var body = el("div","dq-acc-body");
        body.appendChild(el("div","dq-acc-desc", esc(s.desc)));

        var cards = el("div","dq-pcards");
        s.tiers.forEach(function(t,i){
          var note = t.note || s.note || "";
          cards.appendChild(el("div","dq-pcard",
              '<div class="dq-pcard-top">'
            +   '<span class="dq-pcard-no">'+TIER_WORD[i]+'</span>'
            +   '<span class="dq-pcard-price"><sup>$</sup>'+money(t.price)+'</span>'
            + '</div>'
            + '<div class="dq-pcard-name">'+esc(t.name)+'</div>'
            + '<div class="dq-pcard-best">'+esc(t.best)+'</div>'
            + '<ul>'+t.items.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+'</ul>'
            + (note ? '<div class="dq-pcard-note">'+esc(note)+'</div>' : '')
          ));
          cards.children[i].setAttribute("data-t", i);
        });
        body.appendChild(cards);

        var scopeBtn = el("button","dq-scopethis","Scope my "+esc(s.name)+" project");
        scopeBtn.addEventListener("click", function(){
          showTab("scope");
          clearTimers();
          resetState();
          log.innerHTML="";
          beginDiag(s);
        });
        body.appendChild(scopeBtn);

        btn.addEventListener("click", function(){
          var wasOpen = acc.classList.contains("open");
          browse.querySelectorAll(".dq-acc").forEach(function(a){ a.classList.remove("open"); });
          if(!wasOpen) acc.classList.add("open");
        });

        acc.appendChild(btn);
        acc.appendChild(body);
        browse.appendChild(acc);
      });

      browse.appendChild(el("div","dq-browse-foot",
        "Pricing reflects typical project scope. Final quotes may vary depending on complexity. Licensing for intended project use included. Extended usage or merchandise licensing available if needed."));
    }

    /* ---------- transcript ---------- */

    function scroll(){ log.scrollTop = log.scrollHeight; }
    function total(){ return cart.reduce(function(a,b){ return a+b.price; },0); }

    function updateTally(){
      tallyA.textContent = "$"+money(total());
      tally.classList.toggle("on", cart.length>0);
    }
    function setProg(done,of){
      prog.innerHTML="";
      if(!of) return;
      for(var i=0;i<of;i++){
        var b=el("i"); if(i<done) b.className="on"; prog.appendChild(b);
      }
    }
    function say(html){
      var r=el("div","dq-row bot",'<div class="dq-msg">'+html+'</div>');
      log.appendChild(r); scroll();
    }
    function me(t){
      var r=el("div","dq-row me",'<div class="dq-msg">'+esc(t)+'</div>');
      log.appendChild(r); scroll();
    }
    function blk(html){
      var r=el("div","dq-row bot",html); r.style.display="block";
      log.appendChild(r); scroll();
    }
    function typing(on){
      var ex=log.querySelector("[data-typing]");
      if(on&&!ex){
        var r=el("div","dq-row bot",'<div class="dq-typing"><i></i><i></i><i></i></div>');
        r.setAttribute("data-typing","1"); log.appendChild(r); scroll();
      } else if(!on&&ex){ ex.parentNode.removeChild(ex); }
    }
    function bot(fn,d){
      setChips([]); typing(true);
      later(function(){ typing(false); fn(); }, d||560);
    }
    function setChips(list){
      chips.innerHTML="";
      list.forEach(function(c,i){
        var b=el("button","dq-chip"+(c.quiet?" quiet":""));
        b.textContent=c.label;
        b.style.animationDelay=(i*24)+"ms";
        b.addEventListener("click",function(){ me(c.echo||c.label); setChips([]); c.go(); });
        chips.appendChild(b);
      });
    }
    function askText(ph,key){
      awaiting=key; input.disabled=false; input.placeholder=ph; input.value="";
      sendEl.classList.remove("live");
      if(opts.autofocus!==false) input.focus();
    }
    function closeText(){
      awaiting=null; input.disabled=true; input.value="";
      input.placeholder="Tap an option above"; sendEl.classList.remove("live");
    }

    /* ---------- flow ---------- */

    function start(){
      setProg(0,0);
      bot(function(){
        say("I scope projects for Dane Erik Forst. I'll ask a few questions about what you're building, then tell you what it actually takes and what it costs.");
        bot(function(){
          say("Start anywhere. What are you working on?");
          askText("Describe your project in a sentence or two","opening");
        }, 900);
      }, 400);
    }

    function readOpening(text){
      lead.opening=text;
      var t=" "+text.toLowerCase()+" ", hit=null;
      for(var i=0;i<KEYS.length && !hit;i++){
        for(var j=0;j<KEYS[i].k.length;j++){
          if(t.indexOf(KEYS[i].k[j])!==-1){ hit=KEYS[i].id; break; }
        }
      }
      if(hit){
        var s=svcById(hit);
        bot(function(){
          say("Sounds like <b>"+esc(s.name)+"</b>. Have I got that right?");
          setChips([
            {label:"That's it",go:function(){ beginDiag(s); }},
            {label:"Not quite",quiet:true,echo:"Not quite",go:function(){ offerAll(); }}
          ]);
        }, 750);
      } else {
        bot(function(){ say("Got it. Which of these is closest?"); offerAll(true); }, 700);
      }
    }

    function offerAll(silent){
      var fire=function(){
        setChips(DATA.map(function(s){
          return { label:s.name, go:function(){ beginDiag(s); } };
        }));
      };
      if(silent===true) fire();
      else bot(function(){ say("No problem. Which of these is closest?"); fire(); }, 500);
    }

    function beginDiag(s){
      svc=s; qi=0; score=0; floor=0; reasons=[];
      bot(function(){
        say("A few questions about scope. This is where most people underestimate their own project, so answer honestly and the number will be right.");
        bot(function(){ askQ(); }, 850);
      }, 500);
    }

    function askQ(){
      var set=DIAG[svc.id];
      if(qi>=set.qs.length){ setProg(set.qs.length,set.qs.length); return verdict(); }
      setProg(qi,set.qs.length);
      var item=set.qs[qi];
      say(esc(item.q));
      setChips(item.a.map(function(opt){
        return { label:opt.l, go:function(){
          score+=opt.p;
          if(opt.floor!==undefined && opt.floor>floor) floor=opt.floor;
          if(opt.why) reasons.push(opt.why);
          qi++;
          bot(askQ,420);
        }};
      }));
    }

    function verdict(){
      var set=DIAG[svc.id];
      var t = score<=set.cuts[0] ? 0 : (score<=set.cuts[1] ? 1 : 2);
      if(floor>t) t=floor;
      var tier=svc.tiers[t];
      var note=tier.note||svc.note||"";

      bot(function(){
        if(t===0) say("This one really is straightforward. Here's where it lands.");
        else if(t===2) say("This is bigger than it probably feels from the inside. Here's why, and here's what it takes.");
        else say("Based on what you've described, here's where it lands.");

        bot(function(){
          blk(
            '<div class="dq-verdict" data-t="'+t+'">'
            + '<div class="dq-v-top">'
            +   '<div class="dq-v-kicker">Scoped for '+esc(svc.name)+'</div>'
            +   '<div class="dq-v-line"><span class="dq-v-tier">'+TIER_WORD[t]+'</span>'
            +     '<span class="dq-v-price"><sup>$</sup>'+money(tier.price)+'</span></div>'
            +   '<div class="dq-v-name">'+esc(tier.name)+'</div>'
            + '</div>'
            + (reasons.length
                ? '<div class="dq-v-why"><div class="dq-v-why-h">What put it here</div><ul>'
                  + reasons.map(function(r){ return '<li>'+esc(r)+'</li>'; }).join("")
                  + '</ul></div>'
                : '')
            + '<div class="dq-v-incl"><div class="dq-v-incl-h">What you get</div><ul>'
            +   tier.items.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")
            + '</ul>'
            + (note ? '<div class="dq-v-note">'+esc(note)+'</div>' : '')
            + '</div></div>'
          );
          bot(function(){
            say("Does that match what you had in mind?");
            var list=[{label:"Yes, that's right",go:function(){ accept(svc,t,false); }}];
            if(t>0) list.push({label:"That's more than I expected",quiet:true,echo:"That's more than I expected",go:function(){ explainCut(svc,t); }});
            list.push({label:"Scope something else",quiet:true,go:function(){
              bot(function(){ say("Sure. What else?"); offerAll(true); },450);
            }});
            setChips(list);
          }, 750);
        }, 620);
      }, 700);
    }

    function explainCut(s,t){
      var lower=s.tiers[t-1], upper=s.tiers[t];
      var missing=upper.items.filter(function(x){ return lower.items.indexOf(x)===-1; });
      bot(function(){
        say("Fair. "+TIER_WORD[t-1]+" is <b>$"+money(lower.price)+"</b>. To land there, the project has to shed real scope, not just budget. Here's what comes off the table.");
        bot(function(){
          blk('<div class="dq-cut"><div class="dq-cut-h">Dropped at '+TIER_WORD[t-1]+' · $'+money(lower.price)+'</div><ul>'
            + (missing.length ? missing.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")
                              : '<li>The same deliverables at a smaller scale</li>')
            + '</ul></div>');
          bot(function(){
            say("Dane would rather size this right than surprise you later. Your call.");
            setChips([
              {label:"Keep the recommendation",echo:"Keep the recommendation",go:function(){ accept(s,t,false); }},
              {label:"Send it at "+TIER_WORD[t-1],quiet:true,echo:"Send it at "+TIER_WORD[t-1],go:function(){ accept(s,t-1,true,t); }},
              {label:"Let's just talk it through",quiet:true,go:function(){ accept(s,t,false,null,true); }}
            ]);
          }, 700);
        }, 560);
      }, 650);
    }

    function accept(s,t,downgraded,recommended,wantsCall){
      var tier=s.tiers[t];
      cart.push({
        service:s.name, tier:tier.name, tierIndex:t, price:tier.price, items:tier.items,
        reasons:reasons.slice(), downgraded:!!downgraded,
        recommended:(recommended!==undefined&&recommended!==null)?recommended:null,
        wantsCall:!!wantsCall
      });
      updateTally(); setProg(0,0);
      bot(function(){
        if(wantsCall) say("Good call. I'll flag this one for a conversation rather than a fixed number.");
        else if(downgraded) say("Noted. I'll send it at "+TIER_WORD[t]+" and mark that it came in under the scoped recommendation, so Dane knows to check the fit before anyone commits.");
        else say("Locked in at <b>$"+money(tier.price)+"</b>.");
        bot(function(){
          say("Anything else on this project?");
          setChips([
            {label:"Yes, scope something else",go:function(){
              bot(function(){ say("What else are you needing?"); offerAll(true); },450);
            }},
            {label:"That's everything",quiet:true,go:askName}
          ]);
        }, 700);
      }, 650);
    }

    function askName(){
      bot(function(){
        say("A few details and this goes straight to Dane.");
        bot(function(){ say("What's your name?"); askText("Your name","name"); },650);
      });
    }
    function afterName(v){
      lead.name=v;
      bot(function(){ say("Thanks, "+esc(v.split(" ")[0])+". Best email for you?"); askText("you@example.com","email"); });
    }
    function afterEmail(v){
      lead.email=v;
      bot(function(){ say("Company, band, or project name?"); askText("Name of the company, band, or project","org"); });
    }
    function afterOrg(v){
      lead.org=v;
      bot(function(){
        say("When do you need it?");
        setChips([
          {label:"Within 2 weeks",go:function(){afterWhen("Within 2 weeks");}},
          {label:"1 to 2 months",go:function(){afterWhen("1 to 2 months");}},
          {label:"3 months or more",go:function(){afterWhen("3 months or more");}},
          {label:"Not sure yet",quiet:true,go:function(){afterWhen("Not sure yet");}}
        ]);
      });
    }
    function afterWhen(v){
      lead.when=v;
      bot(function(){
        say("Last one. Anything else Dane should know? References, hard deadlines, anyone else involved.");
        askText("Optional, or tap skip","notes");
        setChips([{label:"Skip",quiet:true,echo:"Nothing to add",go:function(){ closeText(); afterNotes(""); }}]);
      });
    }
    function afterNotes(v){
      lead.notes=v; closeText();
      bot(function(){
        say("Here's the whole thing.");
        bot(function(){
          blk(receiptHTML());
          bot(function(){
            say("Pricing reflects typical project scope. Final quotes may vary depending on complexity. Licensing for intended project use included.");
            bot(function(){
              say("Send it?");
              setChips([{label:"Send to Dane",go:send},{label:"Start over",quiet:true,go:reset}]);
            }, 620);
          }, 560);
        }, 520);
      });
    }

    function receiptHTML(){
      return '<div class="dq-receipt">'
        + '<div class="dq-receipt-h">Scoped estimate for '+esc(lead.org||lead.name)+'</div>'
        + cart.map(function(l){
            return '<div class="dq-receipt-line"><span>'+esc(l.service)+' · '+TIER_WORD[l.tierIndex]
              + (l.downgraded ? ' (under recommendation)' : '')
              + '</span><span>$'+money(l.price)+'</span></div>';
          }).join("")
        + '<div class="dq-receipt-total"><span>Estimated total</span><b><sup>$</sup>'+money(total())+'</b></div>'
        + '</div>';
    }

    function summaryText(){
      var o=[];
      o.push("SCOPED QUOTE REQUEST");
      o.push("====================");
      o.push("");
      o.push("Name: "+lead.name);
      o.push("Email: "+lead.email);
      if(lead.org) o.push("Company / band / project: "+lead.org);
      if(lead.when) o.push("Timeline: "+lead.when);
      o.push("");
      if(lead.opening){
        o.push("IN THEIR WORDS"); o.push("--------------"); o.push(lead.opening); o.push("");
      }
      o.push("SCOPED SERVICES"); o.push("---------------");
      cart.forEach(function(l){
        o.push(l.service+" / "+TIER_WORD[l.tierIndex]+": "+l.tier+" / $"+money(l.price));
        if(l.downgraded && l.recommended!==null){
          var s=svcById2(l.service);
          o.push("   !! CLIENT CHOSE BELOW RECOMMENDATION. Scoped at "+TIER_WORD[l.recommended]+" ($"+money(s.tiers[l.recommended].price)+").");
        }
        if(l.wantsCall) o.push("   !! CLIENT ASKED TO TALK SCOPE BEFORE COMMITTING.");
        if(l.reasons.length){
          o.push("   Scoping flags:");
          l.reasons.forEach(function(r){ o.push("     - "+r); });
        }
        o.push("   Includes:");
        l.items.forEach(function(x){ o.push("     . "+x); });
        o.push("");
      });
      o.push("ESTIMATED TOTAL: $"+money(total()));
      o.push("");
      if(lead.notes){ o.push("PROJECT NOTES"); o.push("-------------"); o.push(lead.notes); o.push(""); }
      o.push("Pricing reflects typical project scope. Final quotes may vary depending on complexity.");
      return o.join("\n");
    }

    function svcById2(name){
      for(var i=0;i<DATA.length;i++){ if(DATA[i].name===name) return DATA[i]; }
      return DATA[0];
    }

    function send(){
      var body=summaryText();
      var flagged=cart.some(function(l){ return l.downgraded||l.wantsCall; });
      var subject="Scoped quote: "+lead.name+" / $"+money(total())+(flagged?" [SCOPE FLAG]":"");

      /* Posts to the same Formspree endpoint as the contact form. The visitor
         never leaves the page, and the quote lands in the inbox whether or not
         they have a mail client set up. mailto: is kept below, but only as a
         real failure path: no network, endpoint down, monthly quota hit. */
      var payload = new FormData();
      payload.append("_subject", subject);
      payload.append("name",  lead.name);
      payload.append("email", lead.email);
      if(lead.org) payload.append("company", lead.org);
      payload.append("total", "$"+money(total()));
      if(flagged) payload.append("scope_flag", "yes");
      payload.append("message", body);

      function fallbackToMail(){
        window.location.href="mailto:"+CONFIG.TO
          +"?subject="+encodeURIComponent(subject)
          +"&body="+encodeURIComponent(body);
        bot(function(){
          say("I couldn't reach the server, so I've opened your email app with everything filled in instead. If nothing opened, copy the summary below and send it to <b>"+esc(CONFIG.TO)+"</b>.");
          dumpSummary(body);
        }, 500);
      }

      say("Sending&hellip;");

      if(!window.fetch){ return fallbackToMail(); }

      fetch(CONFIG.FORM_ENDPOINT, {
        method: "POST",
        body: payload,
        headers: { "Accept": "application/json" }
      }).then(function(res){
        if(!res.ok) throw new Error("bad status "+res.status);
        onSent(body);
      }).catch(fallbackToMail);
    }

    function onSent(body){
      bot(function(){
        say("Sent. It's in Dane's inbox, and you'll hear back within a couple of days. Here's a copy of what went over:");
        dumpSummary(body);
      }, 700);
    }

    function dumpSummary(body){
      bot(function(){
        var r=el("div","dq-row bot",
          '<textarea readonly data-dump style="width:100%;min-height:190px;font-family:var(--mono);font-size:11.5px;line-height:1.6;background:transparent;color:var(--ink);border:1px solid var(--rule);padding:14px;"></textarea>');
        r.style.display="block";
        log.appendChild(r);
        r.querySelector("[data-dump]").value=body;
        scroll();
        bot(function(){
          setChips([
            {label:"Copy summary",go:copySummary},
            {label:"Start a new quote",quiet:true,go:reset}
          ]);
        }, 500);
      }, 500);
    }

    function copySummary(){
      var ta=log.querySelector("[data-dump]");
      if(ta){
        ta.select();
        try{ document.execCommand("copy"); }catch(e){}
        if(navigator.clipboard) navigator.clipboard.writeText(ta.value);
      }
      bot(function(){
        say("Copied to your clipboard.");
        setChips([{label:"Start a new quote",quiet:true,go:reset}]);
      }, 320);
    }

    function resetState(){
      cart=[]; lead={name:"",email:"",org:"",when:"",notes:"",opening:""};
      svc=null; qi=0; score=0; floor=0; reasons=[];
      closeText(); updateTally(); setProg(0,0);
    }

    function reset(){
      clearTimers(); resetState();
      log.innerHTML=""; chips.innerHTML="";
      input.disabled=false;
      start();
    }

    function submitText(){
      var v=input.value.trim();
      if(!v && awaiting!=="notes") return;
      if(awaiting==="email" && !/^\S+@\S+\.\S+$/.test(v)){
        me(v); closeText();
        bot(function(){ say("That address doesn't look right. Mind typing it again?"); askText("you@example.com","email"); },400);
        return;
      }
      var key=awaiting;
      me(v); closeText();
      if(key==="opening") readOpening(v);
      else if(key==="name") afterName(v);
      else if(key==="email") afterEmail(v);
      else if(key==="org") afterOrg(v);
      else if(key==="notes") afterNotes(v);
    }

    input.addEventListener("input",function(){
      sendEl.classList.toggle("live", input.value.trim().length>0);
    });
    input.addEventListener("keydown",function(e){
      if(e.key==="Enter"){ e.preventDefault(); submitText(); }
    });
    sendEl.addEventListener("click",submitText);

    buildBrowse();
    updateTally();
    if(CONFIG.OPEN_TAB==="pricing") showTab("pricing");
    start();

    return { showTab: showTab, focus: function(){ if(!input.disabled) input.focus(); } };
  }

  /* ==================================================================
     MOUNTING
     ================================================================== */

  var modalDesk = null, overlay = null, lastFocus = null;

  function buildModal(){
    overlay = el("div","dq-scope dq-overlay");
    var modal = el("div","dq-modal");
    var panel = el("div","dq-panel");
    modal.appendChild(panel);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modalDesk = Desk(panel, { closable:true, autofocus:false, onClose:closeModal });

    overlay.addEventListener("click", function(e){
      if(e.target===overlay) closeModal();
    });
  }

  function openModal(tab){
    if(!overlay) buildModal();
    lastFocus = document.activeElement;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    if(tab) modalDesk.showTab(tab);
    setTimeout(function(){ modalDesk.focus(); }, 380);
  }

  function closeModal(){
    if(!overlay) return;
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener("keydown", function(e){
    if(e.key==="Escape" && overlay && overlay.classList.contains("open")) closeModal();
  });

  /* inline mounts */
  document.querySelectorAll("[data-def-quote-inline]").forEach(function(host){
    host.classList.add("dq-scope");
    var panel = el("div","dq-panel inline");
    host.appendChild(panel);
    Desk(panel, { closable:false, autofocus:false });
  });

  /* modal triggers */
  document.querySelectorAll("[data-def-quote-open]").forEach(function(btn){
    btn.addEventListener("click", function(e){
      e.preventDefault();
      openModal(btn.getAttribute("data-def-quote-tab"));
    });
  });

  /* floating launcher */
  if(CONFIG.LAUNCHER){
    var dismissed = false, shown = false;

    var wrap = el("div","dq-scope");
    var launcher = el("div","dq-launcher");
    var main = el("button","dq-launcher-main",
      '<span class="dq-dot"></span><span class="dq-launcher-txt">'+esc(CONFIG.LAUNCHER_TEXT)+'</span>');
    var x = el("button","dq-launcher-x","✕");
    x.setAttribute("aria-label","Dismiss");

    main.addEventListener("click", function(){ openModal(); });
    x.addEventListener("click", function(){
      dismissed = true;
      launcher.classList.remove("up");
    });

    launcher.appendChild(main);
    launcher.appendChild(x);
    wrap.appendChild(launcher);
    document.body.appendChild(wrap);

    function reveal(){
      if(shown || dismissed) return;
      shown = true;
      launcher.classList.add("up");
    }

    window.addEventListener("scroll", function(){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if(h <= 0) return reveal();
      if(window.pageYOffset / h >= CONFIG.LAUNCHER_AFTER_SCROLL) reveal();
    }, { passive:true });

    setTimeout(reveal, CONFIG.LAUNCHER_AFTER_MS);
  }

})();
