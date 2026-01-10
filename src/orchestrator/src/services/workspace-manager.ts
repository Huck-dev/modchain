/**
 * Workspace Manager Service
 *
 * Manages workspaces, membership, and workspace-scoped compute resources.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export interface WorkspaceMember {
  userId: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  inviteCode: string;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: string;
}

interface WorkspaceStore {
  workspaces: Workspace[];
}

const WORKSPACES_FILE = path.join(process.cwd(), '..', '..', 'workspaces.json');

export class WorkspaceManager {
  private workspaces: Map<string, Workspace> = new Map();
  private inviteCodes: Map<string, string> = new Map(); // inviteCode -> workspaceId

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (existsSync(WORKSPACES_FILE)) {
        const data = JSON.parse(readFileSync(WORKSPACES_FILE, 'utf-8')) as WorkspaceStore;
        for (const ws of data.workspaces) {
          this.workspaces.set(ws.id, ws);
          this.inviteCodes.set(ws.inviteCode, ws.id);
        }
        console.log(`[WorkspaceManager] Loaded ${this.workspaces.size} workspaces`);
      } else {
        console.log('[WorkspaceManager] No workspaces file found, starting fresh');
      }
    } catch (error) {
      console.error('[WorkspaceManager] Failed to load workspaces:', error);
    }
  }

  private saveToDisk(): void {
    try {
      const data: WorkspaceStore = {
        workspaces: Array.from(this.workspaces.values()),
      };
      writeFileSync(WORKSPACES_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[WorkspaceManager] Failed to save workspaces:', error);
    }
  }

  private generateInviteCode(): string {
    // Generate a short, readable invite code
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // no confusing chars
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /**
   * Create a new workspace
   */
  createWorkspace(
    name: string,
    description: string,
    ownerId: string,
    ownerUsername: string,
    isPrivate: boolean = true
  ): Workspace {
    const id = uuidv4();
    const inviteCode = this.generateInviteCode();

    const workspace: Workspace = {
      id,
      name,
      description,
      isPrivate,
      inviteCode,
      ownerId,
      members: [
        {
          userId: ownerId,
          username: ownerUsername,
          role: 'owner',
          joinedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    this.workspaces.set(id, workspace);
    this.inviteCodes.set(inviteCode, id);
    this.saveToDisk();

    console.log(`[WorkspaceManager] Created workspace "${name}" (${id}) by ${ownerUsername}`);

    return workspace;
  }

  /**
   * Get a workspace by ID
   */
  getWorkspace(id: string): Workspace | null {
    return this.workspaces.get(id) || null;
  }

  /**
   * Get a workspace by invite code
   */
  getWorkspaceByInviteCode(code: string): Workspace | null {
    const workspaceId = this.inviteCodes.get(code.toLowerCase());
    if (!workspaceId) return null;
    return this.workspaces.get(workspaceId) || null;
  }

  /**
   * Get all workspaces a user is a member of
   */
  getUserWorkspaces(userId: string): Workspace[] {
    return Array.from(this.workspaces.values()).filter((ws) =>
      ws.members.some((m) => m.userId === userId)
    );
  }

  /**
   * Join a workspace by invite code
   */
  joinWorkspace(
    inviteCode: string,
    userId: string,
    username: string
  ): { success: boolean; workspace?: Workspace; error?: string } {
    const workspace = this.getWorkspaceByInviteCode(inviteCode);

    if (!workspace) {
      return { success: false, error: 'Invalid invite code' };
    }

    // Check if already a member
    if (workspace.members.some((m) => m.userId === userId)) {
      return { success: false, error: 'Already a member of this workspace' };
    }

    // Add member
    workspace.members.push({
      userId,
      username,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    this.saveToDisk();

    console.log(`[WorkspaceManager] ${username} joined workspace "${workspace.name}"`);

    return { success: true, workspace };
  }

  /**
   * Leave a workspace
   */
  leaveWorkspace(
    workspaceId: string,
    userId: string
  ): { success: boolean; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Can't leave if owner
    if (workspace.ownerId === userId) {
      return { success: false, error: 'Owner cannot leave workspace. Transfer ownership or delete it.' };
    }

    // Remove member
    const memberIndex = workspace.members.findIndex((m) => m.userId === userId);
    if (memberIndex === -1) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    workspace.members.splice(memberIndex, 1);
    this.saveToDisk();

    console.log(`[WorkspaceManager] User ${userId} left workspace "${workspace.name}"`);

    return { success: true };
  }

  /**
   * Delete a workspace (owner only)
   */
  deleteWorkspace(
    workspaceId: string,
    userId: string
  ): { success: boolean; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    if (workspace.ownerId !== userId) {
      return { success: false, error: 'Only the owner can delete a workspace' };
    }

    this.inviteCodes.delete(workspace.inviteCode);
    this.workspaces.delete(workspaceId);
    this.saveToDisk();

    console.log(`[WorkspaceManager] Deleted workspace "${workspace.name}"`);

    return { success: true };
  }

  /**
   * Regenerate invite code for a workspace
   */
  regenerateInviteCode(
    workspaceId: string,
    userId: string
  ): { success: boolean; inviteCode?: string; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is owner or admin
    const member = workspace.members.find((m) => m.userId === userId);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return { success: false, error: 'Only owner or admin can regenerate invite code' };
    }

    // Remove old code and generate new one
    this.inviteCodes.delete(workspace.inviteCode);
    workspace.inviteCode = this.generateInviteCode();
    this.inviteCodes.set(workspace.inviteCode, workspaceId);
    this.saveToDisk();

    return { success: true, inviteCode: workspace.inviteCode };
  }

  /**
   * Check if a user is a member of a workspace
   */
  isMember(workspaceId: string, userId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;
    return workspace.members.some((m) => m.userId === userId);
  }

  /**
   * Get member IDs for a workspace
   */
  getMemberIds(workspaceId: string): string[] {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return [];
    return workspace.members.map((m) => m.userId);
  }
}
