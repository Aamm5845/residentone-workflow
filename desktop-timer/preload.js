const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),

  // Persistent store
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
  },

  // API proxy (avoids CORS)
  apiRequest: ({ method, path, body, apiKey, apiUrl }) =>
    ipcRenderer.invoke('api:request', { method, path, body, apiKey, apiUrl }),
})
