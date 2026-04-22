const canvas = document.getElementById('butterflyCanvas');
const ctx = canvas.getContext('2d');
const selectN = document.getElementById('fft-size');

let N = 8;
let stages = 3;
let nodes = []; // 2D array: nodes[stage][index]
let edges = []; // Array of edge objects
let hoveredNode = null;

// Theme Configuration
const Theme = {
    bg: '#000000',
    nodeNorm: '#0ea5e9',
    nodeHover: '#ec4899',
    lineNorm: '#3f3f46',
    lineHover: '#ec4899',
    twiddle: '#eab308',
    textNorm: '#a1a1aa',
    textHover: '#ffffff',
    subLine: '#ef4444' // Red for the -1 subtraction path
};

// Utility: Bit Reversal (used for input ordering)
function reverseBits(val, bits) {
    let res = 0;
    for (let i = 0; i < bits; i++) {
        res = (res << 1) | (val & 1);
        val >>= 1;
    }
    return res;
}

// Build Graph Structure
function buildGraph() {
    stages = Math.log2(N);
    nodes = [];
    edges = [];

    // Create Nodes
    for (let s = 0; s <= stages; s++) {
        nodes[s] = [];
        for (let i = 0; i < N; i++) {
            nodes[s].push({
                stage: s,
                index: i,
                x: 0, y: 0, // Calculated during resize
                isActive: false,
                label: s === 0 ? `x[${reverseBits(i, stages)}]` : (s === stages ? `X[${i}]` : null)
            });
        }
    }

    // Create Edges (Cooley-Tukey Decimation-in-Time logic)
    for (let s = 1; s <= stages; s++) {
        let size = Math.pow(2, s);
        let halfSize = size / 2;
        
        for (let i = 0; i < N; i += size) {
            for (let j = 0; j < halfSize; j++) {
                let topIdx = i + j;
                let botIdx = i + j + halfSize;
                
                let twiddlePower = j * (N / size); 
                let twiddleStr = `W_${N}^${twiddlePower}`;

                // Top Butterfly Output
                edges.push({
                    from: nodes[s - 1][topIdx], to: nodes[s][topIdx],
                    isCross: false, isMult: false, isSub: false, isActive: false
                });
                edges.push({
                    from: nodes[s - 1][botIdx], to: nodes[s][topIdx],
                    isCross: true, isMult: true, twiddle: twiddleStr, isSub: false, isActive: false
                });

                // Bottom Butterfly Output
                edges.push({
                    from: nodes[s - 1][topIdx], to: nodes[s][botIdx],
                    isCross: true, isMult: false, isSub: false, isActive: false
                });
                edges.push({
                    from: nodes[s - 1][botIdx], to: nodes[s][botIdx],
                    isCross: false, isMult: true, twiddle: twiddleStr, isSub: true, isActive: false
                });
            }
        }
    }
}

// Calculate Canvas Layout
function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    updateLayout(rect.width, rect.height);
    draw();
}

function updateLayout(w, h) {
    const paddingX = 80;
    const paddingY = 60;
    const stageWidth = (w - paddingX * 2) / stages;
    const nodeHeight = (h - paddingY * 2) / (N - 1);

    for (let s = 0; s <= stages; s++) {
        for (let i = 0; i < N; i++) {
            nodes[s][i].x = paddingX + s * stageWidth;
            nodes[s][i].y = paddingY + i * nodeHeight;
        }
    }
}

// Hover Dependency Tracing
function clearActive() {
    nodes.forEach(col => col.forEach(n => n.isActive = false));
    edges.forEach(e => e.isActive = false);
}

function traceDependencies(node) {
    node.isActive = true;
    if (node.stage === 0) return;

    edges.forEach(e => {
        if (e.to === node) {
            e.isActive = true;
            traceDependencies(e.from); // Recursive trace backward
        }
    });
}

// Mouse Interaction
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let found = null;
    for (let s = 0; s <= stages; s++) {
        for (let i = 0; i < N; i++) {
            let node = nodes[s][i];
            // Hitbox check
            if (Math.hypot(node.x - x, node.y - y) < 15) {
                found = node;
                break;
            }
        }
    }

    if (found !== hoveredNode) {
        hoveredNode = found;
        clearActive();
        if (hoveredNode) traceDependencies(hoveredNode);
        draw();
    }
});

canvas.addEventListener('mouseleave', () => {
    hoveredNode = null;
    clearActive();
    draw();
});

// Render Loop
function draw() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    // Draw Edges
    edges.forEach(e => {
        ctx.beginPath();
        ctx.moveTo(e.from.x, e.from.y);
        ctx.lineTo(e.to.x, e.to.y);
        
        ctx.lineWidth = e.isActive ? 3 : 1.5;
        
        if (e.isActive) {
            ctx.strokeStyle = Theme.lineHover;
            ctx.setLineDash([]);
        } else {
            if (e.isSub) ctx.strokeStyle = Theme.subLine; // Red for subtraction
            else ctx.strokeStyle = Theme.lineNorm;
            if (e.isMult) ctx.setLineDash([5, 5]); // Dashed for twiddle multiply
            else ctx.setLineDash([]);
        }
        
        ctx.stroke();

        // Draw Twiddle Factors
        if (e.isMult && (e.isActive || N <= 8)) {
            let mx = e.from.x + (e.to.x - e.from.x) * 0.75;
            let my = e.from.y + (e.to.y - e.from.y) * 0.75;
            
            ctx.fillStyle = e.isActive ? Theme.textHover : Theme.twiddle;
            ctx.font = e.isActive ? 'bold 12px sans-serif' : '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(e.twiddle, mx, my - 5);
            
            if(e.isSub) {
                ctx.fillStyle = Theme.subLine;
                ctx.fillText("-1", mx, my + 15);
            }
        }
    });
    ctx.setLineDash([]); // reset

    // Draw Nodes
    for (let s = 0; s <= stages; s++) {
        for (let i = 0; i < N; i++) {
            let node = nodes[s][i];
            
            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.isActive ? 6 : 4, 0, Math.PI * 2);
            ctx.fillStyle = node.isActive ? Theme.nodeHover : Theme.nodeNorm;
            ctx.fill();

            // Labels for inputs and outputs
            if (node.label) {
                ctx.fillStyle = node.isActive ? Theme.textHover : Theme.textNorm;
                ctx.font = node.isActive ? 'bold 14px monospace' : '12px monospace';
                ctx.textBaseline = 'middle';
                if (s === 0) {
                    ctx.textAlign = 'right';
                    ctx.fillText(node.label, node.x - 15, node.y);
                } else {
                    ctx.textAlign = 'left';
                    ctx.fillText(node.label, node.x + 15, node.y);
                }
            }
        }
        
        // Stage Labels
        ctx.fillStyle = Theme.textNorm;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        let stageLabel = s === 0 ? "Input" : (s === stages ? "Output" : `Stage ${s}`);
        ctx.fillText(stageLabel, nodes[s][0].x, 20);
    }
}

// Event Listeners
selectN.addEventListener('change', (e) => {
    N = parseInt(e.target.value);
    buildGraph();
    resize();
});
window.addEventListener('resize', resize);

// Initialization
buildGraph();
resize();