function currentLang(){
  try{ return (JSON.parse(localStorage.getItem('lang'))||'he').toLowerCase(); }catch{ return (localStorage.getItem('lang')||'he').toLowerCase(); }
}
const t = {
  he: {
    nameReq: 'נא להזין שם מלא',
    emailReq: 'נא להזין אימייל תקין',
    subjectReq: 'נא להזין נושא',
    messageReq: 'נא להזין הודעה',
    sending: 'מעביר לדוא"ל ברירת המחדל לשליחה...'
  },
  en: {
    nameReq: 'Please enter full name',
    emailReq: 'Please enter a valid email',
    subjectReq: 'Please enter a subject',
    messageReq: 'Please enter a message',
    sending: 'Opening your default email client...'
  }
};

function validate(form) {
  const data = new FormData(form);
  const fullName = (data.get('fullName') || '').trim();
  const email = (data.get('email') || '').trim();
  const subject = (data.get('subject') || '').trim();
  const message = (data.get('message') || '').trim();

  const status = document.getElementById('form-status');
  status.textContent = '';

  const lang = currentLang();
  if (!fullName) { status.textContent = t[lang].nameReq; return null; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status.textContent = t[lang].emailReq; return null; }
  if (!subject) { status.textContent = t[lang].subjectReq; return null; }
  if (!message) { status.textContent = t[lang].messageReq; return null; }

  return { fullName, email, subject, message, phone: (data.get('phone') || '').trim() };
}

function submitContact(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const payload = validate(form);
  if (!payload) return;

  const body = [
    `שם: ${payload.fullName}`,
    `אימייל: ${payload.email}`,
    payload.phone ? `טלפון: ${payload.phone}` : null,
    `נושא: ${payload.subject}`,
    '---',
    payload.message
  ].filter(Boolean).join('%0D%0A');

  const mailto = `mailto:unique.center.yoni@gmail.com?subject=${encodeURIComponent(payload.subject)}&body=${body}`;
  window.location.href = mailto;

  const status = document.getElementById('form-status');
  status.textContent = t[currentLang()].sending;
}

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (form) form.addEventListener('submit', submitContact);
  // Localize labels/placeholders
  const lang = currentLang();
  const h2 = document.querySelector('main .card h2');
  if (h2) h2.textContent = lang==='he' ? 'נשמח לשמוע מכם' : "We'd love to hear from you";
  const map = {
    'label[for="fullName"]': { he:'שם מלא', en:'Full Name' },
    'label[for="email"]':    { he:'כתובת אימייל', en:'Email Address' },
    'label[for="phone"]':    { he:'טלפון (לא חובה)', en:'Phone (optional)' },
    'label[for="subject"]':  { he:'נושא הפנייה', en:'Subject' },
    'label[for="message"]':  { he:'הודעה', en:'Message' }
  };
  Object.entries(map).forEach(([sel,vals])=>{
    const el = document.querySelector(sel); if (el) el.textContent = vals[lang];
  });
  const placeholders = [
    ['#fullName', { he:'הזן/י שם מלא', en:'Enter full name' }],
    ['#email',    { he:'name@example.com', en:'name@example.com' }],
    ['#phone',    { he:'050-0000000', en:'555-000-0000' }],
    ['#subject',  { he:'כותרת קצרה', en:'Short title' }],
    ['#message',  { he:'פרטי הפנייה', en:'Your message' }]
  ];
  placeholders.forEach(([sel,vals])=>{ const el = document.querySelector(sel); if (el) el.placeholder = vals[lang]; });
  const submitBtn = document.querySelector('button[type="submit"]');
  const resetBtn = document.querySelector('button[type="reset"]');
  if (submitBtn) submitBtn.textContent = lang==='he' ? 'שלח' : 'Send';
  if (resetBtn) resetBtn.textContent = lang==='he' ? 'איפוס' : 'Reset';
});
