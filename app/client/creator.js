import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import QRCode from 'qrcode';

// Generate or retrieve user handle
function getUserHandle() {
  let handle = localStorage.getItem('syncpit-user-handle');
  if (!handle) {
    handle = Math.random().toString(36).substring(2, 8);
    localStorage.setItem('syncpit-user-handle', handle);
  }
  return handle;
}

const userHandle = getUserHandle();

// Extract pit slug from URL
const pitSlug = window.location.pathname.split('/')[2];
const slugEl = document.getElementById('slug');
slugEl.textContent = pitSlug;

// Update user handle display
const userHandleEl = document.getElementById('userHandle');
userHandleEl.textContent = userHandle;

// Share dropdown functionality
const pitTag = document.getElementById('pitTag');
const shareDropdown = document.getElementById('shareDropdown');
const shareLinkInput = document.getElementById('shareLinkInput');
const qrcodeContainer = document.getElementById('qrcode');
const copyLinkBtn = document.getElementById('copyLinkBtn');

async function toggleShareDropdown(e) {
  e.stopPropagation();

  // If already open, close it
  if (shareDropdown.classList.contains('active')) {
    closeShareDropdown();
    return;
  }

  // Always use viewer link with follow parameter
  const viewerUrl = window.location.origin + '/pit/' + pitSlug + '/viewer?f=' + userHandle;

  // Set the link in the input
  shareLinkInput.value = viewerUrl;

  // Clear previous QR code
  qrcodeContainer.innerHTML = '';

  // Generate QR code
  try {
    await QRCode.toCanvas(viewerUrl, {
      width: 180,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).then(canvas => {
      qrcodeContainer.appendChild(canvas);
    });
  } catch (err) {
    console.error('Failed to generate QR code:', err);
    qrcodeContainer.innerHTML = '<p style="color: #f00; font-size: 11px;">QR generation failed</p>';
  }

  // Show dropdown
  shareDropdown.classList.add('active');
}

function closeShareDropdown() {
  shareDropdown.classList.remove('active');
  copyLinkBtn.classList.remove('copied');
  copyLinkBtn.textContent = 'COPY';
}

pitTag.addEventListener('click', toggleShareDropdown);

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!shareDropdown.contains(e.target) && e.target !== pitTag) {
    closeShareDropdown();
  }
});

shareDropdown.addEventListener('click', (e) => {
  e.stopPropagation();
});

copyLinkBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    copyLinkBtn.classList.add('copied');
    copyLinkBtn.textContent = 'COPIED!';
    setTimeout(() => {
      copyLinkBtn.classList.remove('copied');
      copyLinkBtn.textContent = 'COPY';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
});

// SYNC PIT home link with confirmation
const pitLabel = document.getElementById('pitLabel');
pitLabel.addEventListener('click', () => {
  const confirmed = confirm('Are you sure you want to leave this pit and go back home?');
  if (confirmed) {
    window.location.href = '/';
  }
});

// Role dropdown functionality
const roleTag = document.getElementById('roleTag');
const roleDropdown = document.getElementById('roleDropdown');

function toggleRoleDropdown() {
  roleDropdown.classList.toggle('active');
}

function closeRoleDropdown() {
  roleDropdown.classList.remove('active');
}

roleTag.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleRoleDropdown();
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
  closeRoleDropdown();
});

roleDropdown.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Handle change modal
const handleModal = document.getElementById('handleModal');
const handleInput = document.getElementById('handleInput');
const handleError = document.getElementById('handleError');

function openHandleModal() {
  handleInput.value = userHandle;
  handleError.textContent = '';
  handleModal.classList.add('active');
  setTimeout(() => handleInput.focus(), 100);
}

function closeHandleModal() {
  handleModal.classList.remove('active');
}

function validateHandle(handle) {
  if (!handle || handle.length === 0) {
    return 'Handle cannot be empty';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(handle)) {
    return 'Only letters, numbers, dots, hyphens, and underscores allowed';
  }
  return null;
}

// Change Handle
document.getElementById('changeHandleBtn').addEventListener('click', () => {
  openHandleModal();
  closeRoleDropdown();
});

document.getElementById('closeHandleModal').addEventListener('click', closeHandleModal);

document.getElementById('cancelHandleBtn').addEventListener('click', closeHandleModal);

document.getElementById('saveHandleBtn').addEventListener('click', () => {
  const newHandle = handleInput.value.trim();
  const error = validateHandle(newHandle);

  if (error) {
    handleError.textContent = error;
    return;
  }

  localStorage.setItem('syncpit-user-handle', newHandle);
  userHandleEl.textContent = newHandle;
  awareness.setLocalStateField('userHandle', newHandle);
  closeHandleModal();
});

// Allow Enter key to save
handleInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('saveHandleBtn').click();
  }
});

// Real-time validation feedback
handleInput.addEventListener('input', () => {
  const handle = handleInput.value.trim();
  const error = validateHandle(handle);
  handleError.textContent = error || '';
});

// Close modal on click outside
handleModal.addEventListener('click', (e) => {
  if (e.target === handleModal) {
    closeHandleModal();
  }
});

// Switch to Viewer
document.getElementById('switchViewerBtn').addEventListener('click', () => {
  window.location.href = `/pit/${pitSlug}/viewer`;
});

// Setup canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight - 60;

// Drawing state
let isDrawing = false;
let currentColor = '#8338ec';
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

// Undo/Redo manager
const undoManager = new Y.UndoManager(strokes);

// WebSocket connection
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}`;
const provider = new WebsocketProvider(wsUrl, pitSlug, ydoc);

// Awareness for ephemeral state (cursor, viewport)
const awareness = provider.awareness;
awareness.setLocalStateField('role', 'creator');
awareness.setLocalStateField('userHandle', userHandle);
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

// Undo/Redo buttons
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

function updateUndoRedoButtons() {
  undoBtn.disabled = !undoManager.canUndo();
  redoBtn.disabled = !undoManager.canRedo();
}

undoBtn.addEventListener('click', () => {
  undoManager.undo();
  updateUndoRedoButtons();
  redrawCanvas();
});

redoBtn.addEventListener('click', () => {
  undoManager.redo();
  updateUndoRedoButtons();
  redrawCanvas();
});

// Listen for undo manager changes
undoManager.on('stack-item-added', updateUndoRedoButtons);
undoManager.on('stack-item-popped', updateUndoRedoButtons);

// Keyboard shortcuts for undo/redo
window.addEventListener('keydown', (e) => {
  // Ctrl+Z or Cmd+Z for undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    if (undoManager.canUndo()) {
      undoManager.undo();
      updateUndoRedoButtons();
      redrawCanvas();
    }
  }
  // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z for redo
  else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    if (undoManager.canRedo()) {
      undoManager.redo();
      updateUndoRedoButtons();
      redrawCanvas();
    }
  }
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

    exportCtx.lineCap = 'round';
    exportCtx.lineJoin = 'round';

    // Handle eraser strokes
    if (stroke.tool === 'eraser') {
      exportCtx.globalCompositeOperation = 'destination-out';
      exportCtx.strokeStyle = 'rgba(0,0,0,1)'; // Opaque black for erasing
      exportCtx.lineWidth = 20;
    } else {
      exportCtx.globalCompositeOperation = 'source-over';
      exportCtx.strokeStyle = stroke.color || '#000000';
      exportCtx.lineWidth = stroke.width || 3;
    }

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
    updateUndoRedoButtons();
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
    updateUndoRedoButtons();
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

// Touch support with pinch-to-zoom and two-finger pan
let touchStartDistance = 0;
let touchStartScale = 1;
let touchStartCenter = { x: 0, y: 0 };
let touchPanStart = { x: 0, y: 0 };
let isTouchPanning = false;

function getTouchDistance(touch1, touch2) {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touch1, touch2, rect) {
  return {
    x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
    y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
  };
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();

  if (e.touches.length === 2) {
    // Two-finger gesture: prepare for pinch zoom or pan
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];

    touchStartDistance = getTouchDistance(touch1, touch2);
    touchStartScale = viewport.scale;

    const center = getTouchCenter(touch1, touch2, rect);
    touchStartCenter = center;
    touchPanStart = { x: center.x, y: center.y };
    isTouchPanning = true;

    // Broadcast cursor position at center of pinch
    const worldPos = screenToWorld(center.x, center.y);
    awareness.setLocalStateField('cursor', {
      x: worldPos.x,
      y: worldPos.y
    });

    // Cancel any drawing in progress
    if (isDrawing && currentStroke) {
      strokes.push([currentStroke]);
      isDrawing = false;
      currentStroke = null;
      updateUndoRedoButtons();
    }
  } else if (e.touches.length === 1) {
    // Single finger: drawing
    const touch = e.touches[0];
    const screenX = touch.clientX - rect.left;
    const screenY = touch.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);

    // Broadcast cursor position
    awareness.setLocalStateField('cursor', {
      x: worldPos.x,
      y: worldPos.y
    });

    isDrawing = true;
    currentStroke = {
      points: [worldPos],
      color: currentColor,
      width: lineWidth,
      tool: currentTool
    };
  }
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();

  if (e.touches.length === 2 && isTouchPanning) {
    // Two-finger gesture: pinch zoom and pan
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];

    // Calculate pinch zoom
    const currentDistance = getTouchDistance(touch1, touch2);
    const scaleChange = currentDistance / touchStartDistance;
    const newScale = Math.min(Math.max(touchStartScale * scaleChange, 0.1), 10);

    // Get current center
    const currentCenter = getTouchCenter(touch1, touch2, rect);

    // Broadcast cursor position at center of pinch
    const worldPos = screenToWorld(currentCenter.x, currentCenter.y);
    awareness.setLocalStateField('cursor', {
      x: worldPos.x,
      y: worldPos.y
    });

    // Calculate zoom around the pinch center
    const worldBefore = screenToWorld(touchStartCenter.x, touchStartCenter.y);
    viewport.scale = newScale;
    const worldAfter = screenToWorld(touchStartCenter.x, touchStartCenter.y);

    // Adjust for zoom
    viewport.offsetX += (worldAfter.x - worldBefore.x) * viewport.scale;
    viewport.offsetY += (worldAfter.y - worldBefore.y) * viewport.scale;

    // Apply pan based on center movement
    const panDx = currentCenter.x - touchPanStart.x;
    const panDy = currentCenter.y - touchPanStart.y;
    viewport.offsetX += panDx;
    viewport.offsetY += panDy;
    touchPanStart = currentCenter;

    updateZoomDisplay();
    redrawCanvas();
    broadcastViewport();
  } else if (e.touches.length === 1 && isDrawing && currentStroke) {
    // Single finger: continue drawing
    const touch = e.touches[0];
    const screenX = touch.clientX - rect.left;
    const screenY = touch.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);

    // Broadcast cursor position
    awareness.setLocalStateField('cursor', {
      x: worldPos.x,
      y: worldPos.y
    });

    currentStroke.points.push(worldPos);

    redrawCanvas();
    drawStroke(currentStroke);
  }
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();

  if (e.touches.length < 2) {
    isTouchPanning = false;
  }

  if (e.touches.length === 0) {
    // All fingers lifted
    if (isDrawing && currentStroke) {
      strokes.push([currentStroke]);
      isDrawing = false;
      currentStroke = null;
      updateUndoRedoButtons();
    }
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 60;
  redrawCanvas();
});

// Fixed color palette (20 distinct colors)
const colorPalette = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
  '#E56B6F', '#6A4C93', '#F72585', '#7209B7', '#3A86FF',
  '#FB5607', '#FFBE0B', '#8338EC', '#06FFA5', '#FF006E'
];

// Track color assignments
const userColors = new Map(); // clientID -> color
let nextColorIndex = 0;

function getColorForClient(clientID, role) {
  if (role === 'viewer') {
    return '#999'; // Light gray for viewers
  }

  if (!userColors.has(clientID)) {
    userColors.set(clientID, colorPalette[nextColorIndex % colorPalette.length]);
    nextColorIndex++;
  }
  return userColors.get(clientID);
}

// Cursor elements for each user (keyed by clientID)
const userCursors = new Map();

function getOrCreateCursor(clientID, handle, role, color) {
  if (!userCursors.has(clientID)) {
    const cursor = document.createElement('div');
    cursor.className = role === 'viewer' ? 'viewer-cursor' : 'creator-cursor';
    cursor.style.borderColor = color;
    const label = document.createElement('div');
    label.className = 'cursor-label';
    label.style.borderColor = color;
    label.textContent = `${role}:${handle}`;
    cursor.appendChild(label);
    document.body.appendChild(cursor);
    userCursors.set(clientID, cursor);
  }
  return userCursors.get(clientID);
}

// Listen to awareness changes (other users' cursors)
awareness.on('change', () => {
  const states = awareness.getStates();
  const myClientID = awareness.clientID;
  const activeClientIDs = new Set();

  // Process all users except ourselves
  for (const [clientID, state] of states) {
    if (clientID === myClientID) continue; // Don't show our own cursor

    if (state.userHandle && state.cursor) {
      activeClientIDs.add(clientID);

      const color = getColorForClient(clientID, state.role);
      const cursor = getOrCreateCursor(clientID, state.userHandle, state.role, color);
      const screenPos = worldToScreen(state.cursor.x, state.cursor.y);
      const rect = canvas.getBoundingClientRect();

      cursor.style.left = (rect.left + screenPos.x) + 'px';
      cursor.style.top = (rect.top + screenPos.y + 60) + 'px';
      cursor.style.display = 'block';
    }
  }

  // Remove cursors for users that left
  for (const [clientID, cursor] of userCursors) {
    if (!activeClientIDs.has(clientID)) {
      cursor.remove();
      userCursors.delete(clientID);
      userColors.delete(clientID);
    }
  }
});

// Initial draw
redrawCanvas();
