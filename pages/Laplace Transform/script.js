// ==========================================
// 1. COMPLEX MATH ENGINE
// ==========================================
class Complex {
    constructor(r, i = 0) { this.r = r; this.i = i; }
    add(c) { return new Complex(this.r + c.r, this.i + c.i); }
    sub(c) { return new Complex(this.r - c.r, this.i - c.i); }
    mul(c) { return new Complex(this.r * c.r - this.i * c.i, this.r * c.i + this.i * c.r); }
    div(c) {
        let den = c.r * c.r + c.i * c.i;
        return new Complex((this.r * c.r + this.i * c.i) / den, (this.i * c.r - this.r * c.i) / den);
    }
    exp() {
        let er = Math.exp(this.r);
        return new Complex(er * Math.cos(this.i), er * Math.sin(this.i));
    }
    abs() { return Math.sqrt(this.r * this.r + this.i * this.i); }
}

// ==========================================
// 2. SYSTEM STATE & ARCHITECTURE
// ==========================================

// JS Canvas Canvas Theme Variables (Fixes invisible lines bug in canvas)
const Theme = {
    pole: '#ef4444',
    zero: '#3b82f6',
    stableBg: 'rgba(16, 185, 129, 0.08)',
    unstableBg: 'rgba(239, 68, 68, 0.08)',
    rocBg: 'rgba(234, 179, 8, 0.15)',
    timeCurve: '#10b981',
    envelope: '#f59e0b',
    freqCurve: '#8b5cf6',
    axis: '#475569'
};

const State = {
    nodes: [
        { id: 1, type: 'pole', s: new Complex(-1, 2) },
        { id: 2, type: 'pole', s: new Complex(-1, -2) }
    ], 
    nextId: 3,
    view: { x: 0, y: 0, scale: 50 }, 
    snapToGrid: true,
    responseType: 'step',
    showEnvelope: true,
    time: 0,
    isPlaying: true,
    timeData: [],
    freqData: [],
    residues: [],
    maxSigma: 0
};

// Math Engine: Calculates Inverse Laplace via Partial Fraction Expansion
function computeSystemResponse() {
    let poles = State.nodes.filter(n => n.type === 'pole').map(n => n.s);
    let zeros = State.nodes.filter(n => n.type === 'zero').map(n => n.s);
    
    // If Step Response, add a pole at origin (s=0)
    if (State.responseType === 'step') {
        poles.push(new Complex(0, 0));
    }

    // Protection against identical poles
    for(let i=0; i<poles.length; i++) {
        for(let j=i+1; j<poles.length; j++) {
            if(Math.abs(poles[i].r - poles[j].r) < 0.05 && Math.abs(poles[i].i - poles[j].i) < 0.05) {
                poles[j].r += 0.1; 
            }
        }
    }

    State.residues = [];
    
    poles.forEach((pk, k) => {
        let num = new Complex(1, 0);
        zeros.forEach(z => { num = num.mul(pk.sub(z)); });
        
        let den = new Complex(1, 0);
        poles.forEach((pj, j) => {
            if (k !== j) den = den.mul(pk.sub(pj));
        });
        
        State.residues.push({ p: pk, c: num.div(den) });
    });

    State.timeData = [];
    const tMax = 15;
    const dt = 0.05;
    let maxVal = 0;

    for (let t = 0; t <= tMax; t += dt) {
        let f_t = 0;
        State.residues.forEach(res => {
            let s_t = new Complex(res.p.r * t, res.p.i * t);
            let term = res.c.mul(s_t.exp());
            f_t += term.r; 
        });
        State.timeData.push({ t, y: f_t });
        if (Math.abs(f_t) > maxVal && t > 0.1) maxVal = Math.abs(f_t);
    }
    
    if(maxVal > 100) {
        State.timeData.forEach(d => d.y = (d.y / maxVal) * 5);
    }

    State.freqData = [];
    let sysPoles = State.nodes.filter(n => n.type === 'pole').map(n => n.s);
    let sysZeros = State.nodes.filter(n => n.type === 'zero').map(n => n.s);
    
    for (let w = 0; w <= 10; w += 0.1) {
        let s = new Complex(0, w);
        let num = 1;
        sysZeros.forEach(z => { num *= s.sub(z).abs(); });
        let den = 1;
        sysPoles.forEach(p => { den *= s.sub(p).abs(); });
        
        let mag = den === 0 ? 100 : num / den;
        State.freqData.push({ w, mag });
    }

    updateMathUI();
}

function updateMathUI() {
    const el = document.getElementById('math-decomposition');
    if(State.nodes.filter(n => n.type === 'pole').length === 0) {
        el.innerHTML = "<span class='placeholder-text'>System is empty. Add poles to see dynamics.</span>";
        return;
    }

    let eq = "f(t) = ";
    let terms = State.residues.map(res => {
        let amp = res.c.abs().toFixed(2);
        let phase = Math.atan2(res.c.i, res.c.r);
        let sigma = res.p.r.toFixed(2);
        let omega = Math.abs(res.p.i).toFixed(2);

        if(res.p.i === 0) {
            return `[${res.c.r.toFixed(2)}] e<sup>${sigma}t</sup>`;
        } else if (res.p.i > 0) {
            return `[${(amp*2).toFixed(2)}] e<sup>${sigma}t</sup> cos(${omega}t ${phase > 0 ? '+'+phase.toFixed(2) : phase.toFixed(2)})`;
        }
        return null;
    }).filter(t => t !== null);

    el.innerHTML = eq + terms.join(" <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ ") + " <br><br><em>(Valid for t ≥ 0)</em>";
}

// ==========================================
// 3. RENDERING ENGINE
// ==========================================
const CtxS = document.getElementById('sPlaneCanvas').getContext('2d');
const CtxT = document.getElementById('timeCanvas').getContext('2d');
const CtxF = document.getElementById('freqCanvas').getContext('2d');

function resize() {
    [CtxS, CtxT, CtxF].forEach(ctx => {
        const rect = ctx.canvas.parentElement.getBoundingClientRect();
        if(rect.width === 0) return; // Guard clause
        const dpr = window.devicePixelRatio || 1;
        ctx.canvas.width = rect.width * dpr;
        ctx.canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    });
}
window.addEventListener('resize', resize);

function sToPx(val, isImag = false) {
    if(isImag) return (CtxS.canvas.height / window.devicePixelRatio / 2) - (val * State.view.scale) + State.view.y;
    return (CtxS.canvas.width / window.devicePixelRatio / 2) + (val * State.view.scale) + State.view.x;
}
function pxToS(px, py) {
    let r = (px - State.view.x - (CtxS.canvas.width / window.devicePixelRatio / 2)) / State.view.scale;
    let i = -(py - State.view.y - (CtxS.canvas.height / window.devicePixelRatio / 2)) / State.view.scale;
    if(State.snapToGrid) { r = Math.round(r*2)/2; i = Math.round(i*2)/2; }
    return new Complex(r, i);
}

function drawSPlane() {
    const w = CtxS.canvas.width / window.devicePixelRatio;
    const h = CtxS.canvas.height / window.devicePixelRatio;
    CtxS.clearRect(0, 0, w, h);

    let maxSigma = -Infinity;
    State.nodes.forEach(n => { if(n.type === 'pole' && n.s.r > maxSigma) maxSigma = n.s.r; });
    State.maxSigma = maxSigma === -Infinity ? 0 : maxSigma;
    
    let rocPx = sToPx(State.maxSigma);
    
    // USING JS THEME OBJ INSTEAD OF CSS VARS
    CtxS.fillStyle = Theme.rocBg;
    CtxS.fillRect(rocPx, 0, w - rocPx, h);

    let zeroPx = sToPx(0);
    CtxS.fillStyle = Theme.stableBg;
    CtxS.fillRect(0, 0, zeroPx, h);
    CtxS.fillStyle = Theme.unstableBg;
    CtxS.fillRect(zeroPx, 0, w - zeroPx, h);

    CtxS.strokeStyle = Theme.axis;
    CtxS.lineWidth = 1;
    CtxS.beginPath();
    
    for(let i = -10; i <= 10; i++) {
        let x = sToPx(i); let y = sToPx(i, true);
        CtxS.moveTo(x, 0); CtxS.lineTo(x, h);
        CtxS.moveTo(0, y); CtxS.lineTo(w, y);
    }
    CtxS.stroke();

    CtxS.lineWidth = 2;
    CtxS.strokeStyle = '#fff';
    CtxS.beginPath();
    CtxS.moveTo(zeroPx, 0); CtxS.lineTo(zeroPx, h); 
    CtxS.moveTo(0, sToPx(0, true)); CtxS.lineTo(w, sToPx(0, true)); 
    CtxS.stroke();

    CtxS.fillStyle = '#fff';
    CtxS.font = '12px sans-serif';
    CtxS.fillText("Re(s)", w - 40, sToPx(0, true) - 10);
    CtxS.fillText("jω", zeroPx + 10, 20);

    if(maxSigma !== -Infinity) {
        CtxS.fillStyle = Theme.envelope;
        CtxS.fillText(`ROC: Re(s) > ${maxSigma.toFixed(1)}`, rocPx + 10, h - 20);
        CtxS.beginPath();
        CtxS.setLineDash([5, 5]);
        CtxS.moveTo(rocPx, 0); CtxS.lineTo(rocPx, h);
        CtxS.strokeStyle = Theme.envelope;
        CtxS.stroke();
        CtxS.setLineDash([]);
    }

    State.nodes.forEach(n => {
        let x = sToPx(n.s.r); let y = sToPx(n.s.i, true);
        CtxS.lineWidth = 2;
        
        if(n.type === 'pole') {
            CtxS.strokeStyle = Theme.pole;
            CtxS.beginPath();
            CtxS.moveTo(x - 6, y - 6); CtxS.lineTo(x + 6, y + 6);
            CtxS.moveTo(x + 6, y - 6); CtxS.lineTo(x - 6, y + 6);
            CtxS.stroke();
        } else {
            CtxS.strokeStyle = Theme.zero;
            CtxS.beginPath();
            CtxS.arc(x, y, 6, 0, Math.PI * 2);
            CtxS.stroke();
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
    let scaleX = w / 15; 

    CtxT.strokeStyle = Theme.axis;
    CtxT.beginPath(); CtxT.moveTo(0, originY); CtxT.lineTo(w, originY); CtxT.stroke();

    if (State.showEnvelope && State.maxSigma !== 0) {
        CtxT.strokeStyle = Theme.envelope;
        CtxT.setLineDash([5, 5]);
        CtxT.lineWidth = 1;
        CtxT.beginPath();
        for (let t = 0; t <= 15; t += 0.5) {
            let envY = Math.exp(State.maxSigma * t) * (State.responseType === 'step' ? 1 : maxAbs*0.5) * scaleY;
            if(t===0) { CtxT.moveTo(t*scaleX, originY - envY); } else { CtxT.lineTo(t*scaleX, originY - envY); }
        }
        CtxT.stroke();
        CtxT.beginPath();
        for (let t = 0; t <= 15; t += 0.5) {
            let envY = Math.exp(State.maxSigma * t) * (State.responseType === 'step' ? 1 : maxAbs*0.5) * scaleY;
            if(t===0) { CtxT.moveTo(t*scaleX, originY + envY); } else { CtxT.lineTo(t*scaleX, originY + envY); }
        }
        CtxT.stroke();
        CtxT.setLineDash([]);
        
        CtxT.fillStyle = Theme.envelope;
        CtxT.fillText(`Envelope ∝ e^(${State.maxSigma.toFixed(1)}t)`, 10, 20);
    }

    CtxT.strokeStyle = State.maxSigma > 0 ? Theme.pole : Theme.timeCurve;
    CtxT.lineWidth = 2.5;
    CtxT.beginPath();
    State.timeData.forEach((d, i) => {
        let py = originY - (d.y * scaleY);
        if(i === 0) CtxT.moveTo(d.t * scaleX, py);
        else CtxT.lineTo(d.t * scaleX, py);
    });
    CtxT.stroke();

    let animIdx = Math.floor((State.time % 15) / 0.05);
    if(State.timeData[animIdx]) {
        let pt = State.timeData[animIdx];
        CtxT.fillStyle = '#fff';
        CtxT.beginPath();
        CtxT.arc(pt.t * scaleX, originY - (pt.y * scaleY), 5, 0, Math.PI*2);
        CtxT.fill();
    }
}

function drawFreqDomain() {
    const w = CtxF.canvas.width / window.devicePixelRatio;
    const h = CtxF.canvas.height / window.devicePixelRatio;
    CtxF.clearRect(0, 0, w, h);

    if(State.freqData.length === 0) return;

    let originY = h - 20;
    let maxMag = Math.max(...State.freqData.map(d => d.mag), 0.1);
    if(maxMag > 100) maxMag = 10; 
    let scaleY = (h - 40) / maxMag;
    let scaleX = w / 10; 

    CtxF.strokeStyle = Theme.axis;
    CtxF.beginPath(); 
    CtxF.moveTo(0, originY); CtxF.lineTo(w, originY); 
    CtxF.moveTo(10, 0); CtxF.lineTo(10, h); 
    CtxF.stroke();

    CtxF.fillStyle = '#fff';
    CtxF.fillText("ω (rad/s)", w - 50, h - 5);
    CtxF.fillText("|H(jω)|", 15, 15);

    CtxF.strokeStyle = Theme.freqCurve;
    CtxF.lineWidth = 2;
    CtxF.beginPath();
    State.freqData.forEach((d, i) => {
        let mag = Math.min(d.mag, maxMag); 
        let py = originY - (mag * scaleY);
        if(i === 0) CtxF.moveTo(d.w * scaleX + 10, py);
        else CtxF.lineTo(d.w * scaleX + 10, py);
    });
    CtxF.stroke();
}

// ==========================================
// 4. INTERACTION LOGIC
// ==========================================
let activeNode = null;
let isDragging = false;
let isPanning = false;
let lastMouse = {x: 0, y: 0};
const tooltip = document.getElementById('tooltip');

const splaneWrapper = document.querySelector('.splane-wrapper');

splaneWrapper.addEventListener('mousedown', (e) => {
    const rect = splaneWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (e.button === 1 || e.shiftKey) { 
        isPanning = true;
        lastMouse = {x, y};
        return;
    }

    let hit = null;
    let sMouse = pxToS(x, y);
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
    const rect = splaneWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isPanning) {
        State.view.x += (x - lastMouse.x);
        State.view.y += (y - lastMouse.y);
        lastMouse = {x, y};
        return;
    }

    if (isDragging && activeNode) {
        let newS = pxToS(x, y);
        if(Math.abs(newS.i) < 0.2 && State.snapToGrid) newS.i = 0; 
        
        let deltaR = newS.r - activeNode.s.r;
        let deltaI = newS.i - activeNode.s.i;
        
        activeNode.s.r = newS.r;
        activeNode.s.i = newS.i;

        if(activeNode.pairId) {
            let pair = State.nodes.find(n => n.id === activeNode.pairId);
            if(pair) {
                pair.s.r = newS.r;
                pair.s.i = -newS.i;
            }
        }
        
        tooltip.style.opacity = 1;
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
        tooltip.innerText = `${activeNode.type.toUpperCase()}\nσ: ${activeNode.s.r.toFixed(2)}\njω: ${activeNode.s.i.toFixed(2)}`;

        computeSystemResponse();
    }
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    isPanning = false;
    activeNode = null;
    tooltip.style.opacity = 0;
});

splaneWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    State.view.scale *= e.deltaY > 0 ? 0.9 : 1.1;
    State.view.scale = Math.max(10, Math.min(State.view.scale, 200));
});

document.getElementById('btn-add-pole-real').addEventListener('click', () => {
    State.nodes.push({ id: State.nextId++, type: 'pole', s: new Complex(-2, 0) });
    computeSystemResponse();
});
document.getElementById('btn-add-pole-complex').addEventListener('click', () => {
    let id1 = State.nextId++; let id2 = State.nextId++;
    State.nodes.push({ id: id1, pairId: id2, type: 'pole', s: new Complex(-1, 3) });
    State.nodes.push({ id: id2, pairId: id1, type: 'pole', s: new Complex(-1, -3) });
    computeSystemResponse();
});
document.getElementById('btn-add-zero').addEventListener('click', () => {
    State.nodes.push({ id: State.nextId++, type: 'zero', s: new Complex(-3, 0) });
    computeSystemResponse();
});
document.getElementById('btn-clear').addEventListener('click', () => {
    State.nodes = []; computeSystemResponse();
});
document.getElementById('toggle-snap').addEventListener('change', (e) => {
    State.snapToGrid = e.target.checked;
});
document.getElementById('toggle-envelope').addEventListener('change', (e) => {
    State.showEnvelope = e.target.checked;
});
document.getElementById('response-type').addEventListener('change', (e) => {
    State.responseType = e.target.value;
    computeSystemResponse();
});

// ==========================================
// 5. MAIN LOOP
// ==========================================
function animate() {
    State.time += 0.05;
    
    drawSPlane();
    drawTimeDomain();
    drawFreqDomain();
    
    requestAnimationFrame(animate);
}

// Boot
resize();
State.nodes[0].pairId = 2;
State.nodes[1].pairId = 1;
computeSystemResponse();
animate();