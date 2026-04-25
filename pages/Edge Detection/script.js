/**
 * ConvLab — Convolution & Edge Detection Explorer
 * Architecture:
 *  1. CONFIG & KERNELS  — static definitions
 *  2. STATE             — single source of truth
 *  3. MATH ENGINE       — pure computation
 *  4. DOM MANAGER       — cached references + render functions
 *  5. CONTROLLER        — events, playback loop, init
 */

// ─────────────────────────────────────────────
// 1. CONFIG & KERNELS
// ─────────────────────────────────────────────
const KERNELS = {
  sobelX: {
    data: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
    desc: "Detects vertical edges by computing horizontal intensity gradients.",
    name: "Sobel X"
  },
  sobelY: {
    data: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
    desc: "Detects horizontal edges by computing vertical intensity gradients.",
    name: "Sobel Y"
  },
  sobelMag: {
    data: null,
    desc: "Combines Sobel X & Y: G = √(Gx² + Gy²). Finds edges in all directions.",
    name: "Sobel Magnitude"
  },
  laplacian: {
    data: [[0, 1, 0], [1, -4, 1], [0, 1, 0]],
    desc: "Second-derivative filter. Highlights any region of rapid intensity change.",
    name: "Laplacian"
  },
  sharpen: {
    data: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
    desc: "Amplifies centre pixel while subtracting neighbours — increases apparent sharpness.",
    name: "Sharpen"
  },
  gaussianBlur: {
    data: [[1, 2, 1], [2, 4, 2], [1, 2, 1]],
    desc: "Weighted average of neighbouring pixels. Reduces noise by smoothing the image. (Divisor: 16)",
    name: "Gaussian Blur",
    divisor: 16
  }
};

const GRID_SIZE = 20;
const CELL_PX   = 18;  // cell width/height in px
const CELL_STEP = CELL_PX + 1; // cell + gap

// ─────────────────────────────────────────────
// 2. STATE
// ─────────────────────────────────────────────
let state = {
  gridSize:    GRID_SIZE,
  input:       [],
  output:      [],
  kernelKey:   'sobelX',
  stride:      1,
  padding:     'valid',
  isColorMapped: false,
  isSigned:    false,
  playSpeed:   200,

  outWidth:  0,
  outHeight: 0,
  curX:      0,
  curY:      0,
  history:   [],
  isPlaying: false,
  intervalId: null,
  totalSteps:  0,
  doneSteps:   0
};

// ─────────────────────────────────────────────
// 3. MATH ENGINE
// ─────────────────────────────────────────────
function getPaddedValue(x, y) {
  if (x < 0 || x >= state.gridSize || y < 0 || y >= state.gridSize) return 0;
  return state.input[y][x];
}

function calculatePixel(outX, outY) {
  const p      = state.padding === 'same' ? 1 : 0;
  const startX = outX * state.stride - p;
  const startY = outY * state.stride - p;

  let parts = [], sumX = 0, sumY = 0, finalVal = 0;

  if (state.kernelKey === 'sobelMag') {
    const kX = KERNELS.sobelX.data;
    const kY = KERNELS.sobelY.data;
    for (let ky = 0; ky < 3; ky++) {
      for (let kx = 0; kx < 3; kx++) {
        const v = getPaddedValue(startX + kx, startY + ky);
        sumX += v * kX[ky][kx];
        sumY += v * kY[ky][kx];
      }
    }
    finalVal = Math.sqrt(sumX * sumX + sumY * sumY);
    parts = [`Gx=${sumX}`, `Gy=${sumY}`, `√(${sumX}²+${sumY}²)`];
  } else {
    const k = KERNELS[state.kernelKey].data;
    const div = KERNELS[state.kernelKey].divisor || 1;
    for (let ky = 0; ky < 3; ky++) {
      for (let kx = 0; kx < 3; kx++) {
        const v  = getPaddedValue(startX + kx, startY + ky);
        const w  = k[ky][kx];
        sumX    += v * w;
        if (w !== 0) parts.push(`(${v}×${w})`);
      }
    }
    finalVal = sumX / div;
  }

  let displayVal = state.isSigned ? finalVal : Math.abs(finalVal);
  displayVal = Math.max(state.isSigned ? -255 : 0, Math.min(255, displayVal));

  return { val: displayVal, raw: finalVal, parts, startX, startY };
}

function getColor(val) {
  if (!state.isColorMapped) {
    const v = state.isSigned ? ((val + 255) / 2) : val;
    return `rgb(${v|0},${v|0},${v|0})`;
  }
  const norm = state.isSigned ? (val + 255) / 510 : val / 255;
  const r = Math.round(norm * 255);
  const b = Math.round((1 - norm) * 255);
  return `rgb(${r},0,${b})`;
}

// ─────────────────────────────────────────────
// 4. DOM MANAGER
// ─────────────────────────────────────────────
const DOM = {
  inputGrid:   document.getElementById('input-grid'),
  outputGrid:  document.getElementById('output-grid'),
  overlay:     document.getElementById('kernel-overlay'),
  kernelGrid:  document.getElementById('kernel-grid'),
  mathEq:      document.getElementById('math-equation'),
  mathRes:     document.getElementById('math-result'),
  progBar:     document.getElementById('progress-bar'),
  statusText:  document.getElementById('status-text'),
  kernelDesc:  document.getElementById('kernel-desc'),
  kernelTag:   document.getElementById('kernel-name-tag'),
  outDim:      document.getElementById('out-dim'),
  stepCount:   document.getElementById('step-count'),
  btnPlay:     document.getElementById('btn-play'),
  btnPause:    document.getElementById('btn-pause'),
  inputDim:    document.getElementById('input-dim'),
  outputDim:   document.getElementById('output-dim'),

  inputCells:  [],
  outputCells: []
};

// ─── Build Grids ───
function buildGrids() {
  const { gridSize, outWidth, outHeight } = state;

  DOM.inputGrid.style.gridTemplateColumns  = `repeat(${gridSize}, ${CELL_PX}px)`;
  DOM.outputGrid.style.gridTemplateColumns = `repeat(${outWidth}, ${CELL_PX}px)`;
  DOM.inputGrid.innerHTML  = '';
  DOM.outputGrid.innerHTML = '';
  DOM.inputCells  = [];
  DOM.outputCells = [];

  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.title = `(${x},${y})`;
      cell.addEventListener('mouseenter', () => previewPixel(x, y));
      DOM.inputGrid.appendChild(cell);
      row.push(cell);
    }
    DOM.inputCells.push(row);
  }

  for (let y = 0; y < outHeight; y++) {
    const row = [];
    for (let x = 0; x < outWidth; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      DOM.outputGrid.appendChild(cell);
      row.push(cell);
    }
    DOM.outputCells.push(row);
  }

  DOM.inputDim.textContent  = `${gridSize} × ${gridSize}`;
  DOM.outputDim.textContent = `${outWidth} × ${outHeight}`;
  DOM.outDim.textContent    = `${outWidth} × ${outHeight}`;
  DOM.stepCount.textContent = `0 / ${outWidth * outHeight}`;

  renderInput();
  renderOutput();
  renderKernelMatrix();
}

// ─── Render Input ───
function renderInput() {
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      const v = state.input[y][x];
      DOM.inputCells[y][x].style.backgroundColor = `rgb(${v|0},${v|0},${v|0})`;
    }
  }
}

// ─── Render Output ───
function renderOutput() {
  for (let y = 0; y < state.outHeight; y++) {
    for (let x = 0; x < state.outWidth; x++) {
      DOM.outputCells[y][x].style.backgroundColor = getColor(state.output[y][x]);
    }
  }
}

// ─── Render Kernel Matrix ───
function renderKernelMatrix() {
  DOM.kernelGrid.innerHTML = '';
  const key = state.kernelKey;
  const k   = key === 'sobelMag' ? KERNELS.sobelX.data : KERNELS[key].data;

  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const cell = document.createElement('div');
      const val  = k[y][x];
      cell.className = 'kernel-cell ' + (val > 0 ? 'pos' : val < 0 ? 'neg' : 'zero');
      cell.textContent = val;
      DOM.kernelGrid.appendChild(cell);
    }
  }

  const info = KERNELS[key];
  DOM.kernelDesc.textContent = info.desc;
  DOM.kernelTag.textContent  = key === 'sobelMag' ? 'Sobel X + Y' : info.name;
}

// ─── Update Visuals after a step ───
function updateVisuals(outX, outY, result) {
  // Paint output pixel
  state.output[outY][outX] = result.val;
  const outCell = DOM.outputCells[outY][outX];
  outCell.style.backgroundColor = getColor(result.val);

  // Highlight active output
  document.querySelectorAll('.output-active').forEach(el => el.classList.remove('output-active'));
  outCell.classList.add('output-active');

  // Move kernel overlay
  DOM.overlay.classList.remove('hidden');
  DOM.overlay.style.transform = `translate(${result.startX * CELL_STEP}px, ${result.startY * CELL_STEP}px)`;

  // Math panel
  const eq   = result.parts.join(' + ') || '0';
  DOM.mathEq.textContent = state.kernelKey === 'sobelMag' ? eq : eq + ' =';
  DOM.mathRes.textContent = `Result: ${Math.round(result.val)}`;

  // Progress
  const total   = state.outWidth * state.outHeight;
  const current = outY * state.outWidth + outX + 1;
  DOM.progBar.style.width     = `${(current / total) * 100}%`;
  DOM.statusText.textContent  = `Output (${outX}, ${outY}) — step ${current}/${total}`;
  DOM.stepCount.textContent   = `${current} / ${total}`;
}

// ─────────────────────────────────────────────
// 5. CONTROLLER
// ─────────────────────────────────────────────

// ── Dimensions ──
function recalculateDimensions() {
  const p    = state.padding === 'same' ? 1 : 0;
  const padded = state.gridSize + p * 2;

  state.outWidth  = Math.floor((padded - 3) / state.stride) + 1;
  state.outHeight = Math.floor((padded - 3) / state.stride) + 1;
  state.output    = Array.from({ length: state.outHeight }, () => Array(state.outWidth).fill(0));
  state.curX = 0;
  state.curY = 0;
  state.history = [];

  buildGrids();
  DOM.overlay.classList.add('hidden');
  DOM.mathEq.textContent = 'Hover or step to view…';
  DOM.mathRes.textContent = '';
  DOM.progBar.style.width = '0%';
  DOM.statusText.textContent = 'Ready — hover over input image to preview';
}

// ── Init data ──
function initData() {
  state.input = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  drawShape('box');
  recalculateDimensions();
}

// ── Draw shapes ──
function drawShape(type) {
  const s = state.gridSize;
  state.input = Array.from({ length: s }, () => Array(s).fill(0));
  if (type === 'box') {
    for (let y = 5; y < 15; y++)
      for (let x = 5; x < 15; x++)
        state.input[y][x] = 255;
  } else if (type === 'cross') {
    for (let i = 0; i < s; i++) {
      if (i >= 2 && i < s - 2) {
        state.input[s / 2 | 0][i] = 255;
        state.input[i][s / 2 | 0] = 255;
      }
    }
  } else if (type === 'circle') {
    const cx = s / 2, cy = s / 2, r = 7;
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (d <= r) state.input[y][x] = 255;
      }
  }
}

// ── Step forward ──
function step() {
  if (state.curY >= state.outHeight) {
    pause();
    DOM.statusText.textContent = '✓ Convolution complete!';
    DOM.overlay.classList.add('hidden');
    DOM.progBar.style.width = '100%';
    return;
  }
  state.history.push({ x: state.curX, y: state.curY, oldVal: state.output[state.curY][state.curX] });
  const res = calculatePixel(state.curX, state.curY);
  updateVisuals(state.curX, state.curY, res);

  state.curX++;
  if (state.curX >= state.outWidth) { state.curX = 0; state.curY++; }
}

// ── Step back ──
function stepBack() {
  if (state.history.length === 0) return;
  const last = state.history.pop();
  state.curX = last.x;
  state.curY = last.y;
  state.output[last.y][last.x] = last.oldVal;
  DOM.outputCells[last.y][last.x].style.backgroundColor = getColor(last.oldVal);
  document.querySelectorAll('.output-active').forEach(el => el.classList.remove('output-active'));

  if (state.history.length > 0) {
    const prev = state.history[state.history.length - 1];
    updateVisuals(prev.x, prev.y, calculatePixel(prev.x, prev.y));
  } else {
    DOM.overlay.classList.add('hidden');
    DOM.mathEq.textContent = 'Stepped back to start.';
    DOM.mathRes.textContent = '';
    DOM.progBar.style.width = '0%';
    DOM.statusText.textContent = 'Ready — hover over input image to preview';
    DOM.stepCount.textContent = `0 / ${state.outWidth * state.outHeight}`;
  }
}

// ── Hover preview ──
function previewPixel(inX, inY) {
  if (state.isPlaying) return;
  const p      = state.padding === 'same' ? 1 : 0;
  const startX = Math.min(Math.max(inX - 1, -p), state.gridSize + p - 3);
  const startY = Math.min(Math.max(inY - 1, -p), state.gridSize + p - 3);
  const outX   = Math.floor((startX + p) / state.stride);
  const outY   = Math.floor((startY + p) / state.stride);

  if (outX >= 0 && outX < state.outWidth && outY >= 0 && outY < state.outHeight) {
    const res = calculatePixel(outX, outY);
    DOM.overlay.classList.remove('hidden');
    DOM.overlay.style.transform = `translate(${startX * CELL_STEP}px, ${startY * CELL_STEP}px)`;
    DOM.mathEq.textContent  = '[Preview] ' + (res.parts.join(' + ') || '0');
    DOM.mathRes.textContent = `→ ${Math.round(res.val)}`;
  }
}

// ── Playback ──
function play() {
  if (state.isPlaying || state.curY >= state.outHeight) return;
  state.isPlaying     = true;
  DOM.btnPlay.disabled  = true;
  DOM.btnPause.disabled = false;
  state.intervalId    = setInterval(step, +state.playSpeed);
}

function pause() {
  state.isPlaying     = false;
  clearInterval(state.intervalId);
  DOM.btnPlay.disabled  = false;
  DOM.btnPause.disabled = true;
}

// ─────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────

// Kernel select
document.getElementById('kernel-select').addEventListener('change', e => {
  state.kernelKey = e.target.value;
  recalculateDimensions();
});

// Padding
document.getElementById('padding-select').addEventListener('change', e => {
  state.padding = e.target.value;
  recalculateDimensions();
});

// Stride
document.getElementById('stride-input').addEventListener('change', e => {
  state.stride = Math.max(1, parseInt(e.target.value) || 1);
  recalculateDimensions();
});

// Speed
document.getElementById('speed-slider').addEventListener('input', e => {
  state.playSpeed = +e.target.value;
  document.getElementById('speed-val').textContent = `${state.playSpeed} ms/step`;
  if (state.isPlaying) { pause(); play(); }
});

// Toggles
function setupToggle(id, stateKey, callback) {
  const btn = document.getElementById(id);
  btn.addEventListener('click', () => {
    state[stateKey] = !state[stateKey];
    btn.setAttribute('aria-pressed', String(state[stateKey]));
    if (callback) callback();
  });
}
setupToggle('toggle-colormap', 'isColorMapped', renderOutput);
setupToggle('toggle-signed',   'isSigned',      renderOutput);

// Playback buttons
DOM.btnPlay.addEventListener('click', play);
DOM.btnPause.addEventListener('click', pause);
document.getElementById('btn-step').addEventListener('click', step);
document.getElementById('btn-step-back').addEventListener('click', stepBack);
document.getElementById('btn-reset').addEventListener('click', () => {
  pause();
  recalculateDimensions();
});

// Shape buttons
document.getElementById('btn-shape-box').addEventListener('click', () => {
  pause(); drawShape('box'); renderInput(); recalculateDimensions();
});
document.getElementById('btn-shape-cross').addEventListener('click', () => {
  pause(); drawShape('cross'); renderInput(); recalculateDimensions();
});
document.getElementById('btn-shape-circle').addEventListener('click', () => {
  pause(); drawShape('circle'); renderInput(); recalculateDimensions();
});

// Noise
document.getElementById('btn-noise').addEventListener('click', () => {
  for (let y = 0; y < state.gridSize; y++)
    for (let x = 0; x < state.gridSize; x++) {
      const n = (Math.random() - 0.5) * 80;
      state.input[y][x] = Math.max(0, Math.min(255, state.input[y][x] + n));
    }
  renderInput(); recalculateDimensions();
});

// Image upload
document.getElementById('image-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const canvas = document.getElementById('hidden-canvas');
    const ctx    = canvas.getContext('2d');
    canvas.width = canvas.height = state.gridSize;
    ctx.drawImage(img, 0, 0, state.gridSize, state.gridSize);
    const px = ctx.getImageData(0, 0, state.gridSize, state.gridSize).data;
    for (let y = 0; y < state.gridSize; y++)
      for (let x = 0; x < state.gridSize; x++) {
        const i = (y * state.gridSize + x) * 4;
        state.input[y][x] = Math.round(0.299 * px[i] + 0.587 * px[i+1] + 0.114 * px[i+2]);
      }
    recalculateDimensions();
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

// Tab navigation
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(`tab-${tab.dataset.tab}`);
    if (target) target.classList.add('active');
  });
});

// ── Boot ──
initData();
