// ══════════════════════════════════════════
// TIMER STATE MACHINE
// Status: idle → standby → running → done
// ══════════════════════════════════════════

const CIRC = 2 * Math.PI * 96; // ~603.19

const T = {
  status:      'idle',
  startMs:     0,
  elapsed:     0,
  stepIdx:     -1,
  stepStartMs: 0,
  stepPar:     0,
  timers:      [],
  raf:         null
};

// ── Public handlers ──────────────────────

function handleMainBtn() {
  if (T.status === 'idle' || T.status === 'done') startRun();
  else abortRun();
}

function startRun() {
  const drill = selDrill();
  if (!drill) return;
  getAudioCtx().resume();
  clearTimers();

  T.status  = 'standby';
  T.elapsed = 0;
  T.stepIdx = -1;
  refreshRunUI();

  const { min, max } = drill.delay;
  const delay = min + Math.random() * (max - min);

  T.timers.push(setTimeout(() => {
    T.startMs     = performance.now();
    T.stepStartMs = performance.now();
    T.status      = 'running';
    fireStep(0);
    startRaf();
    refreshRunUI();
  }, delay * 1000));
}

function abortRun() {
  clearTimers();
  stopRaf();
  T.status  = 'idle';
  T.elapsed = 0;
  T.stepIdx = -1;
  refreshRunUI();
}

// ── Internal ─────────────────────────────

function fireStep(idx) {
  const drill = selDrill();
  if (!drill) return;
  const step = drill.steps[idx];
  if (!step) return;

  T.stepIdx     = idx;
  T.stepStartMs = performance.now();
  T.stepPar     = step.par || 0;

  playBeep(step.beep);
  updateStepDots();
  updateStepCards();

  const isLast = idx === drill.steps.length - 1;

  if (!isLast && step.par) {
    T.timers.push(setTimeout(() => {
      if (T.status === 'running') fireStep(idx + 1);
    }, step.par * 1000));
  } else {
    // Final step: let the beep play then finish
    T.timers.push(setTimeout(() => {
      if (T.status === 'running') {
        T.elapsed = (performance.now() - T.startMs) / 1000;
        T.status  = 'done';
        stopRaf();
        refreshRunUI();
      }
    }, 900));
  }
}

function startRaf() {
  const tick = () => {
    if (T.status !== 'running') return;
    T.elapsed = (performance.now() - T.startMs) / 1000;

    const el = document.getElementById('tBig');
    if (el) el.textContent = fmtTime(T.elapsed);

    updateParRing();
    T.raf = requestAnimationFrame(tick);
  };
  T.raf = requestAnimationFrame(tick);
}

function stopRaf() {
  if (T.raf) { cancelAnimationFrame(T.raf); T.raf = null; }
}

function clearTimers() {
  T.timers.forEach(clearTimeout);
  T.timers = [];
}

// ── Par ring update ───────────────────────

function updateParRing() {
  const ring = document.getElementById('parRing');
  if (!ring) return;

  if (!T.stepPar) {
    ring.style.strokeDashoffset = '0';
    ring.className = 'ring-par';
    return;
  }

  const elapsed = (performance.now() - T.stepStartMs) / 1000;
  const pct     = Math.max(0, 1 - elapsed / T.stepPar);
  ring.style.strokeDashoffset = CIRC * (1 - pct);
  ring.className = 'ring-par' + (pct < 0.2 ? ' urgent' : '');
}

// ── Helpers ───────────────────────────────

function fmtTime(s) {
  if (s < 10) return s.toFixed(1);
  const m   = Math.floor(s / 60);
  const rem = (s % 60).toFixed(1).padStart(4, '0');
  return m > 0 ? `${m}:${rem}` : s.toFixed(1);
}
