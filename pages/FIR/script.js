// ==========================================
// 1. FFT & DSP ENGINE
// ==========================================
// A lightweight FFT implementation for extremely fast DTFT evaluation
class FastFourierTransform {
    constructor(size) {
        this.N = size;
        this.real = new Float64Array(size);
        this.imag = new Float64Array(size);
    }
    reverseBits(val, bits) {
        let res = 0;
        for (let i = 0; i < bits; i++) { res = (res << 1) | (val & 1); val >>= 1; }
        return res;
    }
    compute(inputReal) {
        const bits = Math.log2(this.N);
        for(let i=0; i<this.N; i++) {
            this.real[i] = inputReal[i] || 0;
            this.imag[i] = 0;
        }
        for (let i = 0; i < this.N; i++) {
            let j = this.reverseBits(i, bits);
            if (j > i) {
                let tr = this.real[i]; this.real[i] = this.real[j]; this.real[j] = tr;
            }
        }
        for (let size = 2; size <= this.N; size *= 2) {
            let halfSize = size / 2;
            let angleStep = (-2 * Math.PI) / size;
            for (let i = 0; i < this.N; i += size) {
                let angle = 0;
                for (let j = 0; j < halfSize; j++) {
                    let k = i + j, m = k + halfSize;
                    let wr = Math.cos(angle), wi = Math.sin(angle);
                    let tr = wr * this.real[m] - wi * this.imag[m];
                    let ti = wr * this.imag[m] + wi * this.real[m];
                    this.real[m] = this.real[k] - tr; this.imag[m] = this.imag[k] - ti;
                    this.real[k] += tr; this.imag[k] += ti;
                    angle += angleStep;
                }
            }
        }
    }
}

class FIRDesigner {
    sinc(x) { return x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x); }
    
    getWindow(type, n, N) {
        if (type === 'hann') return 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1));
        if (type === 'hamming') return 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
        if (type === 'blackman') return 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (N - 1));
        return 1.0; // rectangular
    }

    design(type, N, fc1, fc2, windowType) {
        let h = new Float64Array(N);
        let alpha = (N - 1) / 2;

        for (let n = 0; n < N; n++) {
            let ns = n - alpha;
            let hd = 0;

            if (type === 'lowpass') {
                hd = 2 * fc1 * this.sinc(2 * fc1 * ns);
            } else if (type === 'highpass') {
                hd = this.sinc(ns) - 2 * fc1 * this.sinc(2 * fc1 * ns);
            } else if (type === 'bandpass') {
                hd = 2 * fc2 * this.sinc(2 * fc2 * ns) - 2 * fc1 * this.sinc(2 * fc1 * ns);
            } else if (type === 'bandstop') {
                hd = this.sinc(ns) - (2 * fc2 * this.sinc(2 * fc2 * ns) - 2 * fc1 * this.sinc(2 * fc1 * ns));
            }

            h[n] = hd * this.getWindow(windowType, n, N);
        }
        return h;
    }
}

// ==========================================
// 2. SYSTEM STATE & UI BINDING
// ==========================================
const Theme = {
    primary: '#0ea5e9', secondary: '#ec4899', compare: '#eab308',
    pass: 'rgba(16, 185, 129, 0.15)', stop: 'rgba(239, 68, 68, 0.15)',
    axis: '#3f3f46', grid: '#27272a', text: '#a1a1aa'
};

const State = {
    fs: 1000, type: 'lowpass', N: 51,
    fc1: 200, fc2: 300,
    win1: 'hamming', win2: 'none',
    viewMode: 'mag', // 'mag' or 'phase'
    isAnimating: false,
    animTime: 0,
    
    // Computed Buffers
    h1: [], h2: [], freq1: [], freq2: [], phase1: [],
    timeSignalIn: new Float64Array(1000),
    timeSignalOut: new Float64Array(1000)
};

const Engine = new FIRDesigner();
const FFT = new FastFourierTransform(2048); // High resolution FFT for smooth curves

// Elements
const el = {
    fs: document.getElementById('slider-fs'),
    type: document.getElementById('sel-type'),
    taps: document.getElementById('slider-taps'),
    fc1: document.getElementById('slider-fc1'),
    fc2: document.getElementById('slider-fc2'),
    win1: document.getElementById('sel-window1'),
    win2: document.getElementById('sel-window2'),
    lblFs: document.getElementById('lbl-fs'),
    lblTaps: document.getElementById('lbl-taps'),
    lblFc1: document.getElementById('lbl-fc1'),
    lblFc2: document.getElementById('lbl-fc2'),
    grpFc2: document.getElementById('group-fc2'),
    expl: document.getElementById('dynamic-explanation'),
    btnMag: document.getElementById('btn-mag'),
    btnPhase: document.getElementById('btn-phase'),
    btnAnim: document.getElementById('btn-animate'),
    delayLbl: document.getElementById('delay-label'),
    preset: document.getElementById('sel-preset')
};

function enforceNyquist() {
    let nyquist = State.fs / 2;
    el.fc1.max = nyquist - 1; el.fc2.max = nyquist - 1;
    if (State.fc1 >= nyquist) State.fc1 = nyquist - 1;
    if (State.fc2 >= nyquist) State.fc2 = nyquist - 1;
    if (State.type.includes('band') && State.fc1 >= State.fc2) State.fc1 = State.fc2 - 10;
    
    el.fc1.value = State.fc1; el.fc2.value = State.fc2;
    el.lblFc1.innerText = `${State.fc1} Hz`; el.lblFc2.innerText = `${State.fc2} Hz`;
}

function updateParams() {
    State.fs = parseInt(el.fs.value);
    State.type = el.type.value;
    State.N = parseInt(el.taps.value);
    if (State.N % 2 === 0) { State.N += 1; el.taps.value = State.N; } // Force odd
    State.fc1 = parseInt(el.fc1.value);
    State.fc2 = parseInt(el.fc2.value);
    State.win1 = el.win1.value;
    State.win2 = el.win2.value;

    el.lblFs.innerText = `${State.fs} Hz`;
    el.lblTaps.innerText = State.N;
    
    el.grpFc2.style.display = State.type.includes('band') ? 'block' : 'none';
    enforceNyquist();
    computeFilters();
    updateExplanation();
    if(!State.isAnimating) drawAll();
}

// Binders
['fs','type','taps','fc1','fc2','win1','win2'].forEach(k => el[k].addEventListener('input', updateParams));
el.btnMag.addEventListener('click', () => { State.viewMode = 'mag'; el.btnMag.classList.add('active'); el.btnPhase.classList.remove('active'); drawAll(); });
el.btnPhase.addEventListener('click', () => { State.viewMode = 'phase'; el.btnPhase.classList.add('active'); el.btnMag.classList.remove('active'); drawAll(); });
el.btnAnim.addEventListener('click', () => {
    State.isAnimating = !State.isAnimating;
    el.btnAnim.innerText = State.isAnimating ? "Pause Animation ⏸" : "Animate Convolution ▶";
    el.btnAnim.style.background = State.isAnimating ? "#f59e0b" : "#10b981";
    el.delayLbl.style.display = State.isAnimating ? 'block' : 'none';
    if(State.isAnimating) animate();
});

// Presets
el.preset.addEventListener('change', (e) => {
    let p = e.target.value;
    if(p === 'audio-lp') { el.fs.value=44100; el.type.value='lowpass'; el.taps.value=101; el.fc1.value=4000; el.win1.value='hann'; }
    if(p === 'sharp-bp') { el.fs.value=1000; el.type.value='bandpass'; el.taps.value=151; el.fc1.value=150; el.fc2.value=250; el.win1.value='blackman'; }
    if(p === 'smooth-hp') { el.fs.value=1000; el.type.value='highpass'; el.taps.value=31; el.fc1.value=300; el.win1.value='hamming'; }
    updateParams();
});


// ==========================================
// 3. COMPUTATION PIPELINE
// ==========================================
function computeFilters() {
    let nFc1 = State.fc1 / State.fs;
    let nFc2 = State.fc2 / State.fs;

    // Design primary filter
    State.h1 = Engine.design(State.type, State.N, nFc1, nFc2, State.win1);
    
    // Evaluate Frequency Response via Zero-Padded FFT
    FFT.compute(State.h1);
    State.freq1 = []; State.phase1 = [];
    for(let i=0; i<FFT.N/2; i++) {
        let mag = Math.sqrt(FFT.real[i]**2 + FFT.imag[i]**2);
        State.freq1.push(20 * Math.log10(Math.max(mag, 1e-6)));
        
        let ph = Math.atan2(FFT.imag[i], FFT.real[i]);
        // Simple unwrap
        if(i > 0 && ph - State.phase1[i-1] > Math.PI) ph -= 2*Math.PI;
        if(i > 0 && ph - State.phase1[i-1] < -Math.PI) ph += 2*Math.PI;
        State.phase1.push(ph);
    }

    // Design secondary filter (if comparing)
    if(State.win2 !== 'none') {
        State.h2 = Engine.design(State.type, State.N, nFc1, nFc2, State.win2);
        FFT.compute(State.h2);
        State.freq2 = [];
        for(let i=0; i<FFT.N/2; i++) {
            let mag = Math.sqrt(FFT.real[i]**2 + FFT.imag[i]**2);
            State.freq2.push(20 * Math.log10(Math.max(mag, 1e-6)));
        }
    }
}

function updateExplanation() {
    let alpha = (State.N - 1) / 2;
    let text = `<strong>Current Setup:</strong> ${State.type.toUpperCase()} | N = ${State.N}<br>`;
    text += `<strong>Linear Phase:</strong> Yes. Group Delay is exactly ${alpha} samples.<br>`;
    
    let bw = (State.fs / State.N).toFixed(1);
    text += `<strong>Transition Bandwidth:</strong> ≈ ${bw} Hz (Inversely proportional to N).<br>`;
    
    if(State.win2 !== 'none') {
        text += `<br><span style="color:${Theme.primary}">Blue: ${State.win1}</span> vs <span style="color:${Theme.compare}">Yellow: ${State.win2}</span>`;
    }
    el.expl.innerHTML = text;
    el.delayLbl.innerText = `Group Delay = ${alpha} samples`;
}

// Generate Live Signal & Convolve
function computeTimeSimulation() {
    const LEN = State.timeSignalIn.length;
    
    // Create signal based on filter type to show clear filtering
    let fPass = State.type.includes('high') ? State.fc1 + 100 : State.fc1 / 2;
    let fStop = State.type.includes('high') ? State.fc1 / 2 : State.fc1 * 2;
    if(State.type === 'bandpass') { fPass = (State.fc1+State.fc2)/2; fStop = State.fc1 / 2; }
    
    for (let i = 0; i < LEN; i++) {
        let t = i / State.fs;
        // Signal + High Freq Noise + Anim Offset
        let passSignal = Math.sin(2 * Math.PI * fPass * t + State.animTime);
        let stopSignal = 0.5 * Math.sin(2 * Math.PI * fStop * t + State.animTime * 3);
        let noise = (Math.random() - 0.5) * 0.2;
        State.timeSignalIn[i] = passSignal + stopSignal + noise;
    }

    // Direct Convolution y[n] = sum(x[n-k] * h[k])
    for (let n = 0; n < LEN; n++) {
        let sum = 0;
        for (let k = 0; k < State.N; k++) {
            if (n - k >= 0) sum += State.timeSignalIn[n - k] * State.h1[k];
        }
        State.timeSignalOut[n] = sum;
    }
}

// ==========================================
// 4. RENDERING ENGINE
// ==========================================
const CtxI = document.getElementById('impulseCanvas').getContext('2d');
const CtxF = document.getElementById('freqCanvas').getContext('2d');
const CtxT = document.getElementById('timeCanvas').getContext('2d');

function resize() {
    [CtxI, CtxF, CtxT].forEach(ctx => {
        const rect = ctx.canvas.parentElement.getBoundingClientRect();
        if(rect.width===0) return;
        const dpr = window.devicePixelRatio || 1;
        ctx.canvas.width = rect.width * dpr; ctx.canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    });
    if(!State.isAnimating) drawAll();
}
window.addEventListener('resize', resize);

function drawImpulse() {
    const w = CtxI.canvas.width / window.devicePixelRatio;
    const h = CtxI.canvas.height / window.devicePixelRatio;
    CtxI.clearRect(0,0,w,h);

    let originY = h / 2;
    let maxH = Math.max(...State.h1.map(Math.abs), 0.1);
    let scaleY = (h * 0.4) / maxH;
    let scaleX = w / (State.N + 1);

    CtxI.strokeStyle = Theme.axis; CtxI.beginPath(); CtxI.moveTo(0, originY); CtxI.lineTo(w, originY); CtxI.stroke();

    let alpha = (State.N - 1) / 2;

    for(let n=0; n<State.N; n++) {
        let px = (n+1) * scaleX;
        let py = originY - State.h1[n] * scaleY;
        
        // Highlight symmetry center
        CtxI.fillStyle = (n === alpha) ? Theme.compare : Theme.primary;
        CtxI.strokeStyle = (n === alpha) ? Theme.compare : Theme.primary;
        
        CtxI.lineWidth = 2;
        CtxI.beginPath(); CtxI.moveTo(px, originY); CtxI.lineTo(px, py); CtxI.stroke();
        CtxI.beginPath(); CtxI.arc(px, py, 3, 0, Math.PI*2); CtxI.fill();
    }
}

function drawFreq() {
    const w = CtxF.canvas.width / window.devicePixelRatio;
    const h = CtxF.canvas.height / window.devicePixelRatio;
    CtxF.clearRect(0,0,w,h);

    let scaleX = w / (FFT.N / 2);
    let nyquist = State.fs / 2;

    // Draw Shading regions (Pass/Stop)
    let px1 = (State.fc1 / nyquist) * w;
    let px2 = (State.fc2 / nyquist) * w;
    
    CtxF.fillStyle = Theme.pass;
    if(State.type==='lowpass') CtxF.fillRect(0,0,px1,h);
    if(State.type==='highpass') CtxF.fillRect(px1,0,w-px1,h);
    if(State.type==='bandpass') CtxF.fillRect(px1,0,px2-px1,h);
    if(State.type==='bandstop') { CtxF.fillRect(0,0,px1,h); CtxF.fillRect(px2,0,w-px2,h); }

    if(State.viewMode === 'mag') {
        let minDB = -100, maxDB = 10;
        let scaleY = (h - 20) / (maxDB - minDB);
        
        // Grid
        CtxF.fillStyle = Theme.text; CtxF.font='10px sans-serif'; CtxF.strokeStyle = Theme.grid; CtxF.beginPath();
        for(let db=minDB; db<=maxDB; db+=20) {
            let py = 10 + (maxDB - db) * scaleY;
            CtxF.moveTo(30, py); CtxF.lineTo(w, py);
            CtxF.fillText(`${db}`, 5, py+3);
        }
        CtxF.stroke();

        // Draw Curves
        const drawCurve = (data, color) => {
            CtxF.strokeStyle = color; CtxF.lineWidth = 2; CtxF.beginPath();
            for(let i=0; i<data.length; i++) {
                let px = 30 + i * scaleX * ((w-30)/w);
                let py = 10 + (maxDB - Math.max(data[i], minDB)) * scaleY;
                if(i===0) CtxF.moveTo(px, py); else CtxF.lineTo(px, py);
            }
            CtxF.stroke();
        };

        if(State.win2 !== 'none') drawCurve(State.freq2, Theme.compare);
        drawCurve(State.freq1, Theme.primary);

    } else {
        // Phase Mode
        let originY = h/2;
        let scaleY = (h * 0.4) / Math.PI;
        
        CtxF.strokeStyle = Theme.axis; CtxF.beginPath(); CtxF.moveTo(0, originY); CtxF.lineTo(w, originY); CtxF.stroke();
        
        CtxF.strokeStyle = Theme.compare; CtxF.lineWidth = 2; CtxF.beginPath();
        for(let i=0; i<State.phase1.length; i++) {
            let px = i * scaleX;
            let py = originY - State.phase1[i] * scaleY;
            if(i===0) CtxF.moveTo(px, py); else CtxF.lineTo(px, py);
        }
        CtxF.stroke();
        CtxF.fillStyle = Theme.compare; CtxF.font='12px sans-serif'; CtxF.fillText("Linear Phase (Unwrapped)", 20, 20);
    }
}

function drawTime() {
    const w = CtxT.canvas.width / window.devicePixelRatio;
    const h = CtxT.canvas.height / window.devicePixelRatio;
    CtxT.clearRect(0,0,w,h);

    let originY1 = h * 0.25; // Input Top
    let originY2 = h * 0.75; // Output Bottom
    let scaleY = (h * 0.2) / 2.0; 
    let scaleX = w / State.timeSignalIn.length;

    // Axes
    CtxT.strokeStyle = Theme.axis; CtxT.lineWidth = 1; CtxT.beginPath(); 
    CtxT.moveTo(0, originY1); CtxT.lineTo(w, originY1);
    CtxT.moveTo(0, originY2); CtxT.lineTo(w, originY2);
    CtxT.stroke();

    // Draw Input (Gray)
    CtxT.strokeStyle = Theme.text; CtxT.lineWidth = 1.5; CtxT.beginPath();
    for(let i=0; i<State.timeSignalIn.length; i++) {
        let px = i * scaleX;
        let py = originY1 - State.timeSignalIn[i] * scaleY;
        if(i===0) CtxT.moveTo(px,py); else CtxT.lineTo(px,py);
    }
    CtxT.stroke();

    // Draw Output (Blue)
    CtxT.strokeStyle = Theme.primary; CtxT.lineWidth = 2; CtxT.beginPath();
    for(let i=0; i<State.timeSignalOut.length; i++) {
        let px = i * scaleX;
        let py = originY2 - State.timeSignalOut[i] * scaleY;
        if(i===0) CtxT.moveTo(px,py); else CtxT.lineTo(px,py);
    }
    CtxT.stroke();

    // Labels
    CtxT.fillStyle = '#fff'; CtxT.font='12px sans-serif';
    CtxT.fillText("Input Signal x[n] (Target + Noise)", 10, 20);
    CtxT.fillText("Filtered Output y[n]", 10, h/2 + 20);

    // Draw Sliding Window Animation Box
    if(State.isAnimating) {
        let windowWidth = State.N * scaleX;
        let alpha = (State.N - 1)/2;
        // Float a box in the middle of the screen
        let boxX = w/2;
        
        CtxT.fillStyle = 'rgba(234, 179, 8, 0.2)'; // Yellowish box
        CtxT.fillRect(boxX - windowWidth, 0, windowWidth, h);
        
        // Draw convolution line mapping input to output point
        CtxT.strokeStyle = Theme.compare; CtxT.setLineDash([5,5]); CtxT.beginPath();
        CtxT.moveTo(boxX, originY1 - State.timeSignalIn[Math.floor(boxX/scaleX)] * scaleY);
        // Map to output delayed by alpha
        let outX = boxX + (alpha * scaleX);
        CtxT.lineTo(outX, originY2 - State.timeSignalOut[Math.floor(outX/scaleX)] * scaleY);
        CtxT.stroke(); CtxT.setLineDash([]);
        
        // Draw output dot
        CtxT.fillStyle = Theme.compare; CtxT.beginPath();
        CtxT.arc(outX, originY2 - State.timeSignalOut[Math.floor(outX/scaleX)] * scaleY, 4, 0, Math.PI*2);
        CtxT.fill();
    }
}

function drawAll() {
    drawImpulse();
    drawFreq();
    computeTimeSimulation(); // Compute static frame if paused
    drawTime();
}

function animate() {
    if(State.isAnimating) {
        State.animTime -= 0.1;
        computeTimeSimulation();
        drawTime();
        requestAnimationFrame(animate);
    }
}

// Boot
updateParams();
resize();