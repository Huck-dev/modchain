import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bot, TrendingUp, Coins, Database, Brain, Search, Box, Plus, X, Play,
  ChevronRight, Trash2, Copy, Settings, Zap, ArrowRight, GripVertical,
  Cpu, HardDrive, AlertTriangle, Key, CheckCircle, ExternalLink, Lock,
  Cloud, DollarSign, Lightbulb, Server, Sparkles, Save, FolderOpen, Download, Upload
} from 'lucide-react';
import { CyberButton } from '../components';
import { RHIZOS_MODULES, MODULE_CATEGORIES, getCategoryColor, getCategoryIcon, ModuleDefinition } from '../data/modules';
import { ModuleConfigPanel } from '../components/flow';
import { flowStorage, downloadFlow, readFlowFile, FlowListItem } from '../services/flow-storage';
import { Flow, createEmptyFlow, generateNodeId } from '../../../shared/schemas/flows';
import { getModuleFormFields } from '../../../shared/schemas/module-configs';
import {
  getFlowDeployer,
  DeploymentStatusResponse,
  DeploymentStatus,
  estimateDeploymentCost,
} from '../services/flow-deployer';
import { useCredentials, useCredentialStoreStatus } from '../context/CredentialContext';
import { authFetch } from '../App';

// API providers and their settings keys
const API_PROVIDERS: Record<string, { name: string; settingsKey: string }> = {
  openai: { name: 'OpenAI', settingsKey: 'openai_api_key' },
  anthropic: { name: 'Anthropic', settingsKey: 'anthropic_api_key' },
  groq: { name: 'Groq', settingsKey: 'groq_api_key' },
  together: { name: 'Together AI', settingsKey: 'together_api_key' },
  openrouter: { name: 'OpenRouter', settingsKey: 'openrouter_api_key' },
};

// API pricing per 1M tokens (input/output)
const API_PRICING: Record<string, { input: number; output: number; name: string }> = {
  'gpt-4': { input: 30, output: 60, name: 'GPT-4' },
  'gpt-4-turbo': { input: 10, output: 30, name: 'GPT-4 Turbo' },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5, name: 'GPT-3.5' },
  'claude-3-opus': { input: 15, output: 75, name: 'Claude Opus' },
  'claude-3-sonnet': { input: 3, output: 15, name: 'Claude Sonnet' },
  'claude-3-haiku': { input: 0.25, output: 1.25, name: 'Claude Haiku' },
  'llama-3-70b': { input: 0, output: 0, name: 'Llama 3 70B' }, // Local
  'llama-3-8b': { input: 0, output: 0, name: 'Llama 3 8B' }, // Local
  'mistral-7b': { input: 0, output: 0, name: 'Mistral 7B' }, // Local
};

// GPU rental pricing ($/hour from vast.ai/runpod style pricing)
const GPU_RENTAL_PRICING: Record<string, { hourly: number; vram: number; performance: string }> = {
  'rtx-3090': { hourly: 0.30, vram: 24, performance: '35 tok/s on 70B' },
  'rtx-4090': { hourly: 0.50, vram: 24, performance: '50 tok/s on 70B' },
  'a100-40gb': { hourly: 1.10, vram: 40, performance: '80 tok/s on 70B' },
  'a100-80gb': { hourly: 1.80, vram: 80, performance: '100 tok/s on 70B' },
  'h100': { hourly: 2.50, vram: 80, performance: '150 tok/s on 70B' },
  'rtx-3080': { hourly: 0.20, vram: 10, performance: 'Good for 7B models' },
  'rtx-4080': { hourly: 0.35, vram: 16, performance: 'Good for 13B models' },
};

// Estimate tokens per flow execution based on modules
const estimateTokensPerRun = (modules: number, hasAgent: boolean, hasMemory: boolean): { input: number; output: number } => {
  let baseInput = modules * 500; // ~500 tokens input per module
  let baseOutput = modules * 200; // ~200 tokens output per module

  if (hasAgent) {
    baseInput *= 3; // Agents do multiple reasoning steps
    baseOutput *= 2;
  }
  if (hasMemory) {
    baseInput += 2000; // RAG context adds tokens
  }

  return { input: baseInput, output: baseOutput };
};

// Calculate monthly cost estimate
const calculateMonthlyCost = (tokensPerRun: { input: number; output: number }, runsPerDay: number, pricing: { input: number; output: number }): number => {
  const monthlyRuns = runsPerDay * 30;
  const inputCost = (tokensPerRun.input * monthlyRuns / 1_000_000) * pricing.input;
  const outputCost = (tokensPerRun.output * monthlyRuns / 1_000_000) * pricing.output;
  return inputCost + outputCost;
};

interface CostRecommendation {
  type: 'api' | 'rental' | 'upgrade';
  title: string;
  description: string;
  monthlyCost: number;
  savings?: number;
  icon: 'cloud' | 'gpu' | 'tip';
}

interface FlowNode {
  id: string;
  type: string;
  name: string;
  category: string;
  moduleId?: string; // Reference to a RHIZOS_MODULE
  x: number;
  y: number;
  inputs: string[];
  outputs: string[];
  config: Record<string, any>;
}

interface Connection {
  id: string;
  from: { nodeId: string; port: string };
  to: { nodeId: string; port: string };
}

interface DragConnection {
  fromNodeId: string;
  fromPort: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// Convert module tools to flow inputs/outputs
const getModuleIO = (mod: ModuleDefinition) => {
  // First tool as input, rest as outputs
  const inputs = mod.tools.length > 0 ? ['input'] : [];
  const outputs = ['output'];
  return { inputs, outputs };
};

export function FlowBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Workspace flow mode (when editing a flow from a workspace)
  const workspaceId = searchParams.get('workspaceId');
  const workspaceFlowId = searchParams.get('flowId');
  const autoRun = searchParams.get('run') === 'true';
  const isWorkspaceMode = !!(workspaceId && workspaceFlowId);
  const [workspaceFlowLoaded, setWorkspaceFlowLoaded] = useState(false);
  const [autoRunTriggered, setAutoRunTriggered] = useState(false);

  // Workspace resources (available compute from workspace nodes and API keys)
  interface WorkspaceResources {
    nodes: Array<{
      id: string;
      hostname: string;
      status: 'online' | 'offline' | 'busy';
      capabilities: { cpuCores: number; memoryMb: number; gpuCount: number; gpuVram?: number };
    }>;
    apiKeys: Array<{
      id: string;
      provider: string;
      name: string;
    }>;
    totalCpu: number;
    totalRam: number;
    totalGpu: number;
    totalVram: number;
  }
  const [workspaceResources, setWorkspaceResources] = useState<WorkspaceResources | null>(null);

  // Workspace selection (for non-workspace-mode flows)
  interface WorkspaceListItem {
    id: string;
    name: string;
  }
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // Credential management
  const { isUnlocked, resolveCredentials, unlock, initialize, isInitialized } = useCredentials();
  const { needsSetup, needsUnlock, isReady: credentialsReady } = useCredentialStoreStatus();
  const [showCredentialPrompt, setShowCredentialPrompt] = useState(false);
  const [credentialPassword, setCredentialPassword] = useState('');
  const [credentialError, setCredentialError] = useState<string | null>(null);

  const [nodes, setNodes] = useState<FlowNode[]>([
    {
      id: 'node-1',
      type: 'module',
      name: 'Eliza',
      category: 'ai-agents',
      moduleId: 'rhizos-eliza',
      x: 100,
      y: 150,
      inputs: ['input'],
      outputs: ['output'],
      config: {},
    },
    {
      id: 'node-2',
      type: 'module',
      name: 'Hummingbot',
      category: 'trading',
      moduleId: 'rhizos-hummingbot',
      x: 400,
      y: 150,
      inputs: ['input'],
      outputs: ['output'],
      config: { strategy: 'market_make' },
    },
  ]);

  // Palette state
  const [paletteCategory, setPaletteCategory] = useState<string>('all');
  const [paletteSearch, setPaletteSearch] = useState('');

  const [connections, setConnections] = useState<Connection[]>([
    { id: 'conn-1', from: { nodeId: 'node-1', port: 'output' }, to: { nodeId: 'node-2', port: 'input' } },
  ]);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [dragConnection, setDragConnection] = useState<DragConnection | null>(null);
  const [hoveredPort, setHoveredPort] = useState<{ nodeId: string; port: string; type: 'input' | 'output' } | null>(null);
  const [showRequirements, setShowRequirements] = useState(true);

  // Flow management state
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState('Untitled Flow');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedFlows, setSavedFlows] = useState<FlowListItem[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [useModuleConfigPanel, setUseModuleConfigPanel] = useState(true);

  // Deployment state
  const [isDeploying, setIsDeploying] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatusResponse | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  // Load API keys from settings
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const settings = localStorage.getItem('rhizos_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setApiKeys({
          openai: parsed.openai_api_key || '',
          anthropic: parsed.anthropic_api_key || '',
          groq: parsed.groq_api_key || '',
          together: parsed.together_api_key || '',
          openrouter: parsed.openrouter_api_key || '',
        });
      }
    } catch (e) {
      console.log('Could not load API keys from settings');
    }
  }, []);

  // Load saved flows list
  useEffect(() => {
    setSavedFlows(flowStorage.listFlows());
  }, []);

  // Fetch user's workspaces for the selector
  useEffect(() => {
    if (isWorkspaceMode) return; // Skip if already editing a workspace flow

    const fetchWorkspaces = async () => {
      setLoadingWorkspaces(true);
      try {
        const res = await authFetch('/api/v1/workspaces');
        if (res.ok) {
          const data = await res.json();
          setWorkspaces(data.workspaces || []);
        }
      } catch (err) {
        console.error('Failed to fetch workspaces:', err);
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    fetchWorkspaces();
  }, [isWorkspaceMode]);

  // Fetch workspace resources when a workspace is selected
  useEffect(() => {
    const wsId = isWorkspaceMode ? workspaceId : selectedWorkspaceId;
    if (!wsId) {
      setWorkspaceResources(null);
      return;
    }

    const fetchResources = async () => {
      try {
        // Fetch nodes and API keys in parallel
        const [nodesRes, keysRes] = await Promise.all([
          authFetch(`/api/v1/workspaces/${wsId}/nodes`),
          authFetch(`/api/v1/workspaces/${wsId}/api-keys`),
        ]);

        const nodesData = nodesRes.ok ? await nodesRes.json() : { nodes: [] };
        const keysData = keysRes.ok ? await keysRes.json() : { apiKeys: [] };

        // Calculate totals from online nodes
        const onlineNodes = (nodesData.nodes || []).filter((n: any) => n.status === 'online');
        const totalCpu = onlineNodes.reduce((sum: number, n: any) => sum + (n.capabilities?.cpuCores || 0), 0);
        const totalRam = onlineNodes.reduce((sum: number, n: any) => sum + Math.floor((n.capabilities?.memoryMb || 0) / 1024), 0);
        const totalGpu = onlineNodes.reduce((sum: number, n: any) => sum + (n.capabilities?.gpuCount || 0), 0);
        // Estimate VRAM: assume average 8GB per GPU if not specified
        const totalVram = onlineNodes.reduce((sum: number, n: any) => sum + ((n.capabilities?.gpuVram || 8) * (n.capabilities?.gpuCount || 0)), 0);

        setWorkspaceResources({
          nodes: nodesData.nodes || [],
          apiKeys: (keysData.apiKeys || []).map((k: any) => ({
            id: k.id,
            provider: k.provider,
            name: k.name,
          })),
          totalCpu,
          totalRam,
          totalGpu,
          totalVram,
        });
      } catch (err) {
        console.error('Failed to fetch workspace resources:', err);
        setWorkspaceResources(null);
      }
    };

    fetchResources();
  }, [isWorkspaceMode, workspaceId, selectedWorkspaceId]);

  // Load workspace flow when in workspace mode
  useEffect(() => {
    if (!isWorkspaceMode || workspaceFlowLoaded) return;

    const loadWorkspaceFlow = async () => {
      try {
        const res = await authFetch(`/api/v1/workspaces/${workspaceId}/flows/${workspaceFlowId}`);
        if (!res.ok) {
          console.error('Failed to load workspace flow');
          return;
        }
        const data = await res.json();
        const flow = data.flow;

        setCurrentFlowId(flow.id);
        setFlowName(flow.name);

        // Convert flow nodes to UI nodes
        if (flow.flow?.nodes && Array.isArray(flow.flow.nodes)) {
          setNodes(flow.flow.nodes.map((n: any) => {
            const moduleDef = RHIZOS_MODULES.find(m => m.id === n.moduleId);
            return {
              id: n.id,
              type: 'module',
              name: n.moduleName || moduleDef?.name || 'Unknown',
              category: moduleDef?.category || 'infrastructure',
              moduleId: n.moduleId,
              x: n.position?.x || 100,
              y: n.position?.y || 100,
              inputs: ['input'],
              outputs: ['output'],
              config: n.config || {},
            };
          }));
        } else {
          // Empty flow - start fresh
          setNodes([]);
        }

        // Convert flow connections
        if (flow.flow?.connections && Array.isArray(flow.flow.connections)) {
          setConnections(flow.flow.connections.map((c: any) => ({
            id: c.id,
            from: { nodeId: c.sourceNodeId, port: c.sourcePort },
            to: { nodeId: c.targetNodeId, port: c.targetPort },
          })));
        } else {
          setConnections([]);
        }

        setWorkspaceFlowLoaded(true);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error('Error loading workspace flow:', err);
      }
    };

    loadWorkspaceFlow();
  }, [isWorkspaceMode, workspaceId, workspaceFlowId, workspaceFlowLoaded]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [nodes, connections]);

  // Save current flow
  const saveFlow = useCallback(async () => {
    const now = new Date().toISOString();
    const flowData = {
      nodes: nodes.map(n => ({
        id: n.id,
        moduleId: n.moduleId || n.type,
        moduleName: n.name,
        position: { x: n.x, y: n.y },
        config: n.config,
      })),
      connections: connections.map(c => ({
        id: c.id,
        sourceNodeId: c.from.nodeId,
        sourcePort: c.from.port,
        targetNodeId: c.to.nodeId,
        targetPort: c.to.port,
      })),
    };

    // If in workspace mode, save to workspace API (update existing)
    if (isWorkspaceMode && workspaceId && workspaceFlowId) {
      try {
        const res = await authFetch(`/api/v1/workspaces/${workspaceId}/flows/${workspaceFlowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: flowName,
            flow: flowData,
          }),
        });

        if (res.ok) {
          setHasUnsavedChanges(false);
          setShowSaveDialog(false);
        } else {
          console.error('Failed to save workspace flow');
        }
      } catch (err) {
        console.error('Error saving workspace flow:', err);
      }
      return;
    }

    // If a workspace is selected, save as a new flow to that workspace
    if (selectedWorkspaceId) {
      try {
        const res = await authFetch(`/api/v1/workspaces/${selectedWorkspaceId}/flows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: flowName,
            description: `Created from Flow Builder`,
            flow: flowData,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setCurrentFlowId(data.flow?.id || null);
          setHasUnsavedChanges(false);
          setShowSaveDialog(false);
          // Show success feedback
          alert(`Flow saved to workspace! You can find it in the workspace's Flows tab.`);
        } else {
          console.error('Failed to save flow to workspace');
          alert('Failed to save flow to workspace');
        }
      } catch (err) {
        console.error('Error saving flow to workspace:', err);
        alert('Error saving flow to workspace');
      }
      return;
    }

    // Otherwise, save to local storage
    const flow: Flow = {
      id: currentFlowId || `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: flowName,
      version: '1.0.0',
      tags: [],
      createdAt: currentFlowId ? (flowStorage.getFlow(currentFlowId)?.createdAt || now) : now,
      updatedAt: now,
      timeout: 3600,
      ...flowData,
    };

    flowStorage.saveFlow(flow);
    setCurrentFlowId(flow.id);
    setHasUnsavedChanges(false);
    setSavedFlows(flowStorage.listFlows());
    setShowSaveDialog(false);
  }, [currentFlowId, flowName, nodes, connections, isWorkspaceMode, workspaceId, workspaceFlowId, selectedWorkspaceId]);

  // Load a flow
  const loadFlow = useCallback((flowId: string) => {
    const flow = flowStorage.getFlow(flowId);
    if (!flow) return;

    setCurrentFlowId(flow.id);
    setFlowName(flow.name);

    // Convert flow nodes to UI nodes
    setNodes(flow.nodes.map(n => {
      const moduleDef = RHIZOS_MODULES.find(m => m.id === n.moduleId);
      return {
        id: n.id,
        type: 'module',
        name: n.moduleName,
        category: moduleDef?.category || 'infrastructure',
        moduleId: n.moduleId,
        x: n.position.x,
        y: n.position.y,
        inputs: ['input'],
        outputs: ['output'],
        config: n.config as Record<string, any>,
      };
    }));

    // Convert flow connections
    setConnections(flow.connections.map(c => ({
      id: c.id,
      from: { nodeId: c.sourceNodeId, port: c.sourcePort },
      to: { nodeId: c.targetNodeId, port: c.targetPort },
    })));

    setHasUnsavedChanges(false);
    setShowLoadDialog(false);
    setSavedFlows(flowStorage.listFlows());
  }, []);

  // Export current flow
  const handleExportFlow = useCallback(() => {
    if (currentFlowId) {
      downloadFlow(currentFlowId, flowName);
    } else {
      // Save first if no ID
      saveFlow();
      setTimeout(() => {
        if (currentFlowId) {
          downloadFlow(currentFlowId, flowName);
        }
      }, 100);
    }
  }, [currentFlowId, flowName, saveFlow]);

  // Import flow from file
  const handleImportFlow = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFlowFile(file);
      const flow = flowStorage.importFlow(content);
      loadFlow(flow.id);
    } catch (err) {
      console.error('Failed to import flow:', err);
      alert('Failed to import flow: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [loadFlow]);

  // New flow
  const newFlow = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Create a new flow anyway?')) {
        return;
      }
    }
    setCurrentFlowId(null);
    setFlowName('Untitled Flow');
    setNodes([]);
    setConnections([]);
    setSelectedNode(null);
    setHasUnsavedChanges(false);
  }, [hasUnsavedChanges]);

  // Collect credential refs from all nodes
  const collectCredentialRefs = useCallback((): Record<string, { credentialId: string; type: string }> => {
    const refs: Record<string, { credentialId: string; type: string }> = {};
    nodes.forEach(node => {
      if (node.config.credentialRefs) {
        Object.entries(node.config.credentialRefs as Record<string, { credentialId: string; type: string }>).forEach(([key, ref]) => {
          refs[ref.credentialId] = ref;
        });
      }
    });
    return refs;
  }, [nodes]);

  // Check if any nodes require credentials
  const hasCredentialRefs = useMemo(() => {
    return nodes.some(node => node.config.credentialRefs && Object.keys(node.config.credentialRefs).length > 0);
  }, [nodes]);

  // Deploy flow to orchestrator
  const handleDeploy = useCallback(async () => {
    if (nodes.length === 0) {
      alert('Add some modules to the flow first');
      return;
    }

    // Check if credentials need to be unlocked
    if (hasCredentialRefs && !credentialsReady) {
      setShowCredentialPrompt(true);
      return;
    }

    // Save flow first if needed
    if (!currentFlowId) {
      saveFlow();
    }

    setShowDeployDialog(true);
    setIsDeploying(true);
    setDeploymentError(null);
    setDeploymentStatus(null);
    setDeploymentId(null);

    try {
      const deployer = getFlowDeployer();

      // Check orchestrator health first
      try {
        await deployer.checkHealth();
      } catch {
        throw new Error('Cannot connect to orchestrator. Make sure it is running on localhost:8080');
      }

      // Collect and resolve credentials from node configs
      const credentialRefs = collectCredentialRefs();
      let resolved: Record<string, Record<string, string>> = {};

      if (Object.keys(credentialRefs).length > 0 && credentialsReady) {
        try {
          resolved = resolveCredentials(credentialRefs);
        } catch (err) {
          throw new Error(`Failed to resolve credentials: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Build flow object with credential refs
      const flow: Flow = {
        id: currentFlowId || `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: flowName,
        version: '1.0.0',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeout: 3600,
        nodes: nodes.map(n => ({
          id: n.id,
          moduleId: n.moduleId || n.type,
          moduleName: n.name,
          position: { x: n.x, y: n.y },
          config: n.config,
          credentialRefs: n.config.credentialRefs as Record<string, { credentialId: string; type: string }> | undefined,
        })),
        connections: connections.map(c => ({
          id: c.id,
          sourceNodeId: c.from.nodeId,
          sourcePort: c.from.port,
          targetNodeId: c.to.nodeId,
          targetPort: c.to.port,
        })),
      };

      // Determine workspace for deployment
      const activeWorkspaceId = isWorkspaceMode ? workspaceId : selectedWorkspaceId;

      // Deploy and wait for completion
      const result = await deployer.deployAndWait(flow, resolved, {
        workspaceId: activeWorkspaceId || undefined,
        onStatusUpdate: (status) => {
          setDeploymentStatus(status);
          setDeploymentId(status.id);
        },
      });

      setDeploymentStatus(result);

      if (result.status === 'failed') {
        setDeploymentError(result.error || 'Deployment failed');
      } else if (result.status === 'completed' && activeWorkspaceId) {
        // Record usage for workspace flows
        try {
          await authFetch(`/api/v1/workspaces/${activeWorkspaceId}/usage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              flowId: isWorkspaceMode ? workspaceFlowId : currentFlowId,
              flowName: flowName,
              type: 'compute',
              computeSeconds: Math.round((result.completedAt ? new Date(result.completedAt).getTime() : Date.now()) - (result.startedAt ? new Date(result.startedAt).getTime() : Date.now())) / 1000 || 10,
              costCents: 0, // Actual cost tracking would need orchestrator integration
            }),
          });
        } catch (err) {
          console.error('Failed to record usage:', err);
        }
      }
    } catch (error) {
      setDeploymentError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDeploying(false);
    }
  }, [nodes, connections, currentFlowId, flowName, saveFlow, hasCredentialRefs, credentialsReady, collectCredentialRefs, resolveCredentials, isWorkspaceMode, workspaceId, workspaceFlowId, selectedWorkspaceId]);

  // Auto-trigger deployment when run=true and flow is loaded
  useEffect(() => {
    if (autoRun && workspaceFlowLoaded && !autoRunTriggered && nodes.length > 0) {
      setAutoRunTriggered(true);
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        handleDeploy();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoRun, workspaceFlowLoaded, autoRunTriggered, nodes.length, handleDeploy]);

  // Handle credential unlock/setup
  const handleCredentialUnlock = useCallback(async () => {
    setCredentialError(null);
    try {
      if (needsSetup) {
        await initialize(credentialPassword);
      } else {
        const success = await unlock(credentialPassword);
        if (!success) {
          setCredentialError('Invalid password');
          return;
        }
      }
      setShowCredentialPrompt(false);
      setCredentialPassword('');
      // Re-trigger deploy after unlock
      handleDeploy();
    } catch (err) {
      setCredentialError(err instanceof Error ? err.message : 'Failed to unlock credentials');
    }
  }, [needsSetup, credentialPassword, initialize, unlock, handleDeploy]);

  // Cancel deployment
  const handleCancelDeployment = useCallback(async () => {
    if (!deploymentId) return;

    try {
      const deployer = getFlowDeployer();
      await deployer.cancelDeployment(deploymentId);
      setDeploymentError('Deployment cancelled');
      setIsDeploying(false);
    } catch (error) {
      console.error('Failed to cancel deployment:', error);
    }
  }, [deploymentId]);

  // Calculate compute requirements based on nodes and their modules
  const computeRequirements = useMemo(() => {
    let totalVram = 0;
    let totalRam = 0;
    let totalCpu = 0;
    const requiredProviders = new Set<string>();
    const usedModels: string[] = [];
    let hasAgent = false;
    let hasMemory = false;

    nodes.forEach(node => {
      // Get the module definition if it exists
      const moduleDef = node.moduleId ? RHIZOS_MODULES.find(m => m.id === node.moduleId) : null;

      if (moduleDef) {
        if (moduleDef.category === 'ai-agents') hasAgent = true;
        const lowerName = moduleDef.name.toLowerCase();
        const lowerDesc = moduleDef.description.toLowerCase();
        if (moduleDef.category === 'infrastructure' || moduleDef.category === 'data') {
          if (lowerName.includes('memory') || lowerName.includes('rag') ||
              lowerName.includes('vector') || lowerName.includes('embed') ||
              lowerDesc.includes('vector') || lowerDesc.includes('embedding')) {
            hasMemory = true;
          }
        }
      }

      if (moduleDef && moduleDef.requirements) {
        // Use module-specific requirements
        totalCpu += moduleDef.requirements.min_cpu_cores || 1;
        totalRam += (moduleDef.requirements.min_memory_mb || 1024) / 1024; // Convert MB to GB
        totalVram += (moduleDef.requirements.gpu_vram_mb || 0) / 1024; // Convert MB to GB
      } else {
        // Default requirements for nodes without a module
        totalCpu += 1;
        totalRam += 2;
      }

      // Check if the config specifies an API provider
      const model = node.config.model;
      if (model) {
        usedModels.push(model);
        if (model.startsWith('gpt-') || model.includes('text-embedding')) {
          requiredProviders.add('openai');
        } else if (model.startsWith('claude-')) {
          requiredProviders.add('anthropic');
        }
      }
    });

    // Check which API keys are missing
    const missingKeys: { provider: string; name: string }[] = [];
    requiredProviders.forEach(provider => {
      if (API_PROVIDERS[provider] && !apiKeys[provider]) {
        missingKeys.push({
          provider,
          name: API_PROVIDERS[provider].name,
        });
      }
    });

    // Calculate cost estimates
    const tokensPerRun = estimateTokensPerRun(nodes.length, hasAgent, hasMemory);
    const runsPerDay = 100; // Assume 100 runs/day for estimation

    // Calculate API costs
    let apiMonthlyCost = 0;
    let primaryModel = '';
    usedModels.forEach(model => {
      if (API_PRICING[model]) {
        const cost = calculateMonthlyCost(tokensPerRun, runsPerDay, API_PRICING[model]);
        apiMonthlyCost += cost;
        if (!primaryModel) primaryModel = model;
      }
    });

    // Find best GPU rental option based on VRAM needs
    let recommendedGpu = '';
    let gpuMonthlyCost = 0;
    if (totalVram > 0) {
      // Find cheapest GPU that meets VRAM requirements
      const sortedGpus = Object.entries(GPU_RENTAL_PRICING)
        .filter(([_, info]) => info.vram >= totalVram)
        .sort((a, b) => a[1].hourly - b[1].hourly);

      if (sortedGpus.length > 0) {
        recommendedGpu = sortedGpus[0][0];
        // Assume 8 hours/day active usage
        gpuMonthlyCost = sortedGpus[0][1].hourly * 8 * 30;
      }
    }

    // Generate recommendations
    const recommendations: CostRecommendation[] = [];

    // If using expensive API, suggest cheaper alternatives
    if (primaryModel === 'gpt-4' && apiMonthlyCost > 50) {
      const sonnetCost = calculateMonthlyCost(tokensPerRun, runsPerDay, API_PRICING['claude-3-sonnet']);
      recommendations.push({
        type: 'api',
        title: 'Switch to Claude Sonnet',
        description: `Similar quality, ~${Math.round((1 - sonnetCost/apiMonthlyCost) * 100)}% cheaper`,
        monthlyCost: sonnetCost,
        savings: apiMonthlyCost - sonnetCost,
        icon: 'cloud',
      });
    }

    if (primaryModel === 'claude-3-opus' && apiMonthlyCost > 100) {
      const sonnetCost = calculateMonthlyCost(tokensPerRun, runsPerDay, API_PRICING['claude-3-sonnet']);
      recommendations.push({
        type: 'api',
        title: 'Switch to Claude Sonnet',
        description: 'Great for most tasks, significantly cheaper',
        monthlyCost: sonnetCost,
        savings: apiMonthlyCost - sonnetCost,
        icon: 'cloud',
      });
    }

    // If API costs are high, suggest local GPU rental
    if (apiMonthlyCost > 30 && totalVram === 0) {
      const gpu3090Cost = GPU_RENTAL_PRICING['rtx-3090'].hourly * 8 * 30;
      if (gpu3090Cost < apiMonthlyCost * 0.7) {
        recommendations.push({
          type: 'rental',
          title: 'Rent a RTX 3090 instead',
          description: `Run Llama 3 70B locally @ ${GPU_RENTAL_PRICING['rtx-3090'].performance}`,
          monthlyCost: gpu3090Cost,
          savings: apiMonthlyCost - gpu3090Cost,
          icon: 'gpu',
        });
      }
    }

    // If high VRAM needed, suggest specific GPU
    if (totalVram > 16 && totalVram <= 24) {
      recommendations.push({
        type: 'rental',
        title: 'RTX 3090/4090 recommended',
        description: '24GB VRAM, perfect for 70B models',
        monthlyCost: GPU_RENTAL_PRICING['rtx-3090'].hourly * 8 * 30,
        icon: 'gpu',
      });
    } else if (totalVram > 24 && totalVram <= 40) {
      recommendations.push({
        type: 'rental',
        title: 'A100 40GB recommended',
        description: 'Best price/performance for large models',
        monthlyCost: GPU_RENTAL_PRICING['a100-40gb'].hourly * 8 * 30,
        icon: 'gpu',
      });
    } else if (totalVram > 40) {
      recommendations.push({
        type: 'rental',
        title: 'A100 80GB or H100 needed',
        description: 'Required for very large models',
        monthlyCost: GPU_RENTAL_PRICING['a100-80gb'].hourly * 8 * 30,
        icon: 'gpu',
      });
    }

    // Suggest Groq for speed-critical flows
    if (hasAgent && apiMonthlyCost > 0) {
      recommendations.push({
        type: 'tip',
        title: 'Try Groq for speed',
        description: 'Fastest inference for agent workflows',
        monthlyCost: apiMonthlyCost * 0.3,
        icon: 'tip',
      });
    }

    // Proactive suggestions for agent modules even without model selected
    if (hasAgent && apiMonthlyCost === 0 && totalVram === 0) {
      // Suggest API option
      const gptCost = calculateMonthlyCost(tokensPerRun, runsPerDay, API_PRICING['gpt-4-turbo']);
      recommendations.push({
        type: 'api',
        title: 'Use GPT-4 Turbo API',
        description: 'Fast inference, no hardware needed',
        monthlyCost: gptCost,
        icon: 'cloud',
      });

      // Suggest rental option
      const gpu3090Cost = GPU_RENTAL_PRICING['rtx-3090'].hourly * 8 * 30;
      recommendations.push({
        type: 'rental',
        title: 'Rent GPU for local LLM',
        description: `RTX 3090 runs Llama 70B @ ${GPU_RENTAL_PRICING['rtx-3090'].performance}`,
        monthlyCost: gpu3090Cost,
        savings: gptCost > gpu3090Cost ? gptCost - gpu3090Cost : undefined,
        icon: 'gpu',
      });
    }

    // Suggest cheaper storage for memory/RAG modules
    if (hasMemory) {
      recommendations.push({
        type: 'tip',
        title: 'Consider Qdrant',
        description: 'Self-host vector DB to avoid Pinecone costs',
        monthlyCost: GPU_RENTAL_PRICING['rtx-3080'].hourly * 4 * 30,
        icon: 'tip',
      });
    }

    return {
      vram: Math.round(totalVram * 10) / 10,
      ram: Math.round(totalRam),
      cpu: totalCpu,
      requiredProviders: Array.from(requiredProviders),
      missingKeys,
      isLocal: totalVram > 0,
      isApiOnly: totalVram === 0 && requiredProviders.size > 0,
      // Cost estimates
      apiMonthlyCost: Math.round(apiMonthlyCost * 100) / 100,
      gpuMonthlyCost: Math.round(gpuMonthlyCost * 100) / 100,
      recommendedGpu,
      recommendations,
      tokensPerRun,
      runsPerDay,
    };
  }, [nodes, apiKeys]);

  // Get port position for a node
  const getPortPosition = useCallback((nodeId: string, portName: string, portType: 'input' | 'output') => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const nodeWidth = 200;
    const headerHeight = 40;
    const portHeight = 20;

    if (portType === 'output') {
      const portIndex = node.outputs.indexOf(portName);
      return {
        x: node.x + nodeWidth,
        y: node.y + headerHeight + (portIndex * portHeight) + 10 + (node.inputs.length * portHeight),
      };
    } else {
      const portIndex = node.inputs.indexOf(portName);
      return {
        x: node.x,
        y: node.y + headerHeight + (portIndex * portHeight) + 10,
      };
    }
  }, [nodes]);

  // Start dragging a connection from an output port
  const handlePortDragStart = (e: React.MouseEvent, nodeId: string, portName: string) => {
    e.stopPropagation();
    e.preventDefault();

    const pos = getPortPosition(nodeId, portName, 'output');

    setDragConnection({
      fromNodeId: nodeId,
      fromPort: portName,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    });
  };

  // Handle connection drag
  const handleConnectionDrag = useCallback((e: React.MouseEvent) => {
    if (!dragConnection || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    setDragConnection(prev => prev ? {
      ...prev,
      currentX: e.clientX - canvasRect.left,
      currentY: e.clientY - canvasRect.top,
    } : null);
  }, [dragConnection]);

  // Complete a connection when dropping on an input port
  const handlePortDrop = (nodeId: string, portName: string) => {
    if (!dragConnection) return;

    // Don't connect to self
    if (dragConnection.fromNodeId === nodeId) return;

    // Check if connection already exists
    const exists = connections.some(c =>
      c.from.nodeId === dragConnection.fromNodeId &&
      c.from.port === dragConnection.fromPort &&
      c.to.nodeId === nodeId &&
      c.to.port === portName
    );

    if (!exists) {
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        from: { nodeId: dragConnection.fromNodeId, port: dragConnection.fromPort },
        to: { nodeId, port: portName },
      };
      setConnections(prev => [...prev, newConnection]);
    }

    setDragConnection(null);
  };

  // Cancel connection drag
  const handleConnectionDragEnd = () => {
    setDragConnection(null);
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const rect = (e.target as HTMLElement).closest('.flow-node')?.getBoundingClientRect();
    if (!rect) return;

    setDragging({
      nodeId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });
    setSelectedNode(nodeId);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Handle connection dragging
    if (dragConnection && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      setDragConnection(prev => prev ? {
        ...prev,
        currentX: e.clientX - canvasRect.left,
        currentY: e.clientY - canvasRect.top,
      } : null);
      return;
    }

    // Handle node dragging
    if (!dragging || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - canvasRect.left - dragging.offsetX;
    const newY = e.clientY - canvasRect.top - dragging.offsetY;

    setNodes(prev => prev.map(node =>
      node.id === dragging.nodeId
        ? { ...node, x: Math.max(0, newX), y: Math.max(0, newY) }
        : node
    ));
  }, [dragging, dragConnection]);

  const handleMouseUp = () => {
    setDragging(null);
    setDragConnection(null);
  };

  const addModuleNode = (mod: ModuleDefinition) => {
    const io = getModuleIO(mod);
    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type: 'module',
      name: mod.name,
      category: mod.category,
      moduleId: mod.id,
      x: 200 + Math.random() * 200,
      y: 150 + Math.random() * 150,
      inputs: io.inputs,
      outputs: io.outputs,
      config: {},
    };
    setNodes(prev => [...prev, newNode]);
  };

  // Filter modules for palette
  const filteredModules = useMemo(() => {
    return RHIZOS_MODULES.filter(mod => {
      const matchesCategory = paletteCategory === 'all' || mod.category === paletteCategory;
      const matchesSearch = paletteSearch === '' ||
        mod.name.toLowerCase().includes(paletteSearch.toLowerCase()) ||
        mod.description.toLowerCase().includes(paletteSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [paletteCategory, paletteSearch]);

  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.from.nodeId !== nodeId && c.to.nodeId !== nodeId));
    setSelectedNode(null);
  };

  // Update node config
  const updateNodeConfig = (nodeId: string, key: string, value: any) => {
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, config: { ...n.config, [key]: value } } : n
    ));
  };

  // Node-specific config options
  const NODE_CONFIGS: Record<string, Array<{
    key: string;
    label: string;
    type: 'select' | 'text' | 'number' | 'textarea' | 'checkbox';
    options?: string[];
    placeholder?: string;
    default?: any;
  }>> = {
    llm: [
      { key: 'model', label: 'Model', type: 'select', options: ['gpt-4', 'gpt-4-turbo', 'claude-3-opus', 'claude-3-sonnet', 'llama-3-70b', 'mistral-large'], default: 'gpt-4' },
      { key: 'temperature', label: 'Temperature', type: 'number', default: 0.7 },
      { key: 'max_tokens', label: 'Max Tokens', type: 'number', default: 2048 },
      { key: 'system_prompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant...' },
    ],
    agent: [
      { key: 'agent_type', label: 'Agent Type', type: 'select', options: ['react', 'plan-execute', 'reflexion', 'autogpt'], default: 'react' },
      { key: 'model', label: 'Model', type: 'select', options: ['gpt-4', 'claude-3-opus', 'llama-3-70b'], default: 'gpt-4' },
      { key: 'goal', label: 'Goal / Task', type: 'textarea', placeholder: 'Describe what this agent should accomplish...' },
      { key: 'max_iterations', label: 'Max Iterations', type: 'number', default: 10 },
      { key: 'verbose', label: 'Verbose Logging', type: 'checkbox', default: false },
    ],
    memory: [
      { key: 'provider', label: 'Vector Store', type: 'select', options: ['pinecone', 'weaviate', 'chroma', 'qdrant', 'in-memory'], default: 'pinecone' },
      { key: 'collection', label: 'Collection Name', type: 'text', placeholder: 'my-collection' },
      { key: 'embed_model', label: 'Embedding Model', type: 'select', options: ['text-embedding-3-small', 'text-embedding-3-large', 'all-minilm'], default: 'text-embedding-3-small' },
      { key: 'top_k', label: 'Top K Results', type: 'number', default: 5 },
    ],
    tool: [
      { key: 'tool_type', label: 'Tool Type', type: 'select', options: ['http', 'shell', 'calculator', 'datetime', 'json', 'custom'], default: 'http' },
      { key: 'endpoint', label: 'API Endpoint', type: 'text', placeholder: 'https://api.example.com/v1' },
      { key: 'method', label: 'HTTP Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], default: 'POST' },
      { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', default: 30000 },
    ],
    trading: [
      { key: 'exchange', label: 'Exchange', type: 'select', options: ['binance', 'coinbase', 'kraken', 'uniswap', 'hyperliquid', 'jupiter'], default: 'binance' },
      { key: 'pair', label: 'Trading Pair', type: 'text', placeholder: 'ETH/USDT', default: 'ETH/USDT' },
      { key: 'strategy', label: 'Strategy', type: 'select', options: ['macd', 'rsi', 'bollinger', 'ema_cross', 'custom'], default: 'macd' },
      { key: 'dry_run', label: 'Dry Run (Paper Trade)', type: 'checkbox', default: true },
      { key: 'max_position', label: 'Max Position Size', type: 'number', default: 1000 },
    ],
    search: [
      { key: 'search_type', label: 'Search Type', type: 'select', options: ['web', 'news', 'images', 'academic', 'knowledge'], default: 'web' },
      { key: 'num_results', label: 'Number of Results', type: 'number', default: 10 },
      { key: 'time_range', label: 'Time Range', type: 'select', options: ['day', 'week', 'month', 'year', 'all'], default: 'all' },
      { key: 'safe_search', label: 'Safe Search', type: 'checkbox', default: true },
    ],
  };

  const getNodeColor = (category: string) => {
    return getCategoryColor(category);
  };

  const getNodeIcon = (category: string) => {
    return getCategoryIcon(category);
  };

  // Calculate connection paths
  const getConnectionPath = (conn: Connection) => {
    const fromPos = getPortPosition(conn.from.nodeId, conn.from.port, 'output');
    const toPos = getPortPosition(conn.to.nodeId, conn.to.port, 'input');

    if (!fromPos || !toPos) return '';

    const startX = fromPos.x;
    const startY = fromPos.y;
    const endX = toPos.x;
    const endY = toPos.y;

    const midX = (startX + endX) / 2;
    const controlOffset = Math.min(Math.abs(endX - startX) * 0.5, 100);

    return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
  };

  // Get path for dragging connection preview
  const getDragConnectionPath = () => {
    if (!dragConnection) return '';

    const { startX, startY, currentX, currentY } = dragConnection;
    const controlOffset = Math.min(Math.abs(currentX - startX) * 0.5, 100);

    return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${currentX - controlOffset} ${currentY}, ${currentX} ${currentY}`;
  };

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--gap-md)',
        padding: '0 var(--gap-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
          <button
            onClick={() => isWorkspaceMode ? navigate(`/workspace/${workspaceId}`) : navigate('/deploy')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title={isWorkspaceMode ? 'Back to workspace' : 'Back to deploy'}
          >
            <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="page-title" style={{ fontSize: '1.25rem', margin: 0 }}>
                {flowName}
              </h2>
              {isWorkspaceMode && (
                <span style={{
                  fontSize: '0.6rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(0, 255, 255, 0.15)',
                  color: 'var(--primary)',
                  textTransform: 'uppercase',
                }}>
                  Workspace Flow
                </span>
              )}
              {hasUnsavedChanges && (
                <span style={{ color: 'var(--warning)', fontSize: '0.7rem' }}>*</span>
              )}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              {isWorkspaceMode ? `Editing workspace flow` : (currentFlowId ? `ID: ${currentFlowId.slice(0, 20)}...` : 'Not saved')}
            </div>
          </div>
        </div>

        {/* Workspace Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
          {!isWorkspaceMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                value={selectedWorkspaceId || ''}
                onChange={(e) => setSelectedWorkspaceId(e.target.value || null)}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(0, 255, 255, 0.05)',
                  border: '1px solid rgba(0, 255, 255, 0.3)',
                  borderRadius: '4px',
                  color: selectedWorkspaceId ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  minWidth: '150px',
                }}
              >
                <option value="">No workspace (local)</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
              {selectedWorkspaceId && workspaceResources && (
                <span style={{
                  fontSize: '0.6rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: workspaceResources.nodes.filter(n => n.status === 'online').length > 0
                    ? 'rgba(0, 255, 65, 0.15)'
                    : 'rgba(255, 170, 0, 0.15)',
                  color: workspaceResources.nodes.filter(n => n.status === 'online').length > 0
                    ? 'var(--success)'
                    : 'var(--warning)',
                }}>
                  {workspaceResources.nodes.filter(n => n.status === 'online').length} nodes online
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
          {!isWorkspaceMode && (
            <CyberButton onClick={newFlow} icon={Plus} title="New flow">
              NEW
            </CyberButton>
          )}
          <CyberButton onClick={() => isWorkspaceMode ? saveFlow() : setShowSaveDialog(true)} icon={Save} title="Save flow">
            SAVE
          </CyberButton>
          {!isWorkspaceMode && (
            <CyberButton onClick={() => setShowLoadDialog(true)} icon={FolderOpen} title="Load flow">
              LOAD
            </CyberButton>
          )}
          <CyberButton onClick={() => setShowRequirements(!showRequirements)}>
            {showRequirements ? 'HIDE' : 'SHOW'} REQ
          </CyberButton>
          <CyberButton onClick={() => setShowPalette(!showPalette)}>
            {showPalette ? 'HIDE' : 'SHOW'} MODULES
          </CyberButton>
          <CyberButton
            variant="success"
            icon={Play}
            onClick={handleDeploy}
            disabled={computeRequirements.missingKeys.length > 0 || nodes.length === 0 || isDeploying}
            title={computeRequirements.missingKeys.length > 0 ? 'Missing API keys' : nodes.length === 0 ? 'Add modules first' : 'Deploy this flow'}
          >
            {isDeploying ? 'DEPLOYING...' : 'DEPLOY FLOW'}
          </CyberButton>
        </div>
      </div>

      {/* Requirements Panel */}
      {showRequirements && nodes.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 'var(--gap-md)',
          marginBottom: 'var(--gap-md)',
          padding: '0 var(--gap-md)',
        }}>
          {/* Compute Requirements */}
          <div style={{
            flex: 1,
            background: 'var(--bg-surface)',
            border: '1px solid rgba(0, 255, 255, 0.15)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--gap-md)',
          }}>
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 'var(--gap-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Cpu size={12} /> Compute Requirements
            </div>
            <div style={{ display: 'flex', gap: 'var(--gap-xl)' }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  color: computeRequirements.vram > 0 ? 'var(--primary)' : 'var(--text-muted)',
                }}>
                  {computeRequirements.vram > 0 ? `${computeRequirements.vram} GB` : 'N/A'}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>VRAM</div>
              </div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  color: 'var(--text-secondary)',
                }}>
                  {computeRequirements.ram} GB
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>RAM</div>
              </div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  color: 'var(--text-secondary)',
                }}>
                  {computeRequirements.cpu}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>vCPU</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{
                  fontSize: '0.8rem',
                  color: computeRequirements.isLocal ? 'var(--primary)' : 'var(--success)',
                  fontFamily: 'var(--font-display)',
                }}>
                  {computeRequirements.isLocal ? 'GPU Required' : computeRequirements.isApiOnly ? 'API Only' : 'No Compute'}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {nodes.length} module{nodes.length !== 1 ? 's' : ''} in flow
                </div>
              </div>
            </div>
          </div>

          {/* Workspace Available Resources */}
          {(selectedWorkspaceId || isWorkspaceMode) && workspaceResources && (
            <div style={{
              flex: 1,
              background: 'var(--bg-surface)',
              border: '1px solid rgba(0, 255, 65, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--gap-md)',
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--success)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 'var(--gap-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <Server size={12} /> Workspace Available
              </div>
              <div style={{ display: 'flex', gap: 'var(--gap-xl)' }}>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.25rem',
                    color: workspaceResources.totalVram >= computeRequirements.vram ? 'var(--success)' : 'var(--warning)',
                  }}>
                    {workspaceResources.totalVram > 0 ? `${workspaceResources.totalVram} GB` : 'N/A'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    VRAM {workspaceResources.totalVram >= computeRequirements.vram ? '\u2713' : '\u2717'}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.25rem',
                    color: workspaceResources.totalRam >= computeRequirements.ram ? 'var(--success)' : 'var(--warning)',
                  }}>
                    {workspaceResources.totalRam} GB
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    RAM {workspaceResources.totalRam >= computeRequirements.ram ? '\u2713' : '\u2717'}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.25rem',
                    color: workspaceResources.totalCpu >= computeRequirements.cpu ? 'var(--success)' : 'var(--warning)',
                  }}>
                    {workspaceResources.totalCpu}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    vCPU {workspaceResources.totalCpu >= computeRequirements.cpu ? '\u2713' : '\u2717'}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{
                    fontSize: '0.8rem',
                    color: workspaceResources.totalVram >= computeRequirements.vram &&
                           workspaceResources.totalRam >= computeRequirements.ram &&
                           workspaceResources.totalCpu >= computeRequirements.cpu
                      ? 'var(--success)'
                      : 'var(--warning)',
                    fontFamily: 'var(--font-display)',
                  }}>
                    {workspaceResources.totalVram >= computeRequirements.vram &&
                     workspaceResources.totalRam >= computeRequirements.ram &&
                     workspaceResources.totalCpu >= computeRequirements.cpu
                      ? 'Ready'
                      : 'Insufficient'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {workspaceResources.nodes.filter(n => n.status === 'online').length} node{workspaceResources.nodes.filter(n => n.status === 'online').length !== 1 ? 's' : ''} online
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* API Keys Status */}
          {(() => {
            // Determine which API keys are available (from workspace or local)
            const wsKeys = workspaceResources?.apiKeys || [];
            const hasWorkspaceKey = (provider: string) => wsKeys.some(k => k.provider === provider);
            const hasLocalKey = (provider: string) => !!apiKeys[provider];
            const activeWorkspace = selectedWorkspaceId || (isWorkspaceMode ? workspaceId : null);

            // Calculate missing keys considering workspace keys
            const missingKeys = activeWorkspace
              ? computeRequirements.requiredProviders.filter(p => !hasWorkspaceKey(p) && !hasLocalKey(p))
              : computeRequirements.missingKeys;

            return (
              <div style={{
                flex: 1,
                background: missingKeys.length > 0
                  ? 'rgba(251, 191, 36, 0.05)'
                  : 'var(--bg-surface)',
                border: `1px solid ${missingKeys.length > 0 ? 'rgba(251, 191, 36, 0.3)' : 'rgba(0, 255, 255, 0.15)'}`,
                borderRadius: 'var(--radius-md)',
                padding: 'var(--gap-md)',
              }}>
                <div style={{
                  fontSize: '0.7rem',
                  color: missingKeys.length > 0 ? 'var(--warning)' : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 'var(--gap-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <Key size={12} />
                  API Keys
                  {activeWorkspace && (
                    <span style={{
                      background: 'rgba(0, 255, 255, 0.15)',
                      color: 'var(--primary)',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '0.55rem',
                    }}>
                      from workspace
                    </span>
                  )}
                  {missingKeys.length > 0 && (
                    <span style={{
                      background: 'var(--warning)',
                      color: 'var(--bg-void)',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '0.6rem',
                      fontWeight: 'bold',
                    }}>
                      {missingKeys.length} MISSING
                    </span>
                  )}
                </div>

                {computeRequirements.requiredProviders.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    No API keys required for this flow
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gap-sm)' }}>
                    {computeRequirements.requiredProviders.map(provider => {
                      const hasWsKey = hasWorkspaceKey(provider);
                      const hasLocal = hasLocalKey(provider);
                      const hasKey = activeWorkspace ? (hasWsKey || hasLocal) : hasLocal;
                      const providerInfo = API_PROVIDERS[provider];
                  return (
                    <div
                      key={provider}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        background: hasKey ? 'rgba(0, 255, 65, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                        border: `1px solid ${hasKey ? 'rgba(0, 255, 65, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        color: hasKey ? 'var(--success)' : 'var(--warning)',
                      }}
                    >
                      {hasKey ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      {providerInfo?.name || provider}
                    </div>
                  );
                })}
              </div>
            )}

                {missingKeys.length > 0 && (
                  <button
                    onClick={() => navigate('/settings')}
                    style={{
                      marginTop: 'var(--gap-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {activeWorkspace ? 'Add API keys to workspace' : 'Add API keys in Settings'} <ExternalLink size={12} />
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Cost Comparison & Recommendations Panel */}
      {showRequirements && nodes.length > 0 && (computeRequirements.apiMonthlyCost > 0 || computeRequirements.gpuMonthlyCost > 0 || computeRequirements.recommendations.length > 0) && (
        <div style={{
          display: 'flex',
          gap: 'var(--gap-md)',
          marginBottom: 'var(--gap-md)',
          padding: '0 var(--gap-md)',
        }}>
          {/* Cost Comparison */}
          <div style={{
            flex: 1,
            background: 'linear-gradient(135deg, rgba(0, 255, 65, 0.05) 0%, rgba(0, 255, 255, 0.05) 100%)',
            border: '1px solid rgba(0, 255, 65, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--gap-md)',
          }}>
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--success)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 'var(--gap-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <DollarSign size={12} /> Monthly Cost Estimate
              <span style={{
                marginLeft: 'auto',
                fontSize: '0.55rem',
                color: 'var(--text-muted)',
                fontWeight: 'normal',
              }}>
                ~{computeRequirements.runsPerDay} runs/day
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--gap-xl)', alignItems: 'flex-end' }}>
              {computeRequirements.apiMonthlyCost > 0 && (
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.5rem',
                    color: computeRequirements.gpuMonthlyCost > 0 && computeRequirements.gpuMonthlyCost < computeRequirements.apiMonthlyCost
                      ? 'var(--text-muted)'
                      : 'var(--primary)',
                    textDecoration: computeRequirements.gpuMonthlyCost > 0 && computeRequirements.gpuMonthlyCost < computeRequirements.apiMonthlyCost
                      ? 'line-through'
                      : 'none',
                  }}>
                    ${computeRequirements.apiMonthlyCost.toFixed(0)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Cloud size={10} /> API Costs
                  </div>
                </div>
              )}
              {computeRequirements.gpuMonthlyCost > 0 && (
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.5rem',
                    color: computeRequirements.gpuMonthlyCost < computeRequirements.apiMonthlyCost
                      ? 'var(--success)'
                      : 'var(--primary)',
                  }}>
                    ${computeRequirements.gpuMonthlyCost.toFixed(0)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Server size={10} /> GPU Rental
                    {computeRequirements.recommendedGpu && (
                      <span style={{ color: 'var(--primary)' }}>({computeRequirements.recommendedGpu.toUpperCase()})</span>
                    )}
                  </div>
                </div>
              )}
              {computeRequirements.apiMonthlyCost > 0 && computeRequirements.gpuMonthlyCost > 0 && computeRequirements.gpuMonthlyCost < computeRequirements.apiMonthlyCost && (
                <div style={{
                  marginLeft: 'auto',
                  padding: '6px 12px',
                  background: 'rgba(0, 255, 65, 0.15)',
                  border: '1px solid rgba(0, 255, 65, 0.4)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--success)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-display)',
                }}>
                  Save ${(computeRequirements.apiMonthlyCost - computeRequirements.gpuMonthlyCost).toFixed(0)}/mo
                </div>
              )}
            </div>
          </div>

          {/* Smart Recommendations */}
          {computeRequirements.recommendations.length > 0 && (
            <div style={{
              flex: 1.5,
              background: 'var(--bg-surface)',
              border: '1px solid rgba(255, 0, 255, 0.15)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--gap-md)',
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 'var(--gap-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <Sparkles size={12} /> Smart Recommendations
              </div>
              <div style={{ display: 'flex', gap: 'var(--gap-sm)', flexWrap: 'wrap' }}>
                {computeRequirements.recommendations.slice(0, 3).map((rec, idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: '1 1 200px',
                      padding: 'var(--gap-sm)',
                      background: rec.icon === 'gpu'
                        ? 'rgba(0, 255, 255, 0.08)'
                        : rec.icon === 'cloud'
                        ? 'rgba(99, 102, 241, 0.08)'
                        : 'rgba(255, 0, 255, 0.08)',
                      border: `1px solid ${rec.icon === 'gpu' ? 'rgba(0, 255, 255, 0.3)' : rec.icon === 'cloud' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 0, 255, 0.3)'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    className="hover-lift"
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '4px',
                    }}>
                      {rec.icon === 'gpu' && <Server size={12} style={{ color: 'var(--primary)' }} />}
                      {rec.icon === 'cloud' && <Cloud size={12} style={{ color: 'var(--primary-light)' }} />}
                      {rec.icon === 'tip' && <Lightbulb size={12} style={{ color: 'var(--secondary)' }} />}
                      <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-primary)',
                        fontWeight: 500,
                      }}>
                        {rec.title}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                    }}>
                      {rec.description}
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.7rem',
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        ${rec.monthlyCost.toFixed(0)}/mo
                      </span>
                      {rec.savings && rec.savings > 0 && (
                        <span style={{
                          color: 'var(--success)',
                          fontWeight: 500,
                        }}>
                          Save ${rec.savings.toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Canvas Area */}
      <div style={{ flex: 1, display: 'flex', gap: 'var(--gap-md)', minHeight: 0 }}>
        {/* Module Palette */}
        {showPalette && (
          <div style={{
            width: 260,
            background: 'var(--bg-surface)',
            border: '1px solid rgba(0, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Palette Header */}
            <div style={{ padding: 'var(--gap-md)', borderBottom: '1px solid rgba(0, 255, 255, 0.1)' }}>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 'var(--gap-sm)',
              }}>
                Modules ({filteredModules.length})
              </div>
              {/* Search */}
              <input
                type="text"
                placeholder="Search modules..."
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: 'var(--bg-void)',
                  border: '1px solid rgba(0, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  marginBottom: 'var(--gap-sm)',
                }}
              />
              {/* Category Tabs */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {MODULE_CATEGORIES.slice(0, 4).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setPaletteCategory(cat.id)}
                    style={{
                      padding: '3px 8px',
                      background: paletteCategory === cat.id ? 'var(--primary)' : 'var(--bg-elevated)',
                      border: '1px solid rgba(0, 255, 255, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      color: paletteCategory === cat.id ? 'white' : 'var(--text-muted)',
                      fontSize: '0.6rem',
                      cursor: 'pointer',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                {MODULE_CATEGORIES.slice(4).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setPaletteCategory(cat.id)}
                    style={{
                      padding: '3px 8px',
                      background: paletteCategory === cat.id ? 'var(--primary)' : 'var(--bg-elevated)',
                      border: '1px solid rgba(0, 255, 255, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      color: paletteCategory === cat.id ? 'white' : 'var(--text-muted)',
                      fontSize: '0.6rem',
                      cursor: 'pointer',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Module List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--gap-sm)' }}>
              {filteredModules.map(mod => {
                const Icon = getCategoryIcon(mod.category);
                const color = getCategoryColor(mod.category);
                const ramGb = (mod.requirements.min_memory_mb || 0) / 1024;
                const vramGb = (mod.requirements.gpu_vram_mb || 0) / 1024;
                return (
                  <div
                    key={mod.id}
                    onClick={() => addModuleNode(mod)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--gap-sm)',
                      padding: 'var(--gap-sm)',
                      background: 'var(--bg-elevated)',
                      border: `1px solid ${color}30`,
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 'var(--gap-xs)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    className="hover-lift"
                    title={mod.description}
                  >
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '4px',
                      background: `${color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        {mod.name}
                        {mod.verified && <Lock size={10} style={{ color: 'var(--success)' }} />}
                      </div>
                      <div style={{
                        fontSize: '0.55rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        gap: '6px',
                        marginTop: '2px',
                      }}>
                        <span>{mod.requirements.min_cpu_cores || 1} CPU</span>
                        <span>{ramGb > 0 ? `${ramGb}GB` : '1GB'}</span>
                        {vramGb > 0 && <span style={{ color }}>{vramGb}GB VRAM</span>}
                      </div>
                    </div>
                    <Plus size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '4px' }} />
                  </div>
                );
              })}
              {filteredModules.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--gap-lg)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  No modules found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={(e) => {
            // Deselect when clicking on empty canvas
            if (e.target === canvasRef.current) {
              setSelectedNode(null);
            }
          }}
          style={{
            flex: 1,
            background: 'var(--bg-void)',
            border: '1px solid rgba(0, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            position: 'relative',
            overflow: 'hidden',
            backgroundImage: `
              linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        >
          {/* Connection SVG */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <defs>
              <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            {connections.map(conn => (
              <path
                key={conn.id}
                d={getConnectionPath(conn)}
                fill="none"
                stroke="url(#connectionGradient)"
                strokeWidth="3"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="10"
                  to="0"
                  dur="0.5s"
                  repeatCount="indefinite"
                />
              </path>
            ))}
            {/* Drag connection preview */}
            {dragConnection && (
              <path
                d={getDragConnectionPath()}
                fill="none"
                stroke="#00ffff"
                strokeWidth="3"
                strokeDasharray="8 4"
                opacity="0.8"
              />
            )}
          </svg>

          {/* Nodes */}
          {nodes.map(node => {
            const Icon = getNodeIcon(node.category);
            const color = getNodeColor(node.category);
            const moduleDef = node.moduleId ? RHIZOS_MODULES.find(m => m.id === node.moduleId) : null;
            const isSelected = selectedNode === node.id;

            return (
              <div
                key={node.id}
                className="flow-node"
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(node.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(node.id);
                }}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: 200,
                  background: 'var(--bg-surface)',
                  border: `2px solid ${isSelected ? 'var(--primary)' : color + '60'}`,
                  borderRadius: 'var(--radius-md)',
                  boxShadow: isSelected ? '0 0 20px var(--primary), 0 0 40px rgba(99, 102, 241, 0.3)' : `0 0 20px ${color}20`,
                  cursor: dragging?.nodeId === node.id ? 'grabbing' : 'pointer',
                  userSelect: 'none',
                  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                }}
              >
                {/* Node Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-sm)',
                  padding: 'var(--gap-sm) var(--gap-md)',
                  borderBottom: `1px solid ${color}30`,
                  background: `${color}10`,
                }}>
                  <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
                  <Icon size={16} style={{ color }} />
                  <span style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text-primary)',
                  }}>
                    {node.name}
                  </span>
                  {isSelected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                      style={{
                        background: 'rgba(255, 0, 0, 0.2)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        cursor: 'pointer',
                        color: '#ff4444',
                        display: 'flex',
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Node Body */}
                <div style={{ padding: 'var(--gap-sm) var(--gap-md)' }}>
                  {/* Inputs */}
                  {node.inputs.map(input => {
                    const isHovered = hoveredPort?.nodeId === node.id && hoveredPort?.port === input && hoveredPort?.type === 'input';
                    const canDrop = dragConnection && dragConnection.fromNodeId !== node.id;

                    return (
                      <div
                        key={input}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--gap-xs)',
                          marginBottom: '4px',
                          position: 'relative',
                        }}
                      >
                        {/* Input port - larger clickable area */}
                        <div
                          onMouseEnter={() => setHoveredPort({ nodeId: node.id, port: input, type: 'input' })}
                          onMouseLeave={() => setHoveredPort(null)}
                          onMouseUp={() => handlePortDrop(node.id, input)}
                          style={{
                            position: 'absolute',
                            left: -20,
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: canDrop ? 'crosshair' : 'default',
                          }}
                        >
                          <div style={{
                            width: isHovered && canDrop ? 14 : 10,
                            height: isHovered && canDrop ? 14 : 10,
                            borderRadius: '50%',
                            background: isHovered && canDrop ? '#00ffff' : 'var(--primary)',
                            border: '2px solid var(--bg-void)',
                            boxShadow: isHovered && canDrop ? '0 0 10px #00ffff' : 'none',
                            transition: 'all 0.15s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                          {input}
                        </span>
                      </div>
                    );
                  })}

                  {/* Outputs */}
                  {node.outputs.map(output => {
                    const isHovered = hoveredPort?.nodeId === node.id && hoveredPort?.port === output && hoveredPort?.type === 'output';
                    const isDragging = dragConnection?.fromNodeId === node.id && dragConnection?.fromPort === output;

                    return (
                      <div
                        key={output}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 'var(--gap-xs)',
                          marginBottom: '4px',
                          position: 'relative',
                        }}
                      >
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginRight: '8px' }}>
                          {output}
                        </span>
                        {/* Output port - larger clickable area, draggable */}
                        <div
                          onMouseEnter={() => setHoveredPort({ nodeId: node.id, port: output, type: 'output' })}
                          onMouseLeave={() => setHoveredPort(null)}
                          onMouseDown={(e) => handlePortDragStart(e, node.id, output)}
                          style={{
                            position: 'absolute',
                            right: -20,
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'crosshair',
                          }}
                        >
                          <div style={{
                            width: isHovered || isDragging ? 14 : 10,
                            height: isHovered || isDragging ? 14 : 10,
                            borderRadius: '50%',
                            background: isDragging ? '#00ff41' : (isHovered ? '#00ffff' : 'var(--primary-light)'),
                            border: '2px solid var(--bg-void)',
                            boxShadow: isHovered || isDragging ? '0 0 10px #00ffff' : 'none',
                            transition: 'all 0.15s ease',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Node Footer */}
                <div style={{
                  padding: '4px var(--gap-md)',
                  borderTop: `1px solid ${color}20`,
                  fontSize: '0.6rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {moduleDef?.verified && <Lock size={8} style={{ color: 'var(--success)' }} />}
                    {node.category.replace('-', ' ')}
                    {moduleDef && ` • ${moduleDef.tools.length} tools`}
                  </span>
                  {!isSelected && (
                    <span style={{ color: 'var(--primary)', opacity: 0.7 }}>
                      click to configure
                    </span>
                  )}
                  {isSelected && Object.keys(node.config).length > 0 && (
                    <span style={{ color: 'var(--success)' }}>
                      ✓ configured
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {nodes.length === 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}>
              <Box size={48} style={{ margin: '0 auto var(--gap-md)', opacity: 0.3 }} />
              <p>Click modules on the left to add them to your flow</p>
            </div>
          )}
        </div>

        {/* Node Config Panel */}
        {selectedNode && (
          <div style={{
            width: 280,
            background: 'var(--bg-surface)',
            border: '1px solid rgba(0, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--gap-md)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--gap-md)',
            }}>
              <span style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                Node Config
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {(() => {
              const node = nodes.find(n => n.id === selectedNode);
              if (!node) return null;
              const Icon = getNodeIcon(node.category);
              const color = getNodeColor(node.category);
              const moduleDef = node.moduleId ? RHIZOS_MODULES.find(m => m.id === node.moduleId) : null;

              return (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--gap-sm)',
                    marginBottom: 'var(--gap-md)',
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-sm)',
                      background: `${color}20`,
                      border: `1px solid ${color}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={node.name}
                        onChange={(e) => setNodes(prev => prev.map(n =>
                          n.id === node.id ? { ...n, name: e.target.value } : n
                        ))}
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid rgba(0, 255, 255, 0.2)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px 8px',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.9rem',
                          width: '100%',
                        }}
                      />
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {node.category.replace('-', ' ')}
                        {moduleDef?.verified && <Lock size={8} style={{ marginLeft: '4px', color: 'var(--success)' }} />}
                      </div>
                    </div>
                  </div>

                  {/* Module Info */}
                  {moduleDef && (
                    <div style={{
                      marginBottom: 'var(--gap-md)',
                      padding: 'var(--gap-sm)',
                      background: 'rgba(0, 255, 255, 0.05)',
                      border: '1px solid rgba(0, 255, 255, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      <div style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}>
                        Compute Requirements
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--gap-md)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          <Cpu size={10} style={{ marginRight: '4px' }} />
                          {moduleDef.requirements.min_cpu_cores || 1} CPU
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {((moduleDef.requirements.min_memory_mb || 1024) / 1024).toFixed(0)}GB RAM
                        </span>
                        {moduleDef.requirements.gpu_vram_mb && (
                          <span style={{ color: 'var(--primary)' }}>
                            {(moduleDef.requirements.gpu_vram_mb / 1024).toFixed(0)}GB VRAM
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                        v{moduleDef.version} • {moduleDef.runtime}
                      </div>
                    </div>
                  )}

                  {/* Module Description */}
                  {moduleDef && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginBottom: 'var(--gap-md)',
                      lineHeight: 1.4,
                    }}>
                      {moduleDef.description}
                    </p>
                  )}

                  {/* Available Tools */}
                  {moduleDef && moduleDef.tools.length > 0 && (
                    <div style={{ marginBottom: 'var(--gap-md)' }}>
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        marginBottom: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        Available Tools ({moduleDef.tools.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {moduleDef.tools.map(tool => {
                          const isEnabled = node.config.enabled_tools?.includes(tool) ?? true;
                          return (
                            <button
                              key={tool}
                              onClick={() => {
                                const currentTools = node.config.enabled_tools || moduleDef.tools;
                                const newTools = isEnabled
                                  ? currentTools.filter((t: string) => t !== tool)
                                  : [...currentTools, tool];
                                updateNodeConfig(node.id, 'enabled_tools', newTools);
                              }}
                              style={{
                                padding: '4px 8px',
                                background: isEnabled ? 'rgba(0, 255, 255, 0.15)' : 'var(--bg-elevated)',
                                border: `1px solid ${isEnabled ? 'var(--primary)' : 'rgba(99, 102, 241, 0.2)'}`,
                                borderRadius: 'var(--radius-sm)',
                                color: isEnabled ? 'var(--primary)' : 'var(--text-muted)',
                                fontSize: '0.7rem',
                                fontFamily: 'var(--font-mono)',
                                cursor: 'pointer',
                              }}
                            >
                              {tool}()
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dynamic Config Fields */}
                  <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                    {(NODE_CONFIGS[node.type] || []).map(field => {
                      const value = node.config[field.key] ?? field.default ?? '';
                      const inputStyle = {
                        width: '100%',
                        padding: '8px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                      };

                      return (
                        <div key={field.key} style={{ marginBottom: 'var(--gap-md)' }}>
                          <label style={{
                            display: 'block',
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}>
                            {field.label}
                          </label>

                          {field.type === 'select' && (
                            <select
                              value={value}
                              onChange={(e) => updateNodeConfig(node.id, field.key, e.target.value)}
                              style={inputStyle}
                            >
                              {field.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}

                          {field.type === 'text' && (
                            <input
                              type="text"
                              value={value}
                              placeholder={field.placeholder}
                              onChange={(e) => updateNodeConfig(node.id, field.key, e.target.value)}
                              style={inputStyle}
                            />
                          )}

                          {field.type === 'number' && (
                            <input
                              type="number"
                              value={value}
                              onChange={(e) => updateNodeConfig(node.id, field.key, parseFloat(e.target.value) || 0)}
                              style={inputStyle}
                            />
                          )}

                          {field.type === 'textarea' && (
                            <textarea
                              value={value}
                              placeholder={field.placeholder}
                              onChange={(e) => updateNodeConfig(node.id, field.key, e.target.value)}
                              rows={3}
                              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                            />
                          )}

                          {field.type === 'checkbox' && (
                            <label style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                            }}>
                              <input
                                type="checkbox"
                                checked={value === true}
                                onChange={(e) => updateNodeConfig(node.id, field.key, e.target.checked)}
                                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                              />
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {value ? 'Enabled' : 'Disabled'}
                              </span>
                            </label>
                          )}
                        </div>
                      );
                    })}

                    {/* Show current config as JSON for debugging */}
                    {Object.keys(node.config).length > 0 && (
                      <div style={{
                        marginTop: 'var(--gap-md)',
                        padding: 'var(--gap-sm)',
                        background: 'var(--bg-void)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.65rem',
                        fontFamily: 'monospace',
                        color: 'var(--text-muted)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}>
                        <div style={{ marginBottom: '4px', color: 'var(--primary)', fontWeight: 500 }}>
                          Config Preview:
                        </div>
                        {JSON.stringify(node.config, null, 2)}
                      </div>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: 'var(--gap-sm)',
                    marginTop: 'var(--gap-lg)',
                  }}>
                    <CyberButton icon={Copy} style={{ flex: 1 }}>
                      DUPLICATE
                    </CyberButton>
                    <CyberButton
                      icon={Trash2}
                      onClick={() => deleteNode(node.id)}
                      style={{
                        background: 'rgba(255, 0, 0, 0.1)',
                        borderColor: 'rgba(255, 0, 0, 0.3)',
                        color: '#ff4444',
                      }}
                    >
                      DELETE
                    </CyberButton>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            style={{
              background: '#1a1a2e',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              borderRadius: '8px',
              padding: '24px',
              width: '400px',
              maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: 'var(--primary)', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Save size={18} /> Save Flow
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Flow Name
              </label>
              <input
                type="text"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(0, 255, 65, 0.05)',
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSaveDialog(false)}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(136, 136, 136, 0.5)',
                  borderRadius: '4px',
                  color: '#888',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveFlow}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(0, 255, 65, 0.2)',
                  border: '1px solid #00ff41',
                  borderRadius: '4px',
                  color: '#00ff41',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Dialog */}
      {showLoadDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowLoadDialog(false)}
        >
          <div
            style={{
              background: '#1a1a2e',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              borderRadius: '8px',
              padding: '24px',
              width: '500px',
              maxWidth: '90vw',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: 'var(--primary)', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FolderOpen size={18} /> Load Flow
            </h3>

            {/* Import/Export buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <label style={{
                flex: 1,
                padding: '8px',
                background: 'rgba(0, 255, 255, 0.1)',
                border: '1px solid rgba(0, 255, 255, 0.3)',
                borderRadius: '4px',
                color: 'var(--primary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}>
                <Upload size={14} /> Import from File
                <input
                  type="file"
                  accept=".json,.flow.json"
                  onChange={handleImportFlow}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                onClick={handleExportFlow}
                disabled={!currentFlowId && nodes.length === 0}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: 'rgba(0, 255, 255, 0.1)',
                  border: '1px solid rgba(0, 255, 255, 0.3)',
                  borderRadius: '4px',
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  opacity: (!currentFlowId && nodes.length === 0) ? 0.5 : 1,
                }}
              >
                <Download size={14} /> Export Current
              </button>
            </div>

            {/* Saved flows list */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Saved Flows ({savedFlows.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: '200px' }}>
              {savedFlows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No saved flows yet
                </div>
              ) : (
                savedFlows.map((flow) => (
                  <div
                    key={flow.id}
                    onClick={() => loadFlow(flow.id)}
                    style={{
                      padding: '12px',
                      background: currentFlowId === flow.id ? 'rgba(0, 255, 65, 0.15)' : 'rgba(0, 255, 255, 0.05)',
                      border: `1px solid ${currentFlowId === flow.id ? 'rgba(0, 255, 65, 0.4)' : 'rgba(0, 255, 255, 0.15)'}`,
                      borderRadius: '6px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{flow.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        {flow.nodeCount} nodes
                      </span>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Updated: {new Date(flow.updatedAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setShowLoadDialog(false)}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(136, 136, 136, 0.5)',
                  borderRadius: '4px',
                  color: '#888',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credential Unlock Prompt */}
      {showCredentialPrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={() => setShowCredentialPrompt(false)}
        >
          <div
            style={{
              background: '#1a1a2e',
              border: '1px solid rgba(255, 180, 0, 0.4)',
              borderRadius: '8px',
              padding: '24px',
              width: '400px',
              maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              color: '#ffb400',
              margin: '0 0 16px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <Lock size={18} />
              {needsSetup ? 'Setup Credential Store' : 'Unlock Credentials'}
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
              {needsSetup
                ? 'This flow uses credentials. Create a master password to secure them.'
                : 'Enter your master password to unlock stored credentials for deployment.'}
            </p>

            {credentialError && (
              <div style={{
                padding: '10px',
                background: 'rgba(255, 80, 80, 0.1)',
                border: '1px solid rgba(255, 80, 80, 0.3)',
                borderRadius: '4px',
                marginBottom: '16px',
                color: '#ff5050',
                fontSize: '0.85rem',
              }}>
                {credentialError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Master Password
              </label>
              <input
                type="password"
                value={credentialPassword}
                onChange={(e) => setCredentialPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCredentialUnlock()}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255, 180, 0, 0.05)',
                  border: '1px solid rgba(255, 180, 0, 0.3)',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder={needsSetup ? 'Create a secure password' : 'Enter your password'}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCredentialPrompt(false);
                  setCredentialPassword('');
                  setCredentialError(null);
                }}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(136, 136, 136, 0.5)',
                  borderRadius: '4px',
                  color: '#888',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCredentialUnlock}
                disabled={!credentialPassword}
                style={{
                  padding: '10px 20px',
                  background: credentialPassword ? 'rgba(255, 180, 0, 0.2)' : 'rgba(136, 136, 136, 0.1)',
                  border: `1px solid ${credentialPassword ? '#ffb400' : 'rgba(136, 136, 136, 0.3)'}`,
                  borderRadius: '4px',
                  color: credentialPassword ? '#ffb400' : '#666',
                  cursor: credentialPassword ? 'pointer' : 'not-allowed',
                }}
              >
                {needsSetup ? 'Create & Deploy' : 'Unlock & Deploy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deploy Dialog */}
      {showDeployDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !isDeploying && setShowDeployDialog(false)}
        >
          <div
            style={{
              background: '#1a1a2e',
              border: `1px solid ${deploymentError ? 'rgba(255, 80, 80, 0.4)' : deploymentStatus?.status === 'completed' ? 'rgba(0, 255, 65, 0.4)' : 'rgba(0, 255, 255, 0.3)'}`,
              borderRadius: '8px',
              padding: '24px',
              width: '500px',
              maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              color: deploymentError ? '#ff5050' : deploymentStatus?.status === 'completed' ? '#00ff41' : 'var(--primary)',
              margin: '0 0 20px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <Play size={18} />
              {isDeploying ? 'Deploying Flow...' : deploymentError ? 'Deployment Failed' : deploymentStatus?.status === 'completed' ? 'Deployment Complete' : 'Deployment Status'}
            </h3>

            {/* Deployment ID */}
            {deploymentId && (
              <div style={{ marginBottom: '16px', padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Deployment ID</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{deploymentId}</div>
              </div>
            )}

            {/* Error Message */}
            {deploymentError && (
              <div style={{
                padding: '12px',
                background: 'rgba(255, 80, 80, 0.1)',
                border: '1px solid rgba(255, 80, 80, 0.3)',
                borderRadius: '4px',
                marginBottom: '16px',
              }}>
                <div style={{ color: '#ff5050', fontSize: '0.85rem' }}>{deploymentError}</div>
              </div>
            )}

            {/* Node Statuses */}
            {deploymentStatus && Object.keys(deploymentStatus.node_statuses).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Node Progress</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(deploymentStatus.node_statuses).map(([nodeId, status]) => {
                    const node = nodes.find(n => n.id === nodeId);
                    const statusColor = status.status === 'completed' ? '#00ff41' :
                      status.status === 'running' ? 'var(--primary)' :
                      status.status === 'failed' ? '#ff5050' :
                      status.status === 'skipped' ? '#888' : 'var(--text-muted)';
                    return (
                      <div key={nodeId} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '4px',
                        borderLeft: `3px solid ${statusColor}`,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{node?.name || nodeId}</div>
                          {status.error && (
                            <div style={{ fontSize: '0.7rem', color: '#ff5050', marginTop: '2px' }}>{status.error}</div>
                          )}
                        </div>
                        <div style={{
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          color: statusColor,
                          fontWeight: 600,
                        }}>
                          {status.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cost Summary */}
            {deploymentStatus && deploymentStatus.total_cost_cents > 0 && (
              <div style={{
                padding: '10px',
                background: 'rgba(0, 255, 65, 0.1)',
                borderRadius: '4px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Cost</span>
                <span style={{ color: '#00ff41', fontFamily: 'var(--font-display)' }}>
                  ${(deploymentStatus.total_cost_cents / 100).toFixed(2)}
                </span>
              </div>
            )}

            {/* Loading indicator */}
            {isDeploying && !deploymentStatus && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid rgba(0, 255, 255, 0.2)',
                  borderTop: '3px solid var(--primary)',
                  borderRadius: '50%',
                  margin: '0 auto 12px',
                  animation: 'spin 1s linear infinite',
                }}></div>
                Connecting to orchestrator...
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              {isDeploying && (
                <button
                  onClick={handleCancelDeployment}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(255, 80, 80, 0.2)',
                    border: '1px solid #ff5050',
                    borderRadius: '4px',
                    color: '#ff5050',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
              {!isDeploying && (
                <button
                  onClick={() => setShowDeployDialog(false)}
                  style={{
                    padding: '10px 20px',
                    background: deploymentStatus?.status === 'completed' ? 'rgba(0, 255, 65, 0.2)' : 'transparent',
                    border: `1px solid ${deploymentStatus?.status === 'completed' ? '#00ff41' : 'rgba(136, 136, 136, 0.5)'}`,
                    borderRadius: '4px',
                    color: deploymentStatus?.status === 'completed' ? '#00ff41' : '#888',
                    cursor: 'pointer',
                  }}
                >
                  {deploymentStatus?.status === 'completed' ? 'Done' : 'Close'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
