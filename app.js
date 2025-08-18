document.addEventListener('DOMContentLoaded', () => {
// הגדרות ראשוניות
let language = loadData('lang') || 'he';
if (typeof language !== 'string') language = 'he';
let currency = loadData('currency') || 'EUR';
if (typeof currency !== 'string') currency = 'EUR';
let unitSystem = loadData('unitSystem') || 'metric';
if (typeof unitSystem !== 'string') unitSystem = 'metric';
// מאגר עצים טעון מהקובץ
let inventoryRows = loadData('inventoryRows') || [];
let inventoryHeaders = loadData('inventoryHeaders') || [];
let inventoryUnits = loadData('inventoryUnits') || [];
let inventoryData = loadData('inventoryData') || [];
let showNewInventoryRow = false;
let editingRows = new Set();
let inventoryPriceCurrencyUnit = loadData('inventoryPriceCurrencyUnit') || '';
// העדפות תצוגה (שמורות בדפדפן)
let displaySettings = loadData('displaySettings') || { colorPieces: true, fontWeight: 'regular', showPieceLabels: true, panelOpen: false };
// ודא מפתחות ברירת מחדל
displaySettings = {
    colorPieces: displaySettings.colorPieces !== false,
    fontWeight: displaySettings.fontWeight === 'bold' ? 'bold' : 'regular',
    showPieceLabels: displaySettings.showPieceLabels !== false,
    panelOpen: !!displaySettings.panelOpen
};
// מזהה ייחודי לדיאגרמות SVG כדי למנוע התנגשויות id בין דיאגרמות שונות
let svgIdCounter = 0;
// Global helper: quick text width approximation used by SVG label fit checks
const approxTextWidthPlate = (txt, fs) => (String(txt||'').length * fs * 0.6);
// מילון תרגומים
const translations = {
    he: {
        title: 'אופטימיזציית חיתוך עץ',
        reqs: 'דרישות פרויקט',
        db: 'מאגר עצים',
        results: 'תוצאות',
        addReq: 'הוסף דרישה',
        calcOpt: 'חשב אופטימיזציה',
        showDb: 'הצג מאגר עצים',
    loadFile: 'טען קובץ (.xlsx, .xls, .csv)',
        addTree: 'הוסף עץ למאגר',
        exportPdf: 'סכם בקובץ PDF',
        noResults: 'אין תוצאות עדיין. לחץ "חשב אופטימיזציה" כדי להתחיל.',
        projectName: 'שם הפרויקט',
        sawThickness: 'עובי מסור',
        displaySettings: 'הגדרות תצוגה',
        displaySettingsTitle: 'שינוי הגדרות תצוגה:',
        cutColors: 'צבע חיתוכים',
        fontSize: 'גודל גופן',
        regular: 'רגיל',
        bold: 'בולט',
        extraInfo: 'מידע נוסף',
        save: 'שמור'
    },
    en: {
        title: 'Wood Cutting Optimization',
        reqs: 'Project Requirements',
        db: 'Wood Inventory',
        results: 'Results',
        addReq: 'Add Requirement',
        calcOpt: 'Compute Optimization',
        showDb: 'Show Inventory',
    loadFile: 'Load file (.xlsx, .xls, .csv)',
        addTree: 'Add wood to inventory',
        exportPdf: 'Export PDF',
        noResults: 'No results yet. Click "Compute Optimization" to start.',
        projectName: 'Project Name',
        sawThickness: 'Saw Kerf',
        displaySettings: 'Display Settings',
        displaySettingsTitle: 'Change display settings:',
        cutColors: 'Cut colors',
        fontSize: 'Font weight',
        regular: 'Regular',
        bold: 'Bold',
        extraInfo: 'Extra info',
    save: 'save',
    ok: 'OK'
    }
};

// עזר: מיקום גלילה אופקית לנקודת ההתחלה (ימין ב-RTL, שמאל ב-LTR) בצורה יציבה בין דפדפנים
function scrollToStart(el, dir){
    try{
        if (!el) return;
        if (dir === 'rtl'){
            el.scrollLeft = el.scrollWidth; // FF
            if (Math.abs(el.scrollLeft) < 2) el.scrollLeft = 1e9; // WebKit strange mode
            if (Math.abs(el.scrollLeft) < 2) el.scrollLeft = -1e9; // Chrome-like RTL mode
        } else {
            el.scrollLeft = 0;
        }
    }catch(_){}
}

// יצירת כותרות ויחידות ברירת מחדל למאגר (גם ללא קובץ טעון)
function ensureInventorySeeded() {
    if (Array.isArray(inventoryRows) && inventoryRows.length > 0) return;
    const he = (language === 'he');
    // כותרות ברירת מחדל
    const hdr = he ? ['סוג','סיווג','עובי','רוחב','אורך','מחיר','מחיר למטר','ספק']
                   : ['Type','Classification','Thickness','Width','Length','Price','Price per meter','Supplier'];
    // יחידות ברירת מחדל: עובי/רוחב ב־mm, אורך ב־m, מחירים — מטבע נוכחי
    const sym = document.getElementById('btn-currency')?.textContent?.trim() || normalizeCurrencySymbol(inventoryPriceCurrencyUnit) || '€';
    const units = he
        ? ['', '', 'מ״מ', 'מ״מ', 'מ׳', sym, sym, '']
        : ['', '', 'mm',  'mm',  'm',  sym, sym, ''];
    inventoryRows = [hdr, units];
    inventoryHeaders = hdr.slice();
    inventoryUnits = units.slice();
    inventoryData = [];
    inventoryPriceCurrencyUnit = sym;
    saveData('inventoryRows', inventoryRows);
    saveData('inventoryHeaders', inventoryHeaders);
    saveData('inventoryUnits', inventoryUnits);
    saveData('inventoryData', inventoryData);
    saveData('inventoryPriceCurrencyUnit', inventoryPriceCurrencyUnit);
    saveData('inventorySource', 'file');
    saveData('inventorySource', 'manual');
}

// פונקציות מעבר שפה
function switchLanguage(lang) {
    language = lang;
    saveData('lang', language);
    // Update text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang] && translations[lang][key]) {
            el.setAttribute('placeholder', translations[lang][key]);
        }
    });
    // עדכן כפתור הצגת/הסתרת המאגר
    const toggleDbBtn = document.getElementById('toggle-db');
    const area = document.getElementById('db-area');
    if (toggleDbBtn && area) {
        toggleDbBtn.textContent = area.classList.contains('hidden') ? translations[language].showDb : (language === 'he' ? 'הסתר מאגר עצים' : 'Hide Inventory');
    }
    // רענון טבלת המאגר כדי לעדכן את תווית "פעולות"
    renderInventoryTable();
}

// מעבר מטבע
function switchCurrency(cur) {
    currency = cur;
    saveData('currency', currency);
    renderInventoryTable();
    // עדכן גם את בלוק התוצאות
    const area = document.getElementById('results-area');
    if (area && area.childElementCount) {
        const res = computeOptimization();
        renderResults(res);
    }
}

// מעבר יחידות
function switchUnits(system) {
    unitSystem = system;
    saveData('unitSystem', unitSystem);
    renderInventoryTable();
    // עדכן גם את בלוק התוצאות
    const area = document.getElementById('results-area');
    if (area && area.childElementCount) {
        const res = computeOptimization();
        renderResults(res);
    }
}

// הוספת שורה לטבלה
function addRow(tableId) {
    const table = document.getElementById(tableId).querySelector('tbody');
    const row = table.insertRow();
    for (let i = 0; i < table.rows[0].cells.length; i++) {
        const cell = row.insertCell(i);
        cell.contentEditable = true;
    }
}

// טעינת CSV/XLSX
function handleFile(event, callback) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        if (file.name.endsWith('.csv')) {
            const data = parseCSV(e.target.result);
            callback(data);
        } else if (file.name.endsWith('.xlsx')) {
            const data = parseXLSX(e.target.result);
            callback(data);
        }
    };
    if (file.name.endsWith('.xlsx')) {
        reader.readAsBinaryString(file);
    } else {
        reader.readAsText(file);
    }
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    return lines.map(line => line.split(','));
}

function parseXLSX(data) {
    const workbook = XLSX.read(data, { type: 'binary' });
    const sheetName = workbook.SheetNames[0];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
}

// עזר: מציאת אינדקס עמודה לפי רשימת שמות אפשריים
function getColumnIndex(possibleNames = []) {
    if (!inventoryHeaders || inventoryHeaders.length === 0) return -1;
    const norm = v => String(v || '').trim().toLowerCase();
    const headerNorm = inventoryHeaders.map(h => norm(h));
    for (let i = 0; i < headerNorm.length; i++) {
        for (const name of possibleNames) {
            const n = norm(name);
            if (headerNorm[i].includes(n)) return i;
        }
    }
    return -1;
}

// קבלת אינדקס עמודת סוג
function getTypeColIndex() {
    const idx = getColumnIndex(['type', 'סוג']);
    return idx >= 0 ? idx : 0;
}

// רשימת סוגים ייחודיים
function getUniqueTypes() {
    const typeIdx = getTypeColIndex();
    const values = inventoryData.map(r => r[typeIdx]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
    return Array.from(new Set(values.map(String)));
}

function getClassificationColIndex() {
    const idx = getColumnIndex(['classification', 'סיווג']);
    return idx;
}

function getThicknessColIndex() {
    const idx = getColumnIndex(['thickness', 'עובי']);
    return idx;
}

function getWidthColIndex() {
    const idx = getColumnIndex(['width', 'רוחב']);
    return idx;
}

function getPriceColIndex() {
    return getColumnIndex(['price', 'מחיר']);
}

function getPricePerMeterColIndex() {
    return getColumnIndex(['price per meter', 'מחיר למטר']);
}

function getLengthColIndex() {
    return getColumnIndex(['length', 'אורך']);
}

function getSupplierColIndex() {
    return getColumnIndex(['supplier','ספק']);
}

function getUniqueThicknessesForType(type) {
    const tIdx = getTypeColIndex();
    const thIdx = getThicknessColIndex();
    if (tIdx < 0 || thIdx < 0) return [];
    const vals = inventoryData.filter(r => String(r[tIdx]) === String(type)).map(r => r[thIdx]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
    return Array.from(new Set(vals.map(String))).sort((a, b) => Number(a) - Number(b));
}

function getUniqueWidths(type, thickness) {
    const tIdx = getTypeColIndex();
    const thIdx = getThicknessColIndex();
    const wIdx = getWidthColIndex();
    if (tIdx < 0 || wIdx < 0) return [];
    const rows = inventoryData.filter(r => String(r[tIdx]) === String(type) && (thIdx < 0 || String(r[thIdx]) === String(thickness)));
    const vals = rows.map(r => r[wIdx]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
    return Array.from(new Set(vals.map(String))).sort((a, b) => Number(a) - Number(b));
}

function getClassificationFor(type, thickness) {
    const tIdx = getTypeColIndex();
    const thIdx = getThicknessColIndex();
    const cIdx = getClassificationColIndex();
    if (cIdx < 0) return '';
    let row = inventoryData.find(r => String(r[tIdx]) === String(type) && (thIdx < 0 || String(r[thIdx]) === String(thickness)) && r[cIdx]);
    if (!row) {
        // נסה לפי סוג בלבד
        row = inventoryData.find(r => String(r[tIdx]) === String(type) && r[cIdx]);
    }
    return row ? String(row[cIdx]) : '';
}

// המרת יחידות לתצוגה
function normalizeUnitLabel(u) {
    const s = String(u || '').toLowerCase();
    // זיהוי עברית: מ"מ / מילימטר / מילימטרים ; ס"מ / סנטימטר
    // תמיכה גם בגרש (׳) וגרשיים (״) בעברית
    if (s.includes("mm") || s.includes("מ\"מ") || s.includes("מ״מ") || s.includes('מילימ')) return 'mm';
    if (s.includes("cm") || s.includes("ס\"מ") || s.includes("ס״מ") || s.includes('סנטימ')) return 'cm';
    if (s.includes("m") || s.includes("מ'") || s.includes("מ׳") || s.includes("מטר")) return 'm';
    if (s.includes("inch") || s.includes('in') || s.includes('"') || s.includes('אינץ') || s.includes('אינצ׳')) return 'in';
    return '';
}

function convertNumberByUnit(val, fromUnit, toSystem) {
    const n = Number(val);
    if (!isFinite(n)) return val;
    const f = normalizeUnitLabel(fromUnit);
    if (toSystem === 'imperial') {
        // mm/cm/m -> inch
        if (f === 'mm') return n / 25.4;
        if (f === 'cm') return n / 2.54;
        if (f === 'm') return n * 39.37007874;
        return n; // already inch or unknown
    } else {
        // inch -> metric (prefer mm for thickness/width, m for length during display is handled by units row)
        if (f === 'in') return n * 25.4; // default to mm-equivalent; caller decides formatting
        return n;
    }
}

function convertedUnitLabel(fromUnit, toSystem) {
    const f = normalizeUnitLabel(fromUnit);
    if (toSystem === 'imperial') return 'in';
    // back to metric: keep original label
    return f || '';
}

// יחידות בשפה המתאימה
function localizedUnitShort(u, lang) {
    const f = normalizeUnitLabel(u);
    switch (f) {
        case 'mm': return lang==='he' ? 'מ״מ' : 'mm';
        case 'cm': return lang==='he' ? 'ס״מ' : 'cm';
        case 'm':  return lang==='he' ? 'מ׳'  : 'm';
        case 'in': return lang==='he' ? 'אינץ׳' : 'inch';
        default: return f || '';
    }
}
function convertedUnitLabelLocalized(fromUnit, toSystem, lang) {
    if (toSystem === 'imperial') return localizedUnitShort('in', lang);
    return localizedUnitShort(fromUnit, lang);
}

// תרגום שמות עמודות בסיסיות
function translateHeaderName(name) {
    const s = String(name || '').trim().toLowerCase();
    const enToHe = {
        'type': 'סוג',
    'tree type': 'סוג',
    'supplier': 'ספק',
        'classification': 'סיווג',
        'thickness': 'עובי',
        'width': 'רוחב',
        'length': 'אורך',
        'price': 'מחיר',
        'price per meter': 'מחיר למטר'
    };
    const heToEn = {
        'סוג': 'Type',
    'סוג עץ': 'Type',
    'ספק': 'Supplier',
        'סיווג': 'Classification',
        'עובי': 'Thickness',
        'רוחב': 'Width',
        'אורך': 'Length',
        'מחיר': 'Price',
        'מחיר למטר': 'Price per meter'
    };
    if (language === 'he') {
        // אם כבר בעברית – החזר כמו שהוא
        if (heToEn[s]) return name; // אינדיקציה שזה בעברית
        return enToHe[s] || name;
    } else {
        // אם כבר באנגלית – החזר כמו שהוא
        if (enToHe[s]) return name; // אינדיקציה שזה באנגלית
        return heToEn[s] || name;
    }
}

// Classification helpers (support HE/EN)
function classificationIsPlate(val) {
    const s = String(val || '').trim().toLowerCase();
    return s.includes('פלטה') || s.includes('plate');
}
function classificationIsBeam(val) {
    const s = String(val || '').trim().toLowerCase();
    return s.includes('קורה') || s.includes('beam');
}

// המרת אורך למטר (לפי יחידה מהשורה השנייה של הקובץ)
function lengthToMeters(val, unitLabel) {
    const n = Number(val);
    if (!isFinite(n)) return NaN;
    const u = normalizeUnitLabel(unitLabel);
    if (u === 'mm') return n / 1000;
    if (u === 'cm') return n / 100;
    if (u === 'm') return n;
    if (u === 'in') return n * 0.0254;
    // לא ידוע – נניח מטרים
    return n;
}

function toMM(val, unitLabel) {
    const n = Number(val);
    if (!isFinite(n)) return NaN;
    const u = normalizeUnitLabel(unitLabel);
    if (u === 'mm') return n;
    if (u === 'cm') return n * 10;
    if (u === 'm') return n * 1000;
    if (u === 'in') return n * 25.4;
    return n; // assume mm
}

function fromMM(mm, target) {
    const u = normalizeUnitLabel(target);
    if (u === 'mm') return mm;
    if (u === 'cm') return mm / 10;
    if (u === 'm') return mm / 1000;
    if (u === 'in') return mm / 25.4;
    return mm;
}

function displayLenFromMM(mm) {
    // בתצוגה: מ' במטרי, אינץ' באימפריאלי
    if (unitSystem === 'imperial') return mm / 25.4; // inch
    return mm / 1000; // meters
}

function displayLenUnitLabel() {
    return language === 'he' ? (unitSystem === 'imperial' ? 'אינץ׳' : 'מ׳') : (unitSystem === 'imperial' ? 'inch' : 'm');
}

function formatSmart(n) {
    const v = Number(n);
    if (!isFinite(v)) return n ?? '';
    const r = Math.round(v);
    return Math.abs(v - r) < 1e-6 ? String(r) : v.toFixed(2);
}

function formatNumber(val) {
    const n = Number(val);
    if (!isFinite(n)) return val ?? '';
    return n.toFixed(2);
}

// המרת מטבעות לתצוגה (דמו): ערכים יחסיים ל-€; החישובים נשמרים בבסיס הקובץ
const currencyRates = { '€': 1, '$': 1.1, '₪': 4.0 };
function normalizeCurrencySymbol(s) {
    const t = String(s || '').trim().toLowerCase();
    if (!t) return '€';
    if (t.includes('₪') || t.includes('ils') || t.includes('nis') || t.includes('shek') || t.includes('שח') || t.includes('ש"ח') || t.includes('ש׳ח')) return '₪';
    if (t.includes('$') || t.includes('usd') || t.includes('dollar')) return '$';
    if (t.includes('€') || t.includes('eur') || t.includes('euro')) return '€';
    return (t === '$' || t === '€' || t === '₪') ? t.toUpperCase() : '€';
}
function convertCurrency(value, fromSymbol, toSymbol) {
    const v = Number(value);
    const from = normalizeCurrencySymbol(fromSymbol);
    const to = normalizeCurrencySymbol(toSymbol);
    if (!isFinite(v) || !currencyRates[from] || !currencyRates[to]) return value;
    const eurVal = v / currencyRates[from];
    return eurVal * currencyRates[to];
}

// רנדר טבלת מאגר העצים
function renderInventoryTable() {
    const wrap = document.getElementById('db-table-wrap');
    if (!wrap) return;
    if (!inventoryRows || inventoryRows.length === 0) {
        // No data yet — show a friendly empty state
        const msg = language === 'he' ? 'לא נטען קובץ.' : 'No file loaded.';
        wrap.innerHTML = `<p style="color:#666;margin:8px 0;text-align:center">${msg}</p>`;
        return;
    }
    const headers = [...inventoryHeaders.map(h => translateHeaderName(h)), (language === 'he' ? 'פעולות' : 'Actions')];
    // תיקון יחידות חסרות — הוסף ברירת מחדל להצגה ולשימור
    const heLang = (language === 'he');
    const unitsOrig = Array.isArray(inventoryUnits) ? inventoryUnits : [];
    const units = unitsOrig.slice();
    const thIdxFix = getThicknessColIndex();
    const wIdxFix = getWidthColIndex();
    const lenIdxFix = getLengthColIndex();
    const priceIdxFix = getPriceColIndex();
    const ppmIdxFix = getPricePerMeterColIndex();
    const curSym = document.getElementById('btn-currency')?.textContent?.trim() || inventoryPriceCurrencyUnit || '€';
    if (thIdxFix >= 0 && (!units[thIdxFix] || String(units[thIdxFix]).trim()==='')) units[thIdxFix] = heLang ? 'מ״מ' : 'mm';
    if (wIdxFix  >= 0 && (!units[wIdxFix]  || String(units[wIdxFix]).trim()===''))  units[wIdxFix]  = heLang ? 'מ״מ' : 'mm';
    // אם המקור הוא manual — ודא שהיחידה באורך היא מטרים גם אם הוזן אחר כך אחרת
    const invSource = loadData('inventorySource');
    if (lenIdxFix>= 0 && (invSource === 'manual')) units[lenIdxFix] = heLang ? 'מ׳' : 'm';
    if (lenIdxFix>= 0 && (!units[lenIdxFix]|| String(units[lenIdxFix]).trim()==='')) units[lenIdxFix] = heLang ? 'מ׳'  : 'm';
    if (priceIdxFix>=0 && (!units[priceIdxFix]|| String(units[priceIdxFix]).trim()==='')) units[priceIdxFix] = curSym;
    if (ppmIdxFix  >=0 && (!units[ppmIdxFix]  || String(units[ppmIdxFix]).trim()===''))  units[ppmIdxFix]  = curSym;
    // נרמול אורך למטרים עבור כל מקור: אם היחידה איננה מטר, המר את הנתונים ושנה את התווית למטר
    if (lenIdxFix >= 0) {
        const lenUnitNow = units[lenIdxFix] || '';
        const norm = normalizeUnitLabel(lenUnitNow);
        if (norm && norm !== 'm') {
            let changed = false;
            inventoryData = (inventoryData || []).map(row => {
                const v = row?.[lenIdxFix];
                const mm = toMM(v, lenUnitNow);
                if (isFinite(mm)) {
                    const meters = fromMM(mm, 'm');
                    const num = Number(meters);
                    if (isFinite(num)) {
                        const val = +num.toFixed(3);
                        if (row[lenIdxFix] !== val) changed = true;
                        row[lenIdxFix] = val;
                    }
                }
                return row;
            });
            units[lenIdxFix] = heLang ? 'מ׳' : 'm';
            inventoryUnits = units.slice();
            saveData('inventoryUnits', inventoryUnits);
            if (changed) saveData('inventoryData', inventoryData);
        }
    }
    // אם בוצע שינוי — שמור את היחידות המעודכנות
    if (units.length && (units.length !== unitsOrig.length || units.some((u,i)=>u !== unitsOrig[i]))) {
        inventoryUnits = units.slice();
        saveData('inventoryUnits', inventoryUnits);
    }
    const body = inventoryData;
    const displayUnits = units && units.length ? units.map((u, i) => {
        // עדכן מטבע בעמודת המחיר לפי הכפתור
        const priceIdx = getPriceColIndex();
        const ppmIdx = getPricePerMeterColIndex();
        const typeIdx = getTypeColIndex();
        const clsIdx = getClassificationColIndex();
        const supplierIdx = getColumnIndex(['supplier','ספק']);
        if (i === typeIdx || i === clsIdx || i === supplierIdx) return '';
        if (i === priceIdx || i === ppmIdx) {
            // דאג שבראש היחידות יוצג המטבע גם בעמודות מחיר
            return document.getElementById('btn-currency')?.textContent?.trim() || normalizeCurrencySymbol(u) || '';
        }
        // במאגר ידני — שמור על אורך במטרים גם אם הממשק באימפריאלי
        if (i === lenIdxFix && invSource === 'manual') {
            return heLang ? 'מ׳' : 'm';
        }
        return convertedUnitLabelLocalized(u, unitSystem, language);
    }) : [];
    const thead1 = `<tr>${headers.map(h => `<th>${h ?? ''}</th>`).join('')}</tr>`;
    const thead2 = units && units.length ? `<tr>${inventoryHeaders.map((_, i) => `<th>${displayUnits[i] ?? ''}</th>`).join('')}<th></th></tr>` : '';
    // שורת עריכה ריקה בראש הטבלה, אם נדרשה (כולל תא פעולות)
    const cols = headers.length;
    const clsIdx = getClassificationColIndex();
    const newRow = showNewInventoryRow
        ? `<tr class="new-row">${Array.from({ length: cols - 1 }).map((_, i) => {
            if (i === clsIdx) {
                const opts = language === 'he' ? ['קורה','פלטה'] : ['Beam','Plate'];
                return `<td data-col="${i}"><select class="inv-classification">${opts.map(o=>`<option value="${o}">${o}</option>`).join('')}</select></td>`;
            }
            const ph = (inventoryHeaders[i] || '').toString();
            return `<td contenteditable="true" data-ph="${ph}" data-col="${i}"></td>`;
        }).join('')}<td>
            <button class="btn btn-save-new">${translations[language]?.save || (language === 'he' ? 'שמור' : 'save')}</button>
            <button class="btn btn-cancel-new">${language === 'he' ? 'בטל' : 'Cancel'}</button>
          </td></tr>`
        : '';
    const typeIdx = getTypeColIndex();
    const thIdx = getThicknessColIndex();
    const wIdx = getWidthColIndex();
    const lenIdx = getColumnIndex(['length', 'אורך']);
    const priceIdx = getPriceColIndex();
    const ppmIdx = getPricePerMeterColIndex();
    const tbody = newRow + body.map((r, rowIndex) => {
    const tds = inventoryHeaders.map((_, i) => {
            const raw = r[i];
            const unit = (units || [])[i] || '';
            let display = raw;
            const num = parseFloat(String(raw).replace(/[^0-9.\-]/g,''));
    if (isFinite(num)) {
                const conv = convertNumberByUnit(num, unit, unitSystem);
                // הצגה שונה לעמודות רוחב/עובי: המרה לפי יחידות המקור והצגה ללא נקודות אם מספר שלם
                if (i === thIdx || i === wIdx) {
                    const v = conv;
                    display = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : formatNumber(v);
                } else if (i === priceIdx || i === ppmIdx) {
                    // המרה לתצוגה בלבד; הנתונים עצמם נשמרים בבסיס כפי שבקובץ
            const toSymbol = document.getElementById('btn-currency')?.textContent?.trim() || inventoryPriceCurrencyUnit || '';
            const fromSymbol = normalizeCurrencySymbol(inventoryPriceCurrencyUnit) || toSymbol;
                    const converted = convertCurrency(conv, fromSymbol, toSymbol);
                    display = formatNumber(converted);
                } else {
                    display = formatNumber(conv);
                }
            }
            if (editingRows.has(rowIndex) && i === clsIdx) {
                const isPlate = classificationIsPlate(raw);
                const beamLabel = language==='he' ? 'קורה' : 'Beam';
                const plateLabel = language==='he' ? 'פלטה' : 'Plate';
                const select = `<select class="inv-classification"><option value="${beamLabel}" ${isPlate?'':'selected'}>${beamLabel}</option><option value="${plateLabel}" ${isPlate?'selected':''}>${plateLabel}</option></select>`;
                return `<td data-col="${i}">${select}</td>`;
            }
            return `<td ${editingRows.has(rowIndex) ? 'contenteditable="true"' : ''} data-col="${i}">${display ?? ''}</td>`;
        }).join('');
        const actions = editingRows.has(rowIndex)
            ? `<button class=\"btn btn-save\" data-row=\"${rowIndex}\">${translations[language]?.save || (language === 'he' ? 'שמור' : 'save')}</button>
               <button class="btn btn-cancel" data-row="${rowIndex}">${language === 'he' ? 'בטל' : 'Cancel'}</button>`
            : `<button class="btn btn-edit" data-row="${rowIndex}" title="${language === 'he' ? 'עריכה' : 'Edit'}">✏️</button>
               <button class="btn btn-del" data-row="${rowIndex}" title="${language === 'he' ? 'הסר' : 'Delete'}">✖</button>`;
        const trClass = editingRows.has(rowIndex) ? ' class="editing"' : '';
        return `<tr${trClass}>${tds}<td class="actions-cell">${actions}</td></tr>`;
    }).join('');
        const tableDir = (document.documentElement && document.documentElement.dir === 'rtl') ? 'rtl' : 'ltr';
        wrap.innerHTML = `
          <table class="db-table" dir="${tableDir}">
        <thead>${thead1}${thead2}</thead>
        <tbody>${tbody}</tbody>
      </table>
    `;
        // Reset scroll to the logical start (right in RTL, left in LTR)
        scrollToStart(wrap, tableDir);
}

// עדכון כל רשימות הסוגים בדרישות
function refreshRequirementTypeOptions() {
    const types = getUniqueTypes();
    const selects = document.querySelectorAll('select[data-field="type"]');
    selects.forEach(sel => {
        const current = sel.value;
        sel.innerHTML = `<option value="">${language === 'he' ? 'סוג' : 'Type'}</option>` +
            types.map(t => `<option value="${t}">${t}</option>`).join('');
        if (types.includes(current)) sel.value = current;
    });
}

// טעינת מאגר העצים מהמערך הדו ממדי
function setInventoryFromArray2D(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return;
    inventoryRows = arr;
    inventoryHeaders = arr[0] || [];
    inventoryUnits = arr[1] || [];
    inventoryData = arr.slice(2);
    // גזור מטבע ברירת מחדל מעמודת המחיר בשורת היחידות
    const pIdx = getPriceColIndex();
    if (pIdx >= 0) {
        inventoryPriceCurrencyUnit = normalizeCurrencySymbol(inventoryUnits[pIdx]);
    }
    // שמור הכל כדי לשרוד רענון
    saveData('inventoryRows', inventoryRows);
    saveData('inventoryHeaders', inventoryHeaders);
    saveData('inventoryUnits', inventoryUnits);
    saveData('inventoryData', inventoryData);
    saveData('inventoryPriceCurrencyUnit', inventoryPriceCurrencyUnit);
    // קבע מטבע ברירת מחדל לפי הקובץ
    const btnCurrency = document.getElementById('btn-currency');
    if (btnCurrency && inventoryPriceCurrencyUnit) {
        btnCurrency.textContent = inventoryPriceCurrencyUnit;
        saveData('currencySymbol', inventoryPriceCurrencyUnit);
    }
    renderInventoryTable();
    refreshRequirementTypeOptions();
    showDbStatus(language === 'he' ? 'מאגר הנתונים נטען בהצלחה' : 'Inventory loaded successfully');
    // Auto-open DB area after load to show the table
    const area = document.getElementById('db-area');
    const toggleDbBtn = document.getElementById('toggle-db');
    if (area && toggleDbBtn) {
        area.classList.remove('hidden');
        area.setAttribute('aria-hidden','false');
        toggleDbBtn.textContent = (language === 'he' ? 'הסתר מאגר עצים' : 'Hide Inventory');
        toggleDbBtn.setAttribute('aria-expanded','true');
        // Scroll the DB block into view so title/buttons are on top and 50% viewport shows table rows
        try {
            const blockDb = document.getElementById('block-db');
            blockDb && blockDb.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch(_){ }
    }
}

// שמירה ב-localStorage
function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function loadData(key) {
    const data = localStorage.getItem(key);
    if (data == null) return null;
    try {
        return JSON.parse(data);
    } catch (e) {
        // תמיכה בערכים ישנים שנשמרו כטקסט גולמי (למשל 'he')
        if (data === 'undefined' || data === 'null') return null;
        return data;
    }
}

// כאן ייכנסו האלגוריתמים של 1D ו-2D + שרטוט SVG בעתיד
// =========================================
// אופטימיזציית קורות 1D (גרידי, בחירת אורך מיטבי בודד)
function planBeamsForGroup(groupKey, cutsMM, kerfMM) {
    // groupKey: { type, thickness, width }
    // בחר את אורך הקורה מהמלאי שיניב עלות מינימלית הכוללת
    const tIdx = getTypeColIndex();
    const thIdx = getThicknessColIndex();
    const wIdx = getWidthColIndex();
    const lenIdx = getLengthColIndex();
    const priceIdx = getPriceColIndex();
    const supplierIdx = getSupplierColIndex();
    const lengthUnit = (inventoryUnits[lenIdx] || '');
    // סנן מלאי רלוונטי
    const stockOptions = inventoryData
        .map((row, i) => ({ row, i }))
        .filter(({row}) => String(row[tIdx]) === groupKey.type && String(row[thIdx]) === groupKey.thickness && String(row[wIdx]) === groupKey.width)
        .map(({row,i}) => {
            const Lmm = toMM(row[lenIdx], lengthUnit);
            let price = parseFloat(String(row[priceIdx] ?? '').replace(/[^0-9.\-]/g,''));
            if (!isFinite(price)) price = 0; // treat empty/invalid as 0
            return { index:i, row, Lmm, price, supplier: row[supplierIdx] };
        })
        .filter(opt => isFinite(opt.Lmm) && isFinite(opt.price) && opt.Lmm > 0 && opt.price >= 0);
    if (stockOptions.length === 0) return null;
    // פונקציה לגרידי: לוקחת אורך נתון ומקצה חיתוכים
    function greedyPack(Lmm) {
        const remainingCuts = [...cutsMM].sort((a,b)=>b-a);
        const bars = [];
        while (remainingCuts.length) {
            let bar = { used:0, pieces:[], waste:0 };
            let remaining = Lmm;
            let anyPlacedThisBar = false;
            while (remainingCuts.length) {
                // נסה לשבץ את הארוך ביותר שיכול להיכנס
                let placed = false;
                for (let idx = 0; idx < remainingCuts.length; idx++) {
                    const piece = remainingCuts[idx];
                    // kerf לכל חתיכה שנחתכת מהקורה (כולל הראשונה)
                    const need = piece + kerfMM;
                    if (need <= remaining + 1e-6) {
                        // שים חתיכה
                        bar.pieces.push(piece);
                        bar.used += need;
                        remaining -= need;
                        remainingCuts.splice(idx,1);
                        placed = true;
                        anyPlacedThisBar = true;
                        break;
                    }
                }
                if (!placed) break;
            }
            // אם לא הונחה אף חתיכה בקורה הזו — אין מה להתקדם, עצור כדי למנוע לולאה אין-סופית
            if (!anyPlacedThisBar) break;
            bar.waste = remaining; // פחת בקורה הזו
            bars.push(bar);
        }
        return bars;
    }
    // הערך הטוב ביותר בין אופציות ארוך מלאי שונות
    let best = null;
    for (const opt of stockOptions) {
        const bars = greedyPack(opt.Lmm);
        // דלג אם לא כל החתיכות שובצו (מגן מפני מצב בו אף חתיכה לא נכנסת)
        const placedCount = bars.reduce((a,b)=> a + b.pieces.length, 0);
        if (placedCount < cutsMM.length) continue;
        const totalCost = bars.length * opt.price;
        if (!best || totalCost < best.totalCost) {
            best = { option: opt, bars, totalCost };
        }
    }
    return best;
}

// אריזת פלטות 2D (Guillotine heuristic + אפשרות יחידה לריבוע פחת גדול אם הכל נכנס)
function packPlatesForGroup(groupKey, piecesMM, kerfMM) {
    // groupKey: { type, thickness }
    const tIdx = getTypeColIndex();
    const thIdx = getThicknessColIndex();
    const wIdx = getWidthColIndex();
    const lenIdx = getLengthColIndex();
    const priceIdx = getPriceColIndex();
    const supplierIdx = getSupplierColIndex();
    const wUnit = inventoryUnits[wIdx] || '';
    const lUnit = inventoryUnits[lenIdx] || '';
    const plates = inventoryData
        .map((row, i) => ({ row, i }))
        .filter(({row}) => String(row[tIdx]) === groupKey.type && String(row[thIdx]) === groupKey.thickness)
        .map(({row,i}) => {
            const Wmm = toMM(row[wIdx], wUnit);
            const Hmm = toMM(row[lenIdx], lUnit);
            let price = parseFloat(String(row[priceIdx] ?? '').replace(/[^0-9.\-]/g,''));
            if (!isFinite(price)) price = 0; // treat empty/invalid as 0
            return { index:i, row, Wmm, Hmm, price, supplier: row[supplierIdx] };
        })
        .filter(p => isFinite(p.Wmm) && isFinite(p.Hmm) && p.Wmm>0 && p.Hmm>0);
    if (plates.length === 0) return null;
    // נבחר פלטה לפי מחיר לשטח מינימלי
    plates.sort((a,b)=> (a.price/(a.Wmm*a.Hmm)) - (b.price/(b.Wmm*b.Hmm)));
    const chosen = plates[0];
    // נסה קודם רשת לחלקים זהים (Grid) — מיטב למזעור מס' פלטות עבור חלקים זהים
    function tryIdenticalGridLayout() {
        if (!piecesMM || piecesMM.length === 0) return null;
        // בדוק זהות (עד כדי סיבוב)
        const canon = p => {
            const a = Math.min(p.w, p.h), b = Math.max(p.w, p.h);
            return `${Math.round(a)}x${Math.round(b)}`;
        };
        const key0 = canon(piecesMM[0]);
        for (let i=1;i<piecesMM.length;i++) {
            if (canon(piecesMM[i]) !== key0) return null;
        }
        // נסה שתי אוריינטציות וחשב קיבולת לפלטה
        const PW = chosen.Wmm, PH = chosen.Hmm;
        const base = piecesMM[0];
        const orients = [ {pw: base.w, ph: base.h}, {pw: base.h, ph: base.w} ];

        function buildRowMajor(pw, ph, alignRight, count) {
            const cols = Math.max(0, Math.floor((PW + kerfMM) / (pw + kerfMM)));
            const rows = Math.max(0, Math.floor((PH + kerfMM) / (ph + kerfMM)));
            const cap = cols * rows;
            if (cap <= 0) return null;
            const placed = [];
            const toPlace = Math.min(count, cap);
            let placedCount = 0;
            for (let r=0; r<rows && placedCount<toPlace; r++) {
                const piecesThisRow = Math.min(cols, toPlace - placedCount);
                for (let c=0; c<piecesThisRow; c++) {
                    const usedWidthRow = piecesThisRow * pw + Math.max(0, piecesThisRow - 1) * kerfMM;
                    const baseX = alignRight ? (PW - usedWidthRow) : 0;
                    const x = baseX + c * (pw + kerfMM);
                    const y = r * (ph + kerfMM);
                    placed.push({ x, y, w: pw, h: ph, src: { w: pw, h: ph } });
                    placedCount++;
                }
            }
            // חישוב freeRects
            const freeRects = [];
            const fullRows = Math.floor(toPlace / cols);
            const remInRow = toPlace % cols;
            const usedEdgeXFull = cols * pw + Math.max(0, cols - 1) * kerfMM;
            const usedHeightWithPartial = fullRows * (ph + kerfMM) + (remInRow > 0 ? ph : 0);
            // ימינה בשורות מלאות
            for (let r=0;r<fullRows;r++) {
                const x = usedEdgeXFull;
                const y = r * (ph + kerfMM);
                const w = PW - x;
                const h = ph;
                if (w > 0 && h > 0) freeRects.push({ x, y, w, h });
            }
            // שורה חלקית
            if (remInRow > 0) {
                const usedWidthRow = remInRow * pw + Math.max(0, remInRow - 1) * kerfMM;
                const y = fullRows * (ph + kerfMM);
                if (alignRight) {
                    const x = 0;
                    const w = PW - usedWidthRow;
                    if (w > 0 && ph > 0) freeRects.push({ x, y, w, h: ph });
                } else {
                    const x = usedWidthRow;
                    const w = PW - x;
                    if (w > 0 && ph > 0) freeRects.push({ x, y, w, h: ph });
                }
            }
            // תחתון
            {
                const x = 0;
                // אם אין שורה חלקית והיו שורות מלאות, גובה מנוצל = fullRows*ph + (fullRows-1)*kerf
                const usedHeight = (remInRow>0)
                    ? usedHeightWithPartial
                    : (fullRows>0 ? (fullRows * ph + Math.max(0, fullRows - 1) * kerfMM) : 0);
                const y = usedHeight;
                const w = PW;
                const h = PH - y;
                if (w > 0 && h > 0) freeRects.push({ x, y, w, h });
            }
            return { placed, freeRects, cap };
        }

        function bestVariantForCount(count) {
            const variants = [];
            for (const o of orients) {
                const a = buildRowMajor(o.pw, o.ph, false, count);
                const b = buildRowMajor(o.pw, o.ph, true, count);
                if (a) variants.push({ o, alignRight:false, ...a });
                if (b) variants.push({ o, alignRight:true, ...b });
            }
            if (!variants.length) return null;
            // דירוג: קודם בחר קיבולת (cap) מקסימלית, ואז לפי מלבן פחת גדול ביותר
            variants.sort((v1, v2) => {
                if (v2.cap !== v1.cap) return v2.cap - v1.cap;
                const maxFr = (vs) => vs.freeRects.reduce((m,r)=>Math.max(m, Math.max(0,r.w)*Math.max(0,r.h)), 0);
                return maxFr(v2) - maxFr(v1);
            });
            return variants[0];
        }

        const total = piecesMM.length;
        const layouts = [];
        let remaining = total;
        let idxPiece = 0;
        while (remaining > 0) {
            const cand = bestVariantForCount(remaining);
            if (!cand || cand.cap <= 0) return null;
            const toPlace = Math.min(remaining, cand.cap);
            // בנה הצבה מחדש עם המקורות המקוריים כדי לשמר src
            const placed = cand.placed.map((pc) => {
                const src = piecesMM[idxPiece++];
                return { x: pc.x, y: pc.y, w: pc.w, h: pc.h, src };
            });
            layouts.push({ plate: chosen, placed, freeRects: cand.freeRects });
            remaining -= toPlace;
        }
        return { plate: chosen, layouts };
    }
    // נסה קודם מקרה מיוחד: כל החלקים נכנסים בפלטה אחת, ובסידור שורה אחת שיוצר פחת מלבני גדול אחד
    function trySingleRowLayout() {
        const PW = chosen.Wmm, PH = chosen.Hmm; // לא מבצעים רוטציה פה; הרוטציה תעשה ברנדור
        // דרישת שורה אחת: לכל חלק יש מימד שמתאים בדיוק לגובה הפלטה (±1 מ"מ)
        const tol = 1; // מ"מ
        const oriented = [];
        for (const part of piecesMM) {
            if (Math.abs(part.h - PH) <= tol) oriented.push({w: part.w, h: PH, src: part});
            else if (Math.abs(part.w - PH) <= tol) oriented.push({w: part.h, h: PH, src: part});
            else return null; // חלק שלא יכול למלא את הגובה -> לא שורה אחת
        }
        // בדוק רוחב כולל עם kerf בין חלקים ובין החלק האחרון לפחת
        const totalW = oriented.reduce((a,p)=> a + p.w, 0) + kerfMM * Math.max(1, oriented.length); // kerf בין כל שני חלקים וגם לפני הפחת
        if (totalW - tol > PW) return null;
        // בנה מיקומים: החל מ-x=0, ללא kerf בשמאל (נניח חיתוך קצה קיים), kerf בין חלקים ובסוף לפני הפחת
        let x = 0;
        const placed = [];
        for (let i=0;i<oriented.length;i++) {
            const p = oriented[i];
            placed.push({ x, y: 0, w: p.w, h: p.h, src: p.src });
            x += p.w + kerfMM; // kerf בין חלקים
        }
        // מלבן הפחת בצד ימין
        const wasteW = Math.max(0, PW - x); // kerf בין החלק האחרון לפחת כבר נכלל בחשבון x
        const freeRects = wasteW > 0 ? [{ x, y: 0, w: wasteW, h: PH }] : [];
        return { placed, freeRects };
    }

    // פריסת מדפים (Shelves) להשגת פחת מלבני יחיד מקסימלי כאשר הכל נכנס
    function tryShelfMaxWaste() {
        const PW = chosen.Wmm, PH = chosen.Hmm;
        const tol = 1; // מ"מ
        if (!piecesMM || !piecesMM.length) return null;
        // בדיקת שטח כיסוי (כולל קירוב kerf): אם גדול מהפלטה, אין טעם לנסות
        const totalArea = piecesMM.reduce((a,p)=> a + p.w*p.h, 0);
        if (totalArea - tol > PW*PH) return null;
        // בחר שתי וריאציות: "שורות" (גובה מינימלי לכל חלק) ו"עמודות" (רוחב מינימלי לכל חלק)
        function buildShelfRows(useMinAsHeight) {
            // אוריינטציה לכל חלק: גובה=min או רוחב=min
            const oriented = piecesMM.map(p => {
                const minD = Math.min(p.w, p.h);
                const maxD = Math.max(p.w, p.h);
                return useMinAsHeight ? {w: maxD, h: minD, src: p} : {w: minD, h: maxD, src: p};
            });
            // מיין מהגדול לקטן כדי למלא רצפים צפופים
            const items = oriented.slice().sort((a,b)=> (useMinAsHeight ? (b.h - a.h) || (b.w - a.w) : (b.w - a.w) || (b.h - a.h)));
            const rows = [];
            let curRow = { items: [], rowH: 0, usedW: 0 };
            function canPlaceInRow(r, itm) {
                const extraKerf = r.items.length>0 ? kerfMM : 0;
                return (r.usedW + extraKerf + itm.w) <= PW + tol;
            }
            for (const it of items) {
                if (curRow.items.length===0 || canPlaceInRow(curRow, it)) {
                    const extraKerf = curRow.items.length>0 ? kerfMM : 0;
                    curRow.items.push(it);
                    curRow.usedW += extraKerf + it.w;
                    curRow.rowH = Math.max(curRow.rowH, it.h);
                } else {
                    rows.push(curRow);
                    curRow = { items: [it], rowH: it.h, usedW: it.w };
                }
            }
            if (curRow.items.length) rows.push(curRow);
            // חשב גובה כולל עם kerf בין שורות
            const totalH = rows.reduce((a,r)=> a + r.rowH, 0) + kerfMM * Math.max(0, rows.length-1);
            if (totalH - tol > PH) return null; // לא נכנס
            // בנה מיקומים משמאל לימין, למעלה למטה
            const placed = [];
            let y = 0;
            for (const r of rows) {
                let x = 0;
                for (let i=0;i<r.items.length;i++) {
                    const it = r.items[i];
                    if (i>0) x += kerfMM;
                    placed.push({ x, y, w: it.w, h: it.h, src: it.src });
                    x += it.w;
                }
                y += r.rowH + kerfMM;
            }
            y -= kerfMM; // הסר kerf האחרון
            const freeRects = (PH - y > 0) ? [{ x: 0, y, w: PW, h: PH - y }] : [];
            return { placed, freeRects };
        }

        // נסה וריאציות והחזר את זו שמייצרת מלבן פחת הגדול ביותר כאשר כל החלקים שובצו
        const variants = [ buildShelfRows(true), buildShelfRows(false) ].filter(Boolean);
        if (!variants.length) return null;
        // ודא שמספר החלקים שובצו במלואם
        const full = variants.filter(v => v.placed.length === piecesMM.length);
        if (!full.length) return null;
        full.sort((a,b)=> {
            const areaA = a.freeRects.reduce((m,r)=> Math.max(m, Math.max(0,r.w)*Math.max(0,r.h)), 0);
            const areaB = b.freeRects.reduce((m,r)=> Math.max(m, Math.max(0,r.w)*Math.max(0,r.h)), 0);
            return areaB - areaA;
        });
        return full[0];
    }

    // אלגוריתם guillotine רגיל
    function guillotineLayouts() {
        const layouts = [];
        let remainingPieces = piecesMM.slice().sort((a,b)=> (b.w*b.h) - (a.w*a.h));
        while (remainingPieces.length) {
            const freeRects = [{ x: 0, y: 0, w: chosen.Wmm, h: chosen.Hmm }];
            const placed = [];
            let i = 0;
            while (i < remainingPieces.length) {
                const part = remainingPieces[i];
                let fit = null;
                for (let frIdx=0; frIdx<freeRects.length; frIdx++) {
                    const fr = freeRects[frIdx];
                    const orients = [ {w:part.w, h:part.h}, {w:part.h, h:part.w} ];
                    for (const o of orients) {
                        if (o.w <= fr.w && o.h <= fr.h) { fit = { frIdx, o }; break; }
                    }
                    if (fit) break;
                }
                if (!fit) { i++; continue; }
                const fr = freeRects[fit.frIdx];
                const x = fr.x, y = fr.y; const w = fit.o.w, h = fit.o.h;
                placed.push({ x, y, w, h, src: part });
                // חיתוך: שמירה על kerf בין אזורים (רוחב kerf בין החתיכה לאזורים החופשיים החדשים)
                const right = { x: x + w + kerfMM, y, w: fr.w - (w + kerfMM), h };
                const bottom = { x, y: y + h + kerfMM, w: fr.w, h: fr.h - (h + kerfMM) };
                freeRects.splice(fit.frIdx, 1, bottom);
                if (right.w > 0 && right.h > 0) freeRects.push(right);
                remainingPieces.splice(i,1);
            }
            // אם לא הונחה אף חתיכה בלוח הזה, עצור כדי למנוע לולאה אין-סופית
            if (placed.length === 0) break;
            layouts.push({ plate: chosen, placed, freeRects });
        }
        return layouts;
    }

    const grid = tryIdenticalGridLayout();
    if (grid) return grid;
    const single = trySingleRowLayout();
    if (single) {
        return { plate: chosen, layouts: [ { plate: chosen, placed: single.placed, freeRects: single.freeRects } ] };
    }
    const shelf = tryShelfMaxWaste();
    if (shelf) {
        return { plate: chosen, layouts: [ { plate: chosen, placed: shelf.placed, freeRects: shelf.freeRects } ] };
    }
    return { plate: chosen, layouts: guillotineLayouts() };
}

// =========================================
// אוסף הדרישות והפעלה
function computeOptimization() {
    const kerfMMConst = 3; // 3mm לכל חיתוך
    const reqs = gatherRequirements();
    if (!reqs.length) return { beams: [], plates: [], totals: { baseCurrency: inventoryPriceCurrencyUnit || '€', totalCost: 0, maxProducts: 1 }, errors: [] };
    const tIdx = getTypeColIndex();
    const thIdx = getThicknessColIndex();
    const wIdx = getWidthColIndex();
    const lIdx = getLengthColIndex();
    const priceIdx = getPriceColIndex();
    const supplierIdx = getSupplierColIndex();
    const thUnit = inventoryUnits[thIdx] || '';
    const wUnit = inventoryUnits[wIdx] || '';
    const lUnit = inventoryUnits[lIdx] || '';

    // קיבוץ דרישות לקורות/פלטות
    const groupsBeams = new Map(); // key -> {type,thickness,width} => list of lengths mm
    const groupsPlates = new Map(); // key -> {type,thickness} => list of rects mm

    for (const r of reqs) {
        const type = r.type;
        const thickness = r.thickness;
        const widthVal = r.width; // אם select או input
    const classification = getClassificationFor(type, thickness);
    if (classification && classificationIsPlate(classification)) {
            // רוחב דרישה לפלטות נקלט מהממשק: ס"מ במטרי, אינץ' באימפריאלי
            const wReqMM = toMM(widthVal, unitSystem === 'imperial' ? 'in' : 'cm');
            const lReqMM = toMM(r.length, unitSystem === 'imperial' ? 'in' : 'cm');
            if (!isFinite(wReqMM) || !isFinite(lReqMM) || wReqMM<=0 || lReqMM<=0) continue;
            const key = JSON.stringify({type,thickness});
            if (!groupsPlates.has(key)) groupsPlates.set(key, []);
            const list = groupsPlates.get(key);
            for (let i=0;i<(r.qty||1);i++) list.push({ w: wReqMM, h: lReqMM });
        } else {
            const lReqMM = toMM(r.length, unitSystem === 'imperial' ? 'in' : 'cm');
            const wVal = widthVal;
            if (!isFinite(lReqMM) || lReqMM<=0) continue;
            const key = JSON.stringify({type,thickness,width: String(wVal)});
            if (!groupsBeams.has(key)) groupsBeams.set(key, []);
            const list = groupsBeams.get(key);
            for (let i=0;i<(r.qty||1);i++) list.push(lReqMM);
        }
    }

    // ולידציה ושיוכים
    const errors = [];

    // פתרון לקורות
    const beamsResult = [];
    let totalBaseCost = 0;
    for (const [keyStr, cuts] of groupsBeams.entries()) {
        const key = JSON.parse(keyStr);
        // ולידציה: האם כל חיתוך נכנס בקורה כלשהי מהמלאי (לפי הסוג/עובי/רוחב)
        try {
            const tIdxV = getTypeColIndex();
            const thIdxV = getThicknessColIndex();
            const wIdxV = getWidthColIndex();
            const lenIdxV = getLengthColIndex();
            const lengthUnitV = (inventoryUnits[lenIdxV] || '');
            const stockOptionsV = inventoryData
                .map((row, i) => ({ row, i }))
                .filter(({row}) => String(row[tIdxV]) === key.type && String(row[thIdxV]) === key.thickness && String(row[wIdxV]) === key.width)
                .map(({row}) => toMM(row[lenIdxV], lengthUnitV))
                .filter(v => isFinite(v) && v > 0);
            const maxLen = stockOptionsV.length ? Math.max(...stockOptionsV) : 0;
            for (const c of cuts) {
                if (c + kerfMMConst > maxLen + 1e-6) {
                    const inchSym = '″';
                    const reqDisp = unitSystem==='imperial' ? `${formatSmart(c/25.4)}${inchSym}` : `${formatSmart(c/10)}${language==='he'?' ס״מ':' cm'}`;
                    const stockDisp = unitSystem==='imperial' ? `${formatSmart(maxLen/25.4)}${inchSym}` : `${formatSmart(maxLen/10)}${language==='he'?' ס״מ':' cm'}`;
                    errors.push(language==='he'
                        ? `חיתוך לקורה (${key.type}, עובי ${key.thickness}, רוחב ${key.width}) ארוך מהמלאי: דרוש ${reqDisp}, מקס׳ מלאי ${stockDisp}`
                        : `Beam cut (${key.type}, thickness ${key.thickness}, width ${key.width}) exceeds stock: needs ${reqDisp}, max stock ${stockDisp}`);
                    break;
                }
            }
        } catch(e) { /* ignore */ }
        const plan = planBeamsForGroup(key, cuts, kerfMMConst);
        if (!plan) continue;
        totalBaseCost += plan.totalCost;
        // בנה שורות לטבלת חיתוכים: שורה לכל קורה שנרכשה
        plan.bars.forEach((bar, idx) => {
            // חיתוכים: ס"מ במטרי, אינץ' באימפריאלי
            const cutsDisp = bar.pieces.map(mm => unitSystem==='imperial' ? (mm/25.4) : (mm/10));
            // פחת לקורות לתצוגה: ס"מ במטרי, אינץ' באימפריאלי (כמו בדיאגרמה)
            const wasteDisp = unitSystem==='imperial' ? (bar.waste/25.4) : (bar.waste/10);
            const barLenDisp = displayLenFromMM(plan.option.Lmm);
            const wastePct = plan.option.Lmm > 0 ? (bar.waste / plan.option.Lmm) * 100 : 0;
            beamsResult.push({
                type: key.type,
                classification: 'קורה',
                thickness: key.thickness,
                width: key.width,
                lengthDisp: barLenDisp,
                priceBase: plan.option.price,
                supplier: plan.option.supplier || '',
                cutsDisp,
                wasteDisp,
                wastePct
            });
        });
    }

    // פתרון לפלטות
    const platesResult = [];
    for (const [keyStr, rects] of groupsPlates.entries()) {
        const key = JSON.parse(keyStr);
        // ולידציה: ודא שכל חלק יכול להיכנס לפחות לאחת הפלטות (בכיוון כלשהו)
        try {
            const tIdxV = getTypeColIndex();
            const thIdxV = getThicknessColIndex();
            const wIdxV = getWidthColIndex();
            const lenIdxV = getLengthColIndex();
            const wUnitV = inventoryUnits[wIdxV] || '';
            const lUnitV = inventoryUnits[lenIdxV] || '';
            const candidates = inventoryData
                .map((row, i) => ({ row, i }))
                .filter(({row}) => String(row[tIdxV]) === key.type && String(row[thIdxV]) === key.thickness)
                .map(({row}) => ({ Wmm: toMM(row[wIdxV], wUnitV), Hmm: toMM(row[lenIdxV], lUnitV) }))
                .filter(p => isFinite(p.Wmm) && isFinite(p.Hmm) && p.Wmm>0 && p.Hmm>0);
            for (const part of rects) {
                const fits = candidates.some(p => (part.w <= p.Wmm && part.h <= p.Hmm) || (part.h <= p.Wmm && part.w <= p.Hmm));
                if (!fits) {
                    const inchSym = '″';
                    const wDisp = unitSystem==='imperial' ? `${formatSmart(part.w/25.4)}${inchSym}` : `${formatSmart(part.w/10)}${language==='he'?' ס״מ':' cm'}`;
                    const hDisp = unitSystem==='imperial' ? `${formatSmart(part.h/25.4)}${inchSym}` : `${formatSmart(part.h/10)}${language==='he'?' ס״מ':' cm'}`;
                    errors.push(language==='he'
                        ? `חיתוך לפלטה (${key.type}, עובי ${key.thickness}) גדול מדי: ${wDisp}×${hDisp} לא נכנס בשום פלטה`
                        : `Plate part (${key.type}, thickness ${key.thickness}) too large: ${wDisp}×${hDisp} does not fit any plate`);
                    break;
                }
            }
        } catch(e) { /* ignore */ }
        const pack = packPlatesForGroup(key, rects, kerfMMConst);
        if (!pack) continue;
        // עלות
        totalBaseCost += pack.layouts.length * pack.plate.price;
        // לכל פלטה, רשימת חלקים ומרובע פחת משוער כסכום מלבני ה-freeRects
    for (const layout of pack.layouts) {
            // מידות חלקים: ס"מ או אינץ'
            const cutsDisp = layout.placed.map(p => {
                const a = unitSystem==='imperial' ? (p.w/25.4) : (p.w/10);
                const b = unitSystem==='imperial' ? (p.h/25.4) : (p.h/10);
                return `${formatSmart(a)}×${formatSmart(b)}`;
            });
            const plateArea = pack.plate.Wmm * pack.plate.Hmm;
            const wasteArea = layout.freeRects.reduce((a,r)=> a + Math.max(0, r.w)*Math.max(0,r.h), 0);
            const wastePct = plateArea>0 ? (wasteArea/plateArea)*100 : 0;
            platesResult.push({
                type: key.type,
                classification: 'פלטה',
                thickness: key.thickness,
                width: fromMM(pack.plate.Wmm, wUnit),
                length: fromMM(pack.plate.Hmm, lUnit),
                priceBase: pack.plate.price,
                supplier: pack.plate.supplier || '',
                cutsDisp,
                wasteAreaM2: (wasteArea/1_000_000), // תמיד מטר^2
                wastePct,
                // מידע דיאגרמה
                plateWmm: pack.plate.Wmm,
                plateHmm: pack.plate.Hmm,
                kerfMM: kerfMMConst,
                placed: layout.placed.map(p=>({x:p.x,y:p.y,w:p.w,h:p.h,srcW:p.src.w,srcH:p.src.h})),
                freeRects: (layout.freeRects||[]).map(fr=>({x:fr.x,y:fr.y,w:fr.w,h:fr.h}))
            });
        }
    }

    // מס' מוצרים אפשריים — חישוב קונסרבטיבי מדויק יותר
    // beams: כמה סטים של כל דרישות הקבוצה נכנסים ברכישות שבוצעו
    let maxProducts = Infinity;
    for (const [keyStr, cuts] of groupsBeams.entries()) {
        const key = JSON.parse(keyStr);
        const plan = planBeamsForGroup(key, cuts, kerfMMConst);
        if (!plan) { maxProducts = 0; continue; }
        // אם כל החתיכות שוות — חשב כושר לקורה אחת: floor((L+kerf)/(p+kerf))
        const allEqual = cuts.every(v => Math.abs(v - cuts[0]) < 1e-6);
        if (allEqual && cuts.length > 0) {
            const p = cuts[0];
            const perBar = Math.floor((plan.option.Lmm + kerfMMConst) / (p + kerfMMConst));
            const totalPiecesPossible = perBar * plan.bars.length;
            const neededPerProduct = cuts.length; // סט אחד = כמות הדרישות (כי allEqual מייצג את הסט)
            const possible = neededPerProduct > 0 ? Math.floor(totalPiecesPossible / neededPerProduct) : 0;
            maxProducts = Math.min(maxProducts, Math.max(1, possible));
        } else {
            // ברירת מחדל: יחס אורכים שמרני כולל kerf בין חלקים בסט
            const perSet = cuts.reduce((a,b)=> a + b, 0) + Math.max(0, cuts.length-1) * kerfMMConst;
            const totalAvailable = plan.bars.length * plan.option.Lmm;
            const possible = perSet>0 ? Math.floor(totalAvailable / perSet) : 0;
            maxProducts = Math.min(maxProducts, Math.max(1, possible));
        }
    }
    // plates: כמה סטי שטח של חלקים נכנסים בפלטות שנבחרו
    for (const [keyStr, rects] of groupsPlates.entries()) {
        const key = JSON.parse(keyStr);
        const pack = packPlatesForGroup(key, rects, kerfMMConst);
        if (!pack) { maxProducts = 0; continue; }
        const perSetArea = rects.reduce((a,p)=> a + p.w*p.h, 0) + Math.max(0, rects.length-1) * kerfMMConst * Math.min(...rects.map(r=>Math.max(r.w,r.h))); // קירוב kerf אזורי
        const totalArea = pack.layouts.length * (pack.plate.Wmm * pack.plate.Hmm);
        const possible = perSetArea>0 ? Math.floor(totalArea / perSetArea) : 0;
        maxProducts = Math.min(maxProducts, Math.max(1, possible));
    }
    if (maxProducts === Infinity) maxProducts = 1;

    return { beams: beamsResult, plates: platesResult, totals: { baseCurrency: inventoryPriceCurrencyUnit || '€', totalCost: totalBaseCost, maxProducts }, errors };
}

function currencySymbol() {
    const btn = document.getElementById('btn-currency')?.textContent?.trim();
    return normalizeCurrencySymbol(btn || inventoryPriceCurrencyUnit || '€');
}

function convertBaseToDisplayCurrency(amountBase) {
    const from = normalizeCurrencySymbol(inventoryPriceCurrencyUnit || '€');
    const to = currencySymbol();
    return convertCurrency(amountBase, from, to);
}

// רינדור טבלאות תוצאות
function renderResults(results) {
    const area = document.getElementById('results-area');
    if (!area) return;
    const lenUnitLbl = displayLenUnitLabel();
    const priceSym = currencySymbol();

    function table1() {
        // כותרות עם יחידות
        const thIdx = getThicknessColIndex();
        const wIdx = getWidthColIndex();
        const lIdx = getLengthColIndex();
        const thU = inventoryUnits[thIdx] || '';
        const wU = inventoryUnits[wIdx] || '';
        const lU = inventoryUnits[lIdx] || '';
        const inchSym = '″';
        const cutsHeader = language==='he' ? `חיתוכים (${unitSystem==='imperial'?inchSym:'ס״מ'})` : `Cuts (${unitSystem==='imperial'?inchSym:'cm'})`;
        const wasteHeader = language==='he'
            ? (unitSystem==='imperial' ? `פחת (${inchSym}/מטר²)` : `פחת (ס״מ/מטר²)`)
            : (unitSystem==='imperial' ? `Waste (${inchSym}/m²)` : `Waste (cm/m²)`);
        const rows = [];
        const all = results.beams.concat(results.plates);
        for (const r of all) {
            const isBeam = r.classification === 'קורה';
            const cuts = isBeam
                ? (unitSystem==='imperial'
                    ? r.cutsDisp.map(v=> `${formatSmart(v)}${inchSym}`).join(', ')
                    : r.cutsDisp.map(v=> formatSmart(v)).join(', '))
                : (unitSystem==='imperial'
                    ? r.cutsDisp.map(s => s.split('×').map(v => `${v}${inchSym}`).join('×')).join(', ')
                    : r.cutsDisp.map(x=> x.split('×').map(formatSmart).join('×')).join(', '));
            // המרת עובי/רוחב לתצוגה לפי יחידות
            const thIdx = getThicknessColIndex();
            const wIdx = getWidthColIndex();
            const thU = inventoryUnits[thIdx] || '';
            const wU = inventoryUnits[wIdx] || '';
            const thDisp = unitSystem==='imperial' ? convertNumberByUnit(r.thickness, thU, 'imperial') : Number(r.thickness);
            const wDisp = unitSystem==='imperial' ? convertNumberByUnit(r.width, wU, 'imperial') : Number(r.width);
            const thCell = unitSystem==='imperial' ? `${formatSmart(thDisp)}${inchSym}` : `${formatSmart(thDisp)}`;
            const wCell = unitSystem==='imperial' ? `${formatSmart(wDisp)}${inchSym}` : `${formatSmart(wDisp)}`;
            const lenCell = isBeam
                ? (unitSystem==='imperial' ? `${formatSmart(r.lengthDisp)}${inchSym}` : `${formatSmart(r.lengthDisp)}`)
                : (unitSystem==='imperial' ? `${formatSmart(displayLenFromMM(toMM(r.length, lU)))}${inchSym}` : `${formatSmart(displayLenFromMM(toMM(r.length, lU)))}`);
            const wasteVal = isBeam
                ? (unitSystem==='imperial' ? `${formatSmart(r.wasteDisp)}${inchSym}` : `${formatSmart(r.wasteDisp)}`)
                : `${formatSmart(r.wasteAreaM2)}`;
            rows.push([
                r.type,
                r.classification,
                thCell,
                wCell,
                lenCell,
                `${formatSmart(convertBaseToDisplayCurrency(r.priceBase))}`,
                r.supplier || '',
                cuts,
                wasteVal,
                `${formatSmart(r.wastePct)}%`
            ]);
        }
        const headers = language==='he'
            ? ['סוג','סיווג',`עובי (${convertedUnitLabelLocalized(thU, unitSystem, language)})`, `רוחב (${convertedUnitLabelLocalized(wU, unitSystem, language)})`, `אורך עץ (${lenUnitLbl})`, `מחיר (${priceSym})`,`ספק`, cutsHeader, wasteHeader, 'פחת (%)']
            : ['Type','Class',`Thickness (${convertedUnitLabelLocalized(thU, unitSystem, language)})`, `Width (${convertedUnitLabelLocalized(wU, unitSystem, language)})`, `Length (${lenUnitLbl})`, `Price (${priceSym})`,`Supplier`, cutsHeader, wasteHeader, 'Waste (%)'];
        return buildHtmlTable(headers, rows);
    }

    function table2() {
        const total = convertBaseToDisplayCurrency(results.totals.totalCost);
        const maxProds = Math.max(1, results.totals.maxProducts|0);
        const pricePer = total / maxProds;
    const headers = language==='he' ? ['מחיר כולל', 'מס׳ מוצרים אפשריים', 'מחיר עבור מוצר'] : ['Total Price', 'Max Products', 'Price per Product'];
    const rows = [[ `${formatSmart(total)} ${priceSym}`, `${maxProds}`, `${formatSmart(pricePer)} ${priceSym}` ]];
        return buildHtmlTable(headers, rows);
    }

    function table3() {
        // קיבוץ פריטים זהים (סוג/סיווג/עובי/רוחב/אורך)
        const map = new Map();
        const thIdx = getThicknessColIndex();
        const wIdx = getWidthColIndex();
        const lIdx = getLengthColIndex();
        const thU = inventoryUnits[thIdx] || '';
        const wU = inventoryUnits[wIdx] || '';
        const lU = inventoryUnits[lIdx] || '';
        const all = results.beams.concat(results.plates);
        for (const r of all) {
            const lenVal = r.classification==='קורה' ? r.lengthDisp : displayLenFromMM(toMM(r.length, lU));
            const key = JSON.stringify({type:r.type,cls:r.classification,th:r.thickness,w:r.width,len:lenVal});
            const cur = map.get(key) || {type:r.type,cls:r.classification,th:r.thickness,w:r.width,len:lenVal,qty:0};
            cur.qty += 1;
            map.set(key, cur);
        }
        const inchSym = '″';
        const rows = Array.from(map.values()).map(r => {
            const thCell = unitSystem==='imperial' ? `${formatSmart(convertNumberByUnit(r.th, thU, 'imperial'))}${inchSym}` : `${formatSmart(Number(r.th))}`;
            const wCell = unitSystem==='imperial' ? `${formatSmart(convertNumberByUnit(r.w, wU, 'imperial'))}${inchSym}` : `${formatSmart(Number(r.w))}`;
            const lenCell = unitSystem==='imperial' ? `${formatSmart(r.len)}${inchSym}` : `${formatSmart(r.len)}`;
            return [
                r.type,
                r.cls,
                thCell,
                wCell,
                lenCell,
                `${r.qty}`
            ];
        });
    const headers = language==='he' ? ['סוג','סיווג',`עובי (${convertedUnitLabelLocalized(thU, unitSystem, language)})`, `רוחב (${convertedUnitLabelLocalized(wU, unitSystem, language)})`, `אורך (${displayLenUnitLabel()})`, 'כמות'] : ['Type','Class',`Thickness (${convertedUnitLabelLocalized(thU, unitSystem, language)})`, `Width (${convertedUnitLabelLocalized(wU, unitSystem, language)})`, `Length (${displayLenUnitLabel()})`, 'Qty'];
        return buildHtmlTable(headers, rows);
    }

    // בניית HTML פשוט לטבלה
    function buildHtmlTable(headers, rows) {
    const dir = (language === 'he') ? 'rtl' : 'ltr';
    return `<table class="db-table" dir="${dir}"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }

    // דיאגרמות
    function diagrams() {
        function settingsPanel() {
            const t = translations[language];
            const checked = v => v ? 'checked' : '';
            const fontSel = `
                <select id="ds-font">
                    <option value="regular" ${displaySettings.fontWeight==='regular'?'selected':''}>${t.regular}</option>
                    <option value="bold" ${displaySettings.fontWeight==='bold'?'selected':''}>${t.bold}</option>
                </select>`;
            // פאנל ממורכז, סגור כברירת מחדל; ללא טקסט קבוע — רק tooltip
            return `
                <div id="display-settings" style="margin:8px 0; display:flex; align-items:center; gap:10px;">
                    <button id="btn-display-settings" class="btn" title="${t.displaySettingsTitle}" style="font-size:22px; padding:8px 12px; filter: drop-shadow(0 1px 1px rgba(0,0,0,.15));">⚙️</button>
                    <div id="display-settings-panel" style="margin:8px auto 0; border:1px solid #ddd; padding:10px 12px; border-radius:10px; max-width:100%; background:#fff; display:${displaySettings.panelOpen?'flex':'none'}; gap:22px; align-items:center; justify-content:center; flex:1; flex-wrap:wrap;">
                        <label style="display:flex; align-items:center; gap:10px;">
                            <span>${t.cutColors}</span>
                            <input type="checkbox" id="ds-color" ${checked(displaySettings.colorPieces)} style="display:none;" />
                            <span id="ds-color-switch" role="switch" aria-checked="${displaySettings.colorPieces?'true':'false'}" tabindex="0" style="width:44px; height:24px; border-radius:12px; background:${displaySettings.colorPieces?'#4caf50':'#c7c7c7'}; position:relative; cursor:pointer; transition:background .2s; display:inline-block;">
                                <span style="position:absolute; top:2px; ${displaySettings.colorPieces?'right:2px;':'left:2px;'} width:20px; height:20px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:all .2s;"></span>
                            </span>
                        </label>
                        <label style="display:flex; align-items:center; gap:10px;">
                            <span>${t.fontSize}</span>
                            ${fontSel}
                        </label>
                        <label style="display:flex; align-items:center; gap:10px;">
                            <span>${t.extraInfo}</span>
                            <input type="checkbox" id="ds-labels" ${checked(displaySettings.showPieceLabels)} style="display:none;" />
                            <span id="ds-labels-switch" role="switch" aria-checked="${displaySettings.showPieceLabels?'true':'false'}" tabindex="0" style="width:44px; height:24px; border-radius:12px; background:${displaySettings.showPieceLabels?'#4caf50':'#c7c7c7'}; position:relative; cursor:pointer; transition:background .2s; display:inline-block;">
                                <span style="position:absolute; top:2px; ${displaySettings.showPieceLabels?'right:2px;':'left:2px;'} width:20px; height:20px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:all .2s;"></span>
                            </span>
                        </label>
                    </div>
                </div>`;
        }
        const parts = [];
        let idx = 1;
        // הוסף את הפאנל לפני הדיאגרמות
        parts.push(settingsPanel());
    // beams diagrams
        for (const r of results.beams) {
            const thIdx = getThicknessColIndex();
            const wIdx = getWidthColIndex();
            const thU = inventoryUnits[thIdx] || '';
            const wU = inventoryUnits[wIdx] || '';
            // כותרת: במטרי — עובי/רוחב במ"מ ואורך במטרים; באימפריאלי — הכל באינצ׳ (″)
            const inchSym = '″';
            const thMM = toMM(r.thickness, thU);
            const wMM = toMM(r.width, wU);
            let title;
            if (unitSystem === 'imperial') {
                const thIn = thMM/25.4, wIn = wMM/25.4, lenIn = r.lengthDisp; // כבר באינץ'
                title = (language==='he')
                    ? `פריט ${idx} — ${r.type} ${formatSmart(thIn)}${inchSym}×${formatSmart(wIn)}${inchSym} , ${formatSmart(lenIn)}${inchSym}`
                    : `Item ${idx} — ${r.type} ${formatSmart(thIn)}${inchSym}×${formatSmart(wIn)}${inchSym} , ${formatSmart(lenIn)}${inchSym}`;
            } else {
                const lenM = r.lengthDisp; // במטרים
                title = (language==='he')
                    ? `פריט ${idx} — ${r.type} ${formatSmart(thMM)}×${formatSmart(wMM)} מ״מ*מ״מ , ${formatSmart(lenM)} מ׳`
                    : `Item ${idx} — ${r.type} ${formatSmart(thMM)}×${formatSmart(wMM)} mm*mm , ${formatSmart(lenM)} m`;
            }
            const h3Dir = (language==='he') ? ' dir="rtl"' : '';
            parts.push(`<div class="results-section"><h3${h3Dir}>${title}</h3>${beamSvg(r)}</div>`);
            idx++;
        }
        // plates diagrams
        for (const p of results.plates) {
            // כותרת: מטרי — רוחב×אורך במ׳, עובי במ"מ; אימפריאלי — הכל באינצ׳ (″)
            const wMM = toMM(p.width, inventoryUnits[getWidthColIndex()]||'');
            const lMM = toMM(p.length, inventoryUnits[getLengthColIndex()]||'');
            const thMM = toMM(p.thickness, inventoryUnits[getThicknessColIndex()]||'');
            const inchSym = '″';
            let title;
            if (unitSystem === 'imperial') {
                const wIn = wMM/25.4, lIn = lMM/25.4, thIn = thMM/25.4;
                title = language==='he'
                    ? `פריט ${idx} — ${p.type} ${formatSmart(wIn)}${inchSym}×${formatSmart(lIn)}${inchSym} , עובי ${formatSmart(thIn)}${inchSym}`
                    : `Item ${idx} — ${p.type} ${formatSmart(wIn)}${inchSym}×${formatSmart(lIn)}${inchSym} , thickness ${formatSmart(thIn)}${inchSym}`;
            } else {
                const wM = wMM/1000, lM = lMM/1000;
                title = language==='he'
                    ? `פריט ${idx} — ${p.type} ${formatSmart(wM)}×${formatSmart(lM)} מ׳*מ׳ , עובי ${formatSmart(thMM)} מ״מ`
                    : `Item ${idx} — ${p.type} ${formatSmart(wM)}×${formatSmart(lM)} m*m , thickness ${formatSmart(thMM)} mm`;
            }
            const h3Dir = (language==='he') ? ' dir="rtl"' : '';
            parts.push(`<div class="results-section"><h3${h3Dir}>${title}</h3>${plateSvg(p)}</div>`);
            idx++;
        }
    return parts.join('');
    }

    function beamSvg(r) {
        // סרגל 100% רוחב, גובה 48
    const total = r.lengthDisp; // בתצוגה: m במטרי / inch באימפריאלי
        // מזהה ייחודי לדיאגרמה זו
        const svgId = `svg_${svgIdCounter++}`;
    const w = 1000;
    // התאמת גובה: מובייל פי 3, דסקטופ רגיל; ב-PDF נשתמש בסקייל נפרד בהמשך
    let isMobile = false;
    try {
        if (typeof window !== 'undefined') {
            isMobile = (window.matchMedia && window.matchMedia('(max-width: 840px)').matches) || (window.innerWidth <= 840);
        }
    } catch(_){ isMobile = false; }
    const baseH = 80;
    const m = isMobile ? 1.5 : 1; // מובייל +50%
    const h = Math.round(baseH * m);
        const scale = total>0 ? (w / total) : 1;
        let x = 0;
    // קיבוץ חתיכות זהות לצביעה
    // חתיכות: הוסבו קודם לס"מ (מטרי) או אינץ' (אימפריאלי) לתצוגה בטבלה.
    // לציור נדרש אותו בסיס יחידה של total: m באופציה מטרית, inch באימפריאלית.
        const pieces = r.cutsDisp.map(v => {
            const val = Number(v);
            if (!isFinite(val)) return 0;
            if (unitSystem === 'imperial') return val; // כבר באינץ'
            // במטרי: החתיכות בטבלה בס"מ -> המר למטר
            return val / 100; // cm -> m
        });
    const groups = {};
    const keyFor = (lenInScale) => formatSmart(unitSystem==='imperial' ? lenInScale : (lenInScale*100));
    pieces.forEach(v=>{ const k = keyFor(v); groups[k] = true; });
    const palette = ['#dfe8d8','#e9e2d0','#e8d9d4','#dbe7e5','#e8e3ef','#f2e6de'];
    const groupColor = {}; let gi=0; Object.keys(groups).forEach(k=>{groupColor[k]=palette[gi%palette.length];gi++;});
        // kerf בפועל: 3 מ"מ -> מומרים ליחידת הסקייל (מ' במטרי / אינץ' באימפריאלי) ואז לפיקסלים
        const kerfMMConst = 3;
        const kerfUnits = unitSystem==='imperial' ? (kerfMMConst/25.4) : (kerfMMConst/1000); // inch או meters
        const kerfPx = kerfUnits * scale; // מרווח kerf בפיקסלים
            const rects = [];
            let clipDefs = [];
                const defsBase = `
                    <pattern id="${svgId}_wasteHatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="8" stroke="#c8c8c8" stroke-width="2" />
                    </pattern>`;
            // רקע ברירת מחדל לכל אזור הקורה — כמו פחת (כדי שהשוליים יראו כרקע פחת)
            const barY = Math.round(10 * m);
            const barH = Math.round(40 * m);
            rects.push(`<rect x="0" y="${barY}" width="${w}" height="${barH}" fill="#f3f3f3" />`);
            rects.push(`<rect x="0" y="${barY}" width="${w}" height="${barH}" fill="url(#${svgId}_wasteHatch)" />`);
    const unitShort = unitSystem==='imperial' ? '″' : (language==='he' ? 'ס״מ' : 'cm');
    const showLabels = !!displaySettings.showPieceLabels;
    // פונקציית עזר: גודל פונט אחיד ועקבי לפי גובה החתיכה
    const clamp = (v,min,max) => Math.min(max, Math.max(min, v));
    const baseFS = clamp(Math.round((Math.max(1, Math.round(40 * m))) * 0.35), 12, 20); // מבוסס על ברירת המחדל ~barH
    const fsLarge = baseFS;
    const fsMed = Math.max(11, Math.round(baseFS * 0.9));
    const fsSmall = Math.max(10, Math.round(baseFS * 0.8));
    // גופן זהה לטבלאות
    const fontFamily = (language==='he')
        ? "'Noto Sans Hebrew Variable', system-ui, -apple-system, 'Segoe UI', Roboto, Arial"
        : "'Josefin Sans Variable', 'Rubik', system-ui, -apple-system, 'Segoe UI', Roboto, Arial";
    const fontFamilyAttr = `font-family="${fontFamily}"`;
    const plateApproxTextWidth = (txt, fs) => (String(txt||'').length * fs * 0.6);
    // ...
        for (let i=0;i<pieces.length;i++) {
            const pw = Math.max(0.5, (pieces[i]*scale)); // ללא עיגול כדי למנוע הצטברות שגיאה
            const key = keyFor(pieces[i]); // קיבוץ לפי גודל בתצוגה
            const fillColor = displaySettings.colorPieces ? (groupColor[key]) : '#ffffff';
            // Align piece rectangles exactly with the beam bar (top and height)
            rects.push(`<rect x="${x}" y="${barY}" width="${pw}" height="${barH}" fill="${fillColor}" stroke="#cfd4da" />`);
            // טקסט: בפנים, ממורכז אנכית ואופקית
            const labelVal = unitSystem==='imperial' ? pieces[i] : (pieces[i]*100); // inch או cm
            const numStr = `${formatSmart(labelVal)}`;
            const unitStr = `${unitShort}`;
            const centerX = x + pw/2;
            const clipId = `${svgId}_clip_${i}`;
            clipDefs.push(`<clipPath id="${clipId}"><rect x="${x}" y="${barY}" width="${pw}" height="${barH}" /></clipPath>`);
            if (showLabels) {
                const weightAttr = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
                if (pw >= 86) {
                    const yMid = barY + barH/2;
                    const LRI='\u2066', PDI='\u2069', NBSP='\u00A0';
                    const label = unitSystem==='imperial'
                        ? `${numStr}${unitShort}`
                        : (language==='he' ? `${unitStr}${NBSP}${LRI}${numStr}${PDI}` : `${numStr} ${unitShort}`);
                    rects.push(`<text ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${centerX}" y="${yMid}" font-size="${fsLarge}" text-anchor="middle" dominant-baseline="middle" fill="#333">${label}</text>`);
                } else if (pw >= 42) {
                    const yMid = barY + barH/2;
                    const LRI='\u2066', PDI='\u2069', NBSP='\u00A0';
                    // מצב ביניים: מספר בשורה ראשונה, יחידה בשורה שנייה
                    const numLine = `${LRI}${numStr}${PDI}`;
                    const unitLine = `${unitShort}`;
                    rects.push(`<text ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${centerX}" y="${yMid-6}" font-size="${fsMed}" text-anchor="middle" dominant-baseline="middle" fill="#333">${numLine}<tspan x="${centerX}" dy="14">${unitLine}</tspan></text>`);
                } else {
                    // תמיד בתוך החתיכה: הצג מספר (ועוד יחידה בעברית משמאל) במרכז, פונט קטן
                    const ySmall = barY + barH/2;
                    let label;
                    if (unitSystem==='imperial') {
                        label = `${numStr}`; // קטן מאוד: מספר בלבד
                    } else {
                        const LRI='\u2066', PDI='\u2069';
                        label = `${LRI}${numStr}${PDI}`; // מספר בלבד
                    }
                    rects.push(`<text ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${centerX}" y="${ySmall}" font-size="${fsSmall}" text-anchor="middle" dominant-baseline="middle" fill="#333">${label}</text>`);
                }
            }
            x += pw;
            if (i < pieces.length-1) {
                // kerf כמרווח שקוף — לא מציירים מלבן כהה, רק מזיזים את x
                x += kerfPx;
            }
        }
        // kerf אחרון בין החתיכה האחרונה לפחת
        if (pieces.length > 0) {
            x += kerfPx;
        }
        // פחת
        if (x < w) {
            const wasteW = Math.max(1, w - x);
            const wasteLenDisp = (w - x) / scale; // יחידות תצוגה
            const numStr = `${formatSmart(unitSystem==='imperial' ? wasteLenDisp : (wasteLenDisp*100))}`;
            const unitStr = `${unitShort}`;
            const centerX = x + wasteW/2;
            const clipIdW = `${svgId}_clip_waste`;
            clipDefs.push(`<clipPath id="${clipIdW}"><rect x="${x}" y="${barY}" width="${wasteW}" height="${barH}" /></clipPath>`);
            if (showLabels) {
                const weightW = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
                if (wasteW >= 86) {
                    const yMid = barY + barH/2;
                    const LRI='\u2066', PDI='\u2069', NBSP='\u00A0';
                    const label = unitSystem==='imperial' ? `${numStr}${unitShort}` : (language==='he' ? `${unitStr}${NBSP}${LRI}${numStr}${PDI}` : `${numStr} ${unitShort}`);
                    rects.push(`<text ${weightW} ${fontFamilyAttr} clip-path="url(#${clipIdW})" x="${centerX}" y="${yMid}" font-size="${fsLarge}" text-anchor="middle" dominant-baseline="middle" fill="#666">${label}</text>`);
                } else if (wasteW >= 42) {
                    const yMid = barY + barH/2;
                    const LRI='\u2066', PDI='\u2069';
                    const numLine = `${LRI}${numStr}${PDI}`;
                    const unitLine = `${unitShort}`;
                    rects.push(`<text ${weightW} ${fontFamilyAttr} clip-path="url(#${clipIdW})" x="${centerX}" y="${yMid-6}" font-size="${fsMed}" text-anchor="middle" dominant-baseline="middle" fill="#666">${numLine}<tspan x="${centerX}" dy="14">${unitLine}</tspan></text>`);
                } else {
                    const ySmall = barY + barH/2;
                    let label;
                    if (unitSystem==='imperial') {
                        label = `${numStr}`;
                    } else {
                        const LRI='\u2066', PDI='\u2069';
                        label = `${LRI}${numStr}${PDI}`;
                    }
                    rects.push(`<text ${weightW} ${fontFamilyAttr} clip-path="url(#${clipIdW})" x="${centerX}" y="${ySmall}" font-size="${fsSmall}" text-anchor="middle" dominant-baseline="middle" fill="#666">${label}</text>`);
                }
            }
        }
        // קו עדין לכל רוחב המסך + טקסט אורך קורה ממורכז מעל הקו
    const beamLenLbl = (function(){
        if (unitSystem==='imperial') return `${formatSmart(total)}${unitShort}`;
        const LRI='\u2066', PDI='\u2069', NBSP='\u00A0';
        const n = `${formatSmart(total*100)}`;
    return (language==='he') ? `${unitShort}${NBSP}${LRI}${n}${PDI}` : `${n} ${unitShort}`;
    })();
    const lineY = isMobile ? (barY + barH + 20) : 70;
    // קו דק רציף לכל רוחב המסך עם רווח מתחת לטקסט
    const txt = beamLenLbl;
    const approxTextW = Math.max(60, txt.length * 7); // הערכת רוחב טקסט לפונט 12px
    const gap = approxTextW + 16; // רווח כולל מרווחי צד
    const halfGap = gap / 2;
    const center = w / 2;
    const leftX2 = Math.max(0, center - halfGap);
    const rightX1 = Math.min(w, center + halfGap);
    const baseLineLeft = showLabels ? `<line x1="0" y1="${lineY}" x2="${leftX2}" y2="${lineY}" stroke="#ccc" stroke-width="1" />` : '';
    const baseLineRight = showLabels ? `<line x1="${rightX1}" y1="${lineY}" x2="${w}" y2="${lineY}" stroke="#ccc" stroke-width="1" />` : '';
    const weightBase = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
    const rulerText = showLabels ? `<text ${weightBase} ${fontFamilyAttr} x="${center}" y="${lineY-2}" font-size="13" text-anchor="middle" fill="#444">${beamLenLbl}</text>` : '';
    const defs = `<defs>${defsBase}${clipDefs.join('')}</defs>`;
    return `<svg class="diagram" data-kind="beam" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${defs}${rects.join('')}${baseLineLeft}${baseLineRight}${rulerText}</svg>`;
    }

    function plateSvg(p) {
        // ציור פרופורציונלי לפלטה ולחלקים שעליה
    const viewW = 1000, viewH = 600;
    const svgId = `svg_${svgIdCounter++}`;
    const showLabels = !!displaySettings.showPieceLabels;
    // אחידות גודל פונט בין פלטות לקורות: נגזור מגובה תא ממוצע
    const clamp = (v,min,max) => Math.min(max, Math.max(min, v));
    const baseFS = clamp(Math.round(80 * 0.28), 12, 20); // יעד קריאות מיידי
    const fsLarge = baseFS;
    const fsMed = Math.max(11, Math.round(baseFS * 0.9));
    const fsSmall = Math.max(10, Math.round(baseFS * 0.8));
    // גופן זהה לטבלאות
    const fontFamily = (language==='he')
        ? "'Noto Sans Hebrew Variable', system-ui, -apple-system, 'Segoe UI', Roboto, Arial"
        : "'Josefin Sans Variable', 'Rubik', system-ui, -apple-system, 'Segoe UI', Roboto, Arial";
    const fontFamilyAttr = `font-family="${fontFamily}"`;
        let PW = p.plateWmm || toMM(p.width, inventoryUnits[getWidthColIndex()]||'');
        let PH = p.plateHmm || toMM(p.length, inventoryUnits[getLengthColIndex()]||'');
        // וודא שהצלע הארוכה לרוחב
        let rotated = false;
        if (PH > PW) { const tmp = PW; PW = PH; PH = tmp; rotated = true; }
        const scale = PW>0 ? (viewW / PW) : 1;
        const platePxW = viewW;
    const platePxH = Math.max(80, Math.min(viewH, Math.round(PH * scale)));
    const extraBottom = 26; // מקום לטקסט מחוץ לפלטה
        const rects = [];
        // רקע פחת
        const defs = `
            <defs>
                <pattern id="${svgId}_wasteHatchPlate" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#c8c8c8" stroke-width="2" />
                </pattern>
            </defs>`;
        rects.push(`<rect x="0" y="0" width="${platePxW}" height="${platePxH}" fill="#f3f3f3" stroke="#cfd4da" />`);
        rects.push(`<rect x="0" y="0" width="${platePxW}" height="${platePxH}" fill="url(#${svgId}_wasteHatchPlate)" />`);
    // צבעי פסטל וקבוצות זהות (לפי מידות מקוריות mm)
        const palette = ['#dfe8d8','#e9e2d0','#e8d9d4','#dbe7e5','#e8e3ef','#f2e6de'];
        const groups = {};
        const keyFor = (wmm,hmm) => `${Math.round(wmm)}x${Math.round(hmm)}`;
        (p.placed||[]).forEach(pc=> { groups[keyFor(pc.srcW, pc.srcH)] = true; });
        const groupColor = {}; let gi=0; Object.keys(groups).forEach(k=>{groupColor[k]=palette[gi%palette.length];gi++;});
    // ציור החלקים לפי מיקום; אם הפלטה הוחלפה לרוחב, סובב קואורדינטות
        (p.placed||[]).forEach((pc, i) => {
            let x = pc.x, y = pc.y, wmm = pc.w, hmm = pc.h;
            if (rotated) { // החלפה כדי לשמור על יחס גאומטרי כשהצלע הארוכה לרוחב
                x = pc.y; y = pc.x; wmm = pc.h; hmm = pc.w;
            }
            const px = x * scale, py = y * scale, pw = Math.max(0.5, wmm * scale), ph = Math.max(0.5, hmm * scale);
            const key = keyFor(pc.srcW, pc.srcH);
            const clipId = `${svgId}_plate_clip_${i}`;
            rects.push(`<defs><clipPath id="${clipId}"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" /></clipPath></defs>`);
            const fillColor = displaySettings.colorPieces ? (groupColor[key]||'#eaf4ea') : '#ffffff';
            rects.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${fillColor}" stroke="#cfd4da" />`);
            // תווית מרכזית: רוחב×אורך של החתיכה בפועל (w×h), לא ממד מקור, ביחידות ס"מ/אינץ'
            const wDisp = unitSystem==='imperial' ? (wmm/25.4) : (wmm/10);
            const hDisp = unitSystem==='imperial' ? (hmm/25.4) : (hmm/10);
            const unitLbl = unitSystem==='imperial' ? '″' : (language==='he'?'ס״מ':'cm');
            const LRI='\u2066', PDI='\u2069', NBSP='\u00A0';
            const wNum = `${formatSmart(wDisp)}`;
            const hNum = `${formatSmart(hDisp)}`;
            // Wide-case: Hebrew metric — show lengthXwidth then a space and grouped units at the end (e.g., "30X20 ס״מ*ס״מ").
            const label = (unitSystem==='imperial')
                ? `${wNum}${unitLbl}×${hNum}${unitLbl}`
                : (language==='he'
                    ? `${LRI}${hNum}${PDI}X${LRI}${wNum}${PDI}${NBSP}${unitLbl}*${unitLbl}`
                    : `${wNum}×${hNum} ${unitLbl}`);
            const cx = px + pw/2, cy = py + ph/2;
            // הערכת התאמה לפי רוחב משוער וטקסט
            const margin = 8;
            const labelNumsOnly = (language==='he') ? `${LRI}${hNum}${PDI}X${LRI}${wNum}${PDI}` : `${wNum}×${hNum}`;
            const labelUnits = (unitSystem==='imperial') ? `${unitLbl}×${unitLbl}` : (language==='he' ? `${unitLbl}*${unitLbl}` : `${unitLbl}×${unitLbl}`);
            const wideOK = (approxTextWidthPlate(label, fsLarge) <= (pw - margin)) && (ph >= fsLarge * 1.2);
            const mediumOK = (approxTextWidthPlate(labelNumsOnly, fsMed) <= (pw - margin)) && (ph >= fsMed * 2.0);
        if (displaySettings.showPieceLabels) {
                const weightAttr = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
                if (wideOK) {
            const dirAttr = (language==='he') ? ' direction="rtl"' : '';
            rects.push(`<text${dirAttr} ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${cx}" y="${cy}" font-size="${fsLarge}" text-anchor="middle" dominant-baseline="middle" fill="#333">${label}</text>`);
                } else if (mediumOK) {
                    // שני קווים: שורת מספרים (אורךXרוחב) ואז שורת יחידות
                    const numsLine = labelNumsOnly;
                    const unitsLine = labelUnits;
            const dirAttr = (language==='he') ? ' direction="rtl"' : '';
            rects.push(`<text${dirAttr} ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${cx}" y="${cy-6}" font-size="${fsMed}" text-anchor="middle" dominant-baseline="middle" fill="#333">${numsLine}<tspan x="${cx}" dy="14">${unitsLine}</tspan></text>`);
                } else {
                    // קטן מאוד: רק מספרים (אורךXרוחב)
                    const numsOnly = labelNumsOnly;
            const dirAttr = (language==='he') ? ' direction="rtl"' : '';
            rects.push(`<text${dirAttr} ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${cx}" y="${cy}" font-size="${fsSmall}" text-anchor="middle" dominant-baseline="middle" fill="#333">${numsOnly}</text>`);
                }
            }
        });
    // ציור והצגת מידות לכל מלבן פחת (freeRects)
        if (Array.isArray(p.freeRects) && p.freeRects.length) {
            for (let i=0;i<p.freeRects.length;i++) {
                const fr = p.freeRects[i];
                if (!fr || fr.w <= 0 || fr.h <= 0) continue;
                let x = fr.x, y = fr.y, wmm = fr.w, hmm = fr.h;
                if (rotated) { x = fr.y; y = fr.x; wmm = fr.h; hmm = fr.w; }
                const px = x * scale, py = y * scale, pw = wmm * scale, ph = hmm * scale;
                // מסגרת עדינה סביב אזור הפחת
                rects.push(`<rect x="${px}" y="${py}" width="${Math.max(0.5,pw)}" height="${Math.max(0.5,ph)}" fill="none" stroke="#bdbdbd" stroke-width="1" />`);
                // תוויות מידות לפי יחידות תצוגה (ס"מ או אינץ')
                if (showLabels) {
                    const inchSym = '″';
                    const wDisp = unitSystem==='imperial' ? (wmm/25.4) : (wmm/10);
                    const hDisp = unitSystem==='imperial' ? (hmm/25.4) : (hmm/10);
                    const unitLbl = unitSystem==='imperial' ? inchSym : (language==='he'?'ס״מ':'cm');
                    const LRI='\u2066', PDI='\u2069', NBSP='\u00A0';
                    const wNum = `${formatSmart(wDisp)}`;
                    const hNum = `${formatSmart(hDisp)}`;
                    const labelInline = (unitSystem==='imperial')
                        ? `${wNum}${inchSym}×${hNum}${inchSym}`
                        : (language==='he'
                            ? `${LRI}${hNum}${PDI}X${LRI}${wNum}${PDI}${NBSP}${unitLbl}*${unitLbl}`
                            : `${wNum}×${hNum} ${unitLbl}`);
                    const cx = px + pw/2, cy = py + ph/2;
                    const margin = 8;
                    const numsOnly = (language==='he') ? `${LRI}${hNum}${PDI}X${LRI}${wNum}${PDI}` : `${wNum}×${hNum}`;
                    const unitsOnly = unitSystem==='imperial' ? `${inchSym}×${inchSym}` : (language==='he' ? `${unitLbl}*${unitLbl}` : `${unitLbl}×${unitLbl}`);
                    const wideOK = (approxTextWidthPlate(labelInline, fsLarge) <= (pw - margin)) && (ph >= fsLarge * 1.2);
                    const mediumOK = (approxTextWidthPlate(numsOnly, fsMed) <= (pw - margin)) && (ph >= fsMed * 2.0);
                    const weightAttr = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
                    const color = '#555';
                    if (wideOK) {
                        const dirAttr = (language==='he') ? ' direction="rtl"' : '';
                        rects.push(`<text${dirAttr} ${weightAttr} ${fontFamilyAttr} x="${cx}" y="${cy}" font-size="${fsLarge}" text-anchor="middle" dominant-baseline="middle" fill="${color}">${labelInline}</text>`);
                    } else if (mediumOK) {
                        const numsLine = numsOnly;
                        const unitsLine = unitsOnly;
                        const dirAttr = (language==='he') ? ' direction="rtl"' : '';
                        rects.push(`<text${dirAttr} ${weightAttr} ${fontFamilyAttr} x="${cx}" y="${cy-6}" font-size="${fsMed}" text-anchor="middle" dominant-baseline="middle" fill="${color}">${numsLine}<tspan x="${cx}" dy="14">${unitsLine}</tspan></text>`);
                    }
                }
            }
        }
    // תווית מידות הפלטה מחוץ לפלטה, במרכז למטה
    const plateSizeLbl = unitSystem==='imperial'
        ? `${formatSmart(PW/25.4)}″×${formatSmart(PH/25.4)}″`
        : `${formatSmart(PW/1000)}×${formatSmart(PH/1000)} ${language==='he' ? 'מ׳*מ׳' : 'm*m'}`;
    const weightSize = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
    const sizeText = `<text ${weightSize} x="${platePxW/2}" y="${platePxH + extraBottom - 8}" font-size="13" text-anchor="middle" fill="#444">${plateSizeLbl}</text>`;
    return `<svg class="diagram" viewBox="0 0 ${viewW} ${platePxH + extraBottom}" preserveAspectRatio="none">${defs}${rects.join('')}${sizeText}</svg>`;
    }

    const title1 = language==='he' ? 'חיתוכים' : 'Cuts';
    const title2 = language==='he' ? 'עלויות' : 'Costs';
    const title3 = language==='he' ? 'עצים לרכישה' : 'Items to Purchase';
        area.innerHTML = `
            <div class="results-section"><h3>${title1}</h3><div class="x-scroll">${table1()}</div></div>
            <div class="results-section"><h3>${title2}</h3><div class="x-scroll">${table2()}</div></div>
            <div class="results-section"><h3>${title3}</h3><div class="x-scroll">${table3()}</div></div>
            <div class="results-section"><div class="x-scroll"><div style="overflow-y:visible; touch-action:pan-x pan-y">${diagrams()}</div></div></div>
        `;
    // Ensure all horizontal wrappers start at x=0
    try {
        // Results tables are LTR; keep horizontal scroll anchored at start
        area.querySelectorAll('.x-scroll').forEach(sc => { sc.scrollLeft = 0; });
    } catch(_) {}

    // Show calculation errors in a full-screen modal with an OK button
        try {
            const root = document.body;
            const prev = document.getElementById('global-error-modal');
            if (prev) prev.remove();
            if (Array.isArray(results.errors) && results.errors.length) {
                const msgs = results.errors.map(e=>`<div>• ${e}</div>`).join('');
                const okLbl = (language==='he') ? 'אישור' : ((translations[language] && translations[language].ok) ? translations[language].ok : 'OK');
                const title = language==='he' ? 'שגיאות בחישוב' : 'Calculation Errors';
                const modalHtml = `
                    <div id="global-error-modal" class="global-modal" role="dialog" aria-modal="true" aria-labelledby="global-modal-title">
                        <div class="global-modal-backdrop"></div>
                        <div class="global-modal-box">
                            <h3 id="global-modal-title" class="global-modal-title">${title}</h3>
                            <div class="global-modal-body" style="color:#000">${msgs}</div>
                            <div class="global-modal-actions"><button id="global-modal-ok" class="btn primary">${okLbl}</button></div>
                        </div>
                    </div>`;
                root.insertAdjacentHTML('beforeend', modalHtml);
                const modal = document.getElementById('global-error-modal');
                const close = () => { try { modal && modal.remove(); } catch(_){} };
                modal?.querySelector('#global-modal-ok')?.addEventListener('click', close);
                modal?.querySelector('.global-modal-backdrop')?.addEventListener('click', close);
                document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onKey); } });
            }
        } catch{}

    // אירועי הגדרות תצוגה
    const dsBtn = document.getElementById('btn-display-settings');
    const dsPanel = document.getElementById('display-settings-panel');
    if (dsBtn && dsPanel) dsBtn.addEventListener('click', () => {
        displaySettings.panelOpen = !displaySettings.panelOpen;
        saveData('displaySettings', displaySettings);
        dsPanel.style.display = displaySettings.panelOpen ? 'flex' : 'none';
    });
    const dsColor = document.getElementById('ds-color');
    const dsColorSwitch = document.getElementById('ds-color-switch');
    const dsFont = document.getElementById('ds-font');
    const dsLabels = document.getElementById('ds-labels');
    const dsLabelsSwitch = document.getElementById('ds-labels-switch');
    const reRender = () => { const res2 = computeOptimization(); renderResults(res2); };
    if (dsColor) dsColor.addEventListener('change', () => { displaySettings.colorPieces = !!dsColor.checked; saveData('displaySettings', displaySettings); reRender(); });
    if (dsColorSwitch) dsColorSwitch.addEventListener('click', () => { displaySettings.colorPieces = !displaySettings.colorPieces; saveData('displaySettings', displaySettings); reRender(); });
    if (dsFont) dsFont.addEventListener('change', () => { displaySettings.fontWeight = dsFont.value==='bold'?'bold':'regular'; saveData('displaySettings', displaySettings); reRender(); });
    if (dsLabels) dsLabels.addEventListener('change', () => { displaySettings.showPieceLabels = !!dsLabels.checked; saveData('displaySettings', displaySettings); reRender(); });
    if (dsLabelsSwitch) dsLabelsSwitch.addEventListener('click', () => { displaySettings.showPieceLabels = !displaySettings.showPieceLabels; saveData('displaySettings', displaySettings); reRender(); });
}

// חלון קופץ פשוט עם כפתור אישור
function showSimpleModal(message, title) {
    try {
        const root = document.body;
        // סגור חלונות קודמים
        document.getElementById('global-error-modal')?.remove();
        document.getElementById('global-info-modal')?.remove();
        const okLbl = (language==='he') ? 'אישור' : ((translations[language] && translations[language].ok) ? translations[language].ok : 'OK');
        const titleText = title || (language==='he' ? 'הודעה' : 'Notice');
    const modalHtml = `
            <div id="global-info-modal" class="global-modal" role="dialog" aria-modal="true" aria-labelledby="global-info-title">
                <div class="global-modal-backdrop"></div>
                <div class="global-modal-box">
                    <h3 id="global-info-title" class="global-modal-title">${titleText}</h3>
            <div class="global-modal-body" style="color:#000">${message}</div>
                    <div class="global-modal-actions"><button id="global-info-ok" class="btn primary">${okLbl}</button></div>
                </div>
            </div>`;
        root.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('global-info-modal');
        const close = () => { try { modal && modal.remove(); } catch(_){} };
        modal?.querySelector('#global-info-ok')?.addEventListener('click', close);
        modal?.querySelector('.global-modal-backdrop')?.addEventListener('click', close);
        document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onKey); } });
    } catch(_) {}
}

// Center Block 1 title and actions when there are no requirement rows
function updateReqEmptyState() {
    try {
        const block = document.getElementById('block-req');
        const list = document.getElementById('requirements-list');
        if (!block || !list) return;
        const hasRows = !!list.querySelector('.req-row');
        block.classList.toggle('center-empty', !hasRows);
    } catch (_) {}
}

// הוספת שורת דרישה לבלוק הדרישות
function addRequirementRow() {
        const list = document.getElementById('requirements-list');
        if (!list) return;
        const row = document.createElement('div');
        row.className = 'req-row';
        const types = getUniqueTypes();
        const typeOptions = [`<option value="">${language === 'he' ? 'סוג' : 'Type'}</option>`]
                .concat(types.map(t => `<option value="${t}">${t}</option>`)).join('');
    const thIdx = getThicknessColIndex();
    const thUnit = thIdx >= 0 ? (inventoryUnits[thIdx] || '') : '';
            row.innerHTML = `
            <select data-field="type">${typeOptions}</select>
            <select data-field="thickness" disabled>
        <option value="">${language === 'he' ? `עובי (מ״מ)` : `Thickness (mm)`}</option>
            </select>
            <select data-field="width" disabled>
                <option value="">${language === 'he' ? 'רוחב' : 'Width'}</option>
            </select>
                <input data-field="length" type="number" min="0" placeholder="${language === 'he' ? (unitSystem==='imperial'?'אורך (אינץ׳)':'אורך (ס״מ)') : (unitSystem==='imperial'?'Length (inch)':'Length (cm)')}" />
            <input data-field="qty" type="number" min="1" placeholder="${language === 'he' ? 'כמות' : 'Qty'}" />
            <button class="btn small btn-remove" title="Remove">✖</button>
        `;
    const removeBtn = row.querySelector('button');
    if (removeBtn) removeBtn.addEventListener('click', () => { row.remove(); try { updateReqEmptyState(); } catch(_){} });
    list.appendChild(row);
    try { updateReqEmptyState(); } catch(_){}
}

// אירועים (מותאמים ל-HTML הנוכחי, עם בדיקות קיום אלמנטים)
const btnLang = document.getElementById('btn-lang');
if (btnLang && !window.__siteGlobal) btnLang.addEventListener('click', () => {
    const next = language === 'he' ? 'en' : 'he';
    switchLanguage(next);
    btnLang.textContent = next === 'he' ? 'english' : 'עברית';
});

const btnCurrency = document.getElementById('btn-currency');
if (btnCurrency && !window.__siteGlobal) {
    const cycle = ['€', '₪', '$'];
    // אתחול תצוגה משמירה קודמת
    const savedSymbol = loadData('currencySymbol') || (inventoryPriceCurrencyUnit || '€');
    btnCurrency.textContent = savedSymbol;
    btnCurrency.addEventListener('click', () => {
        const curSym = btnCurrency.textContent.trim();
        const idx = cycle.indexOf(curSym);
        const nextSym = cycle[(idx + 1) % cycle.length];
        btnCurrency.textContent = nextSym;
        saveData('currencySymbol', nextSym);
        switchCurrency(nextSym);
    });
}

const btnUnits = document.getElementById('btn-units');
if (btnUnits && !window.__siteGlobal) {
    // אתחל תווית לפי מצב שמור
    btnUnits.textContent = unitSystem === 'metric' ? 'm' : 'inch';
    btnUnits.addEventListener('click', () => {
        // Toggle metric/imperial
        unitSystem = unitSystem === 'metric' ? 'imperial' : 'metric';
        saveData('unitSystem', unitSystem);
        btnUnits.textContent = unitSystem === 'metric' ? 'm' : 'inch';
        // Convert saw thickness value
        const sawInput = document.getElementById('saw-thickness');
        const sawUnit = document.getElementById('saw-unit');
    if (sawInput && sawUnit) {
            const current = Number(sawInput.value || 0);
            if (isFinite(current)) {
                const converted = unitSystem === 'imperial' ? (current / 25.4) : (current * 25.4);
        sawInput.value = (unitSystem === 'imperial' ? converted.toFixed(3) : Math.round(converted));
        const he = language === 'he';
        sawUnit.textContent = unitSystem === 'imperial' ? (he ? 'אינץ׳' : 'inch') : (he ? 'מ״מ' : 'mm');
            } else {
        const he = language === 'he';
        sawUnit.textContent = unitSystem === 'imperial' ? (he ? 'אינץ׳' : 'inch') : (he ? 'מ״מ' : 'mm');
            }
        }
        // Re-render inventory and refresh requirement fields/labels
        renderInventoryTable();
        document.querySelectorAll('.req-row').forEach(row => {
            const typeSel = row.querySelector('select[data-field="type"]');
            const thSel = row.querySelector('select[data-field="thickness"]');
            const wEl = row.querySelector('[data-field="width"]');
            const lenEl = row.querySelector('input[data-field="length"]');
            if (typeSel) typeSel.dispatchEvent(new Event('change'));
            if (thSel && thSel.value) thSel.dispatchEvent(new Event('change'));
            if (wEl && wEl.tagName.toLowerCase() === 'input') {
                wEl.placeholder = language === 'he'
                    ? (unitSystem === 'metric' ? 'רוחב (ס״מ)' : 'רוחב (אינץ׳)')
                    : (unitSystem === 'metric' ? 'Width (cm)' : 'Width (inch)');
            }
            if (lenEl) {
                lenEl.placeholder = language === 'he'
                    ? (unitSystem === 'metric' ? 'אורך (ס״מ)' : 'אורך (אינץ׳)')
                    : (unitSystem === 'metric' ? 'Length (cm)' : 'Length (inch)');
            }
        });
    });
}

const addReqBtn = document.getElementById('add-req');
if (addReqBtn) {
    addReqBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // אם המאגר ריק — הצג הודעה במקום הוספת שורת דרישה
        const isInvEmpty = !Array.isArray(inventoryData) || inventoryData.length === 0;
        if (isInvEmpty) {
            const msg = (language==='he')
                ? 'מאגר העצים ריק, ראשית יש לטעון קובץ מאגר או להזין ידנית'
                : 'The inventory is empty. Please load a file or enter items manually first.';
            showSimpleModal(msg);
            return;
        }
        if (window.__addingReq) return;
        window.__addingReq = true;
        try { addRequirementRow(); } finally { setTimeout(()=>{ window.__addingReq = false; }, 0); }
    }, { capture: true });
}

// Initialize centered empty-state on load
try { updateReqEmptyState(); } catch(_){}

// תוצאה בסיסית: הדגמת חישוב 1D (מינימלי) ותצוגה
function gatherRequirements() {
    const rows = Array.from(document.querySelectorAll('#requirements-list .req-row'));
    return rows.map(r => ({
        type: r.querySelector('select[data-field="type"]')?.value || '',
        thickness: r.querySelector('select[data-field="thickness"]')?.value || '',
        width: (r.querySelector('[data-field="width"]')?.value) || '',
        length: Number(r.querySelector('input[data-field="length"]')?.value || 0),
        qty: Number(r.querySelector('input[data-field="qty"]')?.value || 1)
    })).filter(x => x.type && x.length > 0 && x.qty > 0);
}

function renderResultsPlaceholder(summary) {
    const area = document.getElementById('results-area');
    if (!area) return;
    const cur = document.getElementById('btn-currency')?.textContent?.trim() || inventoryPriceCurrencyUnit || '';
    const unitLen = unitSystem === 'imperial' ? 'inch' : 'm';
    area.innerHTML = `
      <div class="results-section">
        <h3>${language === 'he' ? 'סיכום זמני' : 'Temporary Summary'}</h3>
        <p>${language === 'he' ? 'מספר דרישות:' : 'Requirements:'} ${summary.reqCount}</p>
        <p>${language === 'he' ? 'אורך כולל:' : 'Total length:'} ${summary.totalLenDisp} ${unitLen}</p>
        <p>${language === 'he' ? 'עלות (הדגמה, המרה לתצוגה בלבד):' : 'Cost (demo, display conversion only):'} ${formatNumber(summary.costDisp)} ${cur}</p>
      </div>`;
}

const calcBtn = document.getElementById('calc-opt');
if (calcBtn) calcBtn.addEventListener('click', () => {
    // אין דרישות? הצג הודעה ואל תחשב
    const reqs = gatherRequirements();
    if (!Array.isArray(reqs) || reqs.length === 0) {
        const msg = (language==='he')
            ? 'יש להזין דרישות לפרויקט טרם החישוב'
            : 'Please enter project requirements before computing.';
        showSimpleModal(msg);
        return;
    }
    // Show loader overlay and run Lottie (or spinner) for at least 2 seconds
    const overlay = document.getElementById('loader-overlay');
    const lottieEl = document.getElementById('lottie-container');
    const spinner = document.getElementById('spinner-fallback');
    const loaderText = document.getElementById('loader-text');
    const mainEl = document.querySelector('main');
    let anim = null;
    const showLoader = () => {
    overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden','false');
    if (mainEl) mainEl.setAttribute('aria-busy','true');
    // Default: show spinner until Lottie signals DOMLoaded
    if (spinner) spinner.style.display = '';
    if (lottieEl) lottieEl.style.display = 'none';
    if (loaderText) loaderText.textContent = language === 'he' ? 'מחשב אופטימיזציה…' : 'Computing optimization…';
        // If lottie is available, try to load; otherwise keep spinner
        if (typeof lottie !== 'undefined' && lottieEl) {
            try {
                // Prefer inline animation data if provided (avoid XHR on file://)
                const inlineAnim = (typeof window !== 'undefined' && window.LOADER_ANIM) ? window.LOADER_ANIM : null;
                const hasInline = !!inlineAnim;
                if (location && location.protocol === 'file:' && !hasInline) {
                    try { console.warn('Lottie: running from file:// may block JSON via XHR. Use a local server or provide window.LOADER_ANIM inline.'); } catch(e){}
                }
                const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                let triedAlt = false;

                const startLottie = (source) => {
                    if (!lottieEl) return;
                    // Clean previous attempt
                    if (anim) { try { anim.destroy(); } catch(e){} anim = null; }
                    const cfg = {
                        container: lottieEl,
                        renderer: 'svg',
                        loop: prefersReduced ? false : true,
                        autoplay: true
                    };
                    const opts = (source === 'inline')
                        ? { animationData: inlineAnim }
                        : { path: source };
                    anim = lottie.loadAnimation({ ...cfg, ...opts });
                    anim.addEventListener('DOMLoaded', () => {
                        if (spinner) spinner.style.display = 'none';
                        if (lottieEl) lottieEl.style.display = '';
                    });
                    anim.addEventListener('data_failed', () => {
                        // If Timberman failed and we haven't tried fallback, try loading.json next
                        if (!triedAlt && source === 'Timberman.json') {
                            triedAlt = true;
                            if (spinner) spinner.style.display = '';
                            startLottie('loading.json');
                            return;
                        }
                        if (spinner) spinner.style.display = '';
                        try { console.warn('Lottie failed to load animation from', source); } catch(e){}
                    });
                };

                // Prefer inline; otherwise try Timberman.json first, then fallback to loading.json
                startLottie(hasInline ? 'inline' : 'Timberman.json');
            } catch(e){ if (spinner) spinner.style.display = ''; }
        } else {
            if (spinner) spinner.style.display = '';
        }
    };
    const hideLoader = () => {
        if (!overlay) return;
    overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden','true');
    if (mainEl) mainEl.removeAttribute('aria-busy');
        if (anim) { try { anim.destroy(); } catch(e){} anim = null; }
        // Clear container to avoid overlaying multiple svgs on next run
    if (lottieEl) { lottieEl.innerHTML = ''; lottieEl.style.display = ''; }
    if (spinner) spinner.style.display = 'none';
    if (loaderText) loaderText.textContent = '';
    };
    const start = Date.now();
    showLoader();
    // Do the computation (sync), but enforce a min 2s animation
    const res = computeOptimization();
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, 2000 - elapsed);
    setTimeout(() => {
        renderResults(res);
        hideLoader();
        // Auto-scroll the Results block so the title is at the top of the viewport
        try {
            const resTitle = document.querySelector('#block-res h2');
            resTitle && resTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {}
    // Reset horizontal scroll positions inside results
    try { document.querySelectorAll('#results-area .x-scroll').forEach(sc => sc.scrollLeft = 0); } catch{}
    }, remaining);
});

const toggleDbBtn = document.getElementById('toggle-db');
if (toggleDbBtn) {
    // Accessibility wiring
    toggleDbBtn.setAttribute('aria-controls', 'db-area');
    toggleDbBtn.setAttribute('aria-expanded', 'false');
    toggleDbBtn.addEventListener('click', () => {
        const area = document.getElementById('db-area');
        if (!area) return;
    const nowHidden = area.classList.toggle('hidden');
        // Update button label and ARIA
        toggleDbBtn.textContent = nowHidden
            ? translations[language].showDb
            : (language === 'he' ? 'הסתר מאגר עצים' : 'Hide Inventory');
        toggleDbBtn.setAttribute('aria-expanded', String(!nowHidden));
        area.setAttribute('aria-hidden', String(nowHidden));
        // When opening, ensure the table (or an empty-state message) is rendered
        if (!nowHidden) {
            // אם אין קובץ טעון — זריעת טבלה ריקה עם יחידות ברירת מחדל
            try { ensureInventorySeeded(); } catch(_){ }
            // Always render to ensure fresh content
            try { renderInventoryTable(); } catch(e){}
            // Reset horizontal scroll to logical start on open (right in RTL, left in LTR)
            try {
                const dir = (document.documentElement && document.documentElement.dir === 'rtl') ? 'rtl' : 'ltr';
                const wrap = document.getElementById('db-table-wrap');
                if (wrap) scrollToStart(wrap, dir);
            } catch(_) {}
            // Bring DB block to top so title + buttons are visible and 50% viewport shows table rows
            try {
                const blockDb = document.getElementById('block-db');
                blockDb && blockDb.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch(_){ }
        }
    });
}

const addDbRowBtn = document.getElementById('add-db-row');
if (addDbRowBtn) addDbRowBtn.addEventListener('click', () => {
    // Always open the DB area
    const area = document.getElementById('db-area');
    const toggleDbBtn = document.getElementById('toggle-db');
    if (area) {
        area.classList.remove('hidden');
        area.setAttribute('aria-hidden','false');
        if (toggleDbBtn) {
            toggleDbBtn.textContent = (language === 'he' ? 'הסתר מאגר עצים' : 'Hide Inventory');
            toggleDbBtn.setAttribute('aria-expanded','true');
        }
    }
    // אם אין מאגר — זרע כותרות ויחידות ברירת מחדל כדי לאפשר הזנה ידנית
    ensureInventorySeeded();
    // Show a new editable row at the top
    showNewInventoryRow = true;
    renderInventoryTable();
    // Ensure user sees the DB section with 50% viewport allocated to the table area
    try {
        const blockDb = document.getElementById('block-db');
        blockDb && blockDb.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch(_){ }
});

const fileInput = document.getElementById('file-input');
if (fileInput) {
        // Ensure selecting the same file twice still triggers change
        fileInput.addEventListener('click', () => { try { fileInput.value = ''; } catch(_){} });
        fileInput.addEventListener('change', e => handleFile(e, data => {
    console.log('Loaded rows:', Array.isArray(data) ? data.length : 0);
    setInventoryFromArray2D(data);
    }));
}

// Visual feedback for project name save button
const projectNameOkBtn = document.getElementById('project-name-ok');
if (projectNameOkBtn) {
    projectNameOkBtn.addEventListener('click', () => {
        projectNameOkBtn.classList.add('saved');
        setTimeout(() => projectNameOkBtn.classList.remove('saved'), 2000);
    });
}

const exportBtn = document.getElementById('export-pdf');
if (exportBtn) exportBtn.addEventListener('click', async () => {
    try {
        const resultsSection = document.getElementById('block-res');
        const resultsArea = document.getElementById('results-area');
        if (!resultsSection || !resultsArea) return;
    const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFCtor || typeof window.html2canvas === 'undefined') return;

                // Build a temporary wrapper that includes the H2 title and ALL tables + diagrams
                const titleEl = resultsSection.querySelector('h2');
    const temp = document.createElement('div');
    temp.style.background = '#fff';
    temp.style.padding = '16px';
    // כפה פריסה "שולחנית" גם במובייל כדי למנוע חיתוך טבלאות
    temp.style.width = '1100px';
    temp.style.maxWidth = '1100px';
    temp.style.margin = '0 auto';
                // Make content responsive inside capture without overriding the site's fonts/colors
                const style = document.createElement('style');
                style.textContent = `
                    /* Avoid taint and keep visuals close to site */
                    #results-area, #results-area * { background-image: none !important; }
                    .diagram{width:100%;height:auto;border:none !important;border-radius:0 !important;padding:12px !important}
                    img{max-width:100%;height:auto}
                    h2{margin:10px 0 14px}
                    h3{margin:8px 0 10px}
                    /* Header logo size */
                    #pdf-header img{height:96px !important; max-width:270px !important; width:auto !important; display:block; margin:0 auto 8px}
                    #pdf-header svg{height:96px !important; width:auto !important; display:block; margin:0 auto 8px}
                `;
                temp.appendChild(style);

                // Header: centered logo and dynamic title
        const header = document.createElement('div');
    header.id = 'pdf-header';
    header.style.textAlign = 'center';
    header.style.marginBottom = '12px';
                                // Header logo
                                if (location.protocol === 'file:') {
                                        // Under file:// browsers block loading local images into canvas; use inline SVG fallback so header still shows
                                        const svgWrap = document.createElement('div');
                                        svgWrap.style.display = 'block';
                                        svgWrap.style.margin = '0 auto 8px';
                                        svgWrap.style.height = '96px';
                                        svgWrap.style.maxWidth = '270px';
                                        svgWrap.innerHTML = `
                                            <svg width="270" height="96" viewBox="0 0 180 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logo">
                                                <rect x="1" y="1" width="178" height="62" rx="10" fill="#ffffff" stroke="#4caf50" stroke-width="2"/>
                                                <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-weight="700" font-size="24" fill="#2e7d32">WOOD OPTIMIZER</text>
                                            </svg>`;
                                        header.appendChild(svgWrap);
                                } else {
                                        const headerImg = document.createElement('img');
                                        headerImg.alt = 'logo';
                                        headerImg.style.maxHeight = '96px';
                                        headerImg.style.height = '96px';
                                        headerImg.style.objectFit = 'contain';
                                        headerImg.style.display = 'block';
                                        headerImg.style.margin = '0 auto 8px';
                                        headerImg.style.maxWidth = '270px';
                                        headerImg.src = 'pics/logo.png';
                                        headerImg.onerror = () => { try { headerImg.src = 'pic/logo.png'; } catch(_){} };
                                        header.appendChild(headerImg);
                                }
    const projName = (document.getElementById('project-name')?.value || '').trim();
    // No hyphen between title and project name
    const pdfTitle = (language === 'he' ? 'פרויקט' : 'Project') + (projName ? ' ' + projName : '');
    const h = document.createElement('h2');
        h.textContent = pdfTitle;
    h.style.margin = '10px 0 0';
        h.style.textAlign = 'center';
        header.appendChild(h);

        temp.appendChild(header);
        // Clone ALL results content
                const clonedArea = resultsArea.cloneNode(true);
                // הגדלת גובה הקורה פי 2 ב-PDF: סקייל ל-diagram של קורות בלבד
                // שמירה על פרופורציות הדיאגרמות ב‑PDF; ללא מתיחה אנכית של קורות
                // Remove the display settings strip/panel from the export
                const ds = clonedArea.querySelector('#display-settings');
                if (ds) ds.remove();
                const dsp = clonedArea.querySelector('#display-settings-panel');
                if (dsp) dsp.remove();
                const dsBtn = clonedArea.querySelector('#btn-display-settings');
                if (dsBtn) dsBtn.remove();
                // Increase spacing and allow wide tables/diagrams to fit page in PDF
            const style2 = document.createElement('style');
        style2.textContent = `
                .results-section { margin: 0 0 42px 0 !important; }
                #results-area .x-scroll{ overflow: visible !important; }
                table { margin: 0 0 24px 0 !important; max-width: 100% !important; table-layout: auto !important; }
                thead, tbody, tr, th, td { box-sizing: border-box; }
                .diagram{ display:block !important; }
        `;
                temp.appendChild(style2);
                // Replace inline SVGs with PNG <img> to improve html2canvas reliability (esp. on mobile and file://)
                async function replaceSvgsWithImages(root){
                    const svgs = Array.from(root.querySelectorAll('svg.diagram'));
                    const tasks = svgs.map(svg => new Promise(resolve => {
                        try {
                            const xml = new XMLSerializer().serializeToString(svg);
                            const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
                            const viewBox = (svg.getAttribute('viewBox')||'').trim().split(/\s+/).map(Number);
                            let vbW = 1000, vbH = 200;
                            if (viewBox.length === 4 && viewBox.every(v=>isFinite(v))) {
                                vbW = Math.max(1, viewBox[2]);
                                vbH = Math.max(1, viewBox[3]);
                            }
                            // render SVG to offscreen canvas at 2x for crispness
                            const imgEl = new Image();
                            imgEl.crossOrigin = 'anonymous';
                            imgEl.onload = () => {
                                try {
                                    const canvas = document.createElement('canvas');
                                    const dpr = 2;
                                    canvas.width = Math.round(vbW * dpr);
                                    canvas.height = Math.round(vbH * dpr);
                                    const ctx = canvas.getContext('2d');
                                    ctx.clearRect(0,0,canvas.width,canvas.height);
                                    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
                                    const pngUrl = canvas.toDataURL('image/png');
                                    const img = document.createElement('img');
                                    img.className = 'diagram';
                                    const kind = svg.getAttribute('data-kind') || '';
                                    if (kind) img.setAttribute('data-kind', kind);
                                    img.alt = 'diagram';
                                    img.src = pngUrl;
                                    img.style.width = '100%';
                                    img.style.height = 'auto';
                                    svg.parentNode.replaceChild(img, svg);
                                } catch(_e) { /* fallback to inline svg as data url */
                                    try {
                                        const img = document.createElement('img');
                                        img.className = 'diagram';
                                        const kind = svg.getAttribute('data-kind') || '';
                                        if (kind) img.setAttribute('data-kind', kind);
                                        img.alt = 'diagram';
                                        img.src = svgUrl;
                                        img.style.width = '100%';
                                        img.style.height = 'auto';
                                        svg.parentNode.replaceChild(img, svg);
                                    } catch(_){}
                                } finally { resolve(); }
                            };
                            imgEl.onerror = () => { try { resolve(); } catch(_){} };
                            imgEl.src = svgUrl;
                        } catch(_) { resolve(); }
                    }));
                    try { await Promise.all(tasks); } catch(_){}
                }
                // Mark local images as CORS-anonymous and skip any remote images during capture
                Array.from(clonedArea.querySelectorAll('img')).forEach(img => {
                    try { if (!/^https?:/i.test(img.src)) img.crossOrigin = 'anonymous'; } catch(_){}
                });
                // Perform SVG->IMG replacement on the cloned content before capture
                await replaceSvgsWithImages(clonedArea);
                // התאמת טבלת חיתוכים (הראשונה) שתתאים לרוחב הדף – הקטנה דינמית
                try {
                    const allTables = Array.from(clonedArea.querySelectorAll('.results-section table'));
                    if (allTables.length) {
                        const st = document.createElement('style');
                        st.textContent = `.results-section table th, .results-section table td{ padding:6px 6px; }`;
                        temp.appendChild(st);
                        // allow layout to settle
                        await new Promise(r => setTimeout(r, 0));
                        for (const tbl of allTables) {
                            try {
                                tbl.style.maxWidth = 'none';
                                tbl.style.tableLayout = 'auto';
                                const wrapper = tbl.parentElement || clonedArea;
                                const natural = tbl.scrollWidth;
                                const available = wrapper.clientWidth || 1100;
                                let scale = 1;
                                if (natural > available) scale = available / natural;
                                scale = Math.max(0.6, Math.min(1, scale));
                                if (scale < 1) {
                                    tbl.style.transform = `scale(${scale})`;
                                    // לעקביות ומניעת חיתוך עמודות, תמיד עוגן משמאל
                                    tbl.style.transformOrigin = `top left`;
                                    tbl.style.display = 'inline-block';
                                    tbl.style.width = natural + 'px';
                                }
                            } catch(_inner){}
                        }
                    }
                } catch(_){ }
                temp.appendChild(clonedArea);
        document.body.appendChild(temp);

        // Ensure images in header/results are loaded before capture
        await new Promise(resolve => {
            const imgs = Array.from(temp.querySelectorAll('img'));
            let remaining = imgs.length;
            if (remaining === 0) return resolve();
            const done = () => { remaining--; if (remaining <= 0) resolve(); };
            imgs.forEach(i => {
                if (i.complete) return done();
                i.addEventListener('load', done, { once: true });
                i.addEventListener('error', done, { once: true });
            });
            // safety timeout
            setTimeout(resolve, 2000);
        });

                                                // Render to canvas (skip taint sources: iframes/canvas; allow same-origin images; skip cross-origin)
                const canvas = await window.html2canvas(temp, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    useCORS: true,
                    logging: false,
                    imageTimeout: 1500,
                    foreignObjectRendering: false,
                    removeContainer: true,
                    ignoreElements: (el) => {
                        try {
                                                    const tag = el.tagName;
                                                    if (tag === 'IFRAME' || tag === 'CANVAS') return true;
                                                    if (tag === 'IMG') {
                                                                const src = el.getAttribute('src') || '';
                                                                if (!/^https?:/i.test(src)) {
                                                                    // relative or data: under http/https allowed; under file://, SVG fallback used, so ok
                                                                    return false;
                                                                }
                                                                // http/https: allow only same-origin
                                                                try { const u = new URL(src, location.href); return u.origin !== location.origin; } catch { return true; }
                                                    }
                                                    return false;
                        } catch (_) { return false; }
                    }
                });
        document.body.removeChild(temp);

        // Create PDF (A4 portrait)
    const pdf = new jsPDFCtor('p', 'mm', 'a4');
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();

        // Scale image to fit width with preserved ratio and paginate by slicing the canvas
        const imgWpx = canvas.width, imgHpx = canvas.height;
    const margin = 14; // mm, larger to avoid clipping
        const pdfW = pageW - margin * 2;
        const pxPerMm = imgWpx / pdfW; // how many pixels per mm at this width
        const pageContentHpx = (pageH - margin * 2) * pxPerMm; // max pixels per page height
        let offsetYpx = 0;
        const makeSlice = (src, sy, sh) => {
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = imgWpx;
            pageCanvas.height = sh;
            const ctx = pageCanvas.getContext('2d');
            ctx.drawImage(src, 0, sy, imgWpx, sh, 0, 0, imgWpx, sh);
            return pageCanvas.toDataURL('image/png');
        };
        while (offsetYpx < imgHpx) {
            const sliceHpx = Math.min(pageContentHpx, imgHpx - offsetYpx);
            const dataUrl = makeSlice(canvas, offsetYpx, sliceHpx);
            const sliceHmm = sliceHpx / pxPerMm;
            pdf.addImage(dataUrl, 'PNG', margin, margin, pdfW, sliceHmm, undefined, 'FAST');
            offsetYpx += sliceHpx;
            if (offsetYpx < imgHpx) pdf.addPage();
        }

        // Append a centered Hebrew quote and contact at the bottom of the LAST page
        try {
            const finalWrap = document.createElement('div');
            finalWrap.style.cssText = 'position:fixed;left:-99999px;top:0;background:#fff;width:900px;max-width:900px;min-height:200px;padding:0 24px 0;display:flex;align-items:center;justify-content:center;text-align:center;direction:rtl;';
            const finalInner = document.createElement('div');
            finalInner.style.cssText = 'max-width:760px; margin:0 auto;';
            const quote = document.createElement('div');
            quote.textContent = '"בעבודה עם עץ, כל חיתוך הוא בחירה, וכל חיבור הוא סיפור. שמרו על דיוק, הקפידו על בטיחות, ותנו ליצירה שלכם לדבר בעד עצמה."';
            quote.style.cssText = 'font-weight:700; font-size:20px; line-height:1.6; margin-bottom:12px;';
            const contact = document.createElement('div');
            contact.textContent = 'בהצלחה גדולה ! מוזמנים לשלוח לי מה יצא לכם במייל unique.center.yoni@gmail.com';
            contact.style.cssText = 'font-size:16px; line-height:1.6;';
            finalInner.appendChild(quote);
            finalInner.appendChild(contact);
            finalWrap.appendChild(finalInner);
            document.body.appendChild(finalWrap);

            await new Promise(r => setTimeout(r, 50));
            const finalCanvas = await window.html2canvas(finalWrap, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                imageTimeout: 1500,
                ignoreElements: (el) => {
                    try {
                        const tag = el.tagName;
                        if (tag === 'IFRAME' || tag === 'CANVAS') return true;
                        if (tag === 'IMG') return /^https?:/i.test(el.src);
                        return false;
                    } catch (_) { return false; }
                }
            });
            document.body.removeChild(finalWrap);

            const fWpx = finalCanvas.width, fHpx = finalCanvas.height;
            const fPdfW = pageW - margin * 2;
            const fRatio = fWpx / fPdfW; // px per mm at this width
            const fHmm = Math.min(fHpx / fRatio, pageH * 0.22); // cap footer height to ~22% page
            const fY = pageH - margin - fHmm; // stick to bottom within margins
            const x = margin;
            // Optional white background bar for readability
            try { pdf.setFillColor(255,255,255); pdf.rect(x, fY, fPdfW, fHmm, 'F'); } catch(_){ }
            pdf.addImage(finalCanvas.toDataURL('image/png'), 'PNG', x, fY, fPdfW, fHmm, undefined, 'FAST');
        } catch(_) { /* ignore final page errors and continue */ }

    // File name (no hyphen between title and project name)
    const prefix = language === 'he' ? 'פרויקט ' : 'Project ';
    const base = (projName || '').trim() || (language === 'he' ? 'ללא שם' : 'Untitled');
    const fileNameBase = (prefix + base).replace(/[\/:*?"<>|]+/g,'_');
    pdf.save(`${fileNameBase}.pdf`);
    } catch (e) { console.error(e); }
});

// האזור לסטטוס טעינת מאגר
function showDbStatus(msg) {
    const block = document.getElementById('block-db');
    if (!block) return;
    let status = document.getElementById('db-status');
    if (!status) {
        // יתכן והמשתמש טרם ביקר בבלוק הזה — ניצור זמנית מתחת לכותרת
        const head = block.querySelector('.card-head');
        status = document.createElement('div');
        status.id = 'db-status';
        status.style.marginTop = '8px';
        status.style.color = '#2e7d32';
        head?.appendChild(status);
    }
    status.textContent = msg;
}

// האזנה לשינויים בשדות הדרישות כדי לייצר תלות בין סוג -> עובי -> רוחב
const reqList = document.getElementById('requirements-list');
if (reqList) reqList.addEventListener('change', (e) => {
    const target = e.target;
    const row = target.closest('.req-row');
    if (!row) return;
    const typeSel = row.querySelector('select[data-field="type"]');
    const thSel = row.querySelector('select[data-field="thickness"]');
    let wSel = row.querySelector('[data-field="width"]');
    const type = typeSel ? typeSel.value : '';
    if (target === typeSel) {
        // עדכן עוביים
        const ths = type ? getUniqueThicknessesForType(type) : [];
        const thUnit = getThicknessColIndex() >= 0 ? (inventoryUnits[getThicknessColIndex()] || '') : '';
    thSel.innerHTML = `<option value="">${language === 'he' ? 'עובי (מ״מ)' : 'Thickness (mm)'}</option>` + ths.map(v => {
            const labelVal = unitSystem === 'imperial' ? convertNumberByUnit(v, thUnit, 'imperial') : Number(v);
            const label = Math.abs(labelVal - Math.round(labelVal)) < 1e-9 ? String(Math.round(labelVal)) : formatNumber(labelVal);
            return `<option value="${v}">${label}</option>`;
        }).join('');
        thSel.disabled = ths.length === 0;
        // קבע סוג קלט לרוחב לפי סיווג
    const cls = getClassificationFor(type, undefined);
    const isPlate = cls && classificationIsPlate(cls);
        if (isPlate) {
            // החלף לשדה קלט ידני
            const newInput = document.createElement('input');
            newInput.type = 'number';
            newInput.min = '0';
            newInput.setAttribute('data-field','width');
            newInput.placeholder = language === 'he' 
                ? (unitSystem==='imperial' ? 'רוחב (אינץ׳)' : 'רוחב (ס״מ)')
                : (unitSystem==='imperial' ? 'Width (inch)' : 'Width (cm)');
            wSel.replaceWith(newInput);
            wSel = newInput;
            const lenEl = row.querySelector('input[data-field="length"]');
            if (lenEl) lenEl.placeholder = language === 'he' 
                ? (unitSystem==='imperial' ? 'אורך (אינץ׳)' : 'אורך (ס״מ)')
                : (unitSystem==='imperial' ? 'Length (inch)' : 'Length (cm)');
        } else {
            // ודא שזה select
            if (wSel && wSel.tagName.toLowerCase() !== 'select') {
                const newSel = document.createElement('select');
                newSel.setAttribute('data-field','width');
                wSel.replaceWith(newSel);
                wSel = newSel;
            }
            // הצג יחידת מידה מתאימה ב-placeholder
            const widthPlaceholder = language==='he'
                ? (unitSystem==='imperial' ? 'רוחב (אינץ׳)' : 'רוחב (מ״מ/ס״מ)')
                : (unitSystem==='imperial' ? 'Width (inch)' : 'Width (mm/cm)');
            wSel.innerHTML = `<option value="">${widthPlaceholder}</option>`;
            wSel.disabled = true;
        }
    }
    if (target === thSel) {
        const thickness = thSel.value;
        const widths = (type && thickness) ? getUniqueWidths(type, thickness) : [];
    const cls = getClassificationFor(type, thickness);
    const isPlate = cls && classificationIsPlate(cls);
        if (isPlate) {
            // כבר שדה ידני - עדכן placeholder לפי יחידות
            if (wSel && wSel.tagName.toLowerCase() === 'input') {
        wSel.placeholder = language === 'he' 
            ? (unitSystem==='imperial' ? 'רוחב (אינץ׳)' : 'רוחב (ס״מ)')
            : (unitSystem==='imperial' ? 'Width (inch)' : 'Width (cm)');
            }
        const lenEl = row.querySelector('input[data-field="length"]');
        if (lenEl) lenEl.placeholder = language === 'he' 
        ? (unitSystem==='imperial' ? 'אורך (אינץ׳)' : 'אורך (ס״מ)')
        : (unitSystem==='imperial' ? 'Length (inch)' : 'Length (cm)');
        } else {
            // select לרוחב
            if (wSel && wSel.tagName.toLowerCase() !== 'select') {
                const newSel = document.createElement('select');
                newSel.setAttribute('data-field','width');
                wSel.replaceWith(newSel);
                wSel = newSel;
            }
            const wUnit = getWidthColIndex() >= 0 ? (inventoryUnits[getWidthColIndex()] || '') : '';
            const widthLabel = language === 'he' ? 'רוחב' : 'Width';
            const heMM = 'מ״מ';
            const widthPlaceholder = language==='he'
                ? (unitSystem==='imperial' ? 'רוחב (אינץ׳)' : `${widthLabel} (${heMM})`)
                : (unitSystem==='imperial' ? 'Width (inch)' : `${widthLabel} (mm)`);
            wSel.innerHTML = `<option value="">${widthPlaceholder}</option>` + widths.map(v => {
                const labelVal = unitSystem === 'imperial' ? convertNumberByUnit(v, wUnit, 'imperial') : Number(v);
                const label = Math.abs(labelVal - Math.round(labelVal)) < 1e-9 ? String(Math.round(labelVal)) : formatNumber(labelVal);
                return `<option value="${v}">${label}</option>`;
            }).join('');
            wSel.disabled = widths.length === 0;
            const lenEl = row.querySelector('input[data-field="length"]');
            if (lenEl) lenEl.placeholder = language === 'he'
                ? (unitSystem==='imperial' ? 'אורך (אינץ׳)' : 'אורך (ס״מ)')
                : (unitSystem==='imperial' ? 'Length (inch)' : 'Length (cm)');
        }
    }
});

// האזנה לטבלת המאגר לפעולות עריכה/שמירה/מחיקה ושמירת שורה חדשה
const dbWrap = document.getElementById('db-table-wrap');
if (dbWrap) dbWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('btn-del')) {
        const idx = Number(btn.dataset.row);
        if (isFinite(idx)) {
            inventoryData.splice(idx, 1);
            saveData('inventoryData', inventoryData);
            renderInventoryTable();
        }
    } else if (btn.classList.contains('btn-edit')) {
        const idx = Number(btn.dataset.row);
        if (isFinite(idx)) {
            editingRows.add(idx);
            renderInventoryTable();
        }
    } else if (btn.classList.contains('btn-cancel')) {
        const idx = Number(btn.dataset.row);
        if (isFinite(idx)) {
            editingRows.delete(idx);
            renderInventoryTable();
        }
    } else if (btn.classList.contains('btn-save')) {
        const idx = Number(btn.dataset.row);
        if (isFinite(idx)) {
            const tr = btn.closest('tr');
            const newVals = inventoryHeaders.map((_, i) => {
                const td = tr.querySelector(`td[data-col="${i}"]`);
                if (!td) return inventoryData[idx][i];
                const sel = td.querySelector('select');
                if (sel) return sel.value;
                return td.textContent.trim();
            });
            // חשב מחיר למטר אם חסר/ניתן לחשב
            const priceIdx = getPriceColIndex();
            const ppmIdx = getPricePerMeterColIndex();
            const lenIdx = getColumnIndex(['length','אורך']);
            if (ppmIdx >= 0 && priceIdx >= 0 && lenIdx >= 0) {
                const priceRaw = newVals[priceIdx];
                const price = isFinite(Number(priceRaw)) ? Number(priceRaw) : 0;
                const lenUnit = inventoryUnits[lenIdx] || '';
                const lenMeters = lengthToMeters(newVals[lenIdx], lenUnit);
                if (isFinite(price) && isFinite(lenMeters) && lenMeters > 0) {
                    newVals[ppmIdx] = (price / lenMeters).toFixed(2);
                }
            }
            inventoryData[idx] = newVals;
            saveData('inventoryData', inventoryData);
            // Visual feedback: mark button as saved, then re-render shortly after
            try { btn.classList.add('saved'); } catch(_){}
            editingRows.delete(idx);
            setTimeout(() => { try { btn.classList.remove('saved'); } catch(_){}; renderInventoryTable(); }, 220);
        }
    } else if (btn.classList.contains('btn-save-new')) {
        const tr = btn.closest('tr');
        const colsCount = inventoryHeaders.length;
        const newVals = Array.from({ length: colsCount }).map((_, i) => {
            const td = tr.querySelector(`td[data-col="${i}"]`);
            if (!td) return '';
            const sel = td.querySelector('select');
            if (sel) return sel.value;
            return td.textContent.trim();
        });
        if (newVals.some(v => String(v).trim() !== '')) {
            // חשב מחיר למטר אוטומטית
            const priceIdx = getPriceColIndex();
            const ppmIdx = getPricePerMeterColIndex();
            const lenIdx = getColumnIndex(['length','אורך']);
            if (ppmIdx >= 0 && priceIdx >= 0 && lenIdx >= 0) {
                const priceRaw2 = newVals[priceIdx];
                const price = isFinite(Number(priceRaw2)) ? Number(priceRaw2) : 0;
                const lenUnit = inventoryUnits[lenIdx] || '';
                const lenMeters = lengthToMeters(newVals[lenIdx], lenUnit);
                if (isFinite(price) && isFinite(lenMeters) && lenMeters > 0) {
                    newVals[ppmIdx] = (price / lenMeters).toFixed(2);
                }
            }
            inventoryData.unshift(newVals);
            saveData('inventoryData', inventoryData);
        }
        // Visual feedback: mark saved before re-render
        try { btn.classList.add('saved'); } catch(_){ }
        showNewInventoryRow = false;
        setTimeout(() => { try { btn.classList.remove('saved'); } catch(_){}; renderInventoryTable(); refreshRequirementTypeOptions(); }, 220);
    } else if (btn.classList.contains('btn-cancel-new')) {
        showNewInventoryRow = false;
        renderInventoryTable();
    }
});

// ===== Mobile horizontal pan lock: allow pan-x רק באזורים מותרים (מאגר, תוצאות בתוך .x-scroll, דיאגרמות) =====
(function(){
    let enabled = false;
    let startX = 0, startY = 0, startedInsideAllowed = false;
    const isInsideAllowed = (el) => {
        if (!el || !el.closest) return false;
    // Allow only inside explicit horizontal scroll regions
    return !!(el.closest('#db-table-wrap') || el.closest('#results-area .x-scroll') || el.closest('.diagram'));
    };
    const onStart = (e) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        startX = t.clientX; startY = t.clientY;
        startedInsideAllowed = isInsideAllowed(e.target);
    };
    const onMove = (e) => {
        if (!enabled) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        // מחסום: מחווה אופקית שמתחילה מחוץ לאזור מותר — מבוטלת
        if (!startedInsideAllowed && Math.abs(dx) > Math.abs(dy) + 2) {
            try { e.preventDefault(); } catch(_){}
        }
    };
    function setLock(on){
        if (on === enabled) return;
        enabled = on;
        if (on) {
            document.addEventListener('touchstart', onStart, { passive: true });
            document.addEventListener('touchmove', onMove, { passive: false });
        } else {
            document.removeEventListener('touchstart', onStart, { passive: true });
            document.removeEventListener('touchmove', onMove, { passive: false });
        }
    }
    // תמיד פעיל — מרשה pan-x רק בתוך האזורים המותרים
    setLock(true);
})();

// חישוב מחיר למטר תוך כדי עריכה (לייב) עבור שורות במצב עריכה
if (dbWrap) dbWrap.addEventListener('input', (e) => {
    const td = e.target.closest('td[contenteditable="true"]');
    if (!td) return;
    const tr = td.closest('tr');
    if (!tr) return;
    const priceIdx = getPriceColIndex();
    const ppmIdx = getPricePerMeterColIndex();
    const lenIdx = getColumnIndex(['length','אורך']);
    if (ppmIdx < 0 || priceIdx < 0 || lenIdx < 0) return;
    const tds = tr.querySelectorAll('td[data-col]');
    const getVal = (i) => {
        const cell = tr.querySelector(`td[data-col="${i}"]`);
        return cell ? cell.textContent.trim() : '';
    };
    const priceStr = getVal(priceIdx);
    const price = isFinite(Number(priceStr)) ? Number(priceStr) : 0;
    const lenUnit = inventoryUnits[lenIdx] || '';
    const lenMeters = lengthToMeters(getVal(lenIdx), lenUnit);
    if (isFinite(price) && isFinite(lenMeters) && lenMeters > 0) {
        const ppmCell = tr.querySelector(`td[data-col="${ppmIdx}"]`);
        if (ppmCell) ppmCell.textContent = (price / lenMeters).toFixed(2);
    }
});

// אין פריסטים — נשאר רק שדה עובי מסור וצ'יפ יחידה

// אתחול ראשוני מהמצב השמור
(() => {
    // שפה
    switchLanguage(language);
    const btnLang = document.getElementById('btn-lang');
    if (btnLang) btnLang.textContent = language === 'he' ? 'english' : 'עברית';
    // יחידות
    const btnUnits = document.getElementById('btn-units');
    if (btnUnits) btnUnits.textContent = unitSystem === 'metric' ? 'm' : 'inch';
    const sawUnit = document.getElementById('saw-unit');
    if (sawUnit) {
        const he = language === 'he';
        sawUnit.textContent = unitSystem === 'metric' ? (he ? 'מ״מ' : 'mm') : (he ? 'אינץ׳' : 'inch');
    }
    // מטבע
    const btnCurrency = document.getElementById('btn-currency');
    if (btnCurrency) btnCurrency.textContent = loadData('currencySymbol') || (inventoryPriceCurrencyUnit || '€');
    // מאגר
    if (inventoryRows.length) {
        renderInventoryTable();
        refreshRequirementTypeOptions();
        showDbStatus(language === 'he' ? 'מאגר הנתונים נטען מהדפדפן' : 'Inventory restored from browser');
        // השלם יחידות חסרות מגרסאות ישנות
        if (!Array.isArray(inventoryUnits) || inventoryUnits.length !== inventoryHeaders.length) {
            ensureInventorySeeded();
            renderInventoryTable();
        }
    try {
        const dir = (document.documentElement && document.documentElement.dir === 'rtl') ? 'rtl' : 'ltr';
        const wrap = document.getElementById('db-table-wrap');
        if (wrap) scrollToStart(wrap, dir);
    } catch(_) {}
    }
})();
});