// --- Configuration ---
const CONFIG = {
  // Local development URL (fallback)
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby7VCR0Cf9lvVZTOQDfh7yTuA1c31TLhSGayqBrlxmDiQegLEF6t0PJbaLqjMl4m2uI/exec',
  REFRESH_INTERVAL: 30000 
};

// --- State Management ---
const State = {
  currentSlide: 0,
  slides: [],
  data: null,
  timer: null,
  interval: 10000,
  selectedDate: new Date().toISOString().split('T')[0],
  selectedShift: 'Day'
};

// --- Initializer ---
function init() {
  State.slides = document.querySelectorAll('.slide');
  
  // Dashboard Controller Setup
  const settingsBtn = document.getElementById('settingsBtn');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const modal = document.getElementById('settingsModal');
  const closeBtn = document.getElementById('closeModalBtn');
  const autoSlideToggle = document.getElementById('autoSlideToggle');
  const ctrlBtns = document.querySelectorAll('.ctrl-btn');

  if (settingsBtn && modal) {
    settingsBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
      // Sync toggle with current state
      if (autoSlideToggle) autoSlideToggle.checked = (State.timer !== null);
    });
  }

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (State.timer) {
        clearInterval(State.timer);
        State.timer = null;
        playPauseBtn.innerText = '▶️';
        playPauseBtn.title = 'Start Auto-Slide';
        if (autoSlideToggle) autoSlideToggle.checked = false;
      } else {
        startAutoSlide();
        playPauseBtn.innerText = '⏸️';
        playPauseBtn.title = 'Pause Auto-Slide';
        if (autoSlideToggle) autoSlideToggle.checked = true;
      }
    });
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
  }
  
  if (autoSlideToggle) {
    autoSlideToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        startAutoSlide();
      } else {
        clearInterval(State.timer);
        State.timer = null;
      }
    });
  }

  if (ctrlBtns) {
    ctrlBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slideIndex = parseInt(e.target.dataset.slide);
        goToSlide(slideIndex);
        if (autoSlideToggle && autoSlideToggle.checked) {
          clearInterval(State.timer);
          startAutoSlide();
        } else {
          clearInterval(State.timer);
          State.timer = null;
        }
        if (modal) modal.style.display = 'none';
      });
    });
  }
  
  updateClock();
  setInterval(updateClock, 1000);
  
  // Set default date picker value
  const dateInput = document.getElementById('datePicker');
  if (dateInput) {
    dateInput.value = State.selectedDate;
    dateInput.addEventListener('change', (e) => {
      State.selectedDate = e.target.value;
      loadData();
    });
  }

  // Shift Buttons
  document.querySelectorAll('.shift-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.shift-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      State.selectedShift = e.target.dataset.shift;
      loadData();
    });
  });
  
  loadData();
  startAutoSlide();
  setInterval(loadData, CONFIG.REFRESH_INTERVAL);
}

// --- Data Fetching (Environment Aware) ---
function loadData() {
  console.log(`Fetching data for ${State.selectedDate} [${State.selectedShift}]...`);
  
  // 1. Check if running inside Google Apps Script environment
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(data => {
        if (data && !data.error) {
          State.data = data;
          renderAll();
        } else {
          console.error("GAS API Error:", data.error);
        }
      })
      .getDashboardData({ date: State.selectedDate, shift: State.selectedShift });
  } else {
    // 2. Fallback for local development using fetch
    fetch(`${CONFIG.SCRIPT_URL}?date=${State.selectedDate}&shift=${State.selectedShift}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        State.data = data;
        renderAll();
      })
      .catch(err => {
        console.warn('Live fetch failed, showing mock data due to CORS or setup:', err);
        if (!State.data) {
          State.data = getMockData();
          renderAll();
        }
      });
  }
}

// --- UI Rendering ---
function renderAll() {
  const d = State.data;
  if (!d || !d.machines) return;

  const cats = { 'Side Seal': 'ss', 'Bottom': 'bt', 'Zip Lock': 'zl' };
  let totalProd = 0, totalTarget = 0, runningCount = 0;
  let allBDMachines = [];
  
  Object.entries(cats).forEach(([name, id]) => {
    const machines = d.machines[name] || [];
    const catProd = machines.reduce((a, b) => a + (Number(b.prod) || 0), 0);
    const catTarget = machines.reduce((a, b) => a + (Number(b.target) || 0), 0);
    const catRun = machines.filter(m => String(m.status).toLowerCase() === 'run').length;
    const catBDMachines = machines.filter(m => {
      const s = String(m.status).toLowerCase();
      return s.includes('breakdown') || s === 'bd';
    });
    const catBD = catBDMachines.length;
    const catPct = catTarget > 0 ? Math.round((catProd / catTarget) * 100) : 0;
    const catRem = catTarget - catProd;
    
    allBDMachines = allBDMachines.concat(catBDMachines.map(m => ({ ...m, category: name })));
    
    totalProd += catProd;
    totalTarget += catTarget;
    runningCount += catRun;
    
    safeSetText(`${id}-sum-target`, catTarget.toLocaleString());
    safeSetText(`${id}-sum-prod`, catProd.toLocaleString());
    safeSetText(`${id}-sum-pct`, `${catPct}%`);
    safeSetText(`${id}-sum-rem`, catRem.toLocaleString());
    safeSetText(`${id}-run-count`, catRun);
    safeSetText(`${id}-bd-count`, catBD);
    
    renderMachineGrid(`${id}-grid`, machines);
  });
  
  // Update Ticker with Machine Metrics
  let tickerParts = [];
  Object.values(d.machines).flat().forEach(m => {
    const p = Number(m.prod) || 0;
    const t = Number(m.target) || 0;
    const pct = t > 0 ? Math.round((p / t) * 100) : 0;
    tickerParts.push(`[${m.id || m.machineNo || 'N/A'}] Target: ${t.toLocaleString()} | Prod: ${p.toLocaleString()} | Ach: ${pct}%`);
  });
  const tickerEl = document.getElementById('tickerMsg');
  if (tickerEl) {
    tickerEl.innerText = ' • ' + tickerParts.join('  •  ') + ' • ';
  }
  
  // Render breakdowns to the new grid
  renderMachineGrid('bd-grid', allBDMachines);
  
  const totalPct = totalTarget > 0 ? Math.round((totalProd / totalTarget) * 100) : 0;
  safeSetText('sum-total-target', totalTarget.toLocaleString());
  safeSetText('sum-total-prod', totalProd.toLocaleString());
  const runEl = document.getElementById('sum-running-count');
  if (runEl) runEl.innerHTML = `${runningCount} <span style="font-size: 20px; color: var(--text-muted);">/ 24</span>`;
  safeSetText('sum-total-pct', `${totalPct}%`);
  
  safeSetText('lastUpdated', new Date().toLocaleTimeString());
}

function renderMachineGrid(containerId, machines) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (machines.length === 0 && containerId === 'bd-grid') {
    container.innerHTML = '<div style="color:var(--green); font-size: 20px; font-weight:bold; grid-column: 1/-1; text-align:center; padding: 40px;">No Machines in Breakdown. All Good!</div>';
    return;
  }
  
  container.innerHTML = machines.map(m => {
    const prod = Number(m.prod) || 0;
    const target = Number(m.target) || 0;
    const pct = target > 0 ? Math.round((prod / target) * 100) : 0;
    const status = String(m.status).toLowerCase();
    const isBD = status.includes('breakdown') || status === 'bd';
    const statusClass = status === 'run' ? 'badge-run' : (isBD ? 'badge-bd' : '');
    const titlePrefix = m.category ? `<span style="color:var(--text-muted); font-size:12px; display:block; margin-bottom:2px;">${m.category}</span>` : '';
    const details = isBD && (m.remark || m.reason || m.breakdownDetails) ? `<div style="color:var(--red); font-size:12px; margin-top:8px; font-weight:bold; border-top:1px solid rgba(239,68,68,0.2); padding-top:5px;">Reason: ${m.remark || m.reason || m.breakdownDetails}</div>` : '';
    
    return `
      <div class="m-card">
        <div class="m-header">
          <div class="m-title">${titlePrefix}${m.id || m.machineNo || 'N/A'}</div>
          <div class="m-badge ${statusClass}">${status.toUpperCase()}</div>
        </div>
        <div class="m-body">
          <div class="m-kpi-item">
            <span class="m-kpi-lbl">Production</span>
            <span class="m-kpi-val" style="color:var(--accent-blue)">${prod.toLocaleString()}</span>
          </div>
          <div class="m-kpi-item" style="text-align:right">
            <span class="m-kpi-lbl">Target</span>
            <span class="m-kpi-val">${target.toLocaleString()}</span>
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.05); height:6px; border-radius:3px; overflow:hidden;">
          <div style="width:${pct}%; background:var(--accent-blue); height:100%;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted)">
          <span>Efficiency: ${pct}%</span>
          <span>${m.lastUpdate || 'Just now'}</span>
        </div>
        ${details}
      </div>
    `;
  }).join('');
}

// --- Helpers ---
function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function updateClock() {
  const el = document.getElementById('liveClock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: true });
}

function goToSlide(index) {
  if (State.slides.length === 0) return;
  State.slides[State.currentSlide].classList.remove('active');
  State.currentSlide = index;
  State.slides[State.currentSlide].classList.add('active');
  
  // Highlight active button in modal
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    if (parseInt(btn.dataset.slide) === index) {
      btn.classList.add('active-view');
    } else {
      btn.classList.remove('active-view');
    }
  });
}

function startAutoSlide() {
  if (State.timer) clearInterval(State.timer);
  State.timer = setInterval(() => {
    let next = (State.currentSlide + 1) % State.slides.length;
    goToSlide(next);
  }, State.interval);
}

function getMockData() {
  return {
    machines: {
      'Side Seal': [
        { id: 'Side Seal-01', prod: 12500, target: 80000, status: 'run' },
        { id: 'Side Seal-02', prod: 20000, target: 100000, status: 'run' },
        { id: 'Side Seal-03', prod: 47500, target: 150000, status: 'run' },
        { id: 'Side Seal-04', prod: 0, target: 50000, status: 'bd' },
        { id: 'Side Seal-05', prod: 35000, target: 120000, status: 'run' },
        { id: 'Side Seal-06', prod: 8000, target: 80000, status: 'run' },
      ],
      'Bottom': [
        { id: 'Bottom-01', prod: 0, target: 30000, status: 'idle' },
        { id: 'Bottom-02', prod: 0, target: 40000, status: 'bd' },
        { id: 'Bottom-03', prod: 5000, target: 20000, status: 'run' },
        { id: 'Bottom-04', prod: 9500, target: 30000, status: 'run' },
      ],
      'Zip Lock': [
        { id: 'Zip Lock-01', prod: 0, target: 40000, status: 'bd' },
        { id: 'Zip Lock-02', prod: 10000, target: 45000, status: 'run' },
        { id: 'Zip Lock-03', prod: 18000, target: 60000, status: 'run' },
      ]
    }
  };
}

document.addEventListener('DOMContentLoaded', init);
