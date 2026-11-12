const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadCourses: () => ipcRenderer.invoke('load-courses'),
  start: (courses, speed) => ipcRenderer.invoke('start', { courses, speed }),
  stop: () => ipcRenderer.invoke('stop'),
  setSpeed: (v) => ipcRenderer.invoke('set-speed', v),
  setDocDwell: (v) => ipcRenderer.invoke('set-doc-dwell', v),
  clearState: () => ipcRenderer.invoke('clear-state'),
  minimize: () => ipcRenderer.invoke('win-minimize'),
  close: () => ipcRenderer.invoke('win-close'),
  toggleMax: () => ipcRenderer.invoke('win-toggle-max'),
  notify: (payload) => ipcRenderer.invoke('notify', payload),
  exportLog: () => ipcRenderer.invoke('export-log'),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),
  onEvent: (cb) => ipcRenderer.on('event', (_e, data) => cb(data)),
});
