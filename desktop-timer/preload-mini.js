const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('miniAPI', {
  restore: () => ipcRenderer.send('minibar:restore'),
  onUpdateTimer: (cb) => ipcRenderer.on('update-timer', (_, text) => cb(text)),
})
