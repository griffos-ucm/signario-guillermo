const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('back', {
    getExtName: () => new URLSearchParams(location.search).get('ext_name'),
    analyze:    ()        => ipcRenderer.invoke('partial_import_analyze'),
    execute:    (options) => ipcRenderer.invoke('partial_import_execute', options),
});
