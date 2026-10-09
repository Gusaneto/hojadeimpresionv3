const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");
const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const fileCount = document.getElementById("fileCount");
const status = document.getElementById("status");

// Medidas físicas solicitadas.
const BASE_WIDTH_CM = 65.00;
const BASE_HEIGHT_CM = 85.00;
const IMAGE_WIDTH_CM = 15.80;
const IMAGE_HEIGHT_CM = 24.27;
const DPI = 300;

// Separaciones adicionales entre imágenes.
// Se mantienen dentro de la base de 59.97 x 82.48 cm.
const GAP_X_CM = 3.00;
const GAP_Y_CM = 8.00;

const CM_TO_PX = DPI / 2.54;
const BASE_W = Math.round(BASE_WIDTH_CM * CM_TO_PX);
const BASE_H = Math.round(BASE_HEIGHT_CM * CM_TO_PX);
const IMG_W = Math.round(IMAGE_WIDTH_CM * CM_TO_PX);
const IMG_H = Math.round(IMAGE_HEIGHT_CM * CM_TO_PX);
const GAP_X = Math.round(GAP_X_CM * CM_TO_PX);
const GAP_Y = Math.round(GAP_Y_CM * CM_TO_PX);

// La vista previa NO usa los 300 DPI para evitar un canvas gigantesco.
// El JPG final sí se genera a 300 DPI.
const PREVIEW_W = 720;
const PREVIEW_H = Math.round(PREVIEW_W * BASE_H / BASE_W);

let images = [];

previewCanvas.width = PREVIEW_W;
previewCanvas.height = PREVIEW_H;

function getLayout() {
  const totalW = IMG_W * 3 + GAP_X * 2;
  const totalH = IMG_H * 2 + GAP_Y;
  return {
    totalW,
    totalH,
    startX: (BASE_W - totalW) / 2,
    startY: (BASE_H - totalH) / 2
  };
}

// Normaliza los márgenes exteriores transparentes/blancos que algunas imágenes
// traen incorporados. Así el diseño útil ocupa el mismo marco y no queda una
// columna visualmente más delgada por tener más margen dentro del archivo.
// Solo se elimina el borde exterior casi blanco/transparente; el contenido interior
// se conserva y después se estira al tamaño exacto solicitado.
function getContentCanvas(img) {
  const source = document.createElement("canvas");
  source.width = img.naturalWidth || img.width;
  source.height = img.naturalHeight || img.height;
  const sctx = source.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const { width, height } = source;
  let data;
  try { data = sctx.getImageData(0, 0, width, height).data; }
  catch { return source; }

  let minX = width, minY = height, maxX = -1, maxY = -1;
  // Un píxel cuenta como contenido si no es transparente ni casi blanco.
  // El umbral evita conservar finos márgenes grises de escaneo.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      const isBackground = a < 12 || (data[i] > 246 && data[i + 1] > 246 && data[i + 2] > 246);
      if (!isBackground) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return source;

  // Evita recortar archivos que ya están prácticamente llenos de contenido.
  const marginX = Math.max(2, Math.round(width * 0.003));
  const marginY = Math.max(2, Math.round(height * 0.003));
  minX = Math.max(0, minX - marginX);
  minY = Math.max(0, minY - marginY);
  maxX = Math.min(width - 1, maxX + marginX);
  maxY = Math.min(height - 1, maxY + marginY);

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  if (contentW / width > 0.995 && contentH / height > 0.995) return source;

  const cropped = document.createElement("canvas");
  cropped.width = contentW;
  cropped.height = contentH;
  cropped.getContext("2d").drawImage(source, minX, minY, contentW, contentH, 0, 0, contentW, contentH);
  return cropped;
}

// Todas las imágenes llenan exactamente el marco de 15.80 × 24.27 cm.
// Se permite deformación proporcional para igualar tamaño; no se dejan franjas
// blancas por diferencias de proporción y se conserva un pequeño borde de seguridad.
function drawImageContained(ctx, img, x, y, w, h) {
  const normalized = getContentCanvas(img);
  ctx.drawImage(normalized, x, y, w, h);
}

function drawPreview() {
  previewCtx.fillStyle = "#fff";
  previewCtx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

  const scale = PREVIEW_W / BASE_W;
  const layout = getLayout();

  images.forEach((item, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);

    const x = (layout.startX + col * (IMG_W + GAP_X)) * scale;
    const y = (layout.startY + row * (IMG_H + GAP_Y)) * scale;
    const w = IMG_W * scale;
    const h = IMG_H * scale;

    // IMPORTANTE:
    // No se recorta: se estira para llenar el rectángulo exacto.
    drawImageContained(previewCtx, item.img, x, y, w, h);
  });

  // Espacios restantes: guías visuales únicamente.
  previewCtx.save();
  previewCtx.setLineDash([5, 4]);
  previewCtx.strokeStyle = "#d6d6d6";
  previewCtx.lineWidth = 1;

  for (let index = images.length; index < 6; index++) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = (layout.startX + col * (IMG_W + GAP_X)) * scale;
    const y = (layout.startY + row * (IMG_H + GAP_Y)) * scale;
    previewCtx.strokeRect(x, y, IMG_W * scale, IMG_H * scale);
  }
  previewCtx.restore();
}

function drawEmptyPreview() {
  previewCtx.fillStyle = "#fff";
  previewCtx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

  const scale = PREVIEW_W / BASE_W;
  const layout = getLayout();

  previewCtx.save();
  previewCtx.setLineDash([5, 4]);
  previewCtx.strokeStyle = "#d6d6d6";
  previewCtx.lineWidth = 1;

  for (let index = 0; index < 6; index++) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = (layout.startX + col * (IMG_W + GAP_X)) * scale;
    const y = (layout.startY + row * (IMG_H + GAP_Y)) * scale;
    previewCtx.strokeRect(x, y, IMG_W * scale, IMG_H * scale);
  }
  previewCtx.restore();

  previewCtx.fillStyle = "#888";
  previewCtx.textAlign = "center";
  previewCtx.font = "bold 18px Arial";
  previewCtx.fillText("Sube hasta 6 imágenes", PREVIEW_W / 2, PREVIEW_H / 2);
}

function updateUI() {
  fileCount.textContent = `${images.length} / 6 imágenes`;
  clearBtn.disabled = images.length === 0;
  downloadBtn.disabled = images.length === 0;

  if (!images.length) {
    status.textContent = "Esperando imágenes";
    drawEmptyPreview();
  } else {
    status.textContent = `${images.length} imagen${images.length === 1 ? "" : "es"} lista${images.length === 1 ? "" : "s"}`;
    drawPreview();
  }
}

function readFiles(fileList) {
  const selected = Array.from(fileList)
    .filter(file => file.type.startsWith("image/"))
    .slice(0, 6);

  images.forEach(item => URL.revokeObjectURL(item.url));
  images = [];

  if (!selected.length) {
    updateUI();
    return;
  }

  let loaded = 0;

  selected.forEach((file, fileIndex) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      images.push({ img, url, name: file.name, fileIndex });
      loaded++;

      if (loaded === selected.length) {
        // Conserva el orden de selección.
        images.sort((a, b) => a.fileIndex - b.fileIndex);
        updateUI();
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      loaded++;
      if (loaded === selected.length) updateUI();
    };

    img.src = url;
  });
}

uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 6) {
    alert("Solo se permiten máximo 6 imágenes. Se tomarán las primeras 6.");
  }
  readFiles(fileInput.files);
  fileInput.value = "";
});

clearBtn.addEventListener("click", () => {
  images.forEach(item => URL.revokeObjectURL(item.url));
  images = [];
  updateUI();
});

downloadBtn.addEventListener("click", () => {
  if (!images.length) return;

  // Canvas de exportación independiente y de alta resolución.
  // No se muestra en pantalla, por lo que la vista previa sigue siendo ligera.
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = BASE_W;
  exportCanvas.height = BASE_H;

  const exportCtx = exportCanvas.getContext("2d", { alpha: false });
  exportCtx.fillStyle = "#fff";
  exportCtx.fillRect(0, 0, BASE_W, BASE_H);

  const layout = getLayout();

  images.forEach((item, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);

    const x = layout.startX + col * (IMG_W + GAP_X);
    const y = layout.startY + row * (IMG_H + GAP_Y);

    // Imagen COMPLETA, sin recorte ni franjas blancas internas.
    // Se estira exactamente a 15.80 x 24.27 cm.
    drawImageContained(exportCtx, item.img, x, y, IMG_W, IMG_H);
  });

  exportCanvas.toBlob(blob => {
    if (!blob) {
      alert("No fue posible generar el JPG. Intenta nuevamente.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "impresion-gusaniza.jpg";
    link.href = url;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/jpeg", 0.95);
});

drawEmptyPreview();
