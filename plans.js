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

// Data: sample plans with bilingual titles/desc
const plans = [
  { id: 1, title: {he:'ספסל עץ גינה', en:'Garden Wood Bench'}, desc: {he:'ספסל עץ קלאסי להרכבה עצמית', en:'Classic DIY wooden bench'}, price: 59, currency: '₪', img: '', tags: ['bench','garden','outdoor'] },
  { id: 2, title: {he:'שולחן קפה מודרני', en:'Modern Coffee Table'}, desc: {he:'שולחן סלון מינימליסטי', en:'Minimal living-room table'}, price: 79, currency: '₪', img: '', tags: ['table','living','modern'] },
  { id: 3, title: {he:'מדף קיר מרחף', en:'Floating Wall Shelf'}, desc: {he:'ערכת הרכבה למדף מרחף', en:'DIY kit for floating shelf'}, price: 39, currency: '₪', img: '', tags: ['shelf','storage','wall'] },
  { id: 4, title: {he:'מזנון טלוויזיה', en:'TV Console'}, desc: {he:'מזנון עץ קלאסי עם אחסון', en:'Classic TV sideboard with storage'}, price: 99, currency: '₪', img: '', tags: ['tv','console','living'] },
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

function planCard(p) {
  const lang = currentLang();
  const img = p.img
    ? `<img class="thumb" src="${p.img}" alt="${p.title[lang]}" />`
    : `<div class="thumb">${p.title[lang].substring(0, 2)}</div>`;
  return `
    <article class="plan-card">
      ${img}
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
  const p = plans.find(x => x.id === id);
  if (!p) return;
  const lang = currentLang();
  alert(t[lang].buyMsg(p.title[lang]));
}

window.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('plans-search');
  // Localize toolbar texts
  const lang = currentLang();
  if (input) input.placeholder = t[lang].search;
  const chip = document.querySelector('.plans-toolbar .chip');
  if (chip) chip.childNodes[0].nodeValue = t[lang].total + ' ';
  render(plans);
  input.addEventListener('input', () => render(searchPlans(input.value)));
});
