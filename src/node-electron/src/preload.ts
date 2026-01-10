import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getHardware: () => ipcRenderer.invoke('get-hardware'),
  getNodeStatus: () => ipcRenderer.invoke('get-node-status'),
  startNode: (config: { orchestratorUrl?: string; workspaceIds: string[] }) =>
    ipcRenderer.invoke('start-node', config),
  stopNode: () => ipcRenderer.invoke('stop-node'),
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),

  onNodeStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('node-status', (_, status) => callback(status));
  },
  onNodeLog: (callback: (log: any) => void) => {
    ipcRenderer.on('node-log', (_, log) => callback(log));
  },
});
