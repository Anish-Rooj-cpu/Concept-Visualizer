// --- Global State & Configuration ---
const NUM_HARMONICS = 9; // Number of frequencies
let state = {
    isPlaying: true,
    speed: 1,
    time: 0,
    showIdeal: false,
    hoveredHarmonic: -1, // For highlighting
    waveType: 'square'
};

// Physics/Math logic separated from rendering
let harmonics = [];
for (let i = 1; i <= NUM_HARMONICS; i++) {
    harmonics.push({ freq: i, amp: 0, phase: 0, idealAmp: 0 });
}

let waveHistory = [];

// --- DOM Elements ---
const timeCanvas = document.getElementById('timeCanvas');
const timeCtx = timeCanvas.getContext('2d');
const freqCanvas = document.getElementById('freqCanvas');
const freqCtx = freqCanvas.getContext('2d');
const equationBox = document.getElementById('math-equation');
const guideText = document.getElementById('dynamic-guide');

// --- Resize Handling ---
function resize() {
    const tw = timeCanvas.parentElement.clientWidth;
    const th = timeCanvas.parentElement.clientHeight;
    timeCanvas.width = tw; timeCanvas.height = th;

    const fw = freqCanvas.parentElement.clientWidth;
    const fh = freqCanvas.parentElement.clientHeight;
    freqCanvas.width = fw; freqCanvas.height = fh;
}
window.addEventListener('resize', resize);

// --- Wave Generators (Math Logic) ---
function generateWave(type) {
    state.waveType = type;
    document.getElementById('wave-selector').value = type;
    
    harmonics.forEach(h => {
        h.phase = 0; // Reset phase
        if (type === 'square') {
            h.amp = h.freq % 2 !== 0 ? 100 / h.freq : 0;
        } else if (type === 'sawtooth') {
            const sign = h.freq % 2 === 0 ? -1 : 1;
            h.amp = sign * (70 / h.freq);
        } else if (type === 'triangle') {
            const sign = (h.freq - 1) % 4 === 0 ? 1 : -1;
            h.amp = h.freq % 2 !== 0 ? sign * (100 / (h.freq * h.freq)) : 0;
        } else if (type === 'reset') {
            h.amp = 0;
        }
        h.idealAmp = h.amp; // Store ideal target for error comparison
    });
    
    waveHistory = [];
    updateUI(true); // Force full UI rebuild
    updateEquation();
}

// --- Dynamic Equation Builder ---
function updateEquation() {
    let eq = "f(t) = ";
    let terms = [];
    harmonics.forEach((h, i) => {
        if(Math.abs(h.amp) > 1) {
            let term = `<span style="${i === state.hoveredHarmonic ? 'color:#fff; font-weight:bold;' : ''}">`;
            term += `${Math.round(h.amp)}sin(${h.freq}t ${h.phase >= 0 ? '+' : ''}${parseFloat(h.phase).toFixed(1)})`;
            term += `</span>`;
            terms.push(term);
        }
    });
    equationBox.innerHTML = terms.length > 0 ? eq + terms.join(" + ") : "f(t) = 0 (No Signal)";
}

// --- UI Construction and Updates (Optimized) ---
const harmonicsContainer = document.getElementById('harmonics-container');

function updateUI(forceRebuild = false) {
    if (forceRebuild) {
        harmonicsContainer.innerHTML = '';
        harmonics.forEach((h, index) => {
            const row = document.createElement('div');
            row.className = 'harmonic-row';
            row.id = `h-row-${index}`;
            
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color:var(--accent-cyan)">${h.freq}x Harmonic</strong>
                </div>
                <div class="control-group">
                    <label>Amp</label>
                    <input type="range" id="amp-${index}" min="-150" max="150" value="${h.amp}">
                </div>
                <div class="control-group">
                    <label>Phs</label>
                    <input type="range" id="phs-${index}" min="-3.14" max="3.14" step="0.1" value="${h.phase}">
                </div>
            `;

            // Hover interactions for "What am I seeing?"
            row.addEventListener('mouseenter', () => setHoveredHarmonic(index));
            row.addEventListener('mouseleave', () => setHoveredHarmonic(-1));

            // Input interactions
            row.querySelector(`#amp-${index}`).addEventListener('input', (e) => {
                h.amp = parseFloat(e.target.value);
                document.getElementById('wave-selector').value = 'custom';
                waveHistory = []; updateEquation();
            });
            row.querySelector(`#phs-${index}`).addEventListener('input', (e) => {
                h.phase = parseFloat(e.target.value);
                document.getElementById('wave-selector').value = 'custom';
                waveHistory = []; updateEquation();
            });

            harmonicsContainer.appendChild(row);
        });
    } else {
        // Fast DOM update (only change values if needed)
        harmonics.forEach((h, index) => {
            document.getElementById(`amp-${index}`).value = h.amp;
            document.getElementById(`phs-${index}`).value = h.phase;
            
            const row = document.getElementById(`h-row-${index}`);
            if(index === state.hoveredHarmonic) row.classList.add('active');
            else row.classList.remove('active');
        });
    }
}

function setHoveredHarmonic(idx) {
    state.hoveredHarmonic = idx;
    updateUI(false);
    updateEquation();
    
    if(idx >= 0) {
        const h = harmonics[idx];
        guideText.innerHTML = `You are focusing on the <strong>${h.freq}x harmonic</strong>. <br>
        Frequency: ${h.freq} cycles per unit time.<br>
        Amplitude: ${Math.round(h.amp)} (determines radius of this circle).<br>
        Phase: ${parseFloat(h.phase).toFixed(1)} (shifts the wave left/right).`;
    } else {
        guideText.innerHTML = "Hover over a harmonic in the panel or frequency spectrum to see details.";
    }
}

// --- Interactive Canvas (Frequency Domain Dragging) ---
let isDraggingSpectrum = false;

freqCanvas.addEventListener('mousedown', (e) => handleSpectrumInteraction(e, true));
freqCanvas.addEventListener('mousemove', (e) => handleSpectrumInteraction(e, isDraggingSpectrum));
window.addEventListener('mouseup', () => { isDraggingSpectrum = false; });
freqCanvas.addEventListener('mouseleave', () => setHoveredHarmonic(-1));

function handleSpectrumInteraction(e, isUpdating) {
    const rect = freqCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const barWidth = freqCanvas.width / NUM_HARMONICS;
    const hoveredIdx = Math.floor(x / barWidth);
    
    if (hoveredIdx >= 0 && hoveredIdx < NUM_HARMONICS) {
        if(state.hoveredHarmonic !== hoveredIdx) setHoveredHarmonic(hoveredIdx);
        
        if (isUpdating) {
            isDraggingSpectrum = true;
            document.getElementById('wave-selector').value = 'custom';
            // Map Y coordinate to amplitude (-150 to 150)
            const midY = freqCanvas.height / 2;
            let newAmp = ((midY - y) / midY) * 150;
            // Snap to zero if close
            if(Math.abs(newAmp) < 5) newAmp = 0;
            
            harmonics[hoveredIdx].amp = newAmp;
            updateUI(false);
            updateEquation();
            waveHistory = []; // Reset trace
        }
    }
}

// --- Rendering Loop ---
function drawSpectrum() {
    freqCtx.clearRect(0, 0, freqCanvas.width, freqCanvas.height);
    const midY = freqCanvas.height / 2;
    const barWidth = freqCanvas.width / NUM_HARMONICS;

    // Draw Zero Line
    freqCtx.beginPath();
    freqCtx.moveTo(0, midY);
    freqCtx.lineTo(freqCanvas.width, midY);
    freqCtx.strokeStyle = 'rgba(255,255,255,0.2)';
    freqCtx.stroke();

    // Draw Bars
    harmonics.forEach((h, i) => {
        const x = i * barWidth + (barWidth * 0.2);
        const w = barWidth * 0.6;
        const h_px = (h.amp / 150) * midY; 

        freqCtx.fillStyle = i === state.hoveredHarmonic ? 'var(--accent-pink)' : 'var(--accent-cyan)';
        freqCtx.fillRect(x, midY, w, -h_px);
        
        // Label
        freqCtx.fillStyle = '#fff';
        freqCtx.font = '12px sans-serif';
        freqCtx.textAlign = 'center';
        freqCtx.fillText(`${h.freq}x`, x + w/2, freqCanvas.height - 10);
    });
}

function drawTimeDomain() {
    timeCtx.clearRect(0, 0, timeCanvas.width, timeCanvas.height);
    
    let x = timeCanvas.width * 0.25;
    let y = timeCanvas.height / 2;
    
    // Draw Zero line for time domain
    timeCtx.beginPath();
    timeCtx.moveTo(x, y);
    timeCtx.lineTo(timeCanvas.width, y);
    timeCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    timeCtx.stroke();

    for (let i = 0; i < harmonics.length; i++) {
        let prevx = x;
        let prevy = y;
        let h = harmonics[i];
        
        if (Math.abs(h.amp) < 0.1) continue; // Skip empty harmonics
        
        let radius = h.amp;
        let angle = h.freq * state.time + h.phase;
        
        x += radius * Math.cos(angle);
        y += radius * Math.sin(angle);
        
        // Visuals
        const isHovered = i === state.hoveredHarmonic;
        
        // Circle
        timeCtx.beginPath();
        timeCtx.arc(prevx, prevy, Math.abs(radius), 0, 2 * Math.PI);
        timeCtx.strokeStyle = isHovered ? 'var(--accent-pink)' : 'rgba(255, 255, 255, 0.15)';
        timeCtx.lineWidth = isHovered ? 2 : 1;
        timeCtx.stroke();
        
        // Spoke
        timeCtx.beginPath();
        timeCtx.moveTo(prevx, prevy);
        timeCtx.lineTo(x, y);
        timeCtx.strokeStyle = isHovered ? 'var(--accent-pink)' : 'rgba(255, 255, 255, 0.5)';
        timeCtx.stroke();
        
        // Node
        timeCtx.beginPath();
        timeCtx.arc(x, y, 3, 0, 2 * Math.PI);
        timeCtx.fillStyle = 'var(--accent-cyan)';
        timeCtx.fill();
    }
    
    // Add point to wave history
    if (state.isPlaying) {
        waveHistory.unshift(y);
    }
    
    const waveStartX = timeCanvas.width * 0.5;
    
    // Draw connecting line
    timeCtx.beginPath();
    timeCtx.moveTo(x, y);
    timeCtx.lineTo(waveStartX, waveHistory[0]);
    timeCtx.strokeStyle = 'var(--accent-yellow)';
    timeCtx.setLineDash([4, 4]);
    timeCtx.stroke();
    timeCtx.setLineDash([]);
    
    // Draw Actual Resulting Wave
    timeCtx.beginPath();
    timeCtx.moveTo(waveStartX, waveHistory[0]);
    for (let i = 1; i < waveHistory.length; i++) {
        timeCtx.lineTo(waveStartX + i * 2, waveHistory[i]);
    }
    timeCtx.strokeStyle = 'var(--accent-cyan)';
    timeCtx.lineWidth = 3;
    timeCtx.stroke();

    // Limit array memory
    if (waveHistory.length > (timeCanvas.width - waveStartX) / 2) {
        waveHistory.pop();
    }
}

function render() {
    if (state.isPlaying) {
        state.time -= 0.02 * state.speed;
    }
    
    drawSpectrum();
    drawTimeDomain();
    
    requestAnimationFrame(render);
}

// --- Top Bar Controls ---
document.getElementById('btn-play-pause').addEventListener('click', (e) => {
    state.isPlaying = !state.isPlaying;
    e.target.innerText = state.isPlaying ? "Pause ⏸" : "Play ▶";
    e.target.style.backgroundColor = state.isPlaying ? "var(--accent-cyan)" : "var(--accent-yellow)";
});

document.getElementById('speed-slider').addEventListener('input', (e) => {
    state.speed = parseFloat(e.target.value);
});

document.getElementById('wave-selector').addEventListener('change', (e) => {
    generateWave(e.target.value);
});

// --- Boot ---
resize();
generateWave('square');
requestAnimationFrame(render);