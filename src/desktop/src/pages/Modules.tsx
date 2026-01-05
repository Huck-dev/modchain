import { useState, useEffect } from 'react';
import { Box, Cpu, Zap, Globe, Lock, Star, Download, ExternalLink, Search, Bot, TrendingUp, Coins, Database, Code, Brain } from 'lucide-react';
import { GlitchText, CyberButton, StatsCard } from '../components';

interface Module {
  id: string;
  name: string;
  description: string;
  version: string;
  category: 'ai-agents' | 'trading' | 'defi' | 'infrastructure' | 'data' | 'models';
  runtime: 'docker' | 'python' | 'node' | 'rust';
  author: string;
  repo: string;
  verified: boolean;
  stars: number;
  downloads: number;
  requirements: {
    min_gpus?: number;
    min_cpu_cores?: number;
    min_memory_mb?: number;
    gpu_vram_mb?: number;
  };
  tools: string[];
  chain_uri: string;
  docs?: string;
}

// Modules from commune-ai ecosystem
const COMMUNE_MODULES: Module[] = [
  // AI Agents
  {
    id: 'commune-eliza',
    name: 'Eliza',
    description: 'Conversational AI agent for Twitter, Discord, and Telegram. Multi-platform autonomous agent with memory and document ingestion.',
    version: '1.0.0',
    category: 'ai-agents',
    runtime: 'node',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/eliza',
    verified: true,
    stars: 2847,
    downloads: 45200,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['chat', 'post_tweet', 'send_discord', 'send_telegram', 'remember', 'search_docs'],
    chain_uri: 'chain://commune-eliza',
    docs: 'https://elizaos.github.io/eliza/',
  },
  {
    id: 'commune-sentience',
    name: 'Sentience',
    description: 'Build verifiable AI agents with on-chain attestations. TEE-based execution with cryptographic proof of inference.',
    version: '0.9.0',
    category: 'ai-agents',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/sentience',
    verified: true,
    stars: 1523,
    downloads: 23400,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['verified_inference', 'verify_signature', 'get_attestation', 'submit_proof'],
    chain_uri: 'chain://commune-sentience',
  },
  {
    id: 'commune-hedgy',
    name: 'Hedgy',
    description: 'AI Hedge Fund with 15 specialized agents including Warren Buffett, Charlie Munger, and Cathie Wood investment styles.',
    version: '1.2.0',
    category: 'ai-agents',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/hedgy',
    verified: true,
    stars: 892,
    downloads: 12100,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['analyze_ticker', 'backtest', 'get_signals', 'portfolio_optimize', 'risk_assess'],
    chain_uri: 'chain://commune-hedgy',
  },
  {
    id: 'commune-swarms',
    name: 'Swarms',
    description: 'Multi-agent orchestration system for coordinating autonomous AI agents working together.',
    version: '2.0.0',
    category: 'ai-agents',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/modules',
    verified: true,
    stars: 567,
    downloads: 8900,
    requirements: { min_cpu_cores: 8, min_memory_mb: 16384 },
    tools: ['spawn_agent', 'coordinate', 'distribute_task', 'aggregate_results'],
    chain_uri: 'chain://commune-swarms',
  },
  {
    id: 'commune-godmode',
    name: 'GodMode',
    description: 'Fully autonomous agent with unrestricted capabilities for complex multi-step tasks.',
    version: '0.5.0',
    category: 'ai-agents',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/modules',
    verified: false,
    stars: 423,
    downloads: 5600,
    requirements: { min_gpus: 1, min_memory_mb: 32768, gpu_vram_mb: 24000 },
    tools: ['execute', 'plan', 'browse', 'code', 'shell'],
    chain_uri: 'chain://commune-godmode',
  },

  // Trading Bots
  {
    id: 'commune-hummingbot',
    name: 'Hummingbot',
    description: 'High-frequency crypto trading bot framework. Deploy across 140+ exchanges with $34B+ annual volume.',
    version: '2.1.0',
    category: 'trading',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/hummingbot',
    verified: true,
    stars: 7234,
    downloads: 156000,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['create_strategy', 'start_bot', 'stop_bot', 'get_orders', 'market_make', 'arbitrage'],
    chain_uri: 'chain://commune-hummingbot',
    docs: 'https://hummingbot.org/docs/',
  },
  {
    id: 'commune-nautilus',
    name: 'Nautilus Trader',
    description: 'High-performance algorithmic trading platform with event-driven backtesting engine.',
    version: '1.8.0',
    category: 'trading',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/nautilus_trader',
    verified: true,
    stars: 1876,
    downloads: 34500,
    requirements: { min_cpu_cores: 8, min_memory_mb: 16384 },
    tools: ['backtest', 'live_trade', 'analyze', 'optimize_strategy', 'risk_manage'],
    chain_uri: 'chain://commune-nautilus',
  },
  {
    id: 'commune-hyperliquid',
    name: 'Hyperliquid SDK',
    description: 'SDK for Hyperliquid perpetuals DEX. High-speed trading with on-chain settlement.',
    version: '1.0.0',
    category: 'trading',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/hyperliquid',
    verified: true,
    stars: 234,
    downloads: 8700,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['place_order', 'cancel_order', 'get_positions', 'get_funding', 'leverage_set'],
    chain_uri: 'chain://commune-hyperliquid',
  },
  {
    id: 'commune-raydium',
    name: 'Raydium Swap',
    description: 'Raydium AMM integration for Solana. Swap tokens via AMM v4 and CPMM pools.',
    version: '0.8.0',
    category: 'trading',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/raydium',
    verified: true,
    stars: 189,
    downloads: 4500,
    requirements: { min_cpu_cores: 2, min_memory_mb: 2048 },
    tools: ['swap', 'get_quote', 'add_liquidity', 'remove_liquidity', 'get_pools'],
    chain_uri: 'chain://commune-raydium',
  },

  // DeFi
  {
    id: 'commune-uniswap',
    name: 'Uniswap',
    description: 'Uniswap V3 integration for Ethereum DEX trading with concentrated liquidity.',
    version: '3.0.0',
    category: 'defi',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/modules',
    verified: true,
    stars: 456,
    downloads: 23000,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['swap', 'add_liquidity', 'remove_liquidity', 'get_price', 'get_pool_info'],
    chain_uri: 'chain://commune-uniswap',
  },
  {
    id: 'commune-bridge',
    name: 'Cross-Chain Bridge',
    description: 'Cross-chain asset bridge for moving tokens between Ethereum, Solana, and other chains.',
    version: '1.0.0',
    category: 'defi',
    runtime: 'rust',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/modules',
    verified: true,
    stars: 345,
    downloads: 12000,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['bridge_tokens', 'get_quote', 'track_transfer', 'verify_receipt'],
    chain_uri: 'chain://commune-bridge',
  },
  {
    id: 'commune-lend',
    name: 'Lending Protocol',
    description: 'DeFi lending and borrowing protocol integration. Supply assets, borrow, and earn yield.',
    version: '1.5.0',
    category: 'defi',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/modules',
    verified: true,
    stars: 234,
    downloads: 8900,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['supply', 'borrow', 'repay', 'withdraw', 'get_rates', 'get_health'],
    chain_uri: 'chain://commune-lend',
  },
  {
    id: 'commune-polymarket',
    name: 'Polymarket',
    description: 'Prediction market integration. Trade on real-world event outcomes.',
    version: '1.0.0',
    category: 'defi',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/modules',
    verified: true,
    stars: 567,
    downloads: 15600,
    requirements: { min_cpu_cores: 2, min_memory_mb: 2048 },
    tools: ['get_markets', 'place_bet', 'get_positions', 'cash_out', 'get_odds'],
    chain_uri: 'chain://commune-polymarket',
  },

  // Infrastructure
  {
    id: 'commune-ipfs',
    name: 'IPFS Storage',
    description: 'Distributed IPFS storage with pinning, retrieval, and content addressing.',
    version: '2.0.0',
    category: 'infrastructure',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/modules',
    verified: true,
    stars: 345,
    downloads: 34000,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['pin', 'unpin', 'get', 'add', 'stat', 'ls'],
    chain_uri: 'chain://commune-ipfs',
  },
  {
    id: 'commune-supabase',
    name: 'Supabase',
    description: 'Supabase backend integration for database, auth, and realtime subscriptions.',
    version: '1.2.0',
    category: 'infrastructure',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/modules',
    verified: true,
    stars: 234,
    downloads: 12000,
    requirements: { min_cpu_cores: 1, min_memory_mb: 1024 },
    tools: ['query', 'insert', 'update', 'delete', 'subscribe', 'auth'],
    chain_uri: 'chain://commune-supabase',
  },
  {
    id: 'commune-docker',
    name: 'Docker Runtime',
    description: 'Docker container orchestration for running isolated compute workloads.',
    version: '1.0.0',
    category: 'infrastructure',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/modules',
    verified: true,
    stars: 189,
    downloads: 45000,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['run', 'stop', 'logs', 'exec', 'build', 'push'],
    chain_uri: 'chain://commune-docker',
  },

  // Data & Scraping
  {
    id: 'commune-scrapy',
    name: 'Scrapy',
    description: 'Web crawling and scraping framework for large-scale data extraction.',
    version: '2.11.0',
    category: 'data',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/scrapy',
    verified: true,
    stars: 52000,
    downloads: 890000,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['crawl', 'scrape', 'parse', 'export', 'pipeline'],
    chain_uri: 'chain://commune-scrapy',
  },
  {
    id: 'commune-social-analyzer',
    name: 'Social Analyzer',
    description: 'Profile analysis across 1000+ social media platforms for OSINT and research.',
    version: '1.0.0',
    category: 'data',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/social-analyzer',
    verified: true,
    stars: 11200,
    downloads: 67000,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['search_username', 'analyze_profile', 'find_accounts', 'export_report'],
    chain_uri: 'chain://commune-social-analyzer',
  },
  {
    id: 'commune-summarize',
    name: 'Summarizer',
    description: 'Text summarization using LLMs. Compress documents, articles, and conversations.',
    version: '1.0.0',
    category: 'data',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/modules',
    verified: true,
    stars: 234,
    downloads: 12000,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['summarize', 'extract_key_points', 'compress', 'batch_summarize'],
    chain_uri: 'chain://commune-summarize',
  },

  // AI Models
  {
    id: 'commune-hrm',
    name: 'HRM',
    description: 'Hierarchical Reasoning Model for complex multi-step reasoning tasks.',
    version: '1.0.0',
    category: 'models',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/HRM',
    verified: true,
    stars: 456,
    downloads: 8900,
    requirements: { min_gpus: 1, min_memory_mb: 32768, gpu_vram_mb: 16000 },
    tools: ['reason', 'plan', 'decompose', 'synthesize'],
    chain_uri: 'chain://commune-hrm',
  },
  {
    id: 'commune-bittensor',
    name: 'Bittensor',
    description: 'Internet-scale neural networks. Decentralized AI with incentivized inference.',
    version: '7.0.0',
    category: 'models',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/bittensor',
    verified: true,
    stars: 1234,
    downloads: 45000,
    requirements: { min_gpus: 1, min_memory_mb: 16384, gpu_vram_mb: 8000 },
    tools: ['query', 'mine', 'validate', 'stake', 'register'],
    chain_uri: 'chain://commune-bittensor',
  },
  {
    id: 'commune-livecodebench',
    name: 'LiveCodeBench',
    description: 'Code evaluation framework for benchmarking LLMs on programming tasks.',
    version: '1.0.0',
    category: 'models',
    runtime: 'python',
    author: 'commune-ai',
    repo: 'https://github.com/commune-ai/LiveCodeBench',
    verified: true,
    stars: 678,
    downloads: 23000,
    requirements: { min_cpu_cores: 8, min_memory_mb: 16384 },
    tools: ['evaluate', 'benchmark', 'compare_models', 'run_tests'],
    chain_uri: 'chain://commune-livecodebench',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'ALL', icon: Box, count: 0 },
  { id: 'ai-agents', label: 'AI AGENTS', icon: Bot, count: 0 },
  { id: 'trading', label: 'TRADING', icon: TrendingUp, count: 0 },
  { id: 'defi', label: 'DEFI', icon: Coins, count: 0 },
  { id: 'infrastructure', label: 'INFRA', icon: Database, count: 0 },
  { id: 'data', label: 'DATA', icon: Search, count: 0 },
  { id: 'models', label: 'MODELS', icon: Brain, count: 0 },
];

export function Modules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);

  useEffect(() => {
    const loadModules = async () => {
      setLoading(true);
      await new Promise(r => setTimeout(r, 600));
      setModules(COMMUNE_MODULES);
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
  const categoryCounts = CATEGORIES.map(cat => ({
    ...cat,
    count: cat.id === 'all' ? modules.length : modules.filter(m => m.category === cat.id).length,
  }));

  const stats = {
    total: modules.length,
    verified: modules.filter(m => m.verified).length,
    agents: modules.filter(m => m.category === 'ai-agents').length,
    totalDownloads: modules.reduce((acc, m) => acc + m.downloads, 0),
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ai-agents': return 'var(--neon-cyan)';
      case 'trading': return 'var(--neon-green)';
      case 'defi': return 'var(--neon-magenta)';
      case 'infrastructure': return 'var(--neon-yellow, #ffff00)';
      case 'data': return '#ff6b6b';
      case 'models': return '#a855f7';
      default: return 'var(--text-secondary)';
    }
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
        <GlitchText text="COMMUNE MODULES" as="h2" className="glitch-hover" />
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
          color="cyan"
        />
        <StatsCard
          label="Verified"
          value={stats.verified}
          icon={Lock}
          color="green"
        />
        <StatsCard
          label="AI Agents"
          value={stats.agents}
          icon={Bot}
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
          {categoryCounts.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '0.5rem 0.75rem',
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
                fontSize: '0.65rem',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <cat.icon size={11} />
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
          Loading commune-ai modules...
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: 'var(--gap-lg)',
        }}>
          {filteredModules.map(mod => {
            const CategoryIcon = getCategoryIcon(mod.category);
            return (
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
                        <CategoryIcon size={18} style={{ color: getCategoryColor(mod.category) }} />
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
                            <Lock size={12} style={{ color: 'var(--neon-green)' }} />
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
                          color: 'var(--neon-cyan)',
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
                        <Zap size={10} style={{ verticalAlign: 'middle', marginRight: '3px', color: 'var(--neon-magenta)' }} />
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
                      <span style={{ color: 'var(--neon-magenta)' }}>
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
      {selectedModule && (
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
          onClick={() => setSelectedModule(null)}
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
                  const Icon = getCategoryIcon(selectedModule.category);
                  return <Icon size={18} style={{ color: getCategoryColor(selectedModule.category) }} />;
                })()}
                <span className="cyber-card-title">{selectedModule.name}</span>
              </div>
              <button
                onClick={() => setSelectedModule(null)}
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
                  background: `${getCategoryColor(selectedModule.category)}15`,
                  border: `1px solid ${getCategoryColor(selectedModule.category)}40`,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  color: getCategoryColor(selectedModule.category),
                  textTransform: 'uppercase',
                }}>
                  {selectedModule.category.replace('-', ' ')}
                </span>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  background: `${getRuntimeBadge(selectedModule.runtime)}20`,
                  border: `1px solid ${getRuntimeBadge(selectedModule.runtime)}60`,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  color: getRuntimeBadge(selectedModule.runtime),
                }}>
                  {selectedModule.runtime}
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

              {/* Description */}
              <p style={{
                color: 'var(--text-secondary)',
                marginBottom: 'var(--gap-lg)',
                lineHeight: 1.5,
              }}>
                {selectedModule.description}
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
                <div style={{ color: 'var(--neon-cyan)' }}>
                  {selectedModule.chain_uri}
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
                  Available Tools ({selectedModule.tools.length})
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
                  Compute Requirements
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                  gap: 'var(--gap-sm)',
                }}>
                  {selectedModule.requirements.min_gpus && (
                    <div className="hardware-item">
                      <div className="hardware-label">GPUs</div>
                      <div className="hardware-value" style={{ color: 'var(--neon-magenta)' }}>{selectedModule.requirements.min_gpus}</div>
                    </div>
                  )}
                  {selectedModule.requirements.gpu_vram_mb && (
                    <div className="hardware-item">
                      <div className="hardware-label">VRAM</div>
                      <div className="hardware-value" style={{ color: 'var(--neon-magenta)' }}>{(selectedModule.requirements.gpu_vram_mb / 1024).toFixed(0)} GB</div>
                    </div>
                  )}
                  {selectedModule.requirements.min_cpu_cores && (
                    <div className="hardware-item">
                      <div className="hardware-label">CPU</div>
                      <div className="hardware-value">{selectedModule.requirements.min_cpu_cores} cores</div>
                    </div>
                  )}
                  {selectedModule.requirements.min_memory_mb && (
                    <div className="hardware-item">
                      <div className="hardware-label">RAM</div>
                      <div className="hardware-value">{(selectedModule.requirements.min_memory_mb / 1024).toFixed(0)} GB</div>
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
                    {formatNumber(selectedModule.stars)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Downloads</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--neon-cyan)' }}>
                    {formatNumber(selectedModule.downloads)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Author</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {selectedModule.author}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 'var(--gap-md)', flexWrap: 'wrap' }}>
                <CyberButton
                  variant="primary"
                  icon={Zap}
                  onClick={() => {
                    setSelectedModule(null);
                    window.location.href = '#/submit';
                  }}
                >
                  DEPLOY ON COMPUTE
                </CyberButton>
                <CyberButton
                  icon={ExternalLink}
                  onClick={() => window.open(selectedModule.repo, '_blank')}
                >
                  VIEW SOURCE
                </CyberButton>
                {selectedModule.docs && (
                  <CyberButton
                    icon={Code}
                    onClick={() => window.open(selectedModule.docs, '_blank')}
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
