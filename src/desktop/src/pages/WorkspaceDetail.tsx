import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, MoreVertical, GripVertical, Users, Server,
  Terminal, LayoutGrid, Trash2, Edit2, CheckCircle, Clock, Circle,
  Copy, RefreshCw, Settings, Cpu, HardDrive, Zap, Key, GitBranch, Play,
  DollarSign, Activity, FolderGit2, ExternalLink, AlertTriangle, Shield,
  FileCode, Users2, TrendingUp, Loader2
} from 'lucide-react';
import { CyberButton } from '../components';
import { authFetch } from '../App';

// UUID helper that works on HTTP (non-secure contexts)
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for HTTP
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Types
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceMember {
  userId: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

interface ResourceLimits {
  cpuCores?: number;
  ramPercent?: number;
  storageGb?: number;
  gpuVramPercent?: number[];
}

interface WorkspaceNode {
  id: string;
  hostname: string;
  status: 'online' | 'offline' | 'busy';
  capabilities: {
    cpuCores: number;
    memoryMb: number;
    gpuCount: number;
    gpus?: Array<{ model: string; vramMb: number }>;
  };
  resourceLimits?: ResourceLimits | null;
  remoteControlEnabled?: boolean;
  reputation?: number;
}

interface Workspace {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  inviteCode?: string;
  members: WorkspaceMember[];
  nodeCount: number;
  createdAt: string;
}

type TabType = 'tasks' | 'console' | 'resources' | 'api-keys' | 'flows' | 'repos' | 'storage';

interface WorkspaceFlow {
  id: string;
  name: string;
  description: string;
  flow: any;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiKey {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'custom';
  name: string;
  maskedKey: string;
  addedBy: string;
  addedAt: string;
}

// Repo analysis types
interface RepoAnalysis {
  id: string;
  url: string;
  name: string;
  status: 'pending' | 'cloning' | 'analyzing' | 'ready' | 'error';
  error?: string;
  addedBy: string;
  addedAt: string;
  analyzedAt?: string;
  // Analysis data (from on-bored)
  data?: {
    repoName: string;
    primaryLanguage: string;
    totalCommits: number;
    contributors: Array<{ name: string; commits: number; focus?: string }>;
    techStack: Array<{ name: string; type: string }>;
    topFiles: Array<{ file: string; changes: number }>;
    security?: { vulnerabilities: Array<{ type: string; file: string; line?: number; description: string }> };
    deadCode?: {
      unusedComponents: Array<{ component: string; path: string; confidence?: string; reason?: string }>;
      unusedExports: Array<{ export: string; file: string; confidence?: string; reason?: string }>;
      unusedFiles: Array<{ file: string; path: string; confidence?: string; reason?: string }>;
      notes?: string[];
    };
    generatedSummary?: string;
    aiSummary?: string;
    aiKeyThings?: string[];
    aiGotchas?: string[];
    // Enhanced AI data
    ai?: {
      summary?: string;
      projectType?: string;
      architecture?: {
        pattern?: string;
        description?: string;
        keyDirectories?: string[];
        dataFlow?: string;
      };
      keyThings?: string[];
      gotchas?: string[];
      strengths?: string[];
      codePatterns?: Array<{ name: string; description: string; example?: string }>;
      quickStart?: {
        setup?: string[];
        firstTask?: string;
        keyFiles?: string[];
      };
      onboardingSteps?: Array<{ day: string; title: string; tasks: string[] }>;
      learningPath?: Array<{ topic: string; why: string; resources: string }>;
      commonTasks?: Array<{ task: string; howTo: string }>;
      recommendations?: Array<{ category: string; title: string; description: string; priority: string }>;
      deadCodeAnalysis?: {
        overallAssessment?: string;
        priority?: string;
        estimatedCleanupEffort?: string;
        recommendations?: string[];
      };
      refactoringOpportunities?: Array<{ area: string; suggestion: string; benefit: string }>;
    };
  };
}

// Storage file types
interface StoredFile {
  id: string;
  cid: string;
  name: string;
  size: number;
  mimeType: string;
  addedBy: string;
  addedAt: string;
  pinned: boolean;
}

const COLUMN_CONFIG = [
  { id: 'todo', title: 'To Do', icon: Circle, color: 'var(--text-muted)' },
  { id: 'in_progress', title: 'In Progress', icon: Clock, color: 'var(--warning)' },
  { id: 'done', title: 'Done', icon: CheckCircle, color: 'var(--success)' },
] as const;

export function WorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nodes, setNodes] = useState<WorkspaceNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('tasks');

  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
  });

  // Drag state
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Console state
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleHistory, setConsoleHistory] = useState<Array<{ type: 'input' | 'output' | 'error'; text: string }>>([
    { type: 'output', text: 'Welcome to OtherThing Console. Type "help" for available commands.' },
  ]);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState({
    provider: 'openai' as ApiKey['provider'],
    name: '',
    key: '',
  });
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  // Flows state
  const [flows, setFlows] = useState<WorkspaceFlow[]>([]);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowForm, setFlowForm] = useState({
    name: '',
    description: '',
  });
  const [flowError, setFlowError] = useState<string | null>(null);

  // Repos state
  const [repos, setRepos] = useState<RepoAnalysis[]>([]);
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [repoToken, setRepoToken] = useState('');
  const [repoError, setRepoError] = useState<string | null>(null);
  const [analyzingRepo, setAnalyzingRepo] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<RepoAnalysis | null>(null);

  // Storage state
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadContent, setUploadContent] = useState('');
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Node share key state
  const [nodeShareKey, setNodeShareKey] = useState('');
  const [nodeShareKeyError, setNodeShareKeyError] = useState<string | null>(null);
  const [nodeShareKeySuccess, setNodeShareKeySuccess] = useState<string | null>(null);
  const [addingNode, setAddingNode] = useState(false);

  // Usage state
  interface UsageSummary {
    totalCostCents: number;
    totalTokens: number;
    totalComputeSeconds: number;
    byProvider: Record<string, { tokens: number; cost: number }>;
    byFlow: Record<string, { runs: number; cost: number }>;
  }
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);

  // Load workspace data
  const loadWorkspace = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const res = await authFetch(`/api/v1/workspaces/${id}`);
      if (!res.ok) throw new Error('Failed to load workspace');
      const data = await res.json();
      setWorkspace(data.workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load tasks
  const loadTasks = useCallback(async () => {
    if (!id) return;

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch {
      // Tasks API might not exist yet, use local state
    }
  }, [id]);

  // Load nodes
  const loadNodes = useCallback(async () => {
    if (!id) return;

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/nodes`);
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
      }
    } catch {
      // Nodes might fail, use empty
    }
  }, [id]);

  // Load API keys
  const loadApiKeys = useCallback(async () => {
    if (!id) return;

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/api-keys`);
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.apiKeys || []);
      }
    } catch {
      // API keys might fail, use empty
    }
  }, [id]);

  // Load flows
  const loadFlows = useCallback(async () => {
    if (!id) return;

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/flows`);
      if (res.ok) {
        const data = await res.json();
        setFlows(data.flows || []);
      }
    } catch {
      // Flows might fail, use empty
    }
  }, [id]);

  // Load repos
  const loadRepos = useCallback(async () => {
    if (!id) return;

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/repos`);
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repos || []);
      }
    } catch {
      // Repos might fail, use empty
    }
  }, [id]);

  // Load files
  const loadFiles = useCallback(async () => {
    if (!id) return;

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/storage/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch {
      // Files might fail, use empty
    }
  }, [id]);

  // Load usage summary
  const loadUsage = useCallback(async () => {
    if (!id) return;

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/usage/summary?days=30`);
      if (res.ok) {
        const data = await res.json();
        setUsageSummary(data.summary || null);
      }
    } catch {
      // Usage might fail, use null
    }
  }, [id]);

  useEffect(() => {
    loadWorkspace();
    loadTasks();
    loadNodes();
    loadApiKeys();
    loadFlows();
    loadRepos();
    loadFiles();
    loadUsage();
  }, [loadWorkspace, loadTasks, loadNodes, loadApiKeys, loadFlows, loadRepos, loadFiles, loadUsage]);

  // Task CRUD
  const createTask = async () => {
    if (!taskForm.title.trim() || !id) return;

    setTaskError(null);

    const newTask: Task = {
      id: generateUUID(),
      title: taskForm.title,
      description: taskForm.description,
      status: 'todo',
      priority: taskForm.priority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Try to save to backend
    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(prev => [...prev, data.task]);
        setTaskForm({ title: '', description: '', priority: 'medium' });
        setShowTaskModal(false);
      } else {
        // Show error to user
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error || `Failed to create task (${res.status})`;
        setTaskError(errorMsg);
        console.error('Task creation failed:', res.status, errorData);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error - could not reach server';
      setTaskError(errorMsg);
      console.error('Task creation error:', err);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    ));

    // Try to sync to backend
    try {
      await authFetch(`/api/v1/workspaces/${id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch {
      // Local update already done
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      await authFetch(`/api/v1/workspaces/${id}/tasks/${taskId}`, {
        method: 'DELETE',
      });
    } catch {
      // Local delete already done
    }
  };

  // API Key management
  const addApiKey = async () => {
    if (!apiKeyForm.name.trim() || !apiKeyForm.key.trim() || !id) return;

    setApiKeyError(null);

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiKeyForm),
      });

      if (res.ok) {
        const data = await res.json();
        setApiKeys(prev => [...prev, data.apiKey]);
        setApiKeyForm({ provider: 'openai', name: '', key: '' });
        setShowApiKeyModal(false);
      } else {
        const data = await res.json();
        setApiKeyError(data.error || 'Failed to add API key');
      }
    } catch (err) {
      setApiKeyError('Network error');
    }
  };

  const removeApiKey = async (keyId: string) => {
    if (!id) return;

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setApiKeys(prev => prev.filter(k => k.id !== keyId));
      }
    } catch {
      // Failed to delete
    }
  };

  // Flow management
  const createFlow = async () => {
    if (!flowForm.name.trim() || !id) return;

    setFlowError(null);

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: flowForm.name,
          description: flowForm.description,
          flow: { nodes: [], connections: [] },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFlows(prev => [...prev, data.flow]);
        setFlowForm({ name: '', description: '' });
        setShowFlowModal(false);
      } else {
        const data = await res.json();
        setFlowError(data.error || 'Failed to create flow');
      }
    } catch (err) {
      setFlowError('Network error');
    }
  };

  const deleteFlow = async (flowId: string) => {
    if (!id) return;

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/flows/${flowId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setFlows(prev => prev.filter(f => f.id !== flowId));
      }
    } catch {
      // Failed to delete
    }
  };

  // Repo management
  const addRepo = async () => {
    if (!repoUrl.trim() || !id) return;

    setRepoError(null);

    // Extract repo name from URL
    const match = repoUrl.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
    const name = match ? match[1] : repoUrl.split('/').pop() || 'unknown';

    const newRepo: RepoAnalysis = {
      id: generateUUID(),
      url: repoUrl,
      name,
      status: 'pending',
      addedBy: 'current-user', // TODO: get from auth
      addedAt: new Date().toISOString(),
    };

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: repoUrl, name, token: repoToken || undefined }),
      });

      if (res.ok) {
        const data = await res.json();
        setRepos(prev => [...prev, data.repo || newRepo]);
        setRepoUrl('');
        setRepoToken('');
        setShowRepoModal(false);
        // Trigger analysis
        analyzeRepo(data.repo?.id || newRepo.id);
      } else {
        const data = await res.json();
        setRepoError(data.error || 'Failed to add repo');
      }
    } catch (err) {
      setRepoError('Network error');
    }
  };

  const analyzeRepo = async (repoId: string) => {
    if (!id) return;

    setAnalyzingRepo(repoId);
    setRepos(prev => prev.map(r =>
      r.id === repoId ? { ...r, status: 'cloning' } : r
    ));

    try {
      // This will eventually call Tauri to clone and run on-bored analysis
      // For now, we call the API endpoint that handles it
      const res = await authFetch(`/api/v1/workspaces/${id}/repos/${repoId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Check if workspace has nodes with GPU for AI inference
          useWorkspaceCompute: nodes.some(n => n.capabilities.gpuCount > 0 && n.status === 'online'),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRepos(prev => prev.map(r =>
          r.id === repoId ? { ...r, status: 'ready', data: data.analysis, analyzedAt: new Date().toISOString() } : r
        ));
      } else {
        const data = await res.json();
        setRepos(prev => prev.map(r =>
          r.id === repoId ? { ...r, status: 'error', error: data.error || 'Analysis failed' } : r
        ));
      }
    } catch (err) {
      setRepos(prev => prev.map(r =>
        r.id === repoId ? { ...r, status: 'error', error: 'Network error during analysis' } : r
      ));
    } finally {
      setAnalyzingRepo(null);
    }
  };

  const deleteRepo = async (repoId: string) => {
    if (!id) return;

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/repos/${repoId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setRepos(prev => prev.filter(r => r.id !== repoId));
        if (selectedRepo?.id === repoId) {
          setSelectedRepo(null);
        }
      }
    } catch {
      // Failed to delete
    }
  };

  // File operations
  const uploadFile = async () => {
    if (!uploadContent.trim() || !id) return;

    setUploading(true);
    setUploadError(null);

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/storage/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: uploadContent,
          filename: uploadFilename || 'untitled.txt',
          mimeType: 'text/plain',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFiles(prev => [...prev, data.file]);
        setUploadContent('');
        setUploadFilename('');
        setShowUploadModal(false);
      } else {
        const data = await res.json();
        setUploadError(data.error || 'Upload failed');
      }
    } catch (err) {
      setUploadError('Network error during upload');
    } finally {
      setUploading(false);
    }
  };

  const getFileContent = async (file: StoredFile) => {
    if (!id) return;

    setSelectedFile(file);
    setFileContent(null);
    setLoadingContent(true);

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/storage/content/${file.cid}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content);
      } else {
        setFileContent('Error: Failed to retrieve content');
      }
    } catch {
      setFileContent('Error: Network error');
    } finally {
      setLoadingContent(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!id) return;

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/storage/files/${fileId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setFiles(prev => prev.filter(f => f.id !== fileId));
        if (selectedFile?.id === fileId) {
          setSelectedFile(null);
          setFileContent(null);
        }
      }
    } catch {
      // Failed to delete
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Add node by share key
  const addNodeByShareKey = async () => {
    if (!nodeShareKey.trim() || !id) return;

    setNodeShareKeyError(null);
    setNodeShareKeySuccess(null);
    setAddingNode(true);

    try {
      const res = await authFetch(`/api/v1/workspaces/${id}/nodes/add-by-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareKey: nodeShareKey.toUpperCase().trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setNodeShareKeySuccess(`Node ${data.nodeId} added to workspace!`);
        setNodeShareKey('');
        // Reload nodes to show the new one
        loadNodes();
        // Clear success message after 3 seconds
        setTimeout(() => setNodeShareKeySuccess(null), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setNodeShareKeyError(data.error || 'Failed to add node. Check that the share key is correct and the node is online.');
      }
    } catch (err) {
      setNodeShareKeyError('Network error - could not reach server');
    } finally {
      setAddingNode(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (status: Task['status']) => {
    if (draggedTask && draggedTask.status !== status) {
      updateTask(draggedTask.id, { status });
    }
    setDraggedTask(null);
  };

  // Console commands
  const handleConsoleCommand = (cmd: string) => {
    setConsoleHistory(prev => [...prev, { type: 'input', text: `$ ${cmd}` }]);

    const parts = cmd.trim().toLowerCase().split(' ');
    const command = parts[0];

    switch (command) {
      case 'help':
        setConsoleHistory(prev => [...prev, {
          type: 'output',
          text: `Available commands:
  help          - Show this help
  nodes         - List connected nodes
  members       - List workspace members
  stats         - Show workspace statistics
  clear         - Clear console
  tasks         - List all tasks
  run <script>  - Run script on available nodes (coming soon)`
        }]);
        break;
      case 'nodes':
        setConsoleHistory(prev => [...prev, {
          type: 'output',
          text: nodes.length > 0
            ? nodes.map(n => `${n.hostname} [${n.status}] - ${n.capabilities.cpuCores} cores, ${Math.round(n.capabilities.memoryMb/1024)}GB RAM`).join('\n')
            : 'No nodes connected to this workspace'
        }]);
        break;
      case 'members':
        setConsoleHistory(prev => [...prev, {
          type: 'output',
          text: workspace?.members.map(m => `${m.username} (${m.role})`).join('\n') || 'No members'
        }]);
        break;
      case 'stats':
        setConsoleHistory(prev => [...prev, {
          type: 'output',
          text: `Workspace: ${workspace?.name}
Tasks: ${tasks.length} total (${tasks.filter(t => t.status === 'done').length} done)
Nodes: ${nodes.length} connected
Members: ${workspace?.members.length || 0}`
        }]);
        break;
      case 'clear':
        setConsoleHistory([{ type: 'output', text: 'Console cleared.' }]);
        break;
      case 'tasks':
        setConsoleHistory(prev => [...prev, {
          type: 'output',
          text: tasks.length > 0
            ? tasks.map(t => `[${t.status.toUpperCase()}] ${t.title}`).join('\n')
            : 'No tasks'
        }]);
        break;
      default:
        setConsoleHistory(prev => [...prev, {
          type: 'error',
          text: `Unknown command: ${command}. Type "help" for available commands.`
        }]);
    }

    setConsoleInput('');
  };

  if (loading) {
    return (
      <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading workspace...</p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="fade-in">
        <CyberButton icon={ArrowLeft} onClick={() => navigate('/workspace')}>
          BACK TO WORKSPACES
        </CyberButton>
        <div className="cyber-card" style={{ marginTop: 'var(--gap-lg)', textAlign: 'center', padding: 'var(--gap-xl)' }}>
          <p style={{ color: 'var(--error)' }}>{error || 'Workspace not found'}</p>
        </div>
      </div>
    );
  }

  const tasksByStatus = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done: tasks.filter(t => t.status === 'done'),
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-md)',
        marginBottom: 'var(--gap-lg)',
      }}>
        <button
          onClick={() => navigate('/workspace')}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 className="page-title" style={{ marginBottom: '2px' }}>{workspace.name}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {workspace.description || 'No description'} • {workspace.members.length} members • {nodes.length} nodes
          </p>
        </div>
        {workspace.inviteCode && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-sm)',
            padding: 'var(--gap-sm) var(--gap-md)',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>INVITE:</span>
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{workspace.inviteCode}</code>
            <button
              onClick={() => navigator.clipboard.writeText(workspace.inviteCode!)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
            >
              <Copy size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--gap-xs)',
        marginBottom: 'var(--gap-lg)',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: 'var(--gap-xs)',
      }}>
        {[
          { id: 'tasks', label: 'Tasks', icon: LayoutGrid },
          { id: 'repos', label: 'Repos', icon: FolderGit2 },
          { id: 'storage', label: 'Storage', icon: HardDrive },
          { id: 'flows', label: 'Flows', icon: GitBranch },
          { id: 'console', label: 'Console', icon: Terminal },
          { id: 'resources', label: 'Resources', icon: Server },
          { id: 'api-keys', label: 'API Keys', icon: Key },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-xs)',
              padding: 'var(--gap-sm) var(--gap-md)',
              background: activeTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
              fontFamily: 'var(--font-display)',
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'tasks' && (
        <div>
          {/* Task Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--gap-md)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} • {tasksByStatus.done.length} completed
            </span>
            <CyberButton variant="primary" icon={Plus} onClick={() => { setTaskError(null); setShowTaskModal(true); }}>
              ADD TASK
            </CyberButton>
          </div>

          {/* Kanban Board */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--gap-md)',
            minHeight: '500px',
          }}>
            {COLUMN_CONFIG.map(column => (
              <div
                key={column.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.id as Task['status'])}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Column Header */}
                <div style={{
                  padding: 'var(--gap-md)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-sm)',
                }}>
                  <column.icon size={16} style={{ color: column.color }} />
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                  }}>
                    {column.title}
                  </span>
                  <span style={{
                    marginLeft: 'auto',
                    background: 'var(--bg-void)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}>
                    {tasksByStatus[column.id as keyof typeof tasksByStatus].length}
                  </span>
                </div>

                {/* Tasks */}
                <div style={{
                  flex: 1,
                  padding: 'var(--gap-sm)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--gap-sm)',
                }}>
                  {tasksByStatus[column.id as keyof typeof tasksByStatus].map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      className="hover-lift"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: 'var(--gap-sm)',
                        cursor: 'grab',
                        opacity: draggedTask?.id === task.id ? 0.5 : 1,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--gap-xs)',
                      }}>
                        <GripVertical size={14} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            marginBottom: '4px',
                          }}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {task.description}
                            </div>
                          )}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--gap-xs)',
                            marginTop: 'var(--gap-xs)',
                          }}>
                            <span style={{
                              fontSize: '0.65rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: task.priority === 'high' ? 'rgba(255, 100, 100, 0.2)' :
                                         task.priority === 'medium' ? 'rgba(255, 200, 100, 0.2)' :
                                         'rgba(100, 200, 255, 0.2)',
                              color: task.priority === 'high' ? 'var(--error)' :
                                     task.priority === 'medium' ? 'var(--warning)' :
                                     'var(--primary-light)',
                              textTransform: 'uppercase',
                            }}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteTask(task.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            padding: '2px',
                            opacity: 0.5,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {tasksByStatus[column.id as keyof typeof tasksByStatus].length === 0 && (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      opacity: 0.5,
                    }}>
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'flows' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--gap-md)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {flows.length} flow{flows.length !== 1 ? 's' : ''} in this workspace
            </span>
            <CyberButton variant="primary" icon={Plus} onClick={() => { setFlowError(null); setShowFlowModal(true); }}>
              CREATE FLOW
            </CyberButton>
          </div>

          {flows.length === 0 ? (
            <div className="cyber-card">
              <div className="cyber-card-body" style={{ textAlign: 'center', padding: 'var(--gap-xl)' }}>
                <GitBranch size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 'var(--gap-md)' }} />
                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--gap-md)' }}>
                  No flows created in this workspace yet.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Create a flow to automate tasks using workspace compute and API keys.
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 'var(--gap-md)',
            }}>
              {flows.map(flow => (
                <div key={flow.id} className="cyber-card hover-lift" style={{ margin: 0 }}>
                  <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--gap-sm)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-void)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <GitBranch size={18} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div>
                          <div style={{
                            fontFamily: 'var(--font-display)',
                            color: 'var(--text-primary)',
                            fontSize: '0.95rem',
                          }}>
                            {flow.name}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                          }}>
                            {flow.flow?.nodes?.length || 0} nodes
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteFlow(flow.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '4px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--error)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {flow.description && (
                      <p style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        marginBottom: 'var(--gap-sm)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {flow.description}
                      </p>
                    )}
                    <div style={{
                      display: 'flex',
                      gap: 'var(--gap-sm)',
                      marginTop: 'var(--gap-sm)',
                    }}>
                      <CyberButton
                        size="sm"
                        icon={Edit2}
                        onClick={() => navigate(`/flow-builder?workspaceId=${id}&flowId=${flow.id}`)}
                      >
                        EDIT
                      </CyberButton>
                      <CyberButton
                        size="sm"
                        variant="primary"
                        icon={Play}
                        onClick={() => navigate(`/flow-builder?workspaceId=${id}&flowId=${flow.id}&run=true`)}
                      >
                        RUN
                      </CyberButton>
                    </div>
                    <div style={{
                      marginTop: 'var(--gap-sm)',
                      paddingTop: 'var(--gap-sm)',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                    }}>
                      Updated {new Date(flow.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'repos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--gap-md)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {repos.length} repo{repos.length !== 1 ? 's' : ''} in this workspace
            </span>
            <CyberButton variant="primary" icon={Plus} onClick={() => { setRepoError(null); setShowRepoModal(true); }}>
              ADD REPO
            </CyberButton>
          </div>

          {repos.length === 0 ? (
            <div className="cyber-card">
              <div className="cyber-card-body" style={{ textAlign: 'center', padding: 'var(--gap-xl)' }}>
                <FolderGit2 size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 'var(--gap-md)' }} />
                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--gap-md)' }}>
                  No repositories added to this workspace yet.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Add a GitHub repo to generate onboarding documentation for your team.
                </p>
              </div>
            </div>
          ) : selectedRepo ? (
            // Repo detail view
            <div>
              <button
                onClick={() => setSelectedRepo(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-xs)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  marginBottom: 'var(--gap-md)',
                  padding: 0,
                  fontSize: '0.85rem',
                }}
              >
                <ArrowLeft size={16} />
                Back to repos
              </button>

              {/* Repo Header */}
              <div className="cyber-card" style={{ marginBottom: 'var(--gap-md)' }}>
                <div className="cyber-card-body" style={{ padding: 'var(--gap-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--gap-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
                      <FolderGit2 size={32} style={{ color: 'var(--primary)' }} />
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
                          {selectedRepo.name}
                        </h3>
                        <a
                          href={selectedRepo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          {selectedRepo.url} <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                    {selectedRepo.data && (
                      <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
                        {selectedRepo.data.primaryLanguage && (
                          <span style={{
                            padding: '4px 12px',
                            background: 'var(--bg-void)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            color: 'var(--primary)',
                          }}>
                            {selectedRepo.data.primaryLanguage}
                          </span>
                        )}
                        <span style={{
                          padding: '4px 12px',
                          background: 'var(--bg-void)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                        }}>
                          {selectedRepo.data.totalCommits} commits
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  {(selectedRepo.data?.aiSummary || selectedRepo.data?.generatedSummary) && (
                    <div style={{
                      padding: 'var(--gap-md)',
                      background: 'var(--bg-void)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 'var(--gap-md)',
                    }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
                        {selectedRepo.data.aiSummary || selectedRepo.data.generatedSummary}
                      </p>
                    </div>
                  )}

                  {/* AI Key Things */}
                  {selectedRepo.data?.aiKeyThings && selectedRepo.data.aiKeyThings.length > 0 && (
                    <div style={{ marginBottom: 'var(--gap-md)' }}>
                      <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: 'var(--gap-sm)', textTransform: 'uppercase' }}>
                        Key Things to Understand
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {selectedRepo.data.aiKeyThings.map((thing, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>{thing}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI Gotchas */}
                  {selectedRepo.data?.aiGotchas && selectedRepo.data.aiGotchas.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.8rem', color: 'var(--warning)', marginBottom: 'var(--gap-sm)', textTransform: 'uppercase' }}>
                        Watch Out For
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {selectedRepo.data.aiGotchas.map((gotcha, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>{gotcha}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              {selectedRepo.data && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 'var(--gap-md)',
                  marginBottom: 'var(--gap-md)',
                }}>
                  {/* Tech Stack */}
                  <div className="cyber-card" style={{ margin: 0 }}>
                    <div className="cyber-card-header">
                      <span className="cyber-card-title">TECH STACK</span>
                    </div>
                    <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gap-xs)' }}>
                        {selectedRepo.data.techStack.map((tech, i) => (
                          <span key={i} style={{
                            padding: '4px 10px',
                            background: 'var(--bg-void)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                          }}>
                            {tech.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Top Contributors */}
                  <div className="cyber-card" style={{ margin: 0 }}>
                    <div className="cyber-card-header">
                      <span className="cyber-card-title">TOP CONTRIBUTORS</span>
                    </div>
                    <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                      {selectedRepo.data.contributors.slice(0, 5).map((c, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--gap-xs) 0',
                          borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
                            <div style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: i === 0 ? 'var(--primary)' : 'var(--bg-void)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.7rem',
                              color: i === 0 ? 'white' : 'var(--text-muted)',
                            }}>
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{c.name}</span>
                            {c.focus && (
                              <span style={{
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                background: 'rgba(139, 92, 246, 0.1)',
                                color: 'var(--primary-light)',
                                borderRadius: '4px',
                              }}>
                                {c.focus}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.commits} commits</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Security Issues */}
                  {selectedRepo.data.security && selectedRepo.data.security.vulnerabilities.length > 0 && (
                    <div className="cyber-card" style={{ margin: 0 }}>
                      <div className="cyber-card-header" style={{ borderColor: 'var(--error)' }}>
                        <span className="cyber-card-title" style={{ color: 'var(--error)' }}>
                          <Shield size={14} style={{ marginRight: '6px' }} />
                          SECURITY ({selectedRepo.data.security.vulnerabilities.length})
                        </span>
                      </div>
                      <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                        {selectedRepo.data.security.vulnerabilities.slice(0, 5).map((v, i) => (
                          <div key={i} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 'var(--gap-sm)',
                            padding: 'var(--gap-xs) 0',
                            borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none',
                          }}>
                            <AlertTriangle size={14} style={{ color: 'var(--error)', marginTop: '2px', flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{v.type}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.file}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hot Files */}
                  <div className="cyber-card" style={{ margin: 0 }}>
                    <div className="cyber-card-header">
                      <span className="cyber-card-title">
                        <TrendingUp size={14} style={{ marginRight: '6px' }} />
                        HOT FILES
                      </span>
                    </div>
                    <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                      {selectedRepo.data.topFiles.slice(0, 5).map((f, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--gap-xs) 0',
                          borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none',
                        }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {f.file.split('/').pop()}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>{f.changes} changes</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Insights Section */}
              {selectedRepo.data?.ai && (
                <div style={{ marginTop: 'var(--gap-lg)' }}>
                  {/* Architecture */}
                  {selectedRepo.data.ai.architecture && (
                    <div className="cyber-card" style={{ marginBottom: 'var(--gap-md)' }}>
                      <div className="cyber-card-header">
                        <span className="cyber-card-title">🏗️ ARCHITECTURE</span>
                        {selectedRepo.data.ai.architecture.pattern && (
                          <span style={{
                            padding: '2px 8px',
                            background: 'var(--primary)',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                          }}>
                            {selectedRepo.data.ai.architecture.pattern}
                          </span>
                        )}
                      </div>
                      <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                        {selectedRepo.data.ai.architecture.description && (
                          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--gap-md)', lineHeight: 1.6 }}>
                            {selectedRepo.data.ai.architecture.description}
                          </p>
                        )}
                        {selectedRepo.data.ai.architecture.dataFlow && (
                          <div style={{ padding: 'var(--gap-sm)', background: 'var(--bg-void)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--gap-md)' }}>
                            <strong style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>Data Flow:</strong>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                              {selectedRepo.data.ai.architecture.dataFlow}
                            </p>
                          </div>
                        )}
                        {selectedRepo.data.ai.architecture.keyDirectories && selectedRepo.data.ai.architecture.keyDirectories.length > 0 && (
                          <div>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>Key Directories:</strong>
                            <ul style={{ margin: '8px 0 0 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {selectedRepo.data.ai.architecture.keyDirectories.map((d, i) => (
                                <li key={i} style={{ marginBottom: '4px' }}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Code Patterns */}
                  {selectedRepo.data.ai.codePatterns && selectedRepo.data.ai.codePatterns.length > 0 && (
                    <div className="cyber-card" style={{ marginBottom: 'var(--gap-md)' }}>
                      <div className="cyber-card-header">
                        <span className="cyber-card-title">🔮 CODE PATTERNS</span>
                      </div>
                      <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                        {selectedRepo.data.ai.codePatterns.map((p, i) => (
                          <div key={i} style={{
                            marginBottom: 'var(--gap-md)',
                            paddingBottom: 'var(--gap-md)',
                            borderBottom: i < selectedRepo.data!.ai!.codePatterns!.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          }}>
                            <strong style={{ color: 'var(--primary)' }}>{p.name}</strong>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0' }}>{p.description}</p>
                            {p.example && (
                              <code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-void)', padding: '2px 6px', borderRadius: '4px' }}>
                                {p.example}
                              </code>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Start */}
                  {selectedRepo.data.ai.quickStart && (
                    <div className="cyber-card" style={{ marginBottom: 'var(--gap-md)', borderColor: 'var(--success)' }}>
                      <div className="cyber-card-header">
                        <span className="cyber-card-title" style={{ color: 'var(--success)' }}>⚡ QUICK START</span>
                      </div>
                      <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                        {selectedRepo.data.ai.quickStart.setup && selectedRepo.data.ai.quickStart.setup.length > 0 && (
                          <div style={{ marginBottom: 'var(--gap-md)' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>Setup Steps:</strong>
                            <ol style={{ margin: '8px 0 0 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {selectedRepo.data.ai.quickStart.setup.map((s, i) => (
                                <li key={i} style={{ marginBottom: '4px' }}>{s}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {selectedRepo.data.ai.quickStart.firstTask && (
                          <div style={{ padding: 'var(--gap-sm)', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--gap-md)' }}>
                            <strong style={{ color: 'var(--success)', fontSize: '0.8rem' }}>🎯 Good First Task:</strong>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                              {selectedRepo.data.ai.quickStart.firstTask}
                            </p>
                          </div>
                        )}
                        {selectedRepo.data.ai.quickStart.keyFiles && selectedRepo.data.ai.quickStart.keyFiles.length > 0 && (
                          <div>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>📚 Key Files to Read:</strong>
                            <ul style={{ margin: '8px 0 0 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {selectedRepo.data.ai.quickStart.keyFiles.map((f, i) => (
                                <li key={i} style={{ marginBottom: '4px' }}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {selectedRepo.data.ai.recommendations && selectedRepo.data.ai.recommendations.length > 0 && (
                    <div className="cyber-card" style={{ marginBottom: 'var(--gap-md)' }}>
                      <div className="cyber-card-header">
                        <span className="cyber-card-title">📋 AI RECOMMENDATIONS</span>
                      </div>
                      <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                        {selectedRepo.data.ai.recommendations.map((r, i) => (
                          <div key={i} style={{
                            display: 'flex',
                            gap: 'var(--gap-sm)',
                            marginBottom: 'var(--gap-md)',
                            paddingBottom: 'var(--gap-md)',
                            borderBottom: i < selectedRepo.data!.ai!.recommendations!.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              background: r.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : r.priority === 'medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                              color: r.priority === 'high' ? 'var(--error)' : r.priority === 'medium' ? 'var(--warning)' : 'var(--success)',
                              alignSelf: 'flex-start',
                            }}>
                              {r.priority?.toUpperCase()}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)', marginBottom: '4px' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{r.title}</strong>
                                <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--bg-void)', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                  {r.category}
                                </span>
                              </div>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>{r.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Onboarding Timeline */}
                  {selectedRepo.data.ai.onboardingSteps && selectedRepo.data.ai.onboardingSteps.length > 0 && (
                    <div className="cyber-card" style={{ marginBottom: 'var(--gap-md)' }}>
                      <div className="cyber-card-header">
                        <span className="cyber-card-title">📅 ONBOARDING TIMELINE</span>
                      </div>
                      <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                        {selectedRepo.data.ai.onboardingSteps.map((step, i) => (
                          <div key={i} style={{ marginBottom: 'var(--gap-md)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)', marginBottom: '8px' }}>
                              <span style={{
                                padding: '2px 8px',
                                background: 'var(--primary)',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                              }}>
                                {step.day}
                              </span>
                              <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{step.title}</strong>
                            </div>
                            <ul style={{ margin: '0 0 0 20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {step.tasks.map((t, j) => (
                                <li key={j} style={{ marginBottom: '4px' }}>{t}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tech Debt Analysis */}
                  {selectedRepo.data.ai.deadCodeAnalysis && (
                    <div className="cyber-card" style={{ marginBottom: 'var(--gap-md)', borderColor: 'var(--warning)' }}>
                      <div className="cyber-card-header">
                        <span className="cyber-card-title" style={{ color: 'var(--warning)' }}>🧹 TECH DEBT ANALYSIS</span>
                      </div>
                      <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                        <div style={{ display: 'flex', gap: 'var(--gap-md)', marginBottom: 'var(--gap-md)' }}>
                          <div style={{ flex: 1, padding: 'var(--gap-sm)', background: 'var(--bg-void)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Priority</div>
                            <div style={{
                              fontSize: '1rem',
                              fontWeight: 600,
                              color: selectedRepo.data.ai.deadCodeAnalysis.priority === 'high' ? 'var(--error)' :
                                     selectedRepo.data.ai.deadCodeAnalysis.priority === 'medium' ? 'var(--warning)' : 'var(--success)',
                            }}>
                              {selectedRepo.data.ai.deadCodeAnalysis.priority?.toUpperCase()}
                            </div>
                          </div>
                          <div style={{ flex: 1, padding: 'var(--gap-sm)', background: 'var(--bg-void)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Cleanup Effort</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {selectedRepo.data.ai.deadCodeAnalysis.estimatedCleanupEffort}
                            </div>
                          </div>
                        </div>
                        {selectedRepo.data.ai.deadCodeAnalysis.overallAssessment && (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--gap-md)' }}>
                            {selectedRepo.data.ai.deadCodeAnalysis.overallAssessment}
                          </p>
                        )}
                        {selectedRepo.data.ai.deadCodeAnalysis.recommendations && selectedRepo.data.ai.deadCodeAnalysis.recommendations.length > 0 && (
                          <div>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>Recommendations:</strong>
                            <ul style={{ margin: '8px 0 0 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {selectedRepo.data.ai.deadCodeAnalysis.recommendations.map((r, i) => (
                                <li key={i} style={{ marginBottom: '4px' }}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Refactoring Opportunities */}
                  {selectedRepo.data.ai.refactoringOpportunities && selectedRepo.data.ai.refactoringOpportunities.length > 0 && (
                    <div className="cyber-card">
                      <div className="cyber-card-header">
                        <span className="cyber-card-title">🔄 REFACTORING OPPORTUNITIES</span>
                      </div>
                      <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                        {selectedRepo.data.ai.refactoringOpportunities.map((r, i) => (
                          <div key={i} style={{
                            marginBottom: 'var(--gap-md)',
                            paddingBottom: 'var(--gap-md)',
                            borderBottom: i < selectedRepo.data!.ai!.refactoringOpportunities!.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{r.area}</strong>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '4px 0' }}>{r.suggestion}</p>
                            <p style={{ color: 'var(--success)', fontSize: '0.75rem', margin: 0 }}>✨ {r.benefit}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Repo list view
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 'var(--gap-md)',
            }}>
              {repos.map(repo => (
                <div
                  key={repo.id}
                  className="cyber-card hover-lift"
                  style={{ margin: 0, cursor: repo.status === 'ready' ? 'pointer' : 'default' }}
                  onClick={() => repo.status === 'ready' && setSelectedRepo(repo)}
                >
                  <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--gap-sm)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
                        <FolderGit2 size={20} style={{ color: 'var(--primary)' }} />
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {repo.name}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-xs)' }}>
                        {repo.status === 'pending' && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(128, 128, 128, 0.2)', color: 'var(--text-muted)' }}>
                            Pending
                          </span>
                        )}
                        {(repo.status === 'cloning' || repo.status === 'analyzing') && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0, 212, 255, 0.2)', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Loader2 size={12} className="spin" />
                            {repo.status === 'cloning' ? 'Cloning...' : 'Analyzing...'}
                          </span>
                        )}
                        {repo.status === 'ready' && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(100, 255, 100, 0.2)', color: 'var(--success)' }}>
                            Ready
                          </span>
                        )}
                        {repo.status === 'error' && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255, 100, 100, 0.2)', color: 'var(--error)' }}>
                            Error
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteRepo(repo.id); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            padding: '4px',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {repo.error && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--error)', marginBottom: 'var(--gap-sm)' }}>
                        {repo.error}
                      </div>
                    )}

                    {repo.data && (
                      <div>
                        <p style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          marginBottom: 'var(--gap-sm)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {repo.data.aiSummary || repo.data.generatedSummary || 'No summary'}
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--gap-sm)', flexWrap: 'wrap' }}>
                          {repo.data.primaryLanguage && (
                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--bg-void)', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                              {repo.data.primaryLanguage}
                            </span>
                          )}
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--bg-void)', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                            {repo.data.contributors.length} contributors
                          </span>
                          {repo.data.security && repo.data.security.vulnerabilities.length > 0 && (
                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(255, 100, 100, 0.1)', borderRadius: '4px', color: 'var(--error)' }}>
                              {repo.data.security.vulnerabilities.length} issues
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {repo.status === 'ready' && (
                      <div style={{ marginTop: 'var(--gap-sm)', paddingTop: 'var(--gap-sm)', borderTop: '1px solid var(--border-subtle)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Click to view details
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'storage' && (
        <div>
          {/* Storage Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--gap-md)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {files.length} file{files.length !== 1 ? 's' : ''} stored via IPFS
            </span>
            <CyberButton variant="primary" icon={Plus} onClick={() => { setUploadError(null); setShowUploadModal(true); }}>
              UPLOAD FILE
            </CyberButton>
          </div>

          {/* IPFS Status Note */}
          <div style={{
            background: 'rgba(0, 255, 255, 0.05)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--gap-md)',
            marginBottom: 'var(--gap-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-sm)',
          }}>
            <HardDrive size={20} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Files are stored on workspace IPFS nodes. Requires at least one connected node with IPFS enabled.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedFile ? '1fr 1fr' : '1fr', gap: 'var(--gap-md)' }}>
            {/* File List */}
            <div className="cyber-card">
              <div className="cyber-card-header">
                <span className="cyber-card-title">FILES</span>
              </div>
              <div style={{ padding: 'var(--gap-md)', maxHeight: '500px', overflowY: 'auto' }}>
                {files.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--gap-xl)' }}>
                    <HardDrive size={48} style={{ opacity: 0.3, marginBottom: 'var(--gap-sm)' }} />
                    <div>No files stored yet</div>
                    <div style={{ fontSize: '0.8rem', marginTop: 'var(--gap-xs)' }}>Upload content to store it on workspace IPFS</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
                    {files.map(file => (
                      <div
                        key={file.id}
                        onClick={() => getFileContent(file)}
                        style={{
                          padding: 'var(--gap-md)',
                          background: selectedFile?.id === file.id ? 'rgba(0, 255, 255, 0.1)' : 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-sm)',
                          border: selectedFile?.id === file.id ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
                            <FileCode size={18} style={{ color: 'var(--primary)' }} />
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>{file.name}</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--error)',
                              cursor: 'pointer',
                              padding: 'var(--gap-xs)',
                              opacity: 0.6,
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--gap-md)', marginTop: 'var(--gap-xs)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{file.cid.substring(0, 16)}...</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 'var(--gap-xs)' }}>
                          Added by {file.addedBy} • {new Date(file.addedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* File Content Viewer */}
            {selectedFile && (
              <div className="cyber-card">
                <div className="cyber-card-header">
                  <span className="cyber-card-title">{selectedFile.name}</span>
                  <button
                    onClick={() => { setSelectedFile(null); setFileContent(null); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ padding: 'var(--gap-md)' }}>
                  <div style={{ display: 'flex', gap: 'var(--gap-md)', marginBottom: 'var(--gap-md)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>CID: <code style={{ color: 'var(--primary)' }}>{selectedFile.cid}</code></span>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedFile.cid)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <div style={{
                    background: 'var(--bg-void)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--gap-md)',
                    maxHeight: '350px',
                    overflowY: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {loadingContent ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)', color: 'var(--text-muted)' }}>
                        <Loader2 size={16} className="spin" />
                        Retrieving content from IPFS...
                      </div>
                    ) : (
                      fileContent || 'No content loaded'
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="cyber-card" style={{ width: '500px', maxWidth: '90vw' }}>
            <div className="cyber-card-header">
              <span className="cyber-card-title">UPLOAD TO IPFS</span>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 'var(--gap-lg)' }}>
              {uploadError && (
                <div style={{
                  background: 'rgba(255, 0, 0, 0.1)',
                  border: '1px solid var(--error)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--gap-sm)',
                  marginBottom: 'var(--gap-md)',
                  color: 'var(--error)',
                  fontSize: '0.85rem',
                }}>
                  {uploadError}
                </div>
              )}
              <div style={{ marginBottom: 'var(--gap-md)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--gap-xs)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Filename
                </label>
                <input
                  type="text"
                  value={uploadFilename}
                  onChange={(e) => setUploadFilename(e.target.value)}
                  placeholder="document.txt"
                  style={{
                    width: '100%',
                    padding: 'var(--gap-sm)',
                    background: 'var(--bg-void)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>
              <div style={{ marginBottom: 'var(--gap-md)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--gap-xs)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Content
                </label>
                <textarea
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  placeholder="Enter text content to store on IPFS..."
                  rows={10}
                  style={{
                    width: '100%',
                    padding: 'var(--gap-sm)',
                    background: 'var(--bg-void)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--gap-sm)', justifyContent: 'flex-end' }}>
                <CyberButton variant="ghost" onClick={() => setShowUploadModal(false)}>
                  CANCEL
                </CyberButton>
                <CyberButton
                  variant="primary"
                  onClick={uploadFile}
                  disabled={!uploadContent.trim() || uploading}
                >
                  {uploading ? 'UPLOADING...' : 'UPLOAD'}
                </CyberButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'console' && (
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">WORKSPACE CONSOLE</span>
          </div>
          <div style={{
            background: 'var(--bg-void)',
            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
          }}>
            <div style={{
              height: '400px',
              overflowY: 'auto',
              padding: 'var(--gap-md)',
            }}>
              {consoleHistory.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    color: entry.type === 'error' ? 'var(--error)' :
                           entry.type === 'input' ? 'var(--primary)' : 'var(--text-secondary)',
                    marginBottom: '4px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {entry.text}
                </div>
              ))}
            </div>
            <div style={{
              borderTop: '1px solid var(--border-subtle)',
              padding: 'var(--gap-sm) var(--gap-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
            }}>
              <span style={{ color: 'var(--primary)' }}>$</span>
              <input
                type="text"
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && consoleInput.trim()) {
                    handleConsoleCommand(consoleInput);
                  }
                }}
                placeholder="Type a command..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'resources' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--gap-md)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {nodes.length} node{nodes.length !== 1 ? 's' : ''} connected
            </span>
            <CyberButton icon={RefreshCw} onClick={loadNodes}>
              REFRESH
            </CyberButton>
          </div>

          {/* Add Node by Share Key */}
          <div className="cyber-card" style={{ marginBottom: 'var(--gap-md)' }}>
            <div className="cyber-card-header">
              <span className="cyber-card-title">ADD NODE BY SHARE KEY</span>
            </div>
            <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--gap-md)' }}>
                Enter the share key displayed in the OtherThing Node app to add a node to this workspace.
              </p>
              {nodeShareKeyError && (
                <div style={{
                  marginBottom: 'var(--gap-md)',
                  padding: 'var(--gap-sm) var(--gap-md)',
                  background: 'rgba(255, 100, 100, 0.1)',
                  border: '1px solid var(--error)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--error)',
                  fontSize: '0.85rem',
                }}>
                  {nodeShareKeyError}
                </div>
              )}
              {nodeShareKeySuccess && (
                <div style={{
                  marginBottom: 'var(--gap-md)',
                  padding: 'var(--gap-sm) var(--gap-md)',
                  background: 'rgba(100, 255, 100, 0.1)',
                  border: '1px solid var(--success)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--success)',
                  fontSize: '0.85rem',
                }}>
                  {nodeShareKeySuccess}
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--gap-sm)', alignItems: 'center' }}>
                <input
                  type="text"
                  value={nodeShareKey}
                  onChange={(e) => setNodeShareKey(e.target.value.toUpperCase())}
                  placeholder="e.g., AB3X7K9M"
                  maxLength={8}
                  className="settings-input"
                  style={{
                    flex: 1,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.1rem',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    maxWidth: '200px',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nodeShareKey.length === 8) {
                      addNodeByShareKey();
                    }
                  }}
                />
                <CyberButton
                  variant="primary"
                  icon={Plus}
                  onClick={addNodeByShareKey}
                  disabled={nodeShareKey.length !== 8 || addingNode}
                >
                  {addingNode ? 'ADDING...' : 'ADD NODE'}
                </CyberButton>
              </div>
            </div>
          </div>

          {nodes.length === 0 ? (
            <div className="cyber-card">
              <div className="cyber-card-body" style={{ textAlign: 'center', padding: 'var(--gap-xl)' }}>
                <Server size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 'var(--gap-md)' }} />
                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--gap-md)' }}>
                  No nodes connected to this workspace yet.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Download the OtherThing Node app and use the share key to connect.
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 'var(--gap-md)',
            }}>
              {nodes.map(node => (
                <div key={node.id} className="cyber-card">
                  <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--gap-md)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
                        <Server size={18} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                          {node.hostname}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
                        {node.remoteControlEnabled && (
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 0, 255, 0.1)',
                            border: '1px solid rgba(255, 0, 255, 0.3)',
                            color: 'var(--accent)',
                          }}>
                            Remote
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: node.status === 'online' ? 'rgba(100, 255, 100, 0.2)' :
                                     node.status === 'busy' ? 'rgba(255, 200, 100, 0.2)' :
                                     'rgba(255, 100, 100, 0.2)',
                          color: node.status === 'online' ? 'var(--success)' :
                                 node.status === 'busy' ? 'var(--warning)' :
                                 'var(--error)',
                          textTransform: 'uppercase',
                        }}>
                          {node.status}
                        </span>
                      </div>
                    </div>
                    {/* Hardware specs */}
                    <div style={{ display: 'flex', gap: 'var(--gap-lg)', marginBottom: 'var(--gap-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Cpu size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {node.capabilities.cpuCores} cores
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <HardDrive size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {Math.round(node.capabilities.memoryMb / 1024)}GB
                        </span>
                      </div>
                      {node.capabilities.gpuCount > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Zap size={14} style={{ color: 'var(--warning)' }} />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {node.capabilities.gpuCount} GPU
                          </span>
                        </div>
                      )}
                    </div>

                    {/* GPU Details */}
                    {node.capabilities.gpus && node.capabilities.gpus.length > 0 && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginBottom: 'var(--gap-sm)',
                        padding: 'var(--gap-xs) var(--gap-sm)',
                        background: 'var(--bg-void)',
                        borderRadius: 'var(--radius-sm)',
                      }}>
                        {node.capabilities.gpus.map((gpu, i) => (
                          <div key={i}>{gpu.model} ({Math.round(gpu.vramMb / 1024)}GB)</div>
                        ))}
                      </div>
                    )}

                    {/* Resource Limits - only show if remote control enabled */}
                    {node.remoteControlEnabled && node.resourceLimits && (
                      Object.keys(node.resourceLimits).some(k => (node.resourceLimits as any)[k] !== undefined)
                    ) && (
                      <div style={{
                        marginTop: 'var(--gap-sm)',
                        paddingTop: 'var(--gap-sm)',
                        borderTop: '1px solid var(--border-subtle)',
                      }}>
                        <div style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          marginBottom: 'var(--gap-xs)',
                        }}>
                          Resource Limits
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gap-sm)' }}>
                          {node.resourceLimits.cpuCores && (
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              background: 'rgba(0, 212, 255, 0.1)',
                              border: '1px solid rgba(0, 212, 255, 0.3)',
                              borderRadius: '4px',
                              color: 'var(--primary)',
                            }}>
                              CPU: {node.resourceLimits.cpuCores} cores
                            </span>
                          )}
                          {node.resourceLimits.ramPercent && (
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              background: 'rgba(0, 212, 255, 0.1)',
                              border: '1px solid rgba(0, 212, 255, 0.3)',
                              borderRadius: '4px',
                              color: 'var(--primary)',
                            }}>
                              RAM: {node.resourceLimits.ramPercent}%
                            </span>
                          )}
                          {node.resourceLimits.storageGb && (
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              background: 'rgba(0, 212, 255, 0.1)',
                              border: '1px solid rgba(0, 212, 255, 0.3)',
                              borderRadius: '4px',
                              color: 'var(--primary)',
                            }}>
                              Storage: {node.resourceLimits.storageGb}GB
                            </span>
                          )}
                          {node.resourceLimits.gpuVramPercent && node.resourceLimits.gpuVramPercent[0] && (
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              background: 'rgba(255, 170, 0, 0.1)',
                              border: '1px solid rgba(255, 170, 0, 0.3)',
                              borderRadius: '4px',
                              color: 'var(--warning)',
                            }}>
                              GPU: {node.resourceLimits.gpuVramPercent[0]}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Usage Summary Section */}
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            marginTop: 'var(--gap-xl)',
            marginBottom: 'var(--gap-md)',
            textTransform: 'uppercase',
          }}>
            Resource Usage (Last 30 Days)
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 'var(--gap-md)',
            marginBottom: 'var(--gap-md)',
          }}>
            <div className="cyber-card" style={{ margin: 0 }}>
              <div className="cyber-card-body" style={{ padding: 'var(--gap-md)', textAlign: 'center' }}>
                <DollarSign size={24} style={{ color: 'var(--success)', marginBottom: 'var(--gap-xs)' }} />
                <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  ${((usageSummary?.totalCostCents || 0) / 100).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Total Cost
                </div>
              </div>
            </div>
            <div className="cyber-card" style={{ margin: 0 }}>
              <div className="cyber-card-body" style={{ padding: 'var(--gap-md)', textAlign: 'center' }}>
                <Activity size={24} style={{ color: 'var(--primary)', marginBottom: 'var(--gap-xs)' }} />
                <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {((usageSummary?.totalTokens || 0) / 1000).toFixed(1)}K
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Tokens Used
                </div>
              </div>
            </div>
            <div className="cyber-card" style={{ margin: 0 }}>
              <div className="cyber-card-body" style={{ padding: 'var(--gap-md)', textAlign: 'center' }}>
                <Clock size={24} style={{ color: 'var(--warning)', marginBottom: 'var(--gap-xs)' }} />
                <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {Math.round((usageSummary?.totalComputeSeconds || 0) / 60)}m
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Compute Time
                </div>
              </div>
            </div>
          </div>

          {/* Usage by Provider */}
          {usageSummary && Object.keys(usageSummary.byProvider).length > 0 && (
            <div className="cyber-card" style={{ marginBottom: 'var(--gap-md)' }}>
              <div className="cyber-card-header">
                <span className="cyber-card-title">USAGE BY PROVIDER</span>
              </div>
              <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                {Object.entries(usageSummary.byProvider).map(([provider, data]) => (
                  <div
                    key={provider}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--gap-sm)',
                      background: 'var(--bg-void)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 'var(--gap-xs)',
                    }}
                  >
                    <span style={{
                      textTransform: 'capitalize',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                    }}>
                      {provider}
                    </span>
                    <div style={{ display: 'flex', gap: 'var(--gap-md)', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {(data.tokens / 1000).toFixed(1)}K tokens
                      </span>
                      <span style={{ color: 'var(--success)' }}>
                        ${(data.cost / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members Section */}
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            marginTop: 'var(--gap-xl)',
            marginBottom: 'var(--gap-md)',
            textTransform: 'uppercase',
          }}>
            Members
          </h3>
          <div className="cyber-card">
            <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
                {workspace.members.map(member => (
                  <div
                    key={member.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--gap-sm)',
                      padding: 'var(--gap-sm)',
                      background: 'var(--bg-void)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: member.role === 'owner' ? 'var(--primary)' : 'var(--bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: member.role === 'owner' ? 'white' : 'var(--text-muted)',
                      fontWeight: 500,
                    }}>
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        {member.username}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                        {member.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'api-keys' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--gap-md)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {apiKeys.length} API key{apiKeys.length !== 1 ? 's' : ''} configured
            </span>
            <CyberButton variant="primary" icon={Plus} onClick={() => { setApiKeyError(null); setShowApiKeyModal(true); }}>
              ADD API KEY
            </CyberButton>
          </div>

          {apiKeys.length === 0 ? (
            <div className="cyber-card">
              <div className="cyber-card-body" style={{ textAlign: 'center', padding: 'var(--gap-xl)' }}>
                <Key size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 'var(--gap-md)' }} />
                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--gap-md)' }}>
                  No API keys configured for this workspace yet.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Add API keys to enable AI model access for workspace flows.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
              {apiKeys.map(key => (
                <div
                  key={key.id}
                  className="cyber-card"
                  style={{ margin: 0 }}
                >
                  <div className="cyber-card-body" style={{ padding: 'var(--gap-md)' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-void)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Key size={18} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--gap-sm)',
                            marginBottom: '4px',
                          }}>
                            <span style={{
                              fontFamily: 'var(--font-display)',
                              color: 'var(--text-primary)',
                              fontSize: '0.9rem',
                            }}>
                              {key.name}
                            </span>
                            <span style={{
                              fontSize: '0.65rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: key.provider === 'openai' ? 'rgba(16, 163, 127, 0.2)' :
                                         key.provider === 'anthropic' ? 'rgba(217, 119, 87, 0.2)' :
                                         key.provider === 'google' ? 'rgba(66, 133, 244, 0.2)' :
                                         key.provider === 'groq' ? 'rgba(255, 136, 0, 0.2)' :
                                         'rgba(128, 128, 128, 0.2)',
                              color: key.provider === 'openai' ? '#10a37f' :
                                     key.provider === 'anthropic' ? '#d97757' :
                                     key.provider === 'google' ? '#4285f4' :
                                     key.provider === 'groq' ? '#ff8800' :
                                     'var(--text-muted)',
                              textTransform: 'uppercase',
                            }}>
                              {key.provider}
                            </span>
                          </div>
                          <div style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                          }}>
                            {key.maskedKey}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeApiKey(key.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '8px',
                          borderRadius: 'var(--radius-sm)',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--error)';
                          e.currentTarget.style.background = 'rgba(255, 100, 100, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)';
                          e.currentTarget.style.background = 'none';
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Supported Providers Info */}
          <div style={{ marginTop: 'var(--gap-xl)' }}>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.9rem',
              color: 'var(--text-primary)',
              marginBottom: 'var(--gap-md)',
              textTransform: 'uppercase',
            }}>
              Supported Providers
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 'var(--gap-sm)',
            }}>
              {[
                { id: 'openai', name: 'OpenAI', color: '#10a37f' },
                { id: 'anthropic', name: 'Anthropic', color: '#d97757' },
                { id: 'google', name: 'Google AI', color: '#4285f4' },
                { id: 'groq', name: 'Groq', color: '#ff8800' },
                { id: 'custom', name: 'Custom', color: 'var(--text-muted)' },
              ].map(provider => (
                <div
                  key={provider.id}
                  style={{
                    padding: 'var(--gap-sm) var(--gap-md)',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--gap-sm)',
                  }}
                >
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: provider.color,
                  }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {provider.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Task Modal */}
      {showTaskModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowTaskModal(false)}>
          <div
            className="cyber-card"
            style={{ width: '100%', maxWidth: 500 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cyber-card-header">
              <span className="cyber-card-title">{editingTask ? 'EDIT TASK' : 'NEW TASK'}</span>
            </div>
            <div className="cyber-card-body">
              {taskError && (
                <div style={{
                  marginBottom: 'var(--gap-md)',
                  padding: 'var(--gap-sm) var(--gap-md)',
                  background: 'rgba(255, 100, 100, 0.1)',
                  border: '1px solid var(--error)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--error)',
                  fontSize: '0.85rem',
                }}>
                  {taskError}
                </div>
              )}
              <div style={{ marginBottom: 'var(--gap-md)' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}>
                  Title
                </label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Task title..."
                  className="settings-input"
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 'var(--gap-md)' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}>
                  Description
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Task description..."
                  className="settings-input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ marginBottom: 'var(--gap-lg)' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}>
                  Priority
                </label>
                <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setTaskForm(prev => ({ ...prev, priority: p }))}
                      style={{
                        flex: 1,
                        padding: 'var(--gap-sm)',
                        background: taskForm.priority === p ? 'var(--bg-elevated)' : 'transparent',
                        border: `1px solid ${taskForm.priority === p ? 'var(--primary)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        color: taskForm.priority === p ? 'var(--primary)' : 'var(--text-muted)',
                        textTransform: 'capitalize',
                        fontSize: '0.85rem',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--gap-sm)', justifyContent: 'flex-end' }}>
                <CyberButton onClick={() => {
                  setShowTaskModal(false);
                  setEditingTask(null);
                  setTaskForm({ title: '', description: '', priority: 'medium' });
                }}>
                  CANCEL
                </CyberButton>
                <CyberButton variant="primary" icon={Plus} onClick={createTask} disabled={!taskForm.title.trim()}>
                  {editingTask ? 'UPDATE' : 'CREATE'}
                </CyberButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add API Key Modal */}
      {showApiKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowApiKeyModal(false)}>
          <div
            className="cyber-card"
            style={{ width: '100%', maxWidth: 500 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cyber-card-header">
              <span className="cyber-card-title">ADD API KEY</span>
            </div>
            <div className="cyber-card-body">
              {apiKeyError && (
                <div style={{
                  marginBottom: 'var(--gap-md)',
                  padding: 'var(--gap-sm) var(--gap-md)',
                  background: 'rgba(255, 100, 100, 0.1)',
                  border: '1px solid var(--error)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--error)',
                  fontSize: '0.85rem',
                }}>
                  {apiKeyError}
                </div>
              )}
              <div style={{ marginBottom: 'var(--gap-md)' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}>
                  Provider
                </label>
                <select
                  value={apiKeyForm.provider}
                  onChange={(e) => setApiKeyForm(prev => ({ ...prev, provider: e.target.value as ApiKey['provider'] }))}
                  className="settings-input"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google AI</option>
                  <option value="groq">Groq</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div style={{ marginBottom: 'var(--gap-md)' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}>
                  Name
                </label>
                <input
                  type="text"
                  value={apiKeyForm.name}
                  onChange={(e) => setApiKeyForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Production GPT-4 Key"
                  className="settings-input"
                />
              </div>
              <div style={{ marginBottom: 'var(--gap-lg)' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}>
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKeyForm.key}
                  onChange={(e) => setApiKeyForm(prev => ({ ...prev, key: e.target.value }))}
                  placeholder="sk-..."
                  className="settings-input"
                />
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '4px',
                }}>
                  Keys are stored securely and shared only with workspace members.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--gap-sm)', justifyContent: 'flex-end' }}>
                <CyberButton onClick={() => {
                  setShowApiKeyModal(false);
                  setApiKeyForm({ provider: 'openai', name: '', key: '' });
                }}>
                  CANCEL
                </CyberButton>
                <CyberButton
                  variant="primary"
                  icon={Plus}
                  onClick={addApiKey}
                  disabled={!apiKeyForm.name.trim() || !apiKeyForm.key.trim()}
                >
                  ADD KEY
                </CyberButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Flow Modal */}
      {showFlowModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowFlowModal(false)}>
          <div
            className="cyber-card"
            style={{ width: '100%', maxWidth: 500 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cyber-card-header">
              <span className="cyber-card-title">CREATE FLOW</span>
            </div>
            <div className="cyber-card-body">
              {flowError && (
                <div style={{
                  marginBottom: 'var(--gap-md)',
                  padding: 'var(--gap-sm) var(--gap-md)',
                  background: 'rgba(255, 100, 100, 0.1)',
                  border: '1px solid var(--error)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--error)',
                  fontSize: '0.85rem',
                }}>
                  {flowError}
                </div>
              )}
              <div style={{ marginBottom: 'var(--gap-md)' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}>
                  Name
                </label>
                <input
                  type="text"
                  value={flowForm.name}
                  onChange={(e) => setFlowForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Data Processing Pipeline"
                  className="settings-input"
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 'var(--gap-lg)' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}>
                  Description (optional)
                </label>
                <textarea
                  value={flowForm.description}
                  onChange={(e) => setFlowForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does this flow do?"
                  className="settings-input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <p style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: 'var(--gap-md)',
                background: 'var(--bg-void)',
                padding: 'var(--gap-sm) var(--gap-md)',
                borderRadius: 'var(--radius-sm)',
              }}>
                Flows in this workspace can use the shared API keys and compute resources from connected nodes.
              </p>
              <div style={{ display: 'flex', gap: 'var(--gap-sm)', justifyContent: 'flex-end' }}>
                <CyberButton onClick={() => {
                  setShowFlowModal(false);
                  setFlowForm({ name: '', description: '' });
                }}>
                  CANCEL
                </CyberButton>
                <CyberButton
                  variant="primary"
                  icon={Plus}
                  onClick={createFlow}
                  disabled={!flowForm.name.trim()}
                >
                  CREATE FLOW
                </CyberButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Repo Modal */}
      {showRepoModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--gap-xl)',
            width: '100%',
            maxWidth: '500px',
          }}>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              marginBottom: 'var(--gap-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
            }}>
              <FolderGit2 size={20} style={{ color: 'var(--accent-primary)' }} />
              Add Repository
            </h3>
            <div>
              <div style={{ marginBottom: 'var(--gap-lg)' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}>
                  Repository URL
                </label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    setRepoError(null);
                  }}
                  placeholder="https://github.com/user/repo or git@github.com:user/repo.git"
                  className="settings-input"
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 'var(--gap-lg)' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}>
                  Personal Access Token <span style={{ opacity: 0.6 }}>(optional, for private repos)</span>
                </label>
                <input
                  type="password"
                  value={repoToken}
                  onChange={(e) => setRepoToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="settings-input"
                />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Generate at GitHub → Settings → Developer settings → Personal access tokens
                </p>
              </div>
              {repoError && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-sm)',
                  padding: 'var(--gap-sm) var(--gap-md)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 'var(--gap-lg)',
                  color: '#ef4444',
                  fontSize: '0.85rem',
                }}>
                  <AlertTriangle size={16} />
                  {repoError}
                </div>
              )}
              <div style={{
                background: 'var(--bg-void)',
                padding: 'var(--gap-md)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--gap-lg)',
              }}>
                <p style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginBottom: 'var(--gap-sm)',
                }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Analysis Options:</strong>
                </p>
                <ul style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  margin: 0,
                  paddingLeft: 'var(--gap-lg)',
                }}>
                  <li style={{ marginBottom: '4px' }}>Static analysis runs instantly (no AI required)</li>
                  <li style={{ marginBottom: '4px' }}>AI enhancement available via local Ollama</li>
                  <li>Workspace nodes with GPU can provide AI inference</li>
                </ul>
              </div>
              <div style={{ display: 'flex', gap: 'var(--gap-sm)', justifyContent: 'flex-end' }}>
                <CyberButton onClick={() => {
                  setShowRepoModal(false);
                  setRepoUrl('');
                  setRepoToken('');
                  setRepoError(null);
                }}>
                  CANCEL
                </CyberButton>
                <CyberButton
                  variant="primary"
                  icon={Plus}
                  onClick={addRepo}
                  disabled={!repoUrl.trim()}
                >
                  ADD REPO
                </CyberButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
