/* ============================================================
   Cache Memory Simulator — script.js
   All simulation logic preserved; UI updated for new design.
   ============================================================ */

const MEM_SIZE   = 16;
const CACHE_SIZE = 4;

let cache    = [];
let timeStep = 0;   // Used for LRU / FIFO ordering
let stats    = { hits: 0, misses: 0, total: 0 };
let isRunning = false;

// DOM references
const memContainer  = document.getElementById('mainMemory');
const cacheContainer= document.getElementById('cacheMemory');
const logArea       = document.getElementById('logArea');
const breakdownEl   = document.getElementById('addressBreakdown');

/* ── Initialisation ── */
function init() {
    setupMemory();
    resetSimulator();
    document.getElementById('btnRun').addEventListener('click', runSequence);
    document.getElementById('btnReset').addEventListener('click', resetSimulator);
    // Re-apply set labels when mapping type changes without re-running
    document.getElementById('mappingType').addEventListener('change', applySetVisuals);
}

/* ── Build main memory blocks ── */
function setupMemory() {
    memContainer.innerHTML = '';
    for (let i = 0; i < MEM_SIZE; i++) {
        const div = document.createElement('div');
        div.className   = 'block';
        div.id          = `mem-${i}`;
        div.textContent = `Blk ${i}`;
        div.setAttribute('role', 'gridcell');
        div.setAttribute('aria-label', `Memory block ${i}`);
        memContainer.appendChild(div);
    }
}

/* ── Reset everything ── */
function resetSimulator() {
    cache    = [];
    timeStep = 0;
    stats    = { hits: 0, misses: 0, total: 0 };

    updateStatsUI();
    logArea.innerHTML     = '';
    breakdownEl.innerHTML = 'Waiting for input…';
    cacheContainer.innerHTML = '';

    document.querySelectorAll('.block')
            .forEach(b => b.classList.remove('highlight-mem'));

    for (let i = 0; i < CACHE_SIZE; i++) {
        cache.push({ valid: 0, tag: '-', data: '-', lastUsed: 0, loadedAt: 0 });

        const tr = document.createElement('tr');
        tr.id = `cache-line-${i}`;
        tr.innerHTML = `
            <td id="set-${i}">Line ${i}</td>
            <td id="valid-${i}">0</td>
            <td id="tag-${i}">—</td>
            <td id="data-${i}">—</td>
        `;
        cacheContainer.appendChild(tr);
    }
    applySetVisuals();
}

/* ── Apply set / line labels based on mapping ── */
function applySetVisuals() {
    const mapping = document.getElementById('mappingType').value;

    for (let i = 0; i < CACHE_SIZE; i++) {
        const tr = document.getElementById(`cache-line-${i}`);
        tr.classList.remove('set-divider');

        let setLabel;
        if (mapping === 'direct') {
            setLabel = `Index ${i}`;
        } else if (mapping === '2way') {
            const setNum = Math.floor(i / 2);
            setLabel = `Set ${setNum}, L${i % 2}`;
            if (i % 2 === 1) tr.classList.add('set-divider');
        } else {
            setLabel = `Line ${i}`;
        }
        document.getElementById(`set-${i}`).textContent = setLabel;
    }
}

/* ── Update stats display ── */
function updateStatsUI() {
    document.getElementById('statTotal').textContent   = stats.total;
    document.getElementById('statHits').textContent    = stats.hits;
    document.getElementById('statMisses').textContent  = stats.misses;

    const rate = stats.total === 0
        ? '0%'
        : `${((stats.hits / stats.total) * 100).toFixed(1)}%`;
    document.getElementById('statRate').textContent = rate;
}

/* ── Address decomposition ── */
function getMappingMath(address, mapping) {
    let index, tag;
    if (mapping === 'direct') {
        index = address % CACHE_SIZE;          // 4 lines → index into 4 slots
        tag   = Math.floor(address / CACHE_SIZE);
    } else if (mapping === '2way') {
        const numSets = CACHE_SIZE / 2;        // 2 sets of 2 lines each
        index = address % numSets;
        tag   = Math.floor(address / numSets);
    } else {
        // Fully associative: no index, tag = full address
        index = 0;
        tag   = address;
    }
    return { index, tag };
}

/* ── Run the full address sequence with animation delay ── */
async function runSequence() {
    if (isRunning) return;
    isRunning = true;

    // Disable controls during animation
    document.getElementById('btnRun').disabled = true;

    applySetVisuals();

    const inputStr  = document.getElementById('addressInput').value;
    const addresses = inputStr
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n));

    for (const addr of addresses) {
        await processAddress(addr);
        await delay(1200);
    }

    document.getElementById('btnRun').disabled = false;
    isRunning = false;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* ── Core simulation step ── */
async function processAddress(address) {
    if (address < 0 || address >= MEM_SIZE) {
        appendLog(`<span style="color:var(--red)">Invalid address: ${address} (must be 0–${MEM_SIZE - 1})</span>`);
        return;
    }

    timeStep++;
    const mapping = document.getElementById('mappingType').value;
    const policy  = document.getElementById('policyType').value;

    /* ── Reset visual highlights ── */
    document.querySelectorAll('.block')
            .forEach(b => b.classList.remove('highlight-mem'));
    document.querySelectorAll('#cacheMemory tr')
            .forEach(tr => tr.classList.remove('highlight-hit', 'highlight-evict'));

    /* ── Highlight accessed memory block ── */
    document.getElementById(`mem-${address}`).classList.add('highlight-mem');

    /* ── Decompose address ── */
    const { index, tag } = getMappingMath(address, mapping);

    /* ── Update address breakdown display ── */
    if (mapping === 'associative') {
        breakdownEl.innerHTML =
            `Address <strong>${address}</strong> → Tag: <strong>${tag}</strong> <span style="color:var(--text-muted)">(search all lines)</span>`;
    } else {
        breakdownEl.innerHTML =
            `Address <strong>${address}</strong> → Index: <strong>${index}</strong> &nbsp;|&nbsp; Tag: <strong>${tag}</strong>`;
    }

    /* ── Determine candidate lines ── */
    let startLine, endLine;
    if (mapping === 'direct') {
        startLine = index;
        endLine   = index + 1;
    } else if (mapping === '2way') {
        startLine = index * 2;
        endLine   = startLine + 2;
    } else {
        startLine = 0;
        endLine   = CACHE_SIZE;
    }

    let isHit     = false;
    let targetLine = -1;
    let evicted   = false;

    /* ── 1. Check for Cache Hit ── */
    for (let i = startLine; i < endLine; i++) {
        if (cache[i].valid === 1 && cache[i].tag === tag) {
            isHit      = true;
            targetLine = i;
            cache[i].lastUsed = timeStep;   // LRU update on hit
            break;
        }
    }

    /* ── 2. Handle Cache Miss ── */
    if (!isHit) {
        // Look for an empty (invalid) line first
        for (let i = startLine; i < endLine; i++) {
            if (cache[i].valid === 0) {
                targetLine = i;
                break;
            }
        }

        // If no empty line → apply replacement policy
        if (targetLine === -1) {
            evicted = true;
            const candidates = cache.slice(startLine, endLine);
            let victimIdx;

            if (policy === 'lru') {
                const minTime = Math.min(...candidates.map(c => c.lastUsed));
                victimIdx = candidates.findIndex(c => c.lastUsed === minTime);
            } else {
                // FIFO
                const minLoaded = Math.min(...candidates.map(c => c.loadedAt));
                victimIdx = candidates.findIndex(c => c.loadedAt === minLoaded);
            }
            targetLine = startLine + victimIdx;
        }

        // Load block into cache line
        cache[targetLine] = {
            valid: 1,
            tag,
            data: `Blk ${address}`,
            lastUsed: timeStep,
            loadedAt: timeStep
        };
    }

    /* ── Update statistics ── */
    stats.total++;
    if (isHit) stats.hits++;
    else        stats.misses++;
    updateStatsUI();

    /* ── Update cache table cells ── */
    document.getElementById(`valid-${targetLine}`).textContent = '1';
    document.getElementById(`tag-${targetLine}`).textContent   = tag;
    document.getElementById(`data-${targetLine}`).textContent  = `Blk ${address}`;

    /* ── Apply row highlight ── */
    const rowEl = document.getElementById(`cache-line-${targetLine}`);
    if (isHit) {
        rowEl.classList.add('highlight-hit');
    } else if (evicted) {
        rowEl.classList.add('highlight-evict');
    } else {
        rowEl.classList.add('highlight-hit');   // Cold miss shown as green load
    }

    /* ── Append to execution log ── */
    const outcome = isHit
        ? `<span class="hit-text">HIT ✓</span>`
        : `<span class="miss-text">MISS ✗</span>`;
    const evictNote = evicted
        ? ` <span style="color:var(--amber)">· evicted line ${targetLine}</span>`
        : '';

    appendLog(
        `Step&nbsp;${timeStep} &nbsp;|&nbsp; Addr:&nbsp;<strong>${address}</strong>`
        + ` &nbsp;|&nbsp; ${outcome}`
        + ` &nbsp;|&nbsp; Line:&nbsp;${targetLine}`
        + evictNote
    );
}

/* ── Prepend log entry (newest first) ── */
function appendLog(html) {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.innerHTML = html;
    logArea.insertBefore(div, logArea.firstChild);
}

/* ── Boot ── */
init();
