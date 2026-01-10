import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Cpu, Clock, Play, Plus, Box, Bot, TrendingUp, Coins, Brain, Rocket, Star, ChevronRight, Server, Activity, Wifi, WifiOff, RefreshCw, Globe, Users, Lock } from 'lucide-react';
import { CyberButton, StatsCard } from '../components';
import { useModule } from '../context/ModuleContext';

interface Workspace {
  id: string;
  name: string;
  members: Array<{ id: string; address: string; displayName: string }>;
}

interface ConnectedNode {
  id: string;
  name: string;
  owner_address: string; // Address of the node owner
  status: 'online' | 'busy' | 'offline';
  location: string;
  gpu: {
    model: string;
    vram: number;
    utilization: number;
  } | null;
  cpu: {
    model: string;
    cores: number;
    utilization: number;
  };
  ram: {
    total: number;
    used: number;
  };
  price_per_hour: number;
  uptime: string;
  jobs_completed: number;
  rating: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: typeof Bot;
  modules: string[];
  minVram?: number;
  popular?: boolean;
  new?: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: 'llm-inference',
    name: 'LLM Inference',
    description: 'Deploy LLaMA, Mistral, or custom models with vLLM',
    category: 'AI',
    icon: Brain,
    modules: ['vllm', 'text-generation'],
    minVram: 16,
    popular: true,
  },
  {
    id: 'stable-diffusion',
    name: 'Stable Diffusion',
    description: 'SDXL image generation with ComfyUI workflow',
    category: 'AI',
    icon: Zap,
    modules: ['sdxl', 'comfyui'],
    minVram: 8,
    popular: true,
  },
  {
    id: 'trading-bot',
    name: 'Trading Bot',
    description: 'Hummingbot with Hyperliquid integration',
    category: 'Trading',
    icon: TrendingUp,
    modules: ['hummingbot', 'hyperliquid'],
  },
  {
    id: 'ai-agent',
    name: 'AI Agent (Eliza)',
    description: 'Autonomous agent for Twitter, Discord, Telegram',
    category: 'Agents',
    icon: Bot,
    modules: ['eliza', 'memory'],
    new: true,
  },
  {
    id: 'hedge-fund',
    name: 'AI Hedge Fund',
    description: '15 investment agents analyzing markets',
    category: 'Trading',
    icon: Coins,
    modules: ['hedgy', 'market-data'],
    new: true,
  },
  {
    id: 'jupyter-gpu',
    name: 'Jupyter + GPU',
    description: 'Interactive notebooks with CUDA support',
    category: 'Dev',
    icon: Server,
    modules: ['jupyter', 'pytorch'],
    minVram: 8,
  },
];

// Fetch connected nodes from the orchestrator
const fetchConnectedNodes = async (): Promise<ConnectedNode[]> => {
  // Get orchestrator URL from settings or use default
  const settings = localStorage.getItem('rhizos_settings');
  const orchestratorUrl = settings
    ? JSON.parse(settings).orchestrator_url
    : 'http://localhost:8080';

  try {
    const response = await fetch(`${orchestratorUrl}/api/nodes`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();

    // Transform API response to our format
    return data.nodes?.map((node: any) => ({
      id: node.id,
      name: node.name || node.id,
      owner_address: node.owner_address || node.owner || 'unknown',
      status: node.status || 'online',
      location: node.location || 'Unknown',
      gpu: node.gpu ? {
        model: node.gpu.model || 'Unknown GPU',
        vram: node.gpu.vram_gb || 0,
        utilization: node.gpu.utilization || 0,
      } : null,
      cpu: {
        model: node.cpu?.model || 'Unknown CPU',
        cores: node.cpu?.cores || 0,
        utilization: node.cpu?.utilization || 0,
      },
      ram: {
        total: node.ram?.total_gb || 0,
        used: node.ram?.used_gb || 0,
      },
      price_per_hour: node.price_per_hour || 0,
      uptime: node.uptime || 'Unknown',
      jobs_completed: node.jobs_completed || 0,
      rating: node.rating || 5.0,
    })) || [];
  } catch (error) {
    console.log('[Deploy] No nodes available or orchestrator not running:', error);
    return [];
  }
};

// Get workspaces from localStorage
const getWorkspaces = (): Workspace[] => {
  try {
    const saved = localStorage.getItem('rhizos_workspaces');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

// Get user's own profile
const getProfile = () => {
  try {
    const saved = localStorage.getItem('rhizos_profile');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export function Deploy() {
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ConnectedNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'gpu' | 'cpu'>('all');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ address: string } | null>(null);

  useEffect(() => {
    // Load workspaces and profile
    setWorkspaces(getWorkspaces());
    setProfile(getProfile());
    loadNodes();
  }, []);

  const loadNodes = async () => {
    setLoading(true);
    const data = await fetchConnectedNodes();
    setNodes(data);
    setLoading(false);
  };

  // Get all member addresses from selected workspace (or all workspaces)
  const getMemberAddresses = (): Set<string> => {
    const addresses = new Set<string>();

    // Always include own address
    if (profile?.address) {
      addresses.add(profile.address);
    }

    const workspacesToCheck = selectedWorkspace
      ? workspaces.filter(ws => ws.id === selectedWorkspace)
      : workspaces;

    workspacesToCheck.forEach(ws => {
      ws.members.forEach(member => {
        addresses.add(member.address);
      });
    });

    return addresses;
  };

  const memberAddresses = getMemberAddresses();
  const hasWorkspaces = workspaces.length > 0;

  // Filter nodes: only show nodes from workspace members
  const filteredNodes = nodes.filter(node => {
    // First check workspace membership
    if (!memberAddresses.has(node.owner_address)) {
      return false;
    }
    // Then apply hardware filter
    if (filter === 'gpu') return node.gpu !== null;
    if (filter === 'cpu') return node.gpu === null;
    return true;
  });

  const availableNodes = filteredNodes.filter(n => n.status === 'online');
  const totalGpus = nodes.filter(n => n.gpu !== null).length;

  const handleQuickDeploy = async (template: Template, nodeId?: string) => {
    const targetNode = nodeId || availableNodes.find(n =>
      template.minVram ? (n.gpu?.vram ?? 0) >= template.minVram : true
    )?.id;

    if (!targetNode) {
      alert('No suitable node available for this template');
      return;
    }

    setDeploying(template.id);
    await new Promise(r => setTimeout(r, 1500));
    setDeploying(null);
    navigate('/pods');
  };

  const handleSelectNode = (nodeId: string) => {
    setSelectedNode(nodeId);
    navigate('/flow', { state: { selectedNode: nodeId } });
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--gap-xl)'
      }}>
        <div>
          <h2 className="page-title">Deploy</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 'var(--gap-sm)' }}>
            Launch GPU pods in seconds or build custom workflows
          </p>
        </div>
        <CyberButton variant="primary" icon={Plus} onClick={() => navigate('/flow')}>
          NEW WORKFLOW
        </CyberButton>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid" style={{ marginBottom: 'var(--gap-xl)' }}>
        <StatsCard label="Connected Nodes" value={nodes.length} icon={Server} color="primary" />
        <StatsCard label="Available GPUs" value={totalGpus} icon={Cpu} color="success" />
        <StatsCard label="Online Now" value={availableNodes.length} icon={Wifi} color="secondary" />
        <StatsCard label="Templates" value={TEMPLATES.length} icon={Box} color="primary" />
      </div>

      {/* No Workspaces Warning */}
      {!hasWorkspaces && (
        <div className="cyber-card" style={{ marginBottom: 'var(--gap-xl)', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
          <div className="cyber-card-body" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-lg)',
            padding: 'var(--gap-lg)',
          }}>
            <Lock size={32} style={{ color: 'var(--warning)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', color: 'var(--warning)', marginBottom: '4px' }}>
                Join a Workspace to See Nodes
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Nodes are only visible to workspace members. Create or join a workspace to connect with friends and share compute.
              </p>
            </div>
            <CyberButton variant="primary" icon={Users} onClick={() => navigate('/workspace')}>
              GO TO WORKSPACE
            </CyberButton>
          </div>
        </div>
      )}

      {/* Connected Nodes - Real Hardware */}
      <div className="cyber-card" style={{ marginBottom: 'var(--gap-xl)' }}>
        <div className="cyber-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="cyber-card-title">AVAILABLE NODES</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'var(--gap-sm)' }}>
              {hasWorkspaces ? 'Nodes from your workspace members' : 'Join a workspace to see nodes'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--gap-sm)', alignItems: 'center' }}>
            {/* Workspace filter */}
            {workspaces.length > 1 && (
              <select
                value={selectedWorkspace || ''}
                onChange={(e) => setSelectedWorkspace(e.target.value || null)}
                style={{
                  padding: '4px 8px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                }}
              >
                <option value="">All Workspaces</option>
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            )}
            {/* Hardware filter buttons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['all', 'gpu', 'cpu'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '4px 12px',
                    background: filter === f ? 'var(--primary)' : 'var(--bg-elevated)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    color: filter === f ? 'white' : 'var(--text-muted)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  {f === 'all' ? 'All' : f === 'gpu' ? 'GPU' : 'CPU Only'}
                </button>
              ))}
            </div>
            <button
              onClick={loadNodes}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
              title="Refresh nodes"
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>
        <div className="cyber-card-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--gap-xl)', color: 'var(--text-muted)' }}>
              Loading connected nodes...
            </div>
          ) : filteredNodes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--gap-xl)', color: 'var(--text-muted)' }}>
              {!hasWorkspaces ? (
                <>
                  <Users size={48} style={{ marginBottom: 'var(--gap-md)', opacity: 0.3 }} />
                  <p style={{ fontSize: '1rem', marginBottom: 'var(--gap-sm)' }}>No workspace joined</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: 'var(--gap-lg)', maxWidth: '400px', margin: '0 auto var(--gap-lg)' }}>
                    You need to be in a workspace to see shared nodes. Create one and invite friends, or join an existing workspace.
                  </p>
                  <CyberButton
                    variant="primary"
                    icon={Users}
                    onClick={() => navigate('/workspace')}
                  >
                    GO TO WORKSPACE
                  </CyberButton>
                </>
              ) : (
                <>
                  <WifiOff size={48} style={{ marginBottom: 'var(--gap-md)', opacity: 0.3 }} />
                  <p style={{ fontSize: '1rem', marginBottom: 'var(--gap-sm)' }}>No nodes from workspace members</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: 'var(--gap-lg)', maxWidth: '400px', margin: '0 auto var(--gap-lg)' }}>
                    {filter === 'all'
                      ? 'Install the node agent on your machine or ask workspace members to share their compute.'
                      : filter === 'gpu'
                        ? 'No GPU nodes from workspace members. Make sure nodes have NVIDIA GPUs with CUDA.'
                        : 'No CPU-only nodes from workspace members.'}
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--gap-sm)', justifyContent: 'center' }}>
                    <CyberButton
                      variant="primary"
                      icon={Server}
                      onClick={() => navigate('/download')}
                    >
                      INSTALL NODE AGENT
                    </CyberButton>
                    <CyberButton
                      icon={Users}
                      onClick={() => navigate('/workspace')}
                    >
                      INVITE MEMBERS
                    </CyberButton>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--gap-md)',
            }}>
              {filteredNodes.map(node => {
                const isAvailable = node.status === 'online';
                const statusColor = node.status === 'online' ? 'var(--success)' : node.status === 'busy' ? 'var(--warning)' : 'var(--text-muted)';

                return (
                  <div
                    key={node.id}
                    onClick={() => isAvailable && handleSelectNode(node.id)}
                    style={{
                      padding: 'var(--gap-md)',
                      background: selectedNode === node.id
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.05))'
                        : 'var(--bg-elevated)',
                      border: `2px solid ${selectedNode === node.id ? 'var(--primary)' : 'rgba(99, 102, 241, 0.15)'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                      opacity: isAvailable ? 1 : 0.6,
                      transition: 'all 0.2s ease',
                    }}
                    className={isAvailable ? 'hover-lift' : ''}
                  >
                    {/* Node Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--gap-sm)' }}>
                      <div>
                        <div style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.95rem',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: statusColor,
                            boxShadow: `0 0 8px ${statusColor}`,
                          }} />
                          {node.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Globe size={10} /> {node.location} • {node.uptime}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.1rem',
                          color: 'var(--success)',
                        }}>
                          ${node.price_per_hour.toFixed(2)}<span style={{ fontSize: '0.6rem', opacity: 0.7 }}>/hr</span>
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          ★ {node.rating} ({node.jobs_completed} jobs)
                        </div>
                      </div>
                    </div>

                    {/* Hardware Info */}
                    <div style={{
                      background: 'var(--bg-void)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 'var(--gap-sm)',
                      marginTop: 'var(--gap-sm)',
                    }}>
                      {node.gpu ? (
                        <div style={{ marginBottom: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: 500 }}>
                              {node.gpu.model}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {node.gpu.vram}GB VRAM
                            </span>
                          </div>
                          <div style={{
                            height: 4,
                            background: 'rgba(99, 102, 241, 0.2)',
                            borderRadius: 2,
                            marginTop: 4,
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${node.gpu.utilization}%`,
                              height: '100%',
                              background: node.gpu.utilization > 80 ? 'var(--warning)' : 'var(--primary)',
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          CPU Only (No GPU)
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 'var(--gap-md)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span>{node.cpu.cores} vCPU</span>
                        <span>{node.ram.total}GB RAM</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {!isAvailable && (
                      <div style={{
                        marginTop: 'var(--gap-sm)',
                        padding: '4px 8px',
                        background: 'rgba(251, 191, 36, 0.1)',
                        border: '1px solid rgba(251, 191, 36, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.65rem',
                        color: 'var(--warning)',
                        textAlign: 'center',
                      }}>
                        Currently running a job
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Templates - Quick Deploy */}
      <div style={{ marginBottom: 'var(--gap-lg)' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--gap-md)'
        }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1rem',
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            QUICK DEPLOY TEMPLATES
          </h3>
          <button style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            View All <ChevronRight size={14} />
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 'var(--gap-md)',
        }}>
          {TEMPLATES.map(template => {
            const Icon = template.icon;
            // Find compatible nodes
            const compatibleNodes = availableNodes.filter(n =>
              template.minVram ? (n.gpu?.vram ?? 0) >= template.minVram : true
            );
            const cheapestNode = compatibleNodes.sort((a, b) => a.price_per_hour - b.price_per_hour)[0];
            const hasCompatibleNode = compatibleNodes.length > 0;

            return (
              <div
                key={template.id}
                className="cyber-card hover-lift"
                style={{ cursor: 'pointer', opacity: hasCompatibleNode ? 1 : 0.6 }}
              >
                <div className="cyber-card-body" style={{ padding: 'var(--gap-lg)' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 'var(--gap-md)',
                  }}>
                    <div style={{ display: 'flex', gap: 'var(--gap-md)', alignItems: 'center' }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Icon size={20} style={{ color: 'var(--primary)' }} />
                      </div>
                      <div>
                        <div style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.95rem',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--gap-xs)',
                        }}>
                          {template.name}
                          {template.popular && (
                            <Star size={12} style={{ color: '#fbbf24', fill: '#fbbf24' }} />
                          )}
                          {template.new && (
                            <span style={{
                              padding: '2px 6px',
                              background: 'var(--success)',
                              color: 'var(--bg-void)',
                              fontSize: '0.55rem',
                              borderRadius: '2px',
                              fontWeight: 'bold',
                            }}>
                              NEW
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {template.category} {template.minVram ? `• ${template.minVram}GB+ VRAM` : '• CPU OK'}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {cheapestNode ? (
                        <>
                          <div style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1rem',
                            color: 'var(--success)',
                          }}>
                            ${cheapestNode.price_per_hour.toFixed(2)}<span style={{ fontSize: '0.6rem', opacity: 0.7 }}>/hr</span>
                          </div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                            {compatibleNodes.length} node{compatibleNodes.length !== 1 ? 's' : ''} available
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>
                          No nodes available
                        </div>
                      )}
                    </div>
                  </div>

                  <p style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--gap-md)',
                    lineHeight: 1.4,
                  }}>
                    {template.description}
                  </p>

                  <div style={{
                    display: 'flex',
                    gap: 'var(--gap-xs)',
                    marginBottom: 'var(--gap-md)',
                  }}>
                    {template.modules.map(mod => (
                      <span
                        key={mod}
                        style={{
                          padding: '0.2rem 0.5rem',
                          background: 'var(--bg-void)',
                          border: '1px solid rgba(99, 102, 241, 0.15)',
                          borderRadius: '2px',
                          fontSize: '0.65rem',
                          color: 'var(--primary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {mod}
                      </span>
                    ))}
                  </div>

                  <CyberButton
                    variant="primary"
                    icon={deploying === template.id ? undefined : Play}
                    loading={deploying === template.id}
                    onClick={() => handleQuickDeploy(template)}
                    style={{ width: '100%' }}
                    disabled={!hasCompatibleNode}
                  >
                    {deploying === template.id ? 'DEPLOYING...' : hasCompatibleNode ? 'DEPLOY NOW' : 'NO NODES AVAILABLE'}
                  </CyberButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Build Custom */}
      <div
        className="cyber-card hover-lift"
        onClick={() => navigate('/flow')}
        style={{
          cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(255, 0, 255, 0.05), rgba(0, 255, 255, 0.05))',
        }}
      >
        <div className="cyber-card-body" style={{
          padding: 'var(--gap-xl)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-lg)' }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 0, 255, 0.1)',
              border: '2px solid rgba(255, 0, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Plus size={28} style={{ color: 'var(--primary-light)' }} />
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                color: 'var(--text-primary)',
                marginBottom: '4px',
              }}>
                BUILD CUSTOM WORKFLOW
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Drag and drop modules to create your own compute pipeline
              </div>
            </div>
          </div>
          <ChevronRight size={24} style={{ color: 'var(--primary-light)' }} />
        </div>
      </div>
    </div>
  );
}
