'use strict';

// ── Simulation Parameters ──────────────────────────────
const SIM_TIME   = 20;    // seconds
const DT         = 0.02;  // time step
const STEPS      = Math.ceil(SIM_TIME / DT);

// ── DOM Refs ───────────────────────────────────────────
const selPlant  = document.getElementById('plant-select');
const sliders   = {
  wn:    document.getElementById('p-wn'),
  zeta:  document.getElementById('p-zeta'),
  pgain: document.getElementById('p-gain'),
  kp:    document.getElementById('kp'),
  ki:    document.getElementById('ki'),
  kd:    document.getElementById('kd'),
  sp:    document.getElementById('setpoint'),
};
const vals = {
  wn:    document.getElementById('v-wn'),
  zeta:  document.getElementById('v-zeta'),
  pgain: document.getElementById('v-gain'),
  kp:    document.getElementById('v-kp'),
  ki:    document.getElementById('v-ki'),
  kd:    document.getElementById('v-kd'),
  sp:    document.getElementById('v-sp'),
};

const canvasStep    = document.getElementById('canvas-step');
const canvasError   = document.getElementById('canvas-error');
const canvasControl = document.getElementById('canvas-control');
const ctxStep       = canvasStep.getContext('2d');
const ctxErr        = canvasError.getContext('2d');
const ctxCtrl       = canvasControl.getContext('2d');

const mRise      = document.getElementById('m-rise');
const mOvershoot = document.getElementById('m-overshoot');
const mSettle    = document.getElementById('m-settle');
const mSSE       = document.getElementById('m-sse');

// ── CSS Variable Helpers ───────────────────────────────
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const C = {
  get cyan()   { return cssVar('--cyan'); },
  get amber()  { return cssVar('--amber'); },
  get green()  { return cssVar('--green'); },
  get red()    { return cssVar('--red'); },
  get purple() { return cssVar('--purple'); },
  get border() { return cssVar('--border'); },
  get bg()     { return cssVar('--bg'); },
  get textMuted() { return cssVar('--text-muted'); },
};

// ── Plant Simulation (RK4 state-space) ────────────────
function buildPlant(type, wn, zeta, k) {
  // Returns dx/dt = A·x + B·u  (state-space)
  switch (type) {
    case 'first':
      // G(s) = k / (s+1)  →  τ = 1
      return {
        n: 1,
        A: [[-1 / (1/wn)]],
        B: [k * wn],
        C: [1],
      };
    case 'second':
      // G(s) = wn^2 / (s^2 + 2ζwn·s + wn^2)
      return {
        n: 2,
        A: [[0, 1], [-(wn * wn), -2 * zeta * wn]],
        B: [0, k * wn * wn],
        C: [1, 0],
      };
    case 'integrator':
      // G(s) = k/s
      return {
        n: 1,
        A: [[0]],
        B: [k],
        C: [1],
      };
    case 'delay':
      // Approximate 1st-order + Pade delay (Td=0.5)
      return {
        n: 2,
        A: [[-wn, -wn * wn * 0.5], [1, 0]],
        B: [k * wn, 0],
        C: [0, wn * wn],
      };
    default:
      return buildPlant('second', wn, zeta, k);
  }
}

function matVec(A, x) {
  return A.map(row => row.reduce((s, a, j) => s + a * x[j], 0));
}

function vecAdd(a, b) { return a.map((v, i) => v + b[i]); }
function vecScale(a, s) { return a.map(v => v * s); }

function output(plant, x) {
  return plant.C.reduce((s, c, i) => s + c * x[i], 0);
}

function deriv(plant, x, u) {
  const Ax = matVec(plant.A, x);
  const Bu = plant.B.map(b => b * u);
  return vecAdd(Ax, Bu);
}

function rk4Step(plant, x, u, dt) {
  const k1 = deriv(plant, x, u);
  const k2 = deriv(plant, vecAdd(x, vecScale(k1, dt / 2)), u);
  const k3 = deriv(plant, vecAdd(x, vecScale(k2, dt / 2)), u);
  const k4 = deriv(plant, vecAdd(x, vecScale(k3, dt)), u);
  const dx = vecAdd(
    vecAdd(vecScale(k1, 1 / 6), vecScale(k2, 2 / 6)),
    vecAdd(vecScale(k3, 2 / 6), vecScale(k4, 1 / 6))
  );
  return vecAdd(x, vecScale(dx, dt));
}

// ── Run Simulation ────────────────────────────────────
function runSim() {
  const type = selPlant.value;
  const wn   = parseFloat(sliders.wn.value);
  const zeta = parseFloat(sliders.zeta.value);
  const k    = parseFloat(sliders.pgain.value);
  const Kp   = parseFloat(sliders.kp.value);
  const Ki   = parseFloat(sliders.ki.value);
  const Kd   = parseFloat(sliders.kd.value);
  const r    = parseFloat(sliders.sp.value);

  const plant = buildPlant(type, wn, zeta, k);
  let   x     = new Array(plant.n).fill(0);
  let   integ = 0;
  let   prevE = 0;

  const tArr = [], yArr = [], eArr = [], uArr = [];

  for (let i = 0; i < STEPS; i++) {
    const t = i * DT;
    const y = output(plant, x);
    const e = r - y;

    integ += e * DT;

    // Anti-windup clamp
    const maxInt = 10;
    integ = Math.max(-maxInt, Math.min(maxInt, integ));

    const dedt = (e - prevE) / DT;
    const u = Kp * e + Ki * integ + Kd * dedt;
    prevE = e;

    tArr.push(t);
    yArr.push(y);
    eArr.push(e);
    uArr.push(u);

    x = rk4Step(plant, x, u, DT);
  }

  return { tArr, yArr, eArr, uArr, r };
}

// ── Metrics Computation ───────────────────────────────
function computeMetrics(tArr, yArr, r) {
  const n = yArr.length;

  // Rise time: first time y >= 0.9*r
  let riseTime = null;
  for (let i = 0; i < n; i++) {
    if (yArr[i] >= 0.9 * r) { riseTime = tArr[i]; break; }
  }

  // Overshoot
  const peak = Math.max(...yArr);
  const overshoot = r > 0 ? Math.max(0, (peak - r) / r * 100) : 0;

  // Settling time: last time outside 2% band
  const band = 0.02 * r;
  let settleTime = null;
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(yArr[i] - r) > band) { settleTime = tArr[i]; break; }
  }

  // SSE
  const sse = Math.abs(r - yArr[n - 1]);

  return { riseTime, overshoot, settleTime: settleTime ?? 0, sse };
}

// ── Canvas Drawing ────────────────────────────────────
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width  || canvas.parentElement.clientWidth  || 400;
  const h = rect.height || 180;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { w, h };
}

function drawChart(ctx, canvas, tArr, series, opts) {
  const { w, h } = setupCanvas(canvas);

  const PAD = { top: 12, right: 14, bottom: 28, left: 44 };
  const cW = w - PAD.left - PAD.right;
  const cH = h - PAD.top  - PAD.bottom;

  // Clear
  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 5]);
  const gridX = 5, gridY = 4;
  for (let i = 0; i <= gridX; i++) {
    const x = PAD.left + (i / gridX) * cW;
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + cH); ctx.stroke();
  }
  for (let i = 0; i <= gridY; i++) {
    const y = PAD.top + (i / gridY) * cH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Axis labels
  ctx.fillStyle = C.textMuted;
  ctx.font = `600 9px IBM Plex Mono, monospace`;
  ctx.textAlign = 'right';

  // Y-axis ticks
  const allVals = series.flatMap(s => s.data);
  let yMin = opts.yMin ?? Math.min(...allVals);
  let yMax = opts.yMax ?? Math.max(...allVals);
  const yPad = (yMax - yMin) * 0.1 || 0.1;
  yMin -= yPad; yMax += yPad;

  for (let i = 0; i <= gridY; i++) {
    const val = yMax - (i / gridY) * (yMax - yMin);
    const y = PAD.top + (i / gridY) * cH;
    ctx.fillText(val.toFixed(2), PAD.left - 4, y + 3);
  }

  // X-axis ticks
  ctx.textAlign = 'center';
  const tMax = tArr[tArr.length - 1];
  for (let i = 0; i <= gridX; i++) {
    const t = (i / gridX) * tMax;
    const x = PAD.left + (i / gridX) * cW;
    ctx.fillText(t.toFixed(0) + 's', x, PAD.top + cH + 14);
  }

  // Axis lines
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + cH);
  ctx.moveTo(PAD.left, PAD.top + cH); ctx.lineTo(PAD.left + cW, PAD.top + cH);
  ctx.stroke();

  // Zero line
  if (yMin < 0 && yMax > 0) {
    const zy = PAD.top + ((yMax - 0) / (yMax - yMin)) * cH;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, zy); ctx.lineTo(PAD.left + cW, zy); ctx.stroke();
  }

  // Series
  const toX = t => PAD.left + (t / tMax) * cW;
  const toY = v => PAD.top + ((yMax - v) / (yMax - yMin)) * cH;

  series.forEach(s => {
    if (s.dashed) {
      ctx.setLineDash([6, 4]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width ?? 1.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.data.forEach((v, i) => {
      const x = toX(tArr[i]);
      const y = toY(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

// ── Main Update ───────────────────────────────────────
function update() {
  const { tArr, yArr, eArr, uArr, r } = runSim();
  const rConst = new Array(tArr.length).fill(r);

  // Step response
  drawChart(ctxStep, canvasStep, tArr, [
    { data: rConst, color: C.amber,  width: 1.2, dashed: true },
    { data: yArr,   color: C.cyan,   width: 2 },
  ], {});

  // Error
  drawChart(ctxErr, canvasError, tArr, [
    { data: eArr, color: C.red, width: 1.8 },
  ], {});

  // Control effort
  drawChart(ctxCtrl, canvasControl, tArr, [
    { data: uArr, color: C.purple, width: 1.8 },
  ], {});

  // Metrics
  const { riseTime, overshoot, settleTime, sse } = computeMetrics(tArr, yArr, r);
  mRise.textContent      = riseTime  != null ? riseTime.toFixed(2)  : '∞';
  mOvershoot.textContent = overshoot.toFixed(1);
  mSettle.textContent    = settleTime.toFixed(2);
  mSSE.textContent       = sse.toFixed(4);
}

// ── Slider listeners ──────────────────────────────────
function bindSlider(id, valEl, decimals = 1) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    valEl.textContent = parseFloat(el.value).toFixed(decimals);
    update();
  });
}

bindSlider('p-wn',    vals.wn,    1);
bindSlider('p-zeta',  vals.zeta,  2);
bindSlider('p-gain',  vals.pgain, 1);
bindSlider('kp',      vals.kp,    1);
bindSlider('ki',      vals.ki,    2);
bindSlider('kd',      vals.kd,    2);
bindSlider('setpoint',vals.sp,    1);

selPlant.addEventListener('change', () => {
  // Show/hide plant params based on type
  const type = selPlant.value;
  const wnRow   = sliders.wn.closest('.control-group');
  const zetaRow = sliders.zeta.closest('.control-group');
  zetaRow.style.display = (type === 'second' || type === 'delay') ? '' : 'none';
  update();
});

// ── Presets ───────────────────────────────────────────
const PRESETS = {
  'p-only':    { kp: 4,   ki: 0,    kd: 0 },
  'pd':        { kp: 5,   ki: 0,    kd: 0.8 },
  'pi':        { kp: 4,   ki: 2,    kd: 0 },
  'optimal':   { kp: 4,   ki: 1.5,  kd: 0.5 },
  'aggressive':{ kp: 15,  ki: 5,    kd: 1.5 },
  'reset':     { kp: 4,   ki: 1.5,  kd: 0.5 },
};

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    ['kp', 'ki', 'kd'].forEach(key => {
      if (p[key] !== undefined) {
        sliders[key].value = p[key];
        vals[key].textContent = parseFloat(p[key]).toFixed(key === 'kp' ? 1 : 2);
      }
    });
    update();
  });
});

// ── Resize observer ───────────────────────────────────
const ro = new ResizeObserver(() => update());
[canvasStep, canvasError, canvasControl].forEach(c => ro.observe(c.parentElement));

// ── Init ──────────────────────────────────────────────
update();
