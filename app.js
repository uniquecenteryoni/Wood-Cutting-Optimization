document.addEventListener('DOMContentLoaded', () => {
    // Core state from storage (with safe fallbacks)
    let language = loadData('lang') || 'he';
    let unitSystem = loadData('unitSystem') || 'metric';
    let currency = loadData('currencySymbol') || '€';
    let inventoryRows = loadData('inventoryRows') || [];
    let inventoryHeaders = loadData('inventoryHeaders') || [];
    let inventoryUnits = loadData('inventoryUnits') || [];
    let inventoryData = loadData('inventoryData') || [];
    let inventoryPriceCurrencyUnit = loadData('inventoryPriceCurrencyUnit') || currency;

    // Minimal translations used across the UI
    const translations = {
        he: {
            showDb: 'הצג מלאי',
            save: 'שמור',
            ok: 'אישור',
            extraInfo: 'מידע נוסף',
            tags: 'תגיות',
            fontSize: 'גודל גופן',
            regular: 'רגיל',
            bold: 'בולט',
            displaySettingsTitle: 'הגדרות תצוגה',
            compressedView: 'תצוגה מצומצמת'
        },
        en: {
            showDb: 'Show Inventory',
            save: 'save',
            ok: 'OK',
            extraInfo: 'Extra info',
            tags: 'Tags',
            fontSize: 'Font size',
            regular: 'Regular',
            bold: 'Bold',
            displaySettingsTitle: 'Display settings',
            compressedView: 'Compressed view'
        }
    };

    // Advanced saw settings (persisted) with safe defaults
    let sawAdv = Object.assign({
        // Block 1 defaults: all sliders OFF
        orientationLock: false,
        orientationPref: 'horizontal', // 'horizontal' | 'vertical'
        edgeTrimOn: false,
        edgeTrimTopCm: 0,
        edgeTrimBottomCm: 0,
        edgeTrimLeftCm: 0,
        edgeTrimRightCm: 0,
        sawCuttingOn: false,
        tagOn: false
    }, loadData('sawAdv') || {});

    // One-time migration: ensure saw cutting starts OFF visibly for all users
    try {
        const migrated = loadData('sawCutDefaultReset_v1');
        if (!migrated) {
            sawAdv.sawCuttingOn = false;
            saveData('sawAdv', sawAdv);
            saveData('sawCutDefaultReset_v1', true);
        }
    } catch(_){}

    // Display/results settings (persisted) with defaults
    let displaySettings = Object.assign({
        panelOpen: false,
        // Block 3 defaults: show extra info (labels) and cuts color ON; others OFF
        showPieceLabels: true,
        colorPieces: true,
        fontWeight: 'regular', // 'regular' | 'bold'
        fontSize: 'normal', // 'small' | 'normal' | 'large'
        displayUnit: 'cm',     // 'cm' | 'mm' | 'm' | for imperial code uses global unitSystem
        showTags: false,
        cutOrderOn: false,
        compressedView: false
    }, loadData('displaySettings') || {});

    // UI state for inventory editing/new row
    let showNewInventoryRow = false;
    let editingRows = new Set();

    // Unique IDs for SVG diagrams
    let svgIdCounter = 1;

// Results table column visibility settings (persisted)
let resultsColSettings = loadData('resultsColSettings') || {
    showSupplier: true,
    showClassification: true,
    showWasteValue: false,
    showWastePct: true,
    showMaterial: false,
    showMaxProducts: true
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
    const hdr = he ? ['חומר','סוג','סיווג','עובי','רוחב','אורך','מחיר','מחיר למטר','ספק']
                   : ['Material','Type','Classification','Thickness','Width','Length','Price','Price per meter','Supplier'];
    // יחידות ברירת מחדל: עובי/רוחב ב־mm, אורך ב־m, מחירים — מטבע נוכחי
    const sym = document.getElementById('select-currency')?.value || normalizeCurrencySymbol(inventoryPriceCurrencyUnit) || '€';
    const units = he
        ? ['', '', '', 'מ״מ', 'מ״מ', 'מ׳', sym, sym, '']
        : ['', '', '', 'mm',  'mm',  'm',  sym, sym, ''];
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
    // Update document language and direction
    try {
        if (document && document.documentElement) {
            document.documentElement.lang = (language === 'he') ? 'he' : 'en';
            document.documentElement.dir = (language === 'he') ? 'rtl' : 'ltr';
        }
    } catch(_) {}
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
        toggleDbBtn.textContent = area.classList.contains('hidden') ? translations[language].showDb : (language === 'he' ? 'הסתר מלאי' : 'Hide Inventory');
    }
    // רענון טבלת המאגר כדי לעדכן את תווית "פעולות"
    renderInventoryTable();
    // רענון בלוק התוצאות כך שכותרות ומחרוזות יתורגמו
    try {
        const resArea = document.getElementById('results-area');
        if (resArea && resArea.childElementCount) {
            const res = computeOptimization();
            renderResults(res);
        }
    } catch(_) {}
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
    // After reordering headers, default type is index 1 if missing
    return idx >= 0 ? idx : 1;
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

// Material column index
function getMaterialColIndex() {
    return getColumnIndex(['material','חומר']);
}

// Build list of unique materials from inventory
function getUniqueMaterials(){
    const mIdx = getMaterialColIndex();
    if (mIdx < 0) return [];
    const vals = (inventoryData||[]).map(r => r?.[mIdx]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
    return Array.from(new Set(vals.map(v => String(v))));
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
    'material': 'חומר',
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
    'חומר': 'Material',
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
    const curSym = document.getElementById('select-currency')?.value || inventoryPriceCurrencyUnit || '€';
    if (thIdxFix >= 0 && (!units[thIdxFix] || String(units[thIdxFix]).trim()==='')) units[thIdxFix] = heLang ? 'מ״מ' : 'mm';
    if (wIdxFix  >= 0 && (!units[wIdxFix]  || String(units[wIdxFix]).trim()===''))  units[wIdxFix]  = heLang ? 'מ״מ' : 'mm';
    // שמירה על יחידת אורך שנבחרה ע"י המשתמש (כולל ס"מ) — אל תכריח מטרים
    const invSource = loadData('inventorySource');
    if (lenIdxFix>= 0 && (!units[lenIdxFix]|| String(units[lenIdxFix]).trim()==='')) units[lenIdxFix] = heLang ? 'מ׳'  : 'm';
    if (priceIdxFix>=0 && (!units[priceIdxFix]|| String(units[priceIdxFix]).trim()==='')) units[priceIdxFix] = curSym;
    if (ppmIdxFix  >=0 && (!units[ppmIdxFix]  || String(units[ppmIdxFix]).trim()===''))  units[ppmIdxFix]  = curSym;
    // אל תנרמל אורך למטרים אוטומטית — השאר לבחירת המשתמש (כולל ס"מ)
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
            return document.getElementById('select-currency')?.value || normalizeCurrencySymbol(u) || '';
        }
        // במאגר ידני — שמור על אורך במטרים גם אם הממשק באימפריאלי
        if (i === lenIdxFix && invSource === 'manual') {
            return heLang ? 'מ׳' : 'm';
        }
        return convertedUnitLabelLocalized(u, unitSystem, language);
    }) : [];
    const thead1 = `<tr>${headers.map(h => `<th>${h ?? ''}</th>`).join('')}</tr>`;
    const thIdx2 = getThicknessColIndex();
    const wIdx2 = getWidthColIndex();
    const lenIdx2 = getLengthColIndex();
    const priceIdx2 = getPriceColIndex();
    const ppmIdx2 = getPricePerMeterColIndex();
    const unitChoicesMetric = language==='he' ? ['מ״מ','ס״מ','מ׳'] : ['mm','cm','m'];
    const unitChoicesImperial = language==='he' ? ['אינץ׳'] : ['inch'];
    function unitDropdown(i){
        // currencies
        if (i===priceIdx2 || i===ppmIdx2){
            const curSym = document.getElementById('select-currency')?.value || normalizeCurrencySymbol(inventoryPriceCurrencyUnit) || '€';
            return `<select class="unit-select" data-kind="currency" data-col="${i}">${['€','$','₪'].map(s=>`<option value="${s}" ${curSym===s?'selected':''}>${s}</option>`).join('')}</select>`;
        }
        if (!(i===thIdx2 || i===wIdx2 || i===lenIdx2)) return displayUnits[i] ?? '';
        const opts = (unitSystem==='imperial') ? unitChoicesImperial : unitChoicesMetric;
        const current = displayUnits[i] ?? '';
        return `<select class="unit-select" data-col="${i}">${opts.map(u=>`<option value="${u}" ${u===current?'selected':''}>${u}</option>`).join('')}</select>`;
    }
    const thead2 = units && units.length ? `<tr>${inventoryHeaders.map((_, i) => `<th>${unitDropdown(i)}</th>`).join('')}<th></th></tr>` : '';
    // שורת עריכה ריקה בראש הטבלה, אם נדרשה (כולל תא פעולות)
    const cols = headers.length;
    const clsIdx = getClassificationColIndex();
    const matIdx = getMaterialColIndex();
    const newRow = showNewInventoryRow
        ? `<tr class="new-row">${Array.from({ length: cols - 1 }).map((_, i) => {
            if (i === clsIdx) {
                const opts = language === 'he' ? ['קורה'] : ['Beam'];
                return `<td data-col="${i}"><select class="inv-classification">${opts.map(o=>`<option value="${o}">${o}</option>`).join('')}</select></td>`;
            }
            if (i === matIdx) {
                const heOpts = ['עץ','ברזל','זכוכית','pvc','גומי'];
                const enOpts = ['Wood','Steel','Glass','PVC','Rubber'];
                const list = (language==='he') ? heOpts : enOpts;
                return `<td data-col="${i}"><select class="inv-material">${list.map(o=>`<option value="${o}">${o}</option>`).join('')}</select></td>`;
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
            const toSymbol = document.getElementById('select-currency')?.value || inventoryPriceCurrencyUnit || '';
            const fromSymbol = normalizeCurrencySymbol(inventoryPriceCurrencyUnit) || toSymbol;
                    const converted = convertCurrency(conv, fromSymbol, toSymbol);
                    display = formatNumber(converted);
                } else {
                    display = formatNumber(conv);
                }
            }
            if (editingRows.has(rowIndex) && i === clsIdx) {
                const beamLabel = language==='he' ? 'קורה' : 'Beam';
                const select = `<select class="inv-classification"><option value="${beamLabel}" selected>${beamLabel}</option></select>`;
                return `<td data-col="${i}">${select}</td>`;
            }
            if (editingRows.has(rowIndex) && i === matIdx) {
                const heOpts = ['עץ','ברזל','זכוכית','pvc','גומי'];
                const enOpts = ['Wood','Steel','Glass','PVC','Rubber'];
                const list = (language==='he') ? heOpts : enOpts;
                const cur = String(raw||'');
                const select = `<select class="inv-material">${list.map(o=>`<option value="${o}" ${o===cur?'selected':''}>${o}</option>`).join('')}</select>`;
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
        // Wire unit-select changes for per-column units and currency
        try {
            wrap.querySelectorAll('select.unit-select').forEach(sel => {
                sel.addEventListener('change', (ev) => {
                    const el = ev.target;
                    const col = Number(el.getAttribute('data-col'));
                    const kind = el.getAttribute('data-kind') || 'unit';
                    if (!isFinite(col)) return;
                                        if (kind === 'currency') {
                                                const sym = normalizeCurrencySymbol(el.value || '€');
                                                // Treat as display currency selection only — don't change source currency
                                                const selCurrency = document.getElementById('select-currency');
                                                if (selCurrency) { try { selCurrency.value = sym; } catch{} }
                                                saveData('currencySymbol', sym);
                                                try { saveData('currency', sym==='€'?'EUR':sym==='$'?'USD':sym==='₪'?'ILS':'EUR'); } catch{}
                                                try { const btnCur = document.getElementById('btn-currency'); if (btnCur) btnCur.textContent = sym; } catch{}
                                                // Re-render table and results to reflect new target currency
                                                renderInventoryTable();
                                                try {
                                                    const area = document.getElementById('results-area');
                                                    if (area && area.childElementCount) { const res = computeOptimization(); renderResults(res); }
                                                } catch{}
                                                return;
                                        }
                    // Dimension units: rescale numeric values in that column to match the newly selected unit
                    const prevUnit = inventoryUnits[col] || '';
                    const nextUnit = el.value;
                    if (prevUnit !== nextUnit) {
                        const prevNorm = normalizeUnitLabel(prevUnit);
                        const nextNorm = normalizeUnitLabel(nextUnit);
                        // Rescale numbers for thickness/width/length columns only
                        const thIdxC = getThicknessColIndex();
                        const wIdxC = getWidthColIndex();
                        const lenIdxC = getLengthColIndex();
                        const isDimCol = (col===thIdxC || col===wIdxC || col===lenIdxC);
                        if (isDimCol) {
                            let changed = false;
                            inventoryData = (inventoryData||[]).map(row => {
                                const raw = row?.[col];
                                const n = Number(raw);
                                if (!isFinite(n)) return row;
                                const mm = toMM(n, prevUnit);
                                if (!isFinite(mm)) return row;
                                // Keep precision reasonable: 3 decimals for meters/inch, 0-2 for mm/cm
                                const newVal = fromMM(mm, nextUnit);
                                if (isFinite(newVal)) {
                                    let val = newVal;
                                    // Round nicely
                                    const norm = normalizeUnitLabel(nextUnit);
                                    if (norm==='mm') val = Math.round(val);
                                    else if (norm==='cm') val = +(val.toFixed(2));
                                    else val = +(val.toFixed(3));
                                    if (row[col] !== val) { row[col] = val; changed = true; }
                                }
                                return row;
                            });
                            if (changed) saveData('inventoryData', inventoryData);
                        }
                        inventoryUnits[col] = nextUnit;
                        saveData('inventoryUnits', inventoryUnits);
                        renderInventoryTable();
                    }
                }, { passive: true });
            });
        } catch(_){ }
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
    // Filter out completely empty data rows
    const isEmpty = (row)=> !row || row.every(c => String(c||'').trim()==='');
    const hdr = arr[0] || [];
    const units = arr[1] || [];
    const body = arr.slice(2).filter(r => !isEmpty(r));
    inventoryRows = [hdr, units, ...body];
    inventoryHeaders = hdr;
    inventoryUnits = units;
    inventoryData = body;
    // If Material column missing, append it with blank units and cells
    const matIdxNow = getMaterialColIndex();
    if (matIdxNow < 0) {
        const he = (language === 'he');
        inventoryHeaders.push(he ? 'חומר' : 'Material');
        inventoryUnits.push('');
        inventoryData = inventoryData.map(r => { const a = r.slice(); a.push(''); return a; });
    }
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
    const selCurrency = document.getElementById('select-currency');
    if (selCurrency && inventoryPriceCurrencyUnit) {
        try { selCurrency.value = normalizeCurrencySymbol(inventoryPriceCurrencyUnit); } catch{}
        saveData('currencySymbol', normalizeCurrencySymbol(inventoryPriceCurrencyUnit));
    }
    renderInventoryTable();
    refreshRequirementTypeOptions();
    showDbStatus(language === 'he' ? 'המלאי נטען בהצלחה' : 'Inventory loaded successfully');
    // Auto-open DB area after load to show the table
    const area = document.getElementById('db-area');
    const toggleDbBtn = document.getElementById('toggle-db');
    if (area && toggleDbBtn) {
        area.classList.remove('hidden');
        area.setAttribute('aria-hidden','false');
        toggleDbBtn.textContent = (language === 'he' ? 'הסתר מלאי' : 'Hide Inventory');
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
function planBeamsForGroup(groupKey, cutsInput, kerfMM) {
    // groupKey: { type, thickness, width }
    // בחר את אורך הקורה מהמלאי שיניב עלות מינימלית הכוללת
        const tIdx = getTypeColIndex(); // Get the index for the type column
        const thIdx = getThicknessColIndex(); // Get the index for the thickness column
        const wIdx = getWidthColIndex(); // Get the index for the width column
        const lenIdx = getLengthColIndex(); // Get the index for the length column
        const priceIdx = getPriceColIndex(); // Get the index for the price column
        const supplierIdx = getSupplierColIndex(); // Get the index for the supplier column
        const materialIdx = getMaterialColIndex(); // Get the index for the material column
        const lengthUnit = (inventoryUnits[lenIdx] || ''); // Get the unit for length
    // סנן מלאי רלוונטי
    const stockOptions = inventoryData
        .map((row, i) => ({ row, i }))
        .filter(({row}) => String(row[tIdx]) === groupKey.type && String(row[thIdx]) === groupKey.thickness && String(row[wIdx]) === groupKey.width)
        .map(({row,i}) => {
            const Lmm = toMM(row[lenIdx], lengthUnit);
            let price = parseFloat(String(row[priceIdx] ?? '').replace(/[^0-9.\-]/g,''));
            if (!isFinite(price)) price = 0; // treat empty/invalid as 0
            return { index:i, row, Lmm, price, supplier: row[supplierIdx], material: row[materialIdx] };
        })
        .filter(opt => isFinite(opt.Lmm) && isFinite(opt.price) && opt.Lmm > 0 && opt.price >= 0);
    if (stockOptions.length === 0) return null;
    // פונקציה לגרידי: לוקחת אורך נתון ומקצה חיתוכים
    function greedyPack(Lmm) {
        // cuts may be numbers (legacy) or objects {len, tag}
        const toObj = (c) => (typeof c === 'number') ? { len: c, tag: '' } : { len: Number(c.len)||0, tag: String(c.tag||'') };
        const remainingCuts = [...cutsInput].map(toObj).sort((a,b)=>b.len-a.len);
        const bars = [];
        while (remainingCuts.length) {
            let bar = { used:0, pieces:[], waste:0 };
            let remaining = Lmm;
            let anyPlacedThisBar = false;
            while (remainingCuts.length) {
                // נסה לשבץ את הארוך ביותר שיכול להיכנס
                let placed = false;
                // כלל מיוחד: אם נותר אורך בדיוק בגודל חתיכה מבוקשת — חתוך ללא kerf וסיים את הקורה
                const tol = 1e-6;
                let exactIdx = remainingCuts.findIndex(p => Math.abs(p.len - remaining) <= tol);
                // Forbid exact-from-remainder for pieces strictly between 87–90 cm (user constraint example)
                if (exactIdx >= 0) {
                    const pExact = remainingCuts[exactIdx].len;
                    if (pExact > 870 && pExact < 900) {
                        exactIdx = -1; // disallow this special case; must move to a new bar
                    }
                }
                if (exactIdx >= 0) {
                    const piece = remainingCuts[exactIdx];
                    bar.pieces.push(piece); // {len, tag}
                    bar.used += piece.len; // ללא kerf עבור חתיכה אחרונה המדויקת
                    remaining -= piece.len;
                    remainingCuts.splice(exactIdx,1);
                    placed = true;
                    anyPlacedThisBar = true;
                    // אין מקום ל-cut נוסף — צא משיבוץ חתיכות בקורה זו
                    break;
                }
                for (let idx = 0; idx < remainingCuts.length; idx++) {
                    const piece = remainingCuts[idx];
                    // kerf לכל חתיכה שנחתכת מהקורה (כולל הראשונה, אבל לא נדרשת עבור האחרונה אם היא שווה בדיוק לשארית)
                    const need = piece.len + kerfMM;
                    if (need <= remaining + 1e-6) {
                        // שים חתיכה
                        bar.pieces.push(piece); // {len, tag}
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
    if (placedCount < cutsInput.length) continue;
        const totalCost = bars.length * opt.price;
        if (!best || totalCost < best.totalCost) {
            best = { option: opt, bars, totalCost };
        }
    }
    return best;
}

// ===== 2D Plate packing (multi-strategy) =====
// Rectangle helpers
function rectArea(r){ return Math.max(0, r.w) * Math.max(0, r.h); }
function pruneFreeRects(free){
    const out = [];
    for (let i=0;i<free.length;i++){
        const a = free[i]; if (!a || a.w<=0 || a.h<=0) continue;
        let contained = false;
        for (let j=0;j<free.length;j++){
            if (i===j) continue; const b = free[j];
            if (!b) continue;
            if (a.x>=b.x-1e-6 && a.y>=b.y-1e-6 && a.x+a.w<=b.x+b.w+1e-6 && a.y+a.h<=b.y+b.h+1e-6) { contained = true; break; }
        }
        if (!contained) out.push(a);
    }
    return out;
}
function sortByBL(a,b){ // bottom-left: y asc then x asc
    if (a.y !== b.y) return a.y - b.y; return a.x - b.x;
}
function splitFreeRect(fr, pw, ph, kerf){
    const k = Math.max(0, kerf||0);
    const right = { x: fr.x + pw + k, y: fr.y, w: fr.w - pw - k, h: ph };
    const bottom = { x: fr.x, y: fr.y + ph + k, w: fr.w, h: fr.h - ph - k };
    const out = [];
    if (right.w > 0.5 && right.h > 0.5) out.push(right);
    if (bottom.w > 0.5 && bottom.h > 0.5) out.push(bottom);
    return out;
}
function rankLayout(layout){
    const wastes = (layout.freeRects||[]).slice().sort((a,b)=>rectArea(b)-rectArea(a));
    const a1 = wastes[0] ? rectArea(wastes[0]) : 0;
    const a2 = wastes[1] ? rectArea(wastes[1]) : 0;
    const count = wastes.length;
    return { a1, a2, count };
}
function betterLayout(l1, l2){
    const r1 = rankLayout(l1), r2 = rankLayout(l2);
    if (r1.a1 !== r2.a1) return r1.a1 > r2.a1;
    if (r1.a2 !== r2.a2) return r1.a2 > r2.a2;
    return r1.count < r2.count;
}
// Waste grid metrics per spec: use all piece edges + plate edges, find largest and second-largest empty rectangles
function computeEmptyGridMetrics(placed, W, H){
    const xsSet = new Set([0, W]);
    const ysSet = new Set([0, H]);
    for (const p of (placed||[])){
        if (!p) continue;
        xsSet.add(Math.max(0, Math.min(W, p.x)));
        xsSet.add(Math.max(0, Math.min(W, p.x + p.w)));
        ysSet.add(Math.max(0, Math.min(H, p.y)));
        ysSet.add(Math.max(0, Math.min(H, p.y + p.h)));
    }
    const xs = Array.from(xsSet).sort((a,b)=>a-b);
    const ys = Array.from(ysSet).sort((a,b)=>a-b);
    const nx = Math.max(0, xs.length-1), ny = Math.max(0, ys.length-1);
    if (nx<=0 || ny<=0) return { a1: 0, a2: 0, count: 0 };
    // Build occupied matrix by cells: cell is occupied if intersects any placed rect
    const occ = Array.from({length: ny}, ()=> Array(nx).fill(0));
    for (let r=0;r<ny;r++){
        const y0 = ys[r], y1 = ys[r+1];
        for (let c=0;c<nx;c++){
            const x0 = xs[c], x1 = xs[c+1];
            const cw = x1-x0, ch = y1-y0;
            if (cw<=1e-6 || ch<=1e-6) { occ[r][c] = 1; continue; }
            let isOcc = false;
            for (const p of (placed||[])){
                if (!p) continue;
                const px0=p.x, py0=p.y, px1=p.x+p.w, py1=p.y+p.h;
                const ix = Math.max(0, Math.min(x1, px1) - Math.max(x0, px0));
                const iy = Math.max(0, Math.min(y1, py1) - Math.max(y0, py0));
                if (ix>1e-6 && iy>1e-6){ isOcc = true; break; }
            }
            occ[r][c] = isOcc ? 1 : 0;
        }
    }
    // Prefix sums per column to quickly check emptiness over a row range
    const ps = Array.from({length: ny+1}, ()=> Array(nx).fill(0));
    for (let r=0;r<ny;r++){
        for (let c=0;c<nx;c++) ps[r+1][c] = ps[r][c] + (occ[r][c] ? 1 : 0);
    }
    let best1 = 0, best2 = 0; // areas
    let bestRect1 = null, bestRect2 = null;
    let emptyCells = 0;
    for (let r=0;r<ny;r++){
        for (let c=0;c<nx;c++) if (!occ[r][c]) emptyCells++;
    }
    // Consider all row ranges
    for (let r1=0;r1<ny;r1++){
        for (let r2=r1;r2<ny;r2++){
            const h = ys[r2+1] - ys[r1];
            if (h<=0) continue;
            // Compute which columns are entirely empty in this row range
            const empt = new Array(nx);
            for (let c=0;c<nx;c++) empt[c] = (ps[r2+1][c] - ps[r1][c]) === 0;
            // Scan contiguous empty segments, compute width and area
            let c=0;
            while (c<nx){
                while (c<nx && !empt[c]) c++;
                if (c>=nx) break;
                let cStart = c, width = 0;
                while (c<nx && empt[c]){ width += (xs[c+1] - xs[c]); c++; }
                const area = width * h;
                if (area > best1){
                    best2 = best1; bestRect2 = bestRect1;
                    best1 = area; bestRect1 = { x: xs[cStart], y: ys[r1], w: width, h };
                } else if (area > best2){
                    best2 = area; bestRect2 = { x: xs[cStart], y: ys[r1], w: width, h };
                }
            }
        }
    }
    return { a1: best1, a2: best2, count: emptyCells, rect1: bestRect1, rect2: bestRect2 };
}
function betterLayoutByWaste(l1, l2, plate){
    const W = plate.Wmm, H = plate.Hmm;
    const r1 = computeEmptyGridMetrics(l1.placed||[], W, H);
    const r2 = computeEmptyGridMetrics(l2.placed||[], W, H);
    if (r1.a1 !== r2.a1) return r1.a1 > r2.a1;
    if (r1.a2 !== r2.a2) return r1.a2 > r2.a2;
    return r1.count < r2.count;
}

// Robust maximal empty rectangle (axis-aligned) using weighted histogram per row
function computeMaxEmptyRectHistogram(placed, W, H){
    const xsSet = new Set([0, W]);
    const ysSet = new Set([0, H]);
    for (const p of (placed||[])){
        if (!p) continue;
        xsSet.add(Math.max(0, Math.min(W, p.x)));
        xsSet.add(Math.max(0, Math.min(W, p.x + p.w)));
        ysSet.add(Math.max(0, Math.min(H, p.y)));
        ysSet.add(Math.max(0, Math.min(H, p.y + p.h)));
    }
    const xs = Array.from(xsSet).sort((a,b)=>a-b);
    const ys = Array.from(ysSet).sort((a,b)=>a-b);
    const nx = Math.max(0, xs.length-1), ny = Math.max(0, ys.length-1);
    if (nx<=0 || ny<=0) return { area: 0, rect: null };
    // Occupancy grid
    const occ = Array.from({length: ny}, ()=> Array(nx).fill(0));
    for (let r=0;r<ny;r++){
        const y0 = ys[r], y1 = ys[r+1];
        for (let c=0;c<nx;c++){
            const x0 = xs[c], x1 = xs[c+1];
            const cw = x1-x0, ch = y1-y0;
            if (cw<=1e-6 || ch<=1e-6) { occ[r][c] = 1; continue; }
            let isOcc = false;
            for (const p of (placed||[])){
                if (!p) continue;
                const px0=p.x, py0=p.y, px1=p.x+p.w, py1=p.y+p.h;
                const ix = Math.max(0, Math.min(x1, px1) - Math.max(x0, px0));
                const iy = Math.max(0, Math.min(y1, py1) - Math.max(y0, py0));
                if (ix>1e-6 && iy>1e-6){ isOcc = true; break; }
            }
            occ[r][c] = isOcc ? 1 : 0;
        }
    }
    // Weighted histogram stack per row
    const widths = Array.from({length: nx}, (_,c)=> xs[c+1]-xs[c]);
    const heights = Array(nx).fill(0);
    let bestArea = 0, bestRect = null;
    for (let r=0;r<ny;r++){
        const dy = ys[r+1]-ys[r];
        for (let c=0;c<nx;c++) heights[c] = occ[r][c] ? 0 : (heights[c] + dy);
        // stack of {idx, height, accWidth}
        const stack = [];
        let accWidth = 0;
        for (let c=0;c<=nx;c++){
            const h = (c<nx) ? heights[c] : 0;
            const w = (c<nx) ? widths[c] : 0;
            let startX = xs[c];
            let sumW = 0;
            let lastIdx = c;
            while (stack.length && stack[stack.length-1].height > h){
                const top = stack.pop();
                sumW += top.accWidth;
                const area = top.height * sumW;
                if (area > bestArea){
                    bestArea = area;
                    const xEnd = xs[c];
                    const xStart = xEnd - sumW;
                    const yEnd = ys[r+1];
                    const yStart = yEnd - top.height;
                    bestRect = { x: xStart, y: yStart, w: sumW, h: top.height };
                }
                startX = xs[top.idx];
                lastIdx = top.idx;
            }
            const acc = (sumW || 0) + (c<nx ? w : 0);
            if (h>0){
                stack.push({ idx: lastIdx, height: h, accWidth: acc });
            }
        }
    }
    return { area: bestArea, rect: bestRect };
}

// Build grid (xs, ys, occ) once for placed set
function buildEmptyGrid(placed, W, H, kerf){
    const xsSet = new Set([0, W]);
    const ysSet = new Set([0, H]);
    for (const p of (placed||[])){
        if (!p) continue;
    const K = Math.max(0, kerf||0);
    // add original edges
    xsSet.add(Math.max(0, Math.min(W, p.x)));
    xsSet.add(Math.max(0, Math.min(W, p.x + p.w)));
    ysSet.add(Math.max(0, Math.min(H, p.y)));
    ysSet.add(Math.max(0, Math.min(H, p.y + p.h)));
    // add kerf offset edges to align cells with margins
    xsSet.add(Math.max(0, Math.min(W, p.x - (p.x>0 ? K : 0))));
    xsSet.add(Math.max(0, Math.min(W, p.x + p.w + (p.x+p.w < W ? K : 0))));
    ysSet.add(Math.max(0, Math.min(H, p.y - (p.y>0 ? K : 0))));
    ysSet.add(Math.max(0, Math.min(H, p.y + p.h + (p.y+p.h < H ? K : 0))));
    }
    const xs = Array.from(xsSet).sort((a,b)=>a-b);
    const ys = Array.from(ysSet).sort((a,b)=>a-b);
    const nx = Math.max(0, xs.length-1), ny = Math.max(0, ys.length-1);
    const occ = Array.from({length: ny}, ()=> Array(nx).fill(0));
    for (let r=0;r<ny;r++){
        const y0 = ys[r], y1 = ys[r+1];
        for (let c=0;c<nx;c++){
            const x0 = xs[c], x1 = xs[c+1];
            const cw = x1-x0, ch = y1-y0;
            if (cw<=1e-6 || ch<=1e-6) { occ[r][c] = 1; continue; }
            let isOcc = false;
            for (const p of (placed||[])){
                if (!p) continue;
                const K = Math.max(0, kerf||0);
                const px0 = (p.x>0) ? (p.x - K) : p.x;
                const py0 = (p.y>0) ? (p.y - K) : p.y;
                const px1 = (p.x+p.w < W) ? (p.x+p.w + K) : (p.x+p.w);
                const py1 = (p.y+p.h < H) ? (p.y+p.h + K) : (p.y+p.h);
                const ix = Math.max(0, Math.min(x1, px1) - Math.max(x0, px0));
                const iy = Math.max(0, Math.min(y1, py1) - Math.max(y0, py0));
                if (ix>1e-6 && iy>1e-6){ isOcc = true; break; }
            }
            occ[r][c] = isOcc ? 1 : 0;
        }
    }
    return { xs, ys, occ };
}

function carveRectFromGrid(occ, xs, ys, rect, kerf, W, H){
    const nx = Math.max(0, xs.length-1), ny = Math.max(0, ys.length-1);
    const K = Math.max(0, kerf||0);
    // carve the rectangle plus kerf gutter around it (not beyond plate edges)
    const x0 = Math.max(0, rect.x - (rect.x>0 ? K : 0));
    const x1 = Math.min(W, rect.x + rect.w + (rect.x+rect.w < W ? K : 0));
    const y0 = Math.max(0, rect.y - (rect.y>0 ? K : 0));
    const y1 = Math.min(H, rect.y + rect.h + (rect.y+rect.h < H ? K : 0));
    for (let r=0;r<ny;r++){
        const cy0 = ys[r], cy1 = ys[r+1];
        if (cy1<=y0 || cy0>=y1) continue;
        for (let c=0;c<nx;c++){
            const cx0 = xs[c], cx1 = xs[c+1];
            if (cx1<=x0 || cx0>=x1) continue;
            occ[r][c] = 1; // mark as occupied by chosen empty rect to avoid reusing
        }
    }
}

function computeAllEmptyRects(placed, W, H, kerf, maxRects){
    const grid = buildEmptyGrid(placed, W, H, kerf);
    const out = [];
    const limit = isFinite(maxRects) && maxRects>0 ? Math.floor(maxRects) : 999;
    for (let i=0;i<limit;i++){
        // reuse histogram over current grid state
        // Reconstruct placed-from-grid occupancy for histogram run
        const xs = grid.xs, ys = grid.ys, occ = grid.occ;
        const nx = Math.max(0, xs.length-1), ny = Math.max(0, ys.length-1);
        if (nx<=0 || ny<=0) break;
        // Build heights from occ
        const widths = Array.from({length: nx}, (_,c)=> xs[c+1]-xs[c]);
        const heights = Array(nx).fill(0);
        let bestArea = 0, bestRect = null;
        for (let r=0;r<ny;r++){
            const dy = ys[r+1]-ys[r];
            for (let c=0;c<nx;c++) heights[c] = occ[r][c] ? 0 : (heights[c] + dy);
            const stack = [];
            for (let c=0;c<=nx;c++){
                const h = (c<nx) ? heights[c] : 0;
                const w = (c<nx) ? widths[c] : 0;
                let sumW = 0; let lastIdx = c;
                while (stack.length && stack[stack.length-1].height > h){
                    const top = stack.pop();
                    sumW += top.accWidth;
                    const area = top.height * sumW;
                    if (area > bestArea){
                        bestArea = area;
                        const xEnd = xs[c];
                        const xStart = xEnd - sumW;
                        const yEnd = ys[r+1];
                        const yStart = yEnd - top.height;
                        bestRect = { x: xStart, y: yStart, w: sumW, h: top.height };
                    }
                    lastIdx = top.idx;
                }
                const acc = (sumW || 0) + (c<nx ? w : 0);
                if (h>0){ stack.push({ idx: lastIdx, height: h, accWidth: acc }); }
            }
        }
    if (!bestRect || bestArea <= 1e-6) break;
        out.push(bestRect);
    carveRectFromGrid(grid.occ, grid.xs, grid.ys, bestRect, kerf, W, H);
        // loop to find next best
    }
    return out;
}

// Strict kerf margin rule: for each non-edge side, any gap to plate edge must be 0 or >= kerf
// and any gap to neighbor pieces (with orthogonal overlap) must be >= kerf (no touching).
function validKerfMargins(x, y, w, h, placed, W, H, kerf){
    const K = Math.max(0, kerf||0);
    if (K <= 0) return true;
    const eps = 1e-6;
    // Plate edges gaps
    const leftGap = x;
    if (leftGap > eps && leftGap + eps < K) return false;
    const rightGap = W - (x + w);
    if (rightGap > eps && rightGap + eps < K) return false;
    const bottomGap = y;
    if (bottomGap > eps && bottomGap + eps < K) return false;
    const topGap = H - (y + h);
    if (topGap > eps && topGap + eps < K) return false;
    // Neighbor pieces gaps
    const overlaps1D = (a0,a1,b0,b1)=> (Math.min(a1,b1) - Math.max(a0,b0)) > eps;
    for (const p of (placed||[])){
        if (!p) continue;
        // horizontal neighbors (left/right)
        const vOv = overlaps1D(y, y+h, p.y, p.y+p.h);
        if (vOv){
            // left neighbor
            if (p.x + p.w <= x + eps){
                const d = x - (p.x + p.w);
                if (d < K - eps) return false;
            }
            // right neighbor
            if (p.x >= x + w - eps){
                const d = p.x - (x + w);
                if (d < K - eps) return false;
            }
        }
        // vertical neighbors (bottom/top)
        const hOv = overlaps1D(x, x+w, p.x, p.x+p.w);
        if (hOv){
            // bottom neighbor
            if (p.y + p.h <= y + eps){
                const d = y - (p.y + p.h);
                if (d < K - eps) return false;
            }
            // top neighbor
            if (p.y >= y + h - eps){
                const d = p.y - (y + h);
                if (d < K - eps) return false;
            }
        }
    }
    return true;
}
// Free-rectangles packer: mode 'first-fit' or 'best-fit'
function packFreeRects(plate, parts, kerf, mode){
    const W = plate.Wmm, H = plate.Hmm;
    let free = [{x:0,y:0,w:W,h:H}];
    const placed = [];
    const order = parts.slice().sort((p,q)=> (q.w*q.h) - (p.w*p.h));
    for (const part of order){
        const scanned = free.map((fr,idx)=>({fr,idx})).sort((a,b)=>sortByBL(a.fr,b.fr));
        const can = (fr,pw,ph)=> (pw<=fr.w+1e-6 && ph<=fr.h+1e-6);
        // helper: simulate placing at (fr.x,fr.y) to score waste metric
        const scorePlace = (frIdx, rotFlag)=>{
            const fr = free[frIdx];
            const pw = rotFlag ? part.h : part.w;
            const ph = rotFlag ? part.w : part.h;
            if (!can(fr, pw, ph)) return null;
            // strict kerf rule: verify gaps to plate edges and to neighbors
            if (!validKerfMargins(fr.x, fr.y, pw, ph, placed, W, H, kerf)) return null;
            const newPlaced = placed.concat([{ x: fr.x, y: fr.y, w: pw, h: ph, src: part }]);
            // simulate free rects after split
            let newFree = free.slice();
            const frOld = newFree[frIdx];
            const split = splitFreeRect(frOld, pw, ph, kerf);
            newFree.splice(frIdx,1);
            newFree.push(...split);
            newFree = pruneFreeRects(newFree);
            const m = computeEmptyGridMetrics(newPlaced, W, H);
            return { frIdx, rot: rotFlag, pw, ph, metric: m };
        };
        // First-Fit: pick first by BL scanning; if both orientations fit at that cell, choose orientation by best metric
        if (mode==='first-fit'){
            let chosen = null;
            for (const {fr,idx} of scanned){
                if (can(fr, part.w, part.h) || can(fr, part.h, part.w)){
                    const candA = scorePlace(idx, false);
                    const candB = scorePlace(idx, true);
                    if (candA && candB){
                        const a=candA.metric, b=candB.metric;
                        const better = (a.a1!==b.a1) ? (a.a1>b.a1) : (a.a2!==b.a2) ? (a.a2>b.a2) : (a.count<b.count);
                        chosen = better ? candA : candB;
                    } else {
                        chosen = candA || candB;
                    }
                    break; // first fit cell decided
                }
            }
            if (!chosen) continue;
            const fr = free[chosen.frIdx];
            if (!validKerfMargins(fr.x, fr.y, chosen.pw, chosen.ph, placed, W, H, kerf)) continue;
            placed.push({ x: fr.x, y: fr.y, w: chosen.pw, h: chosen.ph, src: part });
            const newRects = splitFreeRect(fr, chosen.pw, chosen.ph, kerf);
            free.splice(chosen.frIdx,1);
            free.push(...newRects);
            free = pruneFreeRects(free);
            continue;
        }
        // Best-Fit: pick by minimal leftover area; if tie or when comparing orientations, break ties by waste metric
        let best = null; // {frIdx, rot, pw, ph, leftover, metric}
        for (const {fr,idx} of scanned){
            if (can(fr, part.w, part.h)){
                const cand = scorePlace(idx, false);
                if (cand){
                    const leftover = (fr.w*fr.h) - (part.w*part.h);
                    cand.leftover = leftover;
                    if (!best || leftover < best.leftover || (Math.abs(leftover-best.leftover) < 1e-6 && (
                        cand.metric.a1>best.metric.a1 || (cand.metric.a1===best.metric.a1 && (cand.metric.a2>best.metric.a2 || (cand.metric.a2===best.metric.a2 && cand.metric.count<best.metric.count)))
                    ))) best = cand;
                }
            }
            if (can(fr, part.h, part.w)){
                const cand = scorePlace(idx, true);
                if (cand){
                    const leftover = (fr.w*fr.h) - (part.w*part.h);
                    cand.leftover = leftover;
                    if (!best || leftover < best.leftover || (Math.abs(leftover-best.leftover) < 1e-6 && (
                        cand.metric.a1>best.metric.a1 || (cand.metric.a1===best.metric.a1 && (cand.metric.a2>best.metric.a2 || (cand.metric.a2===best.metric.a2 && cand.metric.count<best.metric.count)))
                    ))) best = cand;
                }
            }
        }
        if (!best) continue;
    const fr = free[best.frIdx];
    if (!validKerfMargins(fr.x, fr.y, best.pw, best.ph, placed, W, H, kerf)) continue;
        placed.push({ x: fr.x, y: fr.y, w: best.pw, h: best.ph, src: part });
        const newRects = splitFreeRect(fr, best.pw, best.ph, kerf);
        free.splice(best.frIdx,1);
        free.push(...newRects);
        free = pruneFreeRects(free);
    }
    // remaining = parts not placed by id
    const placedIds = new Set(placed.map(p=>p.src.__id));
    const remaining = parts.filter(p=>!placedIds.has(p.__id));
    return { placed, freeRects: free, remaining };
}
// Shelving packer
function packShelves(plate, parts, kerf){
    const W = plate.Wmm, H = plate.Hmm;
    const order = parts.slice().sort((a,b)=> (Math.max(b.w,b.h) - Math.max(a.w,a.h)) );
    const placed = [];
    let x=0, y=0, shelfH=0;
    for (const part of order){
        // choose orientation by maximizing waste metric after placement at candidate spot
        const tryPlace = (px,py,pw,ph)=>{
            if (px+pw>W+1e-6 || py+ph>H+1e-6) return null;
            if (!validKerfMargins(px, py, pw, ph, placed, W, H, kerf)) return null;
            const newPlaced = placed.concat([{x:px,y:py,w:pw,h:ph,src:part}]);
            const m = computeEmptyGridMetrics(newPlaced, W, H);
            return {x:px,y:py,w:pw,h:ph,metric:m};
        };
        const candA = tryPlace(x,y, part.w, part.h);
        const candB = tryPlace(x,y, part.h, part.w);
        let chosen = null;
        const better = (a,b)=> a && (!b || a.metric.a1>b.metric.a1 || (a.metric.a1===b.metric.a1 && (a.metric.a2>b.metric.a2 || (a.metric.a2===b.metric.a2 && a.metric.count<b.metric.count))));
        if (better(candA,candB)) chosen = candA;
        else if (better(candB,candA)) chosen = candB;
        if (chosen){
            placed.push({x:chosen.x,y:chosen.y,w:chosen.w,h:chosen.h,src:part});
            x += chosen.w + kerf;
            shelfH = Math.max(shelfH, chosen.h);
        } else {
            // new shelf
            x = 0; y += shelfH + kerf; shelfH = 0;
            const candA2 = tryPlace(x,y, part.w, part.h);
            const candB2 = tryPlace(x,y, part.h, part.w);
            if (better(candA2,candB2)) chosen = candA2;
            else if (better(candB2,candA2)) chosen = candB2;
            if (chosen){
                placed.push({x:chosen.x,y:chosen.y,w:chosen.w,h:chosen.h,src:part});
                x += chosen.w + kerf;
                shelfH = Math.max(shelfH, chosen.h);
            }
        }
    }
    const freeRects = [];
    if (shelfH>0 && x < W){ freeRects.push({ x, y, w: Math.max(0, W-x), h: shelfH }); }
    if (y + shelfH + kerf < H){ freeRects.push({ x:0, y:y+shelfH+kerf, w: W, h: Math.max(0, H-(y+shelfH+kerf)) }); }
    const placedIds = new Set(placed.map(p=>p.src.__id));
    const remaining = parts.filter(p=>!placedIds.has(p.__id));
    return { placed, freeRects, remaining };
}

function packPlatesForGroup(groupKey, rects, kerfMM){
    // Build candidate plates from inventory (matching type+thickness and classified as plate)
    const tIdx = getTypeColIndex();
    const thIdx = getThicknessColIndex();
    const wIdx = getWidthColIndex();
    const lIdx = getLengthColIndex();
    const priceIdx = getPriceColIndex();
    const supplierIdx = getSupplierColIndex();
    const materialIdx = getMaterialColIndex();
    const wU = inventoryUnits[wIdx] || '';
    const lU = inventoryUnits[lIdx] || '';
    const cands = (inventoryData||[])
        .map((row,i)=>({row,i}))
        .filter(({row})=> String(row[tIdx])===groupKey.type && String(row[thIdx])===groupKey.thickness && classificationIsPlate(getClassificationFor(String(row[tIdx]), String(row[thIdx]))))
        .map(({row})=>({
            Wmm: toMM(row[wIdx], wU),
            Hmm: toMM(row[lIdx], lU),
            price: isFinite(Number(row[priceIdx])) ? Number(row[priceIdx]) : 0,
            supplier: row[supplierIdx] || '',
            material: row[materialIdx] || ''
        }))
        .filter(p=> isFinite(p.Wmm)&&isFinite(p.Hmm) && p.Wmm>0 && p.Hmm>0)
        .sort((a,b)=> (a.price - b.price) || ((a.Wmm*a.Hmm) - (b.Wmm*b.Hmm)));
    if (!cands.length) return null;
    // Tag parts
    let __id=1; const parts = rects.map(r=>({w:r.w, h:r.h, tag:r.tag||'', __id:__id++}));
    const bestOnPlate = (plate, parts) => {
        const A = packFreeRects(plate, parts, kerfMM, 'first-fit');
        const B = packFreeRects(plate, parts, kerfMM, 'best-fit');
        const C = packShelves(plate, parts, kerfMM);
        const all = [A,B,C];
        const allFit = all.filter(r=> (r.remaining||[]).length===0);
        if (allFit.length){
            let best = allFit[0];
            for (const r of allFit){ if (betterLayoutByWaste(r,best, plate)) best = r; }
            return best;
        }
        let best = all[0];
        for (const r of all){
            const pc = (r.placed||[]).length, bc = (best.placed||[]).length;
            if (pc>bc || (pc===bc && betterLayoutByWaste(r,best, plate))) best = r;
        }
        return best;
    };
    // Try single-plate fit on each candidate
    let bestSingle = null;
    for (const c of cands){
        const layout = bestOnPlate(c, parts);
        if ((layout.remaining||[]).length===0){
            const item = { plate:c, layouts:[layout] };
            if (!bestSingle || c.price < bestSingle.plate.price) bestSingle = item;
        }
    }
    // If a single plate can fit all parts, choose the cheapest such plate (Stage 1+2)
    if (bestSingle) return { used: [bestSingle] };

    // Stage 3: multi-plate packing by ascending price, one plate per iteration
    let remaining = parts.slice();
    const used = [];
    let guard = 0;
    while (remaining.length && guard < 200){
        guard++;
        let placedSomething = false;
        for (const c of cands){
            if (!remaining.length) break;
            const layout = bestOnPlate(c, remaining);
            if ((layout.placed||[]).length){
                used.push({ plate:c, layouts:[layout] });
                const ids = new Set(layout.placed.map(p=>p.src.__id));
                remaining = remaining.filter(p=>!ids.has(p.__id));
                placedSomething = true;
                break; // move to next plate (next loop iteration)
            }
        }
        if (!placedSomething) break;
    }
    if (remaining.length===0) return { used };
    return { used, remaining };
}

// =========================================
// אוסף הדרישות והפעלה
function computeOptimization() {
    // קרא עובי מסור מהממשק (ברירת מחדל 3 מ"מ)
    const getKerfMM = () => {
        try {
            const inp = document.getElementById('saw-thickness');
            const raw = Number(inp?.value || NaN);
            const unit = (unitSystem === 'imperial') ? 'in' : 'mm';
            const val = toMM(raw, unit);
            if (isFinite(val) && val > 0) return val;
        } catch(_){ }
        // fallback to saved kerf
        try { const saved = Number(loadData('kerfMM')); if (isFinite(saved) && saved>0) return saved; } catch{}
        return 3;
    };
    const kerfMMConst = getKerfMM();
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

    // Group requirements into Beams (1D) and Plates (2D)
    const groupsBeams = new Map(); // {type,thickness,width} => cuts array (number mm or {len:mm, tag})
    const groupsPlates = new Map(); // {type,thickness} => rects {w,h,tag}
    for (const r of reqs){
        const type = r.type;
        const thickness = r.thickness;
        const classification = getClassificationFor(type, thickness);
        const isPlate = classification && classificationIsPlate(classification);
        if (isPlate){
            const qty = Math.max(1, Number(r.qty)||1);
            const wReqMM = toMM(Number(r.width||0), unitSystem==='imperial' ? 'in' : 'cm');
            const hReqMM = toMM(Number(r.length||0), unitSystem==='imperial' ? 'in' : 'cm');
            if (!isFinite(wReqMM) || !isFinite(hReqMM) || wReqMM<=0 || hReqMM<=0) continue;
            const key = JSON.stringify({type, thickness});
            if (!groupsPlates.has(key)) groupsPlates.set(key, []);
            const list = groupsPlates.get(key);
            for (let i=0;i<qty;i++) list.push({ w:wReqMM, h:hReqMM, tag: r.tag||'' });
        } else {
            const widthVal = r.width; // may be select value
            const lReqMM = toMM(r.length, unitSystem==='imperial' ? 'in' : 'cm');
            if (!isFinite(lReqMM) || lReqMM<=0) continue;
            const key = JSON.stringify({type, thickness, width: String(widthVal)});
            if (!groupsBeams.has(key)) groupsBeams.set(key, []);
            const list = groupsBeams.get(key);
            for (let i=0;i<(r.qty||1);i++) list.push({ len: lReqMM, tag: r.tag || '' });
        }
    }

    const errors = [];
    let totalBaseCost = 0;
    const beamsResult = [];
    // Solve Beams
    for (const [keyStr, cuts] of groupsBeams.entries()){
        const key = JSON.parse(keyStr);
        const plan = planBeamsForGroup(key, cuts, kerfMMConst);
        if (!plan){
            errors.push(language==='he' ? `לא נמצאה קורה מתאימה עבור ${key.type} ${key.thickness}/${key.width}` : `No suitable beam for ${key.type} ${key.thickness}/${key.width}`);
            continue;
        }
        totalBaseCost += (plan.option.price || 0) * plan.bars.length;
        const lenDispFromMM = (mm)=> unitSystem==='imperial' ? (mm/25.4) : (mm/1000);
        for (const bar of plan.bars){
            // bar.pieces are objects {len, tag}
            const cutsDisp = bar.pieces.map(p => unitSystem==='imperial' ? (p.len/25.4) : (p.len/10));
            const tags = bar.pieces.map(p => String(p.tag||''));
            const wasteDisp = unitSystem==='imperial' ? (bar.waste/25.4) : (bar.waste/10);
            const wastePct = plan.option.Lmm>0 ? (bar.waste/plan.option.Lmm)*100 : 0;
            beamsResult.push({
                type: key.type,
                classification: language==='he' ? 'קורה' : 'Beam',
                material: plan.option.material || '',
                thickness: key.thickness,
                width: key.width,
                lengthDisp: lenDispFromMM(plan.option.Lmm),
                priceBase: plan.option.price || 0,
                supplier: plan.option.supplier || '',
                cutsDisp,
                tags,
                wasteDisp,
                wastePct,
                kerfMM: kerfMMConst
            });
        }
    }
    // Solve Plates via new guillotine optimizer
    const platesResult = [];
    try {
        // Build userReqs for plates only from groupsPlates
        const userReqs = [];
        for (const [keyStr, rects] of groupsPlates.entries()){
            const key = JSON.parse(keyStr);
            for (const r of rects){
                userReqs.push({
                    material: '',
                    type: key.type,
                    thickness: key.thickness,
                    width: unitSystem==='imperial' ? (r.w/25.4) : r.w, // inches or mm
                    height: unitSystem==='imperial' ? (r.h/25.4) : r.h,
                    qty: 1
                });
            }
        }
        // Build plateDB from inventory rows (only classification===Plate)
        const tIdxV = getTypeColIndex();
        const thIdxV = getThicknessColIndex();
        const wIdxV = getWidthColIndex();
        const lIdxV = getLengthColIndex();
        const priceIdxV = getPriceColIndex();
        const supplierIdxV = getSupplierColIndex();
        const matIdxV = getMaterialColIndex();
        const wUnitV = inventoryUnits[wIdxV] || '';
        const lUnitV = inventoryUnits[lIdxV] || '';
        const plateDB = (inventoryData||[]).map(row=>({
            חומר: String(row[matIdxV]||''),
            סוג: String(row[tIdxV]||''),
            סיווג: String(getClassificationFor(String(row[tIdxV]), String(row[thIdxV]))||''),
            עובי: Number(row[thIdxV]),
            רוחב: fromMM(toMM(row[wIdxV], wUnitV), unitSystem==='imperial'?'inch':'mm'),
            אורך: fromMM(toMM(row[lIdxV], lUnitV), unitSystem==='imperial'?'inch':'mm'),
            מחיר: parseFloat(String(row[priceIdxV] ?? '').replace(/[^0-9.\-]/g,'')) || 0,
            ספק: String(row[supplierIdxV]||'')
        }));
        const paramsG = {
            kerf: Number(document.getElementById('kerf')?.value || kerfMMConst),
            displayKerfMin: 15,
            units: unitSystem==='imperial' ? 'inch' : 'mm',
            showCutOrder: !!displaySettings.cutOrderOn
        };
        if (typeof optimizeCuttingAllGroups === 'function'){
            const groupsOut = optimizeCuttingAllGroups(userReqs, plateDB, paramsG) || [];
            // Map to existing platesResult items for rendering
            for (const g of groupsOut){
                if (!g || !g.cutPlan) continue;
                for (const pl of g.cutPlan){
                    totalBaseCost += Number(pl.platePrice)||0;
                    // produce a cutsDisp array of WxH strings
                    const cutsDisp = (pl.parts||[]).map(p=>{
                        const a = unitSystem==='imperial' ? p.w : (p.w/10);
                        const b = unitSystem==='imperial' ? p.h : (p.h/10);
                        return `${formatSmart(a)}×${formatSmart(b)}`;
                    });
                    const Wmm = unitSystem==='imperial' ? (Number(pl.plateWidth)*25.4) : (Number(pl.plateWidth)*1);
                    const Hmm = unitSystem==='imperial' ? (Number(pl.plateHeight)*25.4) : (Number(pl.plateHeight)*1);
                    platesResult.push({
                        type: pl.plateType,
                        classification: language==='he'?'פלטה':'Plate',
                        thickness: pl.thickness,
                        width: Number(pl.plateWidth),
                        length: Number(pl.plateHeight),
                        priceBase: Number(pl.platePrice)||0,
                        supplier: pl.supplier || '',
                        material: pl.material || '',
                        cutsDisp,
                        wasteAreaM2: 0,
                        wastePct: Number(pl.wastePercent)||0,
                        plateWmm: Wmm,
                        plateHmm: Hmm,
                        kerfMM: kerfMMConst,
                        placed: (pl.parts||[]).map(p=>({x:p.x,y:p.y,w:p.w,h:p.h,srcW:p.w,srcH:p.h, tag: p.tag || ''})),
                        freeRects: (pl.wasteRects||[]).map(fr=>({x:fr.x,y:fr.y,w:fr.w,h:fr.h})),
                        svg: pl.svg
                    });
                }
            }
        } else {
            console.warn('optimizeCuttingAllGroups not found');
        }
    } catch(e){ console.error('Plate optimization failed', e); }

    // מס' מוצרים אפשריים — חישוב קונסרבטיבי מדויק יותר
    // beams: כמה סטים של כל דרישות הקבוצה נכנסים ברכישות שבוצעו
    let maxProducts = Infinity;
    for (const [keyStr, cuts] of groupsBeams.entries()) {
        const key = JSON.parse(keyStr);
        const plan = planBeamsForGroup(key, cuts, kerfMMConst);
        if (!plan) { maxProducts = 0; continue; }
        const cutsMM = cuts.map(c => typeof c === 'number' ? c : Number(c.len)||0).filter(v=>isFinite(v)&&v>0);
        // אם כל החתיכות שוות — חשב כושר לקורה אחת: floor((L+kerf)/(p+kerf))
        const allEqual = cutsMM.every(v => Math.abs(v - cutsMM[0]) < 1e-6);
        if (allEqual && cutsMM.length > 0) {
            const p = cutsMM[0];
            const perBar = Math.floor((plan.option.Lmm + kerfMMConst) / (p + kerfMMConst));
            const totalPiecesPossible = perBar * plan.bars.length;
            const neededPerProduct = cutsMM.length; // סט אחד = כמות הדרישות (כי allEqual מייצג את הסט)
            const possible = neededPerProduct > 0 ? Math.floor(totalPiecesPossible / neededPerProduct) : 0;
            maxProducts = Math.min(maxProducts, Math.max(1, possible));
        } else {
            // ברירת מחדל: יחס אורכים שמרני כולל kerf בין חלקים בסט
            const perSet = cutsMM.reduce((a,b)=> a + b, 0) + Math.max(0, cutsMM.length-1) * kerfMMConst;
            const totalAvailable = plan.bars.length * plan.option.Lmm;
            const possible = perSet>0 ? Math.floor(totalAvailable / perSet) : 0;
            maxProducts = Math.min(maxProducts, Math.max(1, possible));
        }
    }
    // Plate max-products calculation removed
    if (maxProducts === Infinity) maxProducts = 1;

    return { beams: beamsResult, plates: platesResult, totals: { baseCurrency: inventoryPriceCurrencyUnit || '€', totalCost: totalBaseCost, maxProducts }, errors };
}

function currencySymbol() {
    const sel = document.getElementById('select-currency');
    const val = sel ? sel.value : loadData('currencySymbol');
    return normalizeCurrencySymbol(val || inventoryPriceCurrencyUnit || '€');
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
            ? (unitSystem==='imperial' ? `פחת (אינץ׳)` : `פחת (ס״מ)`)
            : (unitSystem==='imperial' ? `Waste (inch)` : `Waste (cm)`);
        const rows = [];
        for (const r of results.beams) {
            const cuts = (unitSystem==='imperial'
                ? r.cutsDisp.map(v=> `${formatSmart(v)}${inchSym}`).join(', ')
                : r.cutsDisp.map(v=> formatSmart(v)).join(', '));
            // המרת עובי/רוחב לתצוגה לפי יחידות
            const thIdx = getThicknessColIndex();
            const wIdx = getWidthColIndex();
            const thU = inventoryUnits[thIdx] || '';
            const wU = inventoryUnits[wIdx] || '';
            const thDisp = unitSystem==='imperial' ? convertNumberByUnit(r.thickness, thU, 'imperial') : Number(r.thickness);
            const wDisp = unitSystem==='imperial' ? convertNumberByUnit(r.width, wU, 'imperial') : Number(r.width);
            const thCell = unitSystem==='imperial' ? `${formatSmart(thDisp)}${inchSym}` : `${formatSmart(thDisp)}`;
            const wCell = unitSystem==='imperial' ? `${formatSmart(wDisp)}${inchSym}` : `${formatSmart(wDisp)}`;
            const lenCell = unitSystem==='imperial' ? `${formatSmart(r.lengthDisp)}${inchSym}` : `${formatSmart(r.lengthDisp)}`;
            const wasteVal = unitSystem==='imperial' ? `${formatSmart(r.wasteDisp)}${inchSym}` : `${formatSmart(r.wasteDisp)}`;
            const row = [];
            row.push(r.type);
            if (resultsColSettings.showClassification) row.push(r.classification);
            if (resultsColSettings.showMaterial) row.push(r.material || '');
            row.push(thCell);
            row.push(wCell);
            row.push(lenCell);
            row.push(`${formatSmart(convertBaseToDisplayCurrency(r.priceBase))}`);
            if (resultsColSettings.showSupplier) row.push(r.supplier || '');
            row.push(cuts);
            if (resultsColSettings.showWasteValue) row.push(wasteVal);
            if (resultsColSettings.showWastePct) row.push(`${formatSmart(r.wastePct)}%`);
            rows.push(row);
        }
        // Plates rows (added)
        for (const r of (results.plates||[])) {
            const thDisp = unitSystem==='imperial' ? convertNumberByUnit(r.thickness, thU, 'imperial') : Number(r.thickness);
            const wDisp = unitSystem==='imperial' ? convertNumberByUnit(r.width, wU, 'imperial') : Number(r.width);
            const lenDisp = unitSystem==='imperial' ? (Number(r.plateHmm)/25.4) : (Number(r.plateHmm)/1000); // plate length shown in Length column header units
            const thCell = unitSystem==='imperial' ? `${formatSmart(thDisp)}${inchSym}` : `${formatSmart(thDisp)}`;
            const wCell = unitSystem==='imperial' ? `${formatSmart(wDisp)}${inchSym}` : `${formatSmart(wDisp)}`;
            const lenCell = unitSystem==='imperial' ? `${formatSmart(lenDisp)}${inchSym}` : `${formatSmart(lenDisp)}`;
            const cuts = (r.cutsDisp||[]).join(', ');
            const row = [];
            row.push(r.type);
            if (resultsColSettings.showClassification) row.push(r.classification|| (language==='he'?'פלטה':'Plate'));
            if (resultsColSettings.showMaterial) row.push(r.material || '');
            row.push(thCell);
            row.push(wCell);
            row.push(lenCell);
            row.push(`${formatSmart(convertBaseToDisplayCurrency(r.priceBase||0))}`);
            if (resultsColSettings.showSupplier) row.push(r.supplier || '');
            row.push(cuts);
            if (resultsColSettings.showWasteValue) row.push('–'); // plate waste is area; leave length-based waste empty
            if (resultsColSettings.showWastePct) row.push(`${formatSmart(r.wastePct||0)}%`);
            rows.push(row);
        }
        const headers = (function(){
            const he = language==='he';
            const arr = [];
            arr.push(he?'סוג':'Type');
            if (resultsColSettings.showClassification) arr.push(he?'סיווג':'Class');
            if (resultsColSettings.showMaterial) arr.push(he?'חומר':'Material');
            arr.push(he?`עובי (${convertedUnitLabelLocalized(thU, unitSystem, language)})`:`Thickness (${convertedUnitLabelLocalized(thU, unitSystem, language)})`);
            arr.push(he?`רוחב (${convertedUnitLabelLocalized(wU, unitSystem, language)})`:`Width (${convertedUnitLabelLocalized(wU, unitSystem, language)})`);
            arr.push(he?`אורך (${lenUnitLbl})`:`Length (${lenUnitLbl})`);
            arr.push(he?`מחיר (${priceSym})`:`Price (${priceSym})`);
            if (resultsColSettings.showSupplier) arr.push(he?'ספק':'Supplier');
            arr.push(cutsHeader);
            if (resultsColSettings.showWasteValue) arr.push(wasteHeader);
            if (resultsColSettings.showWastePct) arr.push(he?'פחת (%)':'Waste (%)');
            return arr;
        })();
        return buildHtmlTable(headers, rows);
    }

    function table2() {
        const total = convertBaseToDisplayCurrency(results.totals.totalCost);
        const maxProds = Math.max(1, results.totals.maxProducts|0);
        const pricePer = total / Math.max(1, maxProds);
        const he = (language==='he');
        const headers = [];
        const row = [];
        if (he) { headers.push('מחיר כולל'); row.push(`${formatSmart(total)} ${priceSym}`); }
        else { headers.push('Total Price'); row.push(`${formatSmart(total)} ${priceSym}`); }
        if (resultsColSettings.showMaxProducts) {
            if (he) { headers.push('מס׳ מוצרים אפשריים'); row.push(`${maxProds}`); }
            else { headers.push('Max Products'); row.push(`${maxProds}`); }
        }
        // Show Price per Product only when Max Products column is selected
        if (resultsColSettings.showMaxProducts) {
            if (he) { headers.push('מחיר עבור מוצר'); row.push(`${formatSmart(pricePer)} ${priceSym}`); }
            else { headers.push('Price per Product'); row.push(`${formatSmart(pricePer)} ${priceSym}`); }
        }
        return buildHtmlTable(headers, [row]);
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
        const all = ([]).concat(results.beams||[], results.plates||[]);
        for (const r of all) {
            const lenVal = (typeof r.lengthDisp !== 'undefined')
                ? r.lengthDisp
                : (unitSystem==='imperial' ? (Number(r.plateHmm)||0)/25.4 : (Number(r.plateHmm)||0)/1000);
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
            // All sliders/features are unlocked for now
            const isSubscribed = true;
            const fontSel = `
                <select id="ds-font" class="btn select">
                    <option value="regular" ${displaySettings.fontWeight==='regular'?'selected':''}>${t.regular}</option>
                    <option value="bold" ${displaySettings.fontWeight==='bold'?'selected':''}>${t.bold}</option>
                </select>`;
            const fontSizeSel = `
                <select id="ds-font-size" class="btn select">
                    <option value="small" ${displaySettings.fontSize==='small'?'selected':''}>${language==='he'?'קטן':'Small'}</option>
                    <option value="normal" ${displaySettings.fontSize==='normal'?'selected':''}>${language==='he'?'רגיל':'Normal'}</option>
                    <option value="large" ${displaySettings.fontSize==='large'?'selected':''}>${language==='he'?'גדול':'Large'}</option>
                </select>`;
            // יחידות תצוגה לדיאגרמות
            const unitOptions = (unitSystem==='imperial')
                ? [{v:'in', l:(language==='he'?'אינץ׳':'inch')}]
                : [
                    {v:'mm', l:(language==='he'?'מ״מ':'mm')},
                    {v:'cm', l:(language==='he'?'ס"מ':'cm')},
                    {v:'m',  l:(language==='he'?'מ׳':'m')}
                ];
            const unitSel = `<select id="ds-unit" class="btn select">${unitOptions.map(o=>`<option value="${o.v}" ${displaySettings.displayUnit===o.v?'selected':''}>${o.l}</option>`).join('')}</select>`;
            // Columns toggles (after display settings)
        const colToggles = `
                <div class="res-cols" style="display:flex; gap:14px; align-items:center; flex-wrap:wrap">
                    <label style="display:flex; align-items:center; gap:6px"><span>${language==='he'?'חומר':'Material'}</span><input type="checkbox" id="col-material" ${resultsColSettings.showMaterial?'checked':''} style="transform:scale(1.5);" /></label>
                    <label style="display:flex; align-items:center; gap:6px"><span>${language==='he'?'סיווג':'Classification'}</span><input type="checkbox" id="col-classification" ${resultsColSettings.showClassification?'checked':''} style="transform:scale(1.5);" /></label>
                    <label style="display:flex; align-items:center; gap:6px"><span>${language==='he'?'ספק':'Supplier'}</span><input type="checkbox" id="col-supplier" ${resultsColSettings.showSupplier?'checked':''} style="transform:scale(1.5);" /></label>
                    <label style="display:flex; align-items:center; gap:6px"><span>${language==='he'?'פחת':'Waste'}</span><input type="checkbox" id="col-waste" ${resultsColSettings.showWasteValue?'checked':''} style="transform:scale(1.5);" /></label>
                    <label style="display:flex; align-items:center; gap:6px"><span>${language==='he'?'פחת %':'Waste %'}</span><input type="checkbox" id="col-wastepct" ${resultsColSettings.showWastePct?'checked':''} style="transform:scale(1.5);" /></label>
            <label style="display:flex; align-items:center; gap:6px"><span>${language==='he'?'מס׳ מוצרים אפשריים 🔒':'Max Products 🔒'}</span><input type="checkbox" id="col-maxproducts" ${resultsColSettings.showMaxProducts?'checked':''} style="transform:scale(1.5);" /></label>
                </div>`;
            return `
                <div id="display-settings" style="margin:8px 0; display:flex; align-items:flex-start; gap:10px;">
                    <div class="ds-side" style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <button id="btn-display-settings" class="btn" title="${t.displaySettingsTitle}" style="font-size:22px; padding:8px 12px; filter: drop-shadow(0 1px 1px rgba(0,0,0,.15));">⚙️</button>
                        <button id="res-print" class="btn" title="${language==='he'?'הדפס מיד':'Print now'}" style="font-size:18px; padding:8px 10px;">🖨️</button>
                    </div>
                    <div id="display-settings-panel" style="margin:8px auto 0; border:1px solid #ddd; padding:10px 12px; border-radius:10px; max-width:100%; background:#fff; display:${displaySettings.panelOpen?'flex':'none'}; gap:22px; align-items:center; justify-content:center; flex:1; flex-wrap:wrap;">
                        <!-- Extra info: keep text to the right of its slider in RTL via CSS order rules -->
                        <label style="display:flex; align-items:center; gap:10px; flex-direction:row;">
                            <input type="checkbox" id="ds-labels" ${checked(displaySettings.showPieceLabels)} style="display:none;" />
                            <span id="ds-labels-switch" class="switch" data-on="${displaySettings.showPieceLabels?1:0}" role="switch" aria-checked="${displaySettings.showPieceLabels?'true':'false'}" tabindex="0">
                                <span class="knob"></span>
                            </span>
                            <span class="ds-text-extra">${t.extraInfo}</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:10px;">
                            <span>${t.compressedView}</span>
                            <input type="checkbox" id="ds-compressed" ${checked(displaySettings.compressedView)} style="display:none;" />
                            <span id="ds-compressed-switch" class="switch" data-on="${displaySettings.compressedView?1:0}" role="switch" aria-checked="${displaySettings.compressedView?'true':'false'}" tabindex="0">
                                <span class="knob"></span>
                            </span>
                        </label>
                        <label style="display:flex; align-items:center; gap:10px;">
                            <span>${language==='he'?'סדר חיתוכים':'Cut order'}</span>
                            <input type="checkbox" id="ds-cutorder" ${checked(displaySettings.cutOrderOn)} style="display:none;" />
                            <span id="ds-cutorder-switch" class="switch" data-on="${displaySettings.cutOrderOn?1:0}" role="switch" aria-checked="${displaySettings.cutOrderOn?'true':'false'}" tabindex="0">
                                <span class="knob" style="color:${displaySettings.cutOrderOn ? '#000' : '#ccc'}; text-align:center; line-height:20px;">🔒</span>
                            </span>
                        </label>
                        <label style="display:flex; align-items:center; gap:10px;">
                            <span>${t.tags}</span>
                            <input type="checkbox" id="ds-tags" ${displaySettings.showTags?'checked':''} style="display:none;" />
                            <span id="ds-tags-switch" class="switch" data-on="${displaySettings.showTags?1:0}" role="switch" aria-checked="${displaySettings.showTags?'true':'false'}" tabindex="0">
                                <span class="knob" style="color:${displaySettings.showTags ? '#000' : '#ccc'}; text-align:center; line-height:20px;">🔒</span>
                            </span>
                        </label>
                        <label style="display:flex; align-items:center; gap:10px;">
                            <span>${language==='he'?'צבע חיתוכים':'Cuts color'}</span>
                            <input type="checkbox" id="ds-color" ${checked(displaySettings.colorPieces)} style="display:none;" />
                            <span id="ds-color-switch" class="switch" data-on="${displaySettings.colorPieces?1:0}" role="switch" aria-checked="${displaySettings.colorPieces?'true':'false'}" tabindex="0">
                                <span class="knob"></span>
                            </span>
                        </label>
                        <label style="display:flex; align-items:center; gap:10px;">
                            <span>${t.fontSize}</span>
                            ${fontSel}
                        </label>
                        <label style="display:flex; align-items:center; gap:10px;">
                            <span>${language==='he'?'גודל טקסט':'Text size'}</span>
                            ${fontSizeSel}
                        </label>
                        <label style="display:flex; align-items:center; gap:10px;">
                            <span>${language==='he'?'יחידות תצוגה':'Diagram units'}</span>
                            ${unitSel}
                        </label>
                        <div style="flex:1 0 100%"></div>
                        ${colToggles}
                    </div>
                </div>`;
        }
    // We build diagrams separately from the settings panel so compressed view doesn't shrink the panel
    let idx = 1;
    const settingsHtml = settingsPanel();
    const beamItems = [];
    const beamSections = [];
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
            // Save both a standalone section and a compact pairable item
            const singleSection = `<div class="results-section"><h3 class="item-title"${h3Dir}>${title}</h3>${beamSvg(r)}</div>`;
            const pairItem = `<div class="pair-item"><h4 class="item-title"${h3Dir} style="margin:4px 0 6px; font-size:14px;">${title}</h4>${beamSvg(r)}</div>`;
            beamSections.push(singleSection);
            beamItems.push(pairItem);
            idx++;
        }
        // plates diagrams
        const plateSections = [];
        for (const r of (results.plates||[])) {
            const thIdx = getThicknessColIndex();
            const thU = inventoryUnits[thIdx] || '';
            const thMM = toMM(r.thickness, thU);
            const Wmm = Number(r.plateWmm)||0;
            const Hmm = Number(r.plateHmm)||0;
            const inchSym = '″';
            let title;
            if (unitSystem === 'imperial') {
                const thIn = thMM/25.4, wIn = Wmm/25.4, hIn = Hmm/25.4;
                title = (language==='he')
                    ? `פריט ${idx} — ${r.type} ${formatSmart(thIn)}${inchSym}×${formatSmart(wIn)}${inchSym}×${formatSmart(hIn)}${inchSym}`
                    : `Item ${idx} — ${r.type} ${formatSmart(thIn)}${inchSym}×${formatSmart(wIn)}${inchSym}×${formatSmart(hIn)}${inchSym}`;
            } else {
                title = (language==='he')
                    ? `פריט ${idx} — ${r.type} ${formatSmart(thMM)}×${formatSmart(Wmm)}×${formatSmart(Hmm)} מ״מ`
                    : `Item ${idx} — ${r.type} ${formatSmart(thMM)}×${formatSmart(Wmm)}×${formatSmart(Hmm)} mm`;
            }
            const h3Dir = (language==='he') ? ' dir="rtl"' : '';
            plateSections.push(`<div class="results-section"><h3 class="item-title"${h3Dir}>${title}</h3>${plateSvg(r)}</div>`);
            idx++;
        }
        // When compressed: pair two beam diagrams into one section; plates remain one per section.
        if (displaySettings.compressedView) {
            const paired = [];
            for (let i = 0; i < beamItems.length; i += 2) {
                const a = beamItems[i];
                const b = beamItems[i+1] || '';
                // Responsive 2-up layout that stacks on narrow screens
                paired.push(
                    `<div class="results-section">
                        <div class="beam-pair" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:16px; align-items:start;">
                            ${a}${b}
                        </div>
                    </div>`
                );
            }
            // Compose final HTML: settings panel first (full width), then paired beams, then plates
            return [
                settingsHtml,
                ...paired,
                ...plateSections
            ].join('');
        }
        // Non-compressed: settings panel followed by each beam/plate section as-is
        return [
            settingsHtml,
            ...beamSections,
            ...plateSections
        ].join('');
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
    const leftPad = 34, rightPad = 8;
    const drawW = Math.max(100, w - leftPad - rightPad);
    const scale = total>0 ? (drawW / total) : 1;
    let x = leftPad;
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
    // kerf בפועל: קרא מהתוצאה (ברירת מחדל 3 מ"מ) -> מומרים ליחידת הסקייל (מ' במטרי / אינץ' באימפריאלי) ואז לפיקסלים
    const kerfMMConst = isFinite(Number(r.kerfMM)) ? Number(r.kerfMM) : 3;
    const kerfUnits = unitSystem==='imperial' ? (kerfMMConst/25.4) : (kerfMMConst/1000); // inch או meters
        const kerfPx = kerfUnits * scale; // מרווח kerf בפיקסלים
            const rects = [];
            let clipDefs = [];
                const defsBase = `
                    <pattern id="${svgId}_wasteHatch" patternUnits="userSpaceOnUse" width="8" height="8">
                        <g stroke="#c8c8c8" stroke-width="2">
                            <line x1="0" y1="8" x2="8" y2="0" />
                        </g>
                    </pattern>`;
            // רקע ברירת מחדל לכל אזור הקורה — אפור בלבד (פחת), ללא הצלבה
            const barY = Math.round(10 * m);
            const barH = Math.round(40 * m);
            rects.push(`<rect x="${leftPad}" y="${barY}" width="${drawW}" height="${barH}" fill="#f3f3f3" />`);
            // אין שכבת hatch על כל הסרגל — ההצלבה תצויר רק ב-kerf
    const unitShort = ''; // הצגה ללא יחידות על הדיאגרמות
    const showLabels = !!displaySettings.showPieceLabels;
    // פונקציית עזר: גודל פונט אחיד ועקבי לפי גובה החתיכה
    const clamp = (v,min,max) => Math.min(max, Math.max(min, v));
    const baseFS = clamp(Math.round((Math.max(1, Math.round(40 * m))) * 0.35), 12, 20); // מבוסס על ברירת המחדל ~barH
    // אחוד גודל פונט: זהה לזה של מידות הפלטה (fsPlate=13)
    let fsLarge = 13, fsMed = 13, fsSmall = 12;
    if (displaySettings.fontSize === 'small') {
        fsLarge = 11; fsMed = 11; fsSmall = 10;
    } else if (displaySettings.fontSize === 'large') {
        fsLarge = 15; fsMed = 15; fsSmall = 14;
    }
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
            const wMMvalPiece = toMM(r.width, inventoryUnits[getWidthColIndex()]||'');
            const lenMMvalPiece = unitSystem==='imperial' ? (pieces[i]*25.4*1000/39.37007874015748) : (pieces[i]*1000); // pieces in m or inch -> mm
            const tagText = (displaySettings.showTags && Array.isArray(r.tags)) ? String(r.tags[i]||'') : '';
            rects.push(`<rect data-piece="1" data-kind="beam-piece" data-w-mm="${wMMvalPiece}" data-len-mm="${lenMMvalPiece}" ${tagText?`data-tag=\"${String(tagText).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}\"`:''} x="${x}" y="${barY}" width="${pw}" height="${barH}" fill="${fillColor}" stroke="#cfd4da" />`);
            // תוויות על כל חתיכה: אורך למעלה (אמצע) — מספר בלבד; תגית במרכז אם קיימת
            const toDispFromM = (mVal) => {
                if (unitSystem==='imperial') return mVal*39.37007874015748; // inch
                const u = displaySettings.displayUnit || 'cm';
                if (u==='mm') return mVal*1000;
                if (u==='m') return mVal;
                return mVal*100; // cm
            };
            const toDispFromMM = (mmVal) => {
                if (unitSystem==='imperial') return mmVal/25.4; // inch
                const u = displaySettings.displayUnit || 'cm';
                if (u==='mm') return mmVal;
                if (u==='m') return mmVal/1000;
                return mmVal/10; // cm
            };
            const centerX = x + pw/2;
            const clipId = `${svgId}_clip_${i}`;
            clipDefs.push(`<clipPath id="${clipId}"><rect x="${x}" y="${barY}" width="${pw}" height="${barH}" /></clipPath>`);
            // אורך על החתיכה: אם גם תגיות וגם מידע נוסף פעילים — הצג מידה מעל הקורה כדי שלא תכסה תגית
            if (showLabels) {
                const weightAttr = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
                const lenNum = formatSmart(unitSystem==='imperial' ? pieces[i] : toDispFromM(pieces[i]));
                const placeOutside = !!displaySettings.showTags; // כאשר יש תגיות, העלה את המידה למעלה
                if (placeOutside) {
                    // Raise numbers higher above the beam when tags are shown to ensure full visibility
                    const topY = Math.max(6, barY - 22);
                    rects.push(`<text ${weightAttr} ${fontFamilyAttr} x="${centerX}" y="${topY}" font-size="${fsMed}" text-anchor="middle" dominant-baseline="baseline" fill="#333">${lenNum}</text>`);
                } else {
                    const topY = barY + 14;
                    rects.push(`<text ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${centerX}" y="${topY}" font-size="${fsMed}" text-anchor="middle" dominant-baseline="hanging" fill="#333">${lenNum}</text>`);
                }
            }
            // תגית תמיד מוצגת (אם מופעל באפשרויות), בלי תלות במידע נוסף
            if (displaySettings.showTags && tagText) {
                const weightAttr = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
                const cy = barY + barH/2;
                rects.push(`<text ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${centerX}" y="${cy}" font-size="${fsMed}" text-anchor="middle" dominant-baseline="middle" fill="#000">${tagText}</text>`);
            }
            // Advance x by piece width and draw kerf after the piece except after the last piece
            x += pw;
            if (i < pieces.length - 1) {
                rects.push(`<rect class="non-interactive" x="${x}" y="${barY}" width="${Math.max(1, kerfPx)}" height="${barH}" fill="url(#${svgId}_wasteHatch)" />`);
                x += kerfPx;
            }
        }
        // Draw final kerf stripe before waste to reflect the last cut
        if (pieces.length > 0 && kerfPx > 0.5 && x < leftPad + drawW) {
            rects.push(`<rect class="non-interactive" x="${x}" y="${barY}" width="${Math.max(1, kerfPx)}" height="${barH}" fill="url(#${svgId}_wasteHatch)" />`);
            x += kerfPx;
        }
        // פחת (אפור בלבד, ללא hatch) — אחרי כל החתיכות וה-kerf
        if (x < leftPad + drawW) {
            const wasteW = Math.max(1, leftPad + drawW - x);
            const wasteLenBase = (leftPad + drawW - x) / scale; // m (מטרי) או inch (אימפריאלי)
            const wasteDisp = formatSmart(unitSystem==='imperial' ? wasteLenBase : (displaySettings.displayUnit==='mm' ? wasteLenBase*1000 : displaySettings.displayUnit==='m' ? wasteLenBase : wasteLenBase*100));
            const centerX = x + wasteW/2;
            const clipIdW = `${svgId}_clip_waste`;
            clipDefs.push(`<clipPath id="${clipIdW}"><rect x="${x}" y="${barY}" width="${wasteW}" height="${barH}" /></clipPath>`);
            // צבע פחת: אפור מלא בלבד
            rects.push(`<rect x="${x}" y="${barY}" width="${wasteW}" height="${barH}" fill="#f3f3f3" />`);
            if (showLabels) {
                const weightW = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
                const yMid = barY + barH/2;
                rects.push(`<text ${weightW} ${fontFamilyAttr} clip-path="url(#${clipIdW})" x="${centerX}" y="${yMid}" font-size="${fsLarge}" text-anchor="middle" dominant-baseline="middle" fill="#666">${wasteDisp}</text>`);
            }
        }
        // קו עדין לכל רוחב המסך + טקסט אורך קורה ממורכז מעל הקו — מספר בלבד לפי יחידת תצוגה
        const beamLenLbl = (function(){
            const disp = unitSystem==='imperial' ? total : (displaySettings.displayUnit==='mm' ? total*1000 : displaySettings.displayUnit==='m' ? total : total*100);
            return `${formatSmart(disp)}`;
        })();
    const lineY = isMobile ? (barY + barH + 24) : 74;
    // קו דק רציף לכל רוחב המסך עם רווח מתחת לטקסט
    const txt = beamLenLbl;
    const approxTextW = Math.max(60, txt.length * 7); // הערכת רוחב טקסט לפונט 12px
    const gap = approxTextW + 16; // רווח כולל מרווחי צד
    const halfGap = gap / 2;
    const barLeft = leftPad, barRight = leftPad + drawW;
    const center = (barLeft + barRight) / 2;
    const leftX2 = Math.max(barLeft, center - halfGap);
    const rightX1 = Math.min(barRight, center + halfGap);
    const baseLineLeft = showLabels ? `<line x1="${barLeft}" y1="${lineY}" x2="${leftX2}" y2="${lineY}" stroke="#ccc" stroke-width="1" />` : '';
    const baseLineRight = showLabels ? `<line x1="${rightX1}" y1="${lineY}" x2="${barRight}" y2="${lineY}" stroke="#ccc" stroke-width="1" />` : '';
    const weightBase = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
    // מרכז הקווים ביחס לטקסט (dominant-baseline=middle)
    const rulerText = showLabels ? `<text ${weightBase} ${fontFamilyAttr} x="${center}" y="${lineY}" font-size="13" text-anchor="middle" dominant-baseline="middle" fill="#444">${beamLenLbl}</text>` : '';
    // סרגל רוחב משמאל: מספר באמצע אנכי וקווים מעל/מתחת
    const wMMForRuler = toMM(r.width, inventoryUnits[getWidthColIndex()]||'');
    const widthDispRuler = formatSmart(unitSystem==='imperial' ? (wMMForRuler/25.4) : (displaySettings.displayUnit==='mm' ? wMMForRuler : displaySettings.displayUnit==='m' ? (wMMForRuler/1000) : (wMMForRuler/10)));
    // Bring width ruler closer to the beam bar (align with plate margin aesthetics)
    const rulerLeftX = Math.max(6, leftPad - 10);
    const yTop = barY, yBot = barY + barH;
    const yMid = (yTop + yBot)/2;
    const vGap = 22;
    const baseLineVTop = showLabels ? `<line x1="${rulerLeftX}" y1="${yTop}" x2="${rulerLeftX}" y2="${yMid - vGap/2}" stroke="#ccc" stroke-width="1" />` : '';
    const baseLineVBot = showLabels ? `<line x1="${rulerLeftX}" y1="${yMid + vGap/2}" x2="${rulerLeftX}" y2="${yBot}" stroke="#ccc" stroke-width="1" />` : '';
    const widthText = showLabels ? `<text ${weightBase} ${fontFamilyAttr} x="${rulerLeftX+2}" y="${yMid}" font-size="13" text-anchor="middle" dominant-baseline="middle" fill="#444" transform="rotate(-90 ${rulerLeftX+2} ${yMid})">${widthDispRuler}</text>` : '';
    const defs = `<defs>${defsBase}${clipDefs.join('')}</defs>`;
    const extraTop = (displaySettings.showTags && showLabels) ? 16 : 0;
    return `<svg class="diagram" data-kind="beam" viewBox="0 ${-extraTop} ${w} ${h + extraTop}" preserveAspectRatio="none">${defs}${rects.join('')}${baseLineLeft}${baseLineRight}${rulerText}${baseLineVTop}${baseLineVBot}${widthText}</svg>`;
    }

    function plateSvg(r) {
        // Landscape plate diagram with piece and waste rectangles, labels, and rulers
        const svgId = `svg_${svgIdCounter++}`;
        const W0 = Number(r.plateWmm)||0;
        const H0 = Number(r.plateHmm)||0;
        const rotate = H0 > W0; // force landscape
        const W = rotate ? H0 : W0;
        const H = rotate ? W0 : H0;
        const w = 1000;
        let isMobile = false;
        try { if (typeof window !== 'undefined') { isMobile = (window.matchMedia && window.matchMedia('(max-width: 840px)').matches) || (window.innerWidth <= 840); } } catch(_){ isMobile = false; }
        const leftPad = 34, rightPad = 10, topPad = 12, bottomPad = 40;
        const drawW = Math.max(100, w - leftPad - rightPad);
        const scale = W>0 ? (drawW / W) : 1;
        const drawH = Math.max(60, Math.round(H * scale));
        const h = topPad + drawH + bottomPad;
    const kerfMMConst = isFinite(Number(r.kerfMM)) ? Number(r.kerfMM) : 3;
    const displayKerfMM = Math.max(15, kerfMMConst); // display-only kerf rule for plate diagrams
        const showLabels = !!displaySettings.showPieceLabels;
        const fontFamily = (language==='he')
            ? "'Noto Sans Hebrew Variable', system-ui, -apple-system, 'Segoe UI', Roboto, Arial"
            : "'Josefin Sans Variable', 'Rubik', system-ui, -apple-system, 'Segoe UI', Roboto, Arial";
        const fontFamilyAttr = `font-family="${fontFamily}"`;
        const fsLarge = displaySettings.fontSize === 'small' ? 11 : displaySettings.fontSize === 'large' ? 15 : 13;
        const fsMed = fsLarge;
        const fsSmall = displaySettings.fontSize === 'small' ? 10 : displaySettings.fontSize === 'large' ? 14 : 12;
        const toDispFromMM = (mmVal) => {
            if (unitSystem==='imperial') return mmVal/25.4; // inch
            const u = displaySettings.displayUnit || 'cm';
            if (u==='mm') return mmVal;
            if (u==='m') return mmVal/1000;
            return mmVal/10; // cm
        };
        const convNum = (mmVal) => formatSmart(toDispFromMM(mmVal));
        const plateToDisplay = (x,y,w,h) => {
            if (!rotate) return {x,y,w,h};
            // rotate 90deg: newX = y, newY = W0 - x - w, newW = h, newH = w
            return { x: y, y: W0 - x - w, w: h, h: w };
        };
        const rects = [];
        const clipDefs = [];
        // Plate background
        const plateX = leftPad, plateY = topPad;
        rects.push(`<rect x="${plateX}" y="${plateY}" width="${drawW}" height="${drawH}" fill="#ffffff" stroke="#cfd4da" />`);
        // Pieces
        const placed = (r.placed||[]).map(p=> plateToDisplay(p.x,p.y,p.w,p.h));
        // Color by size ignoring orientation (unordered width/height), use original source dims when available
        const groups = {};
        const keyForIdx = (i)=>{
            const srcW = Number(r.placed?.[i]?.srcW);
            const srcH = Number(r.placed?.[i]?.srcH);
            const a = isFinite(srcW) ? srcW : placed[i].w;
            const b = isFinite(srcH) ? srcH : placed[i].h;
            const lo = Math.round(Math.min(a,b));
            const hi = Math.round(Math.max(a,b));
            return `${lo}x${hi}`;
        };
        for (let i=0;i<placed.length;i++){ groups[keyForIdx(i)] = true; }
        const palette = ['#dfe8d8','#e9e2d0','#e8d9d4','#dbe7e5','#e8e3ef','#f2e6de'];
        const groupColor = {}; let gi=0; Object.keys(groups).forEach(k=>{groupColor[k]=palette[gi%palette.length];gi++;});
        const toPx = (mm)=> mm * scale;
        for (let i=0;i<placed.length;i++){
            const p = placed[i];
            const x = plateX + toPx(p.x);
            const y = plateY + toPx(p.y);
            const pw = Math.max(1, toPx(p.w));
            const ph = Math.max(1, toPx(p.h));
            const gkey = keyForIdx(i);
            const fillColor = displaySettings.colorPieces ? (groupColor[gkey]) : '#ffffff';
            const clipId = `${svgId}_clip_p_${i}`;
            clipDefs.push(`<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${pw}" height="${ph}" /></clipPath>`);
            // data attrs for popup: width=horizontal, height=vertical after display orientation
            rects.push(`<rect data-piece="1" data-kind="plate-piece" data-w-mm="${p.w}" data-h-mm="${p.h}" ${r.placed[i]?.tag?`data-tag="${String(r.placed[i].tag).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"`:''} x="${x}" y="${y}" width="${pw}" height="${ph}" fill="${fillColor}" stroke="#cfd4da" />`);
            if (showLabels) {
                const weightAttr = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
                const topY = y + 12;
                const cx = x + pw/2;
                rects.push(`<text ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${cx}" y="${topY}" font-size="${fsMed}" text-anchor="middle" dominant-baseline="hanging" fill="#333">${convNum(p.w)}</text>`);
                const sideX = x + 12;
                const cy = y + ph/2;
                rects.push(`<text ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${sideX}" y="${cy}" font-size="${fsSmall}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${sideX} ${cy})" fill="#333">${convNum(p.h)}</text>`);
            }
            if (displaySettings.showTags && r.placed[i]?.tag) {
                const weightAttr = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
                const cx = x + pw/2;
                const cy = y + ph/2;
                rects.push(`<text ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${cx}" y="${cy}" font-size="${fsMed}" text-anchor="middle" dominant-baseline="middle" fill="#000">${String(r.placed[i].tag)}</text>`);
            }
        }
        // Waste: recompute a partition of empty area via repeated maximal empty rectangles (keeps only relevant waste and spacing)
        try {
            const basePlaced = (r.placed||[]).map(p=> ({x:p.x,y:p.y,w:p.w,h:p.h}));
            const maxRects = computeAllEmptyRects(basePlaced, W0, H0, displayKerfMM, 200);
            const wasteRects = maxRects.map(fr => plateToDisplay(fr.x, fr.y, fr.w, fr.h));
            for (let i=0;i<wasteRects.length;i++){
                const fr = wasteRects[i];
                if (fr.w<=0 || fr.h<=0) continue;
                const x = plateX + toPx(fr.x);
                const y = plateY + toPx(fr.y);
                const pw = Math.max(1, toPx(fr.w));
                const ph = Math.max(1, toPx(fr.h));
                const clipId = `${svgId}_clip_w_${i}`;
                clipDefs.push(`<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${pw}" height="${ph}" /></clipPath>`);
                rects.push(`<rect x="${x}" y="${y}" width="${pw}" height="${ph}" fill="#f3f3f3" />`);
                if (showLabels) {
                    const weightAttr = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
                    const cx = x + pw/2;
                    const cy = y + ph/2;
                    rects.push(`<text ${weightAttr} ${fontFamilyAttr} clip-path="url(#${clipId})" x="${cx}" y="${cy}" font-size="${fsSmall}" text-anchor="middle" dominant-baseline="middle" fill="#666">${convNum(fr.w)}×${convNum(fr.h)}</text>`);
                }
            }
        } catch(_){ }
        // Rulers
        const weightBase = displaySettings.fontWeight==='bold' ? 'font-weight="700"' : '';
        // bottom horizontal number only with split baseline lines
        const plateLenLbl = `${convNum(W)}`;
        const lineY = topPad + drawH + 20;
        const txt = plateLenLbl;
        const approxTextW = Math.max(60, txt.length * 7);
        const gap = approxTextW + 16;
        const halfGap = gap/2;
        const barLeft = plateX, barRight = plateX + drawW;
        const center = (barLeft + barRight)/2;
        const leftX2 = Math.max(barLeft, center - halfGap);
        const rightX1 = Math.min(barRight, center + halfGap);
        const baseLineLeft = showLabels ? `<line x1="${barLeft}" y1="${lineY}" x2="${leftX2}" y2="${lineY}" stroke="#ccc" stroke-width="1" />` : '';
        const baseLineRight = showLabels ? `<line x1="${rightX1}" y1="${lineY}" x2="${barRight}" y2="${lineY}" stroke="#ccc" stroke-width="1" />` : '';
        const rulerText = showLabels ? `<text ${weightBase} ${fontFamilyAttr} x="${center}" y="${lineY}" font-size="13" text-anchor="middle" dominant-baseline="middle" fill="#444">${plateLenLbl}</text>` : '';
        // left vertical
        const heightLbl = `${convNum(H)}`;
        const rulerLeftX = Math.max(6, leftPad - 10);
        const yTop = plateY, yBot = plateY + drawH;
        const yMid = (yTop + yBot)/2;
        const vGap = 22;
        const baseLineVTop = showLabels ? `<line x1="${rulerLeftX}" y1="${yTop}" x2="${rulerLeftX}" y2="${yMid - vGap/2}" stroke="#ccc" stroke-width="1" />` : '';
        const baseLineVBot = showLabels ? `<line x1="${rulerLeftX}" y1="${yMid + vGap/2}" x2="${rulerLeftX}" y2="${yBot}" stroke="#ccc" stroke-width="1" />` : '';
        const widthText = showLabels ? `<text ${weightBase} ${fontFamilyAttr} x="${rulerLeftX+2}" y="${yMid}" font-size="13" text-anchor="middle" dominant-baseline="middle" fill="#444" transform="rotate(-90 ${rulerLeftX+2} ${yMid})">${heightLbl}</text>` : '';
        const defs = `<defs>${clipDefs.join('')}</defs>`;
        return `<svg class="diagram" data-kind="plate" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${defs}${rects.join('')}${baseLineLeft}${baseLineRight}${rulerText}${baseLineVTop}${baseLineVBot}${widthText}</svg>`;
    }

    const title1 = language==='he' ? 'חיתוכים' : 'Cuts';
    const title2 = language==='he' ? 'עלויות' : 'Costs';
    const title3 = language==='he' ? 'רשימת קניות' : 'Shopping List';
        area.innerHTML = `
            <div class="results-section"><h3 class="section-title">${title1}</h3><div class="x-scroll">${table1()}</div></div>
            <div class="results-section"><h3 class="section-title">${title2}</h3><div class="x-scroll">${table2()}</div></div>
            <div class="results-section"><h3 class="section-title">${title3}</h3><div class="x-scroll">${table3()}</div></div>
            <div class="results-section"><h3 class="section-title">${language==='he'?'מפת חיתוכים':'Cutting Map'}</h3><div class="x-scroll"><div style="overflow-y:visible; touch-action:pan-x pan-y">${diagrams()}</div></div></div>
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
                // Close on any click anywhere
                modal?.addEventListener('click', close, { once: true });
                modal?.querySelector('#global-modal-ok')?.addEventListener('click', (e)=>{ e.stopPropagation(); close(); });
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
    const dsFontSize = document.getElementById('ds-font-size');
    const dsUnit = document.getElementById('ds-unit');
    const dsLabels = document.getElementById('ds-labels');
    const dsLabelsSwitch = document.getElementById('ds-labels-switch');
    const dsTags = document.getElementById('ds-tags');
    const dsTagsSwitch = document.getElementById('ds-tags-switch');
    const dsCutOrder = document.getElementById('ds-cutorder');
    const dsCutOrderSwitch = document.getElementById('ds-cutorder-switch');
    const dsCompressed = document.getElementById('ds-compressed');
    const dsCompressedSwitch = document.getElementById('ds-compressed-switch');
    const resPrint = document.getElementById('res-print');
    const colMaxProducts = document.getElementById('col-maxproducts');
    const reRender = () => { const res2 = computeOptimization(); renderResults(res2); };
    if (dsColor) dsColor.addEventListener('change', () => { displaySettings.colorPieces = !!dsColor.checked; saveData('displaySettings', displaySettings); reRender(); });
    if (dsColorSwitch) dsColorSwitch.addEventListener('click', () => { displaySettings.colorPieces = !displaySettings.colorPieces; saveData('displaySettings', displaySettings); reRender(); });
    if (dsFont) dsFont.addEventListener('change', () => { displaySettings.fontWeight = dsFont.value==='bold'?'bold':'regular'; saveData('displaySettings', displaySettings); reRender(); });
    if (dsFontSize) dsFontSize.addEventListener('change', () => { displaySettings.fontSize = dsFontSize.value; saveData('displaySettings', displaySettings); reRender(); });
    if (dsUnit) dsUnit.addEventListener('change', () => { displaySettings.displayUnit = dsUnit.value; saveData('displaySettings', displaySettings); reRender(); });
    if (dsLabels) dsLabels.addEventListener('change', () => { displaySettings.showPieceLabels = !!dsLabels.checked; saveData('displaySettings', displaySettings); reRender(); });
    if (dsLabelsSwitch) dsLabelsSwitch.addEventListener('click', () => { displaySettings.showPieceLabels = !displaySettings.showPieceLabels; saveData('displaySettings', displaySettings); reRender(); });
    if (dsTags) dsTags.addEventListener('change', () => { displaySettings.showTags = !!dsTags.checked; saveData('displaySettings', displaySettings); reRender(); });
    if (dsTagsSwitch) dsTagsSwitch.addEventListener('click', () => { displaySettings.showTags = !displaySettings.showTags; saveData('displaySettings', displaySettings); reRender(); });
    if (dsCutOrder) dsCutOrder.addEventListener('change', () => { displaySettings.cutOrderOn = !!dsCutOrder.checked; saveData('displaySettings', displaySettings); reRender(); });
    if (dsCutOrderSwitch) dsCutOrderSwitch.addEventListener('click', () => { displaySettings.cutOrderOn = !displaySettings.cutOrderOn; saveData('displaySettings', displaySettings); reRender(); });
    if (dsCompressed) dsCompressed.addEventListener('change', () => { displaySettings.compressedView = !!dsCompressed.checked; saveData('displaySettings', displaySettings); reRender(); });
    if (dsCompressedSwitch) dsCompressedSwitch.addEventListener('click', () => { displaySettings.compressedView = !displaySettings.compressedView; saveData('displaySettings', displaySettings); reRender(); });
    if (resPrint) resPrint.addEventListener('click', () => {
        try { window.__AUTO_PRINT_PDF__ = true; } catch(_){}
        try { document.getElementById('export-pdf')?.click(); } catch(_){}
    });
    // Column toggles
    const colSupplier = document.getElementById('col-supplier');
    const colClass = document.getElementById('col-classification');
    const colMaterial = document.getElementById('col-material');
    const colWaste = document.getElementById('col-waste');
    const colWastePct = document.getElementById('col-wastepct');
    if (colMaxProducts) colMaxProducts.addEventListener('change', ()=>{
        resultsColSettings.showMaxProducts = !!colMaxProducts.checked; saveCols();
    });
    const saveCols = () => { saveData('resultsColSettings', resultsColSettings); const res2 = computeOptimization(); renderResults(res2); };
    if (colSupplier) colSupplier.addEventListener('change', ()=>{ resultsColSettings.showSupplier = !!colSupplier.checked; saveCols(); });
    if (colClass) colClass.addEventListener('change', ()=>{ resultsColSettings.showClassification = !!colClass.checked; saveCols(); });
    if (colMaterial) colMaterial.addEventListener('change', ()=>{ resultsColSettings.showMaterial = !!colMaterial.checked; saveCols(); });
    if (colWaste) colWaste.addEventListener('change', ()=>{ resultsColSettings.showWasteValue = !!colWaste.checked; saveCols(); });
    if (colWastePct) colWastePct.addEventListener('change', ()=>{ resultsColSettings.showWastePct = !!colWastePct.checked; saveCols(); });

    // Click-to-zoom on piece (beam/plate)
    try {
        const resRoot = document.getElementById('results-area');
        resRoot && resRoot.addEventListener('click', (e)=>{
            const r = e.target.closest && e.target.closest('rect[data-piece="1"]');
            if (!r) return;
            const kind = (r.getAttribute('data-kind')||'').toLowerCase();
            let wmm=0, hmm=0;
            if (kind === 'beam-piece') {
                // For beam: horizontal dimension is length (len-mm), vertical is width (w-mm)
                hmm = Number(r.getAttribute('data-len-mm')||0); // length
                wmm = Number(r.getAttribute('data-w-mm')||0);   // width
            } else {
                wmm = Number(r.getAttribute('data-w-mm')||0);
                hmm = Number(r.getAttribute('data-h-mm')||0);
            }
            const toDisp = (mm)=>{
                if (unitSystem==='imperial') return { v: mm/25.4, u: (language==='he'?'אינץ׳':'inch') };
                const u = displaySettings.displayUnit||'cm';
                if (u==='mm') return { v:mm, u:(language==='he'?'מ״מ':'mm') };
                if (u==='m') return { v:mm/1000, u:(language==='he'?'מ׳':'m') };
                return { v:mm/10, u:(language==='he'?'ס״מ':'cm') };
            };
            // In the popup, top label should show the horizontal dimension of the piece, and the side label the vertical
            // For beam: top = length, side = width. For plate: top = width, side = height.
            const isBeam = (kind === 'beam-piece');
            let a = toDisp(isBeam ? hmm : wmm); // top
            let b = toDisp(isBeam ? wmm : hmm); // side
            const modal = document.createElement('div');
            modal.className = 'global-modal';
            const tagCenter = (function(){
                try {
                    const t = r.getAttribute('data-tag');
                    return t ? String(t) : '';
                } catch(_){ return ''; }
            })();
            // Compute popup rectangle to reflect piece orientation (plates), keep beams fixed wide
            const svgW = 400, svgH = 240, maxW = 320, maxH = 160;
            let rectW = 320, rectH = 160, rectX = 40, rectY = 30;
            if (!isBeam) {
                const aspect = (wmm > 0 && hmm > 0) ? (hmm / wmm) : 1; // >1 => standing
                if (aspect >= 1) {
                    rectH = maxH;
                    rectW = Math.max(60, Math.min(maxW, Math.round(maxH / aspect)));
                } else {
                    rectW = maxW;
                    rectH = Math.max(40, Math.min(maxH, Math.round(maxW * aspect)));
                }
                rectX = Math.round((svgW - rectW) / 2);
                rectY = Math.round((svgH - rectH) / 2);
            }
            const topTextX = Math.round(rectX + rectW/2);
            const topTextY = rectY + 14;
            const sideTextX = rectX + 14;
            const sideTextY = Math.round(rectY + rectH/2);
            const tagX = Math.round(rectX + rectW/2);
            const tagY = Math.round(rectY + rectH/2);
            const svgMarkup = `
                <svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;height:auto;display:block">
                    <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" fill="#eaf4ea" stroke="#cfd4da" />
                    <!-- Top horizontal dimension (length for beams, width for plates) -->
                    <text x="${topTextX}" y="${topTextY}" font-size="13" text-anchor="middle" fill="#333">${formatSmart(a.v)} ${a.u}</text>
                    <!-- Side vertical dimension (width for beams, height for plates) -->
                    <text x="${sideTextX}" y="${sideTextY}" font-size="13" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${sideTextX} ${sideTextY})" fill="#333">${formatSmart(b.v)} ${b.u}</text>
                    ${displaySettings.showTags && tagCenter ? `<text x="${tagX}" y="${tagY}" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#222">${tagCenter}</text>` : ''}
                </svg>`;
            modal.innerHTML = `<div class="global-modal-backdrop"></div>
                <div class="global-modal-box" style="max-width:520px; cursor:pointer">
                    <h3 class="global-modal-title" style="margin-left:28px">${language==='he'?'תצוגת חתיכה':'Piece view'}</h3>
                    <div class="global-modal-body" style="display:flex;align-items:center;justify-content:center">
                        ${svgMarkup}
                    </div>
                </div>`;
            document.body.appendChild(modal);
            const close = ()=>{ try{ modal.remove(); }catch{} };
            // Any pointer/touch/mouse event closes in a single interaction
            ['pointerdown','mousedown','touchstart','click'].forEach(ev=>{
                modal.addEventListener(ev, close, { once: true });
            });
            document.addEventListener('keydown', function onKey(ev){ if(ev.key==='Escape'){ close(); document.removeEventListener('keydown', onKey); } });
        });
    } catch(_){ }
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
    // Single click anywhere closes
    modal?.addEventListener('click', close, { once: true });
    modal?.querySelector('#global-info-ok')?.addEventListener('click', (e)=>{ e.stopPropagation(); close(); });
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
        const materials = getUniqueMaterials();
        const matOptions = [`<option value="">${language==='he'?'חומר':'Material'}</option>`].concat(materials.map(m=>`<option value="${m}">${m}</option>`)).join('');
        const types = getUniqueTypes();
        const typeOptions = [`<option value="">${language === 'he' ? 'סוג' : 'Type'}</option>`]
                .concat(types.map(t => `<option value="${t}">${t}</option>`)).join('');
    const thIdx = getThicknessColIndex();
    const thUnit = thIdx >= 0 ? (inventoryUnits[thIdx] || '') : '';
            const isRTL = (document.documentElement && document.documentElement.dir === 'rtl');
            const materialSelectHtml = `<select data-field="material">${matOptions}</select>`;
            const projectsBtnHtml = `<button class="btn icon-btn btn-projects" title="${language==='he'?'פרויקטים שמורים':'Saved projects'}" aria-pressed="false">📚</button>`;
            row.innerHTML = `
            ${isRTL ? projectsBtnHtml + materialSelectHtml : materialSelectHtml + projectsBtnHtml}
            <select data-field="type">${typeOptions}</select>
            <select data-field="thickness" disabled>
        <option value="">${language === 'he' ? 'עובי (מ״מ)' : 'Thickness (mm)'}</option>
            </select>
            <select data-field="width" disabled>
                <option value="">${language === 'he' ? (unitSystem==='imperial' ? 'רוחב (אינץ׳)' : 'רוחב (מ״מ)') : (unitSystem==='imperial' ? 'Width (inch)' : 'Width (mm)')}</option>
            </select>
                <input data-field="length" type="number" min="0" placeholder="${language === 'he' ? (unitSystem==='imperial'?'אורך (אינץ׳)':'אורך (ס״מ)') : (unitSystem==='imperial'?'Length (inch)':'Length (cm)')}" />
            <input data-field="qty" type="number" min="1" placeholder="${language === 'he' ? 'כמות' : 'Qty'}" />
            <input data-field="tag" type="text" placeholder="${language==='he'?'תגית':'Tag'}" />
            <button class="btn icon-btn btn-duplicate" title="${language==='he'?'שכפל':'Duplicate'}">⎘</button>
            <button class="btn small btn-remove" title="Remove">✖</button>
        `;
    // Duplicate and remove handlers
    const dupBtn = row.querySelector('.btn-duplicate');
    if (dupBtn) dupBtn.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const clone = row.cloneNode(true);
        // copy field values
        ['material','type','thickness','width','length','qty','tag'].forEach(f=>{
            const src = row.querySelector(`[data-field="${f}"]`);
            const dst = clone.querySelector(`[data-field="${f}"]`);
            if (src && dst){
                if (dst.tagName.toLowerCase()==='select') { dst.innerHTML = src.innerHTML; dst.value = src.value; }
                else { dst.value = src.value; }
            }
        });
        // wire clone buttons
        clone.querySelector('.btn-duplicate')?.addEventListener('click', (e2)=>{ e2.preventDefault(); e2.stopPropagation(); row.after(clone.cloneNode(true)); });
        clone.querySelector('.btn-remove')?.addEventListener('click', ()=>{ clone.remove(); try{updateReqEmptyState();}catch(_){}});
        // wire project toggle on the clone
        try { wireProjectToggle(clone); } catch(_){ }
        row.after(clone);
        try{ updateReqEmptyState(); }catch(_){ }
    });
    const removeBtn = row.querySelector('.btn-remove');
    if (removeBtn) removeBtn.addEventListener('click', () => { row.remove(); try { updateReqEmptyState(); } catch(_){} });
    // Saved projects toggle: wrap select and icon together so the icon is to the RIGHT of the select in RTL
    function wireProjectToggle(r) {
        const projBtn = r.querySelector('.btn-projects');
        if (!projBtn) return;
        const matSel = r.querySelector('select[data-field="material"]');
        const typeSel = r.querySelector('select[data-field="type"]');
        const thSel = r.querySelector('select[data-field="thickness"]');
        const wEl = r.querySelector('[data-field="width"]');
        const lenEl = r.querySelector('input[data-field="length"]');
        const makeProjectWrap = ()=>{
            const savedProjects = (loadData('savedProjects')||[]);
            const wrap = document.createElement('span');
            wrap.className = 'project-wrap';
            wrap.style.display = 'inline-flex';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '6px';
            projBtn.classList.add('icon-btn'); // keep icon size consistent
            const sel = document.createElement('select');
            sel.className = 'project-select';
            sel.setAttribute('data-field','project');
            const ph = document.createElement('option');
            ph.value = '';
            ph.textContent = language==='he' ? 'בחר פרויקט' : 'Select project';
            sel.appendChild(ph);
            try {
                if (Array.isArray(savedProjects)) {
                    savedProjects.forEach(p => {
                        const name = (typeof p === 'string') ? p : (p && (p.name||p.title||''));
                        if (!name) return;
                        const opt = document.createElement('option');
                        opt.value = name; opt.textContent = name; sel.appendChild(opt);
                    });
                }
            } catch(_){ }
            const isRTL = (document.documentElement && document.documentElement.dir === 'rtl');
            // In RTL, first item appears on the RIGHT in flex-row, so place the icon first
            if (isRTL) { wrap.appendChild(projBtn); wrap.appendChild(sel); }
            else { wrap.appendChild(sel); wrap.appendChild(projBtn); }
            return wrap;
        };
        const enterProjectMode = ()=>{
            if (r.dataset.projectMode === '1') return;
            r.dataset.projectMode = '1';
            projBtn.setAttribute('aria-pressed','true');
            // hide fields
            if (matSel) matSel.style.display = 'none';
            if (typeSel) typeSel.style.display = 'none';
            if (thSel) thSel.style.display = 'none';
            if (wEl) wEl.style.display = 'none';
            if (lenEl) lenEl.style.display = 'none';
            // insert wrapper (select + icon button) after material
            const prjWrap = makeProjectWrap();
            if (matSel && matSel.after) matSel.after(prjWrap);
        };
        const exitProjectMode = ()=>{
            if (r.dataset.projectMode !== '1') return;
            r.dataset.projectMode = '0';
            projBtn.setAttribute('aria-pressed','false');
            const prjWrap = r.querySelector('.project-wrap');
            if (prjWrap) prjWrap.remove();
            if (matSel) matSel.style.display = '';
            if (typeSel) typeSel.style.display = '';
            if (thSel) thSel.style.display = '';
            if (wEl) wEl.style.display = '';
            if (lenEl) lenEl.style.display = '';
            // return icon next to material select: in RTL, place BEFORE select to appear on its right
            const isRTL = (document.documentElement && document.documentElement.dir === 'rtl');
            if (matSel) {
                if (isRTL && matSel.before) matSel.before(projBtn);
                else if (matSel.after) matSel.after(projBtn);
            }
        };
        projBtn.addEventListener('click', (e)=>{
            e.preventDefault(); e.stopPropagation();
            if (r.dataset.projectMode === '1') exitProjectMode(); else enterProjectMode();
        });
    }
    try { wireProjectToggle(row); } catch(_){ }
    list.appendChild(row);
    try { updateReqEmptyState(); } catch(_){}
}

// אירועים (מותאמים ל-HTML הנוכחי, עם בדיקות קיום אלמנטים)
// Language dropdown
const selLang = document.getElementById('select-lang');
if (selLang) {
    try { selLang.value = language; } catch{}
    selLang.addEventListener('change', ()=>{
        const v = selLang.value === 'en' ? 'en' : 'he';
        switchLanguage(v);
    });
}

// Currency dropdown
const selCurrency = document.getElementById('select-currency');
if (selCurrency) {
    // init from saved or from inventory
    const savedSymbol = loadData('currencySymbol') || (inventoryPriceCurrencyUnit || '€');
    try { selCurrency.value = normalizeCurrencySymbol(savedSymbol); } catch{}
    selCurrency.addEventListener('change', ()=>{
        const sym = normalizeCurrencySymbol(selCurrency.value || '€');
        saveData('currencySymbol', sym);
        switchCurrency(sym);
    });
}

// Units dropdown (header)
const selUnits = document.getElementById('select-units');
if (selUnits) {
    try { selUnits.value = (unitSystem === 'imperial') ? 'imperial' : 'metric'; } catch {}
    selUnits.addEventListener('change', () => {
        unitSystem = (selUnits.value === 'imperial') ? 'imperial' : 'metric';
        saveData('unitSystem', unitSystem);
        // Convert saw thickness UI value and update chip label (persist stored mm)
        const sawInput = document.getElementById('saw-thickness');
    const kerfHidden = document.getElementById('kerf');
        const sawUnit = document.getElementById('saw-unit');
        if (sawInput && sawUnit) {
            const current = parseFloat(sawInput.value) || 0;
            let newVal = current;
            if (isFinite(current)) newVal = unitSystem === 'imperial' ? (current / 25.4) : (current * 25.4);
            const numStr = unitSystem === 'imperial' ? Number(newVal).toFixed(3) : String(Math.round(newVal));
            sawInput.value = numStr + ' ' + (unitSystem === 'imperial' ? (he ? 'אינץ׳' : 'inch') : (he ? 'מ״מ' : 'mm'));
            const he = language === 'he';
            sawUnit.textContent = unitSystem === 'imperial' ? (he ? 'אינץ׳' : 'inch') : (he ? 'מ״מ' : 'mm');
            try {
                const mm = unitSystem === 'imperial' ? (Number(numStr) * 25.4) : Number(numStr);
                if (isFinite(mm)) saveData('kerfMM', mm);
        if (kerfHidden) kerfHidden.value = String(mm);
            } catch {}
        }
        // Refresh inventory and requirement placeholders (unit labels)
        renderInventoryTable();
        document.querySelectorAll('.req-row').forEach(row => {
            const typeSel = row.querySelector('select[data-field="type"]');
            const thSel = row.querySelector('select[data-field="thickness"]');
            const wEl = row.querySelector('[data-field="width"]');
            const lenEl = row.querySelector('input[data-field="length"]');
            if (typeSel) typeSel.dispatchEvent(new Event('change'));
            if (thSel && thSel.value) thSel.dispatchEvent(new Event('change'));
            if (wEl && wEl.tagName.toLowerCase() === 'input') {
                wEl.placeholder = language === 'he' ? (unitSystem === 'imperial' ? 'רוחב (אינץ׳)' : 'רוחב (ס״מ)') : (unitSystem === 'imperial' ? 'Width (inch)' : 'Width (cm)');
            }
            if (lenEl) {
                lenEl.placeholder = language === 'he' ? (unitSystem === 'imperial' ? 'אורך (אינץ׳)' : 'אורך (ס״מ)') : (unitSystem === 'imperial' ? 'Length (inch)' : 'Length (cm)');
            }
        });
        // Recompute if we have results context
        const reqs = gatherRequirements();
        if (Array.isArray(reqs) && reqs.length) {
            const res = computeOptimization();
            renderResults(res);
        }
    });
}

const addReqBtn = document.getElementById('add-req');
// Saw settings popover (edge trims + tag) anchored to button
try {
    const btn = document.getElementById('saw-settings-btn');
    const inputMain = document.getElementById('saw-thickness');
    const unitMain = document.getElementById('saw-unit');
    if (btn) btn.hidden = false;
    const closePopover = () => { 
        const row = document.getElementById('saw-settings-row');
        if (row) row.remove();
    };
    const openPopover = () => {
        if (!btn || !inputMain || !unitMain) return;
        const unitLbl = unitMain.textContent || 'mm';
        const he = (document.documentElement.lang || 'he') === 'he';
        const actionsCenter = document.querySelector('.actions-center');
        if (!actionsCenter) return;
        const rowDiv = document.createElement('div');
        rowDiv.id = 'saw-settings-row';
        rowDiv.style.display = 'flex';
        rowDiv.style.alignItems = 'center';
        rowDiv.style.gap = '10px';
        rowDiv.style.margin = '20px 0';
        rowDiv.style.flexWrap = 'wrap';
        rowDiv.style.justifyContent = 'center';
        rowDiv.style.border = 'none';
        rowDiv.style.background = 'transparent';
    rowDiv.style.maxWidth = '100%';
    rowDiv.style.position = 'relative';
    const isSubscribed = true;
    const rowDir = he ? 'row-reverse' : 'row';
    const sliderRowStyle = `display:flex; align-items:center; justify-content:space-between; gap:10px; margin:10px 0; flex-direction:${rowDir}`;
    rowDiv.innerHTML = `
            <div class="row" style="${sliderRowStyle}">
                <span id="orientation-switch" class="switch" data-on="${sawAdv.orientationLock ? 1 : 0}"><span class="knob" style="color:${sawAdv.orientationLock ? '#000' : '#ccc'}; text-align:center; line-height:20px;">🔒</span></span>
                <span>${he ? 'העדף כיוון' : 'Orientation lock'} <span class="help-icon" data-help="orientation" tabindex="0" title="${he ? 'בחרו אופציה זו אם תרצו לחתוך בכיוון הסיבים בלבד. הפלטות מוצגות תמיד כך שהצלע הארוכה היא הצלע האופקית' : 'Select this to cut only along the grain. Plates are shown with the long side as horizontal.'}" aria-label="${he ? 'בחרו אופציה זו אם תרצו לחתוך בכיוון הסיבים בלבד. הפלטות מוצגות תמיד כך שהצלע הארוכה היא הצלע האופקית' : 'Select this to cut only along the grain. Plates are shown with the long side as horizontal.'}" role="img">?</span></span>
            </div>
            <div id="orientation-pref" class="row" style="margin:${sawAdv.orientationLock? '10px' : '0'} 0 ${sawAdv.orientationLock? '10px' : '0'}; display:${sawAdv.orientationLock?'flex':'none'}; align-items:center; gap:8px; justify-content:flex-end; flex-direction:${rowDir}">
                <label class="inline" style="gap:6px">
                    <span>${he ? 'העדפה:' : 'Preference:'}</span>
                    <select id="orientation-select" class="btn select">
                        <option value="horizontal" ${sawAdv.orientationPref==='horizontal'?'selected':''}>${he?'אופקי':'Horizontal'}</option>
                        <option value="vertical" ${sawAdv.orientationPref==='vertical'?'selected':''}>${he?'אנכי':'Vertical'}</option>
                    </select>
                </label>
            </div>
            <div class="row" style="${sliderRowStyle}">
                <span id="edgetrim-switch" class="switch" data-on="${sawAdv.edgeTrimOn ? 1 : 0}"><span class="knob" style="color:${sawAdv.edgeTrimOn ? '#000' : '#ccc'}; text-align:center; line-height:20px;">🔒</span></span>
                <span>${he ? 'פחת קצוות' : 'Edge trims'} <span class="help-icon" data-help="edgetrim" tabindex="0" title="${he ? 'ציינו את השוליים הפגומים שלא יכנסו למידות הפלטה בחישובים' : 'Specify damaged margins that will not be included in plate dimensions for calculations.'}" aria-label="${he ? 'ציינו את השוליים הפגומים שלא יכנסו למידות הפלטה בחישובים' : 'Specify damaged margins that will not be included in plate dimensions for calculations.'}" role="img">?</span></span>
            </div>
            <div id="edgetrim-fields" class="trim-grid" style="display:${sawAdv.edgeTrimOn?'grid':'none'}; margin:8px 0 4px">
                <!-- Row 1: Top, Bottom (RTL: appears from right to left) -->
                <label class="inline" style="gap:6px"><span>${he?'עליון':'Top'}:</span><input id="edge-top" type="number" min="0" step="0.1" placeholder="${he?'0 מ״מ':'0 mm'}" value="${Number(sawAdv.edgeTrimTopCm)||0 ? Number(sawAdv.edgeTrimTopCm) : ''}" /></label>
                <label class="inline" style="gap:6px"><span>${he?'תחתון':'Bottom'}:</span><input id="edge-bottom" type="number" min="0" step="0.1" placeholder="${he?'0 מ״מ':'0 mm'}" value="${Number(sawAdv.edgeTrimBottomCm)||0 ? Number(sawAdv.edgeTrimBottomCm) : ''}" /></label>
                <!-- Row 2: Right, Left -->
                <label class="inline" style="gap:6px"><span>${he?'ימין':'Right'}:</span><input id="edge-right" type="number" min="0" step="0.1" placeholder="${he?'0 מ״מ':'0 mm'}" value="${Number(sawAdv.edgeTrimRightCm)||0 ? Number(sawAdv.edgeTrimRightCm) : ''}" /></label>
                <label class="inline" style="gap:6px"><span>${he?'שמאל':'Left'}:</span><input id="edge-left" type="number" min="0" step="0.1" placeholder="${he?'0 מ״מ':'0 mm'}" value="${Number(sawAdv.edgeTrimLeftCm)||0 ? Number(sawAdv.edgeTrimLeftCm) : ''}" /></label>
            </div>
            <div class="row" style="${sliderRowStyle}">
                <span id="sawcut-switch" class="switch" data-on="${sawAdv.sawCuttingOn ? 1 : 0}"><span class="knob" style="color:${sawAdv.sawCuttingOn ? '#000' : '#ccc'}; text-align:center; line-height:20px;">🔒</span></span>
                <span>${he ? 'חיתוך מסורי' : 'Saw cutting'} <span class="help-icon" data-help="sawcut" tabindex="0" title="${he ? 'החיתוך מתבצע ע״י מסור דיסק או ג׳יקסו ולא כחיתוך גיליוטיני (קצה לקצה)' : 'Cut is with a circular saw or jigsaw, not guillotine (edge-to-edge)'}" aria-label="${he ? 'החיתוך מתבצע ע״י מסור דיסק או ג׳יקסו ולא כחיתוך גיליוטיני (קצה לקצה)' : 'Cut is with a circular saw or jigsaw, not guillotine (edge-to-edge)'}" role="img">?</span></span>
            </div>
            <div class="row" style="${sliderRowStyle}; justify-content:flex-end">
                <label class="inline" style="gap:6px">
                    <span>${he ? 'עובי מסור' : 'Saw kerf'}</span>
                    <input id="kerf-input" type="text" min="0" step="0.1" value="" placeholder="${he?'הזן ערך':'Enter value'}" class="btn select" style="width:80px;" />
                </label>
            </div>
        `;
        btn.after(rowDiv);
        // Handlers
        const onDoc = (e) => { if (!rowDiv.contains(e.target) && e.target !== btn) { document.removeEventListener('click', onDoc, true); closePopover(); } };
        document.addEventListener('click', onDoc, true);
    // איפוס שדות בכל פתיחה
    // no edge trim fields
    const kerfEl = rowDiv.querySelector('#kerf-input');
    if (kerfEl) {
        let savedMM = Number(loadData('kerfMM'));
        if (!isFinite(savedMM) || savedMM <= 0) savedMM = 3;
        const txt = (unitMain.textContent||'').toLowerCase();
        const isInch = txt.includes('inch') || txt.includes('אינץ');
        const num = isInch ? Number(savedMM/25.4).toFixed(3) : String(Math.round(savedMM));
        kerfEl.value = num + ' ' + unitLbl;
    }
    rowDiv.querySelector('#kerf-input')?.addEventListener('focus', (ev) => {
        if (ev.target.value.includes(' ')) {
            ev.target.value = '';
        }
    });
    // Tooltip helpers (hover or click)
        const removeTooltip = () => { try{ rowDiv.querySelectorAll('.help-tooltip').forEach(n=>n.remove()); }catch(_){} };
        const showTooltip = (anchor, text) => {
            removeTooltip();
            const tip = document.createElement('div');
            tip.className = 'help-tooltip';
            tip.textContent = text;
            rowDiv.appendChild(tip);
            // position near icon
            try {
                const isRTL = (document.documentElement && document.documentElement.dir === 'rtl');
                const ar = anchor.getBoundingClientRect();
                const rr = rowDiv.getBoundingClientRect();
                const top = Math.max(0, ar.top - rr.top - 4);
                let left;
                if (isRTL) left = Math.max(0, ar.left - rr.left - tip.offsetWidth - 8);
                else left = Math.max(0, ar.right - rr.left + 8);
                tip.style.top = top + 'px';
                tip.style.left = left + 'px';
            } catch(_){ }
            const onDoc = (e) => { if (!tip.contains(e.target) && e.target !== anchor) { removeTooltip(); document.removeEventListener('click', onDoc, true); } };
            setTimeout(()=> document.addEventListener('click', onDoc, true), 0);
        };
        const wireHelp = (key, text) => {
            const el = rowDiv.querySelector(`.help-icon[data-help="${key}"]`);
            if (!el) return;
            const t = text;
            el.addEventListener('mouseenter', ()=> showTooltip(el, t));
            el.addEventListener('mouseleave', ()=> removeTooltip());
            el.addEventListener('click', (e)=>{ e.stopPropagation(); showTooltip(el, t); });
            el.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); showTooltip(el, t); }});
        };
        wireHelp('orientation', he ? 'בחרו אופציה זו אם תרצו לחתוך בכיוון הסיבים בלבד. הפלטות מוצגות תמיד כך שהצלע הארוכה היא הצלע האופקית' : 'Select this to cut only along the grain. Plates are shown with the long side as horizontal.');
        wireHelp('edgetrim', he ? 'ציינו את השוליים הפגומים שלא יכנסו למידות הפלטה בחישובים' : 'Specify damaged margins that will not be included in plate dimensions for calculations.');
        wireHelp('sawcut', he ? 'החיתוך מתבצע ע״י מסור דיסק או ג׳יקסו ולא כחיתוך גיליוטיני (קצה לקצה)' : 'Cut is with a circular saw or jigsaw, not guillotine (edge-to-edge)');

    // Orientation lock toggle
        rowDiv.querySelector('#orientation-switch')?.addEventListener('click', () => {
            sawAdv.orientationLock = !sawAdv.orientationLock; saveData('sawAdv', sawAdv);
            const sw = rowDiv.querySelector('#orientation-switch'); if (sw) sw.setAttribute('data-on', sawAdv.orientationLock ? '1' : '0');
            const knob = sw.querySelector('.knob'); if (knob) { knob.style.color = sawAdv.orientationLock ? '#000' : '#ccc'; }
            const pref = rowDiv.querySelector('#orientation-pref'); if (pref) pref.style.display = sawAdv.orientationLock ? 'flex' : 'none';
            if (pref) pref.style.margin = sawAdv.orientationLock ? '8px 0 8px' : '0';
        });
        rowDiv.querySelector('#orientation-select')?.addEventListener('change', (e)=>{
            const v = (e.target && e.target.value)==='vertical' ? 'vertical' : 'horizontal';
            sawAdv.orientationPref = v; saveData('sawAdv', sawAdv);
        });
    // Edge trim toggle + fields
        rowDiv.querySelector('#edgetrim-switch')?.addEventListener('click', () => {
            sawAdv.edgeTrimOn = !sawAdv.edgeTrimOn; saveData('sawAdv', sawAdv);
            const sw = rowDiv.querySelector('#edgetrim-switch'); if (sw) sw.setAttribute('data-on', sawAdv.edgeTrimOn ? '1' : '0');
            const knob = sw.querySelector('.knob'); if (knob) { knob.style.color = sawAdv.edgeTrimOn ? '#000' : '#ccc'; }
            const box = rowDiv.querySelector('#edgetrim-fields'); if (box) box.style.display = sawAdv.edgeTrimOn ? 'grid' : 'none';
        });
        const et = rowDiv.querySelector('#edge-top');
        const eb = rowDiv.querySelector('#edge-bottom');
        const er = rowDiv.querySelector('#edge-right');
        const el = rowDiv.querySelector('#edge-left');
        const saveEdgeVals = ()=>{
            sawAdv.edgeTrimTopCm = Number(et?.value||0) || 0;
            sawAdv.edgeTrimBottomCm = Number(eb?.value||0) || 0;
            sawAdv.edgeTrimRightCm = Number(er?.value||0) || 0;
            sawAdv.edgeTrimLeftCm = Number(el?.value||0) || 0;
            saveData('sawAdv', sawAdv);
        };
        et?.addEventListener('input', saveEdgeVals);
        eb?.addEventListener('input', saveEdgeVals);
        er?.addEventListener('input', saveEdgeVals);
        el?.addEventListener('input', saveEdgeVals);
    // Saw cutting toggle
        rowDiv.querySelector('#sawcut-switch')?.addEventListener('click', () => {
            sawAdv.sawCuttingOn = !sawAdv.sawCuttingOn; saveData('sawAdv', sawAdv);
            const sw = rowDiv.querySelector('#sawcut-switch'); if (sw) sw.setAttribute('data-on', sawAdv.sawCuttingOn ? '1' : '0');
            const knob = sw.querySelector('.knob'); if (knob) { knob.style.color = sawAdv.sawCuttingOn ? '#000' : '#ccc'; }
        });
    // No save button needed — inputs auto-save on change
    };
    if (btn) btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = document.getElementById('saw-settings-row');
        if (row) { closePopover(); return; }
        openPopover();
    });
} catch {}

if (addReqBtn) {
    addReqBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // אם המאגר ריק — הצג הודעה במקום הוספת שורת דרישה
        const isInvEmpty = !Array.isArray(inventoryData) || inventoryData.length === 0;
        if (isInvEmpty) {
            const msg = (language==='he')
                ? 'המלאי ריק, ראשית יש לטעון קובץ מלאי או להזין ידנית'
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
    material: r.querySelector('select[data-field="material"]')?.value || '',
        type: r.querySelector('select[data-field="type"]')?.value || '',
        thickness: r.querySelector('select[data-field="thickness"]')?.value || '',
        width: (r.querySelector('[data-field="width"]')?.value) || '',
        length: Number(r.querySelector('input[data-field="length"]')?.value || 0),
    qty: Number(r.querySelector('input[data-field="qty"]')?.value || 1),
    tag: r.querySelector('input[data-field="tag"]')?.value || ''
    })).filter(x => x.type && x.length > 0 && x.qty > 0);
}

function renderResultsPlaceholder(summary) {
    const area = document.getElementById('results-area');
    if (!area) return;
    const cur = document.getElementById('select-currency')?.value || inventoryPriceCurrencyUnit || '';
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
            : (language === 'he' ? 'הסתר מלאי' : 'Hide Inventory');
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
            toggleDbBtn.textContent = (language === 'he' ? 'הסתר מלאי' : 'Hide Inventory');
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
        /* Enlarge the plate size label under each plate image for PDF only */
    svg .plate-size-label, img.diagram[data-kind="plate"] + .plate-size-label{ font-size: 26px !important; }
        `;
                temp.appendChild(style2);
                // Replace inline SVGs with PNG <img> to improve html2canvas reliability (esp. on mobile and file://)
                async function replaceSvgsWithImages(root){
                    const svgs = Array.from(root.querySelectorAll('svg.diagram'));
                    const tasks = svgs.map(svg => new Promise(resolve => {
                        try {
                            // Bump the plate size label font before serialization so it is reflected in the rasterized image
                            try {
                                const kind = svg.getAttribute('data-kind') || '';
                                if (kind === 'plate') {
                                    const sizeLabel = svg.querySelector('text.plate-size-label');
                                    if (sizeLabel) {
                                        sizeLabel.setAttribute('font-size', '26');
                                    }
                                }
                            } catch(_e) {}
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
                                // Record diagram positions to avoid splitting them when slicing the canvas later
                                let __diagCssRanges = [];
                                let __tempWidthCss = 1100;
                                try {
                                    const tempRect = temp.getBoundingClientRect();
                                    __tempWidthCss = Math.max(1, Math.round(tempRect.width));
                                    const diagImgs = Array.from(clonedArea.querySelectorAll('img.diagram'));
                                    __diagCssRanges = diagImgs.map(img => {
                                        const r = img.getBoundingClientRect();
                                        return { top: r.top - tempRect.top, bottom: r.bottom - tempRect.top };
                                    });
                                } catch(_){ __diagCssRanges = []; }
                                // expose for later closure scope
                                clonedArea.__diagCssRanges = __diagCssRanges;
                                clonedArea.__tempWidthCss = __tempWidthCss;
                                // התאמת טבלת חיתוכים (הראשונה) שתתאים לרוחב הדף – הקטנה דינמית + גלישת עמודת חיתוכים לשתי שורות
                try {
                                        const allTables = Array.from(clonedArea.querySelectorAll('.results-section table'));
                    if (allTables.length) {
                                                const st = document.createElement('style');
                                                st.textContent = `
                                                    .results-section table{ table-layout:auto !important; width:auto !important; }
                                                    .results-section table th, .results-section table td{ padding:6px 6px; vertical-align:middle; }
                                                    /* Wrap long Cuts column into two lines if needed */
                                                    .results-section table td.cuts, .results-section table th.cuts{ white-space:normal; max-width:360px; word-break:break-word; }
                                                `;
                        temp.appendChild(st);
                        // allow layout to settle
                        await new Promise(r => setTimeout(r, 0));
                                                for (let ti=0; ti<allTables.length; ti++) {
                                                        const tbl = allTables[ti];
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
                                                                // Specifically mark the Cuts column cells on the first (top) table so CSS can wrap
                                                                if (ti === 0) {
                                                                    try {
                                                                        const ths = Array.from(tbl.querySelectorAll('thead th'));
                                                                        const cutsIdx = ths.findIndex(th => /(צבא\s*חיתוכים|חיתוכים|Cuts)/.test(th.textContent||''));
                                                                        if (cutsIdx >= 0) {
                                                                            ths[cutsIdx].classList.add('cuts');
                                                                            Array.from(tbl.querySelectorAll(`tbody tr`)).forEach(tr => {
                                                                                const td = tr.children[cutsIdx];
                                                                                if (td) td.classList.add('cuts');
                                                                                // Optionally split very long comma-separated lists into two lines
                                                                                if (td && (td.textContent||'').length > 60) {
                                                                                    const txt = td.textContent;
                                                                                    const parts = txt.split(/,\s*/);
                                                                                    const half = Math.ceil(parts.length/2);
                                                                                    td.innerHTML = `<div>${parts.slice(0,half).join(', ')}</div><div>${parts.slice(half).join(', ')}</div>`;
                                                                                }
                                                                            });
                                                                        }
                                                                    } catch(_){}
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
        // After capture: compute diagram ranges (in canvas px) to avoid splitting diagrams when paginating
        let __diagRangesCanvas = [];
        try {
            const tempRect = temp.getBoundingClientRect();
            const pxPerCss = canvas.width / Math.max(1, tempRect.width);
            const blocks = Array.from(temp.querySelectorAll('.results-section'));
            __diagRangesCanvas = blocks.map(sec => {
                const img = sec.querySelector('img.diagram');
                if (!img) return null;
                const title = sec.querySelector('h3');
                const rImg = img.getBoundingClientRect();
                const rTitle = title ? title.getBoundingClientRect() : rImg;
                const top = (rTitle.top - tempRect.top) * pxPerCss; // מתחיל מהכותרת
                const bottom = (rImg.bottom - tempRect.top) * pxPerCss; // מסתיים בתחתית הדיאגרמה
                return { top: Math.max(0, Math.floor(top)), bottom: Math.max(0, Math.floor(bottom)) };
            }).filter(Boolean).filter(rb => rb.bottom > rb.top);
        } catch(_){ __diagRangesCanvas = []; }

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
    // Compute safe page boundaries that never fall inside a diagram image
    try {
        const diagRanges = Array.isArray(__diagRangesCanvas) ? __diagRangesCanvas : [];
        const minSlice = 1; // allow very small slices if needed to avoid cutting diagrams
            while (offsetYpx < imgHpx) {
                let candidate = Math.min(offsetYpx + pageContentHpx, imgHpx);
                // If the boundary lies inside any diagram, move it up to just above that diagram
                const inside = diagRanges.find(d => d.top < candidate && d.bottom > candidate);
                if (inside) {
            const adjusted = Math.max(offsetYpx + 1, inside.top - 2);
                    if (adjusted - offsetYpx >= minSlice) {
                        candidate = adjusted;
                    }
                    // else keep candidate as-is; we'll accept a very small slice to avoid infinite loop
                }
                const sliceHpx = Math.max(1, Math.min(candidate - offsetYpx, imgHpx - offsetYpx));
                const dataUrl = makeSlice(canvas, offsetYpx, sliceHpx);
                const sliceHmm = sliceHpx / pxPerMm;
                pdf.addImage(dataUrl, 'PNG', margin, margin, pdfW, sliceHmm, undefined, 'FAST');
                offsetYpx += sliceHpx;
                if (offsetYpx < imgHpx) pdf.addPage();
            }
        } catch(_err) {
            // Fallback to simple paging if anything goes wrong
            while (offsetYpx < imgHpx) {
                const sliceHpx = Math.min(pageContentHpx, imgHpx - offsetYpx);
                const dataUrl = makeSlice(canvas, offsetYpx, sliceHpx);
                const sliceHmm = sliceHpx / pxPerMm;
                pdf.addImage(dataUrl, 'PNG', margin, margin, pdfW, sliceHmm, undefined, 'FAST');
                offsetYpx += sliceHpx;
                if (offsetYpx < imgHpx) pdf.addPage();
            }
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
    try {
        if (window.__AUTO_PRINT_PDF__) {
            window.__AUTO_PRINT_PDF__ = false;
            // Attempt to open the browser print dialog immediately
            setTimeout(() => { try { window.print(); } catch(_){} }, 250);
        }
    } catch(_){}
    } catch (e) { console.error(e); }
});

// האזור לסטטוס טעינת מאגר
function showDbStatus(msg) {
    const block = document.getElementById('block-db');
    if (!block) return;
    // show status only if there is any data in inventory
    const hasData = Array.isArray(inventoryData) && inventoryData.length > 0;
    if (!hasData) {
        const old = document.getElementById('db-status');
        if (old) old.remove();
        return;
    }
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
            // הצג יחידת מידה מתאימה ב-placeholder (לקרשים/קורות במטרי תמיד במ"מ)
            const widthPlaceholder = language==='he'
                ? (unitSystem==='imperial' ? 'רוחב (אינץ׳)' : 'רוחב (מ״מ)')
                : (unitSystem==='imperial' ? 'Width (inch)' : 'Width (mm)');
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
                // Always display mm for requirements widths in metric
                let disp = Number(v);
                if (unitSystem !== 'imperial') {
                    const mm = toMM(v, wUnit);
                    disp = isFinite(mm) ? mm : Number(v);
                } else {
                    disp = convertNumberByUnit(v, wUnit, 'imperial');
                }
                const label = Math.abs(disp - Math.round(disp)) < 1e-9 ? String(Math.round(disp)) : formatNumber(disp);
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
    showDbStatus(language === 'he' ? 'המלאי נטען מהדפדפן' : 'Inventory restored from browser');
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

// שמירה ועדכון של עובי המסור (kerf) בזמן אמת, וקריאה מהאחסון בהפעלה
(() => {
    try {
        const input = document.getElementById('saw-thickness');
        const unitChip = document.getElementById('saw-unit');
    const kerfHidden = document.getElementById('kerf');
        const recomputeIfAny = () => {
            try {
                const reqs = gatherRequirements();
                if (Array.isArray(reqs) && reqs.length) {
                    const res = computeOptimization();
                    renderResults(res);
                }
            } catch(_){ }
        };
        // restore saved kerf (stored in mm) into current UI units
    let savedMM = Number(loadData('kerfMM'));
    if (!isFinite(savedMM) || savedMM <= 0) { savedMM = 3; saveData('kerfMM', savedMM); }
    if (input && unitChip && isFinite(savedMM)) {
            if ((loadData('unitSystem')||unitSystem) === 'imperial') {
                input.value = (savedMM/25.4).toFixed(3) + ' ' + ((language==='he') ? 'אינץ׳' : 'inch');
                unitChip.textContent = (language==='he') ? 'אינץ׳' : 'inch';
            } else {
        input.value = Math.round(savedMM) + ' ' + ((language==='he') ? 'מ״מ' : 'mm');
                unitChip.textContent = (language==='he') ? 'מ״מ' : 'mm';
            }
            if (kerfHidden) kerfHidden.value = String(savedMM);
        }
        const onChange = () => {
            const v = parseFloat(input.value) || 0;
            const mm = (unitSystem==='imperial') ? (v*25.4) : v;
            if (isFinite(mm) && mm>=0) {
                saveData('kerfMM', mm);
                if (kerfHidden) kerfHidden.value = String(mm);
            }
            recomputeIfAny();
        };
        if (input) {
            input.addEventListener('input', onChange);
            input.addEventListener('change', onChange);
        }
    } catch{}
})();
});