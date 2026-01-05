import { Cpu, HardDrive, Zap } from 'lucide-react';

interface NodeInfo {
  id: string;
  available: boolean;
  current_jobs: number;
  capabilities: {
    gpus: number;
    cpu_cores: number;
    memory_mb: number;
  };
  reputation?: number;
}

interface NodeListProps {
  nodes: NodeInfo[];
}

function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

export function NodeList({ nodes }: NodeListProps) {
  if (nodes.length === 0) {
    return (
      <div className="empty-state">
        <Zap size={32} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
        <div>NO NODES CONNECTED</div>
        <div style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>
          Run <code>rhizos-node start</code> to connect
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {nodes.map((node) => (
        <div key={node.id} className="node-item">
          <div className={`node-status ${node.available ? 'online' : 'busy'}`} />
          <div className="node-info">
            <div className="node-id">
              <span style={{ color: 'var(--neon-cyan)' }}>//</span> {node.id.slice(0, 12)}
            </div>
            <div className="node-specs">
              <Zap size={10} style={{ display: 'inline', marginRight: '4px' }} />
              <span>{node.capabilities.gpus}</span> GPU
              <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
              <Cpu size={10} style={{ display: 'inline', marginRight: '4px' }} />
              <span>{node.capabilities.cpu_cores}</span> cores
              <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
              <HardDrive size={10} style={{ display: 'inline', marginRight: '4px' }} />
              <span>{formatMemory(node.capabilities.memory_mb)}</span>
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: node.current_jobs > 0 ? 'var(--neon-yellow)' : 'var(--text-muted)'
          }}>
            {node.current_jobs} ACTIVE
          </div>
        </div>
      ))}
    </div>
  );
}
