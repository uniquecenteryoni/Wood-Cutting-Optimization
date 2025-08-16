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
      const storedSym = readStr('currencySymbol', '') || '';
      const sym = storedSym && /[€$₪]/.test(storedSym) ? storedSym : symbolFromCurrency(currency());
      bCur.textContent = sym || '€';
    }
    const bUnits = el('#btn-units');
    if (bUnits) bUnits.textContent = unit()==='metric' ? 'm' : 'inch';
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
      if (isIndex && !sessionStorage.getItem(key)) {
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
    // Localize nav and page titles
    try {
      const isHe = lang()==='he';
      const labels = {
        he: { index: 'מחשבון חיתוך אופטימלי', plans: 'תוכניות בנייה להורדה', about: 'אודות', contact: 'צור קשר' },
        en: { index: 'Cut Optimizer',              plans: 'Downloadable Plans',    about: 'About',  contact: 'Contact' }
      };
      const pageTitles = {
  he: { plans: 'תוכניות בנייה להורדה', about: 'אודות', contact: 'צור קשר' },
  en: { plans: 'Downloadable Plans',    about: 'About', contact: 'Contact' }
      };
  const links = Array.from(document.querySelectorAll('.main-nav .nav-wrap a, #mobile-drawer a'));
      links.forEach(a => {
        const href = (a.getAttribute('href')||'').split('?')[0];
        if (href.endsWith('index.html')) a.textContent = labels[isHe?'he':'en'].index;
        else if (href.endsWith('plans.html')) a.textContent = labels[isHe?'he':'en'].plans;
        else if (href.endsWith('about.html')) a.textContent = labels[isHe?'he':'en'].about;
        else if (href.endsWith('contact.html')) a.textContent = labels[isHe?'he':'en'].contact;
      });
      // Update top header title for non-index pages
      const path = (location.pathname||'').toLowerCase();
      const siteTitle = document.querySelector('.topbar .site-title');
      if (siteTitle) {
        // Always brand with site name; use document.title to reflect page
        const siteName = isHe ? 'עבודת עץ' : 'wood lab';
        siteTitle.textContent = siteName;
        if (path.endsWith('/plans.html') || path.endsWith('plans.html')) {
          document.title = pageTitles[isHe?'he':'en'].plans;
        } else if (path.endsWith('/about.html') || path.endsWith('about.html')) {
          document.title = pageTitles[isHe?'he':'en'].about;
        } else if (path.endsWith('/contact.html') || path.endsWith('contact.html')) {
          document.title = pageTitles[isHe?'he':'en'].contact;
        } else if (path.endsWith('/index.html') || /\/(?:index.html)?$/.test(path)) {
          document.title = siteName;
        }
      }
    } catch(e){}
    const bLang = el('#btn-lang');
    if (bLang) bLang.addEventListener('click', toggleLang);
    const bUnits = el('#btn-units');
    if (bUnits) bUnits.addEventListener('click', toggleUnits);
    const bCur = el('#btn-currency');
    if (bCur) bCur.addEventListener('click', cycleCurrency);
    // Mobile: Saw thickness popover in Block 1
    try{
      const mqSaw = window.matchMedia('(max-width: 700px)');
      const btn = document.getElementById('saw-settings-btn');
      const pop = document.getElementById('saw-popover');
      const inputMain = document.getElementById('saw-thickness');
      const unitMain = document.getElementById('saw-unit');
      const input = document.getElementById('saw-popover-input');
      const unit = document.getElementById('saw-popover-unit');
      const save = document.getElementById('saw-popover-save');
      const cancel = document.getElementById('saw-popover-cancel');
      const sync = () => {
        if (!inputMain || !input || !unit || !unitMain) return;
        input.value = inputMain.value;
        unit.textContent = unitMain.textContent || 'mm';
      };
      const updateVis = () => {
        const on = mqSaw.matches;
        if (btn) btn.hidden = !on;
        if (pop) { pop.hidden = true; try{pop.style.display='none';}catch{} }
        if (btn) btn.setAttribute('aria-expanded','false');
      };
      updateVis();
      mqSaw.addEventListener('change', updateVis);
      if (btn && pop && inputMain && input && save && cancel){
        btn.addEventListener('click', ()=>{
          // Toggle behavior: second click closes
          const isOpen = pop && pop.hidden === false && pop.style.display !== 'none';
          if (isOpen){
            try{ pop.hidden = true; pop.style.display='none'; }catch{}
            btn.setAttribute('aria-expanded','false');
            return;
          }
          sync();
          try{ pop.hidden = false; pop.style.display='block'; }catch{}
          btn.setAttribute('aria-expanded','true');
        });
        cancel.addEventListener('click', ()=>{
          try{ pop.hidden = true; pop.style.display='none'; }catch{}
          btn.setAttribute('aria-expanded','false');
        });
        save.addEventListener('click', ()=>{
          if (inputMain) inputMain.value = input.value;
          // Fire input event so any listeners update
          try { inputMain.dispatchEvent(new Event('input', { bubbles:true })); } catch{}
          try{ pop.hidden = true; pop.style.display='none'; }catch{}
          btn.setAttribute('aria-expanded','false');
        });
        // Close popover when clicking outside
        document.addEventListener('click', (e)=>{
          if (!pop || pop.hidden) return;
          const inside = e.target === pop || pop.contains(e.target) || e.target === btn || btn.contains(e.target);
          if (!inside) { try{ pop.hidden = true; pop.style.display='none'; }catch{} btn.setAttribute('aria-expanded','false'); }
        });
      }
    }catch{}

    // Mobile drawer setup (present on index page; safe-guard checks on others)
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

    // Index page: on mobile, move Project Name below the buttons; restore in header on desktop
    try {
      const path = (location.pathname || '').toLowerCase();
      const isIndex = path.endsWith('/index.html') || path.endsWith('index.html') || /\/(?:index.html)?$/.test(path);
      if (isIndex) {
        const mq = window.matchMedia('(max-width: 700px)');
        const nameRow = document.querySelector('#block-req .req-name');
        const actions = document.querySelector('#block-req .actions.actions-center');
        const head = document.querySelector('#block-req .card-head');
        const ensurePlacement = () => {
          if (!nameRow || !actions || !head) return;
          if (mq.matches) {
            if (!nameRow.classList.contains('is-mobile-below')) {
              actions.insertAdjacentElement('afterend', nameRow);
              nameRow.classList.add('is-mobile-below');
            }
          } else {
            if (nameRow.classList.contains('is-mobile-below')) {
              head.insertAdjacentElement('afterbegin', nameRow);
              nameRow.classList.remove('is-mobile-below');
            }
          }
        };
        ensurePlacement();
        mq.addEventListener('change', ensurePlacement);
      }
    } catch{}
  });
})();
