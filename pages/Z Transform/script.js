// ==========================================
// 1. COMPLEX MATH & DSP ENGINE
// ==========================================
class Complex {
    constructor(r, i = 0) { this.r = r; this.i = i; }
    add(c) { return new Complex(this.r + c.r, this.i + c.i); }
    sub(c) { return new Complex(this.r - c.r, this.i - c.i); }
    mul(c) { return new Complex(this.r * c.r - this.i * c.i, this.r * c.i + this.i * c.r); }
    abs() { return Math.hypot(this.r, this.i); }
    arg() { return Math.atan2(this.i, this.r); }
}

// Convolution of two complex polynomial arrays
function polyConv(p1, p2) {
    if (p1.length === 0) return p2;
    if (p2.length === 0) return p1;
    let res = Array(p1.length + p2.length - 1).fill(null).map(() => new Complex(0,0));
    for(let i=0; i<p1.length; i++) {
        for(let j=0; j<p2.length; j++) {
            res[i+j] = res[i+j].add(p1[i].mul(p2[j]));
        }
    }
    return res;
}

// Convert roots (poles or zeros) to polynomial coefficients: (z - r1)(z - r2)...
function rootsToPoly(roots) {
    let poly = [new Complex(1, 0)];
    for(let r of roots) {
        poly = polyConv(poly, [new Complex(1, 0), new Complex(-r.r, -r.i)]);
    }
    return poly;
}

// Canvas Theme Variables (Extracted from CSS for Canvas Drawing)
const Theme = {
    pole: '#f43f5e',
    zero: '#0ea5e9',
    stableBg: 'rgba(16, 185, 129, 0.08)',
    unstableBg: 'rgba(244, 63, 94, 0.05)',
    unitCircle: '#10b981',
    timeStem: '#eab308',
    freqCurve: '#d946ef',
    axis: '#475569'
};

// ==========================================
// 2. SYSTEM STATE
// ==========================================
const State = {
    nodes: [
        { id: 1, type: 'pole', s: new Complex(0.8, 0.5) },
        { id: 2, type: 'pole', s: new Complex(0.8, -0.5) },
        { id: 3, type: 'zero', s: new Complex(-1, 0) }
    ], 
    nextId: 4,
    view: { x: 0, y: 0, scale: 120 }, // Higher scale because unit circle is radius 1
    snapToGrid: true,
    responseType: 'step',
    
    timeData: [],
    freqData: [],
    isStable: true
};

// ==========================================
// 3. DSP SIMULATION ENGINE
// ==========================================
function computeSystemResponse() {
    let poles = State.nodes.filter(n => n.type === 'pole').map(n => n.s);
    let zeros = State.nodes.filter(n => n.type === 'zero').map(n => n.s);
    
    // Check Stability (All poles must be strictly inside the unit circle)
    State.isStable = poles.every(p => p.abs() < 1.0);

    // 1. Calculate Polynomials
    let B = rootsToPoly(zeros); // Numerator
    let A = rootsToPoly(poles); // Denominator
    
    // Enforce Causality (pad with leading zeros to align powers of z)
    let maxLen = Math.max(B.length, A.length);
    while(B.length < maxLen) B.unshift(new Complex(0,0));
    while(A.length < maxLen) A.unshift(new Complex(0,0));

    // 2. Simulate Difference Equation y[n]
    State.timeData = [];
    const N_SAMPLES = 40;
    let y = Array(N_SAMPLES).fill(0);
    
    let x = (n) => {
        if (n < 0) return 0;
        return State.responseType === 'step' ? 1 : (n === 0 ? 1 : 0);
    };

    let maxVal = 0;
    for (let n = 0; n < N_SAMPLES; n++) {
        let yn = new Complex(0, 0);
        
        // Sum Numerator (Feedforward / B coefficients)
        for (let k = 0; k < maxLen; k++) {
            if (n - k >= 0) {
                yn = yn.add(B[k].mul(new Complex(x(n - k), 0)));
            }
        }
        
        // Sum Denominator (Feedback / A coefficients) - note A[0] is always 1
        for (let k = 1; k < maxLen; k++) {
            if (n - k >= 0) {
                yn = yn.sub(A[k].mul(new Complex(y[n - k], 0)));
            }
        }
        
        y[n] = yn.r; // Take real part (imaginary cancels out for conjugate pairs)
        State.timeData.push({ n: n, y: y[n] });
        if (Math.abs(y[n]) > maxVal) maxVal = Math.abs(y[n]);
    }
    
    // Normalize visualization if unstable
    if (maxVal > 100) {
        State.timeData.forEach(d => d.y = (d.y / maxVal) * 5);
    }

    // 3. Generate Frequency Response |H(e^jw)|
    State.freqData = [];
    for (let w = 0; w <= Math.PI; w += 0.05) {
        let z = new Complex(Math.cos(w), Math.sin(w));
        
        let num = 1;
        zeros.forEach(z0 => { num *= z.sub(z0).abs(); });
        let den = 1;
        poles.forEach(p0 => { den *= z.sub(p0).abs(); });
        
        let mag = den === 0 ? 100 : num / den;
        State.freqData.push({ w, mag });
    }

    updateMathUI(zeros, poles);
}

function updateMathUI(zeros, poles) {
    const el = document.getElementById('math-decomposition');
    if(poles.length === 0 && zeros.length === 0) {
        el.innerHTML = "<span class='placeholder-text'>System is empty. Add poles/zeros.</span>";
        return;
    }

    let formatRoot = (r) => {
        let real = r.r.toFixed(2);
        let imag = Math.abs(r.i).toFixed(2);
        if(r.i === 0) return `(z - ${real})`;
        return `(z - (${real} ${r.i > 0 ? '+' : '-'} j${imag}))`;
    };

    let numStr = zeros.length > 0 ? zeros.map(formatRoot).join("") : "1";
    let denStr = poles.length > 0 ? poles.map(formatRoot).join("") : "1";

    el.innerHTML = `
        H(z) = 
        <div class="fraction">
            <div class="num">${numStr}</div>
            <div class="den">${denStr}</div>
        </div>
    `;
}

// ==========================================
// 4. RENDERING ENGINE
// ==========================================
const CtxZ = document.getElementById('zPlaneCanvas').getContext('2d');
const CtxT = document.getElementById('timeCanvas').getContext('2d');
const CtxF = document.getElementById('freqCanvas').getContext('2d');

function resize() {
    [CtxZ, CtxT, CtxF].forEach(ctx => {
        const rect = ctx.canvas.parentElement.getBoundingClientRect();
        if(rect.width === 0) return; 
        const dpr = window.devicePixelRatio || 1;
        ctx.canvas.width = rect.width * dpr;
        ctx.canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    });
    drawAll();
}
window.addEventListener('resize', resize);

function sToPx(val, isImag = false) {
    if(isImag) return (CtxZ.canvas.height / window.devicePixelRatio / 2) - (val * State.view.scale) + State.view.y;
    return (CtxZ.canvas.width / window.devicePixelRatio / 2) + (val * State.view.scale) + State.view.x;
}
function pxToS(px, py) {
    let r = (px - State.view.x - (CtxZ.canvas.width / window.devicePixelRatio / 2)) / State.view.scale;
    let i = -(py - State.view.y - (CtxZ.canvas.height / window.devicePixelRatio / 2)) / State.view.scale;
    
    if(State.snapToGrid) { 
        r = Math.round(r * 10) / 10; 
        i = Math.round(i * 10) / 10; 
    }
    return new Complex(r, i);
}

function drawZPlane() {
    const w = CtxZ.canvas.width / window.devicePixelRatio;
    const h = CtxZ.canvas.height / window.devicePixelRatio;
    CtxZ.clearRect(0, 0, w, h);

    let originX = sToPx(0);
    let originY = sToPx(0, true);
    let radiusPx = State.view.scale;

    // Draw Unstable Background (Outside)
    CtxZ.fillStyle = Theme.unstableBg;
    CtxZ.fillRect(0, 0, w, h);

    // Draw Stable Background (Inside Unit Circle)
    CtxZ.beginPath();
    CtxZ.arc(originX, originY, radiusPx, 0, Math.PI * 2);
    CtxZ.fillStyle = Theme.stableBg;
    CtxZ.fill();

    // Draw Unit Circle Outline
    CtxZ.strokeStyle = Theme.unitCircle;
    CtxZ.lineWidth = 2;
    CtxZ.stroke();

    // Axes
    CtxZ.strokeStyle = Theme.axis;
    CtxZ.lineWidth = 1;
    CtxZ.beginPath();
    CtxZ.moveTo(0, originY); CtxZ.lineTo(w, originY); // Real
    CtxZ.moveTo(originX, 0); CtxZ.lineTo(originX, h); // Imag
    CtxZ.stroke();

    CtxZ.fillStyle = '#fff';
    CtxZ.font = '12px sans-serif';
    CtxZ.fillText("Re(z)", w - 40, originY - 10);
    CtxZ.fillText("Im(z)", originX + 10, 20);
    CtxZ.fillText("1", originX + radiusPx + 5, originY - 5);

    // Draw Nodes
    State.nodes.forEach(n => {
        let x = sToPx(n.s.r); let y = sToPx(n.s.i, true);
        CtxZ.lineWidth = 2;
        
        if(n.type === 'pole') {
            CtxZ.strokeStyle = Theme.pole;
            CtxZ.beginPath();
            CtxZ.moveTo(x - 6, y - 6); CtxZ.lineTo(x + 6, y + 6);
            CtxZ.moveTo(x + 6, y - 6); CtxZ.lineTo(x - 6, y + 6);
            CtxZ.stroke();
        } else {
            CtxZ.strokeStyle = Theme.zero;
            CtxZ.beginPath();
            CtxZ.arc(x, y, 6, 0, Math.PI * 2);
            CtxZ.stroke();
        }
    });
}

function drawTimeDomain() {
    const w = CtxT.canvas.width / window.devicePixelRatio;
    const h = CtxT.canvas.height / window.devicePixelRatio;
    CtxT.clearRect(0, 0, w, h);

    if(State.timeData.length === 0) return;

    let originY = h / 2;
    let maxAbs = Math.max(...State.timeData.map(d => Math.abs(d.y)), 0.1);
    let scaleY = (h * 0.4) / maxAbs;
    let scaleX = w / 40; 

    // Zero Axis
    CtxT.strokeStyle = Theme.axis;
    CtxT.beginPath(); CtxT.moveTo(0, originY); CtxT.lineTo(w, originY); CtxT.stroke();

    // Stem Plot for Discrete Data
    CtxT.fillStyle = State.isStable ? Theme.timeStem : Theme.pole;
    CtxT.strokeStyle = State.isStable ? Theme.timeStem : Theme.pole;
    CtxT.lineWidth = 2;

    State.timeData.forEach(d => {
        let px = d.n * scaleX + (scaleX/2);
        let py = originY - (d.y * scaleY);
        
        // Vertical line
        CtxT.beginPath();
        CtxT.moveTo(px, originY);
        CtxT.lineTo(px, py);
        CtxT.stroke();
        
        // Lollipop circle
        CtxT.beginPath();
        CtxT.arc(px, py, 3, 0, Math.PI*2);
        CtxT.fill();
    });
}

function drawFreqDomain() {
    const w = CtxF.canvas.width / window.devicePixelRatio;
    const h = CtxF.canvas.height / window.devicePixelRatio;
    CtxF.clearRect(0, 0, w, h);

    if(State.freqData.length === 0) return;

    let originY = h - 20;
    let maxMag = Math.max(...State.freqData.map(d => d.mag), 0.1);
    if(maxMag > 100) maxMag = 10; // Cap visual clipping
    let scaleY = (h - 40) / maxMag;
    let scaleX = (w - 20) / Math.PI; 

    // Axes
    CtxF.strokeStyle = Theme.axis;
    CtxF.beginPath(); 
    CtxF.moveTo(0, originY); CtxF.lineTo(w, originY); 
    CtxF.moveTo(10, 0); CtxF.lineTo(10, h); 
    CtxF.stroke();

    CtxF.fillStyle = '#fff';
    CtxF.fillText("ω (0 to π)", w - 60, h - 5);
    CtxF.fillText("|H(e^jω)|", 15, 15);

    // Magnitude Curve
    CtxF.strokeStyle = Theme.freqCurve;
    CtxF.lineWidth = 2.5;
    CtxF.beginPath();
    State.freqData.forEach((d, i) => {
        let mag = Math.min(d.mag, maxMag); 
        let px = d.w * scaleX + 10;
        let py = originY - (mag * scaleY);
        
        if(i === 0) CtxF.moveTo(px, py);
        else CtxF.lineTo(px, py);
    });
    CtxF.stroke();
}

function drawAll() {
    drawZPlane();
    drawTimeDomain();
    drawFreqDomain();
}

// ==========================================
// 5. INTERACTION LOGIC
// ==========================================
let activeNode = null;
let isDragging = false;
const tooltip = document.getElementById('tooltip');
const splaneWrapper = document.querySelector('.splane-wrapper');

splaneWrapper.addEventListener('mousedown', (e) => {
    const rect = splaneWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let hit = null;
    State.nodes.forEach(n => {
        let px = sToPx(n.s.r); let py = sToPx(n.s.i, true);
        if(Math.hypot(px - x, py - y) < 15) hit = n;
    });

    if (hit) {
        activeNode = hit;
        isDragging = true;
    }
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging || !activeNode) return;
    
    const rect = splaneWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let newS = pxToS(x, y);
    if(Math.abs(newS.i) < 0.1 && State.snapToGrid) newS.i = 0; 
    
    activeNode.s.r = newS.r;
    activeNode.s.i = newS.i;

    // Move conjugate symmetrically
    if(activeNode.pairId) {
        let pair = State.nodes.find(n => n.id === activeNode.pairId);
        if(pair) {
            pair.s.r = newS.r;
            pair.s.i = -newS.i;
        }
    }
    
    // Polar Tooltip Info
    let mag = activeNode.s.abs().toFixed(2);
    let ang = (activeNode.s.arg() * 180 / Math.PI).toFixed(1);

    tooltip.style.opacity = 1;
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY + 15) + 'px';
    tooltip.innerText = `${activeNode.type.toUpperCase()}\nRe: ${activeNode.s.r.toFixed(2)} | Im: ${activeNode.s.i.toFixed(2)}\nMag: ${mag} | Ang: ${ang}°`;

    computeSystemResponse();
    drawAll();
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    activeNode = null;
    tooltip.style.opacity = 0;
});

splaneWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    State.view.scale *= e.deltaY > 0 ? 0.9 : 1.1;
    State.view.scale = Math.max(20, Math.min(State.view.scale, 300));
    drawAll();
});

// UI Buttons
document.getElementById('btn-add-pole').addEventListener('click', () => {
    State.nodes.push({ id: State.nextId++, type: 'pole', s: new Complex(0.5, 0) });
    computeSystemResponse(); drawAll();
});
document.getElementById('btn-add-pole-complex').addEventListener('click', () => {
    let id1 = State.nextId++; let id2 = State.nextId++;
    State.nodes.push({ id: id1, pairId: id2, type: 'pole', s: new Complex(0.5, 0.5) });
    State.nodes.push({ id: id2, pairId: id1, type: 'pole', s: new Complex(0.5, -0.5) });
    computeSystemResponse(); drawAll();
});
document.getElementById('btn-add-zero').addEventListener('click', () => {
    State.nodes.push({ id: State.nextId++, type: 'zero', s: new Complex(-1, 0) });
    computeSystemResponse(); drawAll();
});
document.getElementById('btn-clear').addEventListener('click', () => {
    State.nodes = []; computeSystemResponse(); drawAll();
});
document.getElementById('toggle-snap').addEventListener('change', (e) => {
    State.snapToGrid = e.target.checked;
});
document.getElementById('response-type').addEventListener('change', (e) => {
    State.responseType = e.target.value;
    computeSystemResponse(); drawAll();
});

// Boot
resize();
State.nodes[0].pairId = 2;
State.nodes[1].pairId = 1;
computeSystemResponse();
drawAll();