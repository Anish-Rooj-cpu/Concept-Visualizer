const phaseCanvas = document.getElementById('phaseCanvas');
const pCtx = phaseCanvas.getContext('2d');
const timeCanvas = document.getElementById('timeCanvas');
const tCtx = timeCanvas.getContext('2d');

const inputs = {
    a11: document.getElementById('a11'),
    a12: document.getElementById('a12'),
    a21: document.getElementById('a21'),
    a22: document.getElementById('a22')
};
const metricsReadout = document.getElementById('metricsReadout');
const densitySlider = document.getElementById('densitySlider');

// System State
let A = [[0,0],[0,0]];
let eigenvectors = [];
let trajectories = [];
let activeTrajectory = null; 

// Viewport / Pan / Zoom State
let viewLimit = 5; 
let offsetX = 0;
let offsetY = 0;
let isPanning = false;
let startPanX, startPanY;

const presets = {
    center: [0, 1, -1, 0],
    stable_focus: [-0.5, 1, -1, -0.5],
    saddle: [1, 1, 4, -2],
    stable_node: [-2, 1, 0, -1],
    unstable_node: [2, 1, 0, 1],
    unstable_focus: [0.5, 1, -1, 0.5]
};

// Listeners
document.getElementById('presetSelect').addEventListener('change', (e) => {
    const val = e.target.value;
    if (presets[val]) {
        inputs.a11.value = presets[val][0]; inputs.a12.value = presets[val][1];
        inputs.a21.value = presets[val][2]; inputs.a22.value = presets[val][3];
        updateSystem();
    }
});

document.getElementById('updateBtn').addEventListener('click', updateSystem);

densitySlider.addEventListener('input', () => {
    let val = densitySlider.value;
    let label = val < 30 ? "Dense" : (val > 60 ? "Sparse" : "Medium");
    document.getElementById('densityLabel').innerText = `${label} (${val}px)`;
});

function getMatrix() {
    A[0][0] = parseFloat(inputs.a11.value) || 0; A[0][1] = parseFloat(inputs.a12.value) || 0;
    A[1][0] = parseFloat(inputs.a21.value) || 0; A[1][1] = parseFloat(inputs.a22.value) || 0;
}

// --- Absolute Clear Function ---
window.clearAllTrajectories = function() {
    trajectories = [];
    activeTrajectory = null;
    drawPhasePortrait();
    drawTimeGraph();
};

// --- Math & Stability Analysis ---
function analyzeStability() {
    const tr = A[0][0] + A[1][1];
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    const delta = tr * tr - 4 * det;

    eigenvectors = [];
    let type = "Unknown", color = "#cdd6f4";
    let l1_r, l1_i, l2_r, l2_i;

    if (delta >= 0) {
        l1_r = (tr + Math.sqrt(delta)) / 2; l2_r = (tr - Math.sqrt(delta)) / 2;
        l1_i = 0; l2_i = 0;

        if (det < 0) { type = "Saddle Point"; color = "#f9e2af"; }
        else if (tr > 0) { type = "Unstable Node"; color = "#f38ba8"; }
        else if (tr < 0) { type = "Stable Node"; color = "#a6e3a1"; }

        // Calculate Eigenvectors for real roots
        const getEv = (lambda) => {
            let a = A[0][0] - lambda, b = A[0][1], c = A[1][0], d = A[1][1] - lambda;
            if (Math.abs(b) > 1e-5) return { x: 1, y: -a/b };
            if (Math.abs(c) > 1e-5) return { x: -d/c, y: 1 };
            return { x: a === 0 ? 1 : 0, y: d === 0 ? 1 : 0 };
        };
        if (l1_r !== l2_r) {
            eigenvectors.push(getEv(l1_r));
            eigenvectors.push(getEv(l2_r));
        } else {
            eigenvectors.push(getEv(l1_r)); // repeated root
        }
    } else {
        l1_r = tr / 2; l2_r = tr / 2;
        l1_i = Math.sqrt(-delta) / 2; l2_i = -Math.sqrt(-delta) / 2;

        if (tr > 0) { type = "Unstable Focus (Spiral Out)"; color = "#f38ba8"; }
        else if (tr < 0) { type = "Stable Focus (Spiral In)"; color = "#a6e3a1"; }
        else { type = "Center (Undamped)"; color = "#89b4fa"; }
    }

    const fmt = (r, i) => i === 0 ? r.toFixed(2) : `${r.toFixed(2)} ${i>0?'+':'-'} j${Math.abs(i).toFixed(2)}`;
    metricsReadout.innerHTML = `
        <div style="margin-bottom: 5px;"><strong>Eigenvalues (λ):</strong></div>
        <div style="font-family: monospace; color: var(--accent-yellow);">λ₁ = ${fmt(l1_r, l1_i)}</div>
        <div style="font-family: monospace; color: var(--accent-yellow);">λ₂ = ${fmt(l2_r, l2_i)}</div>
        <div style="margin-top: 10px; font-size: 16px; font-weight: bold; color: ${color};">${type}</div>
    `;
}

// --- Coordinate Transformations ---
function getScale() { return (phaseCanvas.width / 2) / viewLimit; }

function toScreen(x, y) {
    const s = getScale();
    return { x: phaseCanvas.width/2 + offsetX + x * s, y: phaseCanvas.height/2 + offsetY - y * s };
}

function toWorld(sx, sy) {
    const s = getScale();
    return { x: (sx - phaseCanvas.width/2 - offsetX) / s, y: -(sy - phaseCanvas.height/2 - offsetY) / s };
}

// --- Phase Plot Drawing ---
function drawPhasePortrait() {
    pCtx.clearRect(0, 0, phaseCanvas.width, phaseCanvas.height);
    
    // Grid
    pCtx.strokeStyle = '#313244'; pCtx.lineWidth = 1;
    const wBounds = { 
        minX: toWorld(0, 0).x, maxX: toWorld(phaseCanvas.width, 0).x,
        minY: toWorld(0, phaseCanvas.height).y, maxY: toWorld(0, 0).y 
    };

    for(let i = Math.floor(wBounds.minX); i <= Math.ceil(wBounds.maxX); i++) {
        let px = toScreen(i, 0).x;
        pCtx.beginPath(); pCtx.moveTo(px, 0); pCtx.lineTo(px, phaseCanvas.height); pCtx.stroke();
    }
    for(let i = Math.floor(wBounds.minY); i <= Math.ceil(wBounds.maxY); i++) {
        let py = toScreen(0, i).y;
        pCtx.beginPath(); pCtx.moveTo(0, py); pCtx.lineTo(phaseCanvas.width, py); pCtx.stroke();
    }

    // Main Axes
    pCtx.strokeStyle = '#a6adc8'; pCtx.lineWidth = 2;
    let originScreen = toScreen(0,0);
    pCtx.beginPath(); pCtx.moveTo(0, originScreen.y); pCtx.lineTo(phaseCanvas.width, originScreen.y); pCtx.stroke();
    pCtx.beginPath(); pCtx.moveTo(originScreen.x, 0); pCtx.lineTo(originScreen.x, phaseCanvas.height); pCtx.stroke();

    // Eigenvectors (if real)
    pCtx.strokeStyle = '#f9e2af'; pCtx.lineWidth = 2; pCtx.setLineDash([5, 5]);
    eigenvectors.forEach(ev => {
        let p1 = toScreen(-ev.x * 100, -ev.y * 100);
        let p2 = toScreen(ev.x * 100, ev.y * 100);
        pCtx.beginPath(); pCtx.moveTo(p1.x, p1.y); pCtx.lineTo(p2.x, p2.y); pCtx.stroke();
    });
    pCtx.setLineDash([]);

    // Vector Field
    pCtx.strokeStyle = 'rgba(137, 180, 250, 0.4)'; pCtx.fillStyle = 'rgba(137, 180, 250, 0.6)'; pCtx.lineWidth = 1.5;
    const pxSpacing = parseInt(densitySlider.value);
    
    for (let sx = pxSpacing/2; sx < phaseCanvas.width; sx += pxSpacing) {
        for (let sy = pxSpacing/2; sy < phaseCanvas.height; sy += pxSpacing) {
            let w = toWorld(sx, sy);
            const dx = A[0][0] * w.x + A[0][1] * w.y;
            const dy = A[1][0] * w.x + A[1][1] * w.y;
            
            const mag = Math.sqrt(dx*dx + dy*dy);
            if (mag < 1e-4) continue;
            
            const arrowLen = pxSpacing * 0.4;
            const angle = Math.atan2(-dy, dx); 
            
            const endX = sx + Math.cos(angle) * arrowLen;
            const endY = sy + Math.sin(angle) * arrowLen;

            pCtx.beginPath(); pCtx.moveTo(sx, sy); pCtx.lineTo(endX, endY); pCtx.stroke();
            const head = 5;
            pCtx.beginPath();
            pCtx.moveTo(endX, endY);
            pCtx.lineTo(endX - head * Math.cos(angle - Math.PI / 6), endY - head * Math.sin(angle - Math.PI / 6));
            pCtx.lineTo(endX - head * Math.cos(angle + Math.PI / 6), endY - head * Math.sin(angle + Math.PI / 6));
            pCtx.fill();
        }
    }

    // Trajectories (Animated)
    const colors = ['#f38ba8', '#a6e3a1', '#cba6f7', '#89dceb', '#fab387'];
    trajectories.forEach((traj, idx) => {
        pCtx.strokeStyle = colors[idx % colors.length];
        pCtx.lineWidth = 2;
        pCtx.beginPath();
        
        // ** THE FIX: Safe bound the drawing limit **
        const drawLimit = Math.min(traj.currentIndex, traj.path.length);
        
        for (let i = 0; i < drawLimit; i++) {
            let pt = toScreen(traj.path[i].x, traj.path[i].y);
            if (i === 0) pCtx.moveTo(pt.x, pt.y);
            else pCtx.lineTo(pt.x, pt.y);
        }
        pCtx.stroke();

        // Lead particle
        if (drawLimit > 0) {
            let pt = toScreen(traj.path[drawLimit - 1].x, traj.path[drawLimit - 1].y);
            pCtx.fillStyle = '#fff';
            pCtx.beginPath(); pCtx.arc(pt.x, pt.y, 4, 0, Math.PI*2); pCtx.fill();
        }
        
        // Advance animation safely
        if (traj.currentIndex < traj.path.length) {
            traj.currentIndex += 2; 
            if (traj.currentIndex > traj.path.length) {
                traj.currentIndex = traj.path.length;
            }
        }
    });
}

// --- Time Response Graph ---
function drawTimeGraph() {
    tCtx.clearRect(0, 0, timeCanvas.width, timeCanvas.height);
    
    // Grid/Axes Background
    const pad = 25;
    const cy = timeCanvas.height / 2;
    tCtx.strokeStyle = '#45475a'; tCtx.lineWidth = 1;
    tCtx.beginPath(); tCtx.moveTo(pad, cy); tCtx.lineTo(timeCanvas.width, cy); tCtx.stroke();
    tCtx.beginPath(); tCtx.moveTo(pad, 0); tCtx.lineTo(pad, timeCanvas.height); tCtx.stroke();
    
    tCtx.fillStyle = '#a6adc8'; tCtx.font = '11px sans-serif';
    tCtx.fillText('Time (t)', timeCanvas.width - 45, cy + 15);
    tCtx.fillText('0', pad - 12, cy + 4);

    if (!activeTrajectory || activeTrajectory.path.length === 0) return; // Safely exit if empty

    const maxTime = activeTrajectory.path[activeTrajectory.path.length-1].t;
    let maxY = 0.001; 
    activeTrajectory.path.forEach(pt => { maxY = Math.max(maxY, Math.abs(pt.x), Math.abs(pt.y)); });

    const scaleX = (timeCanvas.width - pad*2) / maxTime;
    const scaleY = (timeCanvas.height/2 - pad) / maxY;
    
    // ** THE FIX: Safe bound the drawing limit **
    const drawLimit = Math.min(activeTrajectory.currentIndex, activeTrajectory.path.length);

    // Draw x1(t)
    tCtx.strokeStyle = '#89b4fa'; tCtx.lineWidth = 2;
    tCtx.beginPath();
    for(let i=0; i<drawLimit; i++) {
        let pt = activeTrajectory.path[i];
        let sx = pad + pt.t * scaleX;
        let sy = cy - pt.x * scaleY;
        if(i===0) tCtx.moveTo(sx, sy); else tCtx.lineTo(sx, sy);
    }
    tCtx.stroke();
    
    // Draw x2(t)
    tCtx.strokeStyle = '#f38ba8'; tCtx.lineWidth = 2;
    tCtx.beginPath();
    for(let i=0; i<drawLimit; i++) {
        let pt = activeTrajectory.path[i];
        let sx = pad + pt.t * scaleX;
        let sy = cy - pt.y * scaleY;
        if(i===0) tCtx.moveTo(sx, sy); else tCtx.lineTo(sx, sy);
    }
    tCtx.stroke();

    // Labels
    tCtx.fillStyle = '#89b4fa'; tCtx.fillText('x₁', pad + 10, 15);
    tCtx.fillStyle = '#f38ba8'; tCtx.fillText('x₂', pad + 30, 15);
}

// --- Integrator & Animation Loop ---
function integrateRK4(x0, y0, dt, timeSpan) {
    let path = [];
    let x = x0, y = y0, t = 0;
    
    while(t < timeSpan) {
        path.push({x, y, t});
        const f = (vx, vy) => ({ dx: A[0][0]*vx + A[0][1]*vy, dy: A[1][0]*vx + A[1][1]*vy });

        const k1 = f(x, y);
        const k2 = f(x + 0.5*dt*k1.dx, y + 0.5*dt*k1.dy);
        const k3 = f(x + 0.5*dt*k2.dx, y + 0.5*dt*k2.dy);
        const k4 = f(x + dt*k3.dx, y + dt*k3.dy);

        x += (dt / 6) * (k1.dx + 2*k2.dx + 2*k3.dx + k4.dx);
        y += (dt / 6) * (k1.dy + 2*k2.dy + 2*k3.dy + k4.dy);
        t += dt;

        if (Math.abs(x) > viewLimit * 15 || Math.abs(y) > viewLimit * 15) break; // Escape
    }
    return path;
}

function updateSystem() {
    getMatrix();
    analyzeStability();
    trajectories.forEach(t => t.currentIndex = t.path.length); // fast-forward existing
}

function animationLoop() {
    drawPhasePortrait();
    drawTimeGraph();
    requestAnimationFrame(animationLoop);
}

// --- Interaction Handling ---
phaseCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) { // Right click pan
        isPanning = true;
        startPanX = e.clientX - offsetX;
        startPanY = e.clientY - offsetY;
        return;
    }
    
    // Left click drop particle
    const rect = phaseCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const w = toWorld(mx, my);
    const path = integrateRK4(w.x, w.y, 0.05, 15); 
    
    const traj = { path, currentIndex: 1 };
    trajectories.push(traj);
    activeTrajectory = traj;
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        offsetX = e.clientX - startPanX;
        offsetY = e.clientY - startPanY;
    }
});
window.addEventListener('mouseup', () => isPanning = false);
phaseCanvas.addEventListener('contextmenu', e => e.preventDefault());

phaseCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    if (e.deltaY > 0) viewLimit *= zoomFactor;
    else viewLimit /= zoomFactor;
    viewLimit = Math.max(0.1, Math.min(viewLimit, 100)); // Clamp
});

// Start Application
updateSystem();
animationLoop();