// --- Complex Math Library ---
                    class Complex {
                              constructor(r, i) { this.r = r; this.i = i; }
                              add(c) { return new Complex(this.r + c.r, this.i + c.i); }
                              mul(c) { return new Complex(this.r * c.r - this.i * c.i, this.r * c.i + this.i * c.r); }
                              div(c) {
                                        const den = c.r * c.r + c.i * c.i;
                                        return new Complex((this.r * c.r + this.i * c.i) / den, (this.i * c.r - this.r * c.i) / den);
                              }
                              mag() { return Math.sqrt(this.r * this.r + this.i * this.i); }
                              phase() { return Math.atan2(this.i, this.r); } // Returns in radians
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

                    // --- Phase Unwrapping ---
                    // Prevents the phase plot from drawing vertical lines when jumping from 180 to -180
                    function unwrapPhase(phases) {
                              let unwrapped = [phases[0]];
                              for (let i = 1; i < phases.length; i++) {
                                        let diff = phases[i] - phases[i - 1];
                                        let current = phases[i];
                                        while (diff > 180) { current -= 360; diff -= 360; }
                                        while (diff < -180) { current += 360; diff += 360; }
                                        unwrapped.push(current);
                                        phases[i] = current; // Update array to keep track
                              }
                              return unwrapped;
                    }

                    // --- Chart.js Globals ---
                    let magChart, phaseChart;
                    const commonChartOptions = {
                              responsive: true,
                              maintainAspectRatio: false,
                              animation: false, // Turn off animation for smooth slider scrubbing
                              interaction: { mode: 'index', intersect: false },
                              scales: {
                                        x: {
                                                  type: 'logarithmic',
                                                  title: { display: true, text: 'Frequency (rad/s)', color: '#a6adc8' },
                                                  grid: { color: '#45475a' },
                                                  ticks: { color: '#cdd6f4' }
                                        }
                              },
                              plugins: {
                                        legend: { labels: { color: '#cdd6f4' } }
                              }
                    };

                    function initCharts() {
                              const ctxMag = document.getElementById('magChart').getContext('2d');
                              magChart = new Chart(ctxMag, {
                                        type: 'line',
                                        data: { datasets: [] },
                                        options: {
                                                  ...commonChartOptions,
                                                  plugins: { ...commonChartOptions.plugins, title: { display: true, text: 'Bode Magnitude Plot (dB)', color: '#89b4fa' } },
                                                  scales: {
                                                            ...commonChartOptions.scales,
                                                            y: { title: { display: true, text: 'Magnitude (dB)', color: '#a6adc8' }, grid: { color: '#45475a' }, ticks: { color: '#cdd6f4' } }
                                                  }
                                        }
                              });

                              const ctxPhase = document.getElementById('phaseChart').getContext('2d');
                              phaseChart = new Chart(ctxPhase, {
                                        type: 'line',
                                        data: { datasets: [] },
                                        options: {
                                                  ...commonChartOptions,
                                                  plugins: { ...commonChartOptions.plugins, title: { display: true, text: 'Bode Phase Plot (Degrees)', color: '#89b4fa' } },
                                                  scales: {
                                                            ...commonChartOptions.scales,
                                                            y: { title: { display: true, text: 'Phase (°)', color: '#a6adc8' }, grid: { color: '#45475a' }, ticks: { color: '#cdd6f4', stepSize: 45 } }
                                                  }
                                        }
                              });
                    }

                    // --- Core Logic ---
                    function updateSliderRanges() {
                              const type = document.querySelector('input[name="compType"]:checked').value;
                              const aSlider = document.getElementById('aSlider');
                              if (type === 'lead') {
                                        aSlider.min = "1.1"; aSlider.max = "30"; aSlider.value = "10";
                              } else {
                                        aSlider.min = "0.01"; aSlider.max = "0.99"; aSlider.value = "0.1";
                              }
                              updatePlots();
                    }

                    function generateBodeData() {
                              const num = document.getElementById('numInput').value.split(',').map(Number);
                              const den = document.getElementById('denInput').value.split(',').map(Number);
                              const a = parseFloat(document.getElementById('aSlider').value);
                              const T = parseFloat(document.getElementById('tSlider').value);

                              document.getElementById('aValDisplay').innerText = a.toFixed(3);
                              document.getElementById('tValDisplay').innerText = T.toFixed(3);

                              let data = {
                                        w: [],
                                        plantMag: [], plantPhase: [],
                                        compMag: [], compPhase: [],
                                        sysMag: [], sysPhase: []
                              };

                              // Generate frequencies (w) from 10^-2 to 10^4
                              for (let i = -2; i <= 4; i += 0.05) {
                                        let w = Math.pow(10, i);
                                        data.w.push(w);
                                        let s = new Complex(0, w);

                                        // 1. Evaluate Plant Gp(s)
                                        let Gp = evalPoly(num, s).div(evalPoly(den, s));
                                        let pMag = 20 * Math.log10(Gp.mag());
                                        let pPhase = Gp.phase() * (180 / Math.PI);

                                        // 2. Evaluate Compensator Gc(s) = (1 + aTs) / (1 + Ts)
                                        let compNum = [a * T, 1];
                                        let compDen = [T, 1];
                                        let Gc = evalPoly(compNum, s).div(evalPoly(compDen, s));
                                        let cMag = 20 * Math.log10(Gc.mag());
                                        let cPhase = Gc.phase() * (180 / Math.PI);

                                        // 3. System Total G_total(s) = Gp * Gc
                                        let sysMag = pMag + cMag; // Log properties: multiplication becomes addition
                                        let sysPhase = pPhase + cPhase;

                                        data.plantMag.push({ x: w, y: pMag });
                                        data.compMag.push({ x: w, y: cMag });
                                        data.sysMag.push({ x: w, y: sysMag });

                                        data.plantPhase.push(pPhase);
                                        data.compPhase.push(cPhase);
                                        data.sysPhase.push(sysPhase);
                              }

                              // Unwrap phases
                              let unwrappedPlant = unwrapPhase(data.plantPhase);
                              let unwrappedComp = unwrapPhase(data.compPhase);
                              let unwrappedSys = unwrapPhase(data.sysPhase);

                              // Re-map to point objects for Chart.js
                              data.plantPhase = unwrappedPlant.map((p, i) => ({ x: data.w[i], y: p }));
                              data.compPhase = unwrappedComp.map((p, i) => ({ x: data.w[i], y: p }));
                              data.sysPhase = unwrappedSys.map((p, i) => ({ x: data.w[i], y: p }));

                              return data;
                    }

                    function updatePlots() {
                              const data = generateBodeData();

                              const pointOpts = { pointRadius: 0, borderWidth: 2, tension: 0.1 };

                              magChart.data.datasets = [
                                        { label: 'Uncompensated Plant', data: data.plantMag, borderColor: '#a6adc8', borderDash: [5, 5], ...pointOpts },
                                        { label: 'Compensator Only', data: data.compMag, borderColor: '#f9e2af', ...pointOpts },
                                        { label: 'Compensated System', data: data.sysMag, borderColor: '#f38ba8', borderWidth: 3, pointRadius: 0, tension: 0.1 }
                              ];
                              magChart.update();

                              phaseChart.data.datasets = [
                                        { label: 'Uncompensated Plant', data: data.plantPhase, borderColor: '#a6adc8', borderDash: [5, 5], ...pointOpts },
                                        { label: 'Compensator Only', data: data.compPhase, borderColor: '#f9e2af', ...pointOpts },
                                        { label: 'Compensated System', data: data.sysPhase, borderColor: '#f38ba8', borderWidth: 3, pointRadius: 0, tension: 0.1 }
                              ];
                              phaseChart.update();
                    }

                    // Event Listeners
                    document.getElementById('aSlider').addEventListener('input', updatePlots);
                    document.getElementById('tSlider').addEventListener('input', updatePlots);

                    // Init
                    window.onload = () => {
                              initCharts();
                              updatePlots();
                    };