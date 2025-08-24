(function(){
  function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }
  function card(a){
    const div = el('div','plan-card');
    const thumb = el('div','thumb no-hover');
    const img = el('img'); img.src = a.img; img.alt = a.title; img.className = 'thumb-img primary';
    thumb.appendChild(img);
    const body = el('div','body');
    const h3 = el('h3'); h3.textContent = a.title;
    const p = el('p'); p.textContent = a.excerpt;
    const actions = el('div','card-actions');
    const isHe = (document.documentElement.lang||'he')==='he';
    const btn = el('a','btn primary'); btn.href = `article.html?id=${encodeURIComponent(a.id)}`; btn.textContent = isHe ? 'קריאה' : 'Read';
    actions.appendChild(btn);
    body.appendChild(h3); body.appendChild(p);
    div.appendChild(thumb); div.appendChild(body); div.appendChild(actions);
    return div;
  }
  window.addEventListener('DOMContentLoaded', ()=>{
    const grid = document.getElementById('articles-grid');
    if (!grid || !window.ARTICLES) return;
    const items = window.ARTICLES.slice(0,5); // exactly 5
    items.forEach(a=> grid.appendChild(card(a)) );
  });
})();
