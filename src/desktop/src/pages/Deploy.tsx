import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Cpu, Clock, Play, Plus, Box, Bot, TrendingUp, Coins, Brain, Rocket, Star, ChevronRight, Server, Activity } from 'lucide-react';
import { CyberButton, StatsCard } from '../components';
import { useModule } from '../context/ModuleContext';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: typeof Bot;
  modules: string[];
  gpu: string;
  estimatedCost: number;
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
    gpu: 'RTX 4090',
    estimatedCost: 0.74,
    popular: true,
  },
  {
    id: 'stable-diffusion',
    name: 'Stable Diffusion',
    description: 'SDXL image generation with ComfyUI workflow',
    category: 'AI',
    icon: Zap,
    modules: ['sdxl', 'comfyui'],
    gpu: 'RTX 4090',
    estimatedCost: 0.74,
    popular: true,
  },
  {
    id: 'trading-bot',
    name: 'Trading Bot',
    description: 'Hummingbot with Hyperliquid integration',
    category: 'Trading',
    icon: TrendingUp,
    modules: ['hummingbot', 'hyperliquid'],
    gpu: 'CPU Only',
    estimatedCost: 0.12,
  },
  {
    id: 'ai-agent',
    name: 'AI Agent (Eliza)',
    description: 'Autonomous agent for Twitter, Discord, Telegram',
    category: 'Agents',
    icon: Bot,
    modules: ['eliza', 'memory'],
    gpu: 'CPU Only',
    estimatedCost: 0.08,
    new: true,
  },
  {
    id: 'hedge-fund',
    name: 'AI Hedge Fund',
    description: '15 investment agents analyzing markets',
    category: 'Trading',
    icon: Coins,
    modules: ['hedgy', 'market-data'],
    gpu: 'CPU Only',
    estimatedCost: 0.15,
    new: true,
  },
  {
    id: 'jupyter-gpu',
    name: 'Jupyter + GPU',
    description: 'Interactive notebooks with CUDA support',
    category: 'Dev',
    icon: Server,
    modules: ['jupyter', 'pytorch'],
    gpu: 'RTX 3090',
    estimatedCost: 0.44,
  },
];

const GPU_OPTIONS = [
  { id: 'cpu', name: 'CPU Only', price: 0.02, cores: 8, ram: 32 },
  { id: 'rtx3090', name: 'RTX 3090', price: 0.44, vram: 24, cores: 8, ram: 32 },
  { id: 'rtx4090', name: 'RTX 4090', price: 0.74, vram: 24, cores: 12, ram: 48 },
  { id: 'a100-40', name: 'A100 40GB', price: 1.89, vram: 40, cores: 16, ram: 64 },
  { id: 'a100-80', name: 'A100 80GB', price: 2.49, vram: 80, cores: 16, ram: 128 },
  { id: 'h100', name: 'H100 80GB', price: 3.99, vram: 80, cores: 24, ram: 192 },
];

export function Deploy() {
  const navigate = useNavigate();
  const [selectedGpu, setSelectedGpu] = useState<string | null>(null);
  const [deploying, setDeploying] = useState<string | null>(null);

  const handleQuickDeploy = async (template: Template) => {
    setDeploying(template.id);
    // Simulate deployment
    await new Promise(r => setTimeout(r, 1500));
    setDeploying(null);
    navigate('/pods');
  };

  const handleSelectGpu = (gpuId: string) => {
    setSelectedGpu(gpuId);
    navigate('/flow');
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
        <StatsCard label="Available GPUs" value="2,847" icon={Cpu} color="cyan" />
        <StatsCard label="Active Pods" value="12" icon={Activity} color="green" />
        <StatsCard label="Templates" value={TEMPLATES.length} icon={Box} color="magenta" />
        <StatsCard label="Avg Deploy" value="< 30s" icon={Rocket} color="cyan" />
      </div>

      {/* GPU Selection - RunPod Style */}
      <div className="cyber-card" style={{ marginBottom: 'var(--gap-xl)' }}>
        <div className="cyber-card-header">
          <span className="cyber-card-title">SELECT GPU</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Choose your compute and build a workflow
          </span>
        </div>
        <div className="cyber-card-body">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 'var(--gap-md)',
          }}>
            {GPU_OPTIONS.map(gpu => (
              <div
                key={gpu.id}
                onClick={() => handleSelectGpu(gpu.id)}
                style={{
                  padding: 'var(--gap-lg)',
                  background: selectedGpu === gpu.id
                    ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.15), rgba(255, 0, 255, 0.05))'
                    : 'var(--bg-elevated)',
                  border: `2px solid ${selectedGpu === gpu.id ? 'var(--primary)' : 'rgba(0, 255, 255, 0.1)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                }}
                className="hover-lift"
              >
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1rem',
                  color: gpu.id === 'cpu' ? 'var(--text-primary)' : 'var(--primary-light)',
                  marginBottom: 'var(--gap-sm)',
                }}>
                  {gpu.name}
                </div>
                {gpu.vram && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {gpu.vram}GB VRAM
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 'var(--gap-sm)' }}>
                  {gpu.cores} vCPU • {gpu.ram}GB RAM
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  color: 'var(--success)',
                }}>
                  ${gpu.price}<span style={{ fontSize: '0.7rem', opacity: 0.7 }}>/hr</span>
                </div>
              </div>
            ))}
          </div>
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
            return (
              <div
                key={template.id}
                className="cyber-card hover-lift"
                style={{ cursor: 'pointer' }}
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
                        background: 'rgba(0, 255, 255, 0.1)',
                        border: '1px solid rgba(0, 255, 255, 0.2)',
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
                          {template.category} • {template.gpu}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1rem',
                      color: 'var(--success)',
                    }}>
                      ${template.estimatedCost}<span style={{ fontSize: '0.6rem', opacity: 0.7 }}>/hr</span>
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
                          border: '1px solid rgba(0, 255, 255, 0.15)',
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
                  >
                    {deploying === template.id ? 'DEPLOYING...' : 'DEPLOY NOW'}
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
