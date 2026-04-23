const inputs = {
    clk: document.getElementById('t-clk'), cq: document.getElementById('t-cq'),
    cmax: document.getElementById('t-cmax'), cmin: document.getElementById('t-cmin'),
    su: document.getElementById('t-su'), h: document.getElementById('t-h'),
    skew: document.getElementById('t-skew'), unc: document.getElementById('t-unc')
};

Object.values(inputs).forEach(input => input.addEventListener('input', calculateSTA));

let sweepInterval = null;
document.getElementById('btnSweep').addEventListener('click', (e) => {
    const btn = e.target;
    if (sweepInterval) { 
        clearInterval(sweepInterval); 
        sweepInterval = null; 
        btn.innerHTML = "Sweep T<sub>clk</sub> (Test Fmax)";
    } else {
        btn.innerHTML = "Stop Sweep";
        sweepInterval = setInterval(() => {
            let current = parseFloat(inputs.clk.value);
            if (current <= parseFloat(inputs.clk.min)) { clearInterval(sweepInterval); sweepInterval = null; btn.innerHTML = "Sweep T<sub>clk</sub> (Test Fmax)"; return; }
            inputs.clk.value = (current - 0.2).toFixed(1);
            calculateSTA();
        }, 100);
    }
});

function loadPreset(type) {
    if(type === 'safe') setValues(10, 1, 5, 2, 1, 1, 0, 0.5);
    if(type === 'setup_fail') setValues(10, 2, 8, 2, 1.5, 1, 0, 0.5);
    if(type === 'hold_fail') setValues(10, 1, 6, 0.5, 1, 2, 0, 0.5);
    calculateSTA();
}

function setValues(clk, cq, cmax, cmin, su, h, skew, unc) {
    inputs.clk.value = clk; inputs.cq.value = cq; inputs.cmax.value = cmax;
    inputs.cmin.value = cmin; inputs.su.value = su; inputs.h.value = h; 
    inputs.skew.value = skew; inputs.unc.value = unc;
}

function getSlackColor(slack) {
    if (slack < 0) return 'var(--fail-color)';
    if (slack <= 0.5) return 'var(--warn-color)';
    return 'var(--pass-color)';
}

function calculateSTA() {
    const v = {
        clk: parseFloat(inputs.clk.value), cq: parseFloat(inputs.cq.value),
        cmax: parseFloat(inputs.cmax.value), cmin: parseFloat(inputs.cmin.value),
        su: parseFloat(inputs.su.value), h: parseFloat(inputs.h.value), 
        skew: parseFloat(inputs.skew.value), unc: parseFloat(inputs.unc.value)
    };
    
    const pathMode = document.getElementById('pathToggle').value;

    // Update UI numbers
    for (const key in v) document.getElementById(`val-${key}`).innerText = v[key].toFixed(1);

    // Fmax Logic
    const required_tclk = v.cq + v.cmax + v.su - v.skew + v.unc;
    document.getElementById('fmax-val').innerText = required_tclk > 0 ? (1000 / required_tclk).toFixed(0) : "N/A";

    // Smart Delay Budget Bar Update
    const totalSetupTime = v.cq + v.cmax + v.su + v.unc;
    const updateBar = (id, val, label) => {
        const el = document.getElementById(id);
        const pct = (val/totalSetupTime)*100;
        el.style.width = `${pct}%`;
        el.title = `${label}: ${val}ns (${pct.toFixed(0)}%)`;
        // Hide text if the block is too thin to prevent overflow
        el.innerHTML = pct >= 8 ? `${val}ns` : '';
    };
    updateBar('bar-cq', v.cq, 'Tcq'); 
    updateBar('bar-cmax', v.cmax, 'Tc_max');
    updateBar('bar-su', v.su, 'Tsu'); 
    updateBar('bar-unc', v.unc, 'Uncertainty');

    // Math
    const suArr = v.cq + v.cmax;
    const suReq = v.clk + v.skew - v.su - v.unc;
    const suSlack = suReq - suArr;

    const hArr = v.cq + v.cmin;
    const hReq = v.skew + v.h + v.unc;
    const hSlack = hArr - hReq;

    // Constraint Evaluation Panels
    const suEval = document.getElementById('eq-su-eval');
    const suPanel = document.getElementById('panel-setup');
    if (suSlack < 0) {
        suEval.innerHTML = `<span style="color:var(--fail-color);">${suArr.toFixed(1)}ns &gt; ${(v.clk+v.skew).toFixed(1)}ns &rarr; VIOLATION</span>`;
        suPanel.className = 'constraint-panel violated-panel';
    } else {
        suEval.innerHTML = `<span style="color:var(--pass-color);">${suArr.toFixed(1)}ns &le; ${(v.clk+v.skew).toFixed(1)}ns &rarr; PASS</span>`;
        suPanel.className = 'constraint-panel passed-panel';
    }

    const hEval = document.getElementById('eq-h-eval');
    const hPanel = document.getElementById('panel-hold');
    if (hSlack < 0) {
        hEval.innerHTML = `<span style="color:var(--fail-color);">${hArr.toFixed(1)}ns &lt; ${(hReq).toFixed(1)}ns &rarr; VIOLATION</span>`;
        hPanel.className = 'constraint-panel violated-panel';
    } else {
        hEval.innerHTML = `<span style="color:var(--pass-color);">${hArr.toFixed(1)}ns &ge; ${(hReq).toFixed(1)}ns &rarr; PASS</span>`;
        hPanel.className = 'constraint-panel passed-panel';
    }

    // Toggle opacity based on select box
    document.getElementById('card-setup').style.opacity = (pathMode === 'hold') ? '0.3' : '1';
    document.getElementById('card-hold').style.opacity = (pathMode === 'setup') ? '0.3' : '1';

    // Update Value Cards
    const updateCard = (prefix, arr, req, slack) => {
        document.getElementById(`calc-${prefix}-arr`).innerText = arr.toFixed(2) + " ns";
        document.getElementById(`calc-${prefix}-req`).innerText = req.toFixed(2) + " ns";
        const slackEl = document.getElementById(`${prefix === 'su' ? 'setup' : 'hold'}-slack-val`);
        slackEl.innerText = (slack >= 0 ? "+" : "") + slack.toFixed(2) + " ns";
        slackEl.style.color = getSlackColor(slack);
    };
    updateCard('su', suArr, suReq, suSlack);
    updateCard('h', hArr, hReq, hSlack);
    
    drawWaveforms(v, suArr, hArr, suReq, hReq, suSlack, hSlack, pathMode);
}

function drawWaveforms(v, suArr, hArr, suReq, hReq, suSlack, hSlack, pathMode) {
    const svg = document.getElementById('timing-svg');
    const W = 1000; const H = 380;
    const maxTime = Math.max(v.clk * 2, suArr + 5, 25);
    const scale = (time) => (time / maxTime) * (W - 100) + 50;
    
    let html = `
        <defs>
            <pattern id="hash" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="10" stroke="#f38ba8" stroke-width="2" opacity="0.4"/>
            </pattern>
            <marker id="arrowHeadGreen" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="var(--pass-color)" />
            </marker>
            <marker id="arrowHeadRed" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="var(--fail-color)" />
            </marker>
        </defs>
        <text x="50" y="370" fill="#a6adc8" font-size="12" font-weight="bold">Time Axis (ns)</text>
        <line x1="50" y1="350" x2="${W-50}" y2="350" stroke="#6c7086" stroke-width="2"/>
    `;
    
    // Draw Axis grid ticks
    for(let i=0; i<=maxTime; i+=5) {
        let x = scale(i);
        html += `<line x1="${x}" y1="345" x2="${x}" y2="355" stroke="#cdd6f4"/>
                 <text x="${x}" y="370" fill="#cdd6f4" font-size="12" text-anchor="middle">${i}</text>`;
    }

    const makeClkPath = (offset, label, yBase) => {
        let path = `M ${scale(0)} ${yBase}`;
        let t = offset;
        while(t < maxTime) {
            path += ` L ${scale(t)} ${yBase} L ${scale(t)} ${yBase-40} L ${scale(t + v.clk/2)} ${yBase-40} L ${scale(t + v.clk/2)} ${yBase}`;
            t += v.clk;
        }
        return `<path d="${path}" fill="none" stroke="#89b4fa" stroke-width="2"/>
                <text x="50" y="${yBase-50}" fill="#89b4fa" font-size="14" font-weight="bold">${label}</text>`;
    };

    html += makeClkPath(0, "Launch Clock", 100);
    html += makeClkPath(v.skew, `Capture Clock (Skew: ${v.skew > 0 ? '+'+v.skew : v.skew}ns)`, 200);

    const capX = scale(v.clk + v.skew);
    const setupStartX = scale(suReq);
    const holdEndX = scale(hReq);

    // Setup Drawings
    if (pathMode !== 'hold') {
        html += `<line x1="${setupStartX}" y1="120" x2="${setupStartX}" y2="330" stroke="#f9e2af" stroke-dasharray="4,4"/>
                 <text x="${setupStartX-5}" y="140" fill="#f9e2af" font-size="12" text-anchor="end">Setup Limit</text>`;
        
        if (suSlack < 0) {
            html += `<rect x="${setupStartX}" y="235" width="${scale(suArr) - setupStartX}" height="30" fill="url(#hash)"/>`;
        } else {
            // Draw visual slack arrow
            html += `<line x1="${scale(suArr)+5}" y1="250" x2="${setupStartX-5}" y2="250" stroke="var(--pass-color)" stroke-width="2" marker-end="url(#arrowHeadGreen)"/>
                     <text x="${scale(suArr) + ((setupStartX - scale(suArr))/2)}" y="240" fill="var(--pass-color)" font-size="10" text-anchor="middle">Slack</text>`;
        }

        const arrMaxX = scale(suArr);
        const col = getSlackColor(suSlack);
        html += `<path d="M ${scale(0)} 290 L ${arrMaxX-5} 290 L ${arrMaxX} 250 L ${W-50} 250" fill="none" stroke="${col}" stroke-width="3"/>
                 <circle cx="${arrMaxX}" cy="270" r="5" fill="${col}"/>
                 <text x="${arrMaxX-10}" y="285" fill="${col}" font-size="12" text-anchor="end" font-weight="bold">Max Arrival: ${suArr.toFixed(1)}ns</text>`;
    }

    // Hold Drawings
    if (pathMode !== 'setup') {
        html += `<line x1="${holdEndX}" y1="120" x2="${holdEndX}" y2="330" stroke="#89dceb" stroke-dasharray="4,4"/>
                 <text x="${holdEndX+5}" y="140" fill="#89dceb" font-size="12">Hold Limit</text>`;
        
        if (hSlack < 0) {
            html += `<rect x="${scale(hArr)}" y="295" width="${holdEndX - scale(hArr)}" height="30" fill="url(#hash)"/>`;
        }

        const arrMinX = scale(hArr);
        const col = getSlackColor(hSlack);
        html += `<path d="M ${scale(0)} 330 L ${arrMinX-5} 330 L ${arrMinX} 290 L ${W-50} 290" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="6,4"/>
                 <circle cx="${arrMinX}" cy="310" r="5" fill="${col}"/>
                 <text x="${arrMinX+10}" y="325" fill="${col}" font-size="12" font-weight="bold">Min Arrival: ${hArr.toFixed(1)}ns</text>`;
    }

    // Capture Edge Reference Line
    html += `<line x1="${capX}" y1="150" x2="${capX}" y2="340" stroke="rgba(255,255,255,0.2)" stroke-dasharray="5,5" stroke-width="2"/>`;

    svg.innerHTML = html;
}

// Init
calculateSTA();