import { useState } from 'react';
import { Zap, Cpu, Clock, DollarSign, Send, ChevronRight, Check } from 'lucide-react';
import { CyberButton } from '../components';

type ComputeType = 'gpu' | 'cpu' | 'hybrid';
type Step = 'select' | 'configure' | 'confirm' | 'submitted';

interface JobConfig {
  type: ComputeType;
  hours: number;
  gpuCount: number;
  cpuCores: number;
  memoryGb: number;
}

const PRICING = {
  gpu_hour: 0.50,    // $0.50 per GPU hour
  cpu_hour: 0.02,    // $0.02 per CPU core hour
  memory_hour: 0.01, // $0.01 per GB hour
};

export function SubmitJob() {
  const [step, setStep] = useState<Step>('select');
  const [config, setConfig] = useState<JobConfig>({
    type: 'gpu',
    hours: 1,
    gpuCount: 1,
    cpuCores: 4,
    memoryGb: 16,
  });
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const calculateCost = () => {
    let cost = 0;
    if (config.type === 'gpu' || config.type === 'hybrid') {
      cost += config.gpuCount * config.hours * PRICING.gpu_hour;
    }
    if (config.type === 'cpu' || config.type === 'hybrid') {
      cost += config.cpuCores * config.hours * PRICING.cpu_hour;
    }
    cost += config.memoryGb * config.hours * PRICING.memory_hour;
    return cost;
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      // Create account if needed, add test credits, submit job
      const accountRes = await fetch('/api/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: '0xDemoUser' }),
      });
      const account = await accountRes.json();

      // Add test credits
      await fetch(`/api/v1/accounts/${account.account_id}/test-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: Math.ceil(calculateCost() * 100) + 1000 }),
      });

      // Submit job
      const jobRes = await fetch('/api/v1/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Account-Id': account.account_id,
        },
        body: JSON.stringify({
          requirements: {
            mcp_adapter: config.type === 'gpu' ? 'cuda' : 'docker',
            max_cost_cents: Math.ceil(calculateCost() * 100),
            currency: 'USDC',
            min_gpus: config.type !== 'cpu' ? config.gpuCount : 0,
            min_cpu_cores: config.cpuCores,
            min_memory_mb: config.memoryGb * 1024,
          },
          payload: {
            type: 'compute-session',
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

  const ComputeTypeCard = ({ type, icon: Icon, title, desc, selected }: {
    type: ComputeType;
    icon: typeof Zap;
    title: string;
    desc: string;
    selected: boolean;
  }) => (
    <div
      onClick={() => setConfig(c => ({ ...c, type }))}
      style={{
        flex: 1,
        padding: 'var(--gap-lg)',
        background: selected
          ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.15), rgba(255, 0, 255, 0.05))'
          : 'var(--bg-surface)',
        border: `2px solid ${selected ? 'var(--neon-cyan)' : 'rgba(0, 255, 255, 0.1)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: selected ? 'var(--glow-cyan)' : 'none',
      }}
    >
      <Icon
        size={32}
        style={{
          color: selected ? 'var(--neon-cyan)' : 'var(--text-muted)',
          marginBottom: 'var(--gap-md)',
        }}
      />
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1rem',
        color: selected ? 'var(--neon-cyan)' : 'var(--text-primary)',
        marginBottom: 'var(--gap-xs)',
      }}>
        {title}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {desc}
      </div>
    </div>
  );

  const Slider = ({ label, value, min, max, step: stepVal, unit, onChange }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (v: number) => void;
  }) => (
    <div style={{ marginBottom: 'var(--gap-lg)' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 'var(--gap-sm)',
      }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1rem',
          color: 'var(--neon-cyan)',
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
        style={{
          width: '100%',
          height: '8px',
          background: `linear-gradient(90deg, var(--neon-cyan) ${((value - min) / (max - min)) * 100}%, var(--bg-elevated) ${((value - min) / (max - min)) * 100}%)`,
          borderRadius: '4px',
          outline: 'none',
          cursor: 'pointer',
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

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Progress Steps */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 'var(--gap-xl)',
        marginBottom: 'var(--gap-xl)',
        padding: 'var(--gap-lg)',
      }}>
        {['select', 'configure', 'confirm', 'submitted'].map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: `2px solid ${step === s ? 'var(--neon-cyan)' : i < ['select', 'configure', 'confirm', 'submitted'].indexOf(step) ? 'var(--neon-green)' : 'var(--text-muted)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '0.875rem',
              color: step === s ? 'var(--neon-cyan)' : 'var(--text-muted)',
              background: i < ['select', 'configure', 'confirm', 'submitted'].indexOf(step) ? 'rgba(0, 255, 65, 0.2)' : 'transparent',
              boxShadow: step === s ? 'var(--glow-cyan)' : 'none',
            }}>
              {i < ['select', 'configure', 'confirm', 'submitted'].indexOf(step) ? <Check size={16} /> : i + 1}
            </div>
            <span style={{
              fontSize: '0.75rem',
              color: step === s ? 'var(--neon-cyan)' : 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              {s}
            </span>
            {i < 3 && <ChevronRight size={16} style={{ color: 'var(--text-muted)', marginLeft: 'var(--gap-sm)' }} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Compute Type */}
      {step === 'select' && (
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">SELECT COMPUTE TYPE</span>
          </div>
          <div className="cyber-card-body">
            <div style={{ display: 'flex', gap: 'var(--gap-lg)', marginBottom: 'var(--gap-xl)' }}>
              <ComputeTypeCard
                type="gpu"
                icon={Zap}
                title="GPU COMPUTE"
                desc="CUDA-accelerated processing for AI/ML, rendering, simulations"
                selected={config.type === 'gpu'}
              />
              <ComputeTypeCard
                type="cpu"
                icon={Cpu}
                title="CPU COMPUTE"
                desc="General processing, compilation, data processing"
                selected={config.type === 'cpu'}
              />
              <ComputeTypeCard
                type="hybrid"
                icon={Zap}
                title="HYBRID"
                desc="Combined GPU + CPU for complex workloads"
                selected={config.type === 'hybrid'}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <CyberButton variant="primary" onClick={() => setStep('configure')}>
                CONTINUE <ChevronRight size={14} style={{ marginLeft: '0.5rem' }} />
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Configure Resources */}
      {step === 'configure' && (
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">CONFIGURE RESOURCES</span>
          </div>
          <div className="cyber-card-body">
            <Slider
              label="Duration"
              value={config.hours}
              min={1}
              max={24}
              step={1}
              unit="hours"
              onChange={(v) => setConfig(c => ({ ...c, hours: v }))}
            />

            {(config.type === 'gpu' || config.type === 'hybrid') && (
              <Slider
                label="GPU Count"
                value={config.gpuCount}
                min={1}
                max={8}
                step={1}
                unit="GPUs"
                onChange={(v) => setConfig(c => ({ ...c, gpuCount: v }))}
              />
            )}

            <Slider
              label="CPU Cores"
              value={config.cpuCores}
              min={1}
              max={64}
              step={1}
              unit="cores"
              onChange={(v) => setConfig(c => ({ ...c, cpuCores: v }))}
            />

            <Slider
              label="Memory"
              value={config.memoryGb}
              min={4}
              max={256}
              step={4}
              unit="GB"
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
                <span style={{ color: 'var(--text-secondary)' }}>ESTIMATED COST</span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.5rem',
                  color: 'var(--neon-green)',
                  textShadow: 'var(--glow-green)',
                }}>
                  ${calculateCost().toFixed(2)} USDC
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--gap-xl)' }}>
              <CyberButton onClick={() => setStep('select')}>
                BACK
              </CyberButton>
              <CyberButton variant="primary" onClick={() => setStep('confirm')}>
                REVIEW ORDER <ChevronRight size={14} style={{ marginLeft: '0.5rem' }} />
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && (
        <div className="cyber-card">
          <div className="cyber-card-header">
            <span className="cyber-card-title">CONFIRM ORDER</span>
          </div>
          <div className="cyber-card-body">
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--gap-md)',
              marginBottom: 'var(--gap-xl)',
            }}>
              <div className="hardware-item">
                <div className="hardware-label">COMPUTE TYPE</div>
                <div className="hardware-value">{config.type.toUpperCase()}</div>
              </div>
              <div className="hardware-item">
                <div className="hardware-label">DURATION</div>
                <div className="hardware-value">{config.hours} HOURS</div>
              </div>
              {(config.type === 'gpu' || config.type === 'hybrid') && (
                <div className="hardware-item">
                  <div className="hardware-label">GPUs</div>
                  <div className="hardware-value">{config.gpuCount}</div>
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
                <div className="hardware-label">TOTAL COST</div>
                <div className="hardware-value" style={{ color: 'var(--neon-green)' }}>
                  ${calculateCost().toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{
              padding: 'var(--gap-md)',
              background: 'rgba(255, 0, 255, 0.05)',
              border: '1px solid rgba(255, 0, 255, 0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--gap-xl)',
            }}>
              <strong style={{ color: 'var(--neon-magenta)' }}>NOTE:</strong> Your compute session will start
              as soon as a matching node is available. You'll receive SSH/API access credentials upon assignment.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <CyberButton onClick={() => setStep('configure')}>
                BACK
              </CyberButton>
              <CyberButton variant="success" icon={Send} onClick={handleSubmit} loading={submitting}>
                SUBMIT ORDER
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Submitted */}
      {step === 'submitted' && (
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
              ORDER SUBMITTED
            </div>

            <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--gap-lg)' }}>
              Your compute request is in the queue
            </div>

            <div style={{
              padding: 'var(--gap-md)',
              background: 'var(--bg-void)',
              border: '1px solid rgba(0, 255, 255, 0.2)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              marginBottom: 'var(--gap-xl)',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>JOB ID</div>
              <div style={{ color: 'var(--neon-cyan)' }}>{jobId}</div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 'var(--gap-md)',
              marginBottom: 'var(--gap-xl)',
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DURATION</div>
                <div style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-cyan)' }}>{config.hours}h</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RESOURCES</div>
                <div style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-magenta)' }}>
                  {config.type === 'gpu' ? `${config.gpuCount} GPU` : `${config.cpuCores} CPU`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>COST</div>
                <div style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-green)' }}>${calculateCost().toFixed(2)}</div>
              </div>
            </div>

            <CyberButton onClick={() => { setStep('select'); setJobId(null); }}>
              SUBMIT ANOTHER
            </CyberButton>
          </div>
        </div>
      )}
    </div>
  );
}
