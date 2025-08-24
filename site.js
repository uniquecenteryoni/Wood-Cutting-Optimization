// Global site behaviors: language toggle across pages
(function(){
  window.__siteGlobal = true;
  const LANG_KEY='lang', CUR_KEY='currency', UNIT_KEY='unitSystem';
  const el = sel => document.querySelector(sel);
  // Read a string value from localStorage, tolerant to JSON-wrapped strings (e.g. "\"he\"")
  function readStr(key, fallback){
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') return parsed;
      // If parsed is not a string, fall back to raw
      return String(parsed);
    } catch { return raw; }
  }
  const lang = () => String(readStr(LANG_KEY, 'he')).trim().replace(/^"|"$/g,'').toLowerCase();
  const setLang = v => localStorage.setItem(LANG_KEY, v);
  const currency = () => String(readStr(CUR_KEY, 'EUR')).trim().replace(/^"|"$/g,'').toUpperCase();
  const setCurrency = v => localStorage.setItem(CUR_KEY, v);
  const unit = () => String(readStr(UNIT_KEY, 'metric')).trim().replace(/^"|"$/g,'').toLowerCase();
  const setUnit = v => localStorage.setItem(UNIT_KEY, v);

  function applyDir(){
    const isHe = lang()==='he';
    const html=document.documentElement;
    html.lang = isHe ? 'he' : 'en';
    html.dir = isHe ? 'rtl' : 'ltr';
    // Update site header branding
    try {
      const title = document.querySelector('.topbar .site-title');
      if (title) title.textContent = isHe ? 'עבודת עץ' : 'wood lab';
      const logo = document.getElementById('site-logo');
      if (logo) {
        // Show logo on Hebrew (RTL) by default; keep it visible also in EN if you want
        logo.style.display = 'block';
        logo.setAttribute('alt', isHe ? 'לוגו' : 'Logo');
      }
    } catch{}
  }

  function updateButtons(){
    const bLang = el('#btn-lang');
    if (bLang) bLang.textContent = lang()==='he' ? 'english' : 'עברית';
    const bCur = el('#btn-currency');
    if (bCur) {
      const storedSym = (readStr('currencySymbol', '') || '').replace(/["'״]/g,'');
      const sym = storedSym && /[€$₪]/.test(storedSym) ? storedSym : symbolFromCurrency(currency());
      if (lang()==='en') {
        const map = { '€':'Euro', '$':'Dollar', '₪':'Shekel' };
        bCur.textContent = map[sym] || 'Euro';
      } else {
        bCur.textContent = sym || '€';
      }
    }
    const bUnits = el('#btn-units');
    if (bUnits) {
      if (lang()==='en') {
        bUnits.textContent = unit()==='metric' ? 'meter' : 'inch';
      } else {
        bUnits.textContent = unit()==='metric' ? 'm' : 'inch';
      }
    }
  }

  function symbolFromCurrency(cur){
    switch((cur||'').toUpperCase()){
      case 'EUR': return '€';
      case 'USD': return '$';
      case 'ILS': return '₪';
      default: return cur;
    }
  }

  function toggleLang(){ setLang(lang()==='he'?'en':'he'); applyDir(); location.reload(); }
  function toggleUnits(){ setUnit(unit()==='metric'?'imperial':'metric'); location.reload(); }
  function cycleCurrency(){
    const order=['EUR','USD','ILS'];
    const i = order.indexOf((currency()||'EUR').toUpperCase());
    const next = order[(i+1)%order.length];
    setCurrency(next);
    // also store symbol for UI convenience, app.js uses normalize internally
    localStorage.setItem('currencySymbol', symbolFromCurrency(next));
    location.reload();
  }

  // Apply direction as early as possible to avoid FOUC
  try { applyDir(); } catch {}

  window.addEventListener('DOMContentLoaded', ()=>{
    // Disable initial compact scaling: it caused side gutters on first load
    try {
      sessionStorage.setItem('initialCompactDone','1');
      document.body.classList.remove('initial-compact','initial-compact-tight');
      const mainEl = document.querySelector('main.container');
      if (mainEl) { mainEl.style.transform=''; mainEl.style.transformOrigin=''; }
    } catch{}
    // Defensive: remove any stray JSON printed after the footer (e.g., if a JSON script was mis-parsed)
    try {
      const footer = document.querySelector('footer.footer');
      if (footer) {
        let n = footer.nextSibling;
        while (n) {
          const next = n.nextSibling;
          if (n.nodeType === 3) { // text node
            const t = String(n.textContent||'').trim();
            if (t && (t.startsWith('{"v"') || t.includes('"layers"') || t.includes('"assets"'))) {
              n.parentNode && n.parentNode.removeChild(n);
            }
          } else if (n.nodeType === 1) { // element
            const el = n;
            const tag = (el.tagName||'').toLowerCase();
            const typ = (el.getAttribute && el.getAttribute('type')) || '';
            if (el.id === 'loader-json' || (tag === 'script' && /application\/json/i.test(typ))) {
              el.parentNode && el.parentNode.removeChild(el);
            }
          }
          n = next;
        }
      }
    } catch {}
    // Enter initial compact mode to ensure the first three blocks (up to the summarize button) fit without scrolling.
    // We'll remove this mode after the first actionable click.
    try {
      const key='initialCompactDone';
    const path = (location.pathname || '').toLowerCase();
    const isIndex = path.endsWith('/index.html') || path.endsWith('index.html') || /\/$/.test(path);
      if (false && isIndex && !sessionStorage.getItem(key)) {
        document.body.classList.add('initial-compact');
        // If viewport height is very small, add an extra-tight mode
        try {
          if (window.innerHeight < 640) document.body.classList.add('initial-compact-tight');
        } catch{}
        const mainEl = document.querySelector('main.container');
        let scaled = false;
        const fitToSummarize = () => {
          try {
            const btn = document.getElementById('export-pdf');
            if (!btn || !mainEl) return;
            // Measure where the button bottom lands in the viewport
            const rect = btn.getBoundingClientRect();
            const bottom = rect.bottom; // relative to viewport top
            const viewport = window.innerHeight || document.documentElement.clientHeight;
            const margin = 8; // small breathing room
            if (bottom + margin <= viewport) {
              if (scaled) { mainEl.style.transform=''; mainEl.style.transformOrigin=''; scaled=false; }
              return;
            }
            // Compute a scale factor to fit the button into viewport
            const scale = Math.max(0.4, Math.min(1, (viewport - margin) / (bottom)));
            mainEl.style.transform = `scale(${scale.toFixed(3)})`;
            mainEl.style.transformOrigin = 'top center';
            scaled = true;
          } catch {}
        };
        // Run after layout settles
        requestAnimationFrame(()=>{ setTimeout(fitToSummarize, 0); });
        const off = () => {
          document.body.classList.remove('initial-compact');
          document.body.classList.remove('initial-compact-tight');
          if (scaled && mainEl) { mainEl.style.transform=''; mainEl.style.transformOrigin=''; scaled=false; }
          sessionStorage.setItem(key, '1');
          window.removeEventListener('click', onAnyClick, true);
          window.removeEventListener('resize', onResize);
          window.removeEventListener('orientationchange', onResize);
          window.removeEventListener('resize', onResizeFit);
          window.removeEventListener('orientationchange', onResizeFit);
        };
        const onAnyClick = (e) => {
          const t = e.target;
          if (!t) return off();
          const tag = (t.tagName||'').toLowerCase();
          const isBtnLike = tag === 'button' || tag === 'input' || t.closest('button,.btn,input,select');
          if (isBtnLike) off();
        };
        window.addEventListener('click', onAnyClick, true);
        // If orientation/resize increases room, relax tight mode
        const onResize = () => {
          try {
            if (window.innerHeight >= 640) document.body.classList.remove('initial-compact-tight');
          } catch{}
        };
        window.addEventListener('resize', onResize, { passive: true });
        window.addEventListener('orientationchange', onResize);
        // Keep fitting while in compact mode (e.g., when virtual keyboard or orientation changes)
        const onResizeFit = () => { fitToSummarize(); };
        window.addEventListener('resize', onResizeFit, { passive: true });
        window.addEventListener('orientationchange', onResizeFit);
      }
    } catch{}
    applyDir();
    updateButtons();
    // Mobile: make vertical scroll always work from within horizontally scrollable areas
    try{
      const enableCrossScroll = (el)=>{
        if (!el) return;
        let x0=null, y0=null, locked=null; // 'x' or 'y'
        const onStart = (e)=>{ const t=e.touches?.[0]; if(!t) return; x0=t.clientX; y0=t.clientY; locked=null; };
        const onMove = (e)=>{
          if (x0==null||y0==null) return;
          const t=e.touches?.[0]; if(!t) return;
          const dx=Math.abs(t.clientX-x0), dy=Math.abs(t.clientY-y0);
          if (!locked){ locked = dx>dy ? 'x' : 'y'; }
          if (locked==='y'){
            // allow page to scroll; don't trap vertical gesture
            el.style.overscrollBehaviorY = 'auto';
            // Do not preventDefault so the page scrolls
          } else {
            // horizontal scrolling within the element
            e.preventDefault();
          }
        };
        const onEnd = ()=>{ x0=y0=null; locked=null; };
        el.addEventListener('touchstart', onStart, {passive:true});
        el.addEventListener('touchmove', onMove, {passive:false});
        el.addEventListener('touchend', onEnd, {passive:true});
      };
      // Expose globally so other scripts can call after dynamic renders
      window.__enableCrossScroll = enableCrossScroll;
      // Bind initially
      document.querySelectorAll('.x-scroll, svg.diagram').forEach(el=>enableCrossScroll(el));
      // Observe for dynamic additions
      const mo = new MutationObserver((mutations)=>{
        for (const m of mutations){
          m.addedNodes && m.addedNodes.forEach(node=>{
            if (node.nodeType!==1) return;
            const el = node;
            if (el.matches && (el.matches('.x-scroll') || el.matches('svg.diagram'))) enableCrossScroll(el);
            el.querySelectorAll && el.querySelectorAll('.x-scroll, svg.diagram').forEach(n=>enableCrossScroll(n));
          });
        }
      });
      mo.observe(document.body, { childList:true, subtree:true });
    }catch{}

    // Build & localize nav (desktop + mobile) with required order; keep Pricing persistent
    try {
      const isHe = lang()==='he';
      const labels = {
        he: { index: 'מחשבון חיתוך אופטימלי', plans: 'תוכניות בנייה להורדה', articles: 'מאמרים', about: 'אודות', pricing: 'מחירון', contact: 'צור קשר' },
        en: { index: 'Cut Optimizer',              plans: 'Downloadable Plans',    articles: 'Articles', about: 'About',  pricing: 'Price List', contact: 'Contact' }
      };
      const pageTitles = {
        he: { index: 'מחשבון חיתוך אופטימלי', plans: 'תוכניות בנייה להורדה', articles: 'מאמרים', about: 'אודות', pricing: 'מחירון', contact: 'צור קשר' },
        en: { index: 'Cut Optimizer',              plans: 'Downloadable Plans',    articles: 'Articles', about: 'About',  pricing: 'Price List', contact: 'Contact' }
      };
      const navOrder = [
        { href: 'index.html',   key: 'index'   },
        { href: 'plans.html',   key: 'plans'   },
        { href: 'articles.html', key: 'articles' },
        { href: 'about.html',   key: 'about'   },
        { href: 'pricing.html', key: 'pricing' },
        { href: 'contact.html', key: 'contact' }
      ];
      const buildNavHtml = (activePath) => navOrder.map(item => {
        const text = labels[isHe?'he':'en'][item.key];
        const isArticleDetail = /\/(?:article.html)$/.test(activePath);
        const isActive = activePath.endsWith('/'+item.href)
          || activePath.endsWith(item.href)
          || (item.key==='index' && /\/(?:index.html)?$/.test(activePath))
          || (item.key==='articles' && isArticleDetail);
        return `<a href="${item.href}" class="nav-link${isActive?' active':''}">${text}</a>`;
      }).join('');

      const path = (location.pathname||'').toLowerCase();
      // Desktop nav
      const wrap = document.querySelector('.main-nav .nav-wrap');
      if (wrap) wrap.innerHTML = buildNavHtml(path);
      // Mobile drawer nav (if present)
      const mobileNav = document.querySelector('#mobile-drawer nav[aria-label="mobile"]');
      if (mobileNav) mobileNav.innerHTML = buildNavHtml(path);

      // Update document title
      const isIndex = path.endsWith('/index.html') || /\/(?:index.html)?$/.test(path);
  if (isIndex) document.title = pageTitles[isHe?'he':'en'].index;
  else if (path.endsWith('plans.html')) document.title = pageTitles[isHe?'he':'en'].plans;
  else if (path.endsWith('articles.html')) document.title = pageTitles[isHe?'he':'en'].articles;
  else if (path.endsWith('article.html')) document.title = pageTitles[isHe?'he':'en'].articles;
  else if (path.endsWith('about.html')) document.title = pageTitles[isHe?'he':'en'].about;
  else if (path.endsWith('pricing.html')) document.title = pageTitles[isHe?'he':'en'].pricing;
  else if (path.endsWith('contact.html')) document.title = pageTitles[isHe?'he':'en'].contact;
    } catch(e){}
    // Header buttons (if present)
    const bLang = el('#btn-lang'); if (bLang) bLang.addEventListener('click', toggleLang);
    const bUnits = el('#btn-units'); if (bUnits) bUnits.addEventListener('click', toggleUnits);
    const bCur = el('#btn-currency'); if (bCur) bCur.addEventListener('click', cycleCurrency);
    // Header selects (all pages) — sync to global state and localize labels
    try {
      const selLang = el('#select-lang');
      if (selLang) {
        try { selLang.value = lang(); } catch{}
        selLang.addEventListener('change', (e)=>{ setLang(e.target.value); location.reload(); });
      }
      const selUnits = el('#select-units');
      if (selUnits) {
        // Localize option labels for English
        try {
          const isHe = lang()==='he';
          selUnits.querySelectorAll('option').forEach(opt=>{
            const en = opt.getAttribute('data-en');
            if (!isHe && en) opt.textContent = en;
            if (isHe && en) {
              // revert to Hebrew already in markup
            }
          });
        } catch{}
        try { selUnits.value = unit(); } catch{}
        selUnits.addEventListener('change', (e)=>{ setUnit(e.target.value); location.reload(); });
      }
      const selCur = el('#select-currency');
      if (selCur) {
        // Localize option labels for English
        try {
          const isHe = lang()==='he';
          selCur.querySelectorAll('option').forEach(opt=>{
            const en = opt.getAttribute('data-en');
            if (!isHe && en) opt.textContent = en;
          });
        } catch{}
        // Prefer stored symbol; else derive from currency code
        const sym = (readStr('currencySymbol','')||'').replace(/["'״]/g,'') || symbolFromCurrency(currency());
        try { selCur.value = sym; } catch{}
        selCur.addEventListener('change', (e)=>{
          const s = (e.target.value||'€');
          localStorage.setItem('currencySymbol', s);
          // Also store matching currency code for consistency
          const code = s==='€'?'EUR':s==='$'?'USD':s==='₪'?'ILS':'EUR';
          setCurrency(code);
          location.reload();
        });
      }
    } catch {}
    // Saw thickness modal in Block 1 (desktop + mobile)
    try{
      const btn = document.getElementById('saw-settings-btn');
      const inputMain = document.getElementById('saw-thickness');
      const unitMain = document.getElementById('saw-unit');
      const pop = document.getElementById('saw-popover');
      if (btn) btn.hidden = false;
      if (btn && inputMain && unitMain){
        btn.addEventListener('click', ()=>{
          // If enhanced popover is present, let app.js handle it
          if (pop) return;
          const unitLbl = unitMain.textContent || 'mm';
          const modal = document.createElement('div');
          modal.className = 'global-modal kerf-modal';
          modal.setAttribute('role','dialog');
          modal.setAttribute('aria-modal','true');
          modal.innerHTML = `
            <div class="global-modal-backdrop"></div>
            <div class="global-modal-box" role="document">
              <h3 class="global-modal-title">${(document.documentElement.lang||'he')==='he'?'עובי מסור':'Saw kerf'}</h3>
              <div class="global-modal-body">
                <div class="kerf-row">
                  <input id="kerf-input" type="number" min="0" step="0.1" value="${inputMain.value}" aria-label="${(document.documentElement.lang||'he')==='he'?'עובי מסור':'Saw kerf'}" />
                  <span class="chip">${unitLbl}</span>
                </div>
              </div>
              <div class="global-modal-actions">
                <button id="kerf-save" class="btn primary">${(document.documentElement.lang||'he')==='he'?'שמור':'Save'}</button>
                <button id="kerf-cancel" class="btn">${(document.documentElement.lang||'he')==='he'?'ביטול':'Cancel'}</button>
              </div>
            </div>`;
          document.body.appendChild(modal);
          const close = () => { try{ modal.remove(); }catch{} };
          modal.querySelector('.global-modal-backdrop')?.addEventListener('click', close);
          modal.querySelector('#kerf-cancel')?.addEventListener('click', close);
          modal.querySelector('#kerf-save')?.addEventListener('click', ()=>{
            const v = modal.querySelector('#kerf-input');
            if (v && inputMain){ inputMain.value = v.value; try{ inputMain.dispatchEvent(new Event('input', { bubbles:true })); }catch{} }
            close();
          });
          document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onKey);} });
        });
      }
    }catch{}

    // Ensure mobile drawer shell exists on every page (inject if missing)
    try {
      let hamburger = document.getElementById('hamburger');
      let backdrop = document.getElementById('drawer-backdrop');
      let drawer = document.getElementById('mobile-drawer');
      const ensureNavLinks = (container) => {
        try{
          const src = Array.from(document.querySelectorAll('.main-nav .nav-wrap a'));
          if (src.length && container){
            container.innerHTML = src.map(a=>`<a href="${a.getAttribute('href')||'#'}" class="nav-link${a.classList.contains('active')?' active':''}">${a.textContent||''}</a>`).join('');
          } else if (container){
            const isHe = (document.documentElement.lang||'he')==='he';
            const fall = isHe
              ? [
                  ['index.html',   'מחשבון חיתוך אופטימלי'],
                  ['plans.html',   'תוכניות בנייה להורדה'],
                  ['articles.html','מאמרים'],
                  ['about.html',   'אודות'],
                  ['pricing.html', 'מחירון'],
                  ['contact.html', 'צור קשר']
                ]
              : [
                  ['index.html',   'Cut Optimizer'],
                  ['plans.html',   'Downloadable Plans'],
                  ['articles.html','Articles'],
                  ['about.html',   'About'],
                  ['pricing.html', 'Price List'],
                  ['contact.html', 'Contact']
                ];
            container.innerHTML = fall.map(([h,t])=>`<a href="${h}" class="nav-link">${t}</a>`).join('');
          }
        }catch{}
      };
      if (!hamburger){
        hamburger = document.createElement('button');
        hamburger.id = 'hamburger';
        hamburger.className = 'hamburger';
        hamburger.setAttribute('aria-label','menu');
        hamburger.setAttribute('aria-controls','mobile-drawer');
        hamburger.setAttribute('aria-expanded','false');
        hamburger.hidden = true;
        hamburger.innerHTML = '<span class="bars" aria-hidden="true"><span class="bar"></span><span class="bar"></span><span class="bar"></span></span>';
        document.body.appendChild(hamburger);
      }
      if (!backdrop){
        backdrop = document.createElement('div');
        backdrop.id = 'drawer-backdrop';
        backdrop.className = 'drawer-backdrop';
        backdrop.hidden = true;
        document.body.appendChild(backdrop);
      }
      if (!drawer){
        drawer = document.createElement('aside');
        drawer.id = 'mobile-drawer';
        drawer.className = 'mobile-drawer';
        drawer.hidden = true;
        const nav = document.createElement('nav');
        nav.setAttribute('aria-label','mobile');
        drawer.appendChild(nav);
        document.body.appendChild(drawer);
  ensureNavLinks(nav);
      } else {
        const nav = drawer.querySelector('nav[aria-label="mobile"]');
        if (nav && !nav.children.length) ensureNavLinks(nav);
      }
    } catch{}

    // Mobile drawer setup
    try {
      const mqMobile = window.matchMedia('(max-width: 900px)');
      const hamburger = document.getElementById('hamburger');
      const drawer = document.getElementById('mobile-drawer');
      const backdrop = document.getElementById('drawer-backdrop');
      const updateVisibility = () => {
        const on = mqMobile.matches;
        if (hamburger) hamburger.hidden = !on;
        // Keep drawer/backdrop hidden by default; only openDrawer removes it
  if (drawer) { drawer.classList.remove('open'); drawer.hidden = true; try{drawer.style.display='none';}catch{} }
  if (backdrop) { backdrop.classList.remove('open'); backdrop.hidden = true; try{backdrop.style.display='none';}catch{} }
        if (!on) {
          hamburger && hamburger.setAttribute('aria-expanded','false');
        }
      };
      updateVisibility();
      mqMobile.addEventListener('change', updateVisibility);
  // Close drawer if leaving mobile layout
  mqMobile.addEventListener('change', (e)=>{ if (!e.matches) { try{ drawer && drawer.classList.remove('open'); backdrop && backdrop.classList.remove('open'); hamburger && hamburger.setAttribute('aria-expanded','false'); }catch{} } });
      const openDrawer = () => {
        if (!drawer || !backdrop || !hamburger) return;
        // Ensure elements are visible
        try { drawer.hidden = false; drawer.removeAttribute('hidden'); } catch{}
        try { backdrop.hidden = false; backdrop.removeAttribute('hidden'); } catch{}
  try { drawer.style.display = 'block'; } catch{}
  try { backdrop.style.display = 'block'; } catch{}
  // Fallback: force transform to visible in case CSS class is overridden
  try { drawer.style.transform = 'translateX(0)'; } catch{}
        drawer.classList.add('open');
        backdrop.classList.add('open');
        hamburger.setAttribute('aria-expanded','true');
      };
      const closeDrawer = () => {
        if (!drawer || !backdrop || !hamburger) return;
        drawer.classList.remove('open');
        backdrop.classList.remove('open');
        hamburger.setAttribute('aria-expanded','false');
        // Immediately hide to avoid stray focus
  try { drawer.hidden = true; drawer.style.display='none'; } catch{}
  try { backdrop.hidden = true; backdrop.style.display='none'; } catch{}
  try { drawer.style.transform = ''; } catch{}
      };
      if (hamburger) hamburger.addEventListener('click', ()=>{
        if (drawer && drawer.classList.contains('open')) closeDrawer(); else openDrawer();
      });
      if (backdrop) backdrop.addEventListener('click', closeDrawer);
  // Close on Escape
  window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeDrawer(); });
      if (drawer) drawer.addEventListener('click', (e)=>{
        const a = e.target.closest('a');
        if (a) closeDrawer();
      });
    } catch{}

  // Index page: (previously moved Project Name on mobile). Now we hide it entirely on mobile via CSS, so no DOM moves are needed.
    try {
      const path = (location.pathname || '').toLowerCase();
      const isIndex = path.endsWith('/index.html') || path.endsWith('index.html') || /\/(?:index.html)?$/.test(path);
      if (isIndex) {
    // No action required; CSS handles mobile hide.
      }
    } catch{}

    // Match Add-wood button (top row) width to the combined width of the two DB controls below
    try {
      const topRow = document.querySelector('#block-db .db-right'); // contains add-wood
      const bottomRow = document.querySelector('#block-db .db-add-wrap'); // contains show+file
      if (topRow && bottomRow){
        const syncWidth = () => {
          try{
            const rect = bottomRow.getBoundingClientRect();
            const w = Math.max(0, Math.round(rect.width));
            topRow.style.width = w ? (w + 'px') : '';
            const btn = topRow.querySelector('#add-db-row');
            if (btn) btn.style.width = '100%';
          }catch{}
        };
        syncWidth();
        window.addEventListener('resize', syncWidth, { passive:true });
        try{ new ResizeObserver(syncWidth).observe(bottomRow); }catch{}
      }
    } catch{}
  });
})();
