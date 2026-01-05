import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Cpu, Clock, DollarSign, Send, ChevronRight, Check, Box, X, Bot, TrendingUp, Coins, Database, Search, Brain } from 'lucide-react';
import { CyberButton, GlitchText } from '../components';
import { useModule } from '../context/ModuleContext';

type Step = 'module' | 'configure' | 'confirm' | 'submitted';

interface JobConfig {
  hours: number;
  gpuCount: number;
  cpuCores: number;
  memoryGb: number;
}

const PRICING = {
  gpu_hour: 0.50,
  cpu_hour: 0.02,
  memory_hour: 0.01,
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'ai-agents': return Bot;
    case 'trading': return TrendingUp;
    case 'defi': return Coins;
    case 'infrastructure': return Database;
    case 'data': return Search;
    case 'models': return Brain;
    default: return Box;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'ai-agents': return 'var(--neon-cyan)';
    case 'trading': return 'var(--neon-green)';
    case 'defi': return 'var(--neon-magenta)';
    case 'infrastructure': return '#ffff00';
    case 'data': return '#ff6b6b';
    case 'models': return '#a855f7';
    default: return 'var(--text-secondary)';
  }
};

export function SubmitJob() {
  const navigate = useNavigate();
  const { selectedModule, clearModule } = useModule();

  const [step, setStep] = useState<Step>(selectedModule ? 'configure' : 'module');
  const [config, setConfig] = useState<JobConfig>({
    hours: 1,
    gpuCount: selectedModule?.requirements.min_gpus || 1,
    cpuCores: selectedModule?.requirements.min_cpu_cores || 4,
    memoryGb: selectedModule?.requirements.min_memory_mb ? Math.ceil(selectedModule.requirements.min_memory_mb / 1024) : 16,
  });
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  // Update config when module changes
  useEffect(() => {
    if (selectedModule) {
      setConfig({
        hours: 1,
        gpuCount: selectedModule.requirements.min_gpus || 0,
        cpuCores: selectedModule.requirements.min_cpu_cores || 4,
        memoryGb: selectedModule.requirements.min_memory_mb ? Math.ceil(selectedModule.requirements.min_memory_mb / 1024) : 16,
      });
      setStep('configure');
    }
  }, [selectedModule]);

  const calculateCost = () => {
    let cost = 0;
    if (config.gpuCount > 0) {
      cost += config.gpuCount * config.hours * PRICING.gpu_hour;
    }
    cost += config.cpuCores * config.hours * PRICING.cpu_hour;
    cost += config.memoryGb * config.hours * PRICING.memory_hour;
    return cost;
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      const accountRes = await fetch('/api/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: '0xDemoUser' }),
      });
      const account = await accountRes.json();

      await fetch(`/api/v1/accounts/${account.account_id}/test-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: Math.ceil(calculateCost() * 100) + 1000 }),
      });

      const jobRes = await fetch('/api/v1/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Account-Id': account.account_id,
        },
        body: JSON.stringify({
          requirements: {
            mcp_adapter: selectedModule?.runtime || 'docker',
            max_cost_cents: Math.ceil(calculateCost() * 100),
            currency: 'USDC',
            min_gpus: config.gpuCount,
            min_cpu_cores: config.cpuCores,
            min_memory_mb: config.memoryGb * 1024,
          },
          payload: {
            type: 'module-execution',
            module_id: selectedModule?.id,
            module_uri: selectedModule?.chain_uri,
            duration_hours: config.hours,
            gpu_count: config.gpuCount,
            cpu_cores: config.cpuCores,
            memory_gb: config.memoryGb,
          },
        }),
      });

      const job = await jobRes.json();
      setJobId(job.job_id);
      setStep('submitted');
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeModule = () => {
    clearModule();
    navigate('/modules');
  };

  const handleNewJob = () => {
    clearModule();
    setStep('module');
    setJobId(null);
  };

  const Slider = ({ label, value, min, max, step: stepVal, unit, onChange, disabled, highlight }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (v: number) => void;
    disabled?: boolean;
    highlight?: boolean;
  }) => (
    <div style={{ marginBottom: 'var(--gap-lg)', opacity: disabled ? 0.5 : 1 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 'var(--gap-sm)',
      }}>
        <span style={{
          fontSize: '0.75rem',
          color: highlight ? 'var(--neon-magenta)' : 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em'
        }}>
          {label}
          {highlight && <span style={{ marginLeft: '0.5rem', fontSize: '0.6rem' }}>(MODULE MIN)</span>}
        </span>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1rem',
          color: highlight ? 'var(--neon-magenta)' : 'var(--neon-cyan)',
        }}>
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={stepVal}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        style={{
          width: '100%',
          height: '8px',
          background: `linear-gradient(90deg, ${highlight ? 'var(--neon-magenta)' : 'var(--neon-cyan)'} ${((value - min) / (max - min)) * 100}%, var(--bg-elevated) ${((value - min) / (max - min)) * 100}%)`,
          borderRadius: '4px',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          WebkitAppearance: 'none',
        }}
      />
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        marginTop: '4px',
      }}>
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );

  const ModuleCard = () => {
    if (!selectedModule) return null;
    const CategoryIcon = getCategoryIcon(selectedModule.category);

    return (
      <div style={{
        padding: 'var(--gap-lg)',
        background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(255, 0, 255, 0.05))',
        border: '2px solid var(--neon-cyan)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--gap-xl)',
        boxShadow: 'var(--glow-cyan)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 'var(--gap-md)', alignItems: 'center' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-sm)',
              background: `${getCategoryColor(selectedModule.category)}20`,
              border: `1px solid ${getCategoryColor(selectedModule.category)}60`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CategoryIcon size={24} style={{ color: getCategoryColor(selectedModule.category) }} />
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                color: 'var(--text-primary)',
                marginBottom: '4px',
              }}>
                {selectedModule.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {selectedModule.author} • {selectedModule.runtime}
              </div>
            </div>
          </div>
          <button
            onClick={handleChangeModule}
            style={{
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.5rem',
              cursor: 'pointer',
              color: 'var(--neon-red, #ff4444)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.7rem',
            }}
          >
            <X size={14} />
            CHANGE
          </button>
        </div>

        <p style={{
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          marginTop: 'var(--gap-md)',
          lineHeight: 1.4,
        }}>
          {selectedModule.description}
        </p>

        <div style={{
          display: 'flex',
          gap: 'var(--gap-xs)',
          flexWrap: 'wrap',
          marginTop: 'var(--gap-md)',
        }}>
          {selectedModule.tools.slice(0, 5).map(tool => (
            <span
              key={tool}
              style={{
                padding: '0.2rem 0.5rem',
                background: 'var(--bg-void)',
                border: '1px solid rgba(0, 255, 255, 0.2)',
                borderRadius: '2px',
                fontSize: '0.65rem',
                color: 'var(--neon-cyan)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {tool}()
            </span>
          ))}
          {selectedModule.tools.length > 5 && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              +{selectedModule.tools.length - 5} more
            </span>
          )}
        </div>

        <div style={{
          marginTop: 'var(--gap-md)',
          padding: 'var(--gap-sm)',
          background: 'var(--bg-void)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          color: 'var(--neon-cyan)',
        }}>
          {selectedModule.chain_uri}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--gap-xl)' }}>
        <GlitchText text="DEPLOY COMPUTE" as="h2" className="glitch-hover" />
        <p style={{ color: 'var(--text-muted)', marginTop: 'var(--gap-sm)' }}>
          {selectedModule
            ? `Configure resources for ${selectedModule.name}`
            : 'Select a module and configure compute resources'
          }
        </p>
      </div>

      {/* Progress Steps */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 'var(--gap-lg)',
        marginBottom: 'var(--gap-xl)',
        padding: 'var(--gap-md)',
      }}>
        {['module', 'configure', 'confirm', 'submitted'].map((s, i) => {
          const steps = ['module', 'configure', 'confirm', 'submitted'];
          const currentIndex = steps.indexOf(step);
          const isComplete = i < currentIndex;
          const isCurrent = s === step;

          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: `2px solid ${isCurrent ? 'var(--neon-cyan)' : isComplete ? 'var(--neon-green)' : 'var(--text-muted)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: '0.875rem',
                color: isCurrent ? 'var(--neon-cyan)' : 'var(--text-muted)',
                background: isComplete ? 'rgba(0, 255, 65, 0.2)' : 'transparent',
                boxShadow: isCurrent ? 'var(--glow-cyan)' : 'none',
              }}>
                {isComplete ? <Check size={16} /> : i + 1}
              </div>
              <span style={{
                fontSize: '0.7rem',
                color: isCurrent ? 'var(--neon-cyan)' : 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                {s === 'module' ? 'MODULE' : s.toUpperCase()}
              </span>
              {i < 3 && <ChevronRight size={16} style={{ color: 'var(--text-muted)', marginLeft: 'var(--gap-xs)' }} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Select Module */}
      {step === 'module' && (
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">SELECT MODULE</span>
          </div>
          <div className="cyber-card-body" style={{ textAlign: 'center', padding: 'var(--gap-xl)' }}>
            <Box size={64} style={{ color: 'var(--text-muted)', margin: '0 auto var(--gap-lg)', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--gap-lg)' }}>
              Browse available modules and select one to deploy on compute
            </p>
            <CyberButton variant="primary" icon={Box} onClick={() => navigate('/modules')}>
              BROWSE MODULES
            </CyberButton>
          </div>
        </div>
      )}

      {/* Step 2: Configure Resources */}
      {step === 'configure' && selectedModule && (
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">CONFIGURE RESOURCES</span>
          </div>
          <div className="cyber-card-body">
            <ModuleCard />

            {/* Requirements Info */}
            {(selectedModule.requirements.min_gpus || selectedModule.requirements.min_cpu_cores || selectedModule.requirements.min_memory_mb) && (
              <div style={{
                padding: 'var(--gap-md)',
                background: 'rgba(255, 0, 255, 0.05)',
                border: '1px solid rgba(255, 0, 255, 0.2)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--gap-lg)',
                fontSize: '0.75rem',
              }}>
                <strong style={{ color: 'var(--neon-magenta)' }}>MINIMUM REQUIREMENTS:</strong>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 'var(--gap-sm)' }}>
                  {selectedModule.requirements.min_gpus && `${selectedModule.requirements.min_gpus} GPU`}
                  {selectedModule.requirements.min_gpus && selectedModule.requirements.min_cpu_cores && ' • '}
                  {selectedModule.requirements.min_cpu_cores && `${selectedModule.requirements.min_cpu_cores} CPU cores`}
                  {(selectedModule.requirements.min_gpus || selectedModule.requirements.min_cpu_cores) && selectedModule.requirements.min_memory_mb && ' • '}
                  {selectedModule.requirements.min_memory_mb && `${Math.ceil(selectedModule.requirements.min_memory_mb / 1024)}GB RAM`}
                  {selectedModule.requirements.gpu_vram_mb && ` • ${Math.ceil(selectedModule.requirements.gpu_vram_mb / 1024)}GB VRAM`}
                </span>
              </div>
            )}

            <Slider
              label="Duration"
              value={config.hours}
              min={1}
              max={24}
              step={1}
              unit="hours"
              onChange={(v) => setConfig(c => ({ ...c, hours: v }))}
            />

            {(selectedModule.requirements.min_gpus || 0) > 0 && (
              <Slider
                label="GPU Count"
                value={config.gpuCount}
                min={selectedModule.requirements.min_gpus || 1}
                max={8}
                step={1}
                unit="GPUs"
                highlight={config.gpuCount === selectedModule.requirements.min_gpus}
                onChange={(v) => setConfig(c => ({ ...c, gpuCount: v }))}
              />
            )}

            <Slider
              label="CPU Cores"
              value={config.cpuCores}
              min={selectedModule.requirements.min_cpu_cores || 1}
              max={64}
              step={1}
              unit="cores"
              highlight={config.cpuCores === selectedModule.requirements.min_cpu_cores}
              onChange={(v) => setConfig(c => ({ ...c, cpuCores: v }))}
            />

            <Slider
              label="Memory"
              value={config.memoryGb}
              min={selectedModule.requirements.min_memory_mb ? Math.ceil(selectedModule.requirements.min_memory_mb / 1024) : 4}
              max={256}
              step={4}
              unit="GB"
              highlight={config.memoryGb === Math.ceil((selectedModule.requirements.min_memory_mb || 0) / 1024)}
              onChange={(v) => setConfig(c => ({ ...c, memoryGb: v }))}
            />

            {/* Cost Preview */}
            <div style={{
              marginTop: 'var(--gap-xl)',
              padding: 'var(--gap-lg)',
              background: 'rgba(0, 255, 255, 0.05)',
              border: '1px solid rgba(0, 255, 255, 0.2)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    ESTIMATED COST
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {config.hours}h × {config.gpuCount > 0 ? `${config.gpuCount} GPU + ` : ''}{config.cpuCores} CPU + {config.memoryGb}GB
                  </div>
                </div>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.75rem',
                  color: 'var(--neon-green)',
                  textShadow: 'var(--glow-green)',
                }}>
                  ${calculateCost().toFixed(2)} <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>USDC</span>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--gap-xl)' }}>
              <CyberButton onClick={handleChangeModule}>
                CHANGE MODULE
              </CyberButton>
              <CyberButton variant="primary" onClick={() => setStep('confirm')}>
                REVIEW ORDER <ChevronRight size={14} style={{ marginLeft: '0.5rem' }} />
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && selectedModule && (
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">CONFIRM DEPLOYMENT</span>
          </div>
          <div className="cyber-card-body">
            <ModuleCard />

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'var(--gap-md)',
              marginBottom: 'var(--gap-xl)',
            }}>
              <div className="hardware-item">
                <div className="hardware-label">DURATION</div>
                <div className="hardware-value">{config.hours} HOURS</div>
              </div>
              {config.gpuCount > 0 && (
                <div className="hardware-item">
                  <div className="hardware-label">GPUs</div>
                  <div className="hardware-value" style={{ color: 'var(--neon-magenta)' }}>{config.gpuCount}</div>
                </div>
              )}
              <div className="hardware-item">
                <div className="hardware-label">CPU CORES</div>
                <div className="hardware-value">{config.cpuCores}</div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">MEMORY</div>
                <div className="hardware-value">{config.memoryGb} GB</div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">RUNTIME</div>
                <div className="hardware-value">{selectedModule.runtime.toUpperCase()}</div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">TOTAL COST</div>
                <div className="hardware-value" style={{ color: 'var(--neon-green)' }}>
                  ${calculateCost().toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{
              padding: 'var(--gap-md)',
              background: 'rgba(0, 255, 255, 0.05)',
              border: '1px solid rgba(0, 255, 255, 0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--gap-xl)',
            }}>
              <strong style={{ color: 'var(--neon-cyan)' }}>DEPLOYMENT INFO:</strong> Your module will be deployed
              on the next available node matching these requirements. You'll receive access credentials
              and can interact with the module's tools once deployment is complete.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <CyberButton onClick={() => setStep('configure')}>
                BACK
              </CyberButton>
              <CyberButton variant="success" icon={Send} onClick={handleSubmit} loading={submitting}>
                DEPLOY MODULE
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Submitted */}
      {step === 'submitted' && selectedModule && (
        <div className="cyber-card" style={{ textAlign: 'center' }}>
          <div className="cyber-card-body" style={{ padding: 'var(--gap-xl) var(--gap-lg)' }}>
            <div style={{
              width: 80,
              height: 80,
              margin: '0 auto var(--gap-lg)',
              borderRadius: '50%',
              border: '3px solid var(--neon-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--glow-green)',
              animation: 'pulse-scale 2s ease-in-out infinite',
            }}>
              <Check size={40} style={{ color: 'var(--neon-green)' }} />
            </div>

            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              color: 'var(--neon-green)',
              marginBottom: 'var(--gap-md)',
            }}>
              DEPLOYMENT QUEUED
            </div>

            <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--gap-lg)' }}>
              {selectedModule.name} is being deployed to the network
            </div>

            <div style={{
              padding: 'var(--gap-md)',
              background: 'var(--bg-void)',
              border: '1px solid rgba(0, 255, 255, 0.2)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              marginBottom: 'var(--gap-lg)',
            }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>JOB ID</div>
              <div style={{ color: 'var(--neon-cyan)', fontSize: '0.9rem' }}>{jobId}</div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 'var(--gap-md)',
              marginBottom: 'var(--gap-xl)',
            }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>MODULE</div>
                <div style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-cyan)', fontSize: '0.9rem' }}>{selectedModule.name}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>DURATION</div>
                <div style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-cyan)' }}>{config.hours}h</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>RESOURCES</div>
                <div style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-magenta)' }}>
                  {config.gpuCount > 0 ? `${config.gpuCount} GPU` : `${config.cpuCores} CPU`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>COST</div>
                <div style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-green)' }}>${calculateCost().toFixed(2)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--gap-md)', justifyContent: 'center' }}>
              <CyberButton onClick={() => navigate('/')}>
                VIEW DASHBOARD
              </CyberButton>
              <CyberButton variant="primary" onClick={handleNewJob}>
                DEPLOY ANOTHER
              </CyberButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
