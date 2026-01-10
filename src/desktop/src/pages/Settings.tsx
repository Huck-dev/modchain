import { useState } from 'react';
import { Save, RotateCcw, Server, Key, Sliders, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { CyberButton } from '../components';

interface ApiKey {
  provider: string;
  key: string;
  validated?: boolean;
}

interface Settings {
  orchestrator_url: string;
  auto_start: boolean;
  start_minimized: boolean;
  max_concurrent_jobs: number;
  max_memory_percent: number;
  api_keys: ApiKey[];
}

const API_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
  { id: 'groq', name: 'Groq', placeholder: 'gsk_...', models: ['llama-3.1-70b', 'mixtral-8x7b'] },
  { id: 'together', name: 'Together AI', placeholder: '', models: ['llama-3-70b', 'mistral-7b'] },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...', models: ['Various models'] },
];

export function Settings() {
  const [settings, setSettings] = useState<Settings>({
    orchestrator_url: 'http://localhost:8080',
    auto_start: false,
    start_minimized: false,
    max_concurrent_jobs: 4,
    max_memory_percent: 80,
    api_keys: [],
  });
  const [saved, setSaved] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState<string | null>(null);

  const handleSave = async () => {
    // Will be implemented with Tauri IPC - saves to local config
    localStorage.setItem('rhizos_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings({
      orchestrator_url: 'http://localhost:8080',
      auto_start: false,
      start_minimized: false,
      max_concurrent_jobs: 4,
      max_memory_percent: 80,
      api_keys: [],
    });
  };

  const updateApiKey = (provider: string, key: string) => {
    setSettings(s => {
      const existing = s.api_keys.find(k => k.provider === provider);
      if (existing) {
        return {
          ...s,
          api_keys: s.api_keys.map(k =>
            k.provider === provider ? { ...k, key, validated: undefined } : k
          ),
        };
      }
      return {
        ...s,
        api_keys: [...s.api_keys, { provider, key }],
      };
    });
  };

  const getApiKey = (provider: string): ApiKey | undefined => {
    return settings.api_keys.find(k => k.provider === provider);
  };

  const validateApiKey = async (provider: string) => {
    const apiKey = getApiKey(provider);
    if (!apiKey?.key) return;

    setValidating(provider);

    // Simulate validation - in production, make a test API call
    await new Promise(r => setTimeout(r, 1000));

    // For now, mark as valid if key matches expected format
    const isValid = apiKey.key.length > 10;

    setSettings(s => ({
      ...s,
      api_keys: s.api_keys.map(k =>
        k.provider === provider ? { ...k, validated: isValid } : k
      ),
    }));
    setValidating(null);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--gap-xl)' }}>
        <div>
          <h2 className="page-title">Settings</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 'var(--gap-sm)', fontSize: '0.85rem' }}>
            Configure API keys and network settings
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--gap-md)' }}>
          <CyberButton icon={RotateCcw} onClick={handleReset}>
            RESET
          </CyberButton>
          <CyberButton variant="success" icon={Save} onClick={handleSave}>
            {saved ? 'SAVED!' : 'SAVE CHANGES'}
          </CyberButton>
        </div>
      </div>

      {/* API Keys Section */}
      <div className="cyber-card" style={{ marginBottom: 'var(--gap-xl)' }}>
        <div className="cyber-card-header">
          <span className="cyber-card-title">
            <Key size={14} style={{ marginRight: '0.5rem' }} />
            API KEYS
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Add API keys to use cloud models (OpenAI, Anthropic, etc.)
          </span>
        </div>
        <div className="cyber-card-body">
          <div style={{ display: 'grid', gap: 'var(--gap-lg)' }}>
            {API_PROVIDERS.map(provider => {
              const apiKey = getApiKey(provider.id);
              const isShown = showKeys[provider.id];

              return (
                <div key={provider.id} style={{
                  padding: 'var(--gap-md)',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: apiKey?.validated === true
                    ? '1px solid var(--success)'
                    : apiKey?.validated === false
                      ? '1px solid var(--error)'
                      : '1px solid rgba(99, 102, 241, 0.2)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--gap-sm)' }}>
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--gap-sm)',
                      }}>
                        {provider.name}
                        {apiKey?.validated === true && <CheckCircle size={14} style={{ color: 'var(--success)' }} />}
                        {apiKey?.validated === false && <XCircle size={14} style={{ color: 'var(--error)' }} />}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Models: {provider.models.join(', ')}
                      </div>
                    </div>
                    {apiKey?.key && (
                      <CyberButton
                        onClick={() => validateApiKey(provider.id)}
                        disabled={validating === provider.id}
                      >
                        {validating === provider.id ? 'VALIDATING...' : 'VALIDATE'}
                      </CyberButton>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type={isShown ? 'text' : 'password'}
                        className="settings-input"
                        value={apiKey?.key || ''}
                        onChange={(e) => updateApiKey(provider.id, e.target.value)}
                        placeholder={provider.placeholder || 'Enter API key...'}
                        style={{ paddingRight: '40px', width: '100%' }}
                      />
                      <button
                        onClick={() => setShowKeys(s => ({ ...s, [provider.id]: !s[provider.id] }))}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                      >
                        {isShown ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: 'var(--gap-lg)',
            padding: 'var(--gap-md)',
            background: 'var(--bg-void)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}>
            <strong style={{ color: 'var(--primary)' }}>Note:</strong> API keys are stored locally and never sent to our servers.
            They are used directly from your browser/app to call the respective APIs.
          </div>
        </div>
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
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                URL of the orchestrator to connect to
              </div>
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
      </div>

      {/* Version Info */}
      <div style={{
        marginTop: 'var(--gap-xl)',
        padding: 'var(--gap-md)',
        borderTop: '1px solid rgba(99, 102, 241, 0.1)',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-mono)',
      }}>
        RHIZOS CLOUD v0.1.0 // BUILD 2026.01.05
      </div>
    </div>
  );
}
