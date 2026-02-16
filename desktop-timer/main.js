const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 520,
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

  // Close minimizes to tray, unless we're quitting
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Use the packaged icon, or fallback to generated
  let icon;
  try {
    const iconPath = path.join(__dirname, 'icon.png');
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    icon = nativeImage.createFromBuffer(createTrayIcon());
  }

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

// Generate a 16x16 tray icon with "SF" letters
function createTrayIcon() {
  const size = 16;
  const bmpHeaderSize = 54;
  const dataSize = size * size * 4;
  const fileSize = bmpHeaderSize + dataSize;
  const buf = Buffer.alloc(fileSize);

  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(bmpHeaderSize, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(size, 18);
  buf.writeInt32LE(-size, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(32, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(dataSize, 34);

  // Purple rounded square
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = bmpHeaderSize + (y * size + x) * 4;
      const inBounds = x >= 1 && x <= 14 && y >= 1 && y <= 14;
      if (inBounds) {
        buf[offset] = 0xf0;
        buf[offset + 1] = 0x57;
        buf[offset + 2] = 0xa6;
        buf[offset + 3] = 0xff;
      }
    }
  }
  return buf;
}

// =============================================
// IPC Handlers
// =============================================

// Window controls
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('window:close', () => {
  app.isQuitting = true;
  if (mainWindow) mainWindow.close();
  app.quit();
});

// Store (persist API key + settings)
ipcMain.handle('store:get', (_, key) => store.get(key));
ipcMain.handle('store:set', (_, key, value) => store.set(key, value));
ipcMain.handle('store:delete', (_, key) => store.delete(key));

// API calls (proxied through main process to avoid CORS)
ipcMain.handle('api:request', async (_, { method, path: urlPath, body, apiKey, apiUrl }) => {
  try {
    const url = `${apiUrl}${urlPath}`;
    const options = {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': apiKey || '',
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: 'Invalid response from server', raw: text.substring(0, 200) };
    }

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
