/**
 * RhizOS Credential Store
 *
 * Secure encrypted storage for sensitive credentials using AES-256-GCM.
 * Master password derives encryption key via PBKDF2.
 * Credentials stored in localStorage (encrypted).
 */

import { CredentialRef } from '../../../shared/schemas/module-configs';

// ============ Types ============

export type CredentialType = CredentialRef['type'];

export interface StoredCredential {
  id: string;
  type: CredentialType;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  // Values stored encrypted - this is the decrypted structure
  values: Record<string, string>;
}

export interface CredentialMetadata {
  id: string;
  type: CredentialType;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface EncryptedStore {
  version: number;
  salt: string;          // Base64 encoded
  iv: string;            // Base64 encoded
  encryptedData: string; // Base64 encoded
  checksum: string;      // To verify correct password
}

// ============ Constants ============

const STORAGE_KEY = 'rhizos_credentials_v1';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;
const CHECKSUM_TEXT = 'RHIZOS_CREDENTIAL_STORE_VALID';

// ============ Crypto Utilities ============

/**
 * Generate random bytes
 */
function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Convert Uint8Array to Base64
 */
function arrayToBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

/**
 * Convert Base64 to Uint8Array
 */
function base64ToArray(base64: string): Uint8Array {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data with AES-256-GCM
 */
async function encrypt(data: string, key: CryptoKey, iv: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  return new Uint8Array(encrypted);
}

/**
 * Decrypt data with AES-256-GCM
 */
async function decrypt(encryptedData: Uint8Array, key: CryptoKey, iv: Uint8Array): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  );
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// ============ Credential Store Class ============

export class CredentialStore {
  private credentials: Map<string, StoredCredential> = new Map();
  private encryptionKey: CryptoKey | null = null;
  private salt: Uint8Array | null = null;
  private isUnlocked = false;

  /**
   * Check if the store has been initialized with a master password
   */
  isInitialized(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Check if the store is currently unlocked
   */
  isStoreUnlocked(): boolean {
    return this.isUnlocked;
  }

  /**
   * Initialize a new credential store with a master password
   */
  async initialize(masterPassword: string): Promise<void> {
    if (this.isInitialized()) {
      throw new Error('Credential store already initialized. Use unlock() instead.');
    }

    // Generate new salt
    this.salt = getRandomBytes(SALT_LENGTH);

    // Derive encryption key
    this.encryptionKey = await deriveKey(masterPassword, this.salt);

    // Initialize empty credential store
    this.credentials = new Map();

    // Save encrypted store
    await this.save();
    this.isUnlocked = true;
  }

  /**
   * Unlock an existing credential store with the master password
   */
  async unlock(masterPassword: string): Promise<boolean> {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (!storedData) {
      throw new Error('Credential store not initialized. Use initialize() first.');
    }

    const store: EncryptedStore = JSON.parse(storedData);

    // Restore salt and derive key
    this.salt = base64ToArray(store.salt);
    this.encryptionKey = await deriveKey(masterPassword, this.salt);

    // Try to decrypt and verify checksum
    try {
      const iv = base64ToArray(store.iv);
      const encryptedData = base64ToArray(store.encryptedData);
      const decryptedData = await decrypt(encryptedData, this.encryptionKey, iv);
      const parsed = JSON.parse(decryptedData);

      // Verify checksum
      if (parsed.checksum !== CHECKSUM_TEXT) {
        this.encryptionKey = null;
        this.salt = null;
        return false;
      }

      // Restore credentials
      this.credentials = new Map(
        (parsed.credentials as StoredCredential[]).map(c => [c.id, c])
      );

      this.isUnlocked = true;
      return true;
    } catch {
      // Wrong password or corrupted data
      this.encryptionKey = null;
      this.salt = null;
      return false;
    }
  }

  /**
   * Lock the credential store (clear decrypted data from memory)
   */
  lock(): void {
    this.credentials = new Map();
    this.encryptionKey = null;
    this.isUnlocked = false;
    // Keep salt for next unlock
  }

  /**
   * Change the master password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    // Verify current password
    const verified = await this.unlock(currentPassword);
    if (!verified) {
      return false;
    }

    // Generate new salt and key
    this.salt = getRandomBytes(SALT_LENGTH);
    this.encryptionKey = await deriveKey(newPassword, this.salt);

    // Re-save with new encryption
    await this.save();
    return true;
  }

  /**
   * Save the credential store to localStorage (encrypted)
   */
  private async save(): Promise<void> {
    if (!this.encryptionKey || !this.salt) {
      throw new Error('Store not unlocked');
    }

    // Prepare data to encrypt
    const dataToEncrypt = JSON.stringify({
      checksum: CHECKSUM_TEXT,
      credentials: Array.from(this.credentials.values()),
    });

    // Generate new IV for each save
    const iv = getRandomBytes(IV_LENGTH);

    // Encrypt
    const encryptedData = await encrypt(dataToEncrypt, this.encryptionKey, iv);

    // Store
    const store: EncryptedStore = {
      version: 1,
      salt: arrayToBase64(this.salt),
      iv: arrayToBase64(iv),
      encryptedData: arrayToBase64(encryptedData),
      checksum: '', // Legacy field, actual checksum is in encrypted data
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  /**
   * Generate a unique credential ID
   */
  private generateId(): string {
    return `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a new credential
   */
  async addCredential(
    type: CredentialType,
    name: string,
    values: Record<string, string>,
    description?: string
  ): Promise<string> {
    if (!this.isUnlocked) {
      throw new Error('Store is locked');
    }

    const id = this.generateId();
    const now = new Date().toISOString();

    const credential: StoredCredential = {
      id,
      type,
      name,
      description,
      values,
      createdAt: now,
      updatedAt: now,
    };

    this.credentials.set(id, credential);
    await this.save();

    return id;
  }

  /**
   * Update an existing credential
   */
  async updateCredential(
    id: string,
    updates: {
      name?: string;
      description?: string;
      values?: Record<string, string>;
    }
  ): Promise<void> {
    if (!this.isUnlocked) {
      throw new Error('Store is locked');
    }

    const credential = this.credentials.get(id);
    if (!credential) {
      throw new Error(`Credential not found: ${id}`);
    }

    if (updates.name !== undefined) credential.name = updates.name;
    if (updates.description !== undefined) credential.description = updates.description;
    if (updates.values !== undefined) credential.values = updates.values;
    credential.updatedAt = new Date().toISOString();

    await this.save();
  }

  /**
   * Delete a credential
   */
  async deleteCredential(id: string): Promise<void> {
    if (!this.isUnlocked) {
      throw new Error('Store is locked');
    }

    if (!this.credentials.has(id)) {
      throw new Error(`Credential not found: ${id}`);
    }

    this.credentials.delete(id);
    await this.save();
  }

  /**
   * Get a credential by ID (returns full credential with values)
   */
  getCredential(id: string): StoredCredential | undefined {
    if (!this.isUnlocked) {
      throw new Error('Store is locked');
    }
    return this.credentials.get(id);
  }

  /**
   * Get credential values by ID (for deployment)
   */
  getCredentialValues(id: string): Record<string, string> | undefined {
    if (!this.isUnlocked) {
      throw new Error('Store is locked');
    }
    return this.credentials.get(id)?.values;
  }

  /**
   * List all credentials (metadata only, no values)
   */
  listCredentials(): CredentialMetadata[] {
    if (!this.isUnlocked) {
      throw new Error('Store is locked');
    }

    return Array.from(this.credentials.values()).map(({ values, ...metadata }) => metadata);
  }

  /**
   * List credentials by type
   */
  listCredentialsByType(type: CredentialType): CredentialMetadata[] {
    return this.listCredentials().filter(c => c.type === type);
  }

  /**
   * Check if a credential reference is valid
   */
  hasCredential(id: string): boolean {
    return this.credentials.has(id);
  }

  /**
   * Resolve credential references to actual values (for deployment)
   */
  resolveCredentialRefs(
    refs: Record<string, { credentialId: string; type: string }>
  ): Record<string, Record<string, string>> {
    if (!this.isUnlocked) {
      throw new Error('Store is locked');
    }

    const resolved: Record<string, Record<string, string>> = {};

    for (const [key, ref] of Object.entries(refs)) {
      const credential = this.credentials.get(ref.credentialId);
      if (!credential) {
        throw new Error(`Credential not found: ${ref.credentialId}`);
      }
      if (credential.type !== ref.type) {
        throw new Error(
          `Credential type mismatch: expected ${ref.type}, got ${credential.type}`
        );
      }
      resolved[key] = credential.values;
    }

    return resolved;
  }

  /**
   * Export credentials for backup (encrypted with provided password)
   */
  async exportBackup(backupPassword: string): Promise<string> {
    if (!this.isUnlocked) {
      throw new Error('Store is locked');
    }

    const salt = getRandomBytes(SALT_LENGTH);
    const iv = getRandomBytes(IV_LENGTH);
    const key = await deriveKey(backupPassword, salt);

    const dataToEncrypt = JSON.stringify({
      checksum: CHECKSUM_TEXT,
      exportedAt: new Date().toISOString(),
      credentials: Array.from(this.credentials.values()),
    });

    const encryptedData = await encrypt(dataToEncrypt, key, iv);

    const backup = {
      version: 1,
      salt: arrayToBase64(salt),
      iv: arrayToBase64(iv),
      encryptedData: arrayToBase64(encryptedData),
    };

    return btoa(JSON.stringify(backup));
  }

  /**
   * Import credentials from backup
   */
  async importBackup(
    backupData: string,
    backupPassword: string,
    mode: 'merge' | 'replace' = 'merge'
  ): Promise<number> {
    if (!this.isUnlocked) {
      throw new Error('Store is locked');
    }

    try {
      const backup = JSON.parse(atob(backupData));
      const salt = base64ToArray(backup.salt);
      const iv = base64ToArray(backup.iv);
      const encryptedData = base64ToArray(backup.encryptedData);
      const key = await deriveKey(backupPassword, salt);

      const decryptedData = await decrypt(encryptedData, key, iv);
      const parsed = JSON.parse(decryptedData);

      if (parsed.checksum !== CHECKSUM_TEXT) {
        throw new Error('Invalid backup or wrong password');
      }

      const importedCredentials = parsed.credentials as StoredCredential[];

      if (mode === 'replace') {
        this.credentials = new Map(importedCredentials.map(c => [c.id, c]));
      } else {
        // Merge - imported credentials with same ID overwrite existing
        for (const cred of importedCredentials) {
          this.credentials.set(cred.id, cred);
        }
      }

      await this.save();
      return importedCredentials.length;
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid backup or wrong password') {
        throw error;
      }
      throw new Error('Failed to import backup: invalid format or wrong password');
    }
  }

  /**
   * Delete all credentials and reset the store
   */
  async reset(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
    this.credentials = new Map();
    this.encryptionKey = null;
    this.salt = null;
    this.isUnlocked = false;
  }
}

// ============ Singleton Instance ============

export const credentialStore = new CredentialStore();

// ============ React Hook Support ============

/**
 * Helper to create a credential reference
 */
export function createCredentialRef(credentialId: string, type: CredentialType): CredentialRef {
  return { credentialId, type };
}

/**
 * Validate that all credential references exist
 */
export function validateCredentialRefs(
  refs: CredentialRef[],
  store: CredentialStore
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const ref of refs) {
    if (!store.hasCredential(ref.credentialId)) {
      missing.push(ref.credentialId);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
