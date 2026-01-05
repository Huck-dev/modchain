import { useState, useEffect } from 'react';
import { Power, Cpu, HardDrive, Zap, RefreshCw, Terminal } from 'lucide-react';
import { CyberButton, ActivityLog } from '../components';

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

export function NodeControl() {
  const [nodeState, setNodeState] = useState<NodeState>({
    running: false,
    connected: false,
    nodeId: null,
    orchestratorUrl: 'http://localhost:8080',
  });
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'success' | 'error' }>>([]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [{ time, message, type }, ...prev].slice(0, 100));
  };

  useEffect(() => {
    // Check if Tauri is available
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      checkNodeStatus();
      fetchHardware();
    } else {
      // Mock data for web preview
      setHardware({
        cpu: { model: 'AMD Ryzen Threadripper PRO 5995WX', cores: 64, threads: 128 },
        memory: { total_mb: 201261, available_mb: 195000 },
        gpus: [
          { model: 'NVIDIA GeForce RTX 3070', vram_mb: 8192, driver_version: '591.59' },
          { model: 'NVIDIA GeForce RTX 2060 SUPER', vram_mb: 8192, driver_version: '591.59' },
        ],
        storage: { total_gb: 14904, available_gb: 14725 },
        docker_version: '28.1.1',
      });
      addLog('Running in web preview mode', 'info');
    }
  }, []);

  const checkNodeStatus = async () => {
    // This will be implemented with Tauri IPC
    addLog('Checking node status...', 'info');
  };

  const fetchHardware = async () => {
    // This will be implemented with Tauri IPC
    addLog('Detecting hardware...', 'info');
  };

  const startNode = async () => {
    setLoading(true);
    addLog('Starting node agent...', 'info');

    // Simulate node start (will be replaced with Tauri IPC)
    await new Promise(resolve => setTimeout(resolve, 1500));

    setNodeState(prev => ({ ...prev, running: true, connected: true, nodeId: 'abc123' }));
    addLog('Node agent started successfully', 'success');
    addLog(`Connected to ${nodeState.orchestratorUrl}`, 'success');
    setLoading(false);
  };

  const stopNode = async () => {
    setLoading(true);
    addLog('Stopping node agent...', 'info');

    await new Promise(resolve => setTimeout(resolve, 500));

    setNodeState(prev => ({ ...prev, running: false, connected: false, nodeId: null }));
    addLog('Node agent stopped', 'info');
    setLoading(false);
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
                  ? `Connected to ${nodeState.orchestratorUrl}`
                  : 'Not connected to network'
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
              <CyberButton variant="success" icon={Power} onClick={startNode} loading={loading}>
                START NODE
              </CyberButton>
            )}
            <CyberButton icon={RefreshCw} onClick={fetchHardware}>
              REFRESH
            </CyberButton>
          </div>
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
                <div className="hardware-label">DOCKER</div>
                <div className="hardware-value" style={{ fontSize: '0.875rem' }}>
                  {hardware?.docker_version ?? 'Not found'}
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
                        Driver: {gpu.driver_version}
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
                      CUDA
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
