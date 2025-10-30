import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
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

    // Copy link functionality - click on pit tag to copy
    const pitTag = document.getElementById('pitTag');
    pitTag.addEventListener('click', async () => {
      // Copy viewer link with follow parameter if we're following someone
      let viewerUrl = window.location.origin + '/pit/' + pitSlug + '/viewer';
      if (followingHandle) {
        viewerUrl += '?f=' + followingHandle;
      }
      try {
        await navigator.clipboard.writeText(viewerUrl);
        pitTag.classList.add('copied');
        setTimeout(() => {
          pitTag.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });

    // SYNC PIT home link (no confirmation needed for viewers)
    const pitLabel = document.getElementById('pitLabel');
    pitLabel.addEventListener('click', () => {
      window.location.href = '/';
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

    // Switch to Creator
    document.getElementById('switchCreatorBtn').addEventListener('click', () => {
      window.location.href = `/pit/${pitSlug}/creator`;
    });

    // Setup canvas
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 60;

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

    // Follow mode
    let isFollowing = false;
    let creatorState = null;

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

    // Awareness for following creator
    const awareness = provider.awareness;
    awareness.setLocalStateField('role', 'viewer');
    awareness.setLocalStateField('userHandle', userHandle);

    // Background images cache
    const backgroundImages = {};
    const backgroundPatterns = {};

    // Load background images
    function loadBackgroundImage(name) {
      return new Promise((resolve, reject) => {
        if (backgroundImages[name]) {
          resolve(backgroundImages[name]);
          return;
        }
        const img = new Image();
        img.onload = () => {
          backgroundImages[name] = img;
          resolve(img);
        };
        img.onerror = reject;
        img.src = `/images/${name}.png`;
      });
    }

    // Get or create background pattern
    function getBackgroundPattern(name) {
      if (backgroundPatterns[name]) {
        return backgroundPatterns[name];
      }
      if (backgroundImages[name]) {
        backgroundPatterns[name] = ctx.createPattern(backgroundImages[name], 'repeat');
        return backgroundPatterns[name];
      }
      return null;
    }

    provider.on('status', event => {
      const statusText = document.getElementById('statusText');
      if (event.status === 'connected') {
        statusText.textContent = 'Connected';
        statusText.className = 'connected';

        // Preload background images if needed
        const bg = metadata.get('background');
        if (bg && bg !== '#ffffff') {
          loadBackgroundImage(bg).then(() => {
            redrawCanvas();
          }).catch(err => {
            console.error('Failed to load background:', err);
          });
        }
      } else {
        statusText.textContent = 'Disconnected';
        statusText.className = 'disconnected';
      }
    });

    // Follow mode
    const followBtn = document.getElementById('followBtn');
    const followDropdown = document.getElementById('followDropdown');

    // Check for follow parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const autoFollowHandle = urlParams.get('f');
    let followingHandle = autoFollowHandle || null;
    let followingClientID = null; // Track which specific client we're following

    function toggleFollowDropdown() {
      followDropdown.classList.toggle('active');
    }

    function closeFollowDropdown() {
      followDropdown.classList.remove('active');
    }

    followBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFollowDropdown();
    });

    followDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Close follow dropdown when clicking outside
    document.addEventListener('click', () => {
      closeFollowDropdown();
    });

    // Update follow dropdown with available creators
    function updateFollowDropdown() {
      const states = awareness.getStates();
      const creators = [];

      for (const [clientID, state] of states) {
        if (state.role === 'creator' && state.userHandle) {
          creators.push({
            clientID,
            handle: state.userHandle
          });
        }
      }

      followDropdown.innerHTML = '';

      if (creators.length === 0) {
        const noCreators = document.createElement('div');
        noCreators.className = 'dropdown-item disabled';
        noCreators.textContent = 'No creators online';
        followDropdown.appendChild(noCreators);
      } else {
        creators.forEach(creator => {
          const item = document.createElement('button');
          item.className = 'dropdown-item';
          if (followingHandle === creator.handle) {
            item.classList.add('active');
          }
          item.textContent = `creator:${creator.handle}`;
          item.addEventListener('click', () => {
            if (followingHandle === creator.handle) {
              // Stop following
              followingHandle = null;
              followingClientID = null;
              isFollowing = false;
              followBtn.textContent = 'FOLLOW';
            } else {
              // Start following (will pick first matching creator on next update)
              followingHandle = creator.handle;
              followingClientID = null; // Reset so we pick the first one
              isFollowing = false; // Will be set true when we find them
              followBtn.textContent = `Following ${creator.handle}`;
            }
            closeFollowDropdown();
          });
          followDropdown.appendChild(item);
        });
      }
    }

    // Export button
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

        if (stroke.tool === 'eraser') {
          exportCtx.globalCompositeOperation = 'destination-out';
          exportCtx.lineWidth = 20;
        } else {
          exportCtx.globalCompositeOperation = 'source-over';
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

    // Fixed color palette (20 distinct colors)
    const colorPalette = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
      '#E56B6F', '#6A4C93', '#F72585', '#7209B7', '#3A86FF',
      '#FB5607', '#FFBE0B', '#8338EC', '#06FFA5', '#FF006E'
    ];

    // Track color assignments
    const creatorColors = new Map(); // clientID -> color
    let nextColorIndex = 0;

    function getColorForClient(clientID, role) {
      if (role === 'viewer') {
        return '#999'; // Light gray for viewers
      }

      if (!creatorColors.has(clientID)) {
        creatorColors.set(clientID, colorPalette[nextColorIndex % colorPalette.length]);
        nextColorIndex++;
      }
      return creatorColors.get(clientID);
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

    // Listen to awareness changes (creator cursors and viewports)
    awareness.on('change', () => {
      const states = awareness.getStates();
      const myClientID = awareness.clientID;
      updateFollowDropdown();

      // Track which clients are still active
      const activeClientIDs = new Set();
      let foundFollowingClient = false;

      // Check if we should auto-follow (pick first matching creator)
      if (followingHandle && !isFollowing && !followingClientID) {
        for (const [clientID, state] of states) {
          if (state.role === 'creator' && state.userHandle === followingHandle) {
            isFollowing = true;
            followingClientID = clientID;
            followBtn.textContent = `Following ${followingHandle}`;
            break; // Pick the first one
          }
        }
      }

      // Process all users except ourselves
      for (const [clientID, state] of states) {
        if (clientID === myClientID) continue; // Don't show our own cursor

        if (state.userHandle && state.cursor) {
          activeClientIDs.add(clientID);

          // Check if this is our followed client (only relevant for creators)
          if (state.role === 'creator' && followingClientID === clientID) {
            foundFollowingClient = true;
          }

          // Get color for this client
          const color = getColorForClient(clientID, state.role);

          // Follow viewport only if this is a creator and the specific client we're following
          if (state.role === 'creator' && isFollowing && followingClientID === clientID && state.viewport) {
            viewport.offsetX = state.viewport.offsetX;
            viewport.offsetY = state.viewport.offsetY;
            viewport.scale = state.viewport.scale;
            updateZoomDisplay();
            redrawCanvas();
          }

          // Update cursor position and visibility
          const cursor = getOrCreateCursor(clientID, state.userHandle, state.role, color);
          const screenPos = worldToScreen(state.cursor.x, state.cursor.y);
          const rect = canvas.getBoundingClientRect();

          cursor.style.left = (rect.left + screenPos.x) + 'px';
          cursor.style.top = (rect.top + screenPos.y + 60) + 'px';

          // Only show cursor if we're not following, or if this is the one we're following
          if (!isFollowing || followingClientID === clientID) {
            cursor.style.display = 'block';
          } else {
            cursor.style.display = 'none';
          }
        }
      }

      // If the client we were following disconnected, reset so we can pick another
      if (followingClientID && !foundFollowingClient) {
        followingClientID = null;
        if (followingHandle) {
          isFollowing = false; // Will re-enable if another matching creator appears
        }
      }

      // Remove cursors for users that left
      for (const [clientID, cursor] of userCursors) {
        if (!activeClientIDs.has(clientID)) {
          cursor.remove();
          userCursors.delete(clientID);
          creatorColors.delete(clientID);
        }
      }
    });

    // Drawing functions (read-only with viewport transform)
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fill with background (image pattern or color)
      const bg = metadata.get('background') || '#ffffff';

      if (bg.startsWith('#')) {
        // Solid color background
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (bg) {
        // Background image/pattern - needs to scale with viewport
        const img = backgroundImages[bg];
        if (img) {
          // Save context state
          ctx.save();

          // Apply viewport transform
          ctx.translate(viewport.offsetX, viewport.offsetY);
          ctx.scale(viewport.scale, viewport.scale);

          // Calculate how many tiles we need to cover the visible area
          // Convert screen space to world space for the visible area
          const topLeft = screenToWorld(0, 0);
          const bottomRight = screenToWorld(canvas.width, canvas.height);

          // Calculate tile coverage with some padding
          const padding = img.width * 2;
          const startX = Math.floor(topLeft.x / img.width) * img.width - padding;
          const startY = Math.floor(topLeft.y / img.height) * img.height - padding;
          const endX = Math.ceil(bottomRight.x / img.width) * img.width + padding;
          const endY = Math.ceil(bottomRight.y / img.height) * img.height + padding;

          // Draw tiles to cover the visible area
          for (let x = startX; x < endX; x += img.width) {
            for (let y = startY; y < endY; y += img.height) {
              ctx.drawImage(img, x, y);
            }
          }

          // Restore context state
          ctx.restore();
        } else {
          // Fallback to white if image not loaded yet
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      } else {
        // Default white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      strokes.forEach(stroke => drawStroke(stroke));
    }

    // Update button states based on canvas content
    function updateExportButtons() {
      const isEmpty = strokes.length === 0;
      document.getElementById('exportBtn').disabled = isEmpty;
      document.getElementById('exportFullBtn').disabled = isEmpty;
    }

    // Listen to Yjs changes and redraw
    strokes.observe(() => {
      redrawCanvas();
      updateExportButtons();
    });

    metadata.observe(() => {
      redrawCanvas();
    });

    // Initial button state
    updateExportButtons();

    // Pan interaction
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Pan mode: any mouse button or space key
      if (spacePressed || e.button === 0 || e.button === 1 || e.button === 2) {
        isPanning = true;
        panStart = { x: screenX, y: screenY };
        canvas.classList.add('panning');
        e.preventDefault();

        // Disable follow mode on manual interaction
        if (isFollowing) {
          isFollowing = false;
          followingHandle = null;
          followingClientID = null;
          followBtn.textContent = 'FOLLOW';
        }
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

      if (!isPanning) return;

      const dx = screenX - panStart.x;
      const dy = screenY - panStart.y;
      viewport.offsetX += dx;
      viewport.offsetY += dy;
      panStart = { x: screenX, y: screenY };
      redrawCanvas();
    });

    canvas.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        canvas.classList.remove('panning');
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (isPanning) {
        isPanning = false;
        canvas.classList.remove('panning');
      }
    });

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

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

      // Disable follow mode on manual interaction
      if (isFollowing) {
        isFollowing = false;
        followingHandle = null;
        followingClientID = null;
        followBtn.textContent = 'FOLLOW';
      }
    });

    // Space key for panning
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !spacePressed) {
        spacePressed = true;
        canvas.classList.add('panning');
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

    // Handle window resize
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 60;
      redrawCanvas();
    });

    // Initial draw
    redrawCanvas();

    console.log('[Viewer] Connected to Pit:', pitSlug);
