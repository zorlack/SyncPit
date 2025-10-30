import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
    // Extract pit slug from URL
    const pitSlug = window.location.pathname.split('/')[2];
    document.getElementById('slug').textContent = pitSlug;

    // Copy link functionality
    const copyBtn = document.getElementById('copyBtn');
    copyBtn.addEventListener('click', async () => {
      // Always copy viewer link
      const viewerUrl = window.location.origin + '/pit/' + pitSlug + '/viewer';
      try {
        await navigator.clipboard.writeText(viewerUrl);
        copyBtn.textContent = 'COPIED!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'COPY LINK';
          copyBtn.classList.remove('copied');
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

    // WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    const provider = new WebsocketProvider(wsUrl, pitSlug, ydoc);

    // Awareness for following creator
    const awareness = provider.awareness;
    awareness.setLocalStateField('role', 'viewer');

    provider.on('status', event => {
      const statusText = document.getElementById('statusText');
      if (event.status === 'connected') {
        statusText.textContent = 'Connected';
        statusText.className = 'connected';
      } else {
        statusText.textContent = 'Disconnected';
        statusText.className = 'disconnected';
      }
    });

    // Follow mode toggle
    const followBtn = document.getElementById('followBtn');
    const creatorCursor = document.getElementById('creatorCursor');

    followBtn.addEventListener('click', () => {
      isFollowing = !isFollowing;
      followBtn.classList.toggle('active', isFollowing);
      followBtn.textContent = isFollowing ? 'Following...' : 'Follow Creator';

      if (!isFollowing) {
        creatorCursor.style.display = 'none';
      }
    });

    // Listen to awareness changes (creator cursor and viewport)
    awareness.on('change', () => {
      const states = awareness.getStates();

      // Find creator
      for (const [clientID, state] of states) {
        if (state.role === 'creator') {
          creatorState = state;

          // Follow viewport if enabled (do this BEFORE cursor positioning)
          if (isFollowing && state.viewport) {
            viewport.offsetX = state.viewport.offsetX;
            viewport.offsetY = state.viewport.offsetY;
            viewport.scale = state.viewport.scale;
            updateZoomDisplay();
            redrawCanvas();
          }

          // Update cursor position (after viewport sync)
          if (state.cursor) {
            const screenPos = worldToScreen(state.cursor.x, state.cursor.y);
            const rect = canvas.getBoundingClientRect();

            creatorCursor.style.left = (rect.left + screenPos.x) + 'px';
            creatorCursor.style.top = (rect.top + screenPos.y + 60) + 'px';
            creatorCursor.style.display = 'block';
          }

          break;
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
      strokes.forEach(stroke => drawStroke(stroke));
    }

    // Listen to Yjs changes and redraw
    strokes.observe(() => {
      redrawCanvas();
    });

    // Pan interaction
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Pan mode: any mouse button or space key
      if (spacePressed || e.button === 0 || e.button === 1) {
        isPanning = true;
        panStart = { x: screenX, y: screenY };
        canvas.classList.add('panning');
        e.preventDefault();

        // Disable follow mode on manual interaction
        if (isFollowing) {
          isFollowing = false;
          followBtn.classList.remove('active');
          followBtn.textContent = 'Follow Creator';
        }
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isPanning) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

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
        followBtn.classList.remove('active');
        followBtn.textContent = 'Follow Creator';
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
