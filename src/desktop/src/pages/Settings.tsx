import { useState } from 'react';
import { Save, RotateCcw, Server, Wallet, Sliders } from 'lucide-react';
import { CyberButton } from '../components';

interface Settings {
  orchestrator_url: string;
  auto_start: boolean;
  start_minimized: boolean;
  pricing: {
    gpu_hour_cents: number;
    cpu_core_hour_cents: number;
    memory_gb_hour_cents: number;
    minimum_cents: number;
  };
  wallet_address: string;
  max_concurrent_jobs: number;
  max_memory_percent: number;
}

export function Settings() {
  const [settings, setSettings] = useState<Settings>({
    orchestrator_url: 'http://localhost:8080',
    auto_start: false,
    start_minimized: false,
    pricing: {
      gpu_hour_cents: 50,
      cpu_core_hour_cents: 1,
      memory_gb_hour_cents: 1,
      minimum_cents: 1,
    },
    wallet_address: '',
    max_concurrent_jobs: 4,
    max_memory_percent: 80,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    // Will be implemented with Tauri IPC
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings({
      orchestrator_url: 'http://localhost:8080',
      auto_start: false,
      start_minimized: false,
      pricing: {
        gpu_hour_cents: 50,
        cpu_core_hour_cents: 1,
        memory_gb_hour_cents: 1,
        minimum_cents: 1,
      },
      wallet_address: '',
      max_concurrent_jobs: 4,
      max_memory_percent: 80,
    });
  };

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="toggle-switch">
      <div className={`toggle-track ${checked ? 'active' : ''}`} onClick={() => onChange(!checked)}>
        <div className="toggle-thumb" />
      </div>
      <span className="toggle-label">{label}</span>
    </label>
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--gap-xl)', gap: 'var(--gap-md)' }}>
        <CyberButton icon={RotateCcw} onClick={handleReset}>
          RESET
        </CyberButton>
        <CyberButton variant="success" icon={Save} onClick={handleSave}>
          {saved ? 'SAVED!' : 'SAVE CHANGES'}
        </CyberButton>
      </div>

      <div className="cyber-grid-layout">
        {/* Network Settings */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Server size={14} style={{ marginRight: '0.5rem' }} />
              NETWORK
            </span>
          </div>
          <div className="cyber-card-body">
            <div className="settings-group">
              <label className="settings-label">ORCHESTRATOR URL</label>
              <input
                type="text"
                className="settings-input"
                value={settings.orchestrator_url}
                onChange={(e) => setSettings(s => ({ ...s, orchestrator_url: e.target.value }))}
                placeholder="http://localhost:8080"
              />
            </div>
            <div className="settings-group">
              <label className="settings-label">MAX CONCURRENT JOBS</label>
              <input
                type="number"
                className="settings-input"
                value={settings.max_concurrent_jobs}
                onChange={(e) => setSettings(s => ({ ...s, max_concurrent_jobs: parseInt(e.target.value) || 1 }))}
                min={1}
                max={16}
              />
            </div>
            <div className="settings-group">
              <label className="settings-label">MAX MEMORY USAGE (%)</label>
              <input
                type="number"
                className="settings-input"
                value={settings.max_memory_percent}
                onChange={(e) => setSettings(s => ({ ...s, max_memory_percent: parseInt(e.target.value) || 50 }))}
                min={10}
                max={95}
              />
              <div className="progress-bar" style={{ marginTop: 'var(--gap-sm)' }}>
                <div className="progress-fill" style={{ width: `${settings.max_memory_percent}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Startup Settings */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Sliders size={14} style={{ marginRight: '0.5rem' }} />
              STARTUP
            </span>
          </div>
          <div className="cyber-card-body">
            <div className="settings-group">
              <Toggle
                checked={settings.auto_start}
                onChange={(v) => setSettings(s => ({ ...s, auto_start: v }))}
                label="Start node automatically on launch"
              />
            </div>
            <div className="settings-group">
              <Toggle
                checked={settings.start_minimized}
                onChange={(v) => setSettings(s => ({ ...s, start_minimized: v }))}
                label="Start minimized to system tray"
              />
            </div>
          </div>
        </div>

        {/* Payment Settings */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Wallet size={14} style={{ marginRight: '0.5rem' }} />
              PAYMENT
            </span>
          </div>
          <div className="cyber-card-body">
            <div className="settings-group">
              <label className="settings-label">WALLET ADDRESS (USDC)</label>
              <input
                type="text"
                className="settings-input"
                value={settings.wallet_address}
                onChange={(e) => setSettings(s => ({ ...s, wallet_address: e.target.value }))}
                placeholder="0x..."
              />
            </div>
          </div>
        </div>

        {/* Pricing Settings */}
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">
              <Wallet size={14} style={{ marginRight: '0.5rem' }} />
              PRICING (CENTS/HOUR)
            </span>
          </div>
          <div className="cyber-card-body">
            <div className="hardware-grid">
              <div className="settings-group" style={{ marginBottom: 0 }}>
                <label className="settings-label">GPU/HOUR</label>
                <input
                  type="number"
                  className="settings-input"
                  value={settings.pricing.gpu_hour_cents}
                  onChange={(e) => setSettings(s => ({
                    ...s,
                    pricing: { ...s.pricing, gpu_hour_cents: parseInt(e.target.value) || 0 }
                  }))}
                  min={0}
                />
              </div>
              <div className="settings-group" style={{ marginBottom: 0 }}>
                <label className="settings-label">CPU CORE/HOUR</label>
                <input
                  type="number"
                  className="settings-input"
                  value={settings.pricing.cpu_core_hour_cents}
                  onChange={(e) => setSettings(s => ({
                    ...s,
                    pricing: { ...s.pricing, cpu_core_hour_cents: parseInt(e.target.value) || 0 }
                  }))}
                  min={0}
                />
              </div>
              <div className="settings-group" style={{ marginBottom: 0 }}>
                <label className="settings-label">MEMORY GB/HOUR</label>
                <input
                  type="number"
                  className="settings-input"
                  value={settings.pricing.memory_gb_hour_cents}
                  onChange={(e) => setSettings(s => ({
                    ...s,
                    pricing: { ...s.pricing, memory_gb_hour_cents: parseInt(e.target.value) || 0 }
                  }))}
                  min={0}
                />
              </div>
              <div className="settings-group" style={{ marginBottom: 0 }}>
                <label className="settings-label">MINIMUM</label>
                <input
                  type="number"
                  className="settings-input"
                  value={settings.pricing.minimum_cents}
                  onChange={(e) => setSettings(s => ({
                    ...s,
                    pricing: { ...s.pricing, minimum_cents: parseInt(e.target.value) || 0 }
                  }))}
                  min={0}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Version Info */}
      <div style={{
        marginTop: 'var(--gap-xl)',
        padding: 'var(--gap-md)',
        borderTop: '1px solid rgba(0, 255, 255, 0.1)',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-mono)',
      }}>
        MODCHAIN NODE v0.1.0 // BUILD 2026.01.04
      </div>
    </div>
  );
}
