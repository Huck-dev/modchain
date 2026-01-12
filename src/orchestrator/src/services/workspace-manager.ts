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

export interface WorkspaceApiKey {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'custom';
  name: string;
  key: string; // Stored encrypted in production
  addedBy: string;
  addedAt: string;
}

export interface WorkspaceFlow {
  id: string;
  name: string;
  description: string;
  flow: any; // The full flow schema
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceUsageEntry {
  id: string;
  flowId?: string;
  flowName?: string;
  type: 'api_call' | 'compute' | 'storage';
  provider?: string; // For API calls: openai, anthropic, etc.
  tokensUsed?: number;
  computeSeconds?: number;
  costCents: number;
  userId: string;
  timestamp: string;
}

export interface WorkspaceResourceUsage {
  totalCostCents: number;
  totalTokens: number;
  totalComputeSeconds: number;
  entries: ResourceUsageEntry[];
  lastUpdated: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  inviteCode: string;
  ownerId: string;
  members: WorkspaceMember[];
  apiKeys: WorkspaceApiKey[];
  flows: WorkspaceFlow[];
  resourceUsage: WorkspaceResourceUsage;
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
      apiKeys: [],
      flows: [],
      resourceUsage: {
        totalCostCents: 0,
        totalTokens: 0,
        totalComputeSeconds: 0,
        entries: [],
        lastUpdated: new Date().toISOString(),
      },
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

  /**
   * Add an API key to a workspace
   */
  addApiKey(
    workspaceId: string,
    userId: string,
    provider: WorkspaceApiKey['provider'],
    name: string,
    key: string
  ): { success: boolean; apiKey?: WorkspaceApiKey; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is a member
    const member = workspace.members.find((m) => m.userId === userId);
    if (!member) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    // Only owner/admin can add API keys
    if (member.role !== 'owner' && member.role !== 'admin') {
      return { success: false, error: 'Only owner or admin can add API keys' };
    }

    // Initialize apiKeys array if it doesn't exist (for existing workspaces)
    if (!workspace.apiKeys) {
      workspace.apiKeys = [];
    }

    const apiKey: WorkspaceApiKey = {
      id: uuidv4(),
      provider,
      name,
      key, // In production, this should be encrypted
      addedBy: userId,
      addedAt: new Date().toISOString(),
    };

    workspace.apiKeys.push(apiKey);
    this.saveToDisk();

    console.log(`[WorkspaceManager] API key "${name}" (${provider}) added to workspace "${workspace.name}"`);

    return { success: true, apiKey };
  }

  /**
   * Remove an API key from a workspace
   */
  removeApiKey(
    workspaceId: string,
    userId: string,
    apiKeyId: string
  ): { success: boolean; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is a member
    const member = workspace.members.find((m) => m.userId === userId);
    if (!member) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    // Only owner/admin can remove API keys
    if (member.role !== 'owner' && member.role !== 'admin') {
      return { success: false, error: 'Only owner or admin can remove API keys' };
    }

    if (!workspace.apiKeys) {
      return { success: false, error: 'No API keys found' };
    }

    const keyIndex = workspace.apiKeys.findIndex((k) => k.id === apiKeyId);
    if (keyIndex === -1) {
      return { success: false, error: 'API key not found' };
    }

    workspace.apiKeys.splice(keyIndex, 1);
    this.saveToDisk();

    console.log(`[WorkspaceManager] API key removed from workspace "${workspace.name}"`);

    return { success: true };
  }

  /**
   * Get API keys for a workspace (masked for display)
   */
  getApiKeys(workspaceId: string, userId: string): { success: boolean; apiKeys?: Array<Omit<WorkspaceApiKey, 'key'> & { maskedKey: string }>; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is a member
    if (!workspace.members.some((m) => m.userId === userId)) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    if (!workspace.apiKeys) {
      return { success: true, apiKeys: [] };
    }

    // Return keys with masked values
    const maskedKeys = workspace.apiKeys.map((k) => ({
      id: k.id,
      provider: k.provider,
      name: k.name,
      maskedKey: k.key.slice(0, 8) + '...' + k.key.slice(-4),
      addedBy: k.addedBy,
      addedAt: k.addedAt,
    }));

    return { success: true, apiKeys: maskedKeys };
  }

  /**
   * Get the actual API key for a provider (for internal use during execution)
   */
  getApiKeyForProvider(workspaceId: string, provider: WorkspaceApiKey['provider']): string | null {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || !workspace.apiKeys) return null;

    const key = workspace.apiKeys.find((k) => k.provider === provider);
    return key ? key.key : null;
  }

  // ============ Flow Management ============

  /**
   * Get all flows for a workspace
   */
  getFlows(workspaceId: string, userId: string): { success: boolean; flows?: WorkspaceFlow[]; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is a member
    if (!workspace.members.some((m) => m.userId === userId)) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    // Initialize flows array if it doesn't exist (for existing workspaces)
    if (!workspace.flows) {
      workspace.flows = [];
    }

    return { success: true, flows: workspace.flows };
  }

  /**
   * Get a specific flow
   */
  getFlow(workspaceId: string, flowId: string, userId: string): { success: boolean; flow?: WorkspaceFlow; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is a member
    if (!workspace.members.some((m) => m.userId === userId)) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    if (!workspace.flows) {
      return { success: false, error: 'Flow not found' };
    }

    const flow = workspace.flows.find((f) => f.id === flowId);
    if (!flow) {
      return { success: false, error: 'Flow not found' };
    }

    return { success: true, flow };
  }

  /**
   * Create a new flow in a workspace
   */
  createFlow(
    workspaceId: string,
    userId: string,
    name: string,
    description: string,
    flowData: any
  ): { success: boolean; flow?: WorkspaceFlow; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is a member
    const member = workspace.members.find((m) => m.userId === userId);
    if (!member) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    // Initialize flows array if it doesn't exist
    if (!workspace.flows) {
      workspace.flows = [];
    }

    const now = new Date().toISOString();
    const flow: WorkspaceFlow = {
      id: uuidv4(),
      name,
      description,
      flow: flowData,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    workspace.flows.push(flow);
    this.saveToDisk();

    console.log(`[WorkspaceManager] Flow "${name}" created in workspace "${workspace.name}"`);

    return { success: true, flow };
  }

  /**
   * Update a flow in a workspace
   */
  updateFlow(
    workspaceId: string,
    flowId: string,
    userId: string,
    updates: { name?: string; description?: string; flow?: any }
  ): { success: boolean; flow?: WorkspaceFlow; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is a member
    if (!workspace.members.some((m) => m.userId === userId)) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    if (!workspace.flows) {
      return { success: false, error: 'Flow not found' };
    }

    const flowIndex = workspace.flows.findIndex((f) => f.id === flowId);
    if (flowIndex === -1) {
      return { success: false, error: 'Flow not found' };
    }

    const flow = workspace.flows[flowIndex];
    if (updates.name !== undefined) flow.name = updates.name;
    if (updates.description !== undefined) flow.description = updates.description;
    if (updates.flow !== undefined) flow.flow = updates.flow;
    flow.updatedAt = new Date().toISOString();

    this.saveToDisk();

    console.log(`[WorkspaceManager] Flow "${flow.name}" updated in workspace "${workspace.name}"`);

    return { success: true, flow };
  }

  /**
   * Delete a flow from a workspace
   */
  deleteFlow(
    workspaceId: string,
    flowId: string,
    userId: string
  ): { success: boolean; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is a member
    const member = workspace.members.find((m) => m.userId === userId);
    if (!member) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    // Only owner/admin or the creator can delete
    if (member.role !== 'owner' && member.role !== 'admin') {
      const flow = workspace.flows?.find((f) => f.id === flowId);
      if (flow && flow.createdBy !== userId) {
        return { success: false, error: 'Only the creator or admin can delete this flow' };
      }
    }

    if (!workspace.flows) {
      return { success: false, error: 'Flow not found' };
    }

    const flowIndex = workspace.flows.findIndex((f) => f.id === flowId);
    if (flowIndex === -1) {
      return { success: false, error: 'Flow not found' };
    }

    const flowName = workspace.flows[flowIndex].name;
    workspace.flows.splice(flowIndex, 1);
    this.saveToDisk();

    console.log(`[WorkspaceManager] Flow "${flowName}" deleted from workspace "${workspace.name}"`);

    return { success: true };
  }

  // ============ Resource Usage Tracking ============

  /**
   * Get resource usage for a workspace
   */
  getResourceUsage(workspaceId: string, userId: string): { success: boolean; usage?: WorkspaceResourceUsage; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is a member
    if (!workspace.members.some((m) => m.userId === userId)) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    // Initialize resourceUsage if it doesn't exist (for existing workspaces)
    if (!workspace.resourceUsage) {
      workspace.resourceUsage = {
        totalCostCents: 0,
        totalTokens: 0,
        totalComputeSeconds: 0,
        entries: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    return { success: true, usage: workspace.resourceUsage };
  }

  /**
   * Record resource usage for a workspace
   */
  recordUsage(
    workspaceId: string,
    userId: string,
    entry: Omit<ResourceUsageEntry, 'id' | 'timestamp'>
  ): { success: boolean; entry?: ResourceUsageEntry; error?: string } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is a member
    if (!workspace.members.some((m) => m.userId === userId)) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    // Initialize resourceUsage if it doesn't exist
    if (!workspace.resourceUsage) {
      workspace.resourceUsage = {
        totalCostCents: 0,
        totalTokens: 0,
        totalComputeSeconds: 0,
        entries: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    const usageEntry: ResourceUsageEntry = {
      id: uuidv4(),
      ...entry,
      timestamp: new Date().toISOString(),
    };

    workspace.resourceUsage.entries.push(usageEntry);
    workspace.resourceUsage.totalCostCents += entry.costCents || 0;
    workspace.resourceUsage.totalTokens += entry.tokensUsed || 0;
    workspace.resourceUsage.totalComputeSeconds += entry.computeSeconds || 0;
    workspace.resourceUsage.lastUpdated = new Date().toISOString();

    // Keep only the last 1000 entries to prevent unbounded growth
    if (workspace.resourceUsage.entries.length > 1000) {
      workspace.resourceUsage.entries = workspace.resourceUsage.entries.slice(-1000);
    }

    this.saveToDisk();

    console.log(`[WorkspaceManager] Recorded ${entry.type} usage for workspace "${workspace.name}": ${entry.costCents} cents`);

    return { success: true, entry: usageEntry };
  }

  /**
   * Get resource usage summary for a workspace (aggregated by period)
   */
  getUsageSummary(
    workspaceId: string,
    userId: string,
    days: number = 30
  ): {
    success: boolean;
    summary?: {
      totalCostCents: number;
      totalTokens: number;
      totalComputeSeconds: number;
      byProvider: Record<string, { tokens: number; cost: number }>;
      byFlow: Record<string, { runs: number; cost: number }>;
      dailyUsage: Array<{ date: string; cost: number; tokens: number }>;
    };
    error?: string;
  } {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Check if user is a member
    if (!workspace.members.some((m) => m.userId === userId)) {
      return { success: false, error: 'Not a member of this workspace' };
    }

    if (!workspace.resourceUsage) {
      return {
        success: true,
        summary: {
          totalCostCents: 0,
          totalTokens: 0,
          totalComputeSeconds: 0,
          byProvider: {},
          byFlow: {},
          dailyUsage: [],
        },
      };
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentEntries = workspace.resourceUsage.entries.filter(
      (e) => new Date(e.timestamp) >= cutoff
    );

    const byProvider: Record<string, { tokens: number; cost: number }> = {};
    const byFlow: Record<string, { runs: number; cost: number }> = {};
    const dailyMap: Record<string, { cost: number; tokens: number }> = {};

    let totalCost = 0;
    let totalTokens = 0;
    let totalCompute = 0;

    for (const entry of recentEntries) {
      totalCost += entry.costCents || 0;
      totalTokens += entry.tokensUsed || 0;
      totalCompute += entry.computeSeconds || 0;

      // By provider
      if (entry.provider) {
        if (!byProvider[entry.provider]) {
          byProvider[entry.provider] = { tokens: 0, cost: 0 };
        }
        byProvider[entry.provider].tokens += entry.tokensUsed || 0;
        byProvider[entry.provider].cost += entry.costCents || 0;
      }

      // By flow
      if (entry.flowId) {
        const flowKey = entry.flowName || entry.flowId;
        if (!byFlow[flowKey]) {
          byFlow[flowKey] = { runs: 0, cost: 0 };
        }
        byFlow[flowKey].runs++;
        byFlow[flowKey].cost += entry.costCents || 0;
      }

      // Daily usage
      const date = new Date(entry.timestamp).toISOString().split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { cost: 0, tokens: 0 };
      }
      dailyMap[date].cost += entry.costCents || 0;
      dailyMap[date].tokens += entry.tokensUsed || 0;
    }

    const dailyUsage = Object.entries(dailyMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      summary: {
        totalCostCents: totalCost,
        totalTokens,
        totalComputeSeconds: totalCompute,
        byProvider,
        byFlow,
        dailyUsage,
      },
    };
  }
}
