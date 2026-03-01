const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('back', {
    confirmImport: (options) => ipcRenderer.invoke('confirm_partial_import', options),
    cancelImport: () => ipcRenderer.invoke('cancel_partial_import'),
});
