import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  updateTicker: (text: string) => ipcRenderer.send('update-ticker', text),
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: any) => ipcRenderer.invoke('store-set', key, value),
  hideWindow: () => ipcRenderer.send('hide-window'),
  setWindowSize: (w: number, h: number) => ipcRenderer.send('set-window-size', w, h),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onRefreshData: (callback: () => void) => {
    ipcRenderer.on('refresh-data', callback)
    return () => ipcRenderer.removeListener('refresh-data', callback)
  },
  platform: process.platform,
})
