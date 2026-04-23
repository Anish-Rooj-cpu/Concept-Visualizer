let currentFiles = [];
let currentIndex = 0;
let cropperInstance = null;

async function startProcess() {
    const fileInput = document.getElementById('fileInput');
    const isManualCrop = document.getElementById('manualCropCheck').checked;
    const statusText = document.getElementById('status');

    if (fileInput.files.length === 0) {
        statusText.innerText = "Please select some photos first!";
        return;
    }

    if (isManualCrop) {
        currentFiles = Array.from(fileInput.files);
        currentIndex = 0;
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('cropper-ui').style.display = 'block';
        loadNextCropper();
    } else {
        statusText.innerText = `Processing ${fileInput.files.length} images... Please wait.`;
        await runBulkProcess(fileInput.files);
        statusText.innerText = "Processing complete. Check your downloads.";
    }
}

/* =========================================
   MANUAL CROP MODE
   ========================================= */
function loadNextCropper() {
    if (currentIndex >= currentFiles.length) {
        finishCropping();
        return;
    }

    document.getElementById('crop-counter').innerText = `Photo ${currentIndex + 1} of ${currentFiles.length}`;

    const file = currentFiles[currentIndex];
    const url = URL.createObjectURL(file);
    const imageEl = document.getElementById('crop-image');

    imageEl.src = url;

    if (cropperInstance) { cropperInstance.destroy(); }

    imageEl.onload = () => {
        cropperInstance = new Cropper(imageEl, {
            viewMode: 2,
            dragMode: 'move',
            autoCropArea: 0.9,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    };
}

async function saveCropAndNext() {
    if (!cropperInstance) return;

    const croppedCanvas = cropperInstance.getCroppedCanvas({ maxWidth: 1500, maxHeight: 1500 });

    const effect = document.getElementById('effect').value;
    const format = document.getElementById('format').value;
    const file = currentFiles[currentIndex];
    let originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

    await applyEffectAndDownload(croppedCanvas, effect, format, originalName);

    currentIndex++;
    loadNextCropper();
}

function skipAndNext() {
    currentIndex++;
    loadNextCropper();
}

function cancelCropping() {
    finishCropping("Process cancelled.");
}

function finishCropping(customMessage = "All photos processed and saved.") {
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    document.getElementById('cropper-ui').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
    document.getElementById('status').innerText = customMessage;
    document.getElementById('fileInput').value = "";
}

/* =========================================
   BULK AUTO MODE (Skipping Manual Crop)
   ========================================= */
async function runBulkProcess(files) {
    const effect = document.getElementById('effect').value;
    const format = document.getElementById('format').value;

    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        // Status update for the user
        document.getElementById('status').innerText = `Processing ${i + 1} of ${files.length}...`;

        const img = await loadImage(file);
        await applyEffectAndDownload(img, effect, format, originalName);

        // Small delay to prevent browser download caps
        await new Promise(r => setTimeout(r, 400));
    }
}

/* =========================================
   CORE EFFECT & DOWNLOAD GENERATOR
   ========================================= */
async function applyEffectAndDownload(sourceImg, effect, format, originalName) {
    let ext = format.split('/')[1];
    if (ext === 'jpeg') ext = 'jpg';

    const userColor = document.getElementById('frameColor').value;

    // Get manual dimensions
    const mWidth = parseInt(document.getElementById('manualWidth').value);
    const mHeight = parseInt(document.getElementById('manualHeight').value);

    let imgW, imgH;

    // Logic: If BOTH Width and Height are provided, use them. 
    // Otherwise, use the default auto-scaling logic.
    if (!isNaN(mWidth) && !isNaN(mHeight)) {
        imgW = mWidth;
        imgH = mHeight;
    } else {
        const maxBounds = 1000;
        let scale = Math.min(maxBounds / sourceImg.width, maxBounds / sourceImg.height);
        if (scale > 1) scale = 1;
        imgW = sourceImg.width * scale;
        imgH = sourceImg.height * scale;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (effect === 'padSlider') {
        // For the slider, we use the manual size as the "box" size if provided,
        // otherwise we keep your default 800x600.
        let boxWidth = (!isNaN(mWidth)) ? mWidth : 800;
        let boxHeight = (!isNaN(mHeight)) ? mHeight : 600;

        let fitScale = Math.min(boxWidth / sourceImg.width, boxHeight / sourceImg.height);
        let fitW = sourceImg.width * fitScale;
        let fitH = sourceImg.height * fitScale;

        canvas.width = boxWidth;
        canvas.height = boxHeight;
        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let dx = (boxWidth - fitW) / 2;
        let dy = (boxHeight - fitH) / 2;
        ctx.drawImage(sourceImg, dx, dy, fitW, fitH);
    }

    else if (effect === 'polaroid') {
        let pad = 20, bottomPad = 80;

        canvas.width = imgW + (pad * 2);
        canvas.height = imgH + pad + bottomPad;

        // 🔥 DROP SHADOW (outer shadow)
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 25;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 12;

        // Draw white polaroid frame with shadow
        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // ❗ IMPORTANT: reset shadow before drawing image
        ctx.shadowColor = "transparent";

        // Draw image
        ctx.drawImage(sourceImg, pad, pad, imgW, imgH);

        // Optional inner border (clean look)
        ctx.strokeStyle = "rgba(0,0,0,0.1)";
        ctx.lineWidth = 2;
        ctx.strokeRect(pad, pad, imgW, imgH);

        // Caption
        const label = document.getElementById('polaroidText').value;
        if (label) {
            ctx.fillStyle = "#333";
            ctx.font = "24px 'Brush Script MT', cursive, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(label, canvas.width / 2, canvas.height - 35);
        }
    }

    else if (effect === 'border') {
        let pad = 10;
        canvas.width = imgW + (pad * 2);
        canvas.height = imgH + (pad * 2);
        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sourceImg, pad, pad, imgW, imgH);
    }
    
    else {
        canvas.width = imgW;
        canvas.height = imgH;
        ctx.drawImage(sourceImg, 0, 0, imgW, imgH);
    }

    canvas.toBlob(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ready_${originalName}.${ext}`;
        link.click();
    }, format, 0.85);
}

function loadImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}