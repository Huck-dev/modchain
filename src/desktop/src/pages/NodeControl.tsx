import { useState, useEffect, useRef, useCallback } from 'react';
import { Power, Cpu, HardDrive, Zap, RefreshCw, Terminal, Users, Download, Activity, CheckCircle, XCircle, AlertTriangle, Monitor, Apple, Box } from 'lucide-react';
import { CyberButton, ActivityLog } from '../components';
import { authFetch } from '../App';

interface HardwareInfo {
  cpu: {
    model: string;
    cores: number;
    threads: number;
    frequency_mhz?: number;
  };
  memory: {
    total_mb: number;
    available_mb: number;
  };
  gpus: Array<{
    vendor: string;
    model: string;
    vram_mb: number;
    driver_version: string;
  }>;
  storage: {
    total_gb: number;
    available_gb: number;
  };
  docker_version: string | null;
  node_version?: string;
}

interface HealthStatus {
  orchestrator: 'checking' | 'online' | 'offline';
  node: 'not_installed' | 'stopped' | 'running' | 'error';
  hardware: 'not_detected' | 'detected' | 'detecting';
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

interface ResourceAllocation {
  cpuCores: number;
  ramPercent: number;
  storageGb: number;
  gpuVramPercent: number[];
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
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    orchestrator: 'checking',
    node: 'not_installed',
    hardware: 'not_detected',
  });
  const [loading, setLoading] = useState(false);
  const [detectingHardware, setDetectingHardware] = useState(false);
  const [logs, setLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'success' | 'error' }>>([]);
  const [isNativeNode, setIsNativeNode] = useState(false);

  // Resource allocation state
  const [allocation, setAllocation] = useState<ResourceAllocation>({
    cpuCores: 0,
    ramPercent: 50,
    storageGb: 100,
    gpuVramPercent: [],
  });

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

  // Health check
  const runHealthCheck = useCallback(async () => {
    addLog('Running health check...', 'info');

    // Check orchestrator
    setHealthStatus(prev => ({ ...prev, orchestrator: 'checking' }));
    try {
      const res = await fetch('/health');
      if (res.ok) {
        setHealthStatus(prev => ({ ...prev, orchestrator: 'online' }));
        addLog('Orchestrator: Online', 'success');
      } else {
        setHealthStatus(prev => ({ ...prev, orchestrator: 'offline' }));
        addLog('Orchestrator: Offline', 'error');
      }
    } catch {
      setHealthStatus(prev => ({ ...prev, orchestrator: 'offline' }));
      addLog('Orchestrator: Cannot connect', 'error');
    }
  }, [addLog]);

  // Detect hardware (from connected nodes via orchestrator)
  const detectHardware = useCallback(async () => {
    setDetectingHardware(true);
    setHealthStatus(prev => ({ ...prev, hardware: 'detecting' }));
    addLog('Checking for connected nodes...', 'info');

    try {
      // Query orchestrator for nodes connected to user's workspaces
      const res = await authFetch('/api/v1/my-nodes');

      if (res.ok) {
        const data = await res.json();

        if (data.nodes && data.nodes.length > 0) {
          // Use the first connected node's hardware info
          const node = data.nodes[0];
          const caps = node.capabilities;

          const hwInfo: HardwareInfo = {
            cpu: {
              model: caps.cpu?.model || 'Unknown',
              cores: caps.cpu?.cores || 0,
              threads: caps.cpu?.threads || 0,
              frequency_mhz: caps.cpu?.frequency_mhz,
            },
            memory: {
              total_mb: caps.memory?.total_mb || 0,
              available_mb: caps.memory?.available_mb || 0,
            },
            gpus: (caps.gpus || []).map((g: any) => ({
              vendor: g.vendor || 'unknown',
              model: g.model || 'Unknown GPU',
              vram_mb: g.vram_mb || 0,
              driver_version: g.driver_version || 'N/A',
            })),
            storage: {
              total_gb: caps.storage?.total_gb || 0,
              available_gb: caps.storage?.available_gb || 0,
            },
            docker_version: caps.docker_version || null,
            node_version: node.id,
          };

          setHardware(hwInfo);
          setHealthStatus(prev => ({ ...prev, hardware: 'detected', node: 'running' }));
          setIsNativeNode(true);
          setNodeState(prev => ({
            ...prev,
            running: true,
            connected: true,
            nodeId: node.id,
          }));

          // Initialize resource allocation with defaults based on hardware
          setAllocation({
            cpuCores: Math.max(1, Math.floor(hwInfo.cpu.cores / 2)),
            ramPercent: 50,
            storageGb: Math.min(100, Math.floor(hwInfo.storage.available_gb / 2)),
            gpuVramPercent: hwInfo.gpus.map(() => 80),
          });

          addLog(`Node detected: ${node.id} (${node.workspaceName})`, 'success');
          addLog(`CPU: ${hwInfo.cpu.model} (${hwInfo.cpu.cores} cores)`, 'info');
          addLog(`RAM: ${(hwInfo.memory.total_mb / 1024).toFixed(1)} GB`, 'info');
          if (hwInfo.gpus.length > 0) {
            hwInfo.gpus.forEach((gpu) => {
              addLog(`GPU: ${gpu.model} (${(gpu.vram_mb / 1024).toFixed(0)} GB VRAM)`, 'info');
            });
          }

          if (data.nodes.length > 1) {
            addLog(`${data.nodes.length - 1} additional node(s) connected`, 'info');
          }
        } else {
          throw new Error('No connected nodes found');
        }
      } else {
        throw new Error('Failed to query nodes');
      }
    } catch (err) {
      // No connected nodes - show prompt to install/start node
      setHealthStatus(prev => ({ ...prev, hardware: 'not_detected', node: 'not_installed' }));
      setIsNativeNode(false);
      setNodeState(prev => ({ ...prev, running: false, connected: false, nodeId: null }));
      addLog(`No connected nodes: ${err}`, 'error');
      addLog('Start the native node app and it will connect automatically', 'info');

      // Show only what browser can detect
      setHardware({
        cpu: {
          model: 'Install native node for detection',
          cores: navigator.hardwareConcurrency || 0,
          threads: navigator.hardwareConcurrency || 0
        },
        memory: { total_mb: 0, available_mb: 0 },
        gpus: [],
        storage: { total_gb: 0, available_gb: 0 },
        docker_version: null,
      });
    } finally {
      setDetectingHardware(false);
    }
  }, [addLog]);

  useEffect(() => {
    loadWorkspaces();
    runHealthCheck();
    detectHardware(); // Auto-detect nodes on mount
  }, [loadWorkspaces, runHealthCheck, detectHardware]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, []);

  const startNode = async () => {
    if (selectedWorkspaces.length === 0) {
      addLog('Please select at least one workspace to join', 'error');
      return;
    }

    // Check if we have real hardware info
    if (!hardware || hardware.memory.total_mb === 0) {
      addLog('Warning: No hardware detected. Install native node for best experience.', 'error');
    }

    setLoading(true);
    addLog('Connecting to orchestrator...', 'info');

    try {
      const ws = new WebSocket(nodeState.orchestratorUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog('WebSocket connected', 'success');

        const registerMsg = {
          type: 'register',
          capabilities: hardware ? {
            node_id: `web-${crypto.randomUUID().slice(0, 8)}`,
            gpus: hardware.gpus.map(g => ({
              vendor: g.vendor || 'unknown',
              model: g.model,
              vram_mb: g.vram_mb,
              supports: { cuda: false, rocm: false, vulkan: true, metal: false, opencl: true },
            })),
            cpu: {
              model: hardware.cpu.model,
              cores: hardware.cpu.cores,
              threads: hardware.cpu.threads,
              features: [],
            },
            memory: {
              total_mb: hardware.memory.total_mb,
              available_mb: hardware.memory.available_mb,
            },
            storage: {
              total_gb: hardware.storage.total_gb,
              available_gb: hardware.storage.available_gb,
            },
            mcp_adapters: [],
          } : {
            node_id: `web-${crypto.randomUUID().slice(0, 8)}`,
            gpus: [],
            cpu: { model: 'Web Browser', cores: navigator.hardwareConcurrency || 1, threads: navigator.hardwareConcurrency || 1, features: [] },
            memory: { total_mb: 1024, available_mb: 512 },
            storage: { total_gb: 1, available_gb: 1 },
            mcp_adapters: [],
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
            setLoading(false);

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
            addLog('Web mode cannot execute jobs - use native node', 'error');
          } else if (msg.type === 'error') {
            addLog(`Error: ${msg.message}`, 'error');
          }
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      ws.onerror = () => {
        addLog('WebSocket error', 'error');
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

  const formatMemory = (mb: number) => mb > 0 ? `${(mb / 1024).toFixed(1)} GB` : '--';

  const StatusIcon = ({ status }: { status: 'checking' | 'online' | 'offline' | 'not_installed' | 'stopped' | 'running' | 'error' | 'not_detected' | 'detected' | 'detecting' }) => {
    switch (status) {
      case 'online':
      case 'running':
      case 'detected':
        return <CheckCircle size={16} style={{ color: 'var(--success)' }} />;
      case 'offline':
      case 'error':
        return <XCircle size={16} style={{ color: 'var(--error)' }} />;
      case 'not_installed':
      case 'stopped':
      case 'not_detected':
        return <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />;
      default:
        return <Activity size={16} className="spin" style={{ color: 'var(--primary)' }} />;
    }
  };

  return (
    <div className="fade-in">
      {/* Health Status Banner */}
      <div className="cyber-card" style={{ marginBottom: 'var(--gap-lg)' }}>
        <div className="cyber-card-header">
          <span className="cyber-card-title">
            <Activity size={14} style={{ marginRight: '0.5rem' }} />
            SYSTEM STATUS
          </span>
          <CyberButton icon={RefreshCw} onClick={runHealthCheck}>
            HEALTH CHECK
          </CyberButton>
        </div>
        <div className="cyber-card-body">
          <div style={{ display: 'flex', gap: 'var(--gap-xl)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
              <StatusIcon status={healthStatus.orchestrator} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Orchestrator:</span>
              <span style={{
                color: healthStatus.orchestrator === 'online' ? 'var(--success)' : 'var(--error)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                textTransform: 'uppercase',
              }}>
                {healthStatus.orchestrator}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
              <StatusIcon status={healthStatus.node} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Native Node:</span>
              <span style={{
                color: healthStatus.node === 'running' ? 'var(--success)' :
                       healthStatus.node === 'not_installed' ? 'var(--warning)' : 'var(--error)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                textTransform: 'uppercase',
              }}>
                {healthStatus.node.replace('_', ' ')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
              <StatusIcon status={healthStatus.hardware} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Hardware:</span>
              <span style={{
                color: healthStatus.hardware === 'detected' ? 'var(--success)' : 'var(--warning)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                textTransform: 'uppercase',
              }}>
                {healthStatus.hardware.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Download / Install Section */}
      {healthStatus.node === 'not_installed' && (
        <div className="cyber-card" style={{ marginBottom: 'var(--gap-lg)', borderColor: 'var(--warning)' }}>
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Download size={14} style={{ marginRight: '0.5rem' }} />
              DOWNLOAD OTHERTHING NODE
            </span>
            <CyberButton variant="primary" icon={Activity} onClick={detectHardware} loading={detectingHardware}>
              DETECT EXISTING
            </CyberButton>
          </div>
          <div className="cyber-card-body">
            <div style={{ marginBottom: 'var(--gap-md)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Install the native node for accurate hardware detection, GPU acceleration, and job execution.
            </div>
            <div style={{ display: 'flex', gap: 'var(--gap-md)', flexWrap: 'wrap' }}>
              {/* Windows */}
              <a
                href="/downloads/OtherThing-Node-Setup.exe"
                download
                style={{
                  flex: '1 1 200px',
                  padding: 'var(--gap-md)',
                  background: 'linear-gradient(135deg, rgba(0, 120, 215, 0.1), rgba(0, 120, 215, 0.05))',
                  border: '1px solid rgba(0, 120, 215, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-md)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0078d7';
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 120, 215, 0.2), rgba(0, 120, 215, 0.1))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0, 120, 215, 0.3)';
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 120, 215, 0.1), rgba(0, 120, 215, 0.05))';
                }}
              >
                <Monitor size={32} style={{ color: '#0078d7' }} />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', color: '#0078d7', marginBottom: '2px' }}>
                    Windows
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    .exe installer
                  </div>
                </div>
                <Download size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
              </a>

              {/* macOS */}
              <a
                href="/downloads/OtherThing-Node.dmg"
                download
                style={{
                  flex: '1 1 200px',
                  padding: 'var(--gap-md)',
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-md)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))';
                }}
              >
                <Apple size={32} style={{ color: '#ffffff' }} />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', color: '#ffffff', marginBottom: '2px' }}>
                    macOS
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    .dmg installer
                  </div>
                </div>
                <Download size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
              </a>

              {/* Linux */}
              <a
                href="/downloads/OtherThing-Node.AppImage"
                download
                style={{
                  flex: '1 1 200px',
                  padding: 'var(--gap-md)',
                  background: 'linear-gradient(135deg, rgba(255, 165, 0, 0.1), rgba(255, 165, 0, 0.05))',
                  border: '1px solid rgba(255, 165, 0, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-md)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#ffa500';
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 165, 0, 0.2), rgba(255, 165, 0, 0.1))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 165, 0, 0.3)';
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 165, 0, 0.1), rgba(255, 165, 0, 0.05))';
                }}
              >
                <Box size={32} style={{ color: '#ffa500' }} />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', color: '#ffa500', marginBottom: '2px' }}>
                    Linux
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    .AppImage
                  </div>
                </div>
                <Download size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
              </a>
            </div>
            <div style={{ marginTop: 'var(--gap-md)', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              After installing, launch the app and it will automatically connect. Then click "Detect Existing" above.
            </div>
          </div>
        </div>
      )}

      {/* Node Control Banner */}
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
              }}>
                {nodeState.running ? (isNativeNode ? 'NATIVE NODE ACTIVE' : 'NODE ACTIVE') : 'NODE OFFLINE'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {nodeState.running
                  ? (isNativeNode ? `Native App Connected: ${nodeState.nodeId}` : `Node ID: ${nodeState.nodeId}`)
                  : 'Select workspaces and start to contribute compute'
                }
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--gap-md)' }}>
            {!nodeState.running && (
              <CyberButton icon={Activity} onClick={detectHardware} loading={detectingHardware}>
                DETECT HARDWARE
              </CyberButton>
            )}
            {nodeState.running && isNativeNode ? (
              <CyberButton icon={RefreshCw} onClick={detectHardware} loading={detectingHardware}>
                REFRESH
              </CyberButton>
            ) : nodeState.running ? (
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

      {/* Resource Allocation - only show when hardware detected */}
      {hardware && hardware.cpu.cores > 0 && (
        <div className="cyber-card" style={{ marginBottom: 'var(--gap-xl)' }}>
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Cpu size={14} style={{ marginRight: '0.5rem' }} />
              RESOURCE ALLOCATION
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Choose how much to contribute
            </span>
          </div>
          <div className="cyber-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
              {/* CPU Cores */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <Cpu size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    CPU Cores
                  </span>
                  <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                    {allocation.cpuCores} / {hardware.cpu.cores}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={hardware.cpu.cores}
                  value={allocation.cpuCores}
                  onChange={(e) => setAllocation(prev => ({ ...prev, cpuCores: parseInt(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>

              {/* RAM */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <HardDrive size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    RAM
                  </span>
                  <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                    {Math.round(hardware.memory.total_mb * allocation.ramPercent / 100 / 1024)} GB ({allocation.ramPercent}%)
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={allocation.ramPercent}
                  onChange={(e) => setAllocation(prev => ({ ...prev, ramPercent: parseInt(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>

              {/* Storage */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <HardDrive size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    Storage
                  </span>
                  <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                    {allocation.storageGb} GB / {hardware.storage.available_gb} GB available
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max={Math.max(10, hardware.storage.available_gb)}
                  value={allocation.storageGb}
                  onChange={(e) => setAllocation(prev => ({ ...prev, storageGb: parseInt(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>

              {/* GPUs */}
              {hardware.gpus.map((gpu, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <Zap size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                      {gpu.model} VRAM
                    </span>
                    <span style={{ color: 'var(--primary-light)', fontFamily: 'var(--font-mono)' }}>
                      {Math.round(gpu.vram_mb * (allocation.gpuVramPercent[i] || 80) / 100 / 1024)} GB ({allocation.gpuVramPercent[i] || 80}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={allocation.gpuVramPercent[i] || 80}
                    onChange={(e) => {
                      const newPercents = [...allocation.gpuVramPercent];
                      newPercents[i] = parseInt(e.target.value);
                      setAllocation(prev => ({ ...prev, gpuVramPercent: newPercents }));
                    }}
                    style={{ width: '100%', accentColor: 'var(--primary-light)' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'var(--gap-lg)', padding: 'var(--gap-md)', background: 'rgba(0, 212, 255, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Resource limits will be applied to the native node app. Changes take effect on next job assignment.
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Hardware Info */}
      <div className="cyber-grid-layout">
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Cpu size={14} style={{ marginRight: '0.5rem' }} />
              PROCESSOR
            </span>
          </div>
          <div className="cyber-card-body">
            {hardware && hardware.cpu.cores > 0 ? (
              <>
                <div style={{ marginBottom: 'var(--gap-md)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--primary)' }}>
                    {hardware.cpu.model}
                  </div>
                </div>
                <div className="hardware-grid">
                  <div className="hardware-item">
                    <div className="hardware-label">CORES</div>
                    <div className="hardware-value">{hardware.cpu.cores}</div>
                  </div>
                  <div className="hardware-item">
                    <div className="hardware-label">THREADS</div>
                    <div className="hardware-value">{hardware.cpu.threads}</div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--gap-md)', color: 'var(--text-muted)' }}>
                <Cpu size={32} style={{ opacity: 0.3, marginBottom: 'var(--gap-sm)' }} />
                <div>Click "Detect Hardware" to scan</div>
              </div>
            )}
          </div>
        </div>

        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <HardDrive size={14} style={{ marginRight: '0.5rem' }} />
              MEMORY & STORAGE
            </span>
          </div>
          <div className="cyber-card-body">
            {hardware && hardware.memory.total_mb > 0 ? (
              <div className="hardware-grid">
                <div className="hardware-item">
                  <div className="hardware-label">TOTAL RAM</div>
                  <div className="hardware-value">{formatMemory(hardware.memory.total_mb)}</div>
                </div>
                <div className="hardware-item">
                  <div className="hardware-label">AVAILABLE</div>
                  <div className="hardware-value" style={{ color: 'var(--success)' }}>
                    {formatMemory(hardware.memory.available_mb)}
                  </div>
                </div>
                <div className="hardware-item">
                  <div className="hardware-label">STORAGE</div>
                  <div className="hardware-value">{hardware.storage.total_gb} GB</div>
                </div>
                <div className="hardware-item">
                  <div className="hardware-label">DOCKER</div>
                  <div className="hardware-value" style={{ fontSize: '0.8rem' }}>
                    {hardware.docker_version || 'Not found'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--gap-md)', color: 'var(--text-muted)' }}>
                <HardDrive size={32} style={{ opacity: 0.3, marginBottom: 'var(--gap-sm)' }} />
                <div>Click "Detect Hardware" to scan</div>
              </div>
            )}
          </div>
        </div>

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
                      background: gpu.vendor === 'nvidia' ? 'rgba(118, 185, 0, 0.1)' : 'rgba(237, 28, 36, 0.1)',
                      border: `1px solid ${gpu.vendor === 'nvidia' ? 'rgba(118, 185, 0, 0.3)' : 'rgba(237, 28, 36, 0.3)'}`,
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      color: gpu.vendor === 'nvidia' ? '#76b900' : '#ed1c24',
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                    }}>
                      {gpu.vendor}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Zap size={32} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                <div>{hardware ? 'NO GPU DETECTED' : 'Click "Detect Hardware" to scan'}</div>
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
