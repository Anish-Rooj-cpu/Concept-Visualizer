// System Constants from text
                    const A11_base = 1;
                    const A12_base = 0.095163;
                    const A21_base = 0;
                    const A22_base = 0.904837;

                    const B1 = 0.0048374;
                    const B2 = 0.095163;

                    // DOM Elements
                    const sliderReal = document.getElementById('realPart');
                    const sliderImag = document.getElementById('imagPart');
                    const displayReal = document.getElementById('realVal');
                    const displayImag = document.getElementById('imagVal');
                    const k1_display = document.getElementById('k1_val');
                    const k2_display = document.getElementById('k2_val');
                    const statusDiv = document.getElementById('stabilityStatus');
                    const zPlaneCanvas = document.getElementById('zPlaneCanvas');
                    const ctxZ = zPlaneCanvas.getContext('2d');

                    // Chart.js Setup
                    let responseChart;
                    const ctxChart = document.getElementById('responseChart').getContext('2d');

                    function initChart() {
                              responseChart = new Chart(ctxChart, {
                                        type: 'line',
                                        data: {
                                                  labels: Array.from({ length: 50 }, (_, i) => i),
                                                  datasets: [{
                                                            label: 'Motor Position x₁(k)',
                                                            data: [],
                                                            borderColor: '#2563eb',
                                                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                                            borderWidth: 2,
                                                            fill: true,
                                                            pointRadius: 0
                                                  }]
                                        },
                                        options: {
                                                  responsive: true,
                                                  animation: false,
                                                  scales: {
                                                            x: { title: { display: true, text: 'Time Step (k)' } },
                                                            y: { title: { display: true, text: 'Angle' } }
                                                  }
                                        }
                              });
                    }

                    function drawZPlane(alpha, beta) {
                              const width = zPlaneCanvas.width;
                              const height = zPlaneCanvas.height;
                              const cx = width / 2;
                              const cy = height / 2;
                              const scale = 80; // pixels per unit

                              ctxZ.clearRect(0, 0, width, height);

                              // Draw axes
                              ctxZ.beginPath();
                              ctxZ.strokeStyle = '#cbd5e1';
                              ctxZ.moveTo(0, cy); ctxZ.lineTo(width, cy); // Real axis
                              ctxZ.moveTo(cx, 0); ctxZ.lineTo(cx, height); // Imag axis
                              ctxZ.stroke();

                              // Draw Unit Circle
                              ctxZ.beginPath();
                              ctxZ.arc(cx, cy, scale, 0, 2 * Math.PI);
                              ctxZ.strokeStyle = '#94a3b8';
                              ctxZ.setLineDash([5, 5]);
                              ctxZ.stroke();
                              ctxZ.setLineDash([]); // Reset dash

                              // Draw Poles (X marks)
                              ctxZ.strokeStyle = '#dc2626';
                              ctxZ.lineWidth = 2;
                              const size = 6;

                              // Pole 1 (+ j)
                              let px1 = cx + alpha * scale;
                              let py1 = cy - beta * scale; // Invert Y for canvas
                              ctxZ.beginPath();
                              ctxZ.moveTo(px1 - size, py1 - size); ctxZ.lineTo(px1 + size, py1 + size);
                              ctxZ.moveTo(px1 + size, py1 - size); ctxZ.lineTo(px1 - size, py1 + size);
                              ctxZ.stroke();

                              // Pole 2 (- j)
                              if (beta !== 0) {
                                        let py2 = cy + beta * scale;
                                        ctxZ.beginPath();
                                        ctxZ.moveTo(px1 - size, py2 - size); ctxZ.lineTo(px1 + size, py2 + size);
                                        ctxZ.moveTo(px1 + size, py2 - size); ctxZ.lineTo(px1 - size, py2 + size);
                                        ctxZ.stroke();
                              }
                    }

                    function simulateSystem(K1, K2) {
                              // Closed-loop matrix Af = A - BK
                              const Af11 = A11_base - B1 * K1;
                              const Af12 = A12_base - B1 * K2;
                              const Af21 = A21_base - B2 * K1;
                              const Af22 = A22_base - B2 * K2;

                              let x1 = 1.0; // Initial position error
                              let x2 = 0.0; // Initial velocity
                              const trajectory = [x1];

                              for (let k = 1; k < 50; k++) {
                                        let next_x1 = Af11 * x1 + Af12 * x2;
                                        let next_x2 = Af21 * x1 + Af22 * x2;

                                        // Cap simulation if it blows up dramatically
                                        if (Math.abs(next_x1) > 1e5) {
                                                  trajectory.push(next_x1 > 0 ? 1e5 : -1e5);
                                        } else {
                                                  trajectory.push(next_x1);
                                        }

                                        x1 = next_x1;
                                        x2 = next_x2;
                              }

                              responseChart.data.datasets[0].data = trajectory;
                              responseChart.update();
                    }

                    function update() {
                              const alpha = parseFloat(sliderReal.value);
                              const beta = parseFloat(sliderImag.value);

                              displayReal.textContent = alpha.toFixed(2);
                              displayImag.textContent = beta.toFixed(2);

                              // Math based on user's text formulas
                              // n1 + n2 = 2*alpha
                              // n1*n2 = alpha^2 + beta^2
                              const sum_n = 2 * alpha;
                              const prod_n = (alpha * alpha) + (beta * beta);

                              const K1 = 105.0833 * (prod_n - sum_n + 1.0);
                              const K2 = 14.67494 - 5.34172 * prod_n - 5.16661 * sum_n;

                              k1_display.textContent = K1.toFixed(4);
                              k2_display.textContent = K2.toFixed(4);

                              // Check stability (radius < 1)
                              const radius = Math.sqrt(prod_n);
                              if (radius < 1) {
                                        statusDiv.textContent = "System is STABLE (Poles inside unit circle)";
                                        statusDiv.className = "status stable";
                              } else {
                                        statusDiv.textContent = "System is UNSTABLE (Poles outside unit circle)";
                                        statusDiv.className = "status unstable";
                              }

                              drawZPlane(alpha, beta);
                              simulateSystem(K1, K2);
                    }

                    // Event Listeners
                    sliderReal.addEventListener('input', update);
                    sliderImag.addEventListener('input', update);

                    // Initialize
                    initChart();
                    update();