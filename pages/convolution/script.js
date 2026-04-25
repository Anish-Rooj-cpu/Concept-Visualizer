// --- 1. Signal Generators ---
        const N = 31; // Length of our discrete time window
        const mid = Math.floor(N / 2);
        const timeAxis = Array.from({ length: N }, (_, i) => i - mid);

        // Generate static random signal so it doesn't flicker during animation
        const randomSignal1 = Array.from({ length: N }, () => (Math.random() * 2) - 1);
        const randomSignal2 = Array.from({ length: N }, () => (Math.random() * 2) - 1);

        const generateSignal = (type, isKernel = false) => {
            return timeAxis.map((t, index) => {
                switch (type) {
                    case 'step': return (t >= -5 && t <= 5) ? 1 : 0;
                    case 'square': return (t >= -5 && t < 0) ? 1 : ((t >= 0 && t <= 5) ? -1 : 0);
                    case 'sine': return (t >= -10 && t <= 10) ? Math.sin(t * 0.5) : 0;
                    case 'gaussian': return Math.exp(-Math.pow(t, 2) / 4);
                    case 'triangle': return (t >= -5 && t <= 5) ? 1 - Math.abs(t) / 5 : 0;
                    case 'exponential': return (t >= 0 && t <= 10) ? Math.exp(-t / 3) : 0;
                    case 'random': return isKernel ? randomSignal2[index] : randomSignal1[index];
                    default: return 0;
                }
            });
        };

        // --- 2. Math Operations ---
        function calculateInteraction(sig1, sig2, lag, mode) {
            let processedSig2 = [...sig2];

            // Convolution requires flipping the kernel
            if (mode === 'convolution') {
                processedSig2.reverse();
            }

            // Shift the signal
            let shiftedSig2 = new Array(N).fill(0);
            for (let i = 0; i < N; i++) {
                let shiftIndex = i - lag;
                if (shiftIndex >= 0 && shiftIndex < N) {
                    shiftedSig2[i] = processedSig2[shiftIndex];
                }
            }

            // Point-wise multiplication
            let product = sig1.map((val, i) => val * shiftedSig2[i]);
            let sum = product.reduce((acc, val) => acc + val, 0);

            return { shiftedSig2, product, sum };
        }

        function calculateFullOutput(sig1, sig2, mode) {
            let output = [];
            for (let lag = -15; lag <= 15; lag++) {
                output.push(calculateInteraction(sig1, sig2, lag, mode).sum);
            }
            return output;
        }

        // --- 3. Chart Setup ---
        Chart.defaults.maintainAspectRatio = false;
        Chart.defaults.elements.point.radius = 2;
        Chart.defaults.elements.line.borderWidth = 2;
        Chart.defaults.animation.duration = 100; // Fast animation for smooth sliding

        const commonOptions = {
            responsive: true,
            scales: { y: { suggestedMin: -1.5, suggestedMax: 1.5 } }
        };

        const ctx1 = document.getElementById('chart1').getContext('2d');
        const chart1 = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: timeAxis, datasets: [
                    { label: 'Input Signal', borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.1)', data: [], fill: true, stepped: true },
                    { label: 'Processed Kernel', borderColor: '#e74c3c', borderDash: [5, 5], data: [], stepped: true, backgroundColor: 'transparent' }
                ]
            },
            options: { ...commonOptions, plugins: { title: { display: true, text: 'Panel 1: Input & Processed Kernel' } } }
        });

        const ctx2 = document.getElementById('chart2').getContext('2d');
        const chart2 = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: timeAxis, datasets: [
                    { label: 'Point-wise Product', backgroundColor: '#9b59b6', data: [] }
                ]
            },
            options: { ...commonOptions, plugins: { title: { display: true, text: 'Panel 2: Point-wise Product (Area to Sum)' } } }
        });

        const lagAxis = Array.from({ length: 31 }, (_, i) => i - 15);
        const ctx3 = document.getElementById('chart3').getContext('2d');
        const chart3 = new Chart(ctx3, {
            type: 'line',
            data: {
                labels: lagAxis, datasets: [
                    { label: 'Full Output Function', borderColor: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.2)', data: [], fill: true },
                    { label: 'Current Value', backgroundColor: '#c0392b', borderColor: '#c0392b', data: [], type: 'bubble', radius: 6 }
                ]
            },
            options: {
                responsive: true,
                plugins: { title: { display: true, text: 'Panel 3: Final Output (Correlation / Convolution)' } },
                scales: { y: { suggestedMin: -5, suggestedMax: 5 } }
            }
        });

        // --- 4. Event Listeners & Updates ---
        const ui = {
            mode: document.getElementById('mode'),
            sig1: document.getElementById('signal1'),
            sig2: document.getElementById('signal2'),
            lag: document.getElementById('lagSlider'),
            lagLabel: document.getElementById('lagValue'),
            mathLag: document.getElementById('mathLag'),
            mathResult: document.getElementById('mathResult'),
            playBtn: document.getElementById('playBtn')
        };

        function updateVisuals() {
            const mode = ui.mode.value;
            const lag = parseInt(ui.lag.value);

            ui.lagLabel.innerText = lag;
            ui.mathLag.innerText = lag;

            // Notice we flag the second signal as the kernel for random noise stability
            const s1 = generateSignal(ui.sig1.value, false);
            const s2 = generateSignal(ui.sig2.value, true);

            const { shiftedSig2, product, sum } = calculateInteraction(s1, s2, lag, mode);
            const fullOutput = calculateFullOutput(s1, s2, mode);

            // Update Math Display
            ui.mathResult.innerText = sum.toFixed(2);

            // Update Panel 1
            chart1.data.datasets[0].data = s1;
            chart1.data.datasets[1].data = shiftedSig2;
            chart1.data.datasets[1].label = mode === 'convolution' ? 'Kernel (Flipped & Shifted)' : 'Reference (Shifted)';

            // Adjust step rendering based on signal type
            const isS1Discrete = ['step', 'square'].includes(ui.sig1.value);
            const isS2Discrete = ['step', 'square'].includes(ui.sig2.value);
            chart1.data.datasets[0].stepped = isS1Discrete;
            chart1.data.datasets[1].stepped = isS2Discrete;
            chart1.update();

            // Update Panel 2
            chart2.data.datasets[0].data = product;
            chart2.update();

            // Update Panel 3
            chart3.data.datasets[0].data = fullOutput;
            // Map the current lag to bubble format for Chart.js
            let bubbleData = lagAxis.map(l => (l === lag ? { x: l, y: sum, r: 8 } : null)).filter(x => x !== null);
            chart3.data.datasets[1].data = bubbleData;
            chart3.update();
        }

        // --- 5. Animation Logic ---
        let isPlaying = false;
        let animationInterval;

        ui.playBtn.addEventListener('click', () => {
            isPlaying = !isPlaying;
            if (isPlaying) {
                ui.playBtn.innerText = 'Pause ⏸';
                ui.playBtn.style.backgroundColor = '#e74c3c'; // Red for pause

                animationInterval = setInterval(() => {
                    let currentLag = parseInt(ui.lag.value);
                    currentLag++;
                    if (currentLag > parseInt(ui.lag.max)) {
                        currentLag = parseInt(ui.lag.min);
                    }
                    ui.lag.value = currentLag;
                    updateVisuals();
                }, 250); // 250ms per step
            } else {
                ui.playBtn.innerText = 'Play ▶';
                ui.playBtn.style.backgroundColor = '#3498db'; // Blue for play
                clearInterval(animationInterval);
            }
        });

        // Attach UI listeners
        ui.mode.addEventListener('change', updateVisuals);
        ui.sig1.addEventListener('change', updateVisuals);
        ui.sig2.addEventListener('change', updateVisuals);
        ui.lag.addEventListener('input', updateVisuals);

        // Initial render
        updateVisuals();