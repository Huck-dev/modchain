// Shared module definitions used by Modules page and Flow Builder
import { Bot, TrendingUp, Coins, Database, Search, Brain, Box } from 'lucide-react';
import type { CredentialRef } from '../../../shared/schemas/module-configs';

// Credential type alias for convenience
export type CredentialType = CredentialRef['type'];

export interface ModuleDefinition {
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
  // Configuration metadata
  requiredCredentialTypes?: CredentialType[];
  optionalCredentialTypes?: CredentialType[];
  hasConfigSchema?: boolean;
}

// RhizOS Module Registry
export const RHIZOS_MODULES: ModuleDefinition[] = [
  // AI Agents
  {
    id: 'rhizos-eliza',
    name: 'Eliza',
    description: 'Conversational AI agent for Twitter, Discord, and Telegram. Multi-platform autonomous agent with memory and document ingestion.',
    version: '1.0.0',
    category: 'ai-agents',
    runtime: 'node',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/eliza',
    verified: true,
    stars: 2847,
    downloads: 45200,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['chat', 'post_tweet', 'send_discord', 'send_telegram', 'remember', 'search_docs'],
    chain_uri: 'chain://rhizos-eliza',
    docs: 'https://elizaos.github.io/eliza/',
    requiredCredentialTypes: ['llm_api'],
    optionalCredentialTypes: ['twitter_oauth', 'discord_bot', 'telegram_bot'],
    hasConfigSchema: true,
  },
  {
    id: 'rhizos-sentience',
    name: 'Sentience',
    description: 'Build verifiable AI agents with on-chain attestations. TEE-based execution with cryptographic proof of inference.',
    version: '0.9.0',
    category: 'ai-agents',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/sentience',
    verified: true,
    stars: 1523,
    downloads: 23400,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['verified_inference', 'verify_signature', 'get_attestation', 'submit_proof'],
    chain_uri: 'chain://rhizos-sentience',
  },
  {
    id: 'rhizos-hedgy',
    name: 'Hedgy',
    description: 'AI Hedge Fund with 15 specialized agents including Warren Buffett, Charlie Munger, and Cathie Wood investment styles.',
    version: '1.2.0',
    category: 'ai-agents',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/hedgy',
    verified: true,
    stars: 892,
    downloads: 12100,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['analyze_ticker', 'backtest', 'get_signals', 'portfolio_optimize', 'risk_assess'],
    chain_uri: 'chain://rhizos-hedgy',
  },
  {
    id: 'rhizos-swarms',
    name: 'Swarms',
    description: 'Multi-agent orchestration system for coordinating autonomous AI agents working together.',
    version: '2.0.0',
    category: 'ai-agents',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/modules',
    verified: true,
    stars: 567,
    downloads: 8900,
    requirements: { min_cpu_cores: 8, min_memory_mb: 16384 },
    tools: ['spawn_agent', 'coordinate', 'distribute_task', 'aggregate_results'],
    chain_uri: 'chain://rhizos-swarms',
  },
  {
    id: 'rhizos-godmode',
    name: 'GodMode',
    description: 'Fully autonomous agent with unrestricted capabilities for complex multi-step tasks.',
    version: '0.5.0',
    category: 'ai-agents',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/modules',
    verified: false,
    stars: 423,
    downloads: 5600,
    requirements: { min_gpus: 1, min_memory_mb: 32768, gpu_vram_mb: 24000 },
    tools: ['execute', 'plan', 'browse', 'code', 'shell'],
    chain_uri: 'chain://rhizos-godmode',
  },

  // Trading Bots
  {
    id: 'rhizos-hummingbot',
    name: 'Hummingbot',
    description: 'High-frequency crypto trading bot framework. Deploy across 140+ exchanges with $34B+ annual volume.',
    version: '2.1.0',
    category: 'trading',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/hummingbot',
    verified: true,
    stars: 7234,
    downloads: 156000,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['create_strategy', 'start_bot', 'stop_bot', 'get_orders', 'market_make', 'arbitrage'],
    chain_uri: 'chain://rhizos-hummingbot',
    docs: 'https://hummingbot.org/docs/',
    requiredCredentialTypes: ['exchange_api'],
    hasConfigSchema: true,
  },
  {
    id: 'rhizos-nautilus',
    name: 'Nautilus Trader',
    description: 'High-performance algorithmic trading platform with event-driven backtesting engine.',
    version: '1.8.0',
    category: 'trading',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/nautilus_trader',
    verified: true,
    stars: 1876,
    downloads: 34500,
    requirements: { min_cpu_cores: 8, min_memory_mb: 16384 },
    tools: ['backtest', 'live_trade', 'analyze', 'optimize_strategy', 'risk_manage'],
    chain_uri: 'chain://rhizos-nautilus',
    optionalCredentialTypes: ['exchange_api'],
    hasConfigSchema: true,
  },
  {
    id: 'rhizos-hyperliquid',
    name: 'Hyperliquid SDK',
    description: 'SDK for Hyperliquid perpetuals DEX. High-speed trading with on-chain settlement.',
    version: '1.0.0',
    category: 'trading',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/hyperliquid',
    verified: true,
    stars: 234,
    downloads: 8700,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['place_order', 'cancel_order', 'get_positions', 'get_funding', 'leverage_set'],
    chain_uri: 'chain://rhizos-hyperliquid',
    requiredCredentialTypes: ['wallet_private_key'],
  },
  {
    id: 'rhizos-raydium',
    name: 'Raydium Swap',
    description: 'Raydium AMM integration for Solana. Swap tokens via AMM v4 and CPMM pools.',
    version: '0.8.0',
    category: 'trading',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/raydium',
    verified: true,
    stars: 189,
    downloads: 4500,
    requirements: { min_cpu_cores: 2, min_memory_mb: 2048 },
    tools: ['swap', 'get_quote', 'add_liquidity', 'remove_liquidity', 'get_pools'],
    chain_uri: 'chain://rhizos-raydium',
    requiredCredentialTypes: ['wallet_private_key'],
  },

  // DeFi
  {
    id: 'rhizos-uniswap',
    name: 'Uniswap',
    description: 'Uniswap V3 integration for Ethereum DEX trading with concentrated liquidity.',
    version: '3.0.0',
    category: 'defi',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/modules',
    verified: true,
    stars: 456,
    downloads: 23000,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['swap', 'add_liquidity', 'remove_liquidity', 'get_price', 'get_pool_info'],
    chain_uri: 'chain://rhizos-uniswap',
    requiredCredentialTypes: ['wallet_private_key'],
  },
  {
    id: 'rhizos-bridge',
    name: 'Cross-Chain Bridge',
    description: 'Cross-chain asset bridge for moving tokens between Ethereum, Solana, and other chains.',
    version: '1.0.0',
    category: 'defi',
    runtime: 'rust',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/modules',
    verified: true,
    stars: 345,
    downloads: 12000,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['bridge_tokens', 'get_quote', 'track_transfer', 'verify_receipt'],
    chain_uri: 'chain://rhizos-bridge',
    requiredCredentialTypes: ['wallet_private_key'],
  },
  {
    id: 'rhizos-lend',
    name: 'Lending Protocol',
    description: 'DeFi lending and borrowing protocol integration. Supply assets, borrow, and earn yield.',
    version: '1.5.0',
    category: 'defi',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/modules',
    verified: true,
    stars: 234,
    downloads: 8900,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['supply', 'borrow', 'repay', 'withdraw', 'get_rates', 'get_health'],
    chain_uri: 'chain://rhizos-lend',
    requiredCredentialTypes: ['wallet_private_key'],
  },
  {
    id: 'rhizos-polymarket',
    name: 'Polymarket',
    description: 'Prediction market integration. Trade on real-world event outcomes.',
    version: '1.0.0',
    category: 'defi',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/modules',
    verified: true,
    stars: 567,
    downloads: 15600,
    requirements: { min_cpu_cores: 2, min_memory_mb: 2048 },
    tools: ['get_markets', 'place_bet', 'get_positions', 'cash_out', 'get_odds'],
    chain_uri: 'chain://rhizos-polymarket',
    requiredCredentialTypes: ['wallet_private_key'],
    hasConfigSchema: true,
  },

  // Infrastructure
  {
    id: 'rhizos-ipfs',
    name: 'IPFS Storage',
    description: 'Distributed IPFS storage with pinning, retrieval, and content addressing.',
    version: '2.0.0',
    category: 'infrastructure',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/modules',
    verified: true,
    stars: 345,
    downloads: 34000,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['pin', 'unpin', 'get', 'add', 'stat', 'ls'],
    chain_uri: 'chain://rhizos-ipfs',
    optionalCredentialTypes: ['custom'],
    hasConfigSchema: true,
  },
  {
    id: 'rhizos-supabase',
    name: 'Supabase',
    description: 'Supabase backend integration for database, auth, and realtime subscriptions.',
    version: '1.2.0',
    category: 'infrastructure',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/modules',
    verified: true,
    stars: 234,
    downloads: 12000,
    requirements: { min_cpu_cores: 1, min_memory_mb: 1024 },
    tools: ['query', 'insert', 'update', 'delete', 'subscribe', 'auth'],
    chain_uri: 'chain://rhizos-supabase',
    requiredCredentialTypes: ['database_url'],
  },
  {
    id: 'rhizos-docker',
    name: 'Docker Runtime',
    description: 'Docker container orchestration for running isolated compute workloads.',
    version: '1.0.0',
    category: 'infrastructure',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/modules',
    verified: true,
    stars: 189,
    downloads: 45000,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['run', 'stop', 'logs', 'exec', 'build', 'push'],
    chain_uri: 'chain://rhizos-docker',
    hasConfigSchema: true,
  },

  // Data & Scraping
  {
    id: 'rhizos-scrapy',
    name: 'Scrapy',
    description: 'Web crawling and scraping framework for large-scale data extraction.',
    version: '2.11.0',
    category: 'data',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/scrapy',
    verified: true,
    stars: 52000,
    downloads: 890000,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['crawl', 'scrape', 'parse', 'export', 'pipeline'],
    chain_uri: 'chain://rhizos-scrapy',
    hasConfigSchema: true,
  },
  {
    id: 'rhizos-social-analyzer',
    name: 'Social Analyzer',
    description: 'Profile analysis across 1000+ social media platforms for OSINT and research.',
    version: '1.0.0',
    category: 'data',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/social-analyzer',
    verified: true,
    stars: 11200,
    downloads: 67000,
    requirements: { min_cpu_cores: 4, min_memory_mb: 8192 },
    tools: ['search_username', 'analyze_profile', 'find_accounts', 'export_report'],
    chain_uri: 'chain://rhizos-social-analyzer',
    hasConfigSchema: true,
  },
  {
    id: 'rhizos-summarize',
    name: 'Summarizer',
    description: 'Text summarization using LLMs. Compress documents, articles, and conversations.',
    version: '1.0.0',
    category: 'data',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/modules',
    verified: true,
    stars: 234,
    downloads: 12000,
    requirements: { min_cpu_cores: 2, min_memory_mb: 4096 },
    tools: ['summarize', 'extract_key_points', 'compress', 'batch_summarize'],
    chain_uri: 'chain://rhizos-summarize',
    requiredCredentialTypes: ['llm_api'],
    hasConfigSchema: true,
  },

  // AI Models
  {
    id: 'rhizos-hrm',
    name: 'HRM',
    description: 'Hierarchical Reasoning Model for complex multi-step reasoning tasks.',
    version: '1.0.0',
    category: 'models',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/HRM',
    verified: true,
    stars: 456,
    downloads: 8900,
    requirements: { min_gpus: 1, min_memory_mb: 32768, gpu_vram_mb: 16000 },
    tools: ['reason', 'plan', 'decompose', 'synthesize'],
    chain_uri: 'chain://rhizos-hrm',
    optionalCredentialTypes: ['llm_api'],
    hasConfigSchema: true,
  },
  {
    id: 'rhizos-bittensor',
    name: 'Bittensor',
    description: 'Internet-scale neural networks. Decentralized AI with incentivized inference.',
    version: '7.0.0',
    category: 'models',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/bittensor',
    verified: true,
    stars: 1234,
    downloads: 45000,
    requirements: { min_gpus: 1, min_memory_mb: 16384, gpu_vram_mb: 8000 },
    tools: ['query', 'mine', 'validate', 'stake', 'register'],
    chain_uri: 'chain://rhizos-bittensor',
    requiredCredentialTypes: ['wallet_private_key'],
    hasConfigSchema: true,
  },
  {
    id: 'rhizos-livecodebench',
    name: 'LiveCodeBench',
    description: 'Code evaluation framework for benchmarking LLMs on programming tasks.',
    version: '1.0.0',
    category: 'models',
    runtime: 'python',
    author: 'rhizos',
    repo: 'https://github.com/rhizos-cloud/LiveCodeBench',
    verified: true,
    stars: 678,
    downloads: 23000,
    requirements: { min_cpu_cores: 8, min_memory_mb: 16384 },
    tools: ['evaluate', 'benchmark', 'compare_models', 'run_tests'],
    chain_uri: 'chain://rhizos-livecodebench',
    requiredCredentialTypes: ['llm_api'],
  },
];

// Category metadata for UI
export const MODULE_CATEGORIES = [
  { id: 'all', label: 'ALL', icon: Box },
  { id: 'ai-agents', label: 'AI AGENTS', icon: Bot, color: '#6366f1' },
  { id: 'trading', label: 'TRADING', icon: TrendingUp, color: '#00ff41' },
  { id: 'defi', label: 'DEFI', icon: Coins, color: '#a855f7' },
  { id: 'infrastructure', label: 'INFRA', icon: Database, color: '#fbbf24' },
  { id: 'data', label: 'DATA', icon: Search, color: '#ff6b6b' },
  { id: 'models', label: 'MODELS', icon: Brain, color: '#00ffff' },
];

// Get category color
export const getCategoryColor = (category: string): string => {
  const cat = MODULE_CATEGORIES.find(c => c.id === category);
  return cat?.color || '#6366f1';
};

// Get category icon
export const getCategoryIcon = (category: string) => {
  const cat = MODULE_CATEGORIES.find(c => c.id === category);
  return cat?.icon || Box;
};

// Get modules by category
export const getModulesByCategory = (category: string): ModuleDefinition[] => {
  if (category === 'all') return RHIZOS_MODULES;
  return RHIZOS_MODULES.filter(m => m.category === category);
};

// Get module by ID
export const getModuleById = (id: string): ModuleDefinition | undefined => {
  return RHIZOS_MODULES.find(m => m.id === id);
};
