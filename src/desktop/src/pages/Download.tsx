import { useState } from 'react';
import { Download, Terminal, Copy, CheckCircle, Server, Cpu, HardDrive, Monitor, Box } from 'lucide-react';
import { CyberButton } from '../components';

type Platform = 'linux' | 'windows' | 'docker';

const INSTALL_COMMANDS = {
  linux: {
    title: 'Linux (Ubuntu/Debian)',
    steps: [
      {
        title: 'Quick install (recommended)',
        command: `curl -fsSL https://raw.githubusercontent.com/Huck-dev/rhizos-node/main/install.sh | bash`,
      },
      {
        title: 'Or build from source',
        command: `# Requires Rust 1.75+
git clone https://github.com/Huck-dev/rhizos-node.git
cd rhizos-node
cargo build --release
sudo mv target/release/rhizos-node /usr/local/bin/`,
      },
      {
        title: 'Start the node',
        command: `rhizos-node --orchestrator http://YOUR_ORCHESTRATOR_IP:8080`,
      },
    ],
  },
  windows: {
    title: 'Windows',
    steps: [
      {
        title: 'PowerShell install',
        command: `# Run in PowerShell as Administrator
irm https://raw.githubusercontent.com/Huck-dev/rhizos-node/main/install.ps1 | iex`,
      },
      {
        title: 'Or build from source',
        command: `# Requires Rust 1.75+
git clone https://github.com/Huck-dev/rhizos-node.git
cd rhizos-node
cargo build --release`,
      },
      {
        title: 'Start the node',
        command: `.\\target\\release\\rhizos-node.exe --orchestrator http://YOUR_ORCHESTRATOR_IP:8080`,
      },
    ],
  },
  docker: {
    title: 'Docker',
    steps: [
      {
        title: 'Build the image',
        command: `git clone https://github.com/Huck-dev/rhizos-node.git
cd rhizos-node
docker build -t rhizos-node .`,
      },
      {
        title: 'Run with GPU support',
        command: `docker run -d \\
  --gpus all \\
  --name rhizos-node \\
  -e ORCHESTRATOR_URL=http://YOUR_ORCHESTRATOR_IP:8080 \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  rhizos-node`,
      },
      {
        title: 'Run CPU only',
        command: `docker run -d \\
  --name rhizos-node \\
  -e ORCHESTRATOR_URL=http://YOUR_ORCHESTRATOR_IP:8080 \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  rhizos-node`,
      },
    ],
  },
};

const REQUIREMENTS = [
  { icon: Cpu, label: 'CPU', value: '4+ cores recommended' },
  { icon: HardDrive, label: 'RAM', value: '8GB minimum, 16GB+ for GPU workloads' },
  { icon: Monitor, label: 'GPU', value: 'Optional - NVIDIA with CUDA 11.8+' },
  { icon: Box, label: 'Docker', value: 'Required for running containers' },
];

export function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>('linux');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const instructions = INSTALL_COMMANDS[platform];

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 'var(--gap-xl)' }}>
        <h2 className="page-title">Share Your Compute</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 'var(--gap-sm)', fontSize: '0.9rem', maxWidth: '600px' }}>
          Install the RhizOS node agent on your machine to share compute with friends.
          Your hardware will be available for running AI models, agents, and workflows.
        </p>
      </div>

      {/* Requirements */}
      <div className="cyber-card" style={{ marginBottom: 'var(--gap-xl)' }}>
        <div className="cyber-card-header">
          <span className="cyber-card-title">
            <Server size={14} style={{ marginRight: '0.5rem' }} />
            SYSTEM REQUIREMENTS
          </span>
        </div>
        <div className="cyber-card-body">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--gap-md)',
          }}>
            {REQUIREMENTS.map(req => {
              const Icon = req.icon;
              return (
                <div key={req.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-md)',
                  padding: 'var(--gap-md)',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <Icon size={20} style={{ color: 'var(--primary)' }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {req.label}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {req.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Platform Selection */}
      <div className="cyber-card" style={{ marginBottom: 'var(--gap-xl)' }}>
        <div className="cyber-card-header">
          <span className="cyber-card-title">
            <Download size={14} style={{ marginRight: '0.5rem' }} />
            INSTALLATION
          </span>
        </div>
        <div className="cyber-card-body">
          {/* Platform Tabs */}
          <div style={{
            display: 'flex',
            gap: 'var(--gap-sm)',
            marginBottom: 'var(--gap-xl)',
            borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
            paddingBottom: 'var(--gap-md)',
          }}>
            {(['linux', 'windows', 'docker'] as Platform[]).map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                style={{
                  padding: 'var(--gap-sm) var(--gap-lg)',
                  background: platform === p ? 'var(--primary)' : 'transparent',
                  border: platform === p ? 'none' : '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: platform === p ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s ease',
                }}
              >
                {p === 'linux' ? '🐧 Linux' : p === 'windows' ? '🪟 Windows' : '🐳 Docker'}
              </button>
            ))}
          </div>

          {/* Installation Steps */}
          <div style={{ display: 'grid', gap: 'var(--gap-lg)' }}>
            {instructions.steps.map((step, index) => (
              <div key={index}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-sm)',
                  marginBottom: 'var(--gap-sm)',
                }}>
                  <span style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                  }}>
                    {index + 1}
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                  }}>
                    {step.title}
                  </span>
                </div>
                <div style={{
                  position: 'relative',
                  background: 'var(--bg-void)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}>
                  <pre style={{
                    margin: 0,
                    padding: 'var(--gap-md)',
                    paddingRight: '50px',
                    overflow: 'auto',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {step.command}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(step.command, index)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px',
                      cursor: 'pointer',
                      color: copiedIndex === index ? 'var(--success)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Copy to clipboard"
                  >
                    {copiedIndex === index ? <CheckCircle size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Important Note */}
          <div style={{
            marginTop: 'var(--gap-xl)',
            padding: 'var(--gap-md)',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{
              fontSize: '0.85rem',
              color: 'var(--primary)',
              fontWeight: 500,
              marginBottom: 'var(--gap-sm)',
            }}>
              Important: Replace YOUR_ORCHESTRATOR_IP
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Replace <code style={{ background: 'var(--bg-void)', padding: '2px 6px', borderRadius: '3px' }}>YOUR_ORCHESTRATOR_IP</code> with
              the IP address of the machine running the orchestrator. If running locally, use <code style={{ background: 'var(--bg-void)', padding: '2px 6px', borderRadius: '3px' }}>localhost</code>.
              For remote access, use your public IP or domain.
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start for Orchestrator */}
      <div className="cyber-card">
        <div className="cyber-card-header">
          <span className="cyber-card-title">
            <Terminal size={14} style={{ marginRight: '0.5rem' }} />
            RUNNING THE ORCHESTRATOR
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            One person needs to run this for the network
          </span>
        </div>
        <div className="cyber-card-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--gap-md)' }}>
            The orchestrator coordinates jobs between nodes. Only one person in your group needs to run it.
          </p>

          <div style={{
            position: 'relative',
            background: 'var(--bg-void)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
          }}>
            <pre style={{
              margin: 0,
              padding: 'var(--gap-md)',
              overflow: 'auto',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
            }}>
{`# Clone the repo
git clone https://github.com/rhizos-cloud/modchain.git
cd modchain

# Start the orchestrator
pnpm install
pnpm --filter @rhizos-cloud/orchestrator dev

# Orchestrator runs on port 8080 by default`}
            </pre>
            <button
              onClick={() => copyToClipboard(`git clone https://github.com/rhizos-cloud/modchain.git && cd modchain && pnpm install && pnpm --filter @rhizos-cloud/orchestrator dev`, 99)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px',
                cursor: 'pointer',
                color: copiedIndex === 99 ? 'var(--success)' : 'var(--text-muted)',
              }}
            >
              {copiedIndex === 99 ? <CheckCircle size={14} /> : <Copy size={14} />}
            </button>
          </div>

          <div style={{
            marginTop: 'var(--gap-md)',
            display: 'flex',
            gap: 'var(--gap-md)',
          }}>
            <CyberButton
              variant="primary"
              icon={Download}
              onClick={() => window.open('https://github.com/Huck-dev/rhizos-node', '_blank')}
            >
              VIEW ON GITHUB
            </CyberButton>
          </div>
        </div>
      </div>
    </div>
  );
}
