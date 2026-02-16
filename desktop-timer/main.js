const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const nodePath = require('path');
const https = require('https');
const Store = require('electron-store');

const store = new Store();

let mainWindow = null;
let miniBar = null;
let tray = null;
let isQuitting = false;

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  // Build icons before creating window so we can set the window icon
  buildTrayIcons();

  mainWindow = new BrowserWindow({
    width: 300,
    height: 380,
    x: screenW - 310,
    y: screenH - 390,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    skipTaskbar: false,
    show: false,
    icon: trayIconNormal,
    webPreferences: {
      preload: nodePath.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // When minimized, show mini bar if timer is running
  mainWindow.on('minimize', () => {
    mainWindow.webContents.send('check-timer-for-minibar');
  });
}

// =============================================
// Mini Bar — small overlay at bottom-right
// =============================================

function createMiniBar(timerText) {
  if (miniBar && !miniBar.isDestroyed()) {
    miniBar.webContents.send('update-timer', timerText);
    return;
  }

  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  miniBar = new BrowserWindow({
    width: 220,
    height: 36,
    x: screenW - 230,
    y: screenH - 46,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: nodePath.join(__dirname, 'preload-mini.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  miniBar.loadFile('minibar.html');
  miniBar.setIgnoreMouseEvents(false);

  miniBar.on('closed', () => { miniBar = null; });
}

function closeMiniBar() {
  if (miniBar && !miniBar.isDestroyed()) {
    miniBar.close();
    miniBar = null;
  }
}

function createTray() {
  buildTrayIcons();

  tray = new Tray(trayIconNormal);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Timer', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setToolTip('StudioFlow Timer');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

// =============================================
// Programmatic Icon Generation — Purple Timer
// =============================================

function createTimerIconBMP(size, withRedDot) {
  // Create a BMP with a purple circle (clock face) + clock hands
  // BMP format: header (54 bytes) + BGRA pixel data
  const buf = Buffer.alloc(54 + size * size * 4, 0);
  buf.write('BM', 0);
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(size, 18);
  buf.writeInt32LE(-size, 22); // top-down
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(32, 28);
  buf.writeUInt32LE(0, 30); // BI_RGB
  buf.writeUInt32LE(size * size * 4, 34);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 0.5;
  const innerR = outerR - (size >= 32 ? 2.5 : 1.5);

  // Red dot parameters
  const dotR = size >= 32 ? 4.5 : 3;
  const dotCx = size - dotR - 0.5;
  const dotCy = dotR + 0.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = 54 + (y * size + x) * 4;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Red dot (on top, drawn first so clock body goes under)
      if (withRedDot) {
        const ddx = x + 0.5 - dotCx;
        const ddy = y + 0.5 - dotCy;
        const dotDist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dotDist <= dotR) {
          // Red dot with anti-aliased edge
          const edge = dotR - dotDist;
          const alpha = Math.min(1, edge * 1.5);
          if (alpha > 0.1) {
            // Bright red
            buf[o]     = 0x33;  // B
            buf[o + 1] = 0x33;  // G
            buf[o + 2] = 0xEE;  // R
            buf[o + 3] = Math.round(alpha * 255);
            continue;
          }
        }
      }

      // Clock ring (purple border)
      if (dist <= outerR && dist >= innerR) {
        const edgeOuter = outerR - dist;
        const edgeInner = dist - innerR;
        const alpha = Math.min(1, edgeOuter * 1.5, edgeInner * 1.5);
        // Purple #a657f0 = R:166 G:87 B:240 → BMP is BGRA
        buf[o]     = Math.round(0xf0 * alpha);  // B = 240
        buf[o + 1] = Math.round(0x57 * alpha);  // G = 87
        buf[o + 2] = Math.round(0xa6 * alpha);  // R = 166
        buf[o + 3] = Math.round(alpha * 255);
      }
      // Clock face interior (dark fill)
      else if (dist < innerR) {
        const edgeInner = innerR - dist;
        const alpha = Math.min(1, edgeInner * 1.5);
        // Dark interior #1a1a2e
        buf[o]     = Math.round(0x2e * alpha);  // B
        buf[o + 1] = Math.round(0x1a * alpha);  // G
        buf[o + 2] = Math.round(0x1a * alpha);  // R
        buf[o + 3] = Math.round(alpha * 255);

        // Clock hands (draw on top of face)
        // Hour hand: points to ~10 o'clock (about 300 degrees, or -60 degrees)
        const hourAngle = -60 * (Math.PI / 180);
        const hourLen = innerR * 0.5;
        const hourEndX = cx + Math.sin(hourAngle) * hourLen;
        const hourEndY = cy - Math.cos(hourAngle) * hourLen;

        // Minute hand: points to ~2 o'clock (about 60 degrees)
        const minAngle = 60 * (Math.PI / 180);
        const minLen = innerR * 0.75;
        const minEndX = cx + Math.sin(minAngle) * minLen;
        const minEndY = cy - Math.cos(minAngle) * minLen;

        const thickness = size >= 32 ? 1.3 : 0.9;

        // Distance from pixel to hour hand line segment
        const hourDist = distToSegment(x + 0.5, y + 0.5, cx, cy, hourEndX, hourEndY);
        if (hourDist <= thickness) {
          const a2 = Math.min(1, (thickness - hourDist) * 1.5);
          buf[o]     = Math.round(0xff * a2 + buf[o] * (1 - a2));
          buf[o + 1] = Math.round(0xff * a2 + buf[o + 1] * (1 - a2));
          buf[o + 2] = Math.round(0xff * a2 + buf[o + 2] * (1 - a2));
          buf[o + 3] = 0xff;
        }

        // Distance from pixel to minute hand line segment
        const minDist = distToSegment(x + 0.5, y + 0.5, cx, cy, minEndX, minEndY);
        if (minDist <= thickness) {
          const a2 = Math.min(1, (thickness - minDist) * 1.5);
          buf[o]     = Math.round(0xff * a2 + buf[o] * (1 - a2));
          buf[o + 1] = Math.round(0xff * a2 + buf[o + 1] * (1 - a2));
          buf[o + 2] = Math.round(0xff * a2 + buf[o + 2] * (1 - a2));
          buf[o + 3] = 0xff;
        }

        // Center dot
        const centerDotR = size >= 32 ? 1.5 : 1;
        if (dist <= centerDotR) {
          buf[o]     = 0xff;
          buf[o + 1] = 0xff;
          buf[o + 2] = 0xff;
          buf[o + 3] = 0xff;
        }
      }
    }
  }
  return buf;
}

// Distance from point (px,py) to line segment (ax,ay)-(bx,by)
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nearX = ax + t * dx, nearY = ay + t * dy;
  return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
}

let trayIconNormal = null;
let trayIconActive = null;

function buildTrayIcons() {
  if (trayIconNormal) return; // already built
  const size = 32;
  trayIconNormal = nativeImage.createFromBuffer(createTimerIconBMP(size, false), {
    width: size, height: size, scaleFactor: 2.0,
  });
  trayIconActive = nativeImage.createFromBuffer(createTimerIconBMP(size, true), {
    width: size, height: size, scaleFactor: 2.0,
  });
}

function setTrayTimerActive(active) {
  if (tray) tray.setImage(active ? trayIconActive : trayIconNormal);
  if (mainWindow) mainWindow.setIcon(active ? trayIconActive : trayIconNormal);
}

// =============================================
// IPC Handlers
// =============================================

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:close', () => {
  isQuitting = true;
  closeMiniBar();
  if (mainWindow) mainWindow.destroy();
  app.quit();
});

ipcMain.on('window:title', (_, title) => {
  if (mainWindow) mainWindow.setTitle(title);
});

// Mini bar controls
ipcMain.on('minibar:show', (_, timerText) => {
  createMiniBar(timerText);
});

ipcMain.on('minibar:update', (_, timerText) => {
  if (miniBar && !miniBar.isDestroyed()) {
    miniBar.webContents.send('update-timer', timerText);
  }
});

ipcMain.on('minibar:hide', () => {
  closeMiniBar();
});

ipcMain.on('minibar:restore', () => {
  closeMiniBar();
  if (mainWindow) {
    mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// Tray icon state — show red dot when timer is active
ipcMain.on('tray:timer-state', (_, isActive) => {
  setTrayTimerActive(!!isActive);
});

ipcMain.handle('store:get', (_, key) => store.get(key));
ipcMain.handle('store:set', (_, key, value) => store.set(key, value));
ipcMain.handle('store:delete', (_, key) => store.delete(key));

// API proxy — uses Node.js https to avoid Electron/Chromium SSL issues
ipcMain.handle('api:request', async (_, args) => {
  const { method, path: urlPath, body, token, apiKey, apiUrl: baseUrl } = args || {};
  try {
    const url = `${baseUrl || ''}${urlPath || ''}`;
    const headers = { 'Content-Type': 'application/json' };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (apiKey) {
      headers['X-Extension-Key'] = apiKey;
    }

    const bodyStr = (body && method !== 'GET') ? JSON.stringify(body) : null;

    const result = await new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const reqOptions = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: method || 'GET',
        headers,
        rejectUnauthorized: false,
      };

      const req = https.request(reqOptions, (res) => {
        let chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data;
          try { data = JSON.parse(text); } catch { data = { error: 'Invalid response', raw: text.substring(0, 200) }; }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data });
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });

      if (bodyStr) req.write(bodyStr);
      req.end();
    });

    return result;
  } catch (error) {
    return { ok: false, status: 0, data: { error: error.message } };
  }
});

// =============================================
// App lifecycle
// =============================================

app.on('before-quit', () => { isQuitting = true; });

app.whenReady().then(() => { createWindow(); createTray(); });

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
