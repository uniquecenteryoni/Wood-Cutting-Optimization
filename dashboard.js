// Lightweight dashboard boot logic (keeps existing site.js/auth untouched)
(function(){
  let __dashBooted = false;
  const sel = (q,p=document)=>p.querySelector(q);
  const lang = ()=>{ try { return (localStorage.getItem('lang')||'he').replace(/"/g,''); } catch { return 'he'; } };
  const isHe = ()=> lang()==='he';
  const t = (he,en)=> isHe()?he:en;
  function readUser(){ try { return JSON.parse(localStorage.getItem('authUser')||'null'); } catch { return null; } }

  function ensureLangVisibility(){
    const he = isHe();
    document.documentElement.lang = he?'he':'en';
    document.documentElement.dir = he?'rtl':'ltr';
    document.querySelectorAll('.lang-he').forEach(el=> el.style.display = he?'':'none');
    document.querySelectorAll('.lang-en').forEach(el=> el.style.display = he?'none':'');
  }
  ensureLangVisibility();

  function showLoading(flag){ const l = sel('#dash-loading'); if(!l) return; if(flag===false) l.style.display='none'; else l.style.display='flex'; }

  function init(){
  if(__dashBooted) return; // prevent double
  __dashBooted = true;
  try {
  const user = readUser() || { name: t('אורח','Guest') };
  showLoading(false);
  const app = sel('#dash-app'); if(app) app.hidden = false;
  const nameEl = sel('#dash-user-name'); if(nameEl) nameEl.textContent = user.name ? (' '+user.name) : '';
          // Immediate seed & render so user sees headers structure even if empty
          try { if(window.ensureInventorySeeded) window.ensureInventorySeeded(); } catch{}
    buildQuickCards();
    bindNav();
    // Add a mobile toggle button lazily
    addToggleBtn();
  try { if (window.ensureInventorySeeded) window.ensureInventorySeeded(); } catch{}
  renderView('home');
  hideGlobalSelectors();
  applyStoredTheme();
  } catch(err){
    try { console.error('Dashboard init error', err); } catch{}
    try { showLoading(false); } catch{}
    const box = sel('#dash-view');
    if(box) box.innerHTML = `<div style="padding:24px;color:#c00;font-weight:600">${t('שגיאה בטעינת הדשבורד','Dashboard failed to load')}</div>`;
  }
  }

  function buildQuickCards(){
    const wrap = sel('#dash-cards'); if(!wrap) return;
    const cards = [
      {
        key:'newProject', icon:'➕', title:t('צור פרויקט חדש','Create New Project'),
        body:t('פתח פרויקט תכנון חדש (אורך ולוחות יחד).','Open a new unified planning project.'),
        actions:[{label:t('פתח','Open'), view:'newProject'}]
      },
      {
        key:'warehouse', icon:'🏬', title:t('מלאי חומרים','Material Warehouse'),
        body:t('ניהול מלאי חומרים מרכזי לפרויקטים','Central material inventory management.'),
        actions:[{label:t('פתח','Open'), view:'warehouse'}]
      },
      {
  key:'subscription', icon:'💳', title:t('מנוי וחיוב','Billing & Subscription'),
  body:t('צפו בפרטי המנוי והחשבוניות','View subscription and invoices.'),
        actions:[{label:t('פתח','Open'), view:'subscription'}]
      }
    ];
    wrap.innerHTML = cards.map(c=>`<div class="dash-card" data-key="${c.key}">
      <h3>${c.icon} ${c.title}</h3>
      <p>${c.body}</p>
      <div class="actions">${c.actions.map(a=>`<button class="btn" data-view="${a.view}">${a.label}</button>`).join('')}</div>
    </div>`).join('');
    wrap.addEventListener('click', e=>{
      const btn = e.target.closest('button[data-view]');
      if(!btn) return; renderView(btn.dataset.view);
    });
  }

  function bindNav(){
    const nav = sel('#dash-nav'); if(!nav) return;
    nav.addEventListener('click', e=>{
      const a = e.target.closest('a[data-view]');
      if(!a) return; e.preventDefault();
      renderView(a.dataset.view);
      nav.querySelectorAll('a.item').forEach(i=> i.classList.remove('active'));
      a.classList.add('active');
    });
    const logout = sel('#dash-logout');
  if(logout){ logout.addEventListener('click', ()=>{ try { localStorage.removeItem('authUser'); } catch{} location.reload(); }); }
  }

  function renderView(view){
    const box = sel('#dash-view'); if(!box) return;
    // Allow hash shortcuts (#profile, #change-password)
    if(!view){
      const h = (location.hash||'').replace('#','');
      if(h==='profile') view='profileSettings';
      if(h==='change-password') view='changePassword';
    }
    // React to hash changes directly
    if(!view && ['profile','change-password'].includes((location.hash||'').replace('#',''))){
      view = (location.hash==='#profile')?'profileSettings':'changePassword';
    }
    if(view==='settings'){
      box.innerHTML = buildSettingsPanel();
      wireSettingsPanel();
      return;
    }
  if(view==='warehouse'){ try { localStorage.setItem('dashWarehouseOpen','1'); } catch{} }
    // Special inventory embedding if user chooses importInventory or warehouse or welcome/newProject
  if(['warehouse','welcome'].includes(view)){
      // Try to find existing inventory markup from main app page if present
      if(!document.getElementById('db-area') && window.renderInventoryTable){
        try { window.renderInventoryTable(); } catch {}
      }
      const existing = document.getElementById('db-area');
      // If inventory area exists, clone it (without IDs duplication side-effects) for dashboard
      if(existing){
        const clone = existing.cloneNode(true);
        clone.id = 'dash-db-area';
        // Remove hidden if any
        clone.classList.remove('hidden');
  clone.setAttribute('aria-hidden','false');
        box.innerHTML = '';
        box.appendChild(clone);
        // Ensure table content is rendered inside cloned container
        try { if (window.renderInventoryTable) window.renderInventoryTable(); } catch{}
        // Auto open in warehouse view
        if(view==='warehouse'){
          try { clone.classList.remove('hidden'); clone.setAttribute('aria-hidden','false'); } catch{}
          simplifyInventoryUI(clone);
          // Render table explicitly (in case was hidden state before clone)
          try { if(window.renderInventoryTable) window.renderInventoryTable(); } catch{}
          // Inject Add Item button if not present
          try {
            if(!document.getElementById('dash-add-row-btn')){
              const wrap = clone.querySelector('#db-table-wrap');
              if(wrap){
                const bar = document.createElement('div');
                bar.className='add-row-bar';
                bar.innerHTML = `<button id="dash-add-row-btn" class="big-add-btn" type="button">${t('הוסף פריט','Add item')}</button>`;
                wrap.parentNode && wrap.parentNode.insertBefore(bar, wrap);
                bar.querySelector('#dash-add-row-btn').addEventListener('click', ()=>{ try { window.inventoryActions && window.inventoryActions.addNewRow(); } catch{}; attachDashInventoryHandlers(); focusFirstNewCell(); });
              }
            }
          } catch{}
        }
        attachDashInventoryHandlers();
        return; // done
      }
      // Fallback: create minimal inventory panel structure if not available
      if(!existing){
          box.innerHTML = `<div class=\"dash-fallback-db\" style=\"display:flex; flex-direction:column; gap:12px\">\n          <div id=\"dash-db-area\" class=\"db-area\" aria-hidden=\"false\"><div id=\"db-table-wrap\"></div></div>\n        </div>`;
          try { if(window.ensureInventorySeeded) window.ensureInventorySeeded(); } catch{}
          try { if(window.renderInventoryTable) window.renderInventoryTable(); } catch{}
          // Add Item button (warehouse only)
          if(view==='warehouse'){
            try {
              const area = document.querySelector('#dash-db-area #db-table-wrap');
              if(area && !document.getElementById('dash-add-row-btn')){
                const bar = document.createElement('div');
                bar.className='add-row-bar';
                bar.innerHTML = `<button id=\"dash-add-row-btn\" class=\"big-add-btn\" type=\"button\">${t('הוסף פריט','Add item')}</button>`;
                area.parentNode && area.parentNode.insertBefore(bar, area);
                bar.querySelector('#dash-add-row-btn').addEventListener('click', ()=>{ try { window.inventoryActions && window.inventoryActions.addNewRow(); } catch{}; attachDashInventoryHandlers(); focusFirstNewCell(); });
              }
            } catch{}
          }
          attachDashInventoryHandlers();
        return;
      }
    }
    const content = (function(){
      switch(view){
        case 'home':
          // Home view only shows the welcome header + quick cards (dash-view left empty)
          return '';
        case 'welcome': return `<div class="dash-empty">${t('בחר פעולה כדי להתחיל','Choose an action to get started')}.</div>`;
        case 'newLinear':
        case 'importLinear':
        case 'listLinear':
        case 'newPanel':
        case 'importPanel':
        case 'listPanel':
          return buildStub(t('תכנון פרויקט חדש','New Project Planning'), t('אזור תכנון מאוחד במקום תכניות נפרדות.','Unified planning area replaces separate plan types.'));
        case 'newProject':
          return `<div class="dash-project" id="dash-project-wrap" style="max-width:1400px;margin:0 auto;display:flex;flex-direction:column;gap:28px">
            <div id="dash-project-create" class="proj-create" style="border:1px solid var(--border,#d0d7de);padding:22px 26px;border-radius:18px;background:var(--card-bg,#fff);display:flex;flex-direction:column;gap:18px">
              <h2 style="margin:0;font-size:24px;font-weight:600">${t('צור פרויקט חדש','Create New Project')}</h2>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;align-items:flex-start">
                <label style="display:flex;flex-direction:column;gap:6px;font-size:13px">${t('שם פרויקט','Project name')}<input id="dash-proj-name" type="text" class="btn select" placeholder="${t('הקלד שם','Enter name')}" /></label>
                <label style="display:flex;flex-direction:column;gap:6px;font-size:13px">${t('תיקייה','Folder')}<div style="display:flex;gap:6px;align-items:stretch"><select id="dash-proj-folder" class="btn select" style="flex:1"></select><button id="dash-new-folder-btn" type="button" class="btn" style="white-space:nowrap">${t('תיקייה חדשה','New')}</button></div></label>
                <label style="display:flex;flex-direction:column;gap:6px;font-size:13px">${t('תאריך','Date')}<input id="dash-proj-date" type="date" class="btn select" /></label>
                <div style="display:flex;flex-direction:column;gap:6px;font-size:13px"><span>${t('משתמשים משתפים','Shared users')}</span>
                  <div id="dash-share-box" style="border:1px solid var(--border,#d0d7de);padding:8px 10px;border-radius:10px;display:flex;flex-wrap:wrap;gap:6px;min-height:46px;background:#fff">
                    <input id="dash-share-input" type="email" placeholder="${t('הוסף אימייל ולחץ אנטר','Add email + Enter')}" style="border:none;outline:none;min-width:150px;font:inherit" />
                  </div>
                </div>
              </div>
              <div style="display:flex;justify-content:flex-end;margin-top:4px">
                <button id="dash-create-project" class="btn primary" type="button" style="font-size:15px;font-weight:600;padding:10px 26px">${t('צור פרויקט','Create Project')}</button>
              </div>
            </div>
            <div id="dash-project-work" style="display:none;flex-direction:column;gap:32px">
              <div class="proj-head-bar" style="display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:4px 4px 0">
                <h2 id="dash-proj-title" style="margin:0;font-size:26px;font-weight:600;flex:1"></h2>
                <span id="dash-proj-folder-pill" style="background:#eef3ee;border:1px solid var(--border,#ccd3cc);padding:6px 12px;border-radius:24px;font-size:12px;font-weight:500"></span>
                <span id="dash-proj-date-pill" style="background:#f5f5f5;border:1px solid var(--border,#d0d7de);padding:6px 12px;border-radius:24px;font-size:12px"></span>
              </div>
              <div id="dash-proj-calc" style="display:flex;flex-direction:column;gap:40px">
                <section id="dash-block-req" class="card" style="border:1px solid var(--border,#d0d7de);border-radius:18px;padding:28px;background:var(--card-bg,#fff)">
                  <div class="card-head" style="position:relative;display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;justify-content:center;margin-bottom:18px;padding-top:6px">
                    <div class="req-saw" style="position:absolute;top:4px;left:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                      <button id="saw-settings-btn" class="btn icon-btn" type="button" title="${t('הגדרות מסור','Saw settings')}" style="order:0">⚙️</button>
                      <label class="inline" style="display:flex;flex-direction:column;gap:4px;font-size:13px;order:1"><span>${t('עובי מסור','Saw kerf')}</span>
                        <input id="saw-thickness" type="text" value="3" style="width:90px" />
                        <span id="saw-unit" class="chip" style="align-self:flex-start">mm</span>
                        <input id="kerf" type="hidden" value="3" />
                      </label>
                    </div>
                    <h3 style="margin:0;font-size:22px;font-weight:600">${t('דרישות','Requirements')}</h3>
                  </div>
                  <div id="requirements-list"></div>
                  <div class="actions actions-center" style="display:flex;justify-content:center;gap:14px;margin-top:28px;flex-wrap:wrap">
                    <button id="add-req" class="btn" type="button">${t('הוסף דרישה','Add Requirement')}</button>
                    <button id="calc-opt" class="btn primary" type="button">${t('חשב אופטימיזציה','Compute Optimization')}</button>
                  </div>
                </section>
                <section id="dash-block-res" class="card" style="display:none;border:1px solid var(--border,#d0d7de);border-radius:18px;padding:28px;background:var(--card-bg,#fff)">
                  <h3 style="margin:0 0 18px;font-size:22px;font-weight:600;text-align:center">${t('תוצאות','Results')}</h3>
                  <div id="results-area"><div class="results-section"><div class="x-scroll"><p class="no-results" style="text-align:center;opacity:.7">${t('אין תוצאות עדיין. הזן דרישות ולחץ חישוב.','No results yet. Enter requirements and compute.')}</p></div></div></div>
                  <div class="actions actions-center" style="display:flex;justify-content:center;gap:16px;margin-top:30px;flex-wrap:wrap">
                    <button id="export-pdf" class="btn pink" type="button">${t('סכם PDF','Export PDF')}</button>
                    <button id="dash-save-project" class="btn primary" type="button">${t('שמור פרויקט','Save Project')}</button>
                  </div>
                </section>
              </div>
            </div>
          </div>`;
        case 'listProjects':
          return `<div id="dash-saved-projects" style="max-width:1100px;margin:0 auto;padding:8px 4px 40px">
            <h2 style="margin:0 0 20px;font-size:26px;font-weight:600">${t('פרויקטים שמורים','Saved Projects')}</h2>
            <div id="dash-saved-list" style="display:flex;flex-direction:column;gap:12px"></div>
            <p id="dash-empty-projects" style="margin:24px 0 0;opacity:.6;font-size:14px;display:none">${t('אין פרויקטים שמורים עדיין','No saved projects yet')}.</p>
          </div>`;
        case 'archive':
          setTimeout(()=>{ try { renderArchiveView(); } catch(e){ console.error(e);} },0);
          return `<div class="dash-empty">${t('טוען ארכיון...','Loading archive...')}</div>`;
  case 'systemGuide': return buildStub(t('הסבר מערכת','System Guide'), t('מדריך שימוש קצר וכללי עבודה.','Quick usage guide and workflow tips.'));
  case 'importInventory':
    return `<div class="import-box" style="width:95%;max-width:1600px;height:90vh;display:flex;flex-direction:column;margin:0 auto">
      <div class="imp-layout" style="display:flex;gap:32px;align-items:flex-start;flex:1;overflow:hidden;direction:ltr;padding:0 4px">
        <div class="imp-image-col" style="flex:1;min-width:400px;display:flex;align-items:flex-start;justify-content:flex-start;padding-top:2px">
          <img id="dash-import-img" src="pics/table.png" alt="Inventory template example" style="max-width:100%;width:100%;height:100%;max-height:calc(90vh - 60px);object-fit:contain;display:block" />
        </div>
        <div class="imp-main" style="flex:0 0 500px;display:flex;flex-direction:column;min-width:500px;max-width:520px">
          <h2 style="margin:0 0 12px;font-size:24px;font-weight:600;text-align:${isHe()? 'right':'left'}">${t('ייבוא מלאי','Inventory Import')}</h2>
          <div class="imp-actions" style="display:flex;gap:14px;flex-wrap:wrap;margin:0 0 18px;justify-content:flex-start${isHe()?';flex-direction:row-reverse':''}">
            <label class="btn primary file-btn imp-btn" style="margin:0;font-size:14px;font-weight:500"><input id="dash-file-input" type="file" accept=".csv,.xlsx,.xls" />${t('טען קובץ','Upload file')}</label>
            <button id="dash-download-template" class="btn primary imp-btn" type="button" style="font-size:14px;font-weight:500">${t('הורד טמפלייט','Download template')}</button>
          </div>
          <div class="imp-instructions" ${isHe()? 'dir="rtl"':''} style="padding:0 4px 6px;font-size:15px;line-height:1.55;overflow:auto;text-align:${isHe()? 'right':'left'}">
            <h3 style="margin:0 0 16px;font-size:18px;font-weight:600">${t('איך להכין את הקובץ','How to prepare your file')}</h3>
            <ol style="margin:0 0 20px;${isHe()? 'padding:0 18px 0 0;':'padding-inline-start:22px'};list-style:decimal;list-style-position:inside">
              <li style="margin:0 0 6px">${t('הורידו טמפלייט או צרו גיליון עם הכותרות: חומר | סוג | סיווג | עובי | רוחב | אורך | מחיר | ספק | מחיר למטר (מחושב אוטומטית).','Download template or create sheet with headers: Material | Type | Classification | Thickness | Width | Length | Price | Supplier | Price per meter (auto).')}</li>
              <li style="margin:0 0 6px">${t('כל שורה פריט אחד. מותר תאים ריקים.','One row = one item. Blank cells allowed.')}</li>
              <li style="margin:0 0 6px">${t('שמרו כ‑CSV / XLSX וטעינו.','Save as CSV/XLSX and upload.')}</li>
              <li style="margin:0 0 6px">${t('לאחר ההעלאה מעבר אוטומטי למחסן.','After upload auto‑redirect to warehouse.')}</li>
            </ol>
            <p style="margin:0 0 14px;font-weight:600">${t('יחידות: מ"מ / ס"מ / מ׳ / inch – זיהוי והמרה אוטומטית.','Units: mm / cm / m / inch – auto detection & conversion.')}</p>
            <p style="margin:0;color:#555;font-size:14px">${t('טיפ: העתק טווח מאקסל והדבק לשורה חדשה.','Tip: Copy range from Excel and paste into a new row.')}</p>
          </div>
        </div>
      </div>
    </div>`;
  case 'warehouse': return buildStub(t('מלאי חומרים','Material Warehouse'), t('ניהול מלאי: חומרים, ספקים, מחירים.','Inventory management placeholder.'));
        case 'settings': return buildStub(t('הגדרות','Settings'), t('בחירת יחידות מידה, שפה, מטבע וכו\'.','Units, language, currency preferences.'));
        case 'apiStatus': return buildStub(t('סטטוס API','API Status'), t('בדיקת זמינות וקרדיט API.','API uptime & credits.'));
        case 'subscription': return `<div class="subscription-wrap" style="max-width:1400px;margin:0 auto;padding:8px 12px 80px">
            <p id="sub-breadcrumb" style="margin:0 0 18px;font-size:18px;font-weight:500;opacity:.9">${t('חיוב ותשלומים / מנוי','Billing & payments / Subscription')}</p>
            <div id="current-plan-box" style="border:1px solid #2e7d32;border-radius:6px;padding:0;overflow:hidden;background:#fff;margin:0 0 34px">
              <div style="padding:12px 18px 14px 18px;border-bottom:1px solid #e0e0e0;font-size:14px;display:flex;align-items:center;gap:8px"><span style="font-size:18px">🗓</span><span>${t('התכנית הנוכחית שלך','Your current plan')}</span></div>
              <div style="padding:22px 24px 24px 24px">
                <h3 id="current-plan-name" style="margin:0 0 18px;font-size:24px">Free</h3>
                <div style="display:flex;flex-wrap:wrap;gap:0;border:1px solid #e5e5e5;border-radius:2px;overflow:hidden;font-size:13px;background:#fff">
                  <div style="flex:1 1 240px;min-width:220px;padding:10px 14px;border-inline-end:1px solid #e5e5e5"><div style="opacity:.65">${t('תקופה נוכחית','Current period')}</div><div id="current-plan-period" style="margin-top:6px;font-weight:600">Aug 18, 2025 - ${t('ללתמיד','forever')}</div></div>
                  <div style="flex:0 0 200px;padding:10px 14px"><div style="opacity:.65">${t('מחיר','Price')}</div><div id="current-plan-price" style="margin-top:6px;font-weight:600">FREE</div></div>
                </div>
              </div>
            </div>
            <h2 id="choose-head" style="margin:0 0 10px;font-size:22px;font-weight:500;text-align:center;opacity:.6">${t('בחרו את התכנית המתאימה לכם','Choose the best plan for you')}</h2>
            <div class="billing-toggle-row" style="display:flex;align-items:center;justify-content:center;gap:14px;margin:4px 0 40px;font-size:14px">
              <span id="bill-label-month">${t('חיוב חודשי','Billed monthly')}</span>
              <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="billing-toggle" style="width:46px;height:24px;appearance:none;background:#d0d0d0;border-radius:20px;position:relative;outline:none;cursor:pointer;transition:background .25s" /><span id="bill-label-annual" style="color:#2e7d32;font-weight:600">${t('חיוב שנתי - חודשיים חינם','Billed annually - 2 months FREE')}</span></label>
            </div>
            <section class="card" style="background:transparent;box-shadow:none;border:none;padding:0">
              <div class="pricing-grid">
                <div class="price-card card basic">
                  <h3 id="title-basic">בסיסי</h3>
                  <div class="price" id="price-basic">€0/חודש</div>
                  <div class="plan-body">
                    <div class="feat-list">
                      <div class="feat feat-number"><div class="title" data-key="parts">מספר חלקים לפרויקט</div><div class="value">100</div></div>
                      <div class="feat feat-number"><div class="title" data-key="items">מספר פריטים במאגר</div><div class="value">10</div></div>
                      <div class="feat feat-number"><div class="title" data-key="suppliers">מספר ספקים במאגר</div><div class="value">5</div></div>
                      <div class="feat feat-bool"><span class="title" data-key="algo">אלגוריתם מיטבי לחישוב</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="pdf">יצוא קובץ pdf</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="mincost">עלות מינימלית</span><span class="icon no">✖</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="tags">תיוג חלקים בפלט</span><span class="icon no">✖</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="save">שמירת פרוייקטים</span><span class="icon no">✖</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="custom">הוספת שדות בהתאמה אישית (מיועד לאנשים שרוצים לשמור יותר מרק שם הפרויקט)</span><span class="icon no">✖</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="products">מס מוצרים אפשריים</span><span class="icon no">✖</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="materials">חומרים שונים</span><span class="icon no">✖</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="roll">חומר מתגלגל</span><span class="icon no">✖</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="plans">תוכניות בנייה</span><span class="icon no">✖</span></div>
                      <div class="feat"><div class="value" data-key="no-discount" style="font-weight:400">לא כולל הנחה</div></div>
                    </div>
                  </div>
                </div>
                <div class="price-card card">
                  <h3 id="title-hobby">נגר חובב</h3>
                  <div class="price" id="price-hobby">€6/חודש</div>
                  <div class="plan-body">
                    <div class="feat-list">
                      <div class="feat feat-number"><div class="title" data-key="parts">מספר חלקים לפרויקט</div><div class="value">1000</div></div>
                      <div class="feat feat-number"><div class="title" data-key="items">מספר פריטים במאגר</div><div class="value">50</div></div>
                      <div class="feat feat-number"><div class="title" data-key="suppliers">מספר ספקים במאגר</div><div class="value">10</div></div>
                      <div class="feat feat-bool"><span class="title" data-key="algo">אלגוריתם מיטבי לחישוב</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="pdf">יצוא קובץ pdf</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="mincost">עלות מינימלית</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="tags">תיוג חלקים בפלט</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="save">שמירת פרוייקטים</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="custom">הוספת שדות בהתאמה אישית (מיועד לאנשים שרוצים לשמור יותר מרק שם הפרויקט)</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="products">מס מוצרים אפשריים</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="materials">חומרים שונים</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="roll">חומר מתגלגל</span><span class="icon no">✖</span></div>
                      <div class="feat"><div class="title" data-key="plans">תוכניות בנייה</div><div class="value" data-key="plans-disc">50% הנחה</div></div>
                    </div>
                  </div>
                </div>
                <div class="price-card card">
                  <h3 id="title-pro">נגר מקצועי</h3>
                  <div class="price" id="price-pro">€15/חודש</div>
                  <div class="plan-body">
                    <div class="feat-list">
                      <div class="feat feat-number"><div class="title" data-key="parts">מספר חלקים לפרויקט</div><div class="value">ללא הגבלה</div></div>
                      <div class="feat feat-number"><div class="title" data-key="items">מספר פריטים במאגר</div><div class="value">ללא הגבלה</div></div>
                      <div class="feat feat-number"><div class="title" data-key="suppliers">מספר ספקים במאגר</div><div class="value">לא הגבלה</div></div>
                      <div class="feat feat-bool"><span class="title" data-key="algo">אלגוריתם מיטבי לחישוב</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="pdf">יצוא קובץ pdf</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="mincost">עלות מינימלית</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="tags">תיוג חלקים בפלט</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="save">שמירת פרוייקטים</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="custom">הוספת שדות בהתאמה אישית (מיועד לאנשים שרוצים לשמור יותר מרק שם הפרויקט)</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="products">מס מוצרים אפשריים</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="materials">חומרים שונים</span><span class="icon yes">✔</span></div>
                      <div class="feat feat-bool"><span class="title" data-key="roll">חומר מתגלגל</span><span class="icon yes">✔</span></div>
                      <div class="feat"><div class="title" data-key="plans">תוכניות בנייה</div><div class="value" data-key="plans-incl">כלול - ללא עלות נוספת</div></div>
                    </div>
                  </div>
                </div>
                <div class="price-card card">
                  <h3 id="title-biz">בעלי עסקים</h3>
                  <div class="price" id="price-biz">€90/חודש</div>
                  <div class="plan-body">
                    <div class="feat-list">
                      <ul>
                        <li data-key="biz_all">כל התכונות של נגר מקצועי</li>
                        <li data-key="biz_integration">ממשוק המערכת להזמנות - בניית פלטפורמה ייחודית ללקוח דרך האתר שלכם</li>
                        <li data-key="biz_custom">התאמה והטמעה מותאמת אישית לבעל העסק</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <div style="margin:42px auto 0;text-align:center;opacity:.55;font-size:12px">${t('המחירים מיועדים להדגמה בלבד','Prices for demonstration only')}</div>
          </div>`;
        case 'invoices': return buildStub(t('חשבוניות','Invoices'), t('הצגת חשבוניות ושמירה כ-PDF.','Invoices list & PDF export.'));
        case 'newRequest':
          return `<div class="tickets-wrap" id="tickets-wrap">
            <div class="tickets-head">
              <h2>${t('דיווח באגים ופיצ\'רים','Bugs & Feature Requests')} <span style="opacity:.6;font-weight:400">/ ${t('הכל','All')}</span></h2>
              <div class="ticket-btns">
                <button class="btn" data-ticket-type="bug">🐞 ${t('דווח באג','Report Bug')}</button>
                <button class="btn secondary" data-ticket-type="feature">⭐ ${t('בקשת פיצ\'ר','Feature Request')}</button>
              </div>
            </div>
            <div class="tickets-table">
              <table aria-describedby="tickets-caption">
                <caption id="tickets-caption" style="display:none">${t('רשימת הבקשות','Requests list')}</caption>
                <thead><tr><th>${t('סטטוס','Status')}</th><th>${t('נושא','Subject')}</th><th>${t('תיאור','Description')}</th><th>${t('תאריך יצירה','Create Date')}</th></tr></thead>
                <tbody id="tickets-body"></tbody>
              </table>
              <div id="tickets-empty" style="padding:18px;font-size:13px;opacity:.65;display:none">${t('אין רשומות עדיין','No entries yet')}</div>
            </div>
          </div>`;
        case 'allTickets': return buildStub(t('כל הבקשות','All Tickets'), t('רשימת פניות קודמות.','History of submitted tickets.'));
        case 'profileSettings':
          return `<div class="profile-panel" style="max-width:1100px">
            <h2>${t('פרופיל משתמש / הגדרות','User profile / Profile settings')}</h2>
            <form id="profile-form" class="profile-form" style="display:flex;flex-direction:column;gap:22px">
              <div class="avatar-upload">
                <div class="avatar-preview" id="pf-avatar-preview"><span style="font-size:26px;opacity:.5">👤</span></div>
                <div style="display:flex;flex-direction:column;gap:6px">
                  <label style="font-size:12px;font-weight:600">${t('תמונת פרופיל','Profile image')}</label>
                  <input type="file" id="pf-avatar" accept="image/*" style="display:none" />
                  <button type="button" class="btn-upload" id="pf-avatar-btn">${t('העלה תמונה','Upload image')}</button>
                  <small style="font-size:11px;opacity:.65">${t('פורמט נתמך: JPG/PNG עד ~2MB','Supported: JPG/PNG up to ~2MB')}</small>
                </div>
              </div>
              <div class="pf-row"><label>${t('אימייל','Email')}</label><input type="email" id="pf-email" disabled /></div>
              <div class="pf-grid">
                <div><label>${t('שם פרטי','First Name')}</label><input type="text" id="pf-first" /></div>
                <div><label>${t('שם משפחה','Last Name')}</label><input type="text" id="pf-last" /></div>
                <div><label>${t('שם חברה','Company name')}</label><input type="text" id="pf-company" /></div>
                <div><label>${t('ח.פ / ע.מ','VAT ID')}</label><input type="text" id="pf-vat" /></div>
                <div class="full"><label>${t('רחוב','Street')}</label><input type="text" id="pf-street" /></div>
                <div><label>${t('עיר','City')}</label><input type="text" id="pf-city" /></div>
                <div><label>${t('מיקוד','Zip')}</label><input type="text" id="pf-zip" /></div>
                <div class="full"><label>${t('מדינה','Country')}</label><input type="text" id="pf-country" /></div>
              </div>
              <div style="display:flex;gap:12px">
                <button type="button" id="pf-edit" class="btn">${t('ערוך','Edit')}</button>
                <button type="submit" id="pf-save" class="btn" style="display:none">${t('שמור','Save')}</button>
                <button type="button" id="pf-cancel" class="btn" style="display:none">${t('בטל','Cancel')}</button>
              </div>
            </form>
          </div>`;
        case 'changePassword':
          return `<div class="password-panel" style="max-width:640px">
            <h2>${t('פרופיל משתמש / שינוי סיסמה','User profile / Change Password')}</h2>
            <form id="pw-form" class="pw-form" style="display:flex;flex-direction:column;gap:20px">
              <div><label>${t('סיסמה נוכחית','Current password')}</label><input type="password" id="pw-current" required /></div>
              <div><label>${t('סיסמה חדשה','New Password')}</label><input type="password" id="pw-new" minlength="5" required /><small style="display:block;opacity:.65;font-size:11px;margin-top:4px">${t('לפחות 5 תווים כולל ספרה','At least 5 chars incl. a number')}</small></div>
              <div><label>${t('חזור סיסמה חדשה','Repeat New Password')}</label><input type="password" id="pw-new2" required /></div>
              <div style="display:flex;gap:12px"><button class="btn" type="submit">${t('שמור','Save')}</button></div>
            </form>
          </div>`;
        default: return `<div class="dash-empty">${t('תצוגה לא נמצאה','View not found')}</div>`;
      }
    })();
    box.innerHTML = content;
    // After content injection: wire specialized views
    // Show welcome header & quick cards ONLY on 'home' view; all other views full-screen
    try {
      const headEl = document.querySelector('.dash-main-head');
      const cardsEl = document.getElementById('dash-cards');
      const main = document.getElementById('dash-main');
      if(view==='home'){
        headEl && (headEl.style.display='');
        cardsEl && (cardsEl.style.display='');
        main && main.classList.remove('sub-full');
        // Remove active nav highlight when on home screen
        const nav = document.getElementById('dash-nav');
        if(nav){ nav.querySelectorAll('a.item').forEach(i=> i.classList.remove('active')); }
      } else {
        headEl && (headEl.style.display='none');
        cardsEl && (cardsEl.style.display='none');
        main && main.classList.add('sub-full');
      }
    } catch(e){ console.warn('toggle header visibility failed', e); }
    if(view==='newProject'){
      try { setupNewProjectView(); } catch(err){ console.error('newProject setup failed', err); }
      try { ensureSawSettingsButton(); } catch{}
      try { if(typeof bindProjectCalcButtons==='function') bindProjectCalcButtons(); } catch{}
    }
    if(view==='subscription'){
      try { initSubscriptionView(); } catch(e){ console.error('subscription init failed', e); }
    }
    if(view==='newRequest'){
      try { initTicketsView(); } catch(e){ console.error('tickets init failed', e); }
    }
    if(view==='listProjects'){
      try { renderSavedProjectsList(); } catch(err){ console.error('listProjects render err', err); }
    }
    if(view==='warehouse'){
      try { if(window.ensureInventorySeeded) window.ensureInventorySeeded(); } catch{}
      // Inject an Add Item button (only in warehouse) above the table wrapper if not present
      try {
        const area = document.querySelector('#dash-db-area #db-table-wrap') || document.querySelector('#db-table-wrap');
        if(area && !document.getElementById('dash-add-row-btn')){
          const bar = document.createElement('div');
          bar.className='add-row-bar';
          bar.innerHTML = `<button id="dash-add-row-btn" class="big-add-btn" type="button">${t('הוסף פריט','Add item')}</button>`;
          area.parentNode && area.parentNode.insertBefore(bar, area);
          bar.querySelector('#dash-add-row-btn').addEventListener('click', ()=>{
            try { window.inventoryActions && window.inventoryActions.addNewRow(); } catch{}
            attachDashInventoryHandlers();
            focusFirstNewCell();
          });
        }
      } catch{}
      try { if(window.renderInventoryTable) window.renderInventoryTable(); } catch{}
      attachDashInventoryHandlers();
      try { localStorage.setItem('dashWarehouseOpen','1'); } catch{}
    }
    if(view==='importInventory'){
        // Updated layout already provides #dash-import-img outside .imp-instructions; avoid fallback overwrite
        try {
          const hasTemplateBtn = document.getElementById('dash-download-template');
          const hasImg = document.getElementById('dash-import-img');
          // If either truly missing (unlikely) we could inject a minimal notice instead of old layout
          if(!hasTemplateBtn || !hasImg){
            console.warn('[importInventory] Expected elements missing; skipping legacy rebuild to preserve new layout.');
          }
        } catch{}
      const fileInp = document.getElementById('dash-file-input');
      // Fallback image handler (if provided image not found)
      try {
        const img = document.getElementById('dash-import-img');
        if(img){
          img.addEventListener('error', ()=>{ if(!/saw\.png/.test(img.src)) img.src='pics/saw.png'; });
        }
      } catch{}
      if(fileInp){
        fileInp.addEventListener('change', e=>{ try { if(window.handleFile) window.handleFile(e, data=>{ if(window.setInventoryFromArray2D) window.setInventoryFromArray2D(data); if(window.renderInventoryTable) window.renderInventoryTable(); localStorage.setItem('dashWarehouseOpen','1');
          // highlight warehouse tab and show it
          const nav = document.getElementById('dash-nav'); if(nav){ nav.querySelectorAll('a.item').forEach(i=>i.classList.remove('active')); const wh = nav.querySelector('a[data-view="warehouse"]'); if(wh){ wh.classList.add('active'); } }
          renderView('warehouse');
        }); } catch{} });
      }
      const dl = document.getElementById('dash-download-template');
      if(dl){ dl.addEventListener('click', ()=>{
        const headers = ['חומר','סוג','סיווג','עובי','רוחב','אורך','מחיר','ספק'];
        const csv = headers.join(',') + '\n';
        const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'import-template.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 200);
      }); }
    }
    if(view==='profileSettings'){
      try {
        const form = document.getElementById('profile-form');
        if(form){
          // Avatar load
          try {
            const prev = document.getElementById('pf-avatar-preview');
            const storedAvatar = localStorage.getItem('userAvatarData');
            if(storedAvatar && prev){
              prev.innerHTML = `<img src="${storedAvatar}" alt="avatar"/>`;
            }
            const btnUp = document.getElementById('pf-avatar-btn');
            const inpUp = document.getElementById('pf-avatar');
            if(btnUp && inpUp){
              btnUp.addEventListener('click', ()=> inpUp.click());
              inpUp.addEventListener('change', e=>{
                const file = e.target.files && e.target.files[0];
                if(!file) return;
                if(file.size > 2*1024*1024){ alert(t('קובץ גדול מדי (מעל 2MB)','File too large (>2MB)')); return; }
                const reader = new FileReader();
                reader.onload = ev => {
                  const data = ev.target.result;
                  try { localStorage.setItem('userAvatarData', data); } catch{}
                  if(prev) prev.innerHTML = `<img src="${data}" alt="avatar"/>`;
                  // Update header avatar immediately
                  try {
                    const headAvatar = document.querySelector('.user-menu .avatar');
                    if(headAvatar){
                      headAvatar.classList.add('has-img');
                      headAvatar.innerHTML = `<img src="${data}" alt="avatar"/>`;
                    }
                  } catch{}
                };
                reader.readAsDataURL(file);
              });
            }
          } catch{}
          const emailEl = document.getElementById('pf-email');
          const stored = JSON.parse(localStorage.getItem('authUser')||'null') || {};
          if(emailEl) emailEl.value = stored.email || '';
          const fields = ['pf-first','pf-last','pf-company','pf-vat','pf-street','pf-city','pf-zip','pf-country'];
          const editBtn = document.getElementById('pf-edit');
          const saveBtn = document.getElementById('pf-save');
          const cancelBtn = document.getElementById('pf-cancel');
          const toggle = (editing)=>{
            fields.forEach(id=>{ const el=document.getElementById(id); if(el){ el.disabled=!editing; if(editing) el.style.background='#fff'; else el.style.background=''; }});
            editBtn.style.display = editing?'none':'';
            saveBtn.style.display = editing?'':'none';
            cancelBtn.style.display = editing?'':'none';
          };
          toggle(false);
          editBtn.addEventListener('click', ()=>{ toggle(true); });
          cancelBtn.addEventListener('click', ()=>{ toggle(false); });
          form.addEventListener('submit', e=>{ e.preventDefault();
            const profile = { email: emailEl.value };
            fields.forEach(id=>{ const el=document.getElementById(id); profile[id.replace('pf-','')] = el?el.value:''; });
            try { localStorage.setItem('userProfile', JSON.stringify(profile)); } catch{}
            toggle(false);
          });
        }
      } catch{}
    }
    if(view==='changePassword'){
      try {
        const form = document.getElementById('pw-form');
        if(form){
          form.addEventListener('submit', e=>{ e.preventDefault();
            const cur = document.getElementById('pw-current').value.trim();
            const pw1 = document.getElementById('pw-new').value.trim();
            const pw2 = document.getElementById('pw-new2').value.trim();
            if(pw1!==pw2){ alert(t('הסיסמאות אינן תואמות','Passwords do not match')); return; }
            if(!/[0-9]/.test(pw1) || pw1.length<5){ alert(t('סיסמה חייבת לפחות 5 תווים ומספר','Password must be 5 chars min and include a number')); return; }
            try { const creds = JSON.parse(localStorage.getItem('authUser')||'null')||{}; creds._pwHash = btoa(pw1); localStorage.setItem('authUser', JSON.stringify(creds)); } catch{}
            alert(t('סיסמה עודכנה','Password updated'));
            form.reset();
          });
        }
      } catch{}
    }
  }
  // Expose for external triggers (e.g., logo click returning home)
  try { window.renderView = renderView; } catch{}

  // React to hash changes for profile/password navigation
  window.addEventListener('hashchange', ()=>{
    const h = (location.hash||'').replace('#','');
    if(h==='profile') return renderView('profileSettings');
    if(h==='change-password') return renderView('changePassword');
  });

  function attachDashInventoryHandlers(){
    const wrap = document.getElementById('dash-db-area') || document.getElementById('db-area');
    if(!wrap) return;
    const tableWrap = (wrap.querySelector('#db-table-wrap'));
    if(!tableWrap) return;
    if(tableWrap.__dashBound) return; // avoid duplicate
    tableWrap.__dashBound = true;
    tableWrap.addEventListener('click', e=>{
      const btn = e.target.closest('button'); if(!btn) return;
      try {
        const act = window.inventoryActions;
        if(!act) return;
        if(btn.classList.contains('btn-del')) act.deleteRow(Number(btn.dataset.row));
        else if(btn.classList.contains('btn-edit')) act.editRow(Number(btn.dataset.row));
        else if(btn.classList.contains('btn-cancel')) act.cancelEdit(Number(btn.dataset.row));
        else if(btn.classList.contains('btn-save')) act.saveRow(Number(btn.dataset.row), btn.closest('tr'));
        else if(btn.classList.contains('btn-save-new')) act.saveNewRow(btn.closest('tr'));
        else if(btn.classList.contains('btn-cancel-new')) act.cancelNew();
      } catch{}
    });
  }

  function focusFirstNewCell(){
    try {
      const newRow = document.querySelector('#dash-db-area tr.new-row');
      if(!newRow) return;
      const firstEditable = newRow.querySelector('td[contenteditable="true"], select');
      if(firstEditable) firstEditable.focus();
    } catch{}
  }

  function simplifyInventoryUI(root){
    try {
      // Hide toggle or extra buttons inside clone, keep only add-row and file if desired
      const toggle = root.querySelector('#toggle-db'); if(toggle) toggle.style.display='none';
  const addBtn = root.querySelector('#add-db-row'); if(addBtn){ addBtn.textContent = t('הוסף פריט','Add item'); addBtn.onclick = ()=>{ try { window.inventoryActions && window.inventoryActions.addNewRow(); } catch{}; attachDashInventoryHandlers(); focusFirstNewCell(); }; }
    const fileLabel = root.querySelector('label.file-btn'); if(fileLabel) fileLabel.style.display='none';
  // Ensure table stays open if previously opened
  try { if(localStorage.getItem('dashWarehouseOpen')==='1'){ const area=root; area.classList.remove('hidden'); area.setAttribute('aria-hidden','false'); } } catch{}
    } catch{}
  }

  function hideGlobalSelectors(){
    try {
      const header = document.querySelector('header.topbar'); if(!header) return;
      ['#select-currency','#select-units','#btn-currency','#btn-units'].forEach(selId=>{ const el = header.querySelector(selId); if(el) el.style.display='none'; });
    } catch{}
  }

  function buildSettingsPanel(){
    const currentCur = (localStorage.getItem('currencySymbol')||'€').replace(/"/g,'');
    const unitSys = (localStorage.getItem('unitSystem')||'metric').replace(/"/g,'');
    const theme = (localStorage.getItem('dashTheme')||'light');
    return `<div class="settings-panel" style="max-width:560px;padding:12px 4px 32px">
      <h2 style="margin:0 0 18px;font-size:22px">${t('הגדרות','Settings')}</h2>
      <div class="set-group" style="margin-bottom:20px">
        <label style="display:block;font-weight:600;margin-bottom:6px">${t('מטבע','Currency')}</label>
        <div class="btn-group" data-role="currency">
          ${['€','$','₪'].map(sym=>`<button class="mini-btn cur-opt ${currentCur===sym?'on':''}" data-cur="${sym}">${sym}</button>`).join('')}
        </div>
      </div>
      <div class="set-group" style="margin-bottom:20px">
        <label style="display:block;font-weight:600;margin-bottom:6px">${t('יחידות מידה','Units')}</label>
        <div class="btn-group" data-role="units">
          <button class="mini-btn unit-opt ${unitSys==='metric'?'on':''}" data-unit="metric">${t('מטרי','Metric')}</button>
          <button class="mini-btn unit-opt ${unitSys==='imperial'?'on':''}" data-unit="imperial">${t('אינץ׳','Inches')}</button>
        </div>
      </div>
      <div class="set-group" style="margin-bottom:24px">
        <label style="display:block;font-weight:600;margin-bottom:6px">${t('ערכת צבע','Theme')}</label>
        <div class="btn-group" data-role="theme">
          <button class="mini-btn theme-opt ${theme==='light'?'on':''}" data-theme="light">${t('בהיר','Light')}</button>
          <button class="mini-btn theme-opt ${theme==='dark'?'on':''}" data-theme="dark">${t('כהה','Dark')}</button>
        </div>
      </div>
      <p style="font-size:12px;color:#666;margin:0">${t('השינויים נשמרים אוטומטית','Changes are saved automatically')}.</p>
    </div>`;
  }

  // ===== Project Management (Dashboard) =====
  function loadJson(key){ try { return JSON.parse(localStorage.getItem(key)||'null'); } catch { return null; } }
  function saveJson(key,val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch{} }
  // Added ensureSawSettingsButton helper
  function ensureSawSettingsButton(){
    try {
      const wrap = document.querySelector('#dash-block-req .req-saw');
      if(!wrap) return;
      let btn = document.getElementById('saw-settings-btn');
      if(!btn){
        btn = document.createElement('button');
        btn.id='saw-settings-btn'; btn.type='button'; btn.className='btn icon-btn saw-settings'; btn.textContent='⚙️'; btn.title=t('הגדרות מסור','Saw settings');
        wrap.appendChild(btn);
      }
      btn.style.display='inline-flex';
      if(!btn.dataset.wired){
        btn.dataset.wired='1';
        btn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const existing = document.getElementById('saw-settings-row');
            if(existing){ existing.remove(); return; }
            const rowDiv = document.createElement('div');
            rowDiv.id='saw-settings-row';
            rowDiv.style.cssText='display:flex;flex-wrap:wrap;gap:14px;margin:14px 0 4px;padding:12px 14px;border:1px solid var(--border,#d0d7de);border-radius:14px;background:#fafbfc;position:relative';
            rowDiv.innerHTML = `
              <label style="display:flex;flex-direction:column;gap:4px;font-size:12px">${t('עובי מסור (מ״מ)','Kerf (mm)')}<input id="kerf-input-mini" type="number" min="0" step="0.1" style="width:90px" /></label>
              <label style="display:flex;flex-direction:column;gap:4px;font-size:12px">${t('שולי קצוות (מ"מ)','Edge trim (mm)')}<input id="edge-top" type="number" min="0" step="0.1" placeholder="0" style="width:80px" /></label>
              <div style="flex:1"></div>
              <button type="button" id="saw-close-mini" class="btn" style="align-self:flex-end">${t('סגור','Close')}</button>`;
            btn.after(rowDiv);
            document.getElementById('saw-close-mini')?.addEventListener('click', ()=> rowDiv.remove());
            document.addEventListener('click', function docClose(ev){ if(!rowDiv.contains(ev.target) && ev.target!==btn){ rowDiv.remove(); document.removeEventListener('click', docClose); } });
        });
      }
    } catch{}
  }

  function setupNewProjectView(){
    // Populate folders select
    const folderSel = document.getElementById('dash-proj-folder');
    const folders = loadJson('projFolders') || [];
    if(folderSel){ folderSel.innerHTML = `<option value="">${t('ללא תיקייה','No folder')}</option>` + folders.map(f=>`<option value="${f}">${f}</option>`).join(''); }
    const newFolderBtn = document.getElementById('dash-new-folder-btn');
    if(newFolderBtn){ newFolderBtn.addEventListener('click', ()=>{
      const name = prompt(t('שם תיקייה חדשה?','New folder name?')); if(!name) return; if(!folders.includes(name)){ folders.push(name); saveJson('projFolders', folders); setupNewProjectView(); }
    }); }
    // Share emails chips
    const shareInput = document.getElementById('dash-share-input');
    const shareBox = document.getElementById('dash-share-box');
    const emails = [];
    function renderEmails(){ if(!shareBox) return; shareBox.querySelectorAll('.chip-email').forEach(c=>c.remove()); emails.forEach(em=>{ const chip=document.createElement('span'); chip.className='chip-email'; chip.textContent=em; chip.style.cssText='background:#e0e7e0;padding:4px 8px;border-radius:14px;font-size:12px;display:inline-flex;align-items:center;gap:4px'; const x=document.createElement('button'); x.type='button'; x.textContent='×'; x.style.cssText='border:none;background:transparent;cursor:pointer;font-size:14px;line-height:1'; x.addEventListener('click',()=>{ const i=emails.indexOf(em); if(i>=0){ emails.splice(i,1); renderEmails(); } }); chip.appendChild(x); shareBox.insertBefore(chip, shareInput); }); }
    if(shareInput){ shareInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); const v=shareInput.value.trim(); if(v && /@/.test(v) && !emails.includes(v)){ emails.push(v); shareInput.value=''; renderEmails(); } } }); }
    // Create project
    const createBtn = document.getElementById('dash-create-project');
  if(createBtn){ createBtn.addEventListener('click', ()=>{
      const name = (document.getElementById('dash-proj-name')?.value||'').trim(); if(!name){ alert(t('יש להזין שם פרויקט','Project name required')); return; }
      const folder = folderSel?.value || ''; const date = document.getElementById('dash-proj-date')?.value || '';
      const work = document.getElementById('dash-project-work'); const form = document.getElementById('dash-project-create');
      if(work && form){ work.style.display='flex'; form.style.opacity='.5'; form.style.pointerEvents='none'; }
      const titleEl = document.getElementById('dash-proj-title'); if(titleEl) titleEl.textContent = name;
      const fPill = document.getElementById('dash-proj-folder-pill'); if(fPill){ fPill.textContent = folder?folder:t('ללא תיקייה','No folder'); }
      const dPill = document.getElementById('dash-proj-date-pill'); if(dPill){ dPill.textContent = date || ''; dPill.style.display = date?'' :'none'; }
      try { if(typeof updateReqEmptyState==='function') updateReqEmptyState(); } catch{}
      ensureSawSettingsButton();
      saveJson('currentDashProject', { name, folder, date, emails });
      ensureSawSettingsButton();
    }); }
    // Save project handler later when results section created
    document.addEventListener('click', function onSave(e){
      const btn = e.target.closest && e.target.closest('#dash-save-project'); if(!btn) return;
      const ctx = loadJson('currentDashProject'); if(!ctx || !ctx.name){ alert(t('אין פרויקט פעיל','No active project')); return; }
      // Gather requirements & results summaries
      let reqs=[]; try { if(typeof gatherRequirements==='function') reqs = gatherRequirements(); } catch{}
      const saved = loadJson('savedProjects') || [];
      const existsIdx = saved.findIndex(p=>p && p.name===ctx.name);
      const projData = { ...ctx, reqs, updated: Date.now() };
      if(existsIdx>=0) saved[existsIdx]=projData; else saved.push(projData);
      saveJson('savedProjects', saved);
      alert(t('הפרויקט נשמר','Project saved'));
    });
  }

  function renderSavedProjectsList(){
    const listEl = document.getElementById('dash-saved-list'); const empty = document.getElementById('dash-empty-projects'); if(!listEl) return;
    const saved = loadJson('savedProjects') || [];
    const folders = loadJson('projFolders') || [];
    listEl.innerHTML='';
    const navBar = document.createElement('div'); navBar.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px';
    const makeFolderBtn=(folderVal)=>{ const wrapBtn=document.createElement('div'); wrapBtn.style.cssText='position:relative;display:inline-flex;align-items:center'; const b=document.createElement('button'); b.className='btn'; b.textContent=folderVal||t('ללא תיקייה','No folder'); b.dataset.folder=folderVal; wrapBtn.appendChild(b); if(folderVal){ const del=document.createElement('button'); del.type='button'; del.className='del-folder-btn'; del.textContent='×'; del.title=t('מחק תיקייה','Delete folder'); del.style.cssText='position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:1px solid #d0d7de;background:#fff;color:#c00;font-weight:600;cursor:pointer;font-size:14px;line-height:1;padding:0'; del.dataset.folderDel=folderVal; wrapBtn.appendChild(del);} return wrapBtn; };
    const allWrap = makeFolderBtn(''); const allBtn = allWrap.querySelector('button'); allBtn.textContent=t('הכל','All'); allWrap.querySelector('.del-folder-btn')?.remove(); navBar.appendChild(allWrap); folders.forEach(f=> navBar.appendChild(makeFolderBtn(f)));
    listEl.appendChild(navBar);
    let activeFolder='';
  function renderRows(){ listEl.querySelectorAll('.proj-row').forEach(r=>r.remove()); const filtered = saved.filter(p=> (!activeFolder || p.folder===activeFolder) && !p._archived); if(!filtered.length){ if(empty){ empty.style.display='block'; empty.textContent = activeFolder? t('אין פרויקטים בתיקייה זו','No projects in this folder'): t('אין פרויקטים שמורים עדיין','No saved projects yet'); } return; } else if(empty) empty.style.display='none'; filtered.sort((a,b)=> (b.updated||0)-(a.updated||0)); filtered.forEach(p=>{ const row=document.createElement('div'); row.className='proj-row'; row.style.cssText='display:flex;gap:16px;align-items:center;border:1px solid var(--border,#d0d7de);padding:14px 16px;border-radius:14px;background:var(--card-bg,#fff);flex-wrap:wrap'; row.innerHTML=`<div style="flex:1;min-width:220px"><div style="font-weight:600;font-size:15px">${p.name}</div><div style="font-size:12px;opacity:.7">${p.folder||t('ללא תיקייה','No folder')}</div></div><div style="font-size:12px;opacity:.7">${p.date||''}</div><div style="font-size:12px;opacity:.7;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(p.emails||[]).join(', ')}</div><div style="display:flex;gap:8px"><button class="btn" data-act="open">${t('פתח','Open')}</button><button class="btn" data-act="edit">${t('ערוך','Edit')}</button><button class="btn" data-act="archive" style="background:#eef3ff;color:#003d99">${t('העבר לארכיון','Archive')}</button><button class="btn" data-act="delete" style="background:#ffe8e6;color:#b40000">${t('מחק','Delete')}</button></div>`; row.querySelector('button[data-act="open"]').addEventListener('click',()=>{ openSavedProject(p.name, true); }); row.querySelector('button[data-act="edit"]').addEventListener('click',()=>{ openSavedProject(p.name, true, true); }); row.querySelector('button[data-act="archive"]').addEventListener('click',()=>{ if(!confirm(t('להעביר לארכיון?','Move to archive?'))) return; p._archived=true; saveJson('savedProjects', saved); renderRows(); }); row.querySelector('button[data-act="delete"]').addEventListener('click',()=>{ if(!confirm(t('למחוק פרויקט?','Delete project?'))) return; const idx=saved.findIndex(sp=>sp.name===p.name); if(idx>=0){ saved.splice(idx,1); saveJson('savedProjects', saved); renderRows(); }}); listEl.appendChild(row); }); }
    navBar.addEventListener('click', e=>{ const del=e.target.closest('.del-folder-btn'); if(del){ const folderName=del.dataset.folderDel; if(folderName && confirm(t('למחוק תיקייה וכל הפרויקטים שבה?','Delete folder and all its projects?'))){ for(let i=saved.length-1;i>=0;i--){ if(saved[i].folder===folderName) saved.splice(i,1); } saveJson('savedProjects', saved); const fList=(loadJson('projFolders')||[]).filter(f=>f!==folderName); saveJson('projFolders', fList); if(activeFolder===folderName) activeFolder=''; renderSavedProjectsList(); } return; } const b=e.target.closest('button'); if(!b || b.classList.contains('del-folder-btn')) return; activeFolder=b.dataset.folder||''; navBar.querySelectorAll('button').forEach(btn=>btn.classList.toggle('primary', btn===b)); renderRows(); });
    renderRows(); allBtn.classList.add('primary');
  }

  function openSavedProject(name, showResultsImmediately=false, editMode=false){
    // Switch to newProject view and load
    renderView('newProject');
    const saved = loadJson('savedProjects') || [];
    const proj = saved.find(p=>p && p.name===name); if(!proj) return;
    // Refill
    try {
      document.getElementById('dash-proj-name').value = proj.name;
      document.getElementById('dash-proj-folder').value = proj.folder||'';
      document.getElementById('dash-proj-date').value = proj.date||'';
      // Simulate click create to reveal work area
      document.getElementById('dash-create-project').click();
      // Add emails
      const shareInput = document.getElementById('dash-share-input');
      if(shareInput){ proj.emails && proj.emails.forEach(em=>{ shareInput.value = em; const ev = new KeyboardEvent('keydown',{key:'Enter'}); shareInput.dispatchEvent(ev); }); }
      // Add requirements rows based on proj.reqs
      if(Array.isArray(proj.reqs)){
        proj.reqs.forEach(r=>{
          if(typeof addRequirementRow==='function'){ addRequirementRow(); }
          const last = document.querySelector('#requirements-list .req-row:last-child');
          if(last){
            const setVal=(sel, val)=>{ if(!sel) return; if(sel.tagName.toLowerCase()==='select'){ sel.value=val; sel.dispatchEvent(new Event('change')); } else sel.value=val; };
            setVal(last.querySelector('select[data-field="material"]'), r.material||'');
            setVal(last.querySelector('select[data-field="type"]'), r.type||'');
            setVal(last.querySelector('select[data-field="thickness"]'), r.thickness||'');
            setVal(last.querySelector('select[data-field="width"]'), r.width||'');
            setVal(last.querySelector('input[data-field="length"]'), r.length||'');
            setVal(last.querySelector('input[data-field="qty"]'), r.qty||'');
            setVal(last.querySelector('input[data-field="tag"]'), r.tag||'');
          }
        });
      }
      // If showResultsImmediately: compute & render results directly
      // Always auto compute on load (open or edit)
      if(typeof computeOptimization==='function' && typeof renderResults==='function'){
        try {
          const res = computeOptimization();
          const dashRes = document.getElementById('dash-block-res'); if(dashRes) dashRes.style.display='block';
          renderResults(res);
        } catch(err){ console.error('auto compute failed', err); }
      }
      // Edit mode can focus first requirement or allow modifications; currently same UI, placeholder if future differences
      if(editMode){
        try { const firstInput = document.querySelector('#requirements-list .req-row select, #requirements-list .req-row input'); firstInput && firstInput.focus(); } catch{}
      }
    } catch(err){ console.error('openSavedProject error', err); }
  }

  // Archive view rendering
  function renderArchiveView(){
    const box = document.getElementById('dash-view'); if(!box) return;
    const saved = loadJson('savedProjects')||[];
    const archived = saved.filter(p=>p && p._archived);
    box.innerHTML = `<div style="max-width:1100px;margin:0 auto;padding:8px 4px 40px"><h2 style="margin:0 0 20px;font-size:26px;font-weight:600">${t('ארכיון','Archive')}</h2><div id="dash-archive-list" style="display:flex;flex-direction:column;gap:12px"></div><p id="dash-archive-empty" style="margin:24px 0 0;opacity:.6;font-size:14px;${archived.length?'display:none':'display:block'}">${t('אין פרויקטים בארכיון','No archived projects')}</p></div>`;
    const list = document.getElementById('dash-archive-list');
    archived.sort((a,b)=> (b.updated||0)-(a.updated||0));
    archived.forEach(p=>{
      const row=document.createElement('div');
      row.className='arch-row';
      row.style.cssText='display:flex;gap:16px;align-items:center;border:1px dashed var(--border,#d0d7de);padding:14px 16px;border-radius:14px;background:#f8f9fa;flex-wrap:wrap';
      row.innerHTML = `<div style=\"flex:1;min-width:220px\"><div style=\"font-weight:600;font-size:15px\">${p.name}</div><div style=\"font-size:12px;opacity:.7\">${p.folder||t('ללא תיקייה','No folder')}</div></div><div style=\"font-size:12px;opacity:.7\">${p.date||''}</div><div style=\"display:flex;gap:8px\"><button class=\"btn\" data-act=\"restore\">${t('שחזר','Restore')}</button><button class=\"btn\" data-act=\"open\">${t('פתח','Open')}</button><button class=\"btn\" data-act=\"delete\" style=\"background:#ffe8e6;color:#b40000\">${t('מחק','Delete')}</button></div>`;
      row.querySelector('[data-act="restore"]').addEventListener('click',()=>{ p._archived=false; saveJson('savedProjects', saved); renderArchiveView(); });
      row.querySelector('[data-act="open"]').addEventListener('click',()=>{ p._archived=false; saveJson('savedProjects', saved); openSavedProject(p.name, true); });
      row.querySelector('[data-act="delete"]').addEventListener('click',()=>{ if(!confirm(t('למחוק לצמיתות?','Delete permanently?'))) return; const idx=saved.findIndex(sp=>sp.name===p.name); if(idx>=0){ saved.splice(idx,1); saveJson('savedProjects', saved); renderArchiveView(); }});
      list.appendChild(row);
    });
  }

  function wireSettingsPanel(){
    const panel = document.querySelector('.settings-panel'); if(!panel) return;
    panel.addEventListener('click', e=>{
      const btn = e.target.closest('button.mini-btn'); if(!btn) return;
      const roleWrap = btn.closest('.btn-group'); if(!roleWrap) return;
      const role = roleWrap.getAttribute('data-role');
      roleWrap.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      if(role==='currency'){
        const sym = btn.getAttribute('data-cur');
        try { localStorage.setItem('currencySymbol', sym); localStorage.setItem('currency', sym==='€'?'EUR':sym==='$'?'USD':'ILS'); } catch{}
        try { if(window.renderInventoryTable) window.renderInventoryTable(); } catch{}
      } else if(role==='units'){
        const unit = btn.getAttribute('data-unit');
        try { localStorage.setItem('unitSystem', unit); } catch{}
        try { if(window.renderInventoryTable) window.renderInventoryTable(); } catch{}
      } else if(role==='theme'){
        const th = btn.getAttribute('data-theme');
        try { localStorage.setItem('dashTheme', th); document.documentElement.setAttribute('data-theme', th); } catch{}
      }
    });
  }

  function applyStoredTheme(){
    try { const th = (localStorage.getItem('dashTheme')||'light'); document.documentElement.setAttribute('data-theme', th); } catch{}
  }

  function buildStub(title, desc){
    return `<div class="stub"><h2 style="margin-top:0;font-size:20px">${title}</h2><p style="margin:0 0 18px;color:#555;font-size:14px">${desc}</p><div class="stub-box" style="padding:24px;border:1px dashed var(--border);border-radius:12px; background:#fafbfc; font-size:13px; color:#666">${t('תוכן עתידי','Future content')}...</div></div>`;
  }

  // Embedded pricing view identical (logic) to pricing.html for localization + currency
  function initSubscriptionView(){
    function readStr(key, fb){ const raw = localStorage.getItem(key); if(raw==null) return fb; try{ const p=JSON.parse(raw); return typeof p==='string'?p:raw; }catch{ return raw; } }
    function lang2(){ return (readStr('lang','he')||'he').replace(/^"|"$/g,'').toLowerCase(); }
    function symbol(){ const s=(readStr('currencySymbol','')||'').replace(/["'״]/g,''); if (s) return s; const c=(readStr('currency','EUR')||'EUR').toUpperCase(); return c==='USD'?'$':c==='ILS'?'₪':'€'; }
    const rates = { '€':1, '$':1.1, '₪':4.0 };
    const baseEuros = { basic:0, hobby:6, pro:15, biz:90 };
    const i18n = {
      he: { titles:{ basic:'בסיסי', hobby:'נגר חובב', pro:'נגר מקצועי', biz:'בעלי עסקים' }, labels:{ parts:'מספר חלקים לפרויקט', items:'מספר פריטים במאגר', suppliers:'מספר ספקים במאגר', algo:'אלגוריתם מיטבי לחישוב', pdf:'יצוא קובץ pdf', mincost:'עלות מינימלית', tags:'תיוג חלקים בפלט', save:'שמירת פרוייקטים', custom:'הוספת שדות בהתאמה אישית (מיועד לאנשים שרוצים לשמור יותר מרק שם הפרויקט)', products:'מס מוצרים אפשריים', materials:'חומרים שונים', roll:'חומר מתגלגל', plans:'תוכניות בנייה', 'no-discount':'לא כולל הנחה', 'plans-disc':'50% הנחה', 'plans-incl':'כלול - ללא עלות נוספת', buy:'רכישה', biz_all:'כל התכונות של נגר מקצועי', biz_integration:'ממשוק המערכת להזמנות - בניית פלטפורמה ייחודית ללקוח דרך האתר שלכם', biz_custom:'התאמה והטמעה מותאמת אישית לבעל העסק' }, perMonth:'/חודש' },
      en: { titles:{ basic:'Basic', hobby:'Hobby Woodworker', pro:'Professional', biz:'Business' }, labels:{ parts:'Parts per project', items:'Items in inventory', suppliers:'Suppliers in inventory', algo:'Optimal algorithm', pdf:'PDF export', mincost:'Minimum cost', tags:'Part labeling', save:'Project saving', custom:'Custom fields (for saving more than just the project name)', products:'Max possible products', materials:'Different materials', roll:'Roll material', plans:'Building plans', 'no-discount':'No discount included', 'plans-disc':'50% discount', 'plans-incl':'Included - no extra cost', buy:'Buy', biz_all:'All Professional features', biz_integration:'Order integration — a custom platform on your site', biz_custom:'Custom implementation for your business' }, perMonth:'/month' }
    };
    function updatePrices(){
      const annual = document.getElementById('billing-toggle')?.checked;
      const s=symbol(); const r=rates[s]||1; const suf=i18n[lang2()].perMonth;
      Object.entries(baseEuros).forEach(([k, eur])=>{
        const el=document.getElementById('price-'+k); if(!el) return;
        if(annual && eur>0){ const total = eur*10; const monthlyEq = Math.round((total/12)*r); el.textContent = s + (Math.round(total*r)) + ' /yr ('+ s + monthlyEq + suf +')'; }
        else { const val = eur*r; el.textContent = s + (eur===0? '0' : String(Math.round(val))) + suf; }
      });
    }
    function localize(){ const L=i18n[lang2()]||i18n.he; const byId=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; }; byId('title-basic',L.titles.basic); byId('title-hobby',L.titles.hobby); byId('title-pro',L.titles.pro); byId('title-biz',L.titles.biz); document.querySelectorAll('[data-key]').forEach(el=>{ const k=el.getAttribute('data-key'); const val=L.labels[k]||L.labels[k.replace(/-/g,'_')]||el.textContent; if(val) el.textContent=val; }); }
    localize(); updatePrices();
    document.getElementById('billing-toggle')?.addEventListener('change', updatePrices);
    // current plan box
    try {
      const curPlan = (localStorage.getItem('currentPlan')||'free').replace(/['"]/g,'');
      const nameMap = { basic:'Free', free:'Free', hobby:'Hobby', pro:'Pro', professional:'Pro', biz:'Business', business:'Business' };
      const planNameEl = document.getElementById('current-plan-name'); if(planNameEl){ planNameEl.textContent = nameMap[curPlan]||curPlan; }
      const priceEl = document.getElementById('current-plan-price'); if(priceEl){ const base = baseEuros[curPlan] ?? 0; priceEl.textContent = base===0? 'FREE' : symbol()+ base + i18n[lang2()].perMonth; }
    } catch{}
  }

  // Bind Add Requirement & Compute buttons in dashboard context
  function bindProjectCalcButtons(){
    const addBtn = document.getElementById('add-req');
    if(addBtn && !addBtn.dataset.dashBound){
      addBtn.dataset.dashBound='1';
      addBtn.addEventListener('click', e=>{
        e.preventDefault(); e.stopPropagation();
        try { if(typeof addRequirementRow==='function') addRequirementRow(); } catch(err){ console.error('addRequirementRow failed', err); }
      });
    }
    const calcBtn = document.getElementById('calc-opt');
    if(calcBtn && !calcBtn.dataset.dashBound){
      calcBtn.dataset.dashBound='1';
      calcBtn.addEventListener('click', e=>{
        e.preventDefault(); e.stopPropagation();
        try {
          if(typeof computeOptimization==='function' && typeof renderResults==='function'){
            const res = computeOptimization();
            const dashRes = document.getElementById('dash-block-res'); if(dashRes) dashRes.style.display='block';
            renderResults(res);
          }
        } catch(err){ console.error('compute failed', err); }
      });
    }
  }

  function addToggleBtn(){
    if(window.innerWidth>860) return;
    if(sel('.dash-toggle-btn')) return;
    const btn = document.createElement('button');
    btn.className='dash-toggle-btn';
    btn.innerHTML='☰';
    btn.addEventListener('click', ()=>{ const side=sel('.dash-sidebar'); side && side.classList.toggle('open'); });
    document.body.appendChild(btn);
  }
  window.addEventListener('resize', ()=>{ addToggleBtn(); });

  document.addEventListener('DOMContentLoaded', init);
  // Fallback: if not booted within 2s after load, force init
  window.addEventListener('load', ()=>{ if(!__dashBooted) setTimeout(()=>{ if(!__dashBooted) init(); }, 400); });
  setTimeout(()=>{ if(!__dashBooted) init(); }, 2500);
  // Safety: hide spinner after 5s regardless
  setTimeout(()=>{ try { showLoading(false); } catch{} }, 5000);

  if(!window.__origAddRequirementRowPerf && typeof addRequirementRow==='function'){
  window.__origAddRequirementRowPerf = addRequirementRow;
  window.addRequirementRow = function(){
    const t0 = performance.now();
    try { return window.__origAddRequirementRowPerf.apply(this, arguments); }
    finally {
      const dt = performance.now()-t0;
      if(dt>50) console.warn('[perf] addRequirementRow took', dt.toFixed(1),'ms');
    }
  };
  }

  /* ===== Tickets: storage + modal logic (inserted at end for clarity) ===== */
  function loadTickets(){ try { return JSON.parse(localStorage.getItem('dashTickets')||'[]'); } catch { return []; } }
  function saveTickets(list){ try { localStorage.setItem('dashTickets', JSON.stringify(list)); } catch{} }
  function initTicketsView(){
    const wrap=document.getElementById('tickets-wrap'); if(!wrap) return;
    const body=document.getElementById('tickets-body'); const empty=document.getElementById('tickets-empty');
    const render=()=>{ const arr=loadTickets(); if(!arr.length){ body.innerHTML=''; empty.style.display='block'; return;} empty.style.display='none'; body.innerHTML=arr.map(t=>`<tr><td><span class="badge-status ${t.status}">${t.status==='open'?(isHe()?'פתוח':'Open'):(isHe()?'סגור':'Closed')}</span></td><td>${escapeHtml(t.subject)}</td><td style="max-width:480px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(t.desc)}">${escapeHtml(t.desc)}</td><td>${t.date}</td></tr>`).join(''); };
    render();
    wrap.querySelector('.ticket-btns').addEventListener('click', e=>{ const btn=e.target.closest('button[data-ticket-type]'); if(!btn) return; openModal(btn.dataset.ticketType); });
    function openModal(type){
      const modal=document.createElement('div'); modal.className='ticket-form-modal';
      const title= type==='bug'? (isHe()? 'דווח באג':'Report a Bug') : (isHe()? 'בקשת פיצ\'ר':'Feature Request');
      modal.innerHTML = `<form class="ticket-form" id="ticket-form" role="dialog" aria-modal="true"><h3>${title}</h3><input type="hidden" name="type" value="${type}" /><div><label>${isHe()? 'נושא':'Subject'}</label><input name="subject" required maxlength="120" /></div><div><label>${isHe()? 'תיאור מפורט':'Detailed description'}</label><textarea name="desc" required maxlength="3000"></textarea></div><div><label>${isHe()? 'עדיפות':'Priority'}</label><select name="priority"><option value="normal">${isHe()? 'רגילה':'Normal'}</option><option value="high">${isHe()? 'גבוהה':'High'}</option></select></div><div class="actions"><button type="button" class="cancel">${isHe()? 'בטל':'Cancel'}</button><button type="submit">${isHe()? 'שלח':'Submit'}</button></div></form>`;
      document.body.appendChild(modal);
      const form=modal.querySelector('#ticket-form');
      form.querySelector('.cancel').addEventListener('click',()=>modal.remove());
      form.addEventListener('submit',ev=>{ ev.preventDefault(); const fd=new FormData(form); const obj={ id:Date.now().toString(36), type:fd.get('type'), subject:(fd.get('subject')+'').trim(), desc:(fd.get('desc')+'').trim(), priority:fd.get('priority'), status:'open', date:new Date().toLocaleDateString('en-GB'), emailSubject: buildEmailSubject(fd.get('type'), fd.get('subject')) }; if(!obj.subject||!obj.desc) return; const list=loadTickets(); list.unshift(obj); saveTickets(list); render(); try { console.log('[ticket email]', obj.emailSubject); } catch{} modal.remove(); });
      setTimeout(()=>{ const first=form.querySelector('input[name="subject"]'); first&&first.focus(); },25);
    }
  }
  function buildEmailSubject(type, subj){ return (type==='bug'? '[BUG] ':'[FEATURE] ')+subj; }
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
})();
