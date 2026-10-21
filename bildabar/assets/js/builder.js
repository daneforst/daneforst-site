(function(){
  var BASE_PRICE = 999;
  var ADDON_PRICE = 250;
  var DEPOSIT_RATE = 0.5;

  // Sample availability data. Replace with a real source (shared calendar,
  // booking sheet export, etc.) before this goes live — these dates are
  // illustrative only.
  var today = new Date();
  today.setHours(0,0,0,0);
  function iso(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function addDays(d,n){ var r = new Date(d); r.setDate(r.getDate()+n); return r; }
  var bookedDates = new Set([
    iso(addDays(today, 4)), iso(addDays(today, 5)), iso(addDays(today, 11)),
    iso(addDays(today, 18)), iso(addDays(today, 19)), iso(addDays(today, 20)),
    iso(addDays(today, 27)), iso(addDays(today, 34)), iso(addDays(today, 41)),
    iso(addDays(today, 42))
  ]);

  // Each category's base pour is what ships in every package at no charge.
  // The other two are top-shelf swaps, placeholders until the real menu
  // is locked, that trigger the flat Premium Spirits upgrade.
  var SPIRITS = [
    { key:'vodka', label:'Vodka', icon:'icon-vodka', options:[
        { name:"Tito's Handmade Vodka", tier:'included' },
        { name:'Grey Goose', tier:'premium' },
        { name:'Ketel One', tier:'premium' }
    ]},
    { key:'tequila', label:'Tequila', icon:'icon-tequila', options:[
        { name:'Batanga Tequila', tier:'included' },
        { name:'Espolòn Blanco', tier:'premium' },
        { name:'Casamigos Blanco', tier:'premium' }
    ]},
    { key:'gin', label:'Gin', icon:'icon-gin', options:[
        { name:'Bombay Sapphire', tier:'included' },
        { name:"Hendrick's", tier:'premium' },
        { name:'Aviation American Gin', tier:'premium' }
    ]},
    { key:'bourbon', label:'Bourbon', icon:'icon-bourbon', options:[
        { name:'Old Grand-Dad', tier:'included' },
        { name:'Buffalo Trace', tier:'premium' },
        { name:'Woodford Reserve', tier:'premium' }
    ]},
    { key:'rum', label:'Rum', icon:'icon-rum', options:[
        { name:'Bacardi Superior', tier:'included' },
        { name:'Mount Gay Eclipse', tier:'premium' },
        { name:'Plantation 3 Stars', tier:'premium' }
    ]}
  ];

  var state = {
    guests: 60,
    spirits: {}, // key -> { included: bool, choice: index }
    custom: false,
    customNote: '',
    selectedDate: null,
    calMonth: new Date(today.getFullYear(), today.getMonth(), 1)
  };
  SPIRITS.forEach(function(s){ state.spirits[s.key] = { included: true, choice: 0 }; });

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOWS = ['S','M','T','W','T','F','S'];

  function money(n){ return '$' + n.toLocaleString('en-US'); }

  function isPremium(){
    return SPIRITS.some(function(s){
      var sel = state.spirits[s.key];
      return sel.included && s.options[sel.choice].tier === 'premium';
    });
  }

  // ---- spirits panel ----
  var spiritListEl = document.getElementById('spiritList');

  function renderSpirits(){
    spiritListEl.innerHTML = SPIRITS.map(function(s){
      var sel = state.spirits[s.key];
      var optsHtml = s.options.map(function(opt, i){
        var chosen = sel.choice === i;
        return '<label class="spirit-opt'+(chosen?' is-selected':'')+'" data-spirit="'+s.key+'" data-idx="'+i+'">' +
          '<input type="radio" name="'+s.key+'-opt"'+(chosen?' checked':'')+'>' +
          '<span class="dot"></span>' +
          '<span class="opt-name">'+opt.name+'<em>'+(opt.tier==='included'?'Included':'Premium')+'</em></span>' +
        '</label>';
      }).join('');
      return '<div class="spirit-card'+(sel.included?'':' is-off')+'" data-spirit="'+s.key+'">' +
        '<div class="spirit-head'+(sel.included?' is-on':'')+'" data-spirit="'+s.key+'" role="checkbox" aria-checked="'+sel.included+'" tabindex="0">' +
          '<div class="spirit-toggle"><svg width="14" height="14"><use href="assets/icons/sprite.svg#icon-check"/></svg></div>' +
          '<div class="spirit-icon"><svg><use href="assets/icons/sprite.svg#'+s.icon+'"/></svg></div>' +
          '<div class="spirit-name">'+s.label+'</div>' +
          '<div class="spirit-picked">'+(sel.included ? s.options[sel.choice].name : 'Not on your bar')+'</div>' +
        '</div>' +
        '<div class="spirit-options">'+optsHtml+'</div>' +
      '</div>';
    }).join('');

    spiritListEl.querySelectorAll('.spirit-head').forEach(function(head){
      function toggle(){
        var key = head.getAttribute('data-spirit');
        state.spirits[key].included = !state.spirits[key].included;
        renderSpirits();
        updateQuote();
      }
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(); }
      });
    });
    spiritListEl.querySelectorAll('.spirit-opt').forEach(function(opt){
      opt.addEventListener('click', function(e){
        e.stopPropagation();
        var key = opt.getAttribute('data-spirit');
        var idx = Number(opt.getAttribute('data-idx'));
        state.spirits[key].choice = idx;
        renderSpirits();
        updateQuote();
      });
    });
  }

  function updateQuote(){
    var lines = [{ label:'Base Package', amt: BASE_PRICE }];
    var total = BASE_PRICE;
    var premium = isPremium();
    if (premium){ lines.push({ label:'Premium Spirits', amt: ADDON_PRICE }); total += ADDON_PRICE; }
    if (state.custom){ lines.push({ label:'Custom Cocktail', amt: ADDON_PRICE }); total += ADDON_PRICE; }

    document.getElementById('quoteTotal').textContent = money(total);
    var ul = document.getElementById('quoteLines');
    ul.innerHTML = lines.map(function(l){
      return '<li><b>'+l.label+'</b><span>'+money(l.amt)+'</span></li>';
    }).join('');

    var depositEl = document.getElementById('depositAmt');
    if (depositEl) depositEl.textContent = money(Math.round(total * DEPOSIT_RATE));

    var noteAmt = document.getElementById('spiritsNoteAmt');
    if (noteAmt) noteAmt.textContent = premium ? '+ $250' : '+ $0';

    var dd = document.getElementById('quoteDateDisplay');
    dd.textContent = state.selectedDate
      ? 'Requested date: ' + formatDate(state.selectedDate)
      : 'No date selected yet';

    var note = document.getElementById('guestNote');
    if (state.guests > 75){
      note.textContent = 'Heads up, for a group this size we typically recommend a second bartender. We’ll confirm staffing in your follow-up.';
    } else if (state.guests <= 20){
      note.textContent = 'Nice and intimate. Comfortably covered by one bartender.';
    } else {
      note.textContent = 'A solid single-bartender crowd.';
    }
  }

  function formatDate(ds){
    var parts = ds.split('-').map(Number);
    var d = new Date(parts[0], parts[1]-1, parts[2]);
    return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  }

  // ---- guest count ----
  var guestNumEl = document.getElementById('guestNum');
  document.getElementById('guestMinus').addEventListener('click', function(){
    state.guests = Math.max(10, state.guests - 5);
    guestNumEl.textContent = state.guests;
    updateQuote();
  });
  document.getElementById('guestPlus').addEventListener('click', function(){
    state.guests = Math.min(300, state.guests + 5);
    guestNumEl.textContent = state.guests;
    updateQuote();
  });

  // ---- custom cocktail toggle ----
  var customToggle = document.getElementById('customToggle');
  function toggleCustom(){
    state.custom = !state.custom;
    customToggle.classList.toggle('is-on', state.custom);
    customToggle.setAttribute('aria-checked', state.custom ? 'true' : 'false');
    updateQuote();
  }
  customToggle.addEventListener('click', toggleCustom);
  customToggle.addEventListener('keydown', function(e){
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleCustom(); }
  });
  document.getElementById('customNote').addEventListener('click', function(e){ e.stopPropagation(); });
  document.getElementById('customNote').addEventListener('input', function(e){ state.customNote = e.target.value; });

  // ---- calendar ----
  var calGrid = document.getElementById('calGrid');
  var calTitle = document.getElementById('calTitle');

  function renderCalendar(){
    var y = state.calMonth.getFullYear(), m = state.calMonth.getMonth();
    calTitle.textContent = MONTHS[m] + ' ' + y;
    var firstDow = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m+1, 0).getDate();

    var html = DOWS.map(function(d){ return '<div class="cal-dow">'+d+'</div>'; }).join('');
    for (var i=0;i<firstDow;i++){ html += '<div class="cal-day is-empty"></div>'; }

    for (var day=1; day<=daysInMonth; day++){
      var d = new Date(y, m, day);
      var ds = iso(d);
      var cls = 'cal-day';
      var attrs = '';
      if (d < today){
        cls += ' is-past';
      } else if (bookedDates.has(ds)){
        cls += ' is-booked';
      } else {
        cls += ' is-open';
        attrs = ' data-date="'+ds+'" tabindex="0" role="button" aria-label="Select '+formatDate(ds)+'"';
      }
      if (state.selectedDate === ds){ cls += ' is-selected'; }
      html += '<div class="'+cls+'"'+attrs+'>'+day+'</div>';
    }
    calGrid.innerHTML = html;

    calGrid.querySelectorAll('.is-open').forEach(function(cell){
      cell.addEventListener('click', function(){
        state.selectedDate = cell.getAttribute('data-date');
        renderCalendar();
        updateQuote();
      });
      cell.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); cell.click(); }
      });
    });
  }

  document.getElementById('calPrev').addEventListener('click', function(){
    state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth()-1, 1);
    renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', function(){
    state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth()+1, 1);
    renderCalendar();
  });

  // ---- request modal ----
  var modal = document.getElementById('requestModal');
  var formFields = document.getElementById('formFields');
  var formSuccess = document.getElementById('formSuccess');

  function selectionSummary(){
    var lines = [];
    lines.push(state.guests + ' guests');
    lines.push('Base package ($999)');
    SPIRITS.forEach(function(s){
      var sel = state.spirits[s.key];
      if (!sel.included){ lines.push(s.label + ': not on the bar'); return; }
      var opt = s.options[sel.choice];
      lines.push(s.label + ': ' + opt.name + (opt.tier === 'premium' ? ' (premium)' : ''));
    });
    if (isPremium()) lines.push('Premium Spirits upgrade (+$250)');
    if (state.custom){
      lines.push('Custom cocktail (+$250)' + (state.customNote ? ', ' + state.customNote : ''));
    }
    if (state.selectedDate) lines.push('Requested date: ' + formatDate(state.selectedDate));
    var total = BASE_PRICE + (isPremium()?ADDON_PRICE:0) + (state.custom?ADDON_PRICE:0);
    lines.push('Estimated total: ' + money(total));
    lines.push('Deposit to reserve (50%): ' + money(Math.round(total * DEPOSIT_RATE)));
    return lines.join('\n');
  }

  document.getElementById('openRequest').addEventListener('click', function(){
    formFields.classList.remove('is-hidden');
    formSuccess.classList.remove('is-shown');
    document.getElementById('formDate').value = state.selectedDate ? formatDate(state.selectedDate) : 'Not selected yet';
    document.getElementById('formSummary').value = selectionSummary();
    modal.classList.add('is-open');
  });
  function closeModal(){ modal.classList.remove('is-open'); }
  document.getElementById('closeModal').addEventListener('click', closeModal);
  modal.addEventListener('click', function(e){ if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeModal(); });

  document.getElementById('quoteForm').addEventListener('submit', function(e){
    e.preventDefault();
    var name = document.getElementById('fName').value;
    var email = document.getElementById('fEmail').value;
    var phone = document.getElementById('fPhone').value;
    var subject = encodeURIComponent('Bildabar date reservation, ' + name);
    var body = encodeURIComponent(
      'Name: ' + name + '\n' +
      'Email: ' + email + '\n' +
      'Phone: ' + phone + '\n\n' +
      selectionSummary()
    );
    window.location.href = 'mailto:hello@bildabar.com?subject=' + subject + '&body=' + body;
    formFields.classList.add('is-hidden');
    formSuccess.classList.add('is-shown');
  });

  renderSpirits();
  renderCalendar();
  updateQuote();
})();
