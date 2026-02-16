const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 480,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of closing
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Create a simple tray icon (16x16 colored square)
  const icon = nativeImage.createFromBuffer(createTrayIcon());
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Timer',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('StudioFlow Timer');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Generate a simple 16x16 purple tray icon
function createTrayIcon() {
  const { createCanvas } = (() => {
    try { return require('canvas'); } catch { return {}; }
  })();

  // Fallback: create a tiny BMP-like icon using raw pixel data
  // 16x16 RGBA pixels for a purple circle
  const size = 16;
  const bmpHeaderSize = 54;
  const dataSize = size * size * 4;
  const fileSize = bmpHeaderSize + dataSize;

  const buf = Buffer.alloc(fileSize);

  // BMP header
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(bmpHeaderSize, 10);
  buf.writeUInt32LE(40, 14); // DIB header size
  buf.writeInt32LE(size, 18);
  buf.writeInt32LE(-size, 22); // Negative for top-down
  buf.writeUInt16LE(1, 26); // Planes
  buf.writeUInt16LE(32, 28); // BPP
  buf.writeUInt32LE(0, 30); // No compression
  buf.writeUInt32LE(dataSize, 34);

  // Purple circle pixels
  const cx = 8, cy = 8, r = 7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = bmpHeaderSize + (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        buf[offset] = 0xf0;     // B
        buf[offset + 1] = 0x57; // G
        buf[offset + 2] = 0xa6; // R (#a657f0)
        buf[offset + 3] = 0xff; // A
      } else {
        buf[offset] = 0;
        buf[offset + 1] = 0;
        buf[offset + 2] = 0;
        buf[offset + 3] = 0; // Transparent
      }
    }
  }

  return buf;
}

// =============================================
// IPC Handlers
// =============================================

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.hide());
ipcMain.on('window:close', () => {
  app.isQuitting = true;
  app.quit();
});

// Store (persist API key + settings)
ipcMain.handle('store:get', (_, key) => store.get(key));
ipcMain.handle('store:set', (_, key, value) => store.set(key, value));
ipcMain.handle('store:delete', (_, key) => store.delete(key));

// API calls (proxied through main process to avoid CORS)
ipcMain.handle('api:request', async (_, { method, path, body, apiKey, apiUrl }) => {
  try {
    const url = `${apiUrl}${path}`;
    const options = {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': apiKey,
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { error: error.message } };
  }
});

// =============================================
// App lifecycle
// =============================================

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
