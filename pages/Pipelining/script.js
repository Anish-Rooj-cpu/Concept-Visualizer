// Architecture Setup
const NUM_REGISTERS = 8;
let registers = Array(NUM_REGISTERS).fill(0);
let instructions = [];
let pipeline = { IF: null, ID: null, EX: null, MEM: null, WB: null };
let cycle = 0;
let completed = 0;
let isAutoRunning = false;
let autoRunInterval = null;

// DOM Elements
const hwIF = document.getElementById('hw-if');
const hwID = document.getElementById('hw-id');
const hwEX = document.getElementById('hw-ex');
const hwMEM = document.getElementById('hw-mem');
const hwWB = document.getElementById('hw-wb');
const pipelineBody = document.getElementById('pipelineBody');
const cycleHeaderRow = document.getElementById('cycleHeaderRow');
const regGrid = document.getElementById('registerGrid');

// Scenarios
const scenarios = {
    raw: `ADD R1, R2, R3\nSUB R4, R1, R5\nLW R6, 0(R1)\nADD R7, R6, R2`,
    forwarding: `ADD R1, R2, R3\nSUB R4, R1, R5\nLW R6, 0(R1)\nADD R7, R6, R2`,
    control: `ADD R1, R2, R3\nBEQ R1, R2, 2\nSUB R4, R1, R5\nLW R6, 0(R1)`,
    ideal: `ADD R1, R2, R3\nSUB R4, R5, R6\nLW R7, 0(R0)\nADD R2, R4, R1`
};

function loadScenario() {
    const val = document.getElementById('scenarioSelect').value;
    document.getElementById('instructionInput').value = scenarios[val];
    
    if(val === 'forwarding') {
        document.getElementById('enableForwarding').checked = true;
    } else {
        document.getElementById('enableForwarding').checked = false;
    }
}

// Instruction Parser
function parseInstructionText(text, id) {
    const parts = text.replace(/,/g, '').trim().split(/\s+/);
    if(parts.length < 2) return null;
    
    const op = parts[0].toUpperCase();
    let dest = null, src1 = null, src2 = null;

    if (['ADD', 'SUB'].includes(op)) {
        dest = parts[1]; src1 = parts[2]; src2 = parts[3];
    } else if (op === 'LW') {
        dest = parts[1];
        // Parse "0(R1)" format
        const match = parts[2] ? parts[2].match(/.*\((R\d+)\)/i) : null;
        if(match) src1 = match[1];
    } else if (op === 'SW') {
        src1 = parts[1]; // Value to store
        const match = parts[2] ? parts[2].match(/.*\((R\d+)\)/i) : null;
        if(match) src2 = match[1]; // Base address
    } else if (op === 'BEQ') {
        src1 = parts[1]; src2 = parts[2]; dest = null; // No destination
    }

    return { 
        id: id,
        text: text,
        op: op,
        dest: dest,
        src1: src1,
        src2: src2,
        history: [] // cycle -> stage string
    };
}

function loadInstructions() {
    const rawText = document.getElementById('instructionInput').value;
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    instructions = [];
    lines.forEach((line, index) => {
        const inst = parseInstructionText(line, index);
        if(inst) instructions.push(inst);
    });

    // Reset State
    pipeline = { IF: null, ID: null, EX: null, MEM: null, WB: null };
    cycle = 0;
    completed = 0;
    registers = [0, 5, 10, 15, 20, 25, 30, 35]; // Initialize with some dummy values
    
    if(isAutoRunning) toggleAutoRun();
    
    updateUI();
}

function checkHazards(idInst) {
    if(!idInst) return { stall: false, type: null };
    
    const useForwarding = document.getElementById('enableForwarding').checked;
    const exInst = pipeline.EX;
    const memInst = pipeline.MEM;

    // RAW Hazard Detection
    const checkRAW = (writingInst) => {
        if(!writingInst || !writingInst.dest) return false;
        return (writingInst.dest === idInst.src1 || writingInst.dest === idInst.src2);
    };

    if (checkRAW(exInst)) {
        if (!useForwarding) return { stall: true, type: 'RAW (Wait for WB)' };
        // Load-Use Hazard even with forwarding
        if (exInst.op === 'LW') return { stall: true, type: 'Load-Use Bubble' };
        return { stall: false, type: 'Forwarded EX->EX' };
    }
    
    if (checkRAW(memInst)) {
        if (!useForwarding) return { stall: true, type: 'RAW (Wait for WB)' };
        return { stall: false, type: 'Forwarded MEM->EX' };
    }

    return { stall: false, type: null };
}

function stepCycle() {
    if (completed === instructions.length && instructions.length > 0) return; // Done
    cycle++;

    // Process Pipeline backwards
    
    // 5. Write Back (WB)
    if (pipeline.WB) {
        if (pipeline.WB.dest && pipeline.WB.op !== 'BEQ' && pipeline.WB.op !== 'SW') {
            const regIdx = parseInt(pipeline.WB.dest.replace('R', ''));
            if (!isNaN(regIdx)) registers[regIdx] += 1; // Fake calc for visual change
        }
        pipeline.WB.history[cycle] = 'WB';
        completed++;
        pipeline.WB = null;
    }

    // 4. Memory (MEM)
    if (pipeline.MEM) {
        pipeline.MEM.history[cycle] = 'MEM';
        pipeline.WB = pipeline.MEM;
        pipeline.MEM = null;
    }

    // 3. Execute (EX)
    let branchFlushed = false;
    if (pipeline.EX) {
        pipeline.EX.history[cycle] = 'EX';
        
        // Resolve Branch in EX
        if (pipeline.EX.op === 'BEQ') {
            // Simulate branch taken (for visualizer, we'll force taken if scenario is control)
            const scenario = document.getElementById('scenarioSelect').value;
            if(scenario === 'control') {
                branchFlushed = true;
                // Flush IF and ID
                if(pipeline.IF) pipeline.IF.history[cycle] = 'STALL (Flush)';
                if(pipeline.ID) pipeline.ID.history[cycle] = 'STALL (Flush)';
                pipeline.IF = null;
                pipeline.ID = null;
            }
        }
        
        pipeline.MEM = pipeline.EX;
        pipeline.EX = null;
    }

    // 2. Decode (ID)
    let idStalled = false;
    if (pipeline.ID && !branchFlushed) {
        const hazard = checkHazards(pipeline.ID);
        
        if (hazard.stall) {
            idStalled = true;
            pipeline.ID.history[cycle] = 'STALL';
            pipeline.EX = null; // Insert Bubble
        } else {
            pipeline.ID.history[cycle] = 'ID';
            pipeline.EX = pipeline.ID;
            pipeline.ID = null;
        }
    } else if (branchFlushed && pipeline.ID) {
        pipeline.ID = null;
    } else if (!pipeline.ID) {
        pipeline.EX = null; // Pass bubble
    }

    // 1. Fetch (IF)
    if (!idStalled && !branchFlushed) {
        if (pipeline.IF) {
            pipeline.IF.history[cycle] = 'IF';
            pipeline.ID = pipeline.IF;
            pipeline.IF = null;
        }
        
        // Fetch next
        const nextInstIdx = instructions.findIndex(inst => inst.history.length === 0);
        if (nextInstIdx !== -1) {
            pipeline.IF = instructions[nextInstIdx];
        }
    } else if (pipeline.IF) {
        // IF is stalled because ID is stalled
        pipeline.IF.history[cycle] = 'STALL';
    }

    updateUI();
}

// UI Updating
function updateUI() {
    // Update Hardware Diagram
    hwIF.innerText = pipeline.IF ? pipeline.IF.text : 'Bubble / Empty';
    hwID.innerText = pipeline.ID ? pipeline.ID.text : 'Bubble / Empty';
    hwEX.innerText = pipeline.EX ? pipeline.EX.text : 'Bubble / Empty';
    hwMEM.innerText = pipeline.MEM ? pipeline.MEM.text : 'Bubble / Empty';
    hwWB.innerText = pipeline.WB ? pipeline.WB.text : 'Bubble / Empty';

    // Update Space-Time Table Headers
    cycleHeaderRow.innerHTML = '<th>Instruction</th>';
    for (let c = 1; c <= Math.max(cycle, 1); c++) {
        const th = document.createElement('th');
        th.innerText = `C${c}`;
        if (c === cycle) th.className = 'active-cycle';
        cycleHeaderRow.appendChild(th);
    }

    // Update Space-Time Table Body
    pipelineBody.innerHTML = '';
    instructions.forEach(inst => {
        const tr = document.createElement('tr');
        
        const tdName = document.createElement('td');
        tdName.className = 'inst-col';
        tdName.innerText = inst.text;
        tr.appendChild(tdName);

        for (let c = 1; c <= Math.max(cycle, 1); c++) {
            const td = document.createElement('td');
            const state = inst.history[c];
            if (state) {
                if (state.includes('STALL')) {
                    td.className = 'stage-STALL';
                    td.innerText = 'NOP';
                    td.title = state;
                } else {
                    td.className = `stage-${state}`;
                    td.innerText = state;
                }
            }
            tr.appendChild(td);
        }
        pipelineBody.appendChild(tr);
    });

    // Update Registers
    regGrid.innerHTML = '';
    registers.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'register-box';
        
        // Highlight logic
        if (pipeline.WB && pipeline.WB.dest === `R${idx}`) box.classList.add('updated');
        if (pipeline.ID && (pipeline.ID.src1 === `R${idx}` || pipeline.ID.src2 === `R${idx}`)) box.classList.add('read');

        box.innerHTML = `<div class="reg-name">R${idx}</div><div class="reg-val">${val}</div>`;
        regGrid.appendChild(box);
    });

    // Update Stats
    document.getElementById('cycleCount').innerText = cycle;
    document.getElementById('completedCount').innerText = completed;
    
    const cpi = completed > 0 ? (cycle / completed).toFixed(2) : "0.00";
    document.getElementById('cpiValue').innerText = cpi;
}

// Auto Run Logic
function toggleAutoRun() {
    const btn = document.getElementById('autoBtn');
    if (isAutoRunning) {
        clearInterval(autoRunInterval);
        isAutoRunning = false;
        btn.innerText = "Auto-Run ▶";
        btn.style.backgroundColor = "var(--secondary)";
    } else {
        isAutoRunning = true;
        btn.innerText = "Pause ⏸";
        btn.style.backgroundColor = "#ff5252";
        autoRunInterval = setInterval(() => {
            stepCycle();
            if (completed === instructions.length) toggleAutoRun();
        }, 1000);
    }
}

// Init
window.onload = () => {
    loadScenario();
    loadInstructions();
};