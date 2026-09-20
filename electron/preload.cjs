const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('propvault', {
  platform: process.platform,
  isDesktop: true,

  showNotification: (payload) => {
    ipcRenderer.send('propvault:notification', payload);
  },

  getRuntime: () => ipcRenderer.invoke('propvault:get-runtime'),
  setConnectionMode: (mode, serverUrl) =>
    ipcRenderer.invoke('propvault:set-connection-mode', { mode, serverUrl }),
  pingServer: (serverUrl) => ipcRenderer.invoke('propvault:ping-server', serverUrl),
  testLocalDb: () => ipcRenderer.invoke('propvault:test-local-db'),
  initLocalSchema: () => ipcRenderer.invoke('propvault:init-local-schema'),
  localGetLand: (params) => ipcRenderer.invoke('propvault:local-get-land', params),
  localSyncSummary: () => ipcRenderer.invoke('propvault:local-sync-summary'),
  backupLocalDb: () => ipcRenderer.invoke('propvault:backup-local-db'),
  backupMainDb: () => ipcRenderer.invoke('propvault:backup-main-db'),
});
