import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Extract pit slug from URL
const pitSlug = window.location.pathname.split('/')[2];
const slugEl = document.getElementById('slug');
slugEl.textContent = pitSlug;

// Copy link functionality - click on slug to copy
slugEl.addEventListener('click', async () => {
  // Always copy viewer link
  const viewerUrl = window.location.origin + '/pit/' + pitSlug + '/viewer';
  try {
    await navigator.clipboard.writeText(viewerUrl);
    const originalText = slugEl.textContent;
    slugEl.textContent = 'COPIED!';
    slugEl.classList.add('copied');
    setTimeout(() => {
      slugEl.textContent = originalText;
      slugEl.classList.remove('copied');
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
});

// Setup canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight - 60;

// Drawing state
let isDrawing = false;
let currentColor = '#000000';
let currentTool = 'pen';
let lineWidth = 3;

// Viewport state (for zoom/pan)
let viewport = {
  offsetX: 0,
  offsetY: 0,
  scale: 1.0
};

// Pan state
let isPanning = false;
let panStart = { x: 0, y: 0 };
let spacePressed = false;

// Transform functions
function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - viewport.offsetX) / viewport.scale,
    y: (screenY - viewport.offsetY) / viewport.scale
  };
}

function worldToScreen(worldX, worldY) {
  return {
    x: worldX * viewport.scale + viewport.offsetX,
    y: worldY * viewport.scale + viewport.offsetY
  };
}

function updateZoomDisplay() {
  document.getElementById('zoomLevel').textContent = Math.round(viewport.scale * 100) + '%';
}

// Yjs setup
const ydoc = new Y.Doc();
const strokes = ydoc.getArray('strokes');
const metadata = ydoc.getMap('metadata');

// WebSocket connection
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}`;
const provider = new WebsocketProvider(wsUrl, pitSlug, ydoc);

// Awareness for ephemeral state (cursor, viewport)
const awareness = provider.awareness;
awareness.setLocalStateField('role', 'creator');
awareness.setLocalStateField('viewport', viewport);

// Broadcast viewport changes
function broadcastViewport() {
  awareness.setLocalStateField('viewport', {
    offsetX: viewport.offsetX,
    offsetY: viewport.offsetY,
    scale: viewport.scale
  });
}

provider.on('status', event => {
  const statusText = document.getElementById('statusText');
  if (event.status === 'connected') {
    statusText.textContent = 'Connected';
    statusText.className = 'connected';
    broadcastViewport();
  } else {
    statusText.textContent = 'Disconnected';
    statusText.className = 'disconnected';
  }
});

// Tool buttons
document.getElementById('penBtn').addEventListener('click', () => {
  currentTool = 'pen';
  document.getElementById('penBtn').classList.add('active');
  document.getElementById('eraserBtn').classList.remove('active');
});

document.getElementById('eraserBtn').addEventListener('click', () => {
  currentTool = 'eraser';
  document.getElementById('eraserBtn').classList.add('active');
  document.getElementById('penBtn').classList.remove('active');
});

// Color picker
const colorBtn = document.getElementById('colorBtn');
const colorSwatches = document.getElementById('colorSwatches');
const customColorPicker = document.getElementById('customColorPicker');

// Set initial color
colorBtn.style.background = currentColor;

// Toggle swatch panel
colorBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  colorSwatches.classList.toggle('active');
});

// Close swatch panel when clicking outside
document.addEventListener('click', () => {
  colorSwatches.classList.remove('active');
});

colorSwatches.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Handle swatch selection
document.querySelectorAll('.swatch:not(.custom)').forEach(swatch => {
  swatch.addEventListener('click', () => {
    currentColor = swatch.getAttribute('data-color');
    colorBtn.style.background = currentColor;
    colorSwatches.classList.remove('active');

    if (currentTool === 'eraser') {
      currentTool = 'pen';
      document.getElementById('penBtn').classList.add('active');
      document.getElementById('eraserBtn').classList.remove('active');
    }
  });
});

// Handle custom color picker
customColorPicker.addEventListener('input', (e) => {
  currentColor = e.target.value;
  colorBtn.style.background = currentColor;

  if (currentTool === 'eraser') {
    currentTool = 'pen';
    document.getElementById('penBtn').classList.add('active');
    document.getElementById('eraserBtn').classList.remove('active');
  }
});

customColorPicker.addEventListener('change', () => {
  colorSwatches.classList.remove('active');
});

document.getElementById('exportBtn').addEventListener('click', () => {
  // Create a temporary canvas for export with white background
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext('2d');

  // Fill with white background
  exportCtx.fillStyle = '#ffffff';
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // Draw the current canvas on top
  exportCtx.drawImage(canvas, 0, 0);

  // Export as PNG
  exportCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pit-${pitSlug}-view-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

document.getElementById('exportFullBtn').addEventListener('click', () => {
  // Calculate bounding box of all strokes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  strokes.forEach(stroke => {
    if (!stroke || !stroke.points) return;
    stroke.points.forEach(pt => {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    });
  });

  // If no strokes, export empty canvas
  if (minX === Infinity) {
    alert('Nothing to export - canvas is empty!');
    return;
  }

  // Add padding
  const padding = 50;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const width = Math.ceil(maxX - minX);
  const height = Math.ceil(maxY - minY);

  // Create export canvas
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportCtx = exportCanvas.getContext('2d');

  // Fill with white background
  exportCtx.fillStyle = '#ffffff';
  exportCtx.fillRect(0, 0, width, height);

  // Draw all strokes in world coordinates (offset by minX, minY)
  strokes.forEach(stroke => {
    if (!stroke || !stroke.points || stroke.points.length < 2) return;

    exportCtx.strokeStyle = stroke.color || '#000000';
    exportCtx.lineWidth = stroke.width || 3;
    exportCtx.lineCap = 'round';
    exportCtx.lineJoin = 'round';

    exportCtx.beginPath();
    const startX = stroke.points[0].x - minX;
    const startY = stroke.points[0].y - minY;
    exportCtx.moveTo(startX, startY);

    for (let i = 1; i < stroke.points.length; i++) {
      const x = stroke.points[i].x - minX;
      const y = stroke.points[i].y - minY;
      exportCtx.lineTo(x, y);
    }

    exportCtx.stroke();
  });

  // Export as PNG
  exportCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pit-${pitSlug}-full-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

// Bail modal functions
function openBailModal() {
  document.getElementById('bailModal').classList.add('active');
}

function closeBailModal() {
  document.getElementById('bailModal').classList.remove('active');
}

// Make closeBailModal globally available for inline onclick
window.closeBailModal = closeBailModal;

document.getElementById('bailBtn').addEventListener('click', openBailModal);

// Close modal when clicking outside
document.getElementById('bailModal').addEventListener('click', (e) => {
  if (e.target.id === 'bailModal') {
    closeBailModal();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeBailModal();
  }
});

// Save before bail
document.getElementById('saveBeforeBailBtn').addEventListener('click', () => {
  // Trigger full export
  document.getElementById('exportFullBtn').click();
  // Don't close modal - let user choose what to do next
});

// Flush the pit
document.getElementById('flushBtn').addEventListener('click', () => {
  ydoc.transact(() => {
    strokes.delete(0, strokes.length);
  });
  closeBailModal();
});

// Bail to home
document.getElementById('bailHomeBtn').addEventListener('click', () => {
  window.location.href = '/';
});

// Drawing functions
function drawStroke(stroke) {
  if (!stroke || !stroke.points || stroke.points.length < 2) return;

  ctx.strokeStyle = stroke.color || '#000000';
  ctx.lineWidth = (stroke.width || 3) * viewport.scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 20 * viewport.scale;
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.beginPath();

  // Transform world coordinates to screen coordinates
  const start = worldToScreen(stroke.points[0].x, stroke.points[0].y);
  ctx.moveTo(start.x, start.y);

  for (let i = 1; i < stroke.points.length; i++) {
    const pt = worldToScreen(stroke.points[i].x, stroke.points[i].y);
    ctx.lineTo(pt.x, pt.y);
  }

  ctx.stroke();
}

function redrawCanvas() {
  // Clear entire canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fill with background color (default to white if not set)
  const bgColor = metadata.get('background') || '#ffffff';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw all strokes with current viewport transform
  strokes.forEach(stroke => drawStroke(stroke));
}

// Update button states based on canvas content
function updateExportButtons() {
  const isEmpty = strokes.length === 0;
  document.getElementById('exportBtn').disabled = isEmpty;
  document.getElementById('exportFullBtn').disabled = isEmpty;
  document.getElementById('saveBeforeBailBtn').disabled = isEmpty;
}

// Listen to Yjs changes
strokes.observe(() => {
  redrawCanvas();
  updateExportButtons();
});

metadata.observe(() => {
  redrawCanvas();
});

// Initial button state
updateExportButtons();

// Drawing interaction
let currentStroke = null;

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  // Pan mode: space key, middle mouse button, or right mouse button
  if (spacePressed || e.button === 1 || e.button === 2) {
    isPanning = true;
    panStart = { x: screenX, y: screenY };
    canvas.classList.add('panning');
    e.preventDefault();
    return;
  }

  // Drawing mode: left mouse button
  if (e.button === 0) {
    isDrawing = true;
    const worldPos = screenToWorld(screenX, screenY);
    currentStroke = {
      points: [worldPos],
      color: currentColor,
      width: lineWidth,
      tool: currentTool
    };
  }
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  // Broadcast cursor position (world coordinates)
  const worldPos = screenToWorld(screenX, screenY);
  awareness.setLocalStateField('cursor', {
    x: worldPos.x,
    y: worldPos.y
  });

  // Handle panning
  if (isPanning) {
    const dx = screenX - panStart.x;
    const dy = screenY - panStart.y;
    viewport.offsetX += dx;
    viewport.offsetY += dy;
    panStart = { x: screenX, y: screenY };
    redrawCanvas();
    broadcastViewport();
    return;
  }

  // Handle drawing
  if (!isDrawing || !currentStroke) return;

  currentStroke.points.push(worldPos);

  // Draw locally for immediate feedback
  redrawCanvas();
  drawStroke(currentStroke);
});

canvas.addEventListener('mouseup', (e) => {
  if (isPanning) {
    isPanning = false;
    canvas.classList.remove('panning');
  }

  if (isDrawing && currentStroke) {
    // Add stroke to Yjs document
    strokes.push([currentStroke]);
    isDrawing = false;
    currentStroke = null;
  }
});

canvas.addEventListener('mouseleave', () => {
  if (isPanning) {
    isPanning = false;
    canvas.classList.remove('panning');
  }

  if (isDrawing && currentStroke) {
    strokes.push([currentStroke]);
    isDrawing = false;
    currentStroke = null;
  }
});

// Prevent context menu on right click / middle click
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Mouse wheel zoom
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Get world position before zoom
  const worldBefore = screenToWorld(mouseX, mouseY);

  // Calculate zoom change
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.min(Math.max(viewport.scale * zoomFactor, 0.1), 10);

  viewport.scale = newScale;

  // Get world position after zoom
  const worldAfter = screenToWorld(mouseX, mouseY);

  // Adjust offset to keep mouse position fixed
  viewport.offsetX += (worldAfter.x - worldBefore.x) * viewport.scale;
  viewport.offsetY += (worldAfter.y - worldBefore.y) * viewport.scale;

  updateZoomDisplay();
  redrawCanvas();
  broadcastViewport();
});

// Space key for panning
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !spacePressed) {
    spacePressed = true;
    if (!isDrawing) {
      canvas.classList.add('panning');
    }
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    spacePressed = false;
    if (!isPanning) {
      canvas.classList.remove('panning');
    }
  }
});

// Touch support (with world coordinates)
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const screenX = touch.clientX - rect.left;
  const screenY = touch.clientY - rect.top;
  const worldPos = screenToWorld(screenX, screenY);

  isDrawing = true;
  currentStroke = {
    points: [worldPos],
    color: currentColor,
    width: lineWidth,
    tool: currentTool
  };
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!isDrawing || !currentStroke) return;

  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const screenX = touch.clientX - rect.left;
  const screenY = touch.clientY - rect.top;
  const worldPos = screenToWorld(screenX, screenY);

  currentStroke.points.push(worldPos);

  redrawCanvas();
  drawStroke(currentStroke);
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (isDrawing && currentStroke) {
    strokes.push([currentStroke]);
    isDrawing = false;
    currentStroke = null;
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 60;
  redrawCanvas();
});

// Initial draw
redrawCanvas();
