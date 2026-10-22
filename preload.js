const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadCourses: () => ipcRenderer.invoke('load-courses'),
  start: (courses, speed) => ipcRenderer.invoke('start', { courses, speed }),
  stop: () => ipcRenderer.invoke('stop'),
  clearState: () => ipcRenderer.invoke('clear-state'),
  minimize: () => ipcRenderer.invoke('win-minimize'),
  close: () => ipcRenderer.invoke('win-close'),
  onEvent: (cb) => ipcRenderer.on('event', (_e, data) => cb(data)),
});
