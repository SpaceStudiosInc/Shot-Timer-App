'use strict';

// ── Built-in drills ────────────────────────────────────────────────────────
const BUILTIN = [
  { id:'bill',      name:'Bill Drill',          desc:'6 rounds A-zone draw to fire — sub 3s world class',      par:3.0, delay:1.5, splits:5, mode:'center',   series:[] },
  { id:'reload',    name:'Emergency Reload',     desc:'Draw, fire 1, slide lock reload, fire 1',                par:4.0, delay:2.0, splits:1, mode:'random',   series:[] },
  { id:'draw',      name:'Draw & First Shot',    desc:'Clean draw to first shot break — sub 1.5s goal',         par:2.0, delay:1.5, splits:0, mode:'center',   series:[] },
  { id:'mozambique',name:'Mozambique Drill',     desc:'2 body, 1 head — assess and transition speed',           par:3.5, delay:2.0, splits:2, mode:'sequence', series:[] },
  { id:'failure',   name:'Failure to Stop',      desc:'2 chest, assess, 1 precise headshot',                    par:4.5, delay:2.0, splits:2, mode:'sequence', series:[] },
  { id:'2target',   name:'2-Target Transition',  desc:'Engage two targets, 2 rounds each, strong-to-weak',      par:4.0, delay:2.0, splits:3, mode:'random',   series:[] },
  { id:'presidente',name:'El Presidente',        desc:'3 targets × 2 rounds each, reload, repeat',              par:10.0,delay:2.0, splits:5, mode:'series',   series:[0,4,8,12,0,4,8,12,3,7,11,15] },
  { id:'speed-rel', name:'Speed Reload',         desc:'Fire 2, speed reload, fire 2 — sub 5s goal',             par:5.0, delay:2.0, splits:3, mode:'center',   series:[] },
  { id:'par-only',  name:'Par Only',             desc:'Simple start/par beep, no splits — any drill',           par:2.5, delay:1.5, splits:0, mode:'random',   series:[] },
];

// ── Persistent storage ─────────────────────────────────────────────────────
const LS = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} },
};

// ── App state ──────────────────────────────────────────────────────────────
const S = {
  par:3.0, delay:1.5, splits:1, mode:'random',
  series:[],          // user-built series of cell indices
  activeDrillId:null,
  customDrills:[],
  history:[],

  phase:'idle',       // idle | countdown | running | done
  startTime:0, elapsed:0, rafId:null,
  splitTimes:[], splitTargets:[], curSplit:0,
  actx:null, cdTimer:null,

  editingId:null,
  bPickerSel:[],      // builder series pick order
  seriesPickerSel:[], // series panel pick order
};

// ── Load ───────────────────────────────────────────────────────────────────
function loadStorage(){
  const sv = LS.get('dft2_settings');
  if(sv){
    S.par            = sv.par   ?? 3.0;
    S.delay          = sv.delay ?? 1.5;
    S.splits         = sv.splits?? 1;
    S.mode           = sv.mode  ?? 'random';
    S.series         = sv.series|| [];
    S.activeDrillId  = sv.activeDrillId ?? null;
  }
  S.customDrills = LS.get('dft2_custom')  || [];
  S.history      = LS.get('dft2_history') || [];
}

function saveSettings(){
  LS.set('dft2_settings',{
    par:S.par, delay:S.delay, splits:S.splits,
    mode:S.mode, series:S.series, activeDrillId:S.activeDrillId,
  });
}

// ── Audio ──────────────────────────────────────────────────────────────────
function ensureAudio(){
  if(!S.actx) try{ S.actx = new(window.AudioContext||window.webkitAudioContext)(); }catch(e){}
  if(S.actx && S.actx.state==='suspended') S.actx.resume();
}
function chirp(freq,dur,vol){
  if(!S.actx) return;
  const osc=S.actx.createOscillator(), gain=S.actx.createGain(), dist=S.actx.createWaveShaper();
  const cv=new Float32Array(256);
  for(let i=0;i<256;i++){const x=(i*2)/256-1; cv[i]=(Math.PI+200)*x/(Math.PI+200*Math.abs(x));}
  dist.curve=cv; dist.oversample='4x';
  osc.connect(dist); dist.connect(gain); gain.connect(S.actx.destination);
  osc.type='square';
  osc.frequency.setValueAtTime(freq,S.actx.currentTime);
  gain.gain.setValueAtTime(vol,S.actx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001,S.actx.currentTime+dur);
  osc.start(S.actx.currentTime); osc.stop(S.actx.currentTime+dur+0.01);
}
function beepStart(){ chirp(2400,.08,1); setTimeout(()=>chirp(3200,.10,1),80); }
function beepPar()  { chirp(3000,.12,1); setTimeout(()=>chirp(2000,.16,1),100); }
function beepSplit(){ chirp(2800,.07,.9); }
function beepTick() { chirp(1200,.06,.7); }

// ── Grid ───────────────────────────────────────────────────────────────────
const gridEl   = document.getElementById('grid');
const cells    = [];
const C_CENTER = [5,6,9,10];
const C_SEQ    = [0,3,15,12,5,10,2,13];

// Grid size driven by current drill's series or default 4×4
let COLS = 4;

function initGrid(cols){
  COLS = cols || 4;
  const n = COLS * COLS;
  gridEl.innerHTML='';
  cells.length=0;
  gridEl.style.gridTemplateColumns=`repeat(${COLS},1fr)`;
  for(let i=0;i<n;i++){
    const cell=document.createElement('div');
    cell.className='cell';
    cell.style.position='relative';
    const circ=document.createElement('div');
    circ.className='circle';
    cell.appendChild(circ);
    gridEl.appendChild(cell);
    cells.push(cell);
  }
}

function clearGrid(){ cells.forEach(c=>{ c.className='cell'; c.style.position='relative'; }); }

function lightCell(idx){
  clearGrid();
  if(idx>=0 && idx<cells.length) cells[idx].classList.add('lit');
}

function flashCell(idx){
  if(idx<0||idx>=cells.length) return;
  cells[idx].classList.remove('lit');
  cells[idx].classList.add('flash');
  setTimeout(()=>{ if(cells[idx]) cells[idx].className='cell'; },280);
}

function showNextHint(idx){
  if(idx<0||idx>=cells.length) return;
  cells[idx].classList.add('next-up');
}

// ── Build split targets from current mode/series ───────────────────────────
function buildSplitTargets(){
  const n = S.splits + 1;
  if(S.mode==='series' && S.series.length){
    const targets=[];
    for(let i=0;i<n;i++) targets.push(S.series[i % S.series.length]);
    return targets;
  }
  if(S.mode==='center'){
    return Array.from({length:n},()=>C_CENTER[Math.floor(Math.random()*C_CENTER.length)]);
  }
  if(S.mode==='sequence'){
    return Array.from({length:n},(_,i)=>C_SEQ[i%C_SEQ.length]);
  }
  // random — no repeats where possible
  const used=new Set();
  return Array.from({length:n},()=>{
    let t; const max=cells.length;
    do{ t=Math.floor(Math.random()*max); }while(used.has(t)&&used.size<max);
    used.add(t); return t;
  });
}

// ── DOM refs ───────────────────────────────────────────────────────────────
const tStateEl  = document.getElementById('t-state');
const tClockEl  = document.getElementById('t-clock');
const splitRow  = document.getElementById('split-row');
const btnStart  = document.getElementById('btn-start');
const vPar      = document.getElementById('vPar');
const vDelay    = document.getElementById('vDelay');
const vSplits   = document.getElementById('vSplits');
const drillName = document.getElementById('drill-name');

function setClk(t){ tClockEl.textContent=t.toFixed(2); }

function renderSplitChips(){
  splitRow.innerHTML='';
  const interval=S.par/(S.splits+1);
  for(let i=0;i<S.splits;i++){
    const chip=document.createElement('div');
    chip.className='sp-chip'+(S.splitTimes[i]!=null?' fired':'');
    chip.textContent=S.splitTimes[i]!=null
      ? S.splitTimes[i].toFixed(2)+'s'
      : (interval*(i+1)).toFixed(2)+'s';
    splitRow.appendChild(chip);
  }
}

function refreshUI(){
  vPar.textContent    = S.par.toFixed(1);
  vDelay.textContent  = S.delay.toFixed(1);
  vSplits.textContent = S.splits;
  ['Random','Seq','Center','Series'].forEach(id=>document.getElementById('m'+id).classList.remove('active'));
  const mmap={random:'mRandom',sequence:'mSeq',center:'mCenter',series:'mSeries'};
  const mel=document.getElementById(mmap[S.mode]);
  if(mel) mel.classList.add('active');
  const drill=getActiveDrill();
  drillName.textContent=drill ? drill.name.toUpperCase() : 'CUSTOM';
}

function getActiveDrill(){
  if(!S.activeDrillId) return null;
  return BUILTIN.find(d=>d.id===S.activeDrillId)||S.customDrills.find(d=>d.id===S.activeDrillId)||null;
}

// ── Timer loop ─────────────────────────────────────────────────────────────
function tick(ts){
  if(S.phase!=='running') return;
  S.elapsed=(ts-S.startTime)/1000;
  const t=S.elapsed;
  const interval=S.par/(S.splits+1);

  if(S.curSplit<S.splits){
    const nextMark=interval*(S.curSplit+1);
    if(t>=nextMark-0.015){
      beepSplit();
      S.splitTimes[S.curSplit]=+t.toFixed(2);
      flashCell(S.splitTargets[S.curSplit]);
      S.curSplit++;
      setTimeout(()=>{
        lightCell(S.splitTargets[S.curSplit]??-1);
        // hint at the one after
        if(S.curSplit+1<S.splitTargets.length) setTimeout(()=>showNextHint(S.splitTargets[S.curSplit+1]),160);
      },110);
      renderSplitChips();
    }
  }

  if(t>=S.par){
    beepPar();
    S.elapsed=S.par; setClk(S.par);
    tStateEl.textContent='PAR'; tStateEl.className='t-state live';
    flashCell(S.splitTargets[S.curSplit]??-1);
    setTimeout(clearGrid,300);
    endDrill(true); return;
  }

  if(t>S.par-0.5){ tClockEl.className='t-clock warn'; tStateEl.className='t-state warn'; }
  setClk(t);
  S.rafId=requestAnimationFrame(tick);
}

// ── Drill lifecycle ────────────────────────────────────────────────────────
function handleStart(){
  ensureAudio();
  if(S.phase==='running'){ endDrill(false); return; }
  if(S.phase==='idle'||S.phase==='done') startDrill();
}

function startDrill(){
  closeSheet();
  S.phase='countdown'; S.splitTimes=[]; S.curSplit=0;
  S.splitTargets=buildSplitTargets();
  clearGrid(); splitRow.innerHTML='';
  tClockEl.className='t-clock';
  btnStart.textContent='STOP'; btnStart.classList.add('stop');
  let count=Math.max(1,Math.round(S.delay));
  tStateEl.textContent='STANDBY'; tStateEl.className='t-state';
  setClk(0); beepTick();
  S.cdTimer=setInterval(()=>{
    count--; beepTick();
    if(count<=0){ clearInterval(S.cdTimer); S.cdTimer=null; fireGo(); }
    else{ tStateEl.textContent=count+'...'; }
  },1000);
}

function fireGo(){
  beepStart();
  S.phase='running'; S.startTime=performance.now(); S.elapsed=0;
  tStateEl.textContent='FIRE'; tStateEl.className='t-state live';
  tClockEl.className='t-clock';
  lightCell(S.splitTargets[0]);
  if(S.splitTargets.length>1) setTimeout(()=>showNextHint(S.splitTargets[1]),160);
  renderSplitChips();
  S.rafId=requestAnimationFrame(tick);
}

function endDrill(hitPar){
  cancelAnimationFrame(S.rafId);
  if(S.cdTimer){ clearInterval(S.cdTimer); S.cdTimer=null; }
  S.phase='done';
  btnStart.textContent='START'; btnStart.classList.remove('stop');
  addLog(+S.elapsed.toFixed(2),hitPar);
  renderSplitChips();
  // Auto-open sheet after drill
  setTimeout(()=>openSheet('settings'),420);
}

function doReset(){
  cancelAnimationFrame(S.rafId);
  if(S.cdTimer){ clearInterval(S.cdTimer); S.cdTimer=null; }
  S.phase='idle'; S.elapsed=0; S.splitTimes=[]; S.curSplit=0;
  clearGrid();
  tStateEl.textContent='READY'; tStateEl.className='t-state';
  tClockEl.className='t-clock'; setClk(0);
  splitRow.innerHTML='';
  btnStart.textContent='START'; btnStart.classList.remove('stop');
}

// ── Settings adjustments ───────────────────────────────────────────────────
const adjCD={};
function adj(field,delta){
  const key=field+delta,now=Date.now();
  if(adjCD[key]&&now-adjCD[key]<300) return;
  adjCD[key]=now;
  if(S.phase==='running') return;
  if(field==='par')    { S.par    =Math.max(0.5,Math.min(60,+(S.par+delta).toFixed(1)));  vPar.textContent=S.par.toFixed(1); }
  if(field==='delay')  { S.delay  =Math.max(0.5,Math.min(10,+(S.delay+delta).toFixed(1)));vDelay.textContent=S.delay.toFixed(1); }
  if(field==='splits') { S.splits =Math.max(0,Math.min(8,S.splits+delta));                 vSplits.textContent=S.splits; }
  S.activeDrillId=null; drillName.textContent='CUSTOM';
  saveSettings();
}

function setMode(m){
  if(S.phase==='running') return;
  S.mode=m;
  ['Random','Seq','Center','Series'].forEach(id=>document.getElementById('m'+id).classList.remove('active'));
  const map={random:'mRandom',sequence:'mSeq',center:'mCenter',series:'mSeries'};
  if(map[m]) document.getElementById(map[m]).classList.add('active');
  S.activeDrillId=null; drillName.textContent='CUSTOM';
  saveSettings();
  if(m==='series') sheetTab('series');
}

// ── Sheet overlay ──────────────────────────────────────────────────────────
let sheetOpen=false;
function openSheet(tab){
  document.getElementById('sheet-overlay').classList.add('open');
  document.getElementById('sheet').classList.add('open');
  sheetOpen=true;
  sheetTab(tab||'settings');
  renderDrills(); renderLog();
}
function closeSheet(){
  document.getElementById('sheet-overlay').classList.remove('open');
  document.getElementById('sheet').classList.remove('open');
  sheetOpen=false;
}
function overlayTap(e){
  if(e.target===document.getElementById('sheet-overlay')) closeSheet();
}
function sheetTab(tab){
  ['settings','series','drills','log'].forEach(t=>{
    document.getElementById('stab-'+t).classList.toggle('active',t===tab);
    document.getElementById('sp-'+t).classList.toggle('active',t===tab);
    document.getElementById('sp-'+t).style.display=t===tab?'flex':'none';
  });
  if(tab==='series') renderSeriesPanel();
  if(tab==='drills') renderDrills();
  if(tab==='log')    renderLog();
}

// ── Series panel ───────────────────────────────────────────────────────────
const seriesGridEl=document.getElementById('series-grid');
const sgCells=[];
S.seriesPickerSel=[...S.series];

function renderSeriesPanel(){
  // Build 4×4 picker if needed
  if(sgCells.length===0){
    seriesGridEl.style.gridTemplateColumns='repeat(4,1fr)';
    for(let i=0;i<16;i++){
      const cell=document.createElement('div');
      cell.className='sgcell';
      const dot=document.createElement('div');
      dot.className='sgdot';
      const num=document.createElement('span');
      num.className='seq-num';
      dot.appendChild(num);
      cell.appendChild(dot);
      cell.addEventListener('click',()=>toggleSeriesCell(i));
      seriesGridEl.appendChild(cell);
      sgCells.push({cell,num});
    }
  }
  S.seriesPickerSel=[...S.series];
  updateSeriesUI();
}

function toggleSeriesCell(i){
  const idx=S.seriesPickerSel.indexOf(i);
  if(idx>=0){
    // Remove last occurrence only
    S.seriesPickerSel.splice(idx,1);
  } else {
    S.seriesPickerSel.push(i);
  }
  updateSeriesUI();
}

function updateSeriesUI(){
  sgCells.forEach(({cell,num},i)=>{
    const positions=[];
    S.seriesPickerSel.forEach((v,pi)=>{ if(v===i) positions.push(pi+1); });
    if(positions.length){
      cell.classList.add('picked');
      num.textContent=positions.join(',');
    } else {
      cell.classList.remove('picked');
      num.textContent='';
    }
  });
  const preview=document.getElementById('series-preview');
  preview.textContent=S.seriesPickerSel.length
    ? 'CELLS: '+S.seriesPickerSel.map(v=>v+1).join(' → ')
    : 'No cells selected';
}

function clearSeries(){
  S.seriesPickerSel=[];
  updateSeriesUI();
}

function applySeries(){
  if(!S.seriesPickerSel.length){ alert('Select at least one cell.'); return; }
  S.series=[...S.seriesPickerSel];
  S.mode='series';
  S.activeDrillId=null;
  drillName.textContent='CUSTOM';
  saveSettings();
  refreshUI();
  sheetTab('settings');
}

// ── Presets ────────────────────────────────────────────────────────────────
function renderDrills(){
  renderPresetList('builtin-list',BUILTIN,false);
  renderPresetList('custom-list',S.customDrills,true);
}

function renderPresetList(elId,list,deletable){
  const el=document.getElementById(elId);
  if(!list.length){
    el.innerHTML='<div style="font-size:11px;color:#2a2a2a;padding:6px 0;">None saved</div>';
    return;
  }
  el.innerHTML=list.map(d=>`
    <div class="pcard ${S.activeDrillId===d.id?'active-p':''}" onclick="loadDrill('${d.id}')">
      <div class="pcard-info">
        <div class="pcard-name">${esc(d.name)}</div>
        <div class="pcard-desc">${esc(d.desc||'')}</div>
      </div>
      <div class="pcard-meta">
        <span class="pmeta">${d.par}s</span>
        <span class="pmeta">${d.splits}sp</span>
      </div>
      ${deletable?`<button class="pdel" onclick="delDrill(event,'${d.id}')">✕</button>`:''}
    </div>
  `).join('');
}

function loadDrill(id){
  const drill=BUILTIN.find(d=>d.id===id)||S.customDrills.find(d=>d.id===id);
  if(!drill) return;
  S.activeDrillId=drill.id;
  S.par=drill.par; S.delay=drill.delay; S.splits=drill.splits;
  S.mode=drill.mode; S.series=drill.series||[];
  saveSettings(); refreshUI(); renderDrills(); doReset();
  closeSheet();
}

function delDrill(e,id){
  e.stopPropagation();
  S.customDrills=S.customDrills.filter(d=>d.id!==id);
  LS.set('dft2_custom',S.customDrills);
  if(S.activeDrillId===id){ S.activeDrillId=null; saveSettings(); refreshUI(); }
  renderDrills();
}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Log ────────────────────────────────────────────────────────────────────
function addLog(t,pass){
  const drill=getActiveDrill();
  S.history.unshift({t,par:S.par,pass,drill:drill?drill.name:'Custom',ts:Date.now()});
  if(S.history.length>60) S.history.pop();
  LS.set('dft2_history',S.history);
}
function renderLog(){
  const el=document.getElementById('log-list');
  if(!S.history.length){ el.innerHTML='<div class="log-empty">No drills yet</div>'; return; }
  el.innerHTML=S.history.map(h=>
    `<div class="log-item">
      <span class="li-t">${h.t.toFixed(2)}s</span>
      <span class="li-d">${esc(h.drill||'')}</span>
      <span class="li-r ${h.pass?'pass':'fail'}">${h.pass?'MADE':'MISS'}</span>
    </div>`
  ).join('');
}
function clearLog(){ S.history=[]; LS.set('dft2_history',[]); renderLog(); }

// ── Builder modal ──────────────────────────────────────────────────────────
const bsgCells=[];
function openBuilder(editId){
  S.editingId=editId||null;
  S.bPickerSel=[];
  const bo=document.getElementById('builder-overlay');
  if(editId){
    const d=S.customDrills.find(x=>x.id===editId);
    if(!d) return;
    document.getElementById('b-title').textContent='EDIT DRILL';
    document.getElementById('bName').value=d.name;
    document.getElementById('bDesc').value=d.desc||'';
    document.getElementById('bPar').value=d.par;
    document.getElementById('bDelay').value=d.delay;
    document.getElementById('bSplits').value=d.splits;
    document.getElementById('bMode').value=d.mode;
    S.bPickerSel=[...(d.series||[])];
  } else {
    document.getElementById('b-title').textContent='NEW DRILL';
    document.getElementById('bName').value='';
    document.getElementById('bDesc').value='';
    document.getElementById('bPar').value='3.0';
    document.getElementById('bDelay').value='1.5';
    document.getElementById('bSplits').value='0';
    document.getElementById('bMode').value='random';
    S.bPickerSel=[];
  }
  document.getElementById('b-note').textContent='';
  builderModeChange();
  buildBuilderGrid();
  bo.classList.add('open');
}
function closeBuilder(){ document.getElementById('builder-overlay').classList.remove('open'); }
function builderOverlayTap(e){ if(e.target===document.getElementById('builder-overlay')) closeBuilder(); }

function builderModeChange(){
  const m=document.getElementById('bMode').value;
  document.getElementById('b-series-wrap').style.display=m==='series'?'':'none';
}

function buildBuilderGrid(){
  const bg=document.getElementById('b-series-grid');
  bg.innerHTML=''; bsgCells.length=0;
  bg.style.gridTemplateColumns='repeat(4,1fr)';
  for(let i=0;i<16;i++){
    const cell=document.createElement('div');
    cell.className='sgcell';
    const dot=document.createElement('div');
    dot.className='sgdot';
    const num=document.createElement('span');
    num.className='seq-num';
    dot.appendChild(num);
    cell.appendChild(dot);
    cell.addEventListener('click',()=>toggleBPickerCell(i));
    bg.appendChild(cell);
    bsgCells.push({cell,num});
  }
  updateBPickerUI();
}

function toggleBPickerCell(i){
  const idx=S.bPickerSel.indexOf(i);
  if(idx>=0) S.bPickerSel.splice(idx,1);
  else S.bPickerSel.push(i);
  updateBPickerUI();
}

function updateBPickerUI(){
  bsgCells.forEach(({cell,num},i)=>{
    const positions=[];
    S.bPickerSel.forEach((v,pi)=>{ if(v===i) positions.push(pi+1); });
    if(positions.length){ cell.classList.add('picked'); num.textContent=positions.join(','); }
    else { cell.classList.remove('picked'); num.textContent=''; }
  });
}

function saveDrill(){
  const name  =document.getElementById('bName').value.trim();
  const desc  =document.getElementById('bDesc').value.trim();
  const par   =parseFloat(document.getElementById('bPar').value)||3.0;
  const delay =parseFloat(document.getElementById('bDelay').value)||1.5;
  const splits=parseInt(document.getElementById('bSplits').value)||0;
  const mode  =document.getElementById('bMode').value;
  const series=mode==='series'?[...S.bPickerSel]:[];
  const note  =document.getElementById('b-note');
  if(!name){ note.textContent='Enter a drill name.'; return; }
  if(mode==='series'&&series.length===0){ note.textContent='Select at least one target cell.'; return; }

  if(S.editingId){
    const idx=S.customDrills.findIndex(d=>d.id===S.editingId);
    if(idx>=0) S.customDrills[idx]={id:S.editingId,name,desc,par,delay,splits,mode,series};
  } else {
    S.customDrills.push({id:'c'+Date.now(),name,desc,par,delay,splits,mode,series});
  }
  LS.set('dft2_custom',S.customDrills);
  closeBuilder(); renderDrills(); note.textContent='';
}

// ── Init ───────────────────────────────────────────────────────────────────
loadStorage();
initGrid(4);
refreshUI();
doReset();

// Open settings sheet on first load
setTimeout(()=>openSheet('settings'),300);
