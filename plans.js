// i18n helpers
function currentLang(){
  try{ return (JSON.parse(localStorage.getItem('lang'))||'he').toLowerCase(); }catch{ return (localStorage.getItem('lang')||'he').toLowerCase(); }
}
const t = {
  he: {
    buy: 'רכישה',
    search: 'חיפוש תוכנית...',
    total: 'סה"כ',
    buyMsg: (name) => `לביצוע רכישה של "${name}" פנה אלינו דרך דף צור קשר.`
  },
  en: {
    buy: 'Buy',
    search: 'Search plan...',
    total: 'Total',
    buyMsg: (name) => `To purchase "${name}", please contact us via the Contact page.`
  }
};

// Prefer shared data if present (from plans-data.js)
const plans = (window.PLANS && Array.isArray(window.PLANS)) ? window.PLANS : [
  { id: 1, title: {he:'מגדל למידה מונטסורי', en:'Montessori Learning Tower'}, desc: {he:'פתרון עיצובי ופונקציונלי שמאפשר לילדים לעמוד בגובה משטחי עבודה של מבוגרים בבטחה ובעצמאות, ומעודד אותם לקחת חלק פעיל במטלות יומיומיות.', en:'A functional design that lets children safely and independently reach adult countertop height and take an active part in daily tasks.'}, price: 20, currency: '₪', img: 'pics/learnningtower.jpg', img2: '', tags: ['kids','montessori','learning','tower'] },
  { id: 2, title: {he:'אדנית עץ ריבועית', en:'Square Wooden Planter'}, desc: {he:'אדנית לגינה מעץ, מושלמת לגידול פרחים, צמחי תבלין וירקות, משדרגת כל פינת ישיבה.', en:'A wooden garden planter, perfect for growing flowers, herbs and vegetables; elevates any seating area.'}, price: 15, currency: '₪', img: 'pics/gardenbed.jpg', img2: '', tags: ['planter','garden','wood'] },
  { id: 3, title: {he:'מיטת מעבר מונטסורית', en:'Montessori Toddler Bed'}, desc: {he:'מיטת מעבר מונטסורית לילד שלכם: תוכנית בנייה קלה, מפורטת ונגישה, הכוללת את כל השלבים, רשימת החומרים וכלי העבודה כדי שתוכלו לבנות במו ידיכם מיטה בטוחה שתעודד עצמאות, חופש תנועה וביטחון עצמי.', en:'A Montessori toddler transition bed: a clear, easy-to-follow building plan with all steps, materials and tools, so you can build a safe bed that fosters independence, freedom of movement and confidence.'}, price: 25, currency: '₪', img: 'pics/montesorribed.jpg', img2: '', tags: ['bed','kids','montessori'] },
  { id: 4, title: {he:'קמפוס בורד לאימונים', en:'Campus Board for Training'}, desc: {he:'לוח אימונים מודולרי, שיאפשר לכם לשפר את טכניקת הטיפוס והכוח בכל רגע, בנוחות הבית', en:'A modular training board to improve climbing technique and strength anytime, from the comfort of your home.'}, price: 15, currency: '₪', img: 'pics/campusboard.jpg', img2: '', tags: ['climbing','training','fitness'] },
];

// simple currency rates aligned with app.js
const currencyRates = { '€': 1, '$': 1.1, '₪': 4.0 };
function normalizeCurrencySymbol(s){
  if (!s) return '€';
  const m = { 'EUR':'€','USD':'$','ILS':'₪','€':'€','$':'$','₪':'₪' };
  return m[s] || m[s.toUpperCase()] || '€';
}
function convertCurrency(value, fromSymbol, toSymbol){
  const v = Number(value);
  const from = normalizeCurrencySymbol(fromSymbol);
  const to = normalizeCurrencySymbol(toSymbol);
  if (!isFinite(v) || !currencyRates[from] || !currencyRates[to]) return value;
  const eur = v / currencyRates[from];
  return eur * currencyRates[to];
}
function chosenCurrencySymbol(){
  return localStorage.getItem('currencySymbol') || normalizeCurrencySymbol(localStorage.getItem('currency') || 'EUR');
}
function formatPrice(basePrice, baseSymbol){
  const to = chosenCurrencySymbol();
  const val = convertCurrency(basePrice, baseSymbol, to);
  return `${to}${Math.round(Number(val) * 100) / 100}`;
}

// Derive secondary image from primary by inserting _s before extension
function deriveSecondImage(imgPath){
  if (!imgPath || typeof imgPath !== 'string') return '';
  const qPos = imgPath.indexOf('?');
  const path = qPos >= 0 ? imgPath.slice(0, qPos) : imgPath;
  const lastSlash = path.lastIndexOf('/');
  const lastDot = path.lastIndexOf('.');
  if (lastDot > lastSlash) {
    return path.slice(0, lastDot) + '_s' + path.slice(lastDot);
  }
  return path + '_s';
}

function planCard(p) {
  const lang = currentLang();
  const imgs = [];
  const primary = p.img || '';
  const secondary = p.img2 || deriveSecondImage(primary);
  let imgHTML = '';
  if (p.id === 1) {
    // Special 3-step carousel: primary, secondary (if exists), and YouTube video
    const videoId = 'il4dtzUaMwM';
    const videoURL = `https://www.youtube.com/embed/${videoId}`;
    imgHTML = `
  <div class="thumb" aria-label="${p.title[lang]}" data-carousel="montessori">
        <div class="carousel-frame" data-step="0" style="position:absolute; inset:0;">
          ${primary ? `<img class="thumb-img step step-0" src="${primary}" alt="${p.title[lang]}" loading="lazy" style="opacity:1" />` : ''}
          ${secondary ? `<img class="thumb-img step step-1" src="${secondary}" alt="${p.title[lang]} – מצב 2" loading="lazy" style="opacity:0" />` : ''}
          <iframe class="thumb-img step step-2" src="${videoURL}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="opacity:0; width:100%; height:100%"></iframe>
        </div>
  <div class="dots" aria-hidden="true"><span class="dot active"></span><span class="dot"></span><span class="dot"></span></div>
  <button class="arrow left" type="button" aria-label="prev">‹</button>
  <button class="arrow right" type="button" aria-label="next">›</button>
      </div>`;
  } else {
    const imgs = [];
    if (primary) imgs.push(primary);
    if (secondary) imgs.push(secondary);
    imgHTML = imgs.length
    ? `<div class="thumb" aria-label="${p.title[lang]}">`+
          `<img class="thumb-img primary" src="${imgs[0]}" alt="${p.title[lang]}" loading="lazy" />`+
          (imgs[1] ? `<img class="thumb-img secondary" src="${imgs[1]}" alt="${p.title[lang]} – תכנית בנייה" loading="lazy" onerror="this.remove()" />` : '')+
          (imgs[1] ? `<div class="dots" aria-hidden="true"><span class="dot active"></span><span class="dot"></span></div>` : '')+
      (imgs[1] ? `<button class="arrow left" type="button" aria-label="prev">‹</button><button class="arrow right" type="button" aria-label="next">›</button>` : '')+
        `</div>`
      : `<div class="thumb">${p.title[lang].substring(0, 2)}</div>`;
  }
  return `
    <article class="plan-card">
      ${imgHTML}
      <div class="body">
        <h3>${p.title[lang]}</h3>
        <p>${p.desc[lang]}</p>
        <div class="price">${formatPrice(p.price, p.currency)}</div>
      </div>
      <div class="card-actions">
  <button class="btn primary" onclick="buyPlan(${p.id})">${t[lang].buy}</button>
      </div>
    </article>
  `;
}

function render(list) {
  const grid = document.getElementById('plans-grid');
  const count = document.getElementById('plans-count');
  grid.innerHTML = list.map(planCard).join('');
  count.textContent = list.length;
}

function searchPlans(q) {
  const s = q.trim().toLowerCase();
  if (!s) return plans;
  const lang = currentLang();
  return plans.filter(p => {
    const title = (p.title && p.title[lang]) ? p.title[lang].toLowerCase() : '';
    const desc  = (p.desc && p.desc[lang]) ? p.desc[lang].toLowerCase() : '';
    const tags  = (p.tags||[]).map(String).join(' ').toLowerCase();
    return title.includes(s) || desc.includes(s) || tags.includes(s);
  });
}

function buyPlan(id) {
  // Navigate to checkout page with plan id
  try {
    const url = new URL(location.origin + location.pathname.replace(/[^/]*$/, 'checkout.html'));
    url.searchParams.set('plan', String(id));
    location.href = url.toString();
  } catch {
    // Fallback
    location.href = 'checkout.html?plan=' + encodeURIComponent(String(id));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('plans-search');
  // Localize toolbar texts
  const lang = currentLang();
  if (input) input.placeholder = t[lang].search;
  const chip = document.querySelector('.plans-toolbar .chip');
  if (chip) chip.childNodes[0].nodeValue = t[lang].total.replace(/"/g,'') + ' ';
  render(plans);
  input.addEventListener('input', () => render(searchPlans(input.value)));

  // Mobile + Desktop: add arrows, swipe, and click-to-open behaviors
  const enableThumbToggles = () => {
    const cards = Array.from(document.querySelectorAll('.plan-card .thumb'));
    cards.forEach(thumb => {
      const isMontessori = thumb.dataset.carousel === 'montessori';
      const dots = thumb.querySelectorAll('.dot');
      if (isMontessori) {
        // 3-step carousel, click to advance
        const steps = thumb.querySelectorAll('.step');
        let step = 0;
        const sync = () => {
          steps.forEach((el, i) => { el.style.opacity = (i === step ? '1' : '0'); });
          dots.forEach((d, i) => d.classList.toggle('active', i === step));
        };
        sync();
        // Desktop arrows
        const prevBtn = thumb.querySelector('.arrow.left');
        const nextBtn = thumb.querySelector('.arrow.right');
        if (prevBtn) prevBtn.addEventListener('click', (e)=>{ e.stopPropagation(); step = (step + 2) % 3; sync(); });
        if (nextBtn) nextBtn.addEventListener('click', (e)=>{ e.stopPropagation(); step = (step + 1) % 3; sync(); });
        // Center click opens in new tab (image or video)
        thumb.addEventListener('click', () => {
          const cur = thumb.querySelector(`.step-${step}`);
          const img = cur?.tagName === 'IMG' ? cur.getAttribute('src') : null;
          const url = img || (cur?.tagName === 'IFRAME' ? cur.getAttribute('src') : null);
          if (url) window.open(url, '_blank', 'noopener');
        });
        // Touch swipe for mobile
        let x0 = null; let y0 = null; let moved = false;
        const onTouchStart = (e)=>{ const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; moved=false; };
        const onTouchMove = (e)=>{ if (x0===null) return; const t=e.touches[0]; const dx=t.clientX-x0; const dy=t.clientY-y0; if (Math.abs(dx)>10 && Math.abs(dx)>Math.abs(dy)) { moved=true; e.preventDefault(); } };
  const onTouchEnd = (e)=>{ if (x0===null) return; if (moved){ if (x0 !== null){ const dx = (e.changedTouches?.[0]?.clientX ?? x0) - x0; if (dx < -20) { step=(step+1)%3; } else if (dx > 20) { step=(step+2)%3; } sync(); } } else { // tap opens
            const cur = thumb.querySelector(`.step-${step}`);
            const img = cur?.tagName === 'IMG' ? cur.getAttribute('src') : null;
            const url = img || (cur?.tagName === 'IFRAME' ? cur.getAttribute('src') : null);
            if (url) window.open(url, '_blank', 'noopener');
        }
          x0=null; y0=null; moved=false; };
        thumb.addEventListener('touchstart', onTouchStart, {passive:true});
        thumb.addEventListener('touchmove', onTouchMove, {passive:false});
        thumb.addEventListener('touchend', onTouchEnd, {passive:true});
        // Disable hover flips for this card
        thumb.classList.add('no-hover');
      } else {
        const primary = thumb.querySelector('.thumb-img.primary');
        const secondary = thumb.querySelector('.thumb-img.secondary');
        if (!primary || !secondary) return;
        let showingSecondary = false;
        const updateDots = () => {
          if (dots.length === 2){
            dots[0].classList.toggle('active', !showingSecondary);
            dots[1].classList.toggle('active', showingSecondary);
          }
        };
        const show = (sec) => {
          showingSecondary = !!sec;
          thumb.classList.toggle('show-secondary', showingSecondary);
          updateDots();
        };
        updateDots();
        // Arrows
        const prevBtn = thumb.querySelector('.arrow.left');
        const nextBtn = thumb.querySelector('.arrow.right');
        if (prevBtn) prevBtn.addEventListener('click', (e)=>{ e.stopPropagation(); show(false); });
        if (nextBtn) nextBtn.addEventListener('click', (e)=>{ e.stopPropagation(); show(true); });
        // Center click opens image in new tab
        thumb.addEventListener('click', () => {
          const curImg = showingSecondary ? secondary : primary;
          const url = curImg?.getAttribute('src');
          if (url) window.open(url, '_blank', 'noopener');
        });
        // Touch swipe
        let x0 = null; let y0=null; let moved=false;
        const onTouchStart = (e)=>{ const t=e.touches[0]; x0=t.clientX; y0=t.clientY; moved=false; };
        const onTouchMove = (e)=>{ if (x0===null) return; const t=e.touches[0]; const dx=t.clientX-x0; const dy=t.clientY-y0; if (Math.abs(dx)>10 && Math.abs(dx)>Math.abs(dy)) { moved=true; e.preventDefault(); } };
        const onTouchEnd = (e)=>{ if (x0===null) return; if (moved){ const dx=(e.changedTouches?.[0]?.clientX ?? x0) - x0; if (dx < -20) { show(true); } else if (dx > 20) { show(false); } } else { const curImg = showingSecondary ? secondary : primary; const url = curImg?.getAttribute('src'); if (url) window.open(url, '_blank', 'noopener'); } x0=null; y0=null; moved=false; };
        thumb.addEventListener('touchstart', onTouchStart, {passive:true});
        thumb.addEventListener('touchmove', onTouchMove, {passive:false});
        thumb.addEventListener('touchend', onTouchEnd, {passive:true});
      }
    });
  };
  // Run after initial render and on further renders
  enableThumbToggles();
  const grid = document.getElementById('plans-grid');
  const mo = new MutationObserver(() => { enableThumbToggles(); });
  if (grid) mo.observe(grid, { childList:true });
});
