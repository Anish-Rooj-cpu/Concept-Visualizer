const waveCanvas = document.getElementById('waveCanvas');
        const waveCtx = waveCanvas.getContext('2d');
        const freqCanvas = document.getElementById('freqCanvas');
        const freqCtx = freqCanvas.getContext('2d');

        const fSigSlider = document.getElementById('fSigSlider');
        const fsSlider = document.getElementById('fsSlider');
        const metricsReadout = document.getElementById('metricsReadout');

        // Layout Constants
        const padding = 30;
        const width = waveCanvas.width;
        const height = waveCanvas.height;
        const plotWidth = width - padding * 2;
        const plotHeight = height - padding * 2;
        const centerY = height / 2;
        const duration = 1.0;
        const maxFreqPlot = 70; // Plot x-axis from -70 to +70 Hz

        function drawTimeAxes() {
            waveCtx.strokeStyle = '#45475a'; waveCtx.lineWidth = 1;
            waveCtx.beginPath(); waveCtx.moveTo(padding, centerY); waveCtx.lineTo(width - padding, centerY); waveCtx.stroke();
            waveCtx.beginPath(); waveCtx.moveTo(padding, padding); waveCtx.lineTo(padding, height - padding); waveCtx.stroke();
            waveCtx.fillStyle = '#a6adc8'; waveCtx.font = '11px sans-serif';
            waveCtx.fillText('Time (t) → 1 sec', width - padding - 80, centerY + 15);
        }

        function drawFreqAxes() {
            freqCtx.strokeStyle = '#45475a'; freqCtx.lineWidth = 1;
            // X-axis (0 is in the middle)
            freqCtx.beginPath(); freqCtx.moveTo(padding, height - padding); freqCtx.lineTo(width - padding, height - padding); freqCtx.stroke();
            // Y-axis (Magnitude)
            const midX = padding + plotWidth / 2;
            freqCtx.beginPath(); freqCtx.moveTo(midX, padding); freqCtx.lineTo(midX, height - padding); freqCtx.stroke();

            freqCtx.fillStyle = '#a6adc8'; freqCtx.font = '11px sans-serif';
            freqCtx.fillText('Freq (Hz)', width - padding - 40, height - padding - 5);
            freqCtx.fillText('0', midX + 5, height - padding + 12);
            freqCtx.fillText('-' + maxFreqPlot, padding, height - padding + 12);
            freqCtx.fillText('+' + maxFreqPlot, width - padding - 20, height - padding + 12);
        }

        function freqToX(f) {
            // Map frequency [-maxFreqPlot, maxFreqPlot] to canvas X
            const midX = padding + plotWidth / 2;
            return midX + (f / maxFreqPlot) * (plotWidth / 2);
        }

        function drawImpulse(ctx, f, color, heightScale = 1.0, label = "") {
            const x = freqToX(f);
            if (x < padding || x > width - padding) return; // Out of bounds

            const base = height - padding;
            const top = padding + (1 - heightScale) * plotHeight;

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, base);
            ctx.lineTo(x, top);
            ctx.stroke();

            // Arrow head
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x - 4, top + 6);
            ctx.lineTo(x + 4, top + 6);
            ctx.lineTo(x, top);
            ctx.fill();

            if (label) {
                ctx.fillStyle = color;
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(label, x, top - 5);
                ctx.textAlign = 'left'; // reset
            }
        }

        function updateSystem() {
            const f_sig = parseFloat(fSigSlider.value);
            const f_s = parseFloat(fsSlider.value);
            const nyquist = f_s / 2;

            document.getElementById('fSigDisplay').innerText = `${f_sig.toFixed(1)} Hz`;
            document.getElementById('fsDisplay').innerText = `${f_s.toFixed(1)} Hz`;

            // Calculate Aliased Frequency
            const N = Math.round(f_sig / f_s);
            const f_eff = f_sig - N * f_s;
            const f_alias_display = Math.abs(f_eff);
            const isInverted = f_eff < 0;

            // ==========================================
            // 1. RENDER TIME DOMAIN
            // ==========================================
            waveCtx.fillStyle = '#000000'; waveCtx.fillRect(0, 0, width, height);
            drawTimeAxes();

            // Analog Signal (Blue)
            waveCtx.beginPath(); waveCtx.strokeStyle = 'rgba(137, 180, 250, 0.3)'; waveCtx.lineWidth = 2;
            for (let px = 0; px <= plotWidth; px++) {
                const t = (px / plotWidth) * duration;
                const py = centerY - Math.sin(2 * Math.PI * f_sig * t) * (plotHeight / 2);
                if (px === 0) waveCtx.moveTo(padding + px, py); else waveCtx.lineTo(padding + px, py);
            }
            waveCtx.stroke();

            // Reconstructed Signal (Pink)
            waveCtx.beginPath(); waveCtx.strokeStyle = '#f38ba8'; waveCtx.lineWidth = 3;
            for (let px = 0; px <= plotWidth; px++) {
                const t = (px / plotWidth) * duration;
                const py = centerY - Math.sin(2 * Math.PI * f_eff * t) * (plotHeight / 2);
                if (px === 0) waveCtx.moveTo(padding + px, py); else waveCtx.lineTo(padding + px, py);
            }
            waveCtx.stroke();

            // Discrete Samples (Yellow)
            waveCtx.fillStyle = '#f9e2af'; waveCtx.strokeStyle = 'rgba(249, 226, 175, 0.4)'; waveCtx.lineWidth = 1;
            const numSamples = Math.floor(f_s * duration);
            for (let n = 0; n <= numSamples; n++) {
                const t = n / f_s;
                if (t > duration) break;
                const px = padding + (t / duration) * plotWidth;
                const py = centerY - Math.sin(2 * Math.PI * f_sig * t) * (plotHeight / 2);
                waveCtx.beginPath(); waveCtx.moveTo(px, centerY); waveCtx.lineTo(px, py); waveCtx.stroke();
                waveCtx.beginPath(); waveCtx.arc(px, py, 4, 0, 2 * Math.PI); waveCtx.fill();
            }

            // ==========================================
            // 2. RENDER FREQUENCY DOMAIN
            // ==========================================
            freqCtx.fillStyle = '#000000'; freqCtx.fillRect(0, 0, width, height);

            // Draw Nyquist Baseband Zone
            const nx1 = freqToX(-nyquist);
            const nx2 = freqToX(nyquist);
            if (nx1 >= padding && nx2 <= width - padding) {
                freqCtx.fillStyle = 'rgba(166, 227, 161, 0.15)';
                freqCtx.fillRect(nx1, padding, nx2 - nx1, plotHeight);
                freqCtx.strokeStyle = '#a6e3a1'; freqCtx.lineWidth = 1; freqCtx.setLineDash([5, 5]);
                freqCtx.beginPath(); freqCtx.moveTo(nx1, padding); freqCtx.lineTo(nx1, height - padding); freqCtx.stroke();
                freqCtx.beginPath(); freqCtx.moveTo(nx2, padding); freqCtx.lineTo(nx2, height - padding); freqCtx.stroke();
                freqCtx.setLineDash([]);

                freqCtx.fillStyle = '#a6e3a1'; freqCtx.font = '10px sans-serif'; freqCtx.textAlign = 'center';
                freqCtx.fillText(`-fs/2`, nx1, padding - 5);
                freqCtx.fillText(`+fs/2`, nx2, padding - 5);
                freqCtx.textAlign = 'left';
            }

            drawFreqAxes();

            // Draw Spectral Impulses (Replicas)
            // Sampling creates replicas at f_sig + k*fs and -f_sig + k*fs
            for (let k = -5; k <= 5; k++) {
                const f1 = f_sig + k * f_s;
                const f2 = -f_sig + k * f_s;

                // Determine if a frequency is inside the Nyquist baseband
                const insideNyquist1 = Math.abs(f1) <= nyquist;
                const insideNyquist2 = Math.abs(f2) <= nyquist;

                // Draw f1
                let color1 = k === 0 ? '#89b4fa' : '#f9e2af'; // Blue for k=0, Yellow for replicas
                if (insideNyquist1) color1 = '#f38ba8';       // Pink if it falls in the baseband (perceived)
                drawImpulse(freqCtx, f1, color1, k === 0 ? 0.9 : 0.6, insideNyquist1 ? `${Math.abs(f1)}Hz` : '');

                // Draw f2
                let color2 = k === 0 ? '#89b4fa' : '#f9e2af';
                if (insideNyquist2) color2 = '#f38ba8';
                drawImpulse(freqCtx, f2, color2, k === 0 ? 0.9 : 0.6, insideNyquist2 ? `${Math.abs(f2)}Hz` : '');
            }

            // ==========================================
            // 3. TEXT READOUTS
            // ==========================================
            let statusHTML = "";

            if (f_sig < nyquist) {
                statusHTML = `<span style="color: #a6e3a1; font-weight: bold; font-size: 18px;">PERFECT RECONSTRUCTION</span><br>
                The original signal's spectrum lies entirely within the Nyquist Zone. No overlapping occurs.`;
            } else if (f_sig === nyquist) {
                statusHTML = `<span style="color: #f9e2af; font-weight: bold; font-size: 18px;">NYQUIST LIMIT (CRITICAL)</span><br>
                The replicas sit exactly on the boundaries of the filter.`;
            } else {
                statusHTML = `<span style="color: #f38ba8; font-weight: bold; font-size: 18px;">ALIASING OCCURRING!</span><br>
                Look at the Frequency Domain: A yellow replica spectrum has folded into the green Nyquist Zone! The digital system filters out everything outside the green box, so it incorrectly perceives this replica as a <span class="highlight-alias">${f_alias_display.toFixed(1)} Hz</span> signal.${isInverted ? ' (With inverted phase!)' : ''}`;
            }

            metricsReadout.innerHTML = `
                <div><strong>Nyquist Limit (f_s / 2):</strong> ${nyquist.toFixed(1)} Hz</div>
                <div style="margin: 10px 0; border-top: 1px solid var(--color-grid);"></div>
                <div><strong>Actual Signal:</strong> <span class="highlight-sig">${f_sig.toFixed(1)} Hz</span></div>
                <div><strong>Perceived Baseband Signal:</strong> <span class="highlight-alias">${f_alias_display.toFixed(1)} Hz</span></div>
                <br>
                ${statusHTML}
            `;
        }

        // Event Listeners
        fSigSlider.addEventListener('input', updateSystem);
        fsSlider.addEventListener('input', updateSystem);

        // Initial Draw
        updateSystem();