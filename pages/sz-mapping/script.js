const sCtx = document.getElementById('sCanvas').getContext('2d');
        const zCtx = document.getElementById('zCanvas').getContext('2d');
        const pathSlider = document.getElementById('pathSlider');
        const tSlider = document.getElementById('tSlider');
        const readout = document.getElementById('readout');

        const width = 400, height = 400;
        const sOrigin = { x: 300, y: 200 }; // Shifted right to show negative sigma
        const zOrigin = { x: 200, y: 200 };
        
        const ws = 2 * Math.PI; 
        const sScale = 40; // Pixels per unit
        const zScale = 140; // Pixels for radius = 1
        const negInfSigma = -6; // Visual representation of negative infinity

        // Helper to evaluate points along the parameterized path [0 to 7]
        function getSPoint(t) {
            let sigma = 0, omega = 0;
            if (t <= 1) { // 1 -> 2
                sigma = 0; omega = (ws/4) * t;
            } else if (t <= 2) { // 2 -> 3
                sigma = 0; omega = (ws/4) + (ws/4) * (t - 1);
            } else if (t <= 3) { // 3 -> 4
                sigma = negInfSigma * (t - 2); omega = ws/2;
            } else if (t <= 4) { // 4 -> 5
                sigma = negInfSigma; omega = (ws/2) - ws * (t - 3);
            } else if (t <= 5) { // 5 -> 6
                sigma = negInfSigma - negInfSigma * (t - 4); omega = -ws/2;
            } else if (t <= 6) { // 6 -> 7
                sigma = 0; omega = -ws/2 + (ws/4) * (t - 5);
            } else if (t <= 7) { // 7 -> 1
                sigma = 0; omega = -ws/4 + (ws/4) * (t - 6);
            }
            return { sigma, omega };
        }

        // Fixed points for drawing labels
        const keyPointsS = [
            { t: 0, label: "1" }, { t: 1, label: "2" }, { t: 2, label: "3" },
            { t: 3, label: "4" }, { t: 4, label: "5" }, { t: 5, label: "6" },
            { t: 6, label: "7" }
        ];

        function drawSPlane(currentPoint) {
            sCtx.clearRect(0, 0, width, height);

            // Shaded fundamental strip
            sCtx.fillStyle = 'rgba(100, 181, 246, 0.15)';
            sCtx.fillRect(0, sOrigin.y - (ws/2)*sScale, sOrigin.x, ws*sScale);

            // Axes
            sCtx.strokeStyle = '#757575'; sCtx.lineWidth = 1.5;
            sCtx.beginPath();
            sCtx.moveTo(0, sOrigin.y); sCtx.lineTo(width, sOrigin.y); // σ axis
            sCtx.moveTo(sOrigin.x, 0); sCtx.lineTo(sOrigin.x, height); // jω axis
            sCtx.stroke();
            
            // Axis Labels
            sCtx.fillStyle = '#bdbdbd'; sCtx.font = '14px Arial';
            sCtx.fillText('σ', width - 15, sOrigin.y - 10);
            sCtx.fillText('jω', sOrigin.x + 10, 15);
            sCtx.fillText('jωs/2', sOrigin.x + 5, sOrigin.y - (ws/2)*sScale + 5);
            sCtx.fillText('-jωs/2', sOrigin.x + 5, sOrigin.y - (-ws/2)*sScale + 5);

            // Path outline
            sCtx.strokeStyle = '#ab47bc'; sCtx.lineWidth = 2;
            sCtx.beginPath();
            let start = getSPoint(0);
            sCtx.moveTo(sOrigin.x + start.sigma*sScale, sOrigin.y - start.omega*sScale);
            for(let i=0.1; i<=7; i+=0.1) {
                let pt = getSPoint(i);
                sCtx.lineTo(sOrigin.x + pt.sigma*sScale, sOrigin.y - pt.omega*sScale);
            }
            sCtx.stroke();

            // Mark key points 1-7
            sCtx.fillStyle = '#fff'; sCtx.font = '12px Arial';
            keyPointsS.forEach(kp => {
                let pt = getSPoint(kp.t);
                let px = sOrigin.x + pt.sigma*sScale;
                let py = sOrigin.y - pt.omega*sScale;
                sCtx.beginPath(); sCtx.arc(px, py, 3, 0, Math.PI*2); sCtx.fill();
                sCtx.fillText(kp.label, px - 15, py + 5);
            });

            // Tracer
            sCtx.fillStyle = '#ff4081';
            sCtx.beginPath();
            sCtx.arc(sOrigin.x + currentPoint.sigma*sScale, sOrigin.y - currentPoint.omega*sScale, 6, 0, Math.PI*2);
            sCtx.fill();
        }

        function drawZPlane(currentS, T) {
            zCtx.clearRect(0, 0, width, height);

            // Axes
            zCtx.strokeStyle = '#757575'; zCtx.lineWidth = 1.5;
            zCtx.beginPath();
            zCtx.moveTo(0, zOrigin.y); zCtx.lineTo(width, zOrigin.y); // Real
            zCtx.moveTo(zOrigin.x, 0); zCtx.lineTo(zOrigin.x, height); // Imag
            zCtx.stroke();

            // Axis labels
            zCtx.fillStyle = '#bdbdbd'; zCtx.font = '14px Arial';
            zCtx.fillText('Re(z)', width - 40, zOrigin.y - 10);
            zCtx.fillText('Im(z)', zOrigin.x + 10, 15);

            // Unit circle (Reference)
            zCtx.strokeStyle = 'rgba(255,255,255,0.2)'; zCtx.lineWidth = 1; zCtx.setLineDash([5, 5]);
            zCtx.beginPath(); zCtx.arc(zOrigin.x, zOrigin.y, zScale, 0, Math.PI*2); zCtx.stroke();
            zCtx.setLineDash([]);
            zCtx.fillText('1', zOrigin.x + zScale + 5, zOrigin.y - 5);

            // Mapped Path
            zCtx.strokeStyle = '#ab47bc'; zCtx.lineWidth = 2;
            zCtx.beginPath();
            for(let i=0; i<=7; i+=0.05) {
                let sPt = getSPoint(i);
                let r = Math.exp(sPt.sigma * T);
                let theta = sPt.omega * T;
                // If sigma is visually -inf, snap radius to epsilon to show the small circle explicitly
                if (sPt.sigma === negInfSigma) r = 0.08; 
                
                let zx = zOrigin.x + r * zScale * Math.cos(theta);
                let zy = zOrigin.y - r * zScale * Math.sin(theta);
                if(i===0) zCtx.moveTo(zx, zy); else zCtx.lineTo(zx, zy);
            }
            zCtx.stroke();

            // Mark key points 1-7 in Z plane
            zCtx.fillStyle = '#fff'; zCtx.font = '12px Arial';
            keyPointsS.forEach(kp => {
                let sPt = getSPoint(kp.t);
                let r = Math.exp(sPt.sigma * T);
                if (sPt.sigma === negInfSigma) r = 0.08; // small circle radius
                let theta = sPt.omega * T;
                let zx = zOrigin.x + r * zScale * Math.cos(theta);
                let zy = zOrigin.y - r * zScale * Math.sin(theta);
                
                zCtx.beginPath(); zCtx.arc(zx, zy, 3, 0, Math.PI*2); zCtx.fill();
                // Offset label slightly
                zCtx.fillText(kp.label, zx + (kp.label==='4'||kp.label==='5' ? -15 : 8), zy + (kp.label==='3' ? -10 : 5));
            });

            // Current Tracer Calculation
            let currentR = Math.exp(currentS.sigma * T);
            let currentTheta = currentS.omega * T;
            if (currentS.sigma === negInfSigma) currentR = 0.08;

            let tX = zOrigin.x + currentR * zScale * Math.cos(currentTheta);
            let tY = zOrigin.y - currentR * zScale * Math.sin(currentTheta);

            // Draw r (Radius Vector)
            zCtx.strokeStyle = 'rgba(255, 235, 59, 0.6)'; zCtx.lineWidth = 2;
            zCtx.beginPath(); zCtx.moveTo(zOrigin.x, zOrigin.y); zCtx.lineTo(tX, tY); zCtx.stroke();

            // Draw Theta (Angle Arc)
            if (Math.abs(currentTheta) > 0.01) {
                zCtx.strokeStyle = 'rgba(76, 175, 80, 0.8)'; zCtx.lineWidth = 2;
                zCtx.beginPath();
                // Canvas arc angles: 0 is Right, positive goes clockwise (downwards in canvas)
                // Math theta: positive goes counter-clockwise (upwards in canvas)
                let canvasTheta = -currentTheta; 
                zCtx.arc(zOrigin.x, zOrigin.y, 30, 0, canvasTheta, currentTheta > 0);
                zCtx.stroke();
            }

            // Draw Tracer Point
            zCtx.fillStyle = '#ff4081';
            zCtx.beginPath(); zCtx.arc(tX, tY, 6, 0, Math.PI*2); zCtx.fill();
            
            // Labels for r and theta on canvas
            zCtx.fillStyle = '#ffee58';
            zCtx.fillText('r', zOrigin.x + (tX - zOrigin.x)/2 - 10, zOrigin.y + (tY - zOrigin.y)/2 - 10);
            zCtx.fillStyle = '#4caf50';
            zCtx.fillText('θ', zOrigin.x + 35, zOrigin.y - (currentTheta > 0 ? 15 : -25));
        }

        function update() {
            let tVal = parseFloat(pathSlider.value);
            let T = parseFloat(tSlider.value);
            
            document.getElementById('pathLabel').innerText = Number.isInteger(tVal) ? `Point ${tVal || 7}` : `Tracing...`;
            document.getElementById('tLabel').innerText = T.toFixed(1);

            let currentS = getSPoint(tVal);
            
            // UI Readout formatting
            let displaySigma = currentS.sigma === negInfSigma ? "-∞" : currentS.sigma.toFixed(2);
            let displayOmega = (currentS.omega / Math.PI).toFixed(2) + "π";
            
            let r = currentS.sigma === negInfSigma ? 0 : Math.exp(currentS.sigma * T);
            let theta = currentS.omega * T;
            let displayTheta = (theta / Math.PI).toFixed(2) + "π";

            readout.innerHTML = `
                S-Plane Coordinates: s = <span class="highlight">${displaySigma} + j(${displayOmega})</span> <br>
                Z-Plane Coordinates: z = e<sup>sT</sup> &rarr; r = <span class="highlight">${r.toFixed(3)}</span>, &theta; = <span class="highlight">${displayTheta}</span> rad
            `;

            drawSPlane(currentS);
            drawZPlane(currentS, T);
        }

        pathSlider.addEventListener('input', update);
        tSlider.addEventListener('input', update);
        update();