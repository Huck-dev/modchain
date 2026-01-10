import { useState, useEffect, useRef, useCallback } from 'react';
import { Power, Cpu, HardDrive, Zap, RefreshCw, Terminal, Users } from 'lucide-react';
import { CyberButton, ActivityLog } from '../components';
import { authFetch } from '../App';

interface HardwareInfo {
  cpu: {
    model: string;
    cores: number;
    threads: number;
  };
  memory: {
    total_mb: number;
    available_mb: number;
  };
  gpus: Array<{
    model: string;
    vram_mb: number;
    driver_version: string;
  }>;
  storage: {
    total_gb: number;
    available_gb: number;
  };
  docker_version: string | null;
}

interface NodeState {
  running: boolean;
  connected: boolean;
  nodeId: string | null;
  orchestratorUrl: string;
}

interface Workspace {
  id: string;
  name: string;
  nodeCount: number;
}

export function NodeControl() {
  const [nodeState, setNodeState] = useState<NodeState>({
    running: false,
    connected: false,
    nodeId: null,
    orchestratorUrl: window.location.hostname === 'localhost'
      ? 'ws://localhost:8080/ws/node'
      : `ws://${window.location.host}/ws/node`,
  });
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'success' | 'error' }>>([]);

  // Workspace state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [{ time, message, type }, ...prev].slice(0, 100));
  }, []);

  // Load workspaces
  const loadWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const res = await authFetch('/api/v1/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();

    // Set mock hardware for web mode
    setHardware({
      cpu: { model: navigator.userAgent.includes('Win') ? 'Windows PC' : 'Linux/Mac', cores: navigator.hardwareConcurrency || 4, threads: (navigator.hardwareConcurrency || 4) * 2 },
      memory: { total_mb: 16384, available_mb: 12000 },
      gpus: [
        { model: 'WebGL Renderer', vram_mb: 4096, driver_version: 'Browser' },
      ],
      storage: { total_gb: 500, available_gb: 250 },
      docker_version: 'N/A (Web Mode)',
    });
    addLog('Running in web browser mode', 'info');
    addLog('Select workspaces and click START to contribute compute', 'info');

    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [addLog, loadWorkspaces]);

  const startNode = async () => {
    if (selectedWorkspaces.length === 0) {
      addLog('Please select at least one workspace to join', 'error');
      return;
    }

    setLoading(true);
    addLog('Connecting to orchestrator...', 'info');

    try {
      // Connect via WebSocket
      const ws = new WebSocket(nodeState.orchestratorUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog('WebSocket connected', 'success');

        // Register with the orchestrator
        const registerMsg = {
          type: 'register',
          capabilities: {
            node_id: `web-${crypto.randomUUID().slice(0, 8)}`,
            gpus: hardware?.gpus.map(g => ({
              model: g.model,
              vram_mb: g.vram_mb,
              supports: { cuda: false, rocm: false, vulkan: true, metal: false, opencl: true },
            })) || [],
            cpu: {
              model: hardware?.cpu.model || 'Unknown',
              cores: hardware?.cpu.cores || 4,
              threads: hardware?.cpu.threads || 8,
              features: ['sse4', 'avx'],
            },
            memory: {
              total_mb: hardware?.memory.total_mb || 8192,
              available_mb: hardware?.memory.available_mb || 4096,
            },
            storage: {
              total_gb: hardware?.storage.total_gb || 100,
              available_gb: hardware?.storage.available_gb || 50,
            },
            mcp_adapters: ['docker'],
          },
          workspace_ids: selectedWorkspaces,
        };

        ws.send(JSON.stringify(registerMsg));
        addLog(`Registering with ${selectedWorkspaces.length} workspace(s)...`, 'info');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'registered') {
            setNodeState(prev => ({
              ...prev,
              running: true,
              connected: true,
              nodeId: msg.node_id
            }));
            addLog(`Registered as node ${msg.node_id}`, 'success');
            addLog(`Contributing to ${selectedWorkspaces.length} workspace(s)`, 'success');
            setLoading(false);

            // Start heartbeat
            heartbeatRef.current = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'heartbeat',
                  available: true,
                  current_jobs: 0,
                }));
              }
            }, 30000);
          } else if (msg.type === 'job_assignment') {
            addLog(`Received job: ${msg.job.id}`, 'info');
            // In web mode, we can't actually run jobs - just acknowledge
            addLog('Web mode cannot execute jobs (display only)', 'error');
          } else if (msg.type === 'error') {
            addLog(`Error: ${msg.message}`, 'error');
          }
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      ws.onerror = (error) => {
        addLog('WebSocket error - check console', 'error');
        console.error('WebSocket error:', error);
        setLoading(false);
      };

      ws.onclose = () => {
        addLog('Disconnected from orchestrator', 'info');
        setNodeState(prev => ({ ...prev, running: false, connected: false, nodeId: null }));
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
      };

    } catch (err) {
      addLog(`Connection failed: ${err}`, 'error');
      setLoading(false);
    }
  };

  const stopNode = async () => {
    setLoading(true);
    addLog('Stopping node...', 'info');

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    setNodeState(prev => ({ ...prev, running: false, connected: false, nodeId: null }));
    addLog('Node stopped', 'info');
    setLoading(false);
  };

  const toggleWorkspace = (wsId: string) => {
    setSelectedWorkspaces(prev =>
      prev.includes(wsId)
        ? prev.filter(id => id !== wsId)
        : [...prev, wsId]
    );
  };

  const formatMemory = (mb: number) => `${(mb / 1024).toFixed(1)} GB`;

  return (
    <div className="fade-in">
      {/* Status Banner */}
      <div
        className="cyber-card"
        style={{
          marginBottom: 'var(--gap-xl)',
          background: nodeState.running
            ? 'linear-gradient(135deg, rgba(0, 255, 65, 0.1), rgba(0, 255, 255, 0.05))'
            : 'linear-gradient(135deg, var(--bg-surface), var(--bg-dark))'
        }}
      >
        <div className="cyber-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-lg)' }}>
            <div
              className={nodeState.running ? 'pulse-scale' : ''}
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                border: `2px solid ${nodeState.running ? 'var(--success)' : 'var(--text-muted)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: nodeState.running ? 'var(--glow-green)' : 'none',
              }}
            >
              <Power size={28} style={{ color: nodeState.running ? 'var(--success)' : 'var(--text-muted)' }} />
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                color: nodeState.running ? 'var(--success)' : 'var(--text-primary)',
                letterSpacing: '0.1em',
              }}>
                {nodeState.running ? 'NODE ACTIVE' : 'NODE OFFLINE'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {nodeState.running
                  ? `Node ID: ${nodeState.nodeId} • ${selectedWorkspaces.length} workspace(s)`
                  : 'Select workspaces and start to contribute compute'
                }
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--gap-md)' }}>
            {nodeState.running ? (
              <CyberButton variant="danger" icon={Power} onClick={stopNode} loading={loading}>
                STOP NODE
              </CyberButton>
            ) : (
              <CyberButton variant="success" icon={Power} onClick={startNode} loading={loading} disabled={selectedWorkspaces.length === 0}>
                START NODE
              </CyberButton>
            )}
          </div>
        </div>
      </div>

      {/* Workspace Selection */}
      <div className="cyber-card" style={{ marginBottom: 'var(--gap-xl)' }}>
        <div className="cyber-card-header">
          <span className="cyber-card-title">
            <Users size={14} style={{ marginRight: '0.5rem' }} />
            CONTRIBUTE TO WORKSPACES
          </span>
          <CyberButton icon={RefreshCw} onClick={loadWorkspaces} disabled={loadingWorkspaces || nodeState.running}>
            REFRESH
          </CyberButton>
        </div>
        <div className="cyber-card-body">
          {workspaces.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--gap-lg)', color: 'var(--text-muted)' }}>
              {loadingWorkspaces ? 'Loading workspaces...' : 'No workspaces found. Create or join one first!'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gap-sm)' }}>
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => !nodeState.running && toggleWorkspace(ws.id)}
                  disabled={nodeState.running}
                  style={{
                    padding: '10px 16px',
                    background: selectedWorkspaces.includes(ws.id)
                      ? 'rgba(0, 212, 255, 0.2)'
                      : 'var(--bg-elevated)',
                    border: `1px solid ${selectedWorkspaces.includes(ws.id) ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: selectedWorkspaces.includes(ws.id) ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: nodeState.running ? 'not-allowed' : 'pointer',
                    opacity: nodeState.running ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: selectedWorkspaces.includes(ws.id) ? 'var(--primary)' : 'var(--text-muted)',
                  }} />
                  {ws.name}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    ({ws.nodeCount} nodes)
                  </span>
                </button>
              ))}
            </div>
          )}
          {!nodeState.running && selectedWorkspaces.length > 0 && (
            <div style={{ marginTop: 'var(--gap-md)', fontSize: '0.8rem', color: 'var(--success)' }}>
              ✓ Selected {selectedWorkspaces.length} workspace(s) - ready to start
            </div>
          )}
        </div>
      </div>

      <div className="cyber-grid-layout">
        {/* CPU Card */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Cpu size={14} style={{ marginRight: '0.5rem' }} />
              PROCESSOR
            </span>
          </div>
          <div className="cyber-card-body">
            <div style={{ marginBottom: 'var(--gap-md)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--primary)' }}>
                {hardware?.cpu.model || 'Detecting...'}
              </div>
            </div>
            <div className="hardware-grid">
              <div className="hardware-item">
                <div className="hardware-label">CORES</div>
                <div className="hardware-value">{hardware?.cpu.cores ?? '-'}</div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">THREADS</div>
                <div className="hardware-value">{hardware?.cpu.threads ?? '-'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Memory Card */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <HardDrive size={14} style={{ marginRight: '0.5rem' }} />
              MEMORY
            </span>
          </div>
          <div className="cyber-card-body">
            <div className="hardware-grid">
              <div className="hardware-item">
                <div className="hardware-label">TOTAL RAM</div>
                <div className="hardware-value">
                  {hardware ? formatMemory(hardware.memory.total_mb) : '-'}
                </div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">AVAILABLE</div>
                <div className="hardware-value" style={{ color: 'var(--success)' }}>
                  {hardware ? formatMemory(hardware.memory.available_mb) : '-'}
                </div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">STORAGE</div>
                <div className="hardware-value">
                  {hardware?.storage.total_gb ?? '-'} GB
                </div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">MODE</div>
                <div className="hardware-value" style={{ fontSize: '0.875rem' }}>
                  Web Browser
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* GPUs Card */}
        <div className="cyber-card" style={{ gridColumn: '1 / -1' }}>
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Zap size={14} style={{ marginRight: '0.5rem' }} />
              GPU ACCELERATORS
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--primary-light)' }}>
              {hardware?.gpus.length ?? 0} DETECTED
            </span>
          </div>
          <div className="cyber-card-body">
            {hardware?.gpus && hardware.gpus.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}>
                {hardware.gpus.map((gpu, i) => (
                  <div key={i} className="node-item" style={{ background: 'rgba(255, 0, 255, 0.05)' }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '8px',
                      border: '1px solid var(--primary-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary-light)',
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.875rem',
                    }}>
                      #{i}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', color: 'var(--primary-light)', marginBottom: '4px' }}>
                        {gpu.model}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--primary)' }}>{(gpu.vram_mb / 1024).toFixed(0)} GB</span> VRAM
                        <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                        {gpu.driver_version}
                      </div>
                    </div>
                    <div style={{
                      padding: '4px 12px',
                      background: 'rgba(0, 255, 65, 0.1)',
                      border: '1px solid rgba(0, 255, 65, 0.3)',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      color: 'var(--success)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      WebGL
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Zap size={32} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                <div>NO GPU DETECTED</div>
              </div>
            )}
          </div>
        </div>

        {/* Node Logs */}
        <div className="cyber-card" style={{ gridColumn: '1 / -1' }}>
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Terminal size={14} style={{ marginRight: '0.5rem' }} />
              NODE LOGS
            </span>
          </div>
          <div className="cyber-card-body">
            <ActivityLog entries={logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
