// Subscription page logic: billing toggle, plan selection, current plan highlighting
(function(){
  const plans = [
    { id:'free', name:{en:'Free', he:'חינם'}, monthly:0, features:{
        linear:{stocks:5, sizes:20, parts:500, unlimited:false},
        panel:{stocks:5, sizes:20, unlimited:false},
        extras:['Basic set of optimization algorithms']
      }
    },
    { id:'standard', name:{en:'Standard', he:'סטנדרט'}, monthly:9, features:{
        linear:{stocks:10, sizes:100, parts:1000, unlimited:false},
        panel:{stocks:10, sizes:100, unlimited:false},
        extras:['Best in class optimization algorithms']
      }
    },
    { id:'professional', name:{en:'Professional', he:'מקצועי'}, monthly:19, features:{
        linear:{unlimited:true}, panel:{unlimited:true},
        extras:['Export to PDF, XLS, CSV, DXF', 'Printable reports', 'Complete cutting plan history', 'Priority support']
      }
    },
    { id:'enterprise', name:{en:'Enterprise API', he:'ארגוני API'}, monthly:99, features:{
        linear:{unlimited:true}, panel:{unlimited:true},
        extras:['All features from Professional plan', 'Powerful REST API', 'API documentation', 'Special offer available upon request']
      }}
  ];

  function $(sel){ return document.querySelector(sel); }
  function createEl(tag, cls){ const el=document.createElement(tag); if(cls) el.className=cls; return el; }
  function lang(){ try{ return JSON.parse(localStorage.getItem('lang')||'"he"').replace(/"/g,'').toLowerCase(); }catch{return 'he';} }
  const L = {
    he:{ breadcrumb:'חיוב ותשלומים / מנוי', current:'התוכנית הנוכחית שלך', billedMonthly:'חיוב חודשי', billedAnnually:'חיוב שנתי - חודשיים חינם', choose:'בחר', yourPlan:'התוכנית שלך', perMonth:'/חודש' },
    en:{ breadcrumb:'Billing & payments / Subscription', current:'Your current plan', billedMonthly:'Billed monthly', billedAnnually:'Billed annually - 2 months FREE', choose:'Choose', yourPlan:'Your current plan', perMonth:'/month' }
  };
  function t(key){ const ll= L[lang()]||L.en; return ll[key]||key; }

  function annualPrice(m){ // two months free => pay for 10
    return m===0?0: m*10; // total annual cost
  }

  function fmtPrice(symbol, monthly, annually, annualMode){
    if(annualMode){ const total = annually; const equiv = (annually/12).toFixed(2); return symbol + total + ' /yr' + (monthly? ' ('+symbol+equiv + t('perMonth')+')' : ''); }
    return symbol + (monthly===0? '0' : monthly) + t('perMonth');
  }

  function render(){
    const container = $('#plans-grid');
    if(!container) return;
    container.innerHTML='';
    const annualMode = $('#billing-toggle').checked;
    const symbol = (localStorage.getItem('currencySymbol')||'€').replace(/['"״]/g,'') || '€';
    const currentPlan = (localStorage.getItem('currentPlan')||'free').replace(/['"]/g,'');
    plans.forEach(p=>{
      const card=createEl('div','sub-card' + (p.id===currentPlan? ' current':'') );
      const head=createEl('div','sub-head');
      const title=createEl('h3'); title.textContent = p.name[lang()]||p.name.en; head.appendChild(title);
      const price=createEl('div','price'); price.textContent = fmtPrice(symbol, p.monthly, annualPrice(p.monthly), annualMode); head.appendChild(price);
      card.appendChild(head);
      const limits=createEl('div','limits');
      if(p.features.linear){
        const lBox=createEl('div','limit-group');
        const h=createEl('h4'); h.textContent='Linear/1D limits'; lBox.appendChild(h);
        if(p.features.linear.unlimited){
          lBox.appendChild(spanLine('Unlimited'));
        } else {
          lBox.appendChild(spanLine('Max number of different stocks '+ (p.features.linear.stocks)));
          lBox.appendChild(spanLine('Max number of different part sizes '+ (p.features.linear.sizes)));
          lBox.appendChild(spanLine('Max number of different required parts '+ (p.features.linear.parts)));
        }
        limits.appendChild(lBox);
      }
      if(p.features.panel){
        const pBox=createEl('div','limit-group');
        const h=createEl('h4'); h.textContent='Panel/2D limits'; pBox.appendChild(h);
        if(p.features.panel.unlimited){
          pBox.appendChild(spanLine('Unlimited'));
        } else {
          pBox.appendChild(spanLine('Max number of different stocks '+ (p.features.panel.stocks)));
          pBox.appendChild(spanLine('Max number of different panel sizes '+ (p.features.panel.sizes)));
        }
        limits.appendChild(pBox);
      }
      card.appendChild(limits);
      if(p.features.extras && p.features.extras.length){
        const feat=createEl('ul','feat-ul');
        p.features.extras.forEach(f=>{ const li=createEl('li'); li.textContent=f; feat.appendChild(li); });
        card.appendChild(feat);
      }
      const actions=createEl('div','actions-row');
      if(p.id===currentPlan){
        const tag=createEl('div','current-tag'); tag.textContent=t('yourPlan'); actions.appendChild(tag);
      } else {
        const btn=createEl('button','btn primary choose-btn'); btn.textContent=t('choose'); btn.addEventListener('click', ()=>{
          localStorage.setItem('currentPlan', p.id);
          render();
        }); actions.appendChild(btn);
      }
      card.appendChild(actions);
      container.appendChild(card);
    });
  }
  function spanLine(txt){ const d=document.createElement('div'); d.className='line'; d.textContent=txt; return d; }

  document.addEventListener('DOMContentLoaded', ()=>{
    const bc=$('#breadcrumb'); if(bc) bc.textContent=t('breadcrumb');
    $('#bill-label-month').textContent=t('billedMonthly');
    $('#bill-label-annual').textContent=t('billedAnnually');
    render();
    $('#billing-toggle').addEventListener('change', render);
  });
})();
