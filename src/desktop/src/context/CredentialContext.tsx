/**
 * RhizOS Credential Context
 *
 * React context for managing credential store state.
 * Provides hooks for credential operations throughout the app.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  credentialStore,
  CredentialStore,
  CredentialMetadata,
  CredentialType,
  StoredCredential,
} from '../services/credential-store';

// ============ Types ============

interface CredentialContextType {
  // Store state
  isInitialized: boolean;
  isUnlocked: boolean;
  credentials: CredentialMetadata[];

  // Store operations
  initialize: (masterPassword: string) => Promise<void>;
  unlock: (masterPassword: string) => Promise<boolean>;
  lock: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  reset: () => Promise<void>;

  // Credential operations
  addCredential: (
    type: CredentialType,
    name: string,
    values: Record<string, string>,
    description?: string
  ) => Promise<string>;
  updateCredential: (
    id: string,
    updates: { name?: string; description?: string; values?: Record<string, string> }
  ) => Promise<void>;
  deleteCredential: (id: string) => Promise<void>;
  getCredential: (id: string) => StoredCredential | undefined;
  getCredentialsByType: (type: CredentialType) => CredentialMetadata[];

  // Backup operations
  exportBackup: (backupPassword: string) => Promise<string>;
  importBackup: (backupData: string, backupPassword: string, mode?: 'merge' | 'replace') => Promise<number>;

  // Validation
  hasCredential: (id: string) => boolean;
  validateCredentialRef: (credentialId: string, expectedType: CredentialType) => boolean;

  // For deployment
  resolveCredentials: (
    refs: Record<string, { credentialId: string; type: string }>
  ) => Record<string, Record<string, string>>;
}

// ============ Context ============

const CredentialContext = createContext<CredentialContextType | undefined>(undefined);

// ============ Provider ============

export function CredentialProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [credentials, setCredentials] = useState<CredentialMetadata[]>([]);

  // Check initialization status on mount
  useEffect(() => {
    setIsInitialized(credentialStore.isInitialized());
  }, []);

  // Refresh credential list
  const refreshCredentials = useCallback(() => {
    if (credentialStore.isStoreUnlocked()) {
      setCredentials(credentialStore.listCredentials());
    } else {
      setCredentials([]);
    }
  }, []);

  // Initialize new store
  const initialize = useCallback(async (masterPassword: string) => {
    await credentialStore.initialize(masterPassword);
    setIsInitialized(true);
    setIsUnlocked(true);
    refreshCredentials();
  }, [refreshCredentials]);

  // Unlock existing store
  const unlock = useCallback(async (masterPassword: string): Promise<boolean> => {
    const success = await credentialStore.unlock(masterPassword);
    setIsUnlocked(success);
    if (success) {
      refreshCredentials();
    }
    return success;
  }, [refreshCredentials]);

  // Lock store
  const lock = useCallback(() => {
    credentialStore.lock();
    setIsUnlocked(false);
    setCredentials([]);
  }, []);

  // Change password
  const changePassword = useCallback(async (
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    const success = await credentialStore.changePassword(currentPassword, newPassword);
    return success;
  }, []);

  // Reset store
  const reset = useCallback(async () => {
    await credentialStore.reset();
    setIsInitialized(false);
    setIsUnlocked(false);
    setCredentials([]);
  }, []);

  // Add credential
  const addCredential = useCallback(async (
    type: CredentialType,
    name: string,
    values: Record<string, string>,
    description?: string
  ): Promise<string> => {
    const id = await credentialStore.addCredential(type, name, values, description);
    refreshCredentials();
    return id;
  }, [refreshCredentials]);

  // Update credential
  const updateCredential = useCallback(async (
    id: string,
    updates: { name?: string; description?: string; values?: Record<string, string> }
  ): Promise<void> => {
    await credentialStore.updateCredential(id, updates);
    refreshCredentials();
  }, [refreshCredentials]);

  // Delete credential
  const deleteCredential = useCallback(async (id: string): Promise<void> => {
    await credentialStore.deleteCredential(id);
    refreshCredentials();
  }, [refreshCredentials]);

  // Get credential (with values)
  const getCredential = useCallback((id: string): StoredCredential | undefined => {
    return credentialStore.getCredential(id);
  }, []);

  // Get credentials by type
  const getCredentialsByType = useCallback((type: CredentialType): CredentialMetadata[] => {
    return credentialStore.listCredentialsByType(type);
  }, []);

  // Export backup
  const exportBackup = useCallback(async (backupPassword: string): Promise<string> => {
    return credentialStore.exportBackup(backupPassword);
  }, []);

  // Import backup
  const importBackup = useCallback(async (
    backupData: string,
    backupPassword: string,
    mode: 'merge' | 'replace' = 'merge'
  ): Promise<number> => {
    const count = await credentialStore.importBackup(backupData, backupPassword, mode);
    refreshCredentials();
    return count;
  }, [refreshCredentials]);

  // Check if credential exists
  const hasCredential = useCallback((id: string): boolean => {
    return credentialStore.hasCredential(id);
  }, []);

  // Validate credential reference
  const validateCredentialRef = useCallback((
    credentialId: string,
    expectedType: CredentialType
  ): boolean => {
    const credential = credentialStore.getCredential(credentialId);
    return credential !== undefined && credential.type === expectedType;
  }, []);

  // Resolve credentials for deployment
  const resolveCredentials = useCallback((
    refs: Record<string, { credentialId: string; type: string }>
  ): Record<string, Record<string, string>> => {
    return credentialStore.resolveCredentialRefs(refs);
  }, []);

  const value: CredentialContextType = {
    isInitialized,
    isUnlocked,
    credentials,
    initialize,
    unlock,
    lock,
    changePassword,
    reset,
    addCredential,
    updateCredential,
    deleteCredential,
    getCredential,
    getCredentialsByType,
    exportBackup,
    importBackup,
    hasCredential,
    validateCredentialRef,
    resolveCredentials,
  };

  return (
    <CredentialContext.Provider value={value}>
      {children}
    </CredentialContext.Provider>
  );
}

// ============ Hook ============

export function useCredentials() {
  const context = useContext(CredentialContext);
  if (context === undefined) {
    throw new Error('useCredentials must be used within a CredentialProvider');
  }
  return context;
}

// ============ Utility Hooks ============

/**
 * Hook to get credentials filtered by type
 */
export function useCredentialsByType(type: CredentialType) {
  const { credentials, isUnlocked } = useCredentials();

  if (!isUnlocked) {
    return [];
  }

  return credentials.filter(c => c.type === type);
}

/**
 * Hook to check if store needs setup
 */
export function useCredentialStoreStatus() {
  const { isInitialized, isUnlocked } = useCredentials();

  return {
    needsSetup: !isInitialized,
    needsUnlock: isInitialized && !isUnlocked,
    isReady: isInitialized && isUnlocked,
  };
}
