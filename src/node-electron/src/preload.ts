import { contextBridge, ipcRenderer } from 'electron';

interface ResourceLimits {
  cpuCores?: number;
  ramPercent?: number;
  storageGb?: number;
  gpuVramPercent?: number[];
}

contextBridge.exposeInMainWorld('electronAPI', {
  getHardware: () => ipcRenderer.invoke('get-hardware'),
  getDetectedHardware: () => ipcRenderer.invoke('get-detected-hardware'),
  getNodeStatus: () => ipcRenderer.invoke('get-node-status'),
  startNode: (config: { orchestratorUrl?: string; workspaceIds: string[] }) =>
    ipcRenderer.invoke('start-node', config),
  stopNode: () => ipcRenderer.invoke('stop-node'),
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),

  // Resource limits
  getResourceLimits: () => ipcRenderer.invoke('get-resource-limits'),
  setResourceLimits: (limits: ResourceLimits) => ipcRenderer.invoke('set-resource-limits', limits),

  onNodeStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('node-status', (_, status) => callback(status));
  },
  onNodeLog: (callback: (log: any) => void) => {
    ipcRenderer.on('node-log', (_, log) => callback(log));
  },
  onLimitsChange: (callback: (limits: ResourceLimits) => void) => {
    ipcRenderer.on('limits-change', (_, limits) => callback(limits));
  },
});
