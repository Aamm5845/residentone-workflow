const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  setTitle: (title) => ipcRenderer.send('window:title', title),

  // Mini bar
  showMiniBar: (text) => ipcRenderer.send('minibar:show', text),
  updateMiniBar: (text) => ipcRenderer.send('minibar:update', text),
  hideMiniBar: () => ipcRenderer.send('minibar:hide'),

  // Listen for minimize event from main
  onCheckMiniBar: (cb) => ipcRenderer.on('check-timer-for-minibar', cb),

  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
  },

  apiRequest: (args) => ipcRenderer.invoke('api:request', args),
})
