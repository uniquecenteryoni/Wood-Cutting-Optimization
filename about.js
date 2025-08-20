// About page: toggle bilingual text blocks by saved language; nav handled globally in site.js
(function(){
  function currentLang(){
    try{ return (JSON.parse(localStorage.getItem('lang'))||'he').toLowerCase(); }catch{ return (localStorage.getItem('lang')||'he').toLowerCase(); }
  }
  function applyBilingual(){
    const isHe = currentLang()==='he';
    document.querySelectorAll('.lang-he').forEach(el=>{ el.style.display = isHe ? '' : 'none'; });
    document.querySelectorAll('.lang-en').forEach(el=>{ el.style.display = isHe ? 'none' : ''; });
  try { document.title = isHe ? 'אודות' : 'About'; } catch{}
  }
  document.addEventListener('DOMContentLoaded', applyBilingual);
})();
