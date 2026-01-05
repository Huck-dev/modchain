import { useState, useEffect } from 'react';
import { Box, Cpu, Zap, Globe, Lock, Star, Download, ExternalLink, Search, Filter } from 'lucide-react';
import { GlitchText, CyberButton, StatsCard } from '../components';

interface Module {
  id: string;
  name: string;
  description: string;
  version: string;
  category: 'compute' | 'ai' | 'storage' | 'network' | 'utility';
  runtime: 'docker' | 'wasm' | 'binary' | 'python';
  author: string;
  verified: boolean;
  stars: number;
  downloads: number;
  requirements: {
    min_gpus?: number;
    min_cpu_cores?: number;
    min_memory_mb?: number;
  };
  tools: string[];
  chain_uri?: string;
}

// Mock modules data - would come from MCP registrar in production
const MOCK_MODULES: Module[] = [
  {
    id: 'mod-llama-inference',
    name: 'LLaMA Inference',
    description: 'Run LLaMA 2/3 models for text generation with CUDA acceleration',
    version: '2.1.0',
    category: 'ai',
    runtime: 'docker',
    author: 'modchain-core',
    verified: true,
    stars: 1247,
    downloads: 45200,
    requirements: { min_gpus: 1, min_memory_mb: 16384 },
    tools: ['generate', 'chat', 'embed'],
    chain_uri: 'chain://mod-llama-inference',
  },
  {
    id: 'mod-stable-diffusion',
    name: 'Stable Diffusion XL',
    description: 'Generate high-quality images from text prompts using SDXL',
    version: '1.5.2',
    category: 'ai',
    runtime: 'docker',
    author: 'modchain-core',
    verified: true,
    stars: 2891,
    downloads: 89300,
    requirements: { min_gpus: 1, min_memory_mb: 12288 },
    tools: ['txt2img', 'img2img', 'inpaint', 'upscale'],
    chain_uri: 'chain://mod-stable-diffusion',
  },
  {
    id: 'mod-whisper',
    name: 'Whisper Transcription',
    description: 'Audio transcription and translation with OpenAI Whisper',
    version: '3.0.1',
    category: 'ai',
    runtime: 'docker',
    author: 'modchain-core',
    verified: true,
    stars: 892,
    downloads: 23400,
    requirements: { min_gpus: 1, min_memory_mb: 8192 },
    tools: ['transcribe', 'translate', 'detect_language'],
    chain_uri: 'chain://mod-whisper',
  },
  {
    id: 'mod-blender-render',
    name: 'Blender GPU Render',
    description: 'Distributed Blender rendering with Cycles/EEVEE',
    version: '4.0.0',
    category: 'compute',
    runtime: 'docker',
    author: 'render-labs',
    verified: true,
    stars: 567,
    downloads: 12100,
    requirements: { min_gpus: 1, min_memory_mb: 16384 },
    tools: ['render_frame', 'render_animation', 'preview'],
    chain_uri: 'chain://mod-blender-render',
  },
  {
    id: 'mod-ffmpeg',
    name: 'FFmpeg Transcode',
    description: 'GPU-accelerated video transcoding and processing',
    version: '6.1.0',
    category: 'compute',
    runtime: 'docker',
    author: 'media-tools',
    verified: true,
    stars: 423,
    downloads: 8900,
    requirements: { min_gpus: 1, min_cpu_cores: 4 },
    tools: ['transcode', 'extract_audio', 'create_thumbnail', 'concat'],
    chain_uri: 'chain://mod-ffmpeg',
  },
  {
    id: 'mod-jupyter',
    name: 'Jupyter Notebook',
    description: 'Interactive Python notebooks with GPU support',
    version: '7.0.2',
    category: 'utility',
    runtime: 'docker',
    author: 'modchain-core',
    verified: true,
    stars: 1102,
    downloads: 34500,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['create_notebook', 'execute_cell', 'export_pdf'],
    chain_uri: 'chain://mod-jupyter',
  },
  {
    id: 'mod-code-llama',
    name: 'Code LLaMA',
    description: 'Code generation and completion with Code LLaMA 34B',
    version: '1.2.0',
    category: 'ai',
    runtime: 'docker',
    author: 'modchain-core',
    verified: true,
    stars: 1876,
    downloads: 56700,
    requirements: { min_gpus: 2, min_memory_mb: 48000 },
    tools: ['complete', 'explain', 'refactor', 'generate_tests'],
    chain_uri: 'chain://mod-code-llama',
  },
  {
    id: 'mod-ipfs-pin',
    name: 'IPFS Pinning',
    description: 'Distributed IPFS pinning and content delivery',
    version: '0.9.0',
    category: 'storage',
    runtime: 'docker',
    author: 'storage-dao',
    verified: false,
    stars: 234,
    downloads: 5600,
    requirements: { min_cpu_cores: 2, min_memory_mb: 2048 },
    tools: ['pin', 'unpin', 'get', 'stat'],
    chain_uri: 'chain://mod-ipfs-pin',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'ALL', icon: Box },
  { id: 'ai', label: 'AI/ML', icon: Zap },
  { id: 'compute', label: 'COMPUTE', icon: Cpu },
  { id: 'storage', label: 'STORAGE', icon: Globe },
  { id: 'utility', label: 'UTILITY', icon: Box },
];

export function Modules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);

  useEffect(() => {
    // Simulate loading from MCP registrar
    const loadModules = async () => {
      setLoading(true);
      // In production: fetch from /api/v1/modules or mcp-registrar
      await new Promise(r => setTimeout(r, 800));
      setModules(MOCK_MODULES);
      setLoading(false);
    };
    loadModules();
  }, []);

  const filteredModules = modules.filter(m => {
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesSearch = searchQuery === '' ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const stats = {
    total: modules.length,
    verified: modules.filter(m => m.verified).length,
    aiModules: modules.filter(m => m.category === 'ai').length,
    totalDownloads: modules.reduce((acc, m) => acc + m.downloads, 0),
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ai': return 'var(--neon-cyan)';
      case 'compute': return 'var(--neon-magenta)';
      case 'storage': return 'var(--neon-green)';
      case 'network': return 'var(--neon-yellow)';
      default: return 'var(--text-secondary)';
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 'var(--gap-xl)' }}>
        <GlitchText text="NETWORK MODULES" as="h2" className="glitch-hover" />
        <p style={{ color: 'var(--text-muted)', marginTop: 'var(--gap-sm)' }}>
          Browse and deploy MCP modules from the decentralized registry
        </p>
      </div>

      {/* Stats Row */}
      <div className="stats-grid" style={{ marginBottom: 'var(--gap-xl)' }}>
        <StatsCard
          label="Total Modules"
          value={stats.total}
          icon={Box}
          color="cyan"
        />
        <StatsCard
          label="Verified"
          value={stats.verified}
          icon={Lock}
          color="green"
        />
        <StatsCard
          label="AI/ML Modules"
          value={stats.aiModules}
          icon={Zap}
          color="magenta"
        />
        <StatsCard
          label="Total Downloads"
          value={formatNumber(stats.totalDownloads)}
          icon={Download}
          color="cyan"
        />
      </div>

      {/* Search and Filter */}
      <div style={{
        display: 'flex',
        gap: 'var(--gap-md)',
        marginBottom: 'var(--gap-lg)',
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{
          flex: 1,
          minWidth: '250px',
          position: 'relative',
        }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 0.75rem 0.75rem 2.5rem',
              background: 'var(--bg-surface)',
              border: '1px solid rgba(0, 255, 255, 0.2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Category Filter */}
        <div style={{ display: 'flex', gap: 'var(--gap-xs)' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '0.5rem 1rem',
                background: selectedCategory === cat.id
                  ? 'rgba(0, 255, 255, 0.15)'
                  : 'var(--bg-surface)',
                border: `1px solid ${selectedCategory === cat.id
                  ? 'var(--neon-cyan)'
                  : 'rgba(0, 255, 255, 0.1)'}`,
                borderRadius: 'var(--radius-sm)',
                color: selectedCategory === cat.id
                  ? 'var(--neon-cyan)'
                  : 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <cat.icon size={12} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Modules Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div className="spin" style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(0, 255, 255, 0.1)',
            borderTop: '3px solid var(--neon-cyan)',
            borderRadius: '50%',
            margin: '0 auto 1rem',
          }} />
          Loading modules from registry...
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: 'var(--gap-lg)',
        }}>
          {filteredModules.map(mod => (
            <div
              key={mod.id}
              className="cyber-card hover-lift"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedModule(mod)}
            >
              <div className="cyber-card-body" style={{ padding: 'var(--gap-lg)' }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 'var(--gap-md)',
                }}>
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--gap-sm)',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1rem',
                        color: 'var(--text-primary)',
                      }}>
                        {mod.name}
                      </span>
                      {mod.verified && (
                        <Lock size={12} style={{ color: 'var(--neon-green)' }} />
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                    }}>
                      v{mod.version} by {mod.author}
                    </span>
                  </div>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: `${getCategoryColor(mod.category)}15`,
                    border: `1px solid ${getCategoryColor(mod.category)}40`,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.65rem',
                    color: getCategoryColor(mod.category),
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {mod.category}
                  </span>
                </div>

                {/* Description */}
                <p style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--gap-md)',
                  lineHeight: 1.4,
                }}>
                  {mod.description}
                </p>

                {/* Tools */}
                <div style={{
                  display: 'flex',
                  gap: 'var(--gap-xs)',
                  flexWrap: 'wrap',
                  marginBottom: 'var(--gap-md)',
                }}>
                  {mod.tools.slice(0, 4).map(tool => (
                    <span
                      key={tool}
                      style={{
                        padding: '0.2rem 0.5rem',
                        background: 'var(--bg-elevated)',
                        border: '1px solid rgba(0, 255, 255, 0.1)',
                        borderRadius: '2px',
                        fontSize: '0.65rem',
                        color: 'var(--neon-cyan)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {tool}
                    </span>
                  ))}
                  {mod.tools.length > 4 && (
                    <span style={{
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      padding: '0.2rem',
                    }}>
                      +{mod.tools.length - 4} more
                    </span>
                  )}
                </div>

                {/* Requirements */}
                <div style={{
                  display: 'flex',
                  gap: 'var(--gap-md)',
                  marginBottom: 'var(--gap-md)',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                }}>
                  {mod.requirements.min_gpus && (
                    <span>
                      <Zap size={10} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      {mod.requirements.min_gpus} GPU
                    </span>
                  )}
                  {mod.requirements.min_cpu_cores && (
                    <span>
                      <Cpu size={10} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      {mod.requirements.min_cpu_cores} cores
                    </span>
                  )}
                  {mod.requirements.min_memory_mb && (
                    <span>
                      {(mod.requirements.min_memory_mb / 1024).toFixed(0)}GB RAM
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 'var(--gap-sm)',
                  borderTop: '1px solid rgba(0, 255, 255, 0.1)',
                }}>
                  <div style={{ display: 'flex', gap: 'var(--gap-md)', fontSize: '0.7rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      <Star size={10} style={{ verticalAlign: 'middle', marginRight: '4px', color: 'var(--neon-yellow)' }} />
                      {formatNumber(mod.stars)}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      <Download size={10} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      {formatNumber(mod.downloads)}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.65rem',
                    color: 'var(--neon-cyan)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {mod.runtime}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Module Detail Modal */}
      {selectedModule && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setSelectedModule(null)}
        >
          <div
            className="cyber-card"
            style={{
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cyber-card-header">
              <span className="cyber-card-title">{selectedModule.name}</span>
              <button
                onClick={() => setSelectedModule(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                }}
              >
                &times;
              </button>
            </div>
            <div className="cyber-card-body">
              <div style={{
                display: 'flex',
                gap: 'var(--gap-sm)',
                marginBottom: 'var(--gap-md)',
              }}>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  background: `${getCategoryColor(selectedModule.category)}15`,
                  border: `1px solid ${getCategoryColor(selectedModule.category)}40`,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  color: getCategoryColor(selectedModule.category),
                }}>
                  {selectedModule.category.toUpperCase()}
                </span>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid rgba(0, 255, 255, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                }}>
                  v{selectedModule.version}
                </span>
                {selectedModule.verified && (
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: 'rgba(0, 255, 65, 0.1)',
                    border: '1px solid rgba(0, 255, 65, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.7rem',
                    color: 'var(--neon-green)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <Lock size={10} /> VERIFIED
                  </span>
                )}
              </div>

              <p style={{
                color: 'var(--text-secondary)',
                marginBottom: 'var(--gap-lg)',
                lineHeight: 1.5,
              }}>
                {selectedModule.description}
              </p>

              {/* Chain URI */}
              {selectedModule.chain_uri && (
                <div style={{
                  padding: 'var(--gap-md)',
                  background: 'var(--bg-void)',
                  border: '1px solid rgba(0, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 'var(--gap-lg)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    CHAIN URI
                  </div>
                  <div style={{ color: 'var(--neon-cyan)' }}>
                    {selectedModule.chain_uri}
                  </div>
                </div>
              )}

              {/* Available Tools */}
              <div style={{ marginBottom: 'var(--gap-lg)' }}>
                <div style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginBottom: 'var(--gap-sm)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>
                  Available Tools
                </div>
                <div style={{ display: 'flex', gap: 'var(--gap-xs)', flexWrap: 'wrap' }}>
                  {selectedModule.tools.map(tool => (
                    <span
                      key={tool}
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: 'rgba(0, 255, 255, 0.1)',
                        border: '1px solid rgba(0, 255, 255, 0.2)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        color: 'var(--neon-cyan)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {tool}()
                    </span>
                  ))}
                </div>
              </div>

              {/* Requirements */}
              <div style={{ marginBottom: 'var(--gap-lg)' }}>
                <div style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginBottom: 'var(--gap-sm)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>
                  Requirements
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 'var(--gap-sm)',
                }}>
                  {selectedModule.requirements.min_gpus && (
                    <div className="hardware-item">
                      <div className="hardware-label">MIN GPUs</div>
                      <div className="hardware-value">{selectedModule.requirements.min_gpus}</div>
                    </div>
                  )}
                  {selectedModule.requirements.min_cpu_cores && (
                    <div className="hardware-item">
                      <div className="hardware-label">MIN CPU</div>
                      <div className="hardware-value">{selectedModule.requirements.min_cpu_cores} cores</div>
                    </div>
                  )}
                  {selectedModule.requirements.min_memory_mb && (
                    <div className="hardware-item">
                      <div className="hardware-label">MIN RAM</div>
                      <div className="hardware-value">{(selectedModule.requirements.min_memory_mb / 1024).toFixed(0)} GB</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 'var(--gap-md)' }}>
                <CyberButton
                  variant="primary"
                  icon={Zap}
                  onClick={() => {
                    setSelectedModule(null);
                    window.location.hash = '/submit';
                  }}
                >
                  USE WITH COMPUTE
                </CyberButton>
                <CyberButton icon={ExternalLink}>
                  VIEW DOCS
                </CyberButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
