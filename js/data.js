// ══════════════════════════════════════════
// DATA — Presets · Persistence · CRUD
// ══════════════════════════════════════════

const BEEP_INFO = {
  start:  { label: 'START',  cls: 'start'  },
  shoot:  { label: 'SHOOT',  cls: 'shoot'  },
  reload: { label: 'RELOAD', cls: 'reload' },
  end:    { label: 'END',    cls: 'end'    },
  alert:  { label: 'ALERT',  cls: 'alert'  }
};

const PRESETS = [
  {
    id: 'p1', name: 'COLD DRAW',
    delay: { min: 1.5, max: 4.0 },
    steps: [
      { id: 's1a', label: 'DRAW & FIRE',    beep: 'start', par: 2.5 },
      { id: 's1b', label: 'DONE',           beep: 'end',   par: null }
    ]
  },
  {
    id: 'p2', name: 'BILL DRILL',
    delay: { min: 1.5, max: 3.5 },
    steps: [
      { id: 's2a', label: 'DRAW & FIRE ×6', beep: 'start', par: 3.5 },
      { id: 's2b', label: 'DONE',           beep: 'end',   par: null }
    ]
  },
  {
    id: 'p3', name: 'FAILURE DRILL',
    delay: { min: 1.5, max: 4.0 },
    steps: [
      { id: 's3a', label: 'DRAW, 2 BODY',   beep: 'start', par: 1.8 },
      { id: 's3b', label: 'HEADSHOT',       beep: 'shoot', par: 1.8 },
      { id: 's3c', label: 'DONE',           beep: 'end',   par: null }
    ]
  },
  {
    id: 'p4', name: 'MAG RELOAD ×3',
    delay: { min: 1.5, max: 3.5 },
    steps: [
      { id: 's4a', label: 'DRAW & FIRE',    beep: 'start',  par: 2.0 },
      { id: 's4b', label: 'RELOAD & FIRE',  beep: 'reload', par: 3.5 },
      { id: 's4c', label: 'RELOAD & FIRE',  beep: 'reload', par: 3.5 },
      { id: 's4d', label: 'RELOAD & FIRE',  beep: 'reload', par: 3.5 },
      { id: 's4e', label: 'DONE',           beep: 'end',    par: null }
    ]
  },
  {
    id: 'p5', name: 'DRAW & RELOAD',
    delay: { min: 1.5, max: 3.5 },
    steps: [
      { id: 's5a', label: 'DRAW & FIRE',    beep: 'start',  par: 2.0 },
      { id: 's5b', label: 'RELOAD & FIRE',  beep: 'reload', par: 3.5 },
      { id: 's5c', label: 'DONE',           beep: 'end',    par: null }
    ]
  },
  {
    id: 'p6', name: '5-SHOT STRING',
    delay: { min: 1.5, max: 4.0 },
    steps: [
      { id: 's6a', label: 'DRAW & FIRE ×5', beep: 'start', par: 4.0 },
      { id: 's6b', label: 'DONE',           beep: 'end',   par: null }
    ]
  }
];

// ── Runtime state ──
let drills     = [];
let selectedId = null;
let editId     = null;

// ── Persistence ──
function loadData() {
  try {
    const raw = localStorage.getItem('dft3_drills');
    drills = raw ? JSON.parse(raw) : deepCopy(PRESETS);
    selectedId = localStorage.getItem('dft3_sel') || (drills[0]?.id ?? null);
  } catch {
    drills = deepCopy(PRESETS);
    selectedId = drills[0]?.id ?? null;
  }
}

function saveData() {
  try {
    localStorage.setItem('dft3_drills', JSON.stringify(drills));
    if (selectedId) localStorage.setItem('dft3_sel', selectedId);
  } catch {}
}

// ── Helpers ──
function deepCopy(o)    { return JSON.parse(JSON.stringify(o)); }
function uid()          { return 'u' + Math.random().toString(36).slice(2, 9); }
function getDrill(id)   { return drills.find(d => d.id === id) ?? null; }
function selDrill()     { return getDrill(selectedId); }
function editDrillObj() { return getDrill(editId); }
function isPreset(id)   { return PRESETS.some(p => p.id === id); }

// ── CRUD ──
function createNewDrill() {
  const id = uid();
  drills.push({
    id, name: 'NEW DRILL',
    delay: { min: 1.5, max: 3.5 },
    steps: [{ id: uid(), label: 'DRAW & FIRE', beep: 'start', par: null }]
  });
  editId = id;
  saveData();
  switchTab('build');
}

function deleteDrill(id) {
  if (!confirm('Delete this drill?')) return;
  drills = drills.filter(d => d.id !== id);
  if (selectedId === id) selectedId = drills[0]?.id ?? null;
  if (editId     === id) editId     = null;
  saveData();
  renderDrillList();
  renderBuild();
  refreshRunUI();
}

function fixLastStep(d) {
  d.steps.forEach((s, i) => {
    const isLast = i === d.steps.length - 1;
    if (isLast)       s.par = null;
    else if (!s.par)  s.par = 2.0;
  });
}
