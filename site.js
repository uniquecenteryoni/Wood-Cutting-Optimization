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
        // Navigate to landing when clicking the logo
        try {
          logo.style.cursor = 'pointer';
          logo.addEventListener('click', ()=>{ location.href = 'home.html'; });
        } catch{}
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

  // Redirect directory root ("/") to home.html so refresh lands on the hero
  try {
    const p = (location.pathname||'');
    const isDir = /\/$/.test(p);
    if (isDir && !/home\.html$/.test(p) && location.hash!=='#index') {
      location.replace('home.html');
    }
  } catch {}

  // Also redirect direct visits to index.html back to home.html unless explicitly opened via #index
  try {
    const p = (location.pathname||'').toLowerCase();
    const onIndex = p.endsWith('/index.html') || p.endsWith('index.html');
    const explicitIndex = (location.hash||'') === '#index';
    if (onIndex && !explicitIndex) {
      location.replace('home.html');
    }
  } catch {}

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

    // Ensure consistent header (logo + three selects) across all pages
    try {
      const ensureHeader = () => {
        let header = document.querySelector('header.topbar');
        const standard = () => {
          const isHe = lang()==='he';
          const isDashboard = document.body.classList.contains('dash-body');
          const authLabel = (()=>{
            try {
              const stored = JSON.parse(localStorage.getItem('authUser')||'null');
              if (stored && stored.name){
                return isHe ? 'התנתק' : 'Logout';
              }
            } catch {}
            return isHe ? 'התחברות' : 'Login';
          })();
          // If dashboard: only language (hide currency & units)
          const selects = isDashboard ? `
            <select id="select-lang" class="btn select" title="Language">
              <option value="he">🇮🇱</option>
              <option value="en">🇺🇸</option>
            </select>` : `
            <select id="select-lang" class="btn select" title="Language">
              <option value="he">🇮🇱</option>
              <option value="en">🇺🇸</option>
            </select>
            <select id="select-currency" class="btn select" title="Currency">
              <option value="€">€</option>
              <option value="$">$</option>
              <option value="₪">₪</option>
            </select>
            <select id="select-units" class="btn select" title="Units">
              <option value="metric" data-en="Metric">📏</option>
              <option value="imperial" data-en="Inches">📏</option>
            </select>`;
          const userMenu = (()=>{
            if(!isDashboard) return '';
            try {
              const stored = JSON.parse(localStorage.getItem('authUser')||'null');
              const avatarData = localStorage.getItem('userAvatarData');
              if(stored && stored.email){
                const email = stored.email.replace(/</g,'&lt;');
                const avatarSpan = avatarData ? `<span class="avatar has-img" aria-hidden="true"><img src="${avatarData}" alt="avatar"/></span>` : `<span class="avatar" aria-hidden="true">${(email[0]||'U').toUpperCase()}</span>`;
                return `<div class="user-menu" id="dash-user-menu">\n  <button id="dash-usermenu-btn" class="user-btn" aria-haspopup="true" aria-expanded="false">\n    ${avatarSpan}\n    <span class="user-email">${email}</span>▾\n  </button>\n  <div class="user-menu-panel hidden" id="dash-usermenu-panel" role="menu">\n    <button class="menu-item" data-act="messages" role="menuitem">📥 ${(isHe?'תיבת הודעות':'Message box')}</button>\n    <button class="menu-item" data-act="profile" role="menuitem">👤 ${(isHe?'הגדרות פרופיל':'Profile settings')}</button>\n    <button class="menu-item" data-act="password" role="menuitem">🔒 ${(isHe?'שינוי סיסמה':'Change Password')}</button>\n    <div class="sep"></div>\n    <button class="menu-item logout" data-act="logout" role="menuitem">🚪 ${(isHe?'התנתק':'Logout')}</button>\n  </div>\n</div>`;
              }
            }catch{}
            // Fallback guest user menu (no email)
            const guestLabel = isHe ? 'אורח' : 'Guest';
            const guestAvatarData = localStorage.getItem('userAvatarData');
            const guestAvatarSpan = guestAvatarData ? `<span class="avatar has-img" aria-hidden="true"><img src="${guestAvatarData}" alt="avatar"/></span>` : `<span class="avatar" aria-hidden="true">${(guestLabel[0]||'G').toUpperCase()}</span>`;
            return `<div class="user-menu" id="dash-user-menu">\n  <button id="dash-usermenu-btn" class="user-btn" aria-haspopup="true" aria-expanded="false">\n    ${guestAvatarSpan}\n    <span class="user-email">${guestLabel}</span>▾\n  </button>\n  <div class="user-menu-panel hidden" id="dash-usermenu-panel" role="menu">\n    <button class="menu-item" data-act="profile" role="menuitem">👤 ${(isHe?'הגדרות פרופיל':'Profile settings')}</button>\n    <button class="menu-item" data-act="password" role="menuitem">🔒 ${(isHe?'שינוי סיסמה':'Change Password')}</button>\n  </div>\n</div>`;
          })();
          const authBtn = !isDashboard ? `<button id=\"auth-btn\" type=\"button\" class=\"btn auth-btn\" aria-haspopup=\"dialog\" aria-expanded=\"false\">${authLabel}</button>` : userMenu;
          return `
          <div class="top-left"><img id="site-logo" class="site-logo" src="pics/logo.png" alt="${isHe?'לוגו':'Logo'}" /></div>
          <div class="top-actions">${isHe ? authBtn + selects : selects + authBtn}</div>`;
        };
        if (!header){
          header = document.createElement('header');
          header.className = 'topbar';
          header.innerHTML = standard();
          document.body.insertBefore(header, document.body.firstChild);
          return;
        }
        const hasLang = header.querySelector('#select-lang');
        const hasCur  = header.querySelector('#select-currency');
        const hasUnit = header.querySelector('#select-units');
        const hasLogo = header.querySelector('#site-logo');
        const hasAuth = header.querySelector('#auth-btn');
        const isDashboard = document.body.classList.contains('dash-body');
        if (!hasLang || (!isDashboard && (!hasCur || !hasUnit)) || !hasLogo || !hasAuth){
          header.innerHTML = standard();
        }
        // Force hide currency/unit selects if dashboard (in case left from earlier build)
        if(isDashboard){
          ['#select-currency','#select-units','#btn-currency','#btn-units'].forEach(id=>{ const el = header.querySelector(id); if(el) el.style.display='none'; });
          wireDashUserMenu(header);
          // Logo returns to dashboard home view (welcome quick cards)
          try {
            const logo = header.querySelector('#site-logo');
            if(logo){
              logo.style.cursor='pointer';
              logo.addEventListener('click', e=>{ e.preventDefault(); try { if(window.renderView) window.renderView('home'); } catch{} });
            }
          } catch{}
        }
      };
      ensureHeader();
    } catch{}

    function wireDashUserMenu(header){
      try {
        const btn = header.querySelector('#dash-usermenu-btn');
        const panel = header.querySelector('#dash-usermenu-panel');
        if(!btn || !panel) return;
        const toggle = (open)=>{
          const willOpen = (typeof open==='boolean')?open:panel.classList.contains('hidden');
          if(willOpen){ panel.classList.remove('hidden'); panel.setAttribute('aria-hidden','false'); btn.setAttribute('aria-expanded','true'); }
          else { panel.classList.add('hidden'); panel.setAttribute('aria-hidden','true'); btn.setAttribute('aria-expanded','false'); }
        };
        btn.addEventListener('click', e=>{ e.stopPropagation(); toggle(); });
        // Auto flip if overflowing right edge
        btn.addEventListener('click', ()=>{
          try {
            if(panel.classList.contains('hidden')) return; // will open next tick
            requestAnimationFrame(()=>{
              const rect = panel.getBoundingClientRect();
              const vw = window.innerWidth || document.documentElement.clientWidth;
              if(rect.right > vw - 8){ panel.setAttribute('data-align','flip'); }
              else { panel.removeAttribute('data-align'); }
            });
          } catch{}
        });
        document.addEventListener('click', e=>{ if(!panel.classList.contains('hidden') && !panel.contains(e.target) && e.target!==btn) toggle(false); });
        panel.addEventListener('click', e=>{
          const item = e.target.closest('.menu-item'); if(!item) return;
          const act = item.dataset.act;
          if(act==='logout'){ try { localStorage.removeItem('authUser'); } catch{} location.href='dashboard.html'; return; }
          if(act==='profile'){ location.hash = '#profile'; }
          if(act==='messages'){ location.hash = '#messages'; }
          if(act==='password'){ location.hash = '#change-password'; }
          toggle(false);
        });
      } catch{}
    }

    // Build & localize nav (desktop + mobile) with requested order
    try {
      const isHe = lang()==='he';
      const labels = {
        he: { index: 'מחשבון חיתוך אופטימלי', tools: 'כלים מרכזיים', guide: 'הסבר מערכת', pricing: 'מחירון', plans: 'תוכניות בנייה להורדה', articles: 'מאמרים', about: 'אודות', contact: 'צור קשר' },
        en: { index: 'Cut Optimizer',              tools: 'Key Tools',             guide: 'System Guide', pricing: 'Price List', plans: 'Downloadable Plans', articles: 'Articles', about: 'About',  contact: 'Contact' }
      };
      const pageTitles = {
        he: { home: 'דף הבית', index: 'מחשבון חיתוך אופטימלי', tools: 'כלים מרכזיים', guide: 'הסבר מערכת', pricing: 'מחירון', plans: 'תוכניות בנייה להורדה', articles: 'מאמרים', about: 'אודות', contact: 'צור קשר', terms: 'תנאי שימוש', privacy: 'מדיניות פרטיות' },
        en: { home: 'Home',     index: 'Cut Optimizer',              tools: 'Key Tools',             guide: 'System Guide', pricing: 'Price List', plans: 'Downloadable Plans',    articles: 'Articles', about: 'About',  contact: 'Contact', terms: 'Terms of Use', privacy: 'Privacy Policy' }
      };
      const footerLabels = {
        he: { report: 'דווח על באגים', contact: 'צור קשר', terms: 'תנאי שימוש', privacy: 'מדיניות פרטיות', imp: 'הורד קובץ ייבוא' },
        en: { report: 'Report a bug',  contact: 'Contact', terms: 'Terms',       privacy: 'Privacy',           imp: 'Download import file' }
      };
      const navOrder = [
        { href: 'index.html#index',  key: 'index'   },
        { href: 'home.html#tools',   key: 'tools'   },
        { href: 'home.html#guide',   key: 'guide'   },
        { href: 'home.html#pricing', key: 'pricing' },
        { href: 'plans.html',        key: 'plans'   },
        { href: 'articles.html',     key: 'articles' },
        { href: 'home.html#about',   key: 'about'   },
        { href: 'contact.html',      key: 'contact' }
      ];
      const buildNavHtml = (activePath) => navOrder.map(item => {
        const text = labels[isHe?'he':'en'][item.key];
        const isArticleDetail = /\/(?:article.html)$/.test(activePath);
        const hasHash = (item.href||'').includes('#');
        let isActive = false;
        if (hasHash){
          const parts = item.href.split('#');
          const base = parts[0]; const anchor = '#'+(parts[1]||'');
          const onHome = activePath.endsWith('/'+base) || activePath.endsWith(base);
          isActive = onHome && (location.hash === anchor);
        } else {
          isActive = activePath.endsWith('/'+item.href)
            || activePath.endsWith(item.href)
            || (item.key==='index' && /\/(?:index.html)?$/.test(activePath))
            || (item.key==='articles' && isArticleDetail);
        }
        return `<a href="${item.href}" class="nav-link${isActive?' active':''}">${text}</a>`;
      }).join('');

  const path = (location.pathname||'').toLowerCase();
      // Desktop nav
      const wrap = document.querySelector('.main-nav .nav-wrap');
      if (wrap) wrap.innerHTML = buildNavHtml(path);
      // Mobile drawer nav (if present)
      const mobileNav = document.querySelector('#mobile-drawer nav[aria-label="mobile"]');
      if (mobileNav) mobileNav.innerHTML = buildNavHtml(path);

      // Compute sticky offset (topbar + nav) and keep it updated
      const measureAndSetStickyOffset = ()=>{
        try{
          const tb = document.querySelector('.topbar');
          const nv = document.querySelector('.main-nav');
          const h1 = tb ? tb.getBoundingClientRect().height : 0;
          const h2 = nv ? nv.getBoundingClientRect().height : 0;
          const total = Math.round(h1 + h2);
          const root = document.documentElement;
          root.style.setProperty('--topbar-h', Math.round(h1) + 'px');
          root.style.setProperty('--nav-h', Math.round(h2) + 'px');
          root.style.setProperty('--sticky-offset', total + 'px');
        }catch{}
      };
      measureAndSetStickyOffset();
      window.addEventListener('resize', measureAndSetStickyOffset, { passive:true });

      // Smooth-scroll in-page home sections to full view on anchor clicks
      try{
        const isHome = path.endsWith('/home.html') || path.endsWith('home.html') || /\/$/.test(path);
        const scrollToSection = (sec)=>{
          if (!sec) return;
          // Ensure section fills the viewport area under sticky header
          try { if (sec.classList && sec.classList.contains('fullview')) sec.style.minHeight = 'calc(100vh - var(--sticky-offset))'; } catch{}
          // Use manual scroll with sticky offset compensation for consistent results
          const rect = sec.getBoundingClientRect();
          // Refresh sticky offset just before scrolling to be precise
          measureAndSetStickyOffset();
          const sticky = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-offset')) || 0;
          const top = rect.top + window.pageYOffset - sticky;
          window.scrollTo({ top, behavior:'smooth' });
        };
        const handler = (e) => {
          const a = e.target.closest('a[href*="#"]');
          if (!a) return;
          const href = a.getAttribute('href')||'';
          if (!/^home\.html(?:#|$)|^#/.test(href)) return;
          const hash = href.includes('#') ? ('#'+href.split('#')[1]) : (location.hash||'');
          const id = hash.replace('#','');
          const sec = document.getElementById(id);
          if (sec){
            e.preventDefault();
            history.pushState(null, '', 'home.html'+hash);
            scrollToSection(sec);
          }
        };
        document.addEventListener('click', handler);
        // On load with a hash, ensure fullview section is visible
        if (isHome && location.hash){
          const id = location.hash.replace('#','');
          const sec = document.getElementById(id);
          if (sec){ setTimeout(()=>scrollToSection(sec), 0); }
        }
        window.addEventListener('hashchange', ()=>{
          const id = location.hash.replace('#','');
          const sec = document.getElementById(id);
          if (sec){ scrollToSection(sec); }
        });
      }catch{}
        // Ensure a consistent footer across all pages with current year
        try{
          const footer = document.querySelector('footer.footer');
          if (footer){
            const year = new Date().getFullYear();
            const f = footerLabels[isHe?'he':'en'];
            footer.innerHTML = `
              <div class="footer-links">
                <a href="#" id="link-report">${f.report}</a>
                <a href="contact.html" id="link-contact">${f.contact}</a>
                <a href="terms.html" id="link-terms">${f.terms}</a>
                <a href="privacy.html" id="link-privacy">${f.privacy}</a>
                <a href="#" id="link-import">${f.imp}</a>
              </div>
              <div class="footer-inner">
                <img src="pics/logo.png" alt="Logo" class="footer-logo" />
                <small>© ${year}</small>
              </div>`;
          }
        }catch{}

      // Update document title
    const isIndex = path.endsWith('/index.html') || /\/(?:index.html)?$/.test(path);
    const isHome  = path.endsWith('/home.html') || path.endsWith('home.html');
  if (isHome) document.title = pageTitles[isHe?'he':'en'].home;
  else if (isIndex) document.title = pageTitles[isHe?'he':'en'].index;
  else if (path.endsWith('tools.html'))  document.title = pageTitles[isHe?'he':'en'].tools;
  else if (path.endsWith('guide.html'))  document.title = pageTitles[isHe?'he':'en'].guide;
  else if (path.endsWith('pricing.html')) document.title = pageTitles[isHe?'he':'en'].pricing;
  else if (path.endsWith('plans.html'))   document.title = pageTitles[isHe?'he':'en'].plans;
  else if (path.endsWith('articles.html')) document.title = pageTitles[isHe?'he':'en'].articles;
  else if (path.endsWith('article.html'))  document.title = pageTitles[isHe?'he':'en'].articles;
  else if (path.endsWith('about.html'))    document.title = pageTitles[isHe?'he':'en'].about;
  else if (path.endsWith('contact.html'))  document.title = pageTitles[isHe?'he':'en'].contact;
  else if (path.endsWith('terms.html'))    document.title = pageTitles[isHe?'he':'en'].terms;
  else if (path.endsWith('privacy.html'))  document.title = pageTitles[isHe?'he':'en'].privacy;
    } catch(e){}
    // Header buttons (if present)
    const bLang = el('#btn-lang'); if (bLang) bLang.addEventListener('click', toggleLang);
    const bUnits = el('#btn-units'); if (bUnits) bUnits.addEventListener('click', toggleUnits);
    const bCur = el('#btn-currency'); if (bCur) bCur.addEventListener('click', cycleCurrency);
    // Header selects (all pages) — sync to global state and localize labels
    try {
      // Helper to wrap a select with an icon overlay so the circle shows a glyph consistently
      const ensureIconWrap = (sel, getIcon) => {
        if (!sel) return;
        if (sel.parentElement && sel.parentElement.classList && sel.parentElement.classList.contains('icon-select-wrap')) {
          // already wrapped; just refresh icon
          const span = sel.parentElement.querySelector('.top-icon');
          if (span) span.textContent = getIcon();
          return;
        }
        const wrap = document.createElement('div');
        wrap.className = 'icon-select-wrap';
        sel.parentNode && sel.parentNode.insertBefore(wrap, sel);
        wrap.appendChild(sel);
        const span = document.createElement('span');
        span.className = 'top-icon';
        span.textContent = getIcon();
        wrap.appendChild(span);
        sel.addEventListener('focus', ()=> wrap.classList.add('focused'));
        sel.addEventListener('blur',  ()=> wrap.classList.remove('focused'));
        sel.addEventListener('change', ()=> { try { span.textContent = getIcon(); } catch{} });
      };
      const selLang = el('#select-lang');
      if (selLang) {
        try { selLang.value = lang(); } catch{}
        selLang.addEventListener('change', (e)=>{ setLang(e.target.value); location.reload(); });
        ensureIconWrap(selLang, ()=>{
          try {
            const opt = selLang.options[selLang.selectedIndex];
            const txt = (opt && opt.textContent) ? opt.textContent.trim() : '';
            return txt || (lang()==='he'?'🇮🇱':'🇺🇸');
          } catch { return '🌐'; }
        });
      }
      const selUnits = el('#select-units');
      if (selUnits) {
        // Show only the ruler icon in both languages (hide text labels)
        try {
          selUnits.querySelectorAll('option').forEach(opt=>{ opt.textContent = '📏'; });
        } catch {}
  try { selUnits.value = unit(); } catch{}
  selUnits.addEventListener('change', (e)=>{ setUnit(e.target.value); location.reload(); });
  ensureIconWrap(selUnits, ()=> '📏');
      }
      const selCur = el('#select-currency');
      if (selCur) {
        // Keep only currency symbols (no English words) in all languages
        try { selCur.querySelectorAll('option').forEach(opt=>{ const v = opt.getAttribute('value')||opt.textContent; opt.textContent = v.trim().charAt(0); }); } catch {}
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
        ensureIconWrap(selCur, ()=>{
          try {
            const v = (selCur.value||'').trim();
            if (v) return v; // symbol like €, $, ₪
          } catch{}
          try {
            const opt = selCur.options[selCur.selectedIndex];
            return (opt && opt.textContent) ? opt.textContent.trim() : '€';
          } catch { return '€'; }
        });
      }
    } catch {}
    // Auth button logic (login/register modal placeholder)
    try {
      const btn = document.getElementById('auth-btn');
      if (btn){
        const isHe = lang()==='he';
        const readUser = () => {
          try { return JSON.parse(localStorage.getItem('authUser')||'null'); } catch { return null; }
        };
        const writeUser = (obj) => { try { localStorage.setItem('authUser', JSON.stringify(obj)); } catch{} };
        const clearUser = () => { try { localStorage.removeItem('authUser'); } catch{} };
        const refreshBtn = () => {
          const u = readUser();
            if (u && u.name){ btn.textContent = isHe ? 'התנתק' : 'Logout'; }
            else { btn.textContent = isHe ? 'התחברות' : 'Login'; }
        };
        refreshBtn();
        btn.addEventListener('click', ()=>{
          const u = readUser();
          if (u && u.name){
            clearUser();
            refreshBtn();
            return;
          }
          // Build modal
          const t = (he,en)=> (isHe?he:en);
          const modal = document.createElement('div');
          modal.className = 'global-modal auth-modal';
          modal.setAttribute('role','dialog');
          modal.setAttribute('aria-modal','true');
          modal.innerHTML = `
            <div class="global-modal-backdrop"></div>
            <div class="global-modal-box" role="document">
              <h3 class="global-modal-title">${t('כניסה / הרשמה','Sign in / Register')}</h3>
              <div class="global-modal-body" style="background:transparent; border:none; padding:0">
                <form id="auth-form" style="display:flex; flex-direction:column; gap:10px; margin-top:4px">
                  <input id="auth-name" type="text" placeholder="${t('שם (לרישום חדש)','Name (for new account)')}" style="display:block; padding:10px 12px; border:1px solid var(--border); border-radius:8px; font:inherit" />
                  <input id="auth-email" type="email" required placeholder="${t('דוא"ל','Email')}" style="padding:10px 12px; border:1px solid var(--border); border-radius:8px; font:inherit" />
                  <input id="auth-pass" type="password" required placeholder="${t('סיסמה','Password')}" style="padding:10px 12px; border:1px solid var(--border); border-radius:8px; font:inherit" />
                  <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:4px">
                    <button type="submit" class="btn primary" id="auth-submit">${t('התחבר','Sign in')}</button>
                    <button type="button" class="btn" id="auth-toggle" data-mode="login">${t('לחשבון חדש','Create account')}</button>
                    <button type="button" class="btn" id="auth-cancel">${t('ביטול','Cancel')}</button>
                  </div>
                  <p id="auth-status" style="text-align:center; margin:4px 0 0; font-size:14px; color:var(--muted)"></p>
                </form>
              </div>
            </div>`;
          document.body.appendChild(modal);
          const close = ()=>{ try{ modal.remove(); }catch{} };
          modal.querySelector('.global-modal-backdrop')?.addEventListener('click', close);
          modal.querySelector('#auth-cancel')?.addEventListener('click', close);
          const form = modal.querySelector('#auth-form');
          const nameEl = form.querySelector('#auth-name');
          const emailEl = form.querySelector('#auth-email');
          const passEl = form.querySelector('#auth-pass');
          const toggleBtn = form.querySelector('#auth-toggle');
          const statusEl = form.querySelector('#auth-status');
          const submitBtn = form.querySelector('#auth-submit');
          const setMode = (m)=>{
            if (m==='register'){
              toggleBtn.dataset.mode='register';
              submitBtn.textContent = t('רישום','Register');
              toggleBtn.textContent = t('יש לי כבר חשבון','I have an account');
              nameEl.style.display='block';
            } else {
              toggleBtn.dataset.mode='login';
              submitBtn.textContent = t('התחבר','Sign in');
              toggleBtn.textContent = t('לחשבון חדש','Create account');
              nameEl.style.display='none';
            }
          };
          setMode('login');
          toggleBtn.addEventListener('click', ()=>{
            const mode = toggleBtn.dataset.mode==='login' ? 'register' : 'login';
            setMode(mode);
          });
          form.addEventListener('submit', (e)=>{
            e.preventDefault();
            statusEl.textContent='';
            const mode = toggleBtn.dataset.mode==='register' ? 'register' : 'login';
            const email = (emailEl.value||'').trim();
            const pass = (passEl.value||'').trim();
            const name = (nameEl.value||'').trim();
            if (!email || !pass){ statusEl.textContent = t('אנא מלא דוא"ל וסיסמה','Please provide email and password'); return; }
            if (mode==='register' && !name){ statusEl.textContent = t('אנא הזן שם','Please enter a name'); return; }
            // Pseudo-backend: store a single user in localStorage
            let users = {};
            try { users = JSON.parse(localStorage.getItem('authUsers')||'{}'); } catch { users = {}; }
            if (mode==='register'){
              if (users[email]){ statusEl.textContent = t('משתמש כבר קיים','User already exists'); return; }
              users[email] = { name: name || email.split('@')[0], pass };
              try { localStorage.setItem('authUsers', JSON.stringify(users)); } catch{}
              writeUser({ name: users[email].name, email });
              refreshBtn();
              close();
            } else {
              if (!users[email] || users[email].pass !== pass){ statusEl.textContent = t('פרטים שגויים','Invalid credentials'); return; }
              writeUser({ name: users[email].name, email });
              refreshBtn();
              close();
            }
          });
          document.addEventListener('keydown', function onK(e){ if (e.key==='Escape'){ close(); document.removeEventListener('keydown', onK);} });
        });
      }
    } catch{}
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
                  <input id="kerf-input" type="text" min="0" step="0.1" value="${inputMain.value}" aria-label="${(document.documentElement.lang||'he')==='he'?'עובי מסור':'Saw kerf'}" />
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
      ['index.html#index',  'מחשבון חיתוך אופטימלי'],
      ['home.html#tools',   'כלים מרכזיים'],
      ['home.html#guide',   'הסבר מערכת'],
      ['home.html#pricing', 'מחירון'],
                  ['plans.html',   'תוכניות בנייה להורדה'],
                  ['articles.html','מאמרים'],
  ['home.html#about',   'אודות'],
    ['contact.html', 'צור קשר']
                ]
        : [
      ['index.html#index',  'Cut Optimizer'],
      ['home.html#tools',   'Key Tools'],
      ['home.html#guide',   'System Guide'],
      ['home.html#pricing', 'Price List'],
                  ['plans.html',   'Downloadable Plans'],
                  ['articles.html','Articles'],
  ['home.html#about',   'About'],
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
