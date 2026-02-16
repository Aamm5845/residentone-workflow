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
  let icon;
  try {
    const iconPath = nodePath.join(__dirname, 'icon.png');
    const loaded = nativeImage.createFromPath(iconPath);
    if (loaded.isEmpty()) throw new Error('Empty');
    icon = loaded.resize({ width: 16, height: 16 });
  } catch {
    icon = nativeImage.createFromBuffer(createFallbackIcon());
  }

  tray = new Tray(icon);
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

function createFallbackIcon() {
  const size = 16;
  const buf = Buffer.alloc(54 + size * size * 4);
  buf.write('BM', 0);
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(size, 18);
  buf.writeInt32LE(-size, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(32, 28);
  buf.writeUInt32LE(size * size * 4, 34);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = 54 + (y * size + x) * 4;
      if (x >= 1 && x <= 14 && y >= 1 && y <= 14) {
        buf[o] = 0xf0; buf[o+1] = 0x57; buf[o+2] = 0xa6; buf[o+3] = 0xff;
      }
    }
  }
  return buf;
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
