// --- Complex Math Library ---
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

                    // --- Core System State ---
                    let currentNum = [];
                    let currentDen = [];
                    const width = 500;
                    const height = 500;
                    const scale = 40; // pixels per unit
                    const originX = width / 2 + 50;
                    const originY = height / 2;

                    const bgCtx = document.getElementById('bgCanvas').getContext('2d', { willReadFrequently: true });
                    const fgCtx = document.getElementById('fgCanvas').getContext('2d');
                    const kSlider = document.getElementById('kSlider');

                    // Helper: Evaluate polynomial
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

                    // Helper: Combine D(s) + K*N(s)
                    function getCharacteristicPoly(num, den, K) {
                              const maxLen = Math.max(num.length, den.length);
                              const padNum = Array(maxLen - num.length).fill(0).concat(num);
                              const padDen = Array(maxLen - den.length).fill(0).concat(den);
                              return padDen.map((d, i) => d + K * padNum[i]);
                    }

                    // --- Numerical Methods ---

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

                    function findJWCrossings(num, den) {
                              let crossings = [];
                              let prevIm = null;
                              let prevW = null;

                              for (let w = 0.01; w <= 20; w += 0.05) {
                                        let s = new Complex(0, w);
                                        let n_val = evalPoly(num, s);
                                        let d_val = evalPoly(den, s);
                                        if (n_val.mag() < 1e-6) continue;

                                        let negD_over_N = (new Complex(-d_val.r, -d_val.i)).div(n_val);

                                        if (prevIm !== null) {
                                                  if (prevIm * negD_over_N.i <= 0) {
                                                            let w_cross = prevW - prevIm * (w - prevW) / (negD_over_N.i - prevIm);
                                                            let s_c = new Complex(0, w_cross);
                                                            let k_val = (new Complex(-evalPoly(den, s_c).r, -evalPoly(den, s_c).i)).div(evalPoly(num, s_c));

                                                            if (k_val.r > 0 && Math.abs(k_val.i) < 0.1) {
                                                                      crossings.push({ w: w_cross, k: k_val.r });
                                                            }
                                                  }
                                        }
                                        prevIm = negD_over_N.i;
                                        prevW = w;
                              }
                              return crossings;
                    }

                    // --- Drawing Routines ---

                    function drawAxes(ctx) {
                              ctx.strokeStyle = '#45475a';
                              ctx.lineWidth = 1;
                              ctx.beginPath();

                              ctx.fillStyle = '#6c7086';
                              ctx.font = '10px sans-serif';
                              ctx.textAlign = 'center';

                              ctx.moveTo(0, originY); ctx.lineTo(width, originY);
                              for (let x = originX % scale; x < width; x += scale) {
                                        let val = (x - originX) / scale;
                                        if (Math.abs(val) > 0.1) {
                                                  ctx.moveTo(x, originY - 3); ctx.lineTo(x, originY + 3);
                                                  ctx.fillText(val, x, originY + 15);
                                        }
                              }

                              ctx.moveTo(originX, 0); ctx.lineTo(originX, height);
                              ctx.textAlign = 'right';
                              for (let y = originY % scale; y < height; y += scale) {
                                        let val = -(y - originY) / scale;
                                        if (Math.abs(val) > 0.1) {
                                                  ctx.moveTo(originX - 3, y); ctx.lineTo(originX + 3, y);
                                                  ctx.fillText(val + 'j', originX - 8, y + 3);
                                        }
                              }
                              ctx.stroke();

                              ctx.fillStyle = '#a6adc8';
                              ctx.font = 'bold 12px sans-serif';
                              ctx.fillText('jω', originX + 20, 15);
                              ctx.textAlign = 'left';
                              ctx.fillText('σ', width - 15, originY - 10);
                    }

                    // ---> HIGHLIGHT: Modified to create thin, glowing anti-aliased curves <---
                    function drawLocusPixelShader() {
                              bgCtx.fillStyle = '#11111b';
                              bgCtx.fillRect(0, 0, width, height);
                              drawAxes(bgCtx);

                              const imgData = bgCtx.getImageData(0, 0, width, height);
                              const data = imgData.data;

                              // Tightened tolerance for a thinner base width
                              const phaseTolerance = 0.04;

                              for (let y = 0; y < height; y++) {
                                        for (let x = 0; x < width; x++) {
                                                  const sigma = (x - originX) / scale;
                                                  const omega = -(y - originY) / scale;
                                                  const s = new Complex(sigma, omega);

                                                  const N_s = evalPoly(currentNum, s);
                                                  const D_s = evalPoly(currentDen, s);

                                                  if (D_s.mag() < 1e-4) continue;

                                                  const G_s = N_s.div(D_s);
                                                  const angle = Math.atan2(G_s.i, G_s.r);
                                                  const diff = Math.abs(Math.abs(angle) - Math.PI);

                                                  if (diff < phaseTolerance) {
                                                            // Calculate a sub-pixel intensity to create a smooth, glowing fade
                                                            const intensity = Math.pow(1 - (diff / phaseTolerance), 1.6);

                                                            const index = (y * width + x) * 4;

                                                            // Blend the neon purple smoothly with the existing background pixel
                                                            data[index] = data[index] * (1 - intensity) + 203 * intensity;     // R
                                                            data[index + 1] = data[index + 1] * (1 - intensity) + 166 * intensity; // G
                                                            data[index + 2] = data[index + 2] * (1 - intensity) + 247 * intensity; // B
                                                  }
                                        }
                              }
                              bgCtx.putImageData(imgData, 0, 0);

                              // Overlay axes again lightly to keep them visible under locus
                              bgCtx.strokeStyle = 'rgba(69, 71, 90, 0.4)';
                              bgCtx.beginPath();
                              bgCtx.moveTo(0, originY); bgCtx.lineTo(width, originY);
                              bgCtx.moveTo(originX, 0); bgCtx.lineTo(originX, height);
                              bgCtx.stroke();
                    }

                    function updateDynamicRoots() {
                              const K = parseFloat(kSlider.value);
                              document.getElementById('kValDisplay').innerText = K.toFixed(2);

                              fgCtx.clearRect(0, 0, width, height);

                              const openPoles = findRoots(currentDen);
                              fgCtx.strokeStyle = '#f38ba8';
                              fgCtx.lineWidth = 2;
                              openPoles.forEach(p => {
                                        let px = originX + p.r * scale;
                                        let py = originY - p.i * scale;
                                        fgCtx.beginPath();
                                        fgCtx.moveTo(px - 5, py - 5); fgCtx.lineTo(px + 5, py + 5);
                                        fgCtx.moveTo(px + 5, py - 5); fgCtx.lineTo(px - 5, py + 5);
                                        fgCtx.stroke();
                              });

                              const openZeros = findRoots(currentNum);
                              fgCtx.strokeStyle = '#89b4fa';
                              openZeros.forEach(z => {
                                        let px = originX + z.r * scale;
                                        let py = originY - z.i * scale;
                                        fgCtx.beginPath();
                                        fgCtx.arc(px, py, 5, 0, 2 * Math.PI);
                                        fgCtx.stroke();
                              });

                              const charPoly = getCharacteristicPoly(currentNum, currentDen, K);
                              const roots = findRoots(charPoly);

                              let rootsText = '';
                              fgCtx.fillStyle = '#f9e2af';

                              roots.sort((a, b) => b.r - a.r);

                              roots.forEach((r, idx) => {
                                        let px = originX + r.r * scale;
                                        let py = originY - r.i * scale;

                                        fgCtx.beginPath();
                                        fgCtx.arc(px, py, 6, 0, 2 * Math.PI);
                                        fgCtx.fill();
                                        fgCtx.strokeStyle = '#11111b';
                                        fgCtx.stroke();

                                        let sign = r.i >= 0 ? '+' : '-';
                                        let imagStr = Math.abs(r.i) > 1e-4 ? ` ${sign} j${Math.abs(r.i).toFixed(2)}` : '';
                                        let color = r.r > 0 ? '#f38ba8' : '#a6e3a1';
                                        rootsText += `<div style="color: ${color};">s${idx + 1} = ${r.r.toFixed(3)}${imagStr}</div>`;
                              });

                              document.getElementById('rootsReadout').innerHTML = rootsText || "No roots";
                    }

                    // --- Main Execution ---

                    function initializeSystem() {
                              currentNum = document.getElementById('numInput').value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
                              currentDen = document.getElementById('denInput').value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));

                              if (currentNum.length === 0 || currentDen.length === 0) {
                                        alert("Please enter valid coefficients.");
                                        return;
                              }

                              drawLocusPixelShader();

                              const crossings = findJWCrossings(currentNum, currentDen);
                              let crossHtml = '';
                              if (crossings.length === 0) {
                                        crossHtml = '<div>No positive jω crossings found.</div>';
                              } else {
                                        crossings.forEach(c => {
                                                  crossHtml += `<div>Crosses at <span class="highlight">ω = ±${c.w.toFixed(2)} rad/s</span><br> Critical Gain: <span class="highlight-k">K = ${c.k.toFixed(2)}</span></div><br>`;
                                        });
                              }
                              document.getElementById('crossingReadout').innerHTML = crossHtml;

                              kSlider.value = 0;
                              updateDynamicRoots();
                    }

                    kSlider.addEventListener('input', updateDynamicRoots);

                    initializeSystem();