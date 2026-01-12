import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, MoreVertical, GripVertical, Users, Server,
  Terminal, LayoutGrid, Trash2, Edit2, CheckCircle, Clock, Circle,
  Copy, RefreshCw, Settings, Cpu, HardDrive, Zap, Key, GitBranch, Play,
  DollarSign, Activity
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

interface WorkspaceNode {
  id: string;
  hostname: string;
  status: 'online' | 'offline' | 'busy';
  capabilities: {
    cpuCores: number;
    memoryMb: number;
    gpuCount: number;
  };
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

type TabType = 'tasks' | 'console' | 'resources' | 'api-keys' | 'flows';

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
    loadUsage();
  }, [loadWorkspace, loadTasks, loadNodes, loadApiKeys, loadFlows, loadUsage]);

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
                        onClick={() => {
                          // TODO: Deploy/run flow
                          console.log('Run flow:', flow.id);
                        }}
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

          {nodes.length === 0 ? (
            <div className="cyber-card">
              <div className="cyber-card-body" style={{ textAlign: 'center', padding: 'var(--gap-xl)' }}>
                <Server size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 'var(--gap-md)' }} />
                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--gap-md)' }}>
                  No nodes connected to this workspace yet.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Run: <code style={{ color: 'var(--primary)' }}>./rhizos-node start -o http://SERVER -w {id}</code>
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
                    <div style={{ display: 'flex', gap: 'var(--gap-lg)' }}>
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
    </div>
  );
}
