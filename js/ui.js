// ══════════════════════════════════════════
// UI — Render & Update Functions
// ══════════════════════════════════════════

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════
// RUN VIEW
// ══════════════════════════════════════════

function refreshRunUI() {
  const drill   = selDrill();
  const tBig    = document.getElementById('tBig');
  const tStatus = document.getElementById('tStatus');
  const btn     = document.getElementById('mainBtn');
  const btnTxt  = document.getElementById('mainBtnTxt');
  const hint    = document.getElementById('runHint');
  const hdr     = document.getElementById('hdrDrill');
  const noMsg   = document.getElementById('noDrillMsg');
  const panel   = document.getElementById('activePanel');
  const ring    = document.getElementById('parRing');

  hdr.textContent = drill ? drill.name : 'NO DRILL SELECTED';

  if (!drill) {
    noMsg.style.display  = 'flex';
    panel.style.display  = 'none';
    btn.className        = 'big-btn go off';
    btnTxt.textContent   = 'START';
    tStatus.textContent  = 'SELECT A DRILL';
    tStatus.className    = 't-status-lbl';
    tBig.textContent     = '—';
    tBig.className       = 't-display idle';
    hint.textContent     = '';
    ring.style.strokeDashoffset = CIRC;
    ring.className       = 'ring-par idle';
    return;
  }

  btn.className       = 'big-btn';
  noMsg.style.display = 'none';
  panel.style.display = 'flex';

  switch (T.status) {

    case 'idle':
      tStatus.textContent  = 'READY';
      tStatus.className    = 't-status-lbl';
      tBig.textContent     = '0.0';
      tBig.className       = 't-display idle';
      btn.className        = 'big-btn go';
      btnTxt.textContent   = 'START';
      hint.textContent     = `DELAY  ${drill.delay.min}–${drill.delay.max}s`;
      ring.style.strokeDashoffset = CIRC;
      ring.className       = 'ring-par idle';
      updateStepDots();
      updateStepCards();
      break;

    case 'standby':
      tStatus.textContent  = 'STANDBY…';
      tStatus.className    = 't-status-lbl standby';
      tBig.textContent     = '···';
      tBig.className       = 't-display standby';
      btn.className        = 'big-btn abort';
      btnTxt.textContent   = 'ABORT';
      hint.textContent     = '';
      ring.style.strokeDashoffset = '0';
      ring.className       = 'ring-par';
      break;

    case 'running':
      tStatus.textContent  = 'RUNNING';
      tStatus.className    = 't-status-lbl running';
      tBig.className       = 't-display running';
      btn.className        = 'big-btn stop';
      btnTxt.textContent   = 'STOP';
      hint.textContent     = '';
      break;

    case 'done':
      tStatus.textContent  = 'COMPLETE';
      tStatus.className    = 't-status-lbl done';
      tBig.textContent     = fmtTime(T.elapsed);
      tBig.className       = 't-display done';
      btn.className        = 'big-btn go';
      btnTxt.textContent   = 'RUN AGAIN';
      hint.textContent     = `FINAL  ${T.elapsed.toFixed(2)}s`;
      ring.style.strokeDashoffset = CIRC;
      ring.className       = 'ring-par done';
      updateStepDots();
      break;
  }
}

function updateStepDots() {
  const drill = selDrill();
  const el    = document.getElementById('stepDots');
  if (!drill || !el) return;

  el.innerHTML = drill.steps.map((_, i) => {
    let cls = 'dot';
    if (T.status === 'done')     cls += ' done';
    else if (i < T.stepIdx)     cls += ' past';
    else if (i === T.stepIdx)   cls += ' active';
    return `<div class="${cls}"></div>`;
  }).join('');
}

function updateStepCards() {
  const drill = selDrill();
  if (!drill) return;

  const idx  = Math.max(0, T.stepIdx);
  const step = drill.steps[idx];
  const next = drill.steps[idx + 1];
  if (!step) return;

  const info = BEEP_INFO[step.beep] || BEEP_INFO.start;
  document.getElementById('curName').textContent = step.label;

  const cb = document.getElementById('curBadge');
  cb.textContent = info.label;
  cb.className   = `type-badge ${info.cls}`;

  const nr = document.getElementById('nextRow');
  if (next) {
    nr.style.display = 'flex';
    const ni = BEEP_INFO[next.beep] || BEEP_INFO.start;
    document.getElementById('nextName').textContent = next.label;
    const nb = document.getElementById('nextBadge');
    nb.textContent = ni.label;
    nb.className   = `type-badge sm ${ni.cls}`;
  } else {
    nr.style.display = 'none';
  }
}

// ══════════════════════════════════════════
// DRILLS VIEW
// ══════════════════════════════════════════

function renderDrillList() {
  const el = document.getElementById('drillList');
  if (!el) return;

  if (!drills.length) {
    el.innerHTML = '<div class="no-drill-panel"><div class="ndp-title">NO DRILLS SAVED</div></div>';
    return;
  }

  el.innerHTML = '';
  drills.forEach(d => {
    const par    = d.steps.reduce((s, st) => s + (st.par || 0), 0);
    const isSel  = d.id === selectedId;
    const preset = isPreset(d.id);

    const badges = d.steps.map(st => {
      const bi = BEEP_INFO[st.beep] || BEEP_INFO.start;
      return `<span class="type-badge sm ${bi.cls}">${bi.label}</span>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'drill-card' + (isSel ? ' sel' : '');
    card.innerHTML = `
      <div class="dc-name">${esc(d.name)}</div>
      <div class="dc-meta">${d.steps.length} STEPS · ${par.toFixed(1)}s PAR · ${d.delay.min}–${d.delay.max}s DELAY</div>
      <div class="dc-badges">${badges}</div>
      <div class="dc-actions">
        <button class="solid-btn"  onclick="selectAndRun('${d.id}')">▶ RUN</button>
        <button class="outline-btn ghost" onclick="openEdit('${d.id}')">✎ EDIT</button>
        ${!preset
          ? `<button class="outline-btn red" onclick="deleteDrill('${d.id}')">✕</button>`
          : ''}
      </div>`;
    el.appendChild(card);
  });
}

function selectAndRun(id) {
  selectedId = id;
  saveData();
  abortRun();
  switchTab('run');
}

function openEdit(id) {
  editId = id;
  switchTab('build');
}

// ══════════════════════════════════════════
// BUILD VIEW
// ══════════════════════════════════════════

function renderBuild() {
  const empty = document.getElementById('buildEmpty');
  const form  = document.getElementById('buildForm');
  const drill = editDrillObj();

  if (!drill) {
    empty.style.display = 'flex';
    form.style.display  = 'none';
    return;
  }

  empty.style.display = 'none';
  form.style.display  = 'flex';

  const stepsHTML = drill.steps
    .map((s, i) => buildStepCard(s, i, drill.steps.length))
    .join('');

  form.innerHTML = `
    <div class="form-section">
      <label class="form-lbl">DRILL NAME</label>
      <input class="form-input" value="${esc(drill.name)}"
        oninput="patchDrill('name', this.value)" />
    </div>

    <div class="form-section">
      <label class="form-lbl">START DELAY (seconds)</label>
      <div class="delay-row">
        <div>
          <label class="form-lbl" style="font-size:.5rem;margin-bottom:4px">MIN</label>
          <input class="form-input" type="number" min=".5" max="15" step=".5"
            value="${drill.delay.min}"
            oninput="patchDrill('delay.min', +this.value)" />
        </div>
        <div class="delay-sep">→</div>
        <div>
          <label class="form-lbl" style="font-size:.5rem;margin-bottom:4px">MAX</label>
          <input class="form-input" type="number" min=".5" max="30" step=".5"
            value="${drill.delay.max}"
            oninput="patchDrill('delay.max', +this.value)" />
        </div>
      </div>
    </div>

    <div class="form-section">
      <label class="form-lbl">STEPS</label>
      <div id="stepsWrap" style="display:flex;flex-direction:column;gap:8px">
        ${stepsHTML}
      </div>
    </div>

    <button class="add-step-btn" onclick="addStep()">+ ADD STEP</button>
    <button class="save-btn"     onclick="commitDrill()">SAVE &amp; SELECT</button>
  `;
}

function buildStepCard(s, i, total) {
  const isLast = i === total - 1;
  const opts   = Object.entries(BEEP_INFO).map(([k, v]) =>
    `<option value="${k}" ${s.beep === k ? 'selected' : ''}>${v.label}</option>`
  ).join('');

  const upBtn   = i > 0
    ? `<button class="sq-btn" onclick="moveStep('${s.id}',-1)">↑</button>`
    : `<span class="sq-btn ph"></span>`;
  const downBtn = !isLast
    ? `<button class="sq-btn" onclick="moveStep('${s.id}',1)">↓</button>`
    : `<span class="sq-btn ph"></span>`;
  const delBtn  = total > 1
    ? `<button class="sq-btn del" onclick="removeStep('${s.id}')">✕</button>`
    : '';

  const parField = isLast
    ? `<input class="par-input" value="FINAL" disabled />`
    : `<input class="par-input" type="number" min=".5" max="120" step=".5"
         value="${s.par || 2.0}"
         oninput="patchStep('${s.id}','par',+this.value)" />`;

  return `
    <div class="sbc" id="sbc-${s.id}">
      <div class="sbc-head">
        <div class="sbc-num">STEP ${i + 1}${isLast ? '  ·  FINAL' : ''}</div>
        <div class="sbc-ctrls">${upBtn}${downBtn}${delBtn}</div>
      </div>
      <div class="sbc-grid">
        <div class="sbc-full">
          <label class="form-lbl" style="font-size:.5rem">ACTION LABEL</label>
          <input class="form-input" value="${esc(s.label)}"
            oninput="patchStep('${s.id}','label',this.value)" />
        </div>
        <div>
          <label class="form-lbl" style="font-size:.5rem">BEEP TYPE</label>
          <select class="select-input" onchange="patchStep('${s.id}','beep',this.value)">
            ${opts}
          </select>
        </div>
        <div>
          <label class="form-lbl" style="font-size:.5rem">PAR TIME (s)</label>
          ${parField}
        </div>
      </div>
    </div>`;
}

// ── Patch helpers ─────────────────────────

function patchDrill(field, val) {
  const d = editDrillObj(); if (!d) return;
  if (field.includes('.')) {
    const [a, b] = field.split('.');
    d[a][b] = val;
  } else {
    d[field] = val;
  }
  saveData();
}

function patchStep(sid, field, val) {
  const d = editDrillObj(); if (!d) return;
  const s = d.steps.find(x => x.id === sid); if (!s) return;
  s[field] = val;
  saveData();
}

function addStep() {
  const d = editDrillObj(); if (!d) return;
  const prev = d.steps[d.steps.length - 1];
  if (prev && !prev.par) prev.par = 2.0;
  d.steps.push({ id: uid(), label: 'NEW ACTION', beep: 'shoot', par: null });
  saveData();
  renderBuild();
}

function removeStep(sid) {
  const d = editDrillObj();
  if (!d || d.steps.length <= 1) return;
  d.steps = d.steps.filter(s => s.id !== sid);
  fixLastStep(d);
  saveData();
  renderBuild();
}

function moveStep(sid, dir) {
  const d = editDrillObj(); if (!d) return;
  const i = d.steps.findIndex(s => s.id === sid);
  const j = i + dir;
  if (j < 0 || j >= d.steps.length) return;
  [d.steps[i], d.steps[j]] = [d.steps[j], d.steps[i]];
  fixLastStep(d);
  saveData();
  renderBuild();
}

function commitDrill() {
  const d = editDrillObj(); if (!d) return;
  if (!d.name.trim()) { alert('Give your drill a name first.'); return; }
  fixLastStep(d);
  selectedId = d.id;
  saveData();
  abortRun();
  renderDrillList();
  switchTab('run');
}
