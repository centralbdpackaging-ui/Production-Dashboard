// --- Configuration & State ---
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxIewqsIP4ibjYe_AmOqbVcccFm_hnQOD2T2l4a1gf8ghHAqQupFFwss3T73ZJuQTSM/exec',
  REFRESH_INTERVAL: 30000,
  DEFAULT_LANGUAGE: 'en',
  DEFAULT_ZOOM: 1.0
};

const State = {
  currentSlide: 0,
  slides: [],
  data: null,
  timer: null,
  interval: 10000,
  selectedDate: new Date().toISOString().split('T')[0],
  selectedShift: 'Day',
  language: localStorage.getItem('dash_lang') || CONFIG.DEFAULT_LANGUAGE,
  zoom: parseFloat(localStorage.getItem('dash_zoom')) || CONFIG.DEFAULT_ZOOM,
  isPaused: false,
  showAll: false,
  enabledSlides: JSON.parse(localStorage.getItem('dash_enabled_slides')) || [0, 1, 2, 3, 4, 5]
};

// --- Initializer ---
function init() {
  State.slides = document.querySelectorAll('.slide');

  // Auto-detect Shift based on time (Day: 08:00 - 20:00, Night: rest)
  const hour = new Date().getHours();
  if (hour >= 8 && hour < 20) {
    State.selectedShift = 'Day';
  } else {
    State.selectedShift = 'Night';
  }

  setupEventListeners();
  applyLanguage();
  applyZoom();
  syncSettingsUI();

  updateClock();
  setInterval(updateClock, 1000);

  loadData();
  startSlideTimer();
  setInterval(loadData, CONFIG.REFRESH_INTERVAL);
}

function setupEventListeners() {
  // Navigation
  document.getElementById('prevSlideBtn')?.addEventListener('click', prevSlide);
  document.getElementById('nextSlideBtn')?.addEventListener('click', nextSlide);
  document.getElementById('prevSlideHeader')?.addEventListener('click', prevSlide);
  document.getElementById('nextSlideHeader')?.addEventListener('click', nextSlide);

  // Settings Modal
  const settingsBtn = document.getElementById('settingsBtn');
  const modal = document.getElementById('settingsModal');
  const closeBtn = document.getElementById('closeModalBtn');
  const autoSlideToggle = document.getElementById('autoSlideToggle');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const langSelect = document.getElementById('langSelect');
  const zoomRange = document.getElementById('zoomRange');

  settingsBtn?.addEventListener('click', () => {
    document.body.classList.toggle('settings-open');
    syncSettingsUI();
  });
  closeBtn?.addEventListener('click', () => {
    document.body.classList.remove('settings-open');
  });

  autoSlideToggle?.addEventListener('change', (e) => {
    if (e.target.checked) startSlideTimer();
    else stopSlideTimer();
  });

  playPauseBtn?.addEventListener('click', () => {
    if (State.timer) {
      stopSlideTimer();
      playPauseBtn.innerText = '▶️';
    } else {
      startSlideTimer();
      playPauseBtn.innerText = '⏸️';
    }
  });

  langSelect?.addEventListener('change', (e) => {
    State.language = e.target.value;
    localStorage.setItem('dash_lang', State.language);
    applyLanguage();
  });

  zoomRange?.addEventListener('change', (e) => {
    State.zoom = parseFloat(e.target.value);
    localStorage.setItem('dash_zoom', State.zoom);
    applyZoom();
  });

  // Slide Selection and Toggling
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      goToSlide(parseInt(btn.dataset.slide));
    });
  });

  document.querySelectorAll('.slide-toggle-cb').forEach(cb => {
    // Set initial checkbox state
    cb.checked = State.enabledSlides.includes(parseInt(cb.dataset.slide));
    
    cb.addEventListener('change', (e) => {
      const slideIdx = parseInt(e.target.dataset.slide);
      if (e.target.checked) {
        if (!State.enabledSlides.includes(slideIdx)) State.enabledSlides.push(slideIdx);
      } else {
        State.enabledSlides = State.enabledSlides.filter(id => id !== slideIdx);
      }
      // Sort to maintain order
      State.enabledSlides.sort((a, b) => a - b);
      localStorage.setItem('dash_enabled_slides', JSON.stringify(State.enabledSlides));
    });
  });

  // Date/Shift
  const dateInput = document.getElementById('datePicker');
  if (dateInput) {
    dateInput.value = State.selectedDate;
    dateInput.addEventListener('change', (e) => {
      State.selectedDate = e.target.value;
      loadData();
    });
  }

  document.querySelectorAll('.shift-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.shift-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      State.selectedShift = e.target.dataset.shift;
      loadData();
    });
  });

  // Config Import/Export
  document.getElementById('exportConfigBtn')?.addEventListener('click', exportConfig);
  document.getElementById('importConfigBtn')?.addEventListener('click', () => document.getElementById('configFile').click());
  document.getElementById('configFile')?.addEventListener('change', importConfig);
}

// --- UI Logic ---

function applyZoom() {
  const shell = document.getElementById('app-shell');
  if (shell) {
    shell.style.transform = `scale(${State.zoom})`;
    shell.style.transformOrigin = 'top left';
    shell.style.width = `${100 / State.zoom}%`;
    shell.style.height = `${100 / State.zoom}%`;
  }
  const zoomVal = document.getElementById('zoomVal');
  if (zoomVal) zoomVal.innerText = `${Math.round(State.zoom * 100)}%`;
}

function applyLanguage() {
  const elements = document.querySelectorAll('[data-en]');
  elements.forEach(el => {
    const text = el.getAttribute(`data-${State.language}`);
    if (text) {
      if (el.tagName === 'INPUT' && el.type === 'button') el.value = text;
      else if (el.tagName === 'TITLE') document.title = text;
      else el.innerText = text;
    }
  });
}

function syncSettingsUI() {
  const langSelect = document.getElementById('langSelect');
  const zoomRange = document.getElementById('zoomRange');
  const autoSlideToggle = document.getElementById('autoSlideToggle');
  const zoomVal = document.getElementById('zoomVal');

  if (langSelect) langSelect.value = State.language;
  if (zoomRange) zoomRange.value = State.zoom;
  if (zoomVal) zoomVal.innerText = `${Math.round(State.zoom * 100)}%`;
  if (autoSlideToggle) autoSlideToggle.checked = (State.timer !== null);

  // Highlighting is handled by CSS when side panel is open, but we still update the checked state
}

function showLoading(show) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = 'none'; // Always hidden to avoid blocking UI
}

function showError(msg) {
  const el = document.getElementById('errorOverlay');
  const msgEl = document.getElementById('errorMsg');
  if (el && msgEl) {
    msgEl.innerText = msg;
    el.style.display = 'flex';
  }
}

// --- Slide Control ---

function goToSlide(index) {
  if (State.slides.length === 0) return;
  State.slides[State.currentSlide].classList.remove('active');
  State.currentSlide = index;
  State.slides[State.currentSlide].classList.add('active');

  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.classList.toggle('active-view', parseInt(btn.dataset.slide) === index);
  });
}

function nextSlide() {
  if (State.enabledSlides.length === 0) return;
  
  let nextIndex = (State.currentSlide + 1) % State.slides.length;
  let attempts = 0;
  while (!State.enabledSlides.includes(nextIndex) && attempts < State.slides.length) {
    nextIndex = (nextIndex + 1) % State.slides.length;
    attempts++;
  }
  
  if (State.enabledSlides.includes(nextIndex)) {
    goToSlide(nextIndex);
  }
}

function prevSlide() {
  if (State.enabledSlides.length === 0) return;
  
  let prevIndex = (State.currentSlide - 1 + State.slides.length) % State.slides.length;
  let attempts = 0;
  while (!State.enabledSlides.includes(prevIndex) && attempts < State.slides.length) {
    prevIndex = (prevIndex - 1 + State.slides.length) % State.slides.length;
    attempts++;
  }
  
  if (State.enabledSlides.includes(prevIndex)) {
    goToSlide(prevIndex);
  }
}

function startSlideTimer() {
  stopSlideTimer();
  State.timer = setInterval(nextSlide, State.interval);
}

function stopSlideTimer() {
  if (State.timer) clearInterval(State.timer);
  State.timer = null;
}

// --- Data & Rendering ---

function loadData() {
  showLoading(true);
  document.getElementById('errorOverlay').style.display = 'none';

  const handleError = (err) => {
    console.warn('Data Load Warning:', err);
    showLoading(false);

    // Only show the blocking error overlay if we have absolutely no data to show
    // "Failed to fetch" is usually a CORS issue in local development
    if (!State.data) {
      console.log('No data available, falling back to mock data...');
      State.data = getMockData();
      renderAllSlides();

      // Optional: show a small toast instead of a blocking overlay
      console.warn('Dashboard is running with Mock Data due to connection issues.');
    } else if (err.message && !err.message.includes('fetch')) {
      // Show actual API errors if it's not a connection/CORS issue
      showError(err.message);
    }
  };

  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(data => {
        showLoading(false);
        if (data && !data.error) {
          State.data = processRawData(data);
          renderAllSlides();
        } else handleError(new Error(data.error || 'Invalid API Response'));
      })
      .withFailureHandler(handleError)
      .getDashboardData({ date: State.selectedDate, shift: State.selectedShift });
  } else {
    // Fetch from Master Record sheet
    fetch(`${CONFIG.SCRIPT_URL}?sheet=Master Record&date=${State.selectedDate}&shift=${State.selectedShift}`)
      .then(res => res.json())
      .then(data => {
        showLoading(false);
        if (data.error) throw new Error(data.error);
        State.data = processRawData(data);
        renderAllSlides();
      })
      .catch(handleError);
  }
}

/**
 * NEW: Universal Data Processor
 * This function handles all mapping and categorization locally.
 */
function processRawData(response) {
  if (!response || !response.rawData) return response;

  const rawRows = response.rawData;
  const processed = {
    machines: { "Side Seal": [], "Bottom": [], "Zip Lock": [] },
    debug: response.debug,
    lastUpdated: response.lastUpdated,
    rawFiltered: [],
    rawAll: rawRows // Store everything for the Master view
  };

  let currentCat = "Side Seal";

  rawRows.forEach(row => {
    let m = { id: '', prod: 0, target: 0, status: 'run', remark: '', category: '' };
    let rowDate = "";

    // 1. Identification & Mapping
    Object.keys(row).forEach(key => {
      const k = key.toLowerCase().replace(/\s+/g, '');
      const val = row[key];

      // Date identification with Local Timezone Fix
      if (k === 'date') {
        if (typeof val === 'string' && val.includes('T')) {
          // Fix for ISO strings (e.g., 2026-04-28T18:00:00.000Z to 2026-04-29)
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            rowDate = `${year}-${month}-${day}`;
          } else {
            rowDate = val.split('T')[0];
          }
        } else if (val instanceof Date) {
          const year = val.getFullYear();
          const month = String(val.getMonth() + 1).padStart(2, '0');
          const day = String(val.getDate()).padStart(2, '0');
          rowDate = `${year}-${month}-${day}`;
        } else {
          rowDate = String(val).split('T')[0];
        }
      }

      // Machine Identification
      if (k === 'machineno' || k === 'id' || k === 'no' || k === 'slno' || k === 'machine') {
        m.id = String(val);
        // --- 🆕 Add Machine Type based on Machine No ---
        const idLower = m.id.toUpperCase();
        if (idLower.includes('SIDE SEAL')) m.category = "SIDE SEAL";
        else if (idLower.includes('BOTTOM')) m.category = "BOTTOM";
        else if (idLower.includes('ZIP LOCK')) m.category = "ZIP LOCK";
        else m.category = "OTHER";
      }

      // Production & Target
      if (k.includes('production') || k.includes('prod') || k.includes('output') || k.includes('qty')) {
        m.prod = val;
      }
      if (k.includes('target')) {
        m.target = val;
      }

      // Status & Remarks
     if (k === 'machinestatus' || k === 'status' || k === 'st') {
  const rawS = String(val || '').toLowerCase().trim();
  const cleanS = rawS.replace(/[\s\-\/]/g, '');

  if (
    cleanS === 'breakdown' ||
    cleanS.includes('break') ||
    cleanS.includes('bd') ||
    cleanS.includes('down') ||
    cleanS.includes('stop')
  ) {
    m.status = 'breakdown';

  } else if (cleanS.includes('idle')) {
    m.status = 'idle';

  } else if (cleanS.includes('run')) {
    m.status = 'run';

  } else {
    m.status = 'run';
  }
}
      
      if (k.includes('remark') || k.includes('reason') || k.includes('details')) {
        m.remark = String(val);
      }
      if (k === 'category' || k === 'section' || k === 'dept') {
        m.category = val;
      }
    });



    // 2. Date Filtering — Strict Comparison
    const targetDate = State.selectedDate; // YYYY-MM-DD (Selected in Dashboard)

    // Ensure both rowDate and targetDate exist
    if (!rowDate || !targetDate) return;

    const clean = (s) => String(s).replace(/[^0-9]/g, '');
    const d1 = clean(rowDate); // Row Date from Sheet
    const d2 = clean(targetDate); // Selected Date (YYYYMMDD)

    // Convert DDMMYYYY to YYYYMMDD for comparison if needed
    let d1_final = d1;
    if (d1.length === 8 && !d1.startsWith('20')) {
      // Assume DDMMYYYY -> YYYYMMDD
      d1_final = d1.substring(4, 8) + d1.substring(2, 4) + d1.substring(0, 2);
    }

    // Strict Match Check
    const isMatch = (d1 === d2) || (d1_final === d2);

    // IF NOT MATCH, DISCARD ROW
    if (!isMatch) return;

    // Add Machine Type to the row for Master Data
    row['Machine Type'] = m.category;

    // Only matching rows reach here
    processed.rawFiltered.push(row);

    // 3. Cleanup & Validation
    const idStr = String(m.id || "").toUpperCase().trim();
    if (!idStr || idStr.includes('TOTAL') || idStr.includes('GRAND') || idStr.includes('SUM')) return;

    // Convert numbers
    const tVal = parseFloat(String(m.target || 0).replace(/[^0-9.]/g, '')) || 0;
    const pVal = parseFloat(String(m.prod || 0).replace(/[^0-9.]/g, '')) || 0;
    m.target = tVal;
    m.prod = pVal;

    // 4. Categorization
    let assignedCat = currentCat;

    // Check for Category Switcher Rows (Target/Prod are 0)
    if (tVal === 0 && pVal === 0) {
      if (idStr.includes('SIDE')) { currentCat = "Side Seal"; return; }
      if (idStr.includes('BOTTOM')) { currentCat = "Bottom"; return; }
      if (idStr.includes('ZIP')) { currentCat = "Zip Lock"; return; }
    }

    // Check for explicit Category column
    const catCol = String(m.category || "").toUpperCase();
    if (catCol.includes('SIDE')) assignedCat = "Side Seal";
    else if (catCol.includes('BOTTOM')) assignedCat = "Bottom";
    else if (catCol.includes('ZIP')) assignedCat = "Zip Lock";
    else assignedCat = currentCat;

    if (processed.machines[assignedCat]) {
      processed.machines[assignedCat].push(m);
    }
  });

  console.log('--- DEBUG: Processed Data ---', processed);
  return processed;
}

function renderAllSlides() {
  const d = State.data;
  if (!d || !d.machines) return;

  const cats = { 'Side Seal': 'ss', 'Bottom': 'bt', 'Zip Lock': 'zl' };
  let totals = { prod: 0, target: 0, run: 0, bd: 0 };
  let breakdowns = [];

  Object.entries(cats).forEach(([name, prefix]) => {
    const list = d.machines[name] || [];
    const stats = list.reduce((acc, m) => {
      const p = Number(m.prod) || 0;
      const t = Number(m.target) || 0;
      const s = String(m.status).toLowerCase();
      const isBD = s === 'breakdown' || s === 'bd';
      const isIdle = s === 'idle';

      if (isBD) breakdowns.push({ ...m, category: name });

      return {
        prod: acc.prod + p,
        target: acc.target + t,
        run: acc.run + (s === 'run' ? 1 : 0),
        idle: acc.idle + (isIdle ? 1 : 0),
        bd: acc.bd + (isBD ? 1 : 0)
      };
    }, { prod: 0, target: 0, run: 0, idle: 0, bd: 0 });

    const pct = stats.target > 0 ? Math.round((stats.prod / stats.target) * 100) : 0;

    safeSetText(`${prefix}-sum-target`, stats.target.toLocaleString());
    safeSetText(`${prefix}-sum-prod`, stats.prod.toLocaleString());
    safeSetText(`${prefix}-sum-pct`, `${pct}%`);
    safeSetText(`${prefix}-sum-rem`, (stats.target - stats.prod).toLocaleString());
    safeSetText(`${prefix}-run-count`, stats.run);
    safeSetText(`${prefix}-idle-count`, stats.idle);
    safeSetText(`${prefix}-bd-count`, stats.bd);

    renderMachineGrid(`${prefix}-grid`, list);

    totals.prod += stats.prod;
    totals.target += stats.target;
    totals.run += stats.run;
    totals.bd += stats.bd;
  });

  // Summary KPI
  const totalPct = totals.target > 0 ? Math.round((totals.prod / totals.target) * 100) : 0;
  safeSetText('sum-total-target', totals.target.toLocaleString());
  safeSetText('sum-total-prod', totals.prod.toLocaleString());
  safeSetText('sum-total-pct', `${totalPct}%`);
  const runEl = document.getElementById('sum-running-count');
  if (runEl) runEl.innerHTML = `${totals.run} <span style="font-size: 20px; color: var(--text-muted);">/ 24</span>`;

  // Ticker & Breakdowns
  Ticker.build(Object.values(d.machines).flat());
  renderMachineGrid('bd-grid', breakdowns);

  // Render Master Data Table
  renderMasterDataTable(d.rawFiltered || []);

  safeSetText('lastUpdated', new Date().toLocaleTimeString());
}

function renderMachineGrid(id, machines) {
  const el = document.getElementById(id);
  if (!el) return;

  if (machines.length === 0 && id === 'bd-grid') {
    el.innerHTML = `<div class="no-bd" data-en="No Machines in Breakdown. All Good!" data-bn="কোন ব্রেকডাউন নেই। সবকিছু ঠিক আছে!">No Machines in Breakdown. All Good!</div>`;
    applyLanguage();
    return;
  }

  el.innerHTML = machines.map(m => {
    const p = Number(m.prod) || 0;
    const t = Number(m.target) || 0;
    const pct = t > 0 ? Math.round((p / t) * 100) : 0;
    const s = String(m.status).toLowerCase();
    const isBD = s === 'breakdown' || s === 'bd';
    const sClass = s === 'run' ? 'badge-run' : (isBD ? 'badge-bd' : '');
    // Display 'Breakdown' text for breakdown status
    const statusLabel = isBD ? 'BREAKDOWN' : s.toUpperCase();
    const reason = isBD ? (m.remark || m.reason || m.breakdownDetails || '') : '';

    return `
      <div class="m-card">
        <div class="m-header">
          <div class="m-title">
            ${m.category ? `<span class="m-cat">${m.category}</span>` : ''}
            ${m.id || m.machineNo || 'N/A'}
          </div>
          <div class="m-badge ${sClass}">${statusLabel}</div>
          <div class="m-badge ${sClass}">${s.toUpperCase()}</div>
        </div>
        <div class="m-body">
          <div class="m-kpi-item">
            <span class="m-kpi-lbl" data-en="Production" data-bn="উৎপাদন">Production</span>
            <span class="m-kpi-val" style="color:var(--accent-blue)">${p.toLocaleString()}</span>
          </div>
          <div class="m-kpi-item" style="text-align:right">
            <span class="m-kpi-lbl" data-en="Target" data-bn="লক্ষ্যমাত্রা">Target</span>
            <span class="m-kpi-val">${t.toLocaleString()}</span>
          </div>
        </div>
        <div class="m-progress"><div style="width:${pct}%"></div></div>
        <div class="m-footer">
          <span>Eff: ${pct}%</span>
          <span>${m.lastUpdate || 'Live'}</span>
        </div>
        ${reason ? `<div class="m-reason">Reason: ${reason}</div>` : ''}
      </div>
    `;
  }).join('');
  applyLanguage();
}

function renderMasterDataTable(rows) {
  const headEl = document.getElementById('master-data-head');
  const bodyEl = document.getElementById('master-data-body');
  if (!headEl || !bodyEl) return;

  if (rows.length === 0) {
    headEl.innerHTML = '';
    bodyEl.innerHTML = '<tr><td style="padding: 20px; text-align: center;">No data available</td></tr>';
    return;
  }

  const headers = Object.keys(rows[0]);
  headEl.innerHTML = headers.map(h => `<th style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); background: var(--bg-card, #1a1a2e); text-transform: uppercase;">${h}</th>`).join('');

  bodyEl.innerHTML = rows.map(row => {
    return `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">${headers.map(h => `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05);">${row[h] !== undefined && row[h] !== null ? row[h] : ''}</td>`).join('')}</tr>`;
  }).join('');
}

function toggleMasterTableView() {
  State.showAll = !State.showAll;
  const btn = document.getElementById('showAllBtn');
  if (btn) {
    btn.title = State.showAll ? 'Show Selected Date Data' : 'Show All Data';
    btn.innerText = State.showAll ? '✕' : '☰';
  }

  const baseUrl = CONFIG.SCRIPT_URL;
  const url = State.showAll
    ? `${baseUrl}?sheet=Master Record`
    : `${baseUrl}?sheet=Master Record&date=${new Date().toISOString().split('T')[0]}&shift=Day`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const rows = data.rawData || [];
      if (typeof renderMasterDataTable === 'function') {
        renderMasterDataTable(rows);
      }
    })
    .catch(err => console.error('Failed to load Master Record data:', err));
}


// --- Modules ---

const Ticker = {
  build(machines) {
    const el = document.getElementById('tickerMsg');
    if (!el) return;
    const parts = machines.map(m => {
      const p = Number(m.prod) || 0;
      const t = Number(m.target) || 0;
      const pct = t > 0 ? Math.round((p / t) * 100) : 0;
      return `[${m.id || m.machineNo}] Target: ${t.toLocaleString()} | Prod: ${p.toLocaleString()} (${pct}%)`;
    });
    el.innerText = ' • ' + parts.join('  •  ') + ' • ';
  }
};

// --- Config Management ---

function exportConfig() {
  const config = { zoom: State.zoom, language: State.language, interval: State.interval };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dash-config-${new Date().getTime()}.json`;
  a.click();
}

function importConfig(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (re) => {
    try {
      const cfg = JSON.parse(re.target.result);
      if (cfg.zoom) State.zoom = cfg.zoom;
      if (cfg.language) State.language = cfg.language;
      if (cfg.interval) State.interval = cfg.interval;

      localStorage.setItem('dash_lang', State.language);
      localStorage.setItem('dash_zoom', State.zoom);

      applyLanguage();
      applyZoom();
      syncSettingsUI();
      alert('Config imported successfully!');
    } catch (err) {
      alert('Invalid config file.');
    }
  };
  reader.readAsText(file);
}

// --- Utils ---
function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function updateClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  const opt = { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' };
  el.textContent = new Date().toLocaleTimeString(State.language === 'bn' ? 'bn-BD' : 'en-US', opt);
}

function getMockData() {
  return {
    machines: {
      'Side Seal': [{ id: 'SS-01', prod: 1500, target: 5000, status: 'run' }],
      'Bottom': [{ id: 'BT-01', prod: 800, target: 3000, status: 'bd', reason: 'Motor Overheat' }],
      'Zip Lock': [{ id: 'ZL-01', prod: 2000, target: 4000, status: 'run' }]
    }
  };
}

document.addEventListener('DOMContentLoaded', init);
