// --- Global Parameters ---
const C_load = 1.0; // pF
const dt = 0.01;    // ns timestep for transient

// Calculate exactly VM (Switching Threshold)
function calculateVm(Vdd, Vtn, Vtp, Kr) {
          return (Vdd - Vtp + Vtn * Math.sqrt(Kr)) / (1 + Math.sqrt(Kr));
}

// Generate Exact Analytical VTC Array
function generateAnalyticalVTC(Vdd, Vtn, Vtp, Kr) {
          let data = [];
          let Vm = calculateVm(Vdd, Vtn, Vtp, Kr);

          // Calculate precise bounds for Region C
          let Vout_max = Vm + Vtp;
          let Vout_min = Vm - Vtn;

          const step = 0.02;
          for (let vin = 0; vin <= Vdd + step; vin += step) {
                    let v = Math.round(vin * 100) / 100; // Fix float precision

                    if (v < Vtn) {
                              // Region A: NMOS Cutoff, PMOS Linear
                              data.push({ x: v, y: Vdd });
                    }
                    else if (v < Vm - 0.01) {
                              // Region B: NMOS Sat, PMOS Linear
                              let a = 0.5;
                              let b = -(Vdd - v - Vtp);
                              let c = 0.5 * Kr * Math.pow(v - Vtn, 2);
                              let discriminant = b * b - 4 * a * c;
                              if (discriminant >= 0) {
                                        let x = (-b - Math.sqrt(discriminant)) / (2 * a);
                                        data.push({ x: v, y: Vdd - x });
                              }
                    }
                    else if (v >= Vm - 0.01 && v <= Vm + 0.01) {
                              // Region C: Both Saturation - PERFECT VERTICAL DROP
                              if (data.length > 0 && data[data.length - 1].x !== Vm) {
                                        data.push({ x: Vm, y: Vout_max });
                                        data.push({ x: Vm, y: Vout_min });
                              }
                    }
                    else if (v > Vm + 0.01 && v <= Vdd - Vtp) {
                              // Region D: NMOS Linear, PMOS Sat
                              let a = 1;
                              let b = -2 * (v - Vtn);
                              let c = (1 / Kr) * Math.pow(Vdd - v - Vtp, 2);
                              let discriminant = b * b - 4 * a * c;
                              if (discriminant >= 0) {
                                        let vout = (-b - Math.sqrt(discriminant)) / (2 * a);
                                        data.push({ x: v, y: vout });
                              }
                    }
                    else if (v > Vdd - Vtp) {
                              // Region E: NMOS Linear, PMOS Cutoff
                              data.push({ x: v, y: 0 });
                    }
          }
          return data;
}

// Current Equations for Transient Integrator
function getIn(Vgs, Vds, Vtn, Kn) {
          if (Vgs < Vtn) return 0;
          if (Vds <= Vgs - Vtn) return Kn * (Vgs - Vtn - Vds / 2) * Vds;
          return 0.5 * Kn * Math.pow(Vgs - Vtn, 2);
}
function getIp(Vin, Vout, Vdd, Vtp, Kp) {
          let Vsg = Vdd - Vin; let Vsd = Vdd - Vout;
          if (Vsg < Vtp) return 0;
          if (Vsd <= Vsg - Vtp) return Kp * (Vsg - Vtp - Vsd / 2) * Vsd;
          return 0.5 * Kp * Math.pow(Vsg - Vtp, 2);
}

// --- Chart Initialization ---
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#2a344a';

const vtcCtx = document.getElementById('vtcChart').getContext('2d');
const vtcChart = new Chart(vtcCtx, {
          type: 'line',
          data: {
                    datasets: [
                              { label: 'Vout', borderColor: '#38bdf8', borderWidth: 3, pointRadius: 0, data: [] },
                              { label: 'Operating Point', backgroundColor: '#c084fc', borderColor: '#c084fc', data: [], type: 'bubble', radius: 7 }
                    ]
          },
          options: {
                    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                    scales: { x: { type: 'linear', title: { display: true, text: 'Vin (V)' } }, y: { title: { display: true, text: 'Vout (V)' } } }
          }
});

const transCtx = document.getElementById('transientChart').getContext('2d');
const transChart = new Chart(transCtx, {
          type: 'line',
          data: {
                    datasets: [
                              { label: 'Vin (Input)', borderColor: '#c084fc', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, data: [] },
                              { label: 'Vout (Output)', borderColor: '#38bdf8', borderWidth: 2, pointRadius: 0, data: [] }
                    ]
          },
          options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { x: { type: 'linear', title: { display: true, text: 'Time (ns)' } }, y: { title: { display: true, text: 'Voltage (V)' } } }
          }
});

// --- Main Update Loop ---
function updateSimulation() {
          const Vdd = parseFloat(document.getElementById('vdd').value);
          const Vtn = parseFloat(document.getElementById('vtn').value);
          const Vtp = parseFloat(document.getElementById('vtp').value);
          const Kr = parseFloat(document.getElementById('kr').value);
          const Kp = 1.0; const Kn = Kr * Kp;

          let Vin_op = parseFloat(document.getElementById('vin').value);
          document.getElementById('vin').max = Vdd;

          // Update UI Sliders
          document.getElementById('val-vdd').innerText = Vdd.toFixed(1);
          document.getElementById('val-vtn').innerText = Vtn.toFixed(1);
          document.getElementById('val-vtp').innerText = Vtp.toFixed(1);
          document.getElementById('val-kr').innerText = Kr.toFixed(1);
          document.getElementById('val-vin').innerText = Vin_op.toFixed(2);

          // VTC Analytics
          let Vm = calculateVm(Vdd, Vtn, Vtp, Kr);
          let Vout_max = Vm + Vtp;
          let Vout_min = Vm - Vtn;

          document.getElementById('val-vm').innerText = Vm.toFixed(2) + ' V';
          document.getElementById('exp-vm').innerText = Vm.toFixed(2) + ' V';
          document.getElementById('exp-vmax').innerText = Vout_max.toFixed(2) + ' V';
          document.getElementById('exp-vmin').innerText = Vout_min.toFixed(2) + ' V';

          let vtcData = generateAnalyticalVTC(Vdd, Vtn, Vtp, Kr);

          // Find Vout_op analytically from array
          let Vout_op = 0;
          if (Math.abs(Vin_op - Vm) < 0.01) Vout_op = Vdd / 2; // Arbitrary mid-point if sitting perfectly on cliff
          else {
                    let pt = vtcData.reduce((prev, curr) => Math.abs(curr.x - Vin_op) < Math.abs(prev.x - Vin_op) ? curr : prev);
                    Vout_op = pt.y;
          }

          vtcChart.data.datasets[0].data = vtcData;
          vtcChart.data.datasets[1].data = [{ x: Vin_op, y: Vout_op, r: 8 }];

          // Determine Regions
          let nmosState = "Cutoff"; let pmosState = "Cutoff"; let region = "";
          if (Vin_op < Vtn) { nmosState = "Cutoff"; pmosState = "Linear"; region = "Region A"; }
          else if (Vin_op > Vdd - Vtp) { nmosState = "Linear"; pmosState = "Cutoff"; region = "Region E"; }
          else if (Math.abs(Vin_op - Vm) <= 0.01) { nmosState = "Saturation"; pmosState = "Saturation"; region = "Region C"; }
          else if (Vin_op < Vm) { nmosState = "Saturation"; pmosState = "Linear"; region = "Region B"; }
          else { nmosState = "Linear"; pmosState = "Saturation"; region = "Region D"; }

          document.getElementById('nmos-region').innerText = nmosState;
          document.getElementById('nmos-region').style.color = nmosState === 'Cutoff' ? 'var(--text-muted)' : 'var(--nmos-color)';
          document.getElementById('pmos-region').innerText = pmosState;
          document.getElementById('pmos-region').style.color = pmosState === 'Cutoff' ? 'var(--text-muted)' : 'var(--pmos-color)';
          document.getElementById('current-region').innerText = region;

          // Transient Sim
          let transVin = []; let transVout = [];
          const mode = document.getElementById('inputType').value;
          let vout_t = Vdd;

          for (let t = 0; t <= 10; t += dt) {
                    let vin_t = 0;
                    if (mode === 'pulse') {
                              if (t < 1) vin_t = 0; else if (t < 1.5) vin_t = Vdd * ((t - 1) / 0.5);
                              else if (t < 5) vin_t = Vdd; else if (t < 5.5) vin_t = Vdd * (1 - (t - 5) / 0.5);
                              else vin_t = 0;
                    } else {
                              vin_t = (t / 10) * Vdd;
                    }

                    let In = getIn(vin_t, vout_t, Vtn, Kn);
                    let Ip = getIp(vin_t, vout_t, Vdd, Vtp, Kp);
                    vout_t += ((Ip - In) / C_load) * dt;

                    if (vout_t > Vdd) vout_t = Vdd;
                    if (vout_t < 0) vout_t = 0;

                    if (Math.round(t * 100) % 5 === 0) {
                              transVin.push({ x: t, y: vin_t });
                              transVout.push({ x: t, y: vout_t });
                    }
          }

          transChart.data.datasets[0].data = transVin;
          transChart.data.datasets[1].data = transVout;

          vtcChart.options.scales.x.max = Vdd; vtcChart.options.scales.y.max = Vdd + 0.5;
          transChart.options.scales.y.max = Vdd + 0.5;
          vtcChart.update('none'); transChart.update('none');
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', updateSimulation));
updateSimulation();