import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Cpu, Zap, Lock, Star, Download, ExternalLink, Search, Code } from 'lucide-react';
import { CyberButton, StatsCard } from '../components';
import { useModule } from '../context/ModuleContext';
import { RHIZOS_MODULES, MODULE_CATEGORIES, getCategoryColor, getCategoryIcon, ModuleDefinition } from '../data/modules';

// Use ModuleDefinition as the Module type
type Module = ModuleDefinition;

export function Modules() {
  const navigate = useNavigate();
  const { setSelectedModule: setContextModule } = useModule();

  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingModule, setViewingModule] = useState<Module | null>(null);

  const handleDeployModule = (mod: Module) => {
    setContextModule({
      id: mod.id,
      name: mod.name,
      description: mod.description,
      category: mod.category,
      runtime: mod.runtime,
      author: mod.author,
      repo: mod.repo,
      requirements: mod.requirements,
      tools: mod.tools,
      chain_uri: mod.chain_uri,
    });
    setViewingModule(null);
    navigate('/submit');
  };

  useEffect(() => {
    const loadModules = async () => {
      setLoading(true);
      await new Promise(r => setTimeout(r, 300));
      setModules(RHIZOS_MODULES);
      setLoading(false);
    };
    loadModules();
  }, []);

  const filteredModules = modules.filter(m => {
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesSearch = searchQuery === '' ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tools.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Calculate category counts
  const categoryCounts = MODULE_CATEGORIES.map(cat => ({
    ...cat,
    count: cat.id === 'all' ? modules.length : modules.filter(m => m.category === cat.id).length,
  }));

  const stats = {
    total: modules.length,
    verified: modules.filter(m => m.verified).length,
    agents: modules.filter(m => m.category === 'ai-agents').length,
    totalDownloads: modules.reduce((acc, m) => acc + m.downloads, 0),
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  };

  const getRuntimeBadge = (runtime: string) => {
    const colors: Record<string, string> = {
      python: '#3776ab',
      node: '#68a063',
      rust: '#dea584',
      docker: '#2496ed',
    };
    return colors[runtime] || 'var(--text-muted)';
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 'var(--gap-xl)' }}>
        <h2 className="page-title">Modules</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 'var(--gap-sm)' }}>
          Deploy AI agents, trading bots, and DeFi tools on decentralized compute
        </p>
      </div>

      {/* Stats Row */}
      <div className="stats-grid" style={{ marginBottom: 'var(--gap-xl)' }}>
        <StatsCard
          label="Total Modules"
          value={stats.total}
          icon={Box}
          color="primary"
        />
        <StatsCard
          label="Verified"
          value={stats.verified}
          icon={Lock}
          color="success"
        />
        <StatsCard
          label="AI Agents"
          value={stats.agents}
          icon={getCategoryIcon('ai-agents')}
          color="secondary"
        />
        <StatsCard
          label="Total Downloads"
          value={formatNumber(stats.totalDownloads)}
          icon={Download}
          color="primary"
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
            placeholder="Search modules, tools..."
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
        <div style={{ display: 'flex', gap: 'var(--gap-xs)', flexWrap: 'wrap' }}>
          {categoryCounts.map(cat => {
            const Icon = getCategoryIcon(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: selectedCategory === cat.id
                    ? 'rgba(0, 255, 255, 0.15)'
                    : 'var(--bg-surface)',
                  border: `1px solid ${selectedCategory === cat.id
                    ? 'var(--primary)'
                    : 'rgba(0, 255, 255, 0.1)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: selectedCategory === cat.id
                    ? 'var(--primary)'
                    : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Icon size={11} />
                {cat.label}
                <span style={{
                  background: 'rgba(0, 255, 255, 0.2)',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '2px',
                  fontSize: '0.6rem',
                }}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modules Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div className="spin" style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(0, 255, 255, 0.1)',
            borderTop: '3px solid var(--primary)',
            borderRadius: '50%',
            margin: '0 auto 1rem',
          }} />
          Loading modules...
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: 'var(--gap-lg)',
        }}>
          {filteredModules.map(mod => {
            const Icon = getCategoryIcon(mod.category);
            return (
              <div
                key={mod.id}
                className="cyber-card hover-lift"
                style={{ cursor: 'pointer' }}
                onClick={() => setViewingModule(mod)}
              >
                <div className="cyber-card-body" style={{ padding: 'var(--gap-lg)' }}>
                  {/* Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 'var(--gap-md)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-sm)',
                        background: `${getCategoryColor(mod.category)}15`,
                        border: `1px solid ${getCategoryColor(mod.category)}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Icon size={18} style={{ color: getCategoryColor(mod.category) }} />
                      </div>
                      <div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--gap-xs)',
                        }}>
                          <span style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1rem',
                            color: 'var(--text-primary)',
                          }}>
                            {mod.name}
                          </span>
                          {mod.verified && (
                            <Lock size={12} style={{ color: 'var(--success)' }} />
                          )}
                        </div>
                        <span style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)',
                        }}>
                          v{mod.version} • {mod.author}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--gap-xs)' }}>
                      <span style={{
                        padding: '0.2rem 0.4rem',
                        background: `${getRuntimeBadge(mod.runtime)}20`,
                        border: `1px solid ${getRuntimeBadge(mod.runtime)}60`,
                        borderRadius: '2px',
                        fontSize: '0.6rem',
                        color: getRuntimeBadge(mod.runtime),
                        textTransform: 'uppercase',
                      }}>
                        {mod.runtime}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--gap-md)',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {mod.description}
                  </p>

                  {/* Tools */}
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    flexWrap: 'wrap',
                    marginBottom: 'var(--gap-md)',
                  }}>
                    {mod.tools.slice(0, 4).map(tool => (
                      <span
                        key={tool}
                        style={{
                          padding: '0.15rem 0.4rem',
                          background: 'var(--bg-elevated)',
                          border: '1px solid rgba(0, 255, 255, 0.1)',
                          borderRadius: '2px',
                          fontSize: '0.6rem',
                          color: 'var(--primary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {tool}()
                      </span>
                    ))}
                    {mod.tools.length > 4 && (
                      <span style={{
                        fontSize: '0.6rem',
                        color: 'var(--text-muted)',
                        padding: '0.15rem',
                      }}>
                        +{mod.tools.length - 4}
                      </span>
                    )}
                  </div>

                  {/* Requirements */}
                  <div style={{
                    display: 'flex',
                    gap: 'var(--gap-md)',
                    marginBottom: 'var(--gap-md)',
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                  }}>
                    {mod.requirements.min_gpus && (
                      <span>
                        <Zap size={10} style={{ verticalAlign: 'middle', marginRight: '3px', color: 'var(--primary-light)' }} />
                        {mod.requirements.min_gpus} GPU
                      </span>
                    )}
                    {mod.requirements.min_cpu_cores && (
                      <span>
                        <Cpu size={10} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
                        {mod.requirements.min_cpu_cores} cores
                      </span>
                    )}
                    {mod.requirements.min_memory_mb && (
                      <span>
                        {(mod.requirements.min_memory_mb / 1024).toFixed(0)}GB
                      </span>
                    )}
                    {mod.requirements.gpu_vram_mb && (
                      <span style={{ color: 'var(--primary-light)' }}>
                        {(mod.requirements.gpu_vram_mb / 1024).toFixed(0)}GB VRAM
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
                    <div style={{ display: 'flex', gap: 'var(--gap-md)', fontSize: '0.65rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        <Star size={10} style={{ verticalAlign: 'middle', marginRight: '3px', color: '#fbbf24' }} />
                        {formatNumber(mod.stars)}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        <Download size={10} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
                        {formatNumber(mod.downloads)}
                      </span>
                    </div>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      background: `${getCategoryColor(mod.category)}15`,
                      border: `1px solid ${getCategoryColor(mod.category)}30`,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.55rem',
                      color: getCategoryColor(mod.category),
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {mod.category.replace('-', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No Results */}
      {!loading && filteredModules.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem',
          color: 'var(--text-muted)',
        }}>
          <Box size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p>No modules found matching "{searchQuery}"</p>
        </div>
      )}

      {/* Module Detail Modal */}
      {viewingModule && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setViewingModule(null)}
        >
          <div
            className="cyber-card"
            style={{
              maxWidth: '650px',
              width: '90%',
              maxHeight: '85vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cyber-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
                {(() => {
                  const Icon = getCategoryIcon(viewingModule.category);
                  return <Icon size={18} style={{ color: getCategoryColor(viewingModule.category) }} />;
                })()}
                <span className="cyber-card-title">{viewingModule.name}</span>
              </div>
              <button
                onClick={() => setViewingModule(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>
            <div className="cyber-card-body">
              {/* Badges */}
              <div style={{
                display: 'flex',
                gap: 'var(--gap-xs)',
                marginBottom: 'var(--gap-md)',
                flexWrap: 'wrap',
              }}>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  background: `${getCategoryColor(viewingModule.category)}15`,
                  border: `1px solid ${getCategoryColor(viewingModule.category)}40`,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  color: getCategoryColor(viewingModule.category),
                  textTransform: 'uppercase',
                }}>
                  {viewingModule.category.replace('-', ' ')}
                </span>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  background: `${getRuntimeBadge(viewingModule.runtime)}20`,
                  border: `1px solid ${getRuntimeBadge(viewingModule.runtime)}60`,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  color: getRuntimeBadge(viewingModule.runtime),
                }}>
                  {viewingModule.runtime}
                </span>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid rgba(0, 255, 255, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                }}>
                  v{viewingModule.version}
                </span>
                {viewingModule.verified && (
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: 'rgba(0, 255, 65, 0.1)',
                    border: '1px solid rgba(0, 255, 65, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.7rem',
                    color: 'var(--success)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <Lock size={10} /> VERIFIED
                  </span>
                )}
              </div>

              {/* Description */}
              <p style={{
                color: 'var(--text-secondary)',
                marginBottom: 'var(--gap-lg)',
                lineHeight: 1.5,
              }}>
                {viewingModule.description}
              </p>

              {/* Chain URI */}
              <div style={{
                padding: 'var(--gap-md)',
                background: 'var(--bg-void)',
                border: '1px solid rgba(0, 255, 255, 0.2)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--gap-lg)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
              }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  CHAIN URI
                </div>
                <div style={{ color: 'var(--primary)' }}>
                  {viewingModule.chain_uri}
                </div>
              </div>

              {/* Available Tools */}
              <div style={{ marginBottom: 'var(--gap-lg)' }}>
                <div style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginBottom: 'var(--gap-sm)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>
                  Available Tools ({viewingModule.tools.length})
                </div>
                <div style={{ display: 'flex', gap: 'var(--gap-xs)', flexWrap: 'wrap' }}>
                  {viewingModule.tools.map(tool => (
                    <span
                      key={tool}
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: 'rgba(0, 255, 255, 0.1)',
                        border: '1px solid rgba(0, 255, 255, 0.2)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        color: 'var(--primary)',
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
                  Compute Requirements
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                  gap: 'var(--gap-sm)',
                }}>
                  {viewingModule.requirements.min_gpus && (
                    <div className="hardware-item">
                      <div className="hardware-label">GPUs</div>
                      <div className="hardware-value" style={{ color: 'var(--primary-light)' }}>{viewingModule.requirements.min_gpus}</div>
                    </div>
                  )}
                  {viewingModule.requirements.gpu_vram_mb && (
                    <div className="hardware-item">
                      <div className="hardware-label">VRAM</div>
                      <div className="hardware-value" style={{ color: 'var(--primary-light)' }}>{(viewingModule.requirements.gpu_vram_mb / 1024).toFixed(0)} GB</div>
                    </div>
                  )}
                  {viewingModule.requirements.min_cpu_cores && (
                    <div className="hardware-item">
                      <div className="hardware-label">CPU</div>
                      <div className="hardware-value">{viewingModule.requirements.min_cpu_cores} cores</div>
                    </div>
                  )}
                  {viewingModule.requirements.min_memory_mb && (
                    <div className="hardware-item">
                      <div className="hardware-label">RAM</div>
                      <div className="hardware-value">{(viewingModule.requirements.min_memory_mb / 1024).toFixed(0)} GB</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div style={{
                display: 'flex',
                gap: 'var(--gap-xl)',
                marginBottom: 'var(--gap-lg)',
                padding: 'var(--gap-md)',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stars</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: '#fbbf24' }}>
                    {formatNumber(viewingModule.stars)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Downloads</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--primary)' }}>
                    {formatNumber(viewingModule.downloads)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Author</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {viewingModule.author}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 'var(--gap-md)', flexWrap: 'wrap' }}>
                <CyberButton
                  variant="primary"
                  icon={Zap}
                  onClick={() => handleDeployModule(viewingModule)}
                >
                  DEPLOY ON COMPUTE
                </CyberButton>
                <CyberButton
                  icon={ExternalLink}
                  onClick={() => window.open(viewingModule.repo, '_blank')}
                >
                  VIEW SOURCE
                </CyberButton>
                {viewingModule.docs && (
                  <CyberButton
                    icon={Code}
                    onClick={() => window.open(viewingModule.docs, '_blank')}
                  >
                    DOCS
                  </CyberButton>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
