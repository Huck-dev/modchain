# Continue with Ollama - IPFS Phase 4

## Current State
- Phase 1-3 COMPLETE and deployed
- Phase 4: Content Operations - NOT STARTED

## What Needs to Be Done

### Phase 4: Add File Operations to Node App

**File: `/mnt/d/modchain/src/node-electron/src/main.ts`**

Add these IPC handlers (after existing ipfs-status handler):

```typescript
// IPFS File Operations
ipcMain.handle('ipfs-add', async (_, filePath: string) => {
  if (!nodeService) return { success: false, error: 'Node service not initialized' };
  try {
    const cid = await nodeService.ipfsAdd(filePath);
    return { success: true, cid };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('ipfs-add-content', async (_, content: string, filename?: string) => {
  if (!nodeService) return { success: false, error: 'Node service not initialized' };
  try {
    const cid = await nodeService.ipfsAddContent(content, filename);
    return { success: true, cid };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('ipfs-get', async (_, cid: string, outputPath: string) => {
  if (!nodeService) return { success: false, error: 'Node service not initialized' };
  try {
    await nodeService.ipfsGet(cid, outputPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('ipfs-pin', async (_, cid: string) => {
  if (!nodeService) return { success: false, error: 'Node service not initialized' };
  try {
    await nodeService.ipfsPin(cid);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('ipfs-unpin', async (_, cid: string) => {
  if (!nodeService) return { success: false, error: 'Node service not initialized' };
  try {
    await nodeService.ipfsUnpin(cid);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
```

**File: `/mnt/d/modchain/src/node-electron/src/node-service.ts`**

Add these methods to NodeService class:

```typescript
async ipfsAdd(filePath: string): Promise<string> {
  if (!this.ipfsManager) throw new Error('IPFS not initialized');
  return await this.ipfsManager.add(filePath);
}

async ipfsAddContent(content: string, filename?: string): Promise<string> {
  if (!this.ipfsManager) throw new Error('IPFS not initialized');
  return await this.ipfsManager.addContent(content, filename);
}

async ipfsGet(cid: string, outputPath: string): Promise<void> {
  if (!this.ipfsManager) throw new Error('IPFS not initialized');
  await this.ipfsManager.get(cid, outputPath);
}

async ipfsPin(cid: string): Promise<void> {
  if (!this.ipfsManager) throw new Error('IPFS not initialized');
  await this.ipfsManager.pin(cid);
}

async ipfsUnpin(cid: string): Promise<void> {
  if (!this.ipfsManager) throw new Error('IPFS not initialized');
  await this.ipfsManager.unpin(cid);
}
```

**File: `/mnt/d/modchain/src/node-electron/src/preload.ts`**

Add to electronAPI object:

```typescript
// IPFS file operations
ipfsAdd: (filePath: string): Promise<{ success: boolean; cid?: string; error?: string }> =>
  ipcRenderer.invoke('ipfs-add', filePath),
ipfsAddContent: (content: string, filename?: string): Promise<{ success: boolean; cid?: string; error?: string }> =>
  ipcRenderer.invoke('ipfs-add-content', content, filename),
ipfsGet: (cid: string, outputPath: string): Promise<{ success: boolean; error?: string }> =>
  ipcRenderer.invoke('ipfs-get', cid, outputPath),
ipfsPin: (cid: string): Promise<{ success: boolean; error?: string }> =>
  ipcRenderer.invoke('ipfs-pin', cid),
ipfsUnpin: (cid: string): Promise<{ success: boolean; error?: string }> =>
  ipcRenderer.invoke('ipfs-unpin', cid),
```

## After Phase 4

Build and test:
```bash
cd /mnt/d/modchain/src/node-electron
npm run dist:win
# Test locally with the built app
```

## Commands to Use

```bash
# Use qwen2.5-coder:32b for coding tasks
ollama run qwen2.5-coder:32b

# Read files
cat /mnt/d/modchain/src/node-electron/src/main.ts

# Edit files
# Use nano, vim, or VS Code
```
