// --- Configuration & State ---
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzBU9Pg7zFCqFZm92_i7XblJbT26k15eX4y3ylHiDucyN2iWK5lDMK4X1nd_U_negI/exec',
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
  isPaused: false
};

// --- Initializer ---
function init() {
  State.slides = document.querySelectorAll('.slide');
  
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

  // Slide Selection
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      goToSlide(parseInt(btn.dataset.slide));
      // Removed: modal.style.display = 'none'; // Keep side panel open or close it?
      // User said "side by side", so usually it stays or toggles. 
      // I'll leave it open for now as it's a "Controller".
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
  goToSlide((State.currentSlide + 1) % State.slides.length);
}

function prevSlide() {
  goToSlide((State.currentSlide - 1 + State.slides.length) % State.slides.length);
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
    fetch(`${CONFIG.SCRIPT_URL}?date=${State.selectedDate}&shift=${State.selectedShift}`)
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
    lastUpdated: response.lastUpdated
  };

  let currentCat = "Side Seal";
  rawRows.forEach(row => {
    let m = {};
    let rowDate = "";
    let rowShift = "";

    // 1. Identify and match Date/Shift first
    Object.keys(row).forEach(key => {
      const k = key.toLowerCase().replace(/\s+/g, '');
      const val = row[key];
      
      if (k === 'date') {
        if (val instanceof Date) rowDate = val.toISOString().split('T')[0];
        else if (typeof val === 'string') rowDate = val.split('T')[0];
        else rowDate = String(val).split('T')[0];
      }
      if (k === 'shift') rowShift = String(val).trim();
    });

    // 2. FILTERING
    const targetDate = State.selectedDate;
    const targetShift = State.selectedShift;
    const isDailyRecord = response.debug && response.debug.sourceUsed === 'Daily Record';

    if (!isDailyRecord && rowDate && targetDate) {
      const d1 = String(rowDate).toLowerCase().replace(/[^0-9]/g, '');
      const d2 = String(targetDate).toLowerCase().replace(/[^0-9]/g, '');
      if (!d1.includes(d2) && !d2.includes(d1)) return;
    }
    
    if (targetShift !== 'Full' && rowShift) {
       const s1 = String(rowShift).toLowerCase();
       const s2 = String(targetShift).toLowerCase();
       if (!s1.includes(s2)) return;
    }

    // 3. Mapping: Aggressive search for columns
    Object.keys(row).forEach(key => {
      const k = key.toLowerCase().replace(/\s+/g, '');
      const val = row[key];

      // ID Mapping: Search for 'no', 'sl', 'machine', or 'id'
      if (k === 'id' || k === 'machineno' || k === 'sl' || k === 'no' || k === 'slno') {
          m.id = val;
      } else if ((k.includes('machine') || k.includes('no')) && !m.id) {
          m.id = val;
      }
      
      // Prod Mapping: Search for 'prod', 'qty', 'output'
      if (k.includes('production') || k.includes('prod') || k.includes('qty') || k.includes('output')) {
          if (!k.includes('name') && !k.includes('status')) m.prod = val;
      }
      
      // Target Mapping: Search for 'target'
      if (k.includes('target')) {
          m.target = val;
      }

      // Status Mapping
      if (k.includes('status')) {
        const s = String(val).toLowerCase().trim();
        if (s === 'run' || s === 'running') m.status = 'run';
        else if (s === 'breakdown' || s === 'bd') m.status = 'bd';
        else if (s === 'idle') m.status = 'idle';
        else m.status = 'run';
      }
    });

    // 4. VALIDATION & STATEFUL CATEGORIZATION
    const idStr = String(m.id || "").toUpperCase().trim();
    
    // Detect Category Switchers (Check if ID itself is a category name)
    if (idStr.includes('SIDE SEAL')) { currentCat = "Side Seal"; return; }
    if (idStr.includes('BOTTOM')) { currentCat = "Bottom"; return; }
    if (idStr.includes('ZIP LOCK')) { currentCat = "Zip Lock"; return; }

    // Skip empty rows or summary rows
    if (!idStr || idStr.includes('TOTAL') || idStr.includes('GRAND') || idStr.includes('SUM')) return;

    // Push machine to the active category
    if (m.id) {
      processed.machines[currentCat].push(m);
    }
  });

  console.log('--- DEBUG: Raw Headers Found ---', rawRows.length > 0 ? Object.keys(rawRows[0]) : 'No Rows');
  console.log('--- DEBUG: Processed Data ---', processed);
  return processed;
}

function renderAllSlides() {
  const d = State.data;
  if (!d || !d.machines) return;

  const cats = { 'Side Seal': 'ss', 'Bottom': 'bt', 'Zip Lock': 'zl' };
  let totals = { prod: 0, target: 0, run: 0 };
  let breakdowns = [];

  Object.entries(cats).forEach(([name, prefix]) => {
    const list = d.machines[name] || [];
    const stats = list.reduce((acc, m) => {
      const p = Number(m.prod) || 0;
      const t = Number(m.target) || 0;
      const s = String(m.status).toLowerCase();
      const isBD = s.includes('breakdown') || s === 'bd';
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
    const isBD = s.includes('breakdown') || s === 'bd';
    const sClass = s === 'run' ? 'badge-run' : (isBD ? 'badge-bd' : '');
    const reason = isBD ? (m.remark || m.reason || m.breakdownDetails || '') : '';

    return `
      <div class="m-card">
        <div class="m-header">
          <div class="m-title">
            ${m.category ? `<span class="m-cat">${m.category}</span>` : ''}
            ${m.id || m.machineNo || 'N/A'}
          </div>
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
