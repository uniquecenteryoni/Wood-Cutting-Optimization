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
      const links = Array.from(document.querySelectorAll('.main-nav .nav-wrap a'));
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
        if (path.endsWith('/plans.html') || path.endsWith('plans.html')) {
          siteTitle.textContent = pageTitles[isHe?'he':'en'].plans;
          document.title = pageTitles[isHe?'he':'en'].plans;
        } else if (path.endsWith('/about.html') || path.endsWith('about.html')) {
          siteTitle.textContent = pageTitles[isHe?'he':'en'].about;
          document.title = pageTitles[isHe?'he':'en'].about;
        } else if (path.endsWith('/contact.html') || path.endsWith('contact.html')) {
          siteTitle.textContent = pageTitles[isHe?'he':'en'].contact;
          document.title = pageTitles[isHe?'he':'en'].contact;
        }
      }
    } catch(e){}
    const bLang = el('#btn-lang');
    if (bLang) bLang.addEventListener('click', toggleLang);
    const bUnits = el('#btn-units');
    if (bUnits) bUnits.addEventListener('click', toggleUnits);
    const bCur = el('#btn-currency');
    if (bCur) bCur.addEventListener('click', cycleCurrency);
  });
})();
