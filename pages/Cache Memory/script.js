const MEM_SIZE = 16;
const CACHE_SIZE = 4;

let cache = [];
let timeStep = 0; // Used for LRU/FIFO
let stats = { hits: 0, misses: 0, total: 0 };
let isRunning = false;

// DOM Elements
const memContainer = document.getElementById('mainMemory');
const cacheContainer = document.getElementById('cacheMemory');
const logArea = document.getElementById('logArea');
const breakdownEl = document.getElementById('addressBreakdown');

function init() {
    setupMemory();
    resetSimulator();
    document.getElementById('btnRun').addEventListener('click', runSequence);
    document.getElementById('btnReset').addEventListener('click', resetSimulator);
}

function setupMemory() {
    memContainer.innerHTML = '';
    for (let i = 0; i < MEM_SIZE; i++) {
        let div = document.createElement('div');
        div.className = 'block';
        div.id = `mem-${i}`;
        div.innerText = `Blk ${i}`;
        memContainer.appendChild(div);
    }
}

function resetSimulator() {
    cache = [];
    timeStep = 0;
    stats = { hits: 0, misses: 0, total: 0 };
    updateStatsUI();
    logArea.innerHTML = '';
    breakdownEl.innerHTML = 'Waiting for input...';
    cacheContainer.innerHTML = '';
    
    document.querySelectorAll('.block').forEach(b => b.classList.remove('highlight-mem'));

    for (let i = 0; i < CACHE_SIZE; i++) {
        cache.push({ valid: 0, tag: '-', data: '-', lastUsed: 0, loadedAt: 0 });
        let tr = document.createElement('tr');
        tr.id = `cache-line-${i}`;
        tr.innerHTML = `
            <td id="set-${i}">Line ${i}</td>
            <td id="valid-${i}">0</td>
            <td id="tag-${i}">-</td>
            <td id="data-${i}">-</td>
        `;
        cacheContainer.appendChild(tr);
    }
    applySetVisuals();
}

function applySetVisuals() {
    const mapping = document.getElementById('mappingType').value;
    for (let i = 0; i < CACHE_SIZE; i++) {
        let setLabel = `Line ${i}`;
        let tr = document.getElementById(`cache-line-${i}`);
        tr.classList.remove('set-divider');
        
        if (mapping === 'direct') {
            setLabel = `Index ${i}`;
        } else if (mapping === '2way') {
            let setNum = Math.floor(i / 2);
            setLabel = `Set ${setNum}, L${i%2}`;
            if (i % 2 === 1) tr.classList.add('set-divider');
        } else {
            setLabel = `Line ${i}`;
        }
        document.getElementById(`set-${i}`).innerText = setLabel;
    }
}

function updateStatsUI() {
    document.getElementById('statTotal').innerText = stats.total;
    document.getElementById('statHits').innerText = stats.hits;
    document.getElementById('statMisses').innerText = stats.misses;
    let rate = stats.total === 0 ? 0 : ((stats.hits / stats.total) * 100).toFixed(1);
    document.getElementById('statRate').innerText = `${rate}%`;
}

function getMappingMath(address, mapping) {
    let numSets, index, tag;
    if (mapping === 'direct') {
        numSets = CACHE_SIZE; // 4 sets
        index = address % numSets;
        tag = Math.floor(address / numSets);
    } else if (mapping === '2way') {
        numSets = CACHE_SIZE / 2; // 2 sets
        index = address % numSets;
        tag = Math.floor(address / numSets);
    } else {
        // Fully associative
        index = 0; 
        tag = address;
    }
    return { index, tag, numSets };
}

async function runSequence() {
    if (isRunning) return;
    isRunning = true;
    
    applySetVisuals();
    const inputStr = document.getElementById('addressInput').value;
    const addresses = inputStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    
    for (let i = 0; i < addresses.length; i++) {
        await processAddress(addresses[i]);
        await new Promise(r => setTimeout(r, 1200)); // 1.2s delay for animation effect
    }
    
    isRunning = false;
}

async function processAddress(address) {
    if (address < 0 || address >= MEM_SIZE) return;
    
    timeStep++;
    const mapping = document.getElementById('mappingType').value;
    const policy = document.getElementById('policyType').value;
    
    // UI Reset
    document.querySelectorAll('.block').forEach(b => b.classList.remove('highlight-mem'));
    document.querySelectorAll('tr').forEach(tr => {
        tr.classList.remove('highlight-hit', 'highlight-evict');
    });

    // Highlight memory
    document.getElementById(`mem-${address}`).classList.add('highlight-mem');

    const { index, tag } = getMappingMath(address, mapping);
    
    // Update Breakdown UI
    let breakdownText = `Address <strong>${address}</strong> &rarr; `;
    if (mapping === 'associative') breakdownText += `Tag: <strong>${tag}</strong> (Search all lines)`;
    else breakdownText += `Index: <strong>${index}</strong> | Tag: <strong>${tag}</strong>`;
    breakdownEl.innerHTML = breakdownText;

    // Determine lines to check based on mapping
    let startLine = 0;
    let endLine = CACHE_SIZE;
    if (mapping === 'direct') {
        startLine = index;
        endLine = index + 1;
    } else if (mapping === '2way') {
        startLine = index * 2;
        endLine = startLine + 2;
    }

    let isHit = false;
    let targetLine = -1;
    let evicted = false;

    // 1. Check for Hit
    for (let i = startLine; i < endLine; i++) {
        if (cache[i].valid === 1 && cache[i].tag === tag) {
            isHit = true;
            targetLine = i;
            cache[i].lastUsed = timeStep; // Update LRU
            break;
        }
    }

    // 2. Handle Miss
    if (!isHit) {
        // Look for empty line
        for (let i = startLine; i < endLine; i++) {
            if (cache[i].valid === 0) {
                targetLine = i;
                break;
            }
        }

        // If no empty line, apply Replacement Policy
        if (targetLine === -1) {
            evicted = true;
            let replaceCandidates = cache.slice(startLine, endLine);
            let victimIndex = 0;
            
            if (policy === 'lru') {
                let minTime = Math.min(...replaceCandidates.map(c => c.lastUsed));
                victimIndex = replaceCandidates.findIndex(c => c.lastUsed === minTime);
            } else { // FIFO
                let minLoaded = Math.min(...replaceCandidates.map(c => c.loadedAt));
                victimIndex = replaceCandidates.findIndex(c => c.loadedAt === minLoaded);
            }
            targetLine = startLine + victimIndex;
        }

        // Write to cache
        cache[targetLine] = { valid: 1, tag: tag, data: `Blk ${address}`, lastUsed: timeStep, loadedAt: timeStep };
    }

    // Update Stats
    stats.total++;
    if (isHit) stats.hits++;
    else stats.misses++;
    updateStatsUI();

    // Update UI Visuals
    const rowEl = document.getElementById(`cache-line-${targetLine}`);
    document.getElementById(`valid-${targetLine}`).innerText = '1';
    document.getElementById(`tag-${targetLine}`).innerText = tag;
    document.getElementById(`data-${targetLine}`).innerText = `Blk ${address}`;
    
    if (isHit) rowEl.classList.add('highlight-hit');
    else if (evicted) rowEl.classList.add('highlight-evict');
    else rowEl.classList.add('highlight-hit'); // Normal load looks like hit green for a moment

    // Log
    const logStr = `Step ${timeStep} | Addr: ${address} | <span class="${isHit?'hit-text':'miss-text'}">${isHit?'HIT':'MISS'}</span> | Line: ${targetLine} ${evicted ? `(Evicted old block)` : ''}`;
    logArea.innerHTML = `<div class="log-item">${logStr}</div>` + logArea.innerHTML;
}

init();