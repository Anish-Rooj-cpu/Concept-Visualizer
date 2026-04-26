'use strict';

// ── DOM Refs ───────────────────────────────────────────
const selWindow   = document.getElementById('window-select');
const slFs        = document.getElementById('fs');
const slFc1       = document.getElementById('fc1');
const slFc2       = document.getElementById('fc2');
const slOrder     = document.getElementById('order');
const fc2Group    = document.getElementById('fc2-group');
const fc1Label    = document.getElementById('fc1-label');

const vFs    = document.getElementById('v-fs');
const vFc1   = document.getElementById('v-fc1');
const vFc2   = document.getElementById('v-fc2');
const vOrder = document.getElementById('v-order');

const canvasFreq    = document.getElementById('canvas-freq');
const canvasPhase   = document.getElementById('canvas-phase');
const canvasImpulse = document.getElementById('canvas-impulse');
const canvasWin     = document.getElementById('canvas-window');

const ctxFreq    = canvasFreq.getContext('2d');
const ctxPhase   = canvasPhase.getContext('2d');
const ctxImpulse = canvasImpulse.getContext('2d');
const ctxWin     = canvasWin.getContext('2d');

const mTaps   = document.getElementById('m-taps');
const mAtten  = document.getElementById('m-atten');
const mRipple = document.getElementById('m-ripple');
const mTbw    = document.getElementById('m-tbw');

let filterType = 'lowpass';

// ── CSS Helpers ────────────────────────────────────────
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
const C = {
  get cyan()      { return cssVar('--cyan'); },
  get amber()     { return cssVar('--amber'); },
  get green()     { return cssVar('--green'); },
  get red()       { return cssVar('--red'); },
  get purple()    { return cssVar('--purple'); },
  get border()    { return cssVar('--border'); },
  get bg()        { return cssVar('--bg'); },
  get textMuted() { return cssVar('--text-muted'); },
};

// ── Window Functions ───────────────────────────────────
function makeWindow(type, N) {
  const w = new Float64Array(N + 1);
  for (let n = 0; n <= N; n++) {
    switch (type) {
      case 'rectangular': w[n] = 1; break;
      case 'hanning':
        w[n] = 0.5 * (1 - Math.cos(2 * Math.PI * n / N)); break;
      case 'hamming':
        w[n] = 0.54 - 0.46 * Math.cos(2 * Math.PI * n / N); break;
      case 'blackman':
        w[n] = 0.42 - 0.5 * Math.cos(2 * Math.PI * n / N) + 0.08 * Math.cos(4 * Math.PI * n / N); break;
      case 'kaiser': {
        const beta = 6;
        const I0 = besselI0(beta);
        const t = 2 * n / N - 1;
        w[n] = besselI0(beta * Math.sqrt(1 - t * t)) / I0;
        break;
      }
    }
  }
  return w;
}

function besselI0(x) {
  // Approximate modified Bessel function I0
  let sum = 1, term = 1;
  for (let k = 1; k <= 20; k++) {
    term *= (x / 2) * (x / 2) / (k * k);
    sum += term;
    if (term < 1e-12) break;
  }
  return sum;
}

// ── Sinc ──────────────────────────────────────────────
function sinc(x) { return x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x); }

// ── Ideal Impulse Responses ────────────────────────────
function idealLP(N, wc) {
  // wc: normalized cutoff [0,1) = fc / (fs/2)
  const h = new Float64Array(N + 1);
  const M = N / 2;
  for (let n = 0; n <= N; n++) {
    h[n] = wc * sinc(wc * (n - M));
  }
  return h;
}

function idealHP(N, wc) {
  const h = new Float64Array(N + 1);
  const M = N / 2;
  for (let n = 0; n <= N; n++) {
    const delta = n === M ? 1 : 0;
    h[n] = delta - wc * sinc(wc * (n - M));
  }
  return h;
}

function idealBP(N, wc1, wc2) {
  const h = new Float64Array(N + 1);
  const M = N / 2;
  for (let n = 0; n <= N; n++) {
    h[n] = wc2 * sinc(wc2 * (n - M)) - wc1 * sinc(wc1 * (n - M));
  }
  return h;
}

function idealBS(N, wc1, wc2) {
  const h = new Float64Array(N + 1);
  const M = N / 2;
  for (let n = 0; n <= N; n++) {
    const delta = n === M ? 1 : 0;
    h[n] = delta - (wc2 * sinc(wc2 * (n - M)) - wc1 * sinc(wc1 * (n - M)));
  }
  return h;
}

// ── Design FIR ────────────────────────────────────────
function designFIR(type, N, fc1, fc2, fs, windowType) {
  const wc1 = (2 * fc1) / fs;  // normalized [0, 1)
  const wc2 = (2 * fc2) / fs;

  let hIdeal;
  switch (type) {
    case 'lowpass':  hIdeal = idealLP(N, wc1); break;
    case 'highpass': hIdeal = idealHP(N, wc1); break;
    case 'bandpass': hIdeal = idealBP(N, wc1, wc2); break;
    case 'bandstop': hIdeal = idealBS(N, wc1, wc2); break;
    default:         hIdeal = idealLP(N, wc1);
  }

  const win = makeWindow(windowType, N);
  const h = new Float64Array(N + 1);
  for (let n = 0; n <= N; n++) h[n] = hIdeal[n] * win[n];

  return { h, win };
}

// ── DTFT (Discrete-Time Fourier Transform) ─────────────
function computeDTFT(h, numPoints) {
  const mag   = new Float64Array(numPoints);
  const phase = new Float64Array(numPoints);
  const N = h.length;

  for (let k = 0; k < numPoints; k++) {
    const w = (Math.PI * k) / numPoints; // 0 to π
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      re += h[n] * Math.cos(w * n);
      im -= h[n] * Math.sin(w * n);
    }
    mag[k]   = Math.sqrt(re * re + im * im);
    phase[k] = Math.atan2(im, re);
  }
  return { mag, phase };
}

// ── Canvas Drawing ────────────────────────────────────
function setupCanvas(canvas) {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w    = rect.width  || canvas.parentElement.clientWidth || 400;
  const h    = rect.height || 180;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { w, h };
}

function drawLineChart(ctx, canvas, xArr, series, opts = {}) {
  const { w, h } = setupCanvas(canvas);
  const PAD = { top: 12, right: 14, bottom: 28, left: 46 };
  const cW  = w - PAD.left - PAD.right;
  const cH  = h - PAD.top  - PAD.bottom;

  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 5]);
  const gX = 5, gY = 4;
  for (let i = 0; i <= gX; i++) {
    const x = PAD.left + (i / gX) * cW;
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + cH); ctx.stroke();
  }
  for (let i = 0; i <= gY; i++) {
    const y = PAD.top + (i / gY) * cH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Auto range
  const allVals = series.filter(s => !s.skipRange).flatMap(s => s.data);
  let yMin = opts.yMin ?? Math.min(...allVals);
  let yMax = opts.yMax ?? Math.max(...allVals);
  const yPad = (yMax - yMin) * 0.08 || 0.5;
  yMin -= yPad; yMax += yPad;

  // Labels
  ctx.fillStyle = C.textMuted;
  ctx.font = '600 9px IBM Plex Mono, monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= gY; i++) {
    const val = yMax - (i / gY) * (yMax - yMin);
    const y = PAD.top + (i / gY) * cH;
    ctx.fillText(val.toFixed(opts.yDec ?? 1), PAD.left - 4, y + 3);
  }

  const xMax = xArr[xArr.length - 1];
  ctx.textAlign = 'center';
  for (let i = 0; i <= gX; i++) {
    const val = (i / gX) * xMax;
    const x = PAD.left + (i / gX) * cW;
    ctx.fillText(
      opts.xFormat ? opts.xFormat(val) : val.toFixed(0),
      x, PAD.top + cH + 14
    );
  }

  // Axes
  ctx.strokeStyle = C.border; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + cH);
  ctx.moveTo(PAD.left, PAD.top + cH); ctx.lineTo(PAD.left + cW, PAD.top + cH);
  ctx.stroke();

  // Zero line
  if (yMin < 0 && yMax > 0) {
    const zy = PAD.top + (yMax / (yMax - yMin)) * cH;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, zy); ctx.lineTo(PAD.left + cW, zy); ctx.stroke();
  }

  const toX = v => PAD.left + (v / xMax) * cW;
  const toY = v => PAD.top + ((yMax - v) / (yMax - yMin)) * cH;

  // Series
  series.forEach(s => {
    if (s.type === 'vline') {
      ctx.strokeStyle = s.color; ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      s.xs.forEach(xv => {
        const x = toX(xv);
        ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + cH); ctx.stroke();
      });
      ctx.setLineDash([]);
      return;
    }
    if (s.dashed) ctx.setLineDash([5, 4]);
    ctx.strokeStyle = s.color; ctx.lineWidth = s.width ?? 1.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.data.forEach((v, i) => {
      const x = toX(xArr[i]);
      const y = toY(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function drawStemChart(ctx, canvas, nArr, data, color) {
  const { w, h } = setupCanvas(canvas);
  const PAD = { top: 12, right: 14, bottom: 28, left: 46 };
  const cW  = w - PAD.left - PAD.right;
  const cH  = h - PAD.top  - PAD.bottom;

  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = C.border; ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 5]);
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (i / 4) * cH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  const yMax = Math.max(Math.abs(Math.min(...data)), Math.abs(Math.max(...data))) * 1.2 || 0.1;
  const yMin = -yMax;

  // Y labels
  ctx.fillStyle = C.textMuted; ctx.font = '600 9px IBM Plex Mono, monospace'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = yMax - (i / 4) * (yMax - yMin);
    ctx.fillText(val.toFixed(3), PAD.left - 4, PAD.top + (i / 4) * cH + 3);
  }

  // X labels
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(nArr.length / 5));
  for (let i = 0; i < nArr.length; i += step) {
    const x = PAD.left + (i / (nArr.length - 1)) * cW;
    ctx.fillText(nArr[i], x, PAD.top + cH + 14);
  }

  // Axes
  ctx.strokeStyle = C.border; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + cH);
  ctx.moveTo(PAD.left, PAD.top + cH); ctx.lineTo(PAD.left + cW, PAD.top + cH);
  ctx.stroke();

  // Zero line
  const zy = PAD.top + (yMax / (yMax - yMin)) * cH;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD.left, zy); ctx.lineTo(PAD.left + cW, zy); ctx.stroke();

  // Stems
  const N = data.length;
  data.forEach((v, i) => {
    const x  = PAD.left + (i / (N - 1)) * cW;
    const y  = PAD.top + ((yMax - v) / (yMax - yMin)) * cH;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, zy); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 2 * Math.PI); ctx.fill();
  });
}

// ── Metrics ───────────────────────────────────────────
function windowSpecs(type) {
  const SPECS = {
    rectangular: { atten: 21,  ripple: 0.09, tbwFactor: 0.9 },
    hanning:     { atten: 44,  ripple: 0.05, tbwFactor: 3.1 },
    hamming:     { atten: 42,  ripple: 0.02, tbwFactor: 3.3 },
    blackman:    { atten: 74,  ripple: 0.02, tbwFactor: 5.5 },
    kaiser:      { atten: 74,  ripple: 0.01, tbwFactor: 5.0 },
  };
  return SPECS[type] || SPECS.hamming;
}

// ── Main Update ───────────────────────────────────────
function update() {
  const windowType = selWindow.value;
  const fs   = parseInt(slFs.value);
  const fc1  = parseInt(slFc1.value);
  const fc2  = parseInt(slFc2.value);
  const N    = parseInt(slOrder.value);

  // Clamp fc2 > fc1
  if (fc2 <= fc1) {
    slFc2.value = Math.min(fc1 + 200, fs / 2 - 10);
    vFc2.textContent = slFc2.value;
  }

  const { h, win } = designFIR(filterType, N, fc1, fc2, fs, windowType);

  // DTFT
  const NFFT = 512;
  const { mag, phase } = computeDTFT(h, NFFT);

  // dB
  const EPS = 1e-10;
  const magDB = Array.from(mag).map(v => 20 * Math.log10(v + EPS));

  // Frequency axis (Hz)
  const freqArr = Array.from({ length: NFFT }, (_, k) => (k / NFFT) * (fs / 2));

  // Cutoff lines
  const cutoffXs = (filterType === 'bandpass' || filterType === 'bandstop')
    ? [fc1, fc2]
    : [fc1];

  // Draw Freq Response
  drawLineChart(ctxFreq, canvasFreq, freqArr, [
    { data: magDB, color: C.cyan, width: 2 },
    { type: 'vline', color: C.amber, xs: cutoffXs },
  ], {
    yMin: -100, yMax: 5,
    yDec: 0,
    xFormat: v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0),
  });

  // Draw Phase Response
  drawLineChart(ctxPhase, canvasPhase, freqArr, [
    { data: Array.from(phase), color: C.purple, width: 1.8 },
  ], { yDec: 1 });

  // Impulse response (stems)
  const nArr = Array.from({ length: N + 1 }, (_, i) => i);
  drawStemChart(ctxImpulse, canvasImpulse, nArr, Array.from(h), C.green);
  drawStemChart(ctxWin,     canvasWin,     nArr, Array.from(win), C.amber);

  // Metrics
  const specs = windowSpecs(windowType);
  mTaps.textContent   = N + 1;
  mAtten.textContent  = specs.atten;
  mRipple.textContent = (specs.ripple * 100).toFixed(0) + '%';
  const tbw = (specs.tbwFactor * fs) / (N + 1);
  mTbw.textContent    = tbw.toFixed(0);
}

// ── Slider Bindings ───────────────────────────────────
function bindSlider(el, valEl, dec = 0) {
  el.addEventListener('input', () => {
    valEl.textContent = parseFloat(el.value).toFixed(dec);
    update();
  });
}

bindSlider(slFs,    vFs,    0);
bindSlider(slFc1,   vFc1,   0);
bindSlider(slFc2,   vFc2,   0);
bindSlider(slOrder, vOrder, 0);
selWindow.addEventListener('change', update);

// fc1 max sync with fs
slFs.addEventListener('input', () => {
  const maxFc = parseInt(slFs.value) / 2 - 100;
  slFc1.max = maxFc;
  slFc2.max = maxFc;
  if (parseInt(slFc1.value) > maxFc) { slFc1.value = maxFc; vFc1.textContent = maxFc; }
  if (parseInt(slFc2.value) > maxFc) { slFc2.value = maxFc; vFc2.textContent = maxFc; }
});

// ── Filter Type Buttons ───────────────────────────────
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterType = btn.dataset.type;

    const isBand = filterType === 'bandpass' || filterType === 'bandstop';
    fc2Group.classList.toggle('hidden', !isBand);

    // Adjust label
    fc1Label.textContent = isBand ? 'Lower Cutoff fc1 (Hz)' : 'Cutoff fc (Hz)';

    update();
  });
});

// ── Presets ───────────────────────────────────────────
const PRESETS = {
  speech: { type: 'lowpass',  fc1: 3400, fc2: 2000, N: 48, win: 'hamming' },
  audio:  { type: 'highpass', fc1:  300, fc2: 2000, N: 64, win: 'blackman' },
  band:   { type: 'bandpass', fc1:  800, fc2: 1200, N: 80, win: 'hamming' },
  reset:  { type: 'lowpass',  fc1: 1000, fc2: 2000, N: 32, win: 'hamming' },
};

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset]; if (!p) return;
    filterType = p.type;
    slFc1.value = p.fc1; vFc1.textContent = p.fc1;
    slFc2.value = p.fc2; vFc2.textContent = p.fc2;
    slOrder.value = p.N; vOrder.textContent = p.N;
    selWindow.value = p.win;

    document.querySelectorAll('.type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === p.type);
    });

    const isBand = p.type === 'bandpass' || p.type === 'bandstop';
    fc2Group.classList.toggle('hidden', !isBand);
    fc1Label.textContent = isBand ? 'Lower Cutoff fc1 (Hz)' : 'Cutoff fc (Hz)';

    update();
  });
});

// ── Resize observer ───────────────────────────────────
const ro = new ResizeObserver(() => update());
[canvasFreq, canvasPhase, canvasImpulse, canvasWin].forEach(c => ro.observe(c.parentElement));

// ── Init ──────────────────────────────────────────────
update();
