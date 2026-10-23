const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('poke', {
  setMouseThrough: (ignore) => ipcRenderer.send('mouse-through', ignore),
  scan: () => ipcRenderer.invoke('scan'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (patch) => ipcRenderer.send('set-config', patch),
  diagnoseMic: () => ipcRenderer.invoke('mic-diagnose'),
  openMicSettings: (which) => ipcRenderer.send('open-mic-settings', which),
  showMenu: () => ipcRenderer.send('show-menu'),
  quit: () => ipcRenderer.send('quit'),
  focus: () => ipcRenderer.send('focus-window'),
  blur: () => ipcRenderer.send('blur-window'),
  onEvent: (cb) => ipcRenderer.on('event', (_e, msg) => cb(msg)),
});
