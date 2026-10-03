/**
 * Video Syncer - Desktop Preload Bridge
 * Exposes native OS file dialogs and streaming protocol helpers.
 * Strictly zero emojis.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openVideoFiles: () => ipcRenderer.invoke('dialog:open-videos'),
  exportSession: (sessionData) => ipcRenderer.invoke('dialog:export-session', sessionData),
  importSession: () => ipcRenderer.invoke('dialog:import-session'),
  getStreamUrl: (filePath) => `media-stream://stream/${encodeURIComponent(filePath)}`
});
