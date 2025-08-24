(function(){
  function qs(k){ return new URLSearchParams(location.search).get(k)||''; }
  function render(a){
    const t = document.getElementById('article-title');
    const i = document.getElementById('article-img');
    const b = document.getElementById('article-body');
    if (t) t.textContent = a.title;
    if (i) { i.src = a.img; i.alt = a.title; }
    if (b) {
      // Convert newlines to paragraphs
      const parts = String(a.body||'').split(/\n\n+/);
      b.innerHTML = parts.map(p=>`<p>${p.replace(/\n/g,'<br/>')}</p>`).join('');
    }
  }
  window.addEventListener('DOMContentLoaded', ()=>{
    const id = qs('id');
    const list = (window.ARTICLES||[]);
    const found = list.find(x=>x.id===id) || list[0];
    if (found) render(found);
  });
})();
