(function(){
  // i18n helpers aligned with site.js
  function readStr(key, fallback){
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    try { const parsed = JSON.parse(raw); return typeof parsed === 'string' ? parsed : String(parsed); } catch { return raw; }
  }
  const lang = () => (readStr('lang','he')||'he').replace(/^"|"$/g,'').toLowerCase();
  const isHe = () => lang()==='he';
  const labels = {
    he: {
      summary: 'סיכום הזמנה', pay: 'פרטי תשלום', name: 'שם מלא', email: 'אימייל', card: 'כרטיס אשראי', hint: 'דמו בלבד — לא נגבה תשלום אמיתי', exp: 'תוקף', cvc: 'CVC', payNow: 'שלם עכשיו', missing: 'לא נמצאה תוכנית', thanks: 'תודה! אישור רכישה נשלח לאימייל.'
    },
    en: {
      summary: 'Order Summary', pay: 'Payment Details', name: 'Full Name', email: 'Email', card: 'Credit Card', hint: 'Demo only — no real charge', exp: 'Expiry', cvc: 'CVC', payNow: 'Pay now', missing: 'Plan not found', thanks: 'Thanks! A receipt has been emailed.'
    }
  };

  function chosenCurrencySymbol(){
    const sym = readStr('currencySymbol','');
    if (sym && /[€$₪]/.test(sym)) return sym;
    const cur = (readStr('currency','EUR')||'EUR').toUpperCase();
    return cur==='USD'?'$':cur==='ILS'?'₪':'€';
  }
  const currencyRates = { '€': 1, '$': 1.1, '₪': 4.0 };
  function normalizeSymbol(s){ return s==='EUR'?'€':s==='USD'?'$':s==='ILS'?'₪':s; }
  function convertCurrency(value, fromSymbol, toSymbol){
    const v = Number(value);
    const from = normalizeSymbol(fromSymbol);
    const to = normalizeSymbol(toSymbol);
    if (!isFinite(v) || !currencyRates[from] || !currencyRates[to]) return value;
    const eur = v / currencyRates[from];
    return eur * currencyRates[to];
  }

  function formatPlanPrice(p){
    const to = chosenCurrencySymbol();
    const val = convertCurrency(p.price, p.currency, to);
    return `${to}${Math.round(Number(val)*100)/100}`;
  }

  function qs(k){ const u = new URL(location.href); return u.searchParams.get(k); }
  function renderSummary(){
    const id = Number(qs('plan'));
    const p = (window.PLANS||[]).find(x=>x.id===id);
    const el = document.getElementById('sum-body');
    const L = labels[isHe()?'he':'en'];
    document.getElementById('sum-title').textContent = L.summary;
    document.getElementById('pay-title').textContent = L.pay;
    document.getElementById('name-label').textContent = L.name;
    document.getElementById('email-label').textContent = L.email;
    document.getElementById('card-label').textContent = L.card;
    document.getElementById('card-hint').textContent = L.hint;
    document.getElementById('exp-label').textContent = L.exp;
    document.getElementById('cvc-label').textContent = L.cvc;
    document.getElementById('pay-btn').textContent = L.payNow;
    if (!p) { el.innerHTML = `<p>${L.missing}</p>`; return; }
    const langKey = isHe() ? 'he' : 'en';
    el.innerHTML = `
      <div class="thumb">${p.img ? `<img src="${p.img}" alt="${p.title[langKey]}" />` : ''}</div>
      <h3 style="margin:10px 0 6px">${p.title[langKey]}</h3>
      <p style="margin:0 0 10px;color:#666">${p.desc[langKey]}</p>
      <div class="price-row"><strong>${formatPlanPrice(p)}</strong><span class="chip">1 ×</span></div>
    `;
  }

  function mockValidateCard(num, exp, cvc){
    // basic demo only
    return /\d{12,19}/.test(num.replace(/\s|-/g,'')) && /^(0[1-9]|1[0-2])\/(\d{2})$/.test(exp) && /\d{3,4}/.test(cvc);
  }

  function onSubmit(e){
    e.preventDefault();
    const status = document.getElementById('status');
    status.textContent = '';
    const name = document.getElementById('full-name').value.trim();
    const email = document.getElementById('email').value.trim();
    const card = document.getElementById('card-number').value.trim();
    const exp  = document.getElementById('exp').value.trim();
    const cvc  = document.getElementById('cvc').value.trim();
    const L = labels[isHe()?'he':'en'];
    if (!name || !email || !mockValidateCard(card, exp, cvc)) {
      status.textContent = isHe()? 'נא למלא פרטים תקינים' : 'Please enter valid details';
      return;
    }
    // Demo: simulate payment and redirect back to plans
    const btn = document.getElementById('pay-btn');
    btn.disabled = true; btn.textContent = isHe()? 'מעבד...' : 'Processing...';
    setTimeout(()=>{
      btn.disabled = false; btn.textContent = L.payNow;
      alert(L.thanks);
      location.href = 'plans.html';
    }, 1200);
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    renderSummary();
    document.getElementById('checkout-form').addEventListener('submit', onSubmit);
  });
})();
