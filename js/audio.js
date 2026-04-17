// ══════════════════════════════════════════
// AUDIO ENGINE + HAPTICS
// ══════════════════════════════════════════

let _actx = null;

function getAudioCtx() {
  if (!_actx) {
    _actx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _actx;
}

const BEEP_DEFS = {
  start: [
    { f: 880, t: 'square', dur: 0.55, g: 0.65 }
  ],
  shoot: [
    { f: 1320, t: 'square', dur: 0.09, g: 0.7,  dt: 0    },
    { f: 1100, t: 'square', dur: 0.09, g: 0.5,  dt: 0.13 }
  ],
  reload: [
    { f: 660,  t: 'sawtooth', dur: 0.18, g: 0.7,  dt: 0    },
    { f: 440,  t: 'sawtooth', dur: 0.28, g: 0.55, dt: 0.22 }
  ],
  end: [
    { f: 880, t: 'sine', dur: 0.14, g: 0.55, dt: 0    },
    { f: 660, t: 'sine', dur: 0.14, g: 0.45, dt: 0.18 },
    { f: 440, t: 'sine', dur: 0.38, g: 0.38, dt: 0.35 }
  ],
  alert: [
    { f: 660, t: 'triangle', dur: 0.28, g: 0.6 }
  ]
};

const HAPTIC_PATTERNS = {
  start:  [60],
  shoot:  [25, 15, 35],
  reload: [35, 25, 55],
  end:    [15, 15, 15, 15, 70],
  alert:  [45]
};

function playBeep(type) {
  // Audio
  try {
    const ctx = getAudioCtx();
    ctx.resume();
    const now   = ctx.currentTime + 0.02;
    const tones = BEEP_DEFS[type] || BEEP_DEFS.start;

    tones.forEach(({ f, t, dur, g, dt = 0 }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = t;
      osc.frequency.setValueAtTime(f, now + dt);
      gain.gain.setValueAtTime(0, now + dt);
      gain.gain.linearRampToValueAtTime(g, now + dt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dt + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + dt);
      osc.stop(now + dt + dur + 0.05);
    });
  } catch (e) {
    console.warn('Audio error:', e);
  }

  // Screen flash
  const fl = document.getElementById('beepFlash');
  if (fl) {
    fl.classList.remove('on');
    void fl.offsetWidth; // reflow
    fl.classList.add('on');
  }

  // Haptic
  if (navigator.vibrate) {
    try { navigator.vibrate(HAPTIC_PATTERNS[type] || [50]); } catch {}
  }
}
