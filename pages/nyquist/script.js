// --- Complex Math & Polynomial Library ---
        class Complex {
            constructor(r, i) { this.r = r; this.i = i; }
            add(c) { return new Complex(this.r + c.r, this.i + c.i); }
            sub(c) { return new Complex(this.r - c.r, this.i - c.i); }
            mul(c) { return new Complex(this.r * c.r - this.i * c.i, this.r * c.i + this.i * c.r); }
            div(c) {
                const den = c.r * c.r + c.i * c.i;
                return new Complex((this.r * c.r + this.i * c.i) / den, (this.i * c.r - this.r * c.i) / den);
            }
            mag() { return Math.sqrt(this.r * this.r + this.i * this.i); }
        }

        function evalPoly(coeffs, s) {
            let res = new Complex(0, 0);
            let pow_s = new Complex(1, 0);
            const revCoeffs = [...coeffs].reverse();
            for (let i = 0; i < revCoeffs.length; i++) {
                res = res.add(new Complex(revCoeffs[i], 0).mul(pow_s));
                pow_s = pow_s.mul(s);
            }
            return res;
        }

        // Durand-Kerner Root Finder
        function findRoots(coeffs) {
            let degree = coeffs.length - 1;
            while (degree > 0 && coeffs[0] === 0) { coeffs.shift(); degree--; }
            if (degree <= 0) return [];

            const a_n = coeffs[0];
            const normCoeffs = coeffs.map(c => c / a_n);

            let roots = [];
            for (let i = 0; i < degree; i++) {
                let angle = (2 * Math.PI * i) / degree + 0.4;
                roots.push(new Complex(Math.cos(angle) * 2, Math.sin(angle) * 2));
            }

            for (let iter = 0; iter < 100; iter++) {
                let maxDiff = 0;
                let nextRoots = [];
                for (let i = 0; i < degree; i++) {
                    let p_val = evalPoly(normCoeffs, roots[i]);
                    let denom = new Complex(1, 0);
                    for (let j = 0; j < degree; j++) {
                        if (i !== j) denom = denom.mul(roots[i].sub(roots[j]));
                    }
                    if (denom.mag() < 1e-10) denom = new Complex(1e-10, 0);
                    let step = p_val.div(denom);
                    nextRoots.push(roots[i].sub(step));
                    maxDiff = Math.max(maxDiff, step.mag());
                }
                roots = nextRoots;
                if (maxDiff < 1e-6) break;
            }
            return roots;
        }

        function countRHP(roots) {
            return roots.filter(r => r.r > 1e-4).length; // >0 with slight tolerance
        }

        // --- System State ---
        let currentNum = [];
        let currentDen = [];
        let openLoopRoots = [];

        // --- DOM Elements ---
        const sCtx = document.getElementById('sCanvas').getContext('2d');
        const gCtx = document.getElementById('gCanvas').getContext('2d');
        const kSlider = document.getElementById('kSlider');
        const traceSlider = document.getElementById('traceSlider');
        const metricsReadout = document.getElementById('metricsReadout');

        function parseInputs() {
            currentNum = document.getElementById('numInput').value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
            currentDen = document.getElementById('denInput').value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
            if (currentNum.length === 0) currentNum = [1];
            if (currentDen.length === 0) currentDen = [1, 1];
            openLoopRoots = findRoots(currentDen);
        }

        function getCharacteristicPoly(K) {
            const maxLen = Math.max(currentNum.length, currentDen.length);
            const padNum = Array(maxLen - currentNum.length).fill(0).concat(currentNum);
            const padDen = Array(maxLen - currentDen.length).fill(0).concat(currentDen);
            return padDen.map((d, i) => d + K * padNum[i]);
        }

        function evalG(w, K) {
            const s = new Complex(0, w);
            const N_s = evalPoly(currentNum, s).mul(new Complex(K, 0));
            const D_s = evalPoly(currentDen, s);

            // Prevent division by exactly zero (poles on jw axis)
            if (D_s.mag() < 1e-6) return new Complex(10000, 10000);

            return N_s.div(D_s);
        }

        // --- Drawing Routines ---
        function drawSPlane(currentW) {
            const width = 300, height = 400;
            const cx = width / 2;
            const cy = height / 2;
            const scale = 30; // 30px per unit

            sCtx.clearRect(0, 0, width, height);

            // Shaded RHP
            sCtx.fillStyle = 'rgba(243, 139, 168, 0.05)';
            sCtx.fillRect(cx, 0, width - cx, height);

            // Axes
            sCtx.strokeStyle = '#45475a'; sCtx.lineWidth = 1;
            sCtx.beginPath();
            sCtx.moveTo(0, cy); sCtx.lineTo(width, cy); // Real
            sCtx.moveTo(cx, 0); sCtx.lineTo(cx, height); // Imag
            sCtx.stroke();
            sCtx.fillStyle = '#a6adc8'; sCtx.font = '12px sans-serif';
            sCtx.fillText('jω', cx + 5, 15);
            sCtx.fillText('σ', width - 15, cy - 5);

            // Open-Loop Poles
            sCtx.lineWidth = 2;
            openLoopRoots.forEach(p => {
                const px = cx + p.r * scale;
                const py = cy - p.i * scale;
                sCtx.strokeStyle = p.r > 0 ? '#f38ba8' : '#cdd6f4'; // Pink if RHP, White if LHP
                sCtx.beginPath();
                sCtx.moveTo(px - 4, py - 4); sCtx.lineTo(px + 4, py + 4);
                sCtx.moveTo(px + 4, py - 4); sCtx.lineTo(px - 4, py + 4);
                sCtx.stroke();
            });

            // D-Contour Path
            sCtx.strokeStyle = 'rgba(137, 180, 250, 0.4)'; sCtx.lineWidth = 4;
            sCtx.beginPath(); sCtx.moveTo(cx, height); sCtx.lineTo(cx, 0); sCtx.stroke();
            sCtx.beginPath(); sCtx.arc(cx, cy, 140, -Math.PI / 2, Math.PI / 2, false); sCtx.stroke();

            // Tracer
            sCtx.fillStyle = '#f9e2af';
            let tracerY = cy - currentW * scale;
            if (tracerY < 10) tracerY = 10;
            if (tracerY > height - 10) tracerY = height - 10;

            sCtx.beginPath(); sCtx.arc(cx, tracerY, 6, 0, Math.PI * 2); sCtx.fill();
            sCtx.strokeStyle = '#181825'; sCtx.lineWidth = 1; sCtx.stroke();
        }

        function drawGPlane(K, currentW) {
            const width = 400, height = 400;
            const cx = width * 0.7; // Shift right to see LHP better
            const cy = height / 2;

            // Auto-scale logic: sample curve to find max bounds, ensuring -1 is visible
            let maxVal = 1.5;
            for (let w = 0.01; w < 100; w *= 1.2) {
                let mag = evalG(w, K).mag();
                if (mag > maxVal && mag < 50) maxVal = mag; // Ignore asymptotes > 50
            }
            const scale = (cx - 40) / maxVal;

            gCtx.clearRect(0, 0, width, height);

            // Axes
            gCtx.strokeStyle = '#45475a'; gCtx.lineWidth = 1;
            gCtx.beginPath();
            gCtx.moveTo(0, cy); gCtx.lineTo(width, cy); // Real
            gCtx.moveTo(cx, 0); gCtx.lineTo(cx, height); // Imag
            gCtx.stroke();
            gCtx.fillStyle = '#a6adc8'; gCtx.font = '12px sans-serif';
            gCtx.fillText('Im', cx + 5, 15);
            gCtx.fillText('Re', width - 20, cy - 5);

            // Critical Point (-1, 0)
            const critX = cx - 1 * scale;
            gCtx.strokeStyle = '#f38ba8'; gCtx.lineWidth = 2;
            gCtx.beginPath();
            gCtx.moveTo(critX - 6, cy - 6); gCtx.lineTo(critX + 6, cy + 6);
            gCtx.moveTo(critX + 6, cy - 6); gCtx.lineTo(critX - 6, cy + 6);
            gCtx.stroke();
            gCtx.fillStyle = '#f38ba8'; gCtx.fillText('-1', critX - 15, cy - 10);

            // Draw Nyquist Curve High-Res
            const drawBranch = (isNegative) => {
                gCtx.beginPath();
                gCtx.strokeStyle = isNegative ? '#cba6f7' : '#a6e3a1';
                gCtx.lineWidth = 2;
                if (isNegative) gCtx.setLineDash([5, 5]); else gCtx.setLineDash([]);

                let startW = isNegative ? -0.01 : 0.01;
                let endW = isNegative ? -1000 : 1000;

                // Use logarithmic spacing for smooth curves across decades
                let points = [];
                for (let exp = -2; exp <= 3; exp += 0.02) {
                    let w = Math.pow(10, exp) * (isNegative ? -1 : 1);
                    let G = evalG(w, K);
                    points.push({ x: cx + G.r * scale, y: cy - G.i * scale });
                }

                gCtx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    // Prevent drawing lines to infinity if pole is on axis
                    if (Math.abs(points[i].x - points[i - 1].x) > 500 || Math.abs(points[i].y - points[i - 1].y) > 500) {
                        gCtx.moveTo(points[i].x, points[i].y);
                    } else {
                        gCtx.lineTo(points[i].x, points[i].y);
                    }
                }
                gCtx.stroke();
                gCtx.setLineDash([]);
            };

            drawBranch(false); // Positive frequencies
            drawBranch(true);  // Negative frequencies

            // Draw Tracer
            let G = evalG(currentW, K);
            let tX = cx + G.r * scale;
            let tY = cy - G.i * scale;

            // Clamp tracer visually if it shoots off canvas
            tX = Math.max(-10, Math.min(width + 10, tX));
            tY = Math.max(-10, Math.min(height + 10, tY));

            gCtx.fillStyle = '#f9e2af';
            gCtx.beginPath(); gCtx.arc(tX, tY, 6, 0, Math.PI * 2); gCtx.fill();
            gCtx.strokeStyle = '#181825'; gCtx.lineWidth = 1; gCtx.stroke();
        }

        function updateUI() {
            const K = parseFloat(kSlider.value);
            const currentW = parseFloat(traceSlider.value);

            document.getElementById('kValDisplay').innerText = K.toFixed(1);
            document.getElementById('wValDisplay').innerText = `ω = ${currentW.toFixed(1)} rad/s`;

            drawSPlane(currentW);
            drawGPlane(K, currentW);

            // --- Robust Stability Analysis via Roots ---
            const P = countRHP(openLoopRoots);

            const charPoly = getCharacteristicPoly(K);
            const closedLoopRoots = findRoots(charPoly);
            const Z = countRHP(closedLoopRoots);

            // N = Z - P
            const N = Z - P;

            let statusHTML = "";
            if (Z === 0) {
                statusHTML = `<span class="highlight-stable">SYSTEM STABLE</span><br>All closed-loop roots are in the Left-Half Plane.`;
            } else {
                statusHTML = `<span class="highlight-unstable">SYSTEM UNSTABLE</span><br>
                ${Z} closed-loop poles are in the Right-Half Plane.`;
            }

            metricsReadout.innerHTML = `
                <div><strong>Open-Loop Unstable Poles (P):</strong> ${P}</div>
                <div><strong>Clockwise Encirclements of -1 (N):</strong> <span style="color:var(--accent-yellow)">${N}</span></div>
                <div style="margin: 10px 0; border-top: 1px solid var(--border-color);"></div>
                <div><strong>Closed-Loop Unstable Poles (Z):</strong> Z = N + P = <span class="highlight">${Z}</span></div>
                <br>
                ${statusHTML}
            `;
        }

        function updateSystem() {
            parseInputs();
            updateUI();
        }

        // Setup Event Listeners
        kSlider.addEventListener('input', updateUI);
        traceSlider.addEventListener('input', updateUI);

        // Trigger update on Enter key in inputs
        document.getElementById('numInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') updateSystem(); });
        document.getElementById('denInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') updateSystem(); });

        // Initial Initialization
        updateSystem();