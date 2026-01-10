/**
 * RhizOS Module Configuration Schemas
 *
 * Defines the configuration structure for each module type.
 * Used for validation, form generation, and deployment.
 */

import { z } from 'zod';

// ============ Credential Reference ============
// Never contains raw values - only references to stored credentials

export const CredentialRefSchema = z.object({
  credentialId: z.string().min(1, 'Credential ID required'),
  type: z.enum([
    'exchange_api',
    'llm_api',
    'twitter_oauth',
    'discord_bot',
    'telegram_bot',
    'database_url',
    'wallet_private_key',
    'custom',
  ]),
});

export type CredentialRef = z.infer<typeof CredentialRefSchema>;

// ============ Form Field Definitions ============
// Used by UI to generate dynamic forms

export type FieldType =
  | 'text'
  | 'password'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'credential'
  | 'json'
  | 'array';

export interface ConfigFormField {
  name: string;
  label: string;
  type: FieldType;
  description?: string;
  required: boolean;
  default?: unknown;
  placeholder?: string;

  // For select/multiselect
  options?: { value: string; label: string }[];

  // For number fields
  min?: number;
  max?: number;
  step?: number;

  // For credential fields
  credentialType?: CredentialRef['type'];

  // For nested/array fields
  fields?: ConfigFormField[];

  // Conditional visibility
  showIf?: {
    field: string;
    value: unknown;
  };
}

// ============ Exchange Configurations ============

export const SUPPORTED_EXCHANGES = [
  'binance',
  'binance_us',
  'coinbase',
  'coinbase_pro',
  'kraken',
  'kucoin',
  'bybit',
  'okx',
  'gate_io',
  'huobi',
  'bitfinex',
  'gemini',
  'ftx',
  'mexc',
  'bitget',
] as const;

export const TRADING_STRATEGIES = [
  'market_making',
  'arbitrage',
  'grid',
  'twap',
  'vwap',
  'dca',
  'mean_reversion',
  'momentum',
  'cross_exchange_market_making',
  'avellaneda_market_making',
] as const;

// ============ Hummingbot Configuration ============

export const HummingbotConfigSchema = z.object({
  exchange: z.enum(SUPPORTED_EXCHANGES),
  credentials: z.object({
    apiKey: CredentialRefSchema,
    apiSecret: CredentialRefSchema,
    passphrase: CredentialRefSchema.optional(), // Required for some exchanges
  }),
  strategy: z.enum(TRADING_STRATEGIES),
  tradingPairs: z.array(z.string().regex(/^[A-Z]+-[A-Z]+$/, 'Format: BASE-QUOTE')).min(1),
  parameters: z.object({
    // Market Making
    bidSpread: z.number().min(0).max(0.5).optional(),
    askSpread: z.number().min(0).max(0.5).optional(),
    orderAmount: z.number().positive(),
    orderLevels: z.number().int().min(1).max(10).optional(),
    orderLevelSpread: z.number().min(0).max(0.1).optional(),

    // Risk Management
    maxOrderAge: z.number().positive().optional(),
    inventorySkewEnabled: z.boolean().optional(),
    inventoryTargetBasePercent: z.number().min(0).max(100).optional(),

    // Grid Strategy
    gridLevels: z.number().int().min(2).max(100).optional(),
    gridSpacing: z.number().min(0.001).max(0.5).optional(),

    // TWAP/VWAP
    targetAmount: z.number().positive().optional(),
    executionTime: z.number().positive().optional(), // in seconds
  }),
  riskControls: z.object({
    maxDailyLoss: z.number().optional(),
    maxPositionSize: z.number().optional(),
    stopLossPercent: z.number().min(0).max(100).optional(),
    takeProfitPercent: z.number().min(0).max(100).optional(),
  }).optional(),
  dryRun: z.boolean().default(true),
  loggingLevel: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR']).default('INFO'),
});

export type HummingbotConfig = z.infer<typeof HummingbotConfigSchema>;

export const HUMMINGBOT_FORM_FIELDS: ConfigFormField[] = [
  {
    name: 'exchange',
    label: 'Exchange',
    type: 'select',
    description: 'Select the exchange to trade on',
    required: true,
    options: SUPPORTED_EXCHANGES.map(e => ({ value: e, label: e.replace(/_/g, ' ').toUpperCase() })),
  },
  {
    name: 'credentials.apiKey',
    label: 'API Key',
    type: 'credential',
    credentialType: 'exchange_api',
    description: 'Exchange API key credential',
    required: true,
  },
  {
    name: 'credentials.apiSecret',
    label: 'API Secret',
    type: 'credential',
    credentialType: 'exchange_api',
    description: 'Exchange API secret credential',
    required: true,
  },
  {
    name: 'strategy',
    label: 'Trading Strategy',
    type: 'select',
    description: 'Select the trading strategy',
    required: true,
    options: TRADING_STRATEGIES.map(s => ({ value: s, label: s.replace(/_/g, ' ').toUpperCase() })),
  },
  {
    name: 'tradingPairs',
    label: 'Trading Pairs',
    type: 'array',
    description: 'Trading pairs (e.g., BTC-USDT)',
    required: true,
    placeholder: 'BTC-USDT',
  },
  {
    name: 'parameters.orderAmount',
    label: 'Order Amount',
    type: 'number',
    description: 'Base order amount in quote currency',
    required: true,
    min: 0,
  },
  {
    name: 'parameters.bidSpread',
    label: 'Bid Spread',
    type: 'number',
    description: 'Spread for buy orders (0.01 = 1%)',
    required: false,
    min: 0,
    max: 0.5,
    step: 0.001,
    default: 0.01,
    showIf: { field: 'strategy', value: 'market_making' },
  },
  {
    name: 'parameters.askSpread',
    label: 'Ask Spread',
    type: 'number',
    description: 'Spread for sell orders (0.01 = 1%)',
    required: false,
    min: 0,
    max: 0.5,
    step: 0.001,
    default: 0.01,
    showIf: { field: 'strategy', value: 'market_making' },
  },
  {
    name: 'dryRun',
    label: 'Dry Run (Paper Trading)',
    type: 'boolean',
    description: 'Enable paper trading mode (no real trades)',
    required: false,
    default: true,
  },
];

// ============ Eliza Agent Configuration ============

export const SOCIAL_PLATFORMS = ['twitter', 'discord', 'telegram', 'farcaster'] as const;
export const LLM_PROVIDERS = ['openai', 'anthropic', 'groq', 'local', 'together', 'fireworks'] as const;

export const ElizaConfigSchema = z.object({
  personality: z.object({
    name: z.string().min(1).max(50),
    bio: z.string().max(500),
    traits: z.array(z.string()).min(1).max(10),
    style: z.enum(['professional', 'casual', 'friendly', 'technical', 'humorous']).optional(),
    instructions: z.string().max(2000).optional(),
  }),
  platforms: z.array(z.object({
    type: z.enum(SOCIAL_PLATFORMS),
    credentials: CredentialRefSchema,
    enabled: z.boolean(),
    settings: z.object({
      // Twitter specific
      replyToMentions: z.boolean().optional(),
      autoTweet: z.boolean().optional(),
      tweetInterval: z.number().min(60).optional(), // seconds

      // Discord specific
      channelIds: z.array(z.string()).optional(),
      respondToCommands: z.boolean().optional(),

      // Telegram specific
      allowGroups: z.boolean().optional(),
    }).optional(),
  })).min(1),
  llm: z.object({
    provider: z.enum(LLM_PROVIDERS),
    model: z.string(),
    credentials: CredentialRefSchema.optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(32000).optional(),
  }),
  memory: z.object({
    enabled: z.boolean().default(true),
    maxMessages: z.number().int().min(10).max(10000).default(1000),
    summarizationEnabled: z.boolean().default(true),
  }).optional(),
  knowledge: z.object({
    documents: z.array(z.object({
      type: z.enum(['url', 'text', 'file']),
      content: z.string(),
    })).optional(),
    searchEnabled: z.boolean().default(false),
  }).optional(),
});

export type ElizaConfig = z.infer<typeof ElizaConfigSchema>;

export const ELIZA_FORM_FIELDS: ConfigFormField[] = [
  {
    name: 'personality.name',
    label: 'Agent Name',
    type: 'text',
    description: 'Name of your AI agent',
    required: true,
    placeholder: 'Luna',
  },
  {
    name: 'personality.bio',
    label: 'Bio',
    type: 'textarea',
    description: 'A brief description of your agent',
    required: true,
    placeholder: 'A friendly AI assistant passionate about crypto and technology...',
  },
  {
    name: 'personality.traits',
    label: 'Personality Traits',
    type: 'array',
    description: 'List of personality traits',
    required: true,
    placeholder: 'witty, helpful, knowledgeable',
  },
  {
    name: 'personality.style',
    label: 'Communication Style',
    type: 'select',
    description: 'How the agent communicates',
    required: false,
    options: [
      { value: 'professional', label: 'Professional' },
      { value: 'casual', label: 'Casual' },
      { value: 'friendly', label: 'Friendly' },
      { value: 'technical', label: 'Technical' },
      { value: 'humorous', label: 'Humorous' },
    ],
    default: 'friendly',
  },
  {
    name: 'llm.provider',
    label: 'LLM Provider',
    type: 'select',
    description: 'AI model provider',
    required: true,
    options: LLM_PROVIDERS.map(p => ({ value: p, label: p.toUpperCase() })),
  },
  {
    name: 'llm.model',
    label: 'Model',
    type: 'text',
    description: 'Model name (e.g., gpt-4, claude-3-opus)',
    required: true,
    placeholder: 'gpt-4-turbo',
  },
  {
    name: 'llm.credentials',
    label: 'API Credentials',
    type: 'credential',
    credentialType: 'llm_api',
    description: 'API key for the LLM provider',
    required: false,
  },
  {
    name: 'memory.enabled',
    label: 'Enable Memory',
    type: 'boolean',
    description: 'Remember conversations across sessions',
    required: false,
    default: true,
  },
];

// ============ Scrapy Configuration ============

export const ScrapyConfigSchema = z.object({
  spider: z.object({
    name: z.string().min(1),
    startUrls: z.array(z.string().url()).min(1),
    allowedDomains: z.array(z.string()).optional(),
    rules: z.array(z.object({
      pattern: z.string(),
      follow: z.boolean(),
      callback: z.string().optional(),
    })).optional(),
  }),
  settings: z.object({
    userAgent: z.string().optional(),
    downloadDelay: z.number().min(0).default(1),
    concurrentRequests: z.number().int().min(1).max(100).default(16),
    robotstxtObey: z.boolean().default(true),
    cookies: z.boolean().default(true),
    retryTimes: z.number().int().min(0).max(10).default(3),
    httpProxy: z.string().url().optional(),
  }),
  extraction: z.object({
    selectors: z.record(z.string(), z.string()), // field name -> CSS/XPath selector
    pagination: z.object({
      nextSelector: z.string().optional(),
      maxPages: z.number().int().min(1).optional(),
    }).optional(),
  }),
  output: z.object({
    format: z.enum(['json', 'jsonlines', 'csv', 'xml']),
    destination: z.enum(['local', 'ipfs', 's3', 'webhook']),
    webhookUrl: z.string().url().optional(),
    s3Bucket: z.string().optional(),
  }),
});

export type ScrapyConfig = z.infer<typeof ScrapyConfigSchema>;

export const SCRAPY_FORM_FIELDS: ConfigFormField[] = [
  {
    name: 'spider.name',
    label: 'Spider Name',
    type: 'text',
    description: 'Name for this scraping job',
    required: true,
    placeholder: 'my_spider',
  },
  {
    name: 'spider.startUrls',
    label: 'Start URLs',
    type: 'array',
    description: 'URLs to begin crawling from',
    required: true,
    placeholder: 'https://example.com',
  },
  {
    name: 'spider.allowedDomains',
    label: 'Allowed Domains',
    type: 'array',
    description: 'Domains to restrict crawling to',
    required: false,
    placeholder: 'example.com',
  },
  {
    name: 'settings.downloadDelay',
    label: 'Download Delay (seconds)',
    type: 'number',
    description: 'Delay between requests',
    required: false,
    default: 1,
    min: 0,
    step: 0.1,
  },
  {
    name: 'settings.concurrentRequests',
    label: 'Concurrent Requests',
    type: 'number',
    description: 'Number of parallel requests',
    required: false,
    default: 16,
    min: 1,
    max: 100,
  },
  {
    name: 'settings.robotstxtObey',
    label: 'Obey robots.txt',
    type: 'boolean',
    description: 'Respect website crawling rules',
    required: false,
    default: true,
  },
  {
    name: 'extraction.selectors',
    label: 'Data Selectors',
    type: 'json',
    description: 'CSS/XPath selectors for data extraction',
    required: true,
    placeholder: '{"title": "h1::text", "content": ".article-body"}',
  },
  {
    name: 'output.format',
    label: 'Output Format',
    type: 'select',
    description: 'Format for scraped data',
    required: true,
    options: [
      { value: 'json', label: 'JSON' },
      { value: 'jsonlines', label: 'JSON Lines' },
      { value: 'csv', label: 'CSV' },
      { value: 'xml', label: 'XML' },
    ],
    default: 'json',
  },
  {
    name: 'output.destination',
    label: 'Output Destination',
    type: 'select',
    description: 'Where to store scraped data',
    required: true,
    options: [
      { value: 'local', label: 'Local Storage' },
      { value: 'ipfs', label: 'IPFS' },
      { value: 's3', label: 'S3 Bucket' },
      { value: 'webhook', label: 'Webhook' },
    ],
    default: 'local',
  },
];

// ============ Nautilus Trader Configuration ============

export const NautilusConfigSchema = z.object({
  venue: z.enum(['binance', 'ftx', 'interactive_brokers', 'betfair', 'sandbox']),
  credentials: z.object({
    apiKey: CredentialRefSchema.optional(),
    apiSecret: CredentialRefSchema.optional(),
  }),
  strategy: z.object({
    name: z.string(),
    type: z.enum(['momentum', 'mean_reversion', 'pairs_trading', 'stat_arb', 'custom']),
    instruments: z.array(z.string()).min(1),
    parameters: z.record(z.string(), z.unknown()),
  }),
  backtest: z.object({
    enabled: z.boolean(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    initialCapital: z.number().positive().optional(),
  }).optional(),
  risk: z.object({
    maxPositionSize: z.number().optional(),
    maxDrawdown: z.number().min(0).max(100).optional(),
    positionSizing: z.enum(['fixed', 'kelly', 'volatility_target']).optional(),
  }).optional(),
  live: z.object({
    enabled: z.boolean().default(false),
    paperTrading: z.boolean().default(true),
  }),
});

export type NautilusConfig = z.infer<typeof NautilusConfigSchema>;

// ============ IPFS Storage Configuration ============

export const IpfsConfigSchema = z.object({
  gateway: z.object({
    url: z.string().url().default('https://ipfs.io'),
    timeout: z.number().min(1000).max(60000).default(30000),
  }),
  pinning: z.object({
    service: z.enum(['local', 'pinata', 'infura', 'filebase', 'web3storage']),
    credentials: CredentialRefSchema.optional(),
  }),
  options: z.object({
    wrapWithDirectory: z.boolean().default(false),
    onlyHash: z.boolean().default(false),
    cidVersion: z.enum(['0', '1']).default('1'),
  }).optional(),
});

export type IpfsConfig = z.infer<typeof IpfsConfigSchema>;

// ============ LLM Inference Configuration ============

export const LlmInferenceConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'groq', 'together', 'fireworks', 'local']),
  model: z.string(),
  credentials: CredentialRefSchema.optional(),
  parameters: z.object({
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(1).max(128000).optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    stopSequences: z.array(z.string()).optional(),
  }).optional(),
  systemPrompt: z.string().optional(),
});

export type LlmInferenceConfig = z.infer<typeof LlmInferenceConfigSchema>;

export const LLM_INFERENCE_FORM_FIELDS: ConfigFormField[] = [
  {
    name: 'provider',
    label: 'Provider',
    type: 'select',
    description: 'LLM API provider',
    required: true,
    options: [
      { value: 'openai', label: 'OpenAI' },
      { value: 'anthropic', label: 'Anthropic' },
      { value: 'groq', label: 'Groq' },
      { value: 'together', label: 'Together AI' },
      { value: 'fireworks', label: 'Fireworks AI' },
      { value: 'local', label: 'Local (Ollama)' },
    ],
  },
  {
    name: 'model',
    label: 'Model',
    type: 'text',
    description: 'Model identifier',
    required: true,
    placeholder: 'gpt-4-turbo',
  },
  {
    name: 'credentials',
    label: 'API Key',
    type: 'credential',
    credentialType: 'llm_api',
    description: 'API key for the provider',
    required: false,
  },
  {
    name: 'parameters.temperature',
    label: 'Temperature',
    type: 'number',
    description: 'Randomness in output (0-2)',
    required: false,
    default: 0.7,
    min: 0,
    max: 2,
    step: 0.1,
  },
  {
    name: 'parameters.maxTokens',
    label: 'Max Tokens',
    type: 'number',
    description: 'Maximum response length',
    required: false,
    min: 1,
    max: 128000,
  },
  {
    name: 'systemPrompt',
    label: 'System Prompt',
    type: 'textarea',
    description: 'System instructions for the model',
    required: false,
    placeholder: 'You are a helpful assistant...',
  },
];

// ============ Docker Runtime Configuration ============

export const DockerRuntimeConfigSchema = z.object({
  image: z.string(),
  tag: z.string().default('latest'),
  command: z.array(z.string()).optional(),
  entrypoint: z.string().optional(),
  environment: z.record(z.string(), z.string()).optional(),
  secrets: z.record(z.string(), CredentialRefSchema).optional(),
  volumes: z.array(z.object({
    hostPath: z.string().optional(),
    containerPath: z.string(),
    readonly: z.boolean().default(false),
  })).optional(),
  ports: z.array(z.object({
    host: z.number().int().min(1).max(65535).optional(),
    container: z.number().int().min(1).max(65535),
    protocol: z.enum(['tcp', 'udp']).default('tcp'),
  })).optional(),
  resources: z.object({
    cpuLimit: z.number().positive().optional(),
    memoryLimitMb: z.number().int().positive().optional(),
    gpuCount: z.number().int().min(0).optional(),
  }).optional(),
  healthcheck: z.object({
    command: z.string(),
    interval: z.number().default(30),
    timeout: z.number().default(10),
    retries: z.number().default(3),
  }).optional(),
  restart: z.enum(['no', 'always', 'on-failure', 'unless-stopped']).default('no'),
});

export type DockerRuntimeConfig = z.infer<typeof DockerRuntimeConfigSchema>;

// ============ Polymarket Configuration ============

export const PolymarketConfigSchema = z.object({
  credentials: z.object({
    wallet: CredentialRefSchema,
    apiKey: CredentialRefSchema.optional(),
  }),
  trading: z.object({
    maxPositionSize: z.number().positive(),
    defaultSlippage: z.number().min(0).max(0.5).default(0.01),
    autoCompound: z.boolean().default(false),
  }),
  notifications: z.object({
    priceAlerts: z.boolean().default(false),
    resolutionAlerts: z.boolean().default(true),
  }).optional(),
});

export type PolymarketConfig = z.infer<typeof PolymarketConfigSchema>;

// ============ Social Analyzer Configuration ============

export const SocialAnalyzerConfigSchema = z.object({
  target: z.object({
    username: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }).refine(data => data.username || data.email || data.phone, {
    message: 'At least one target identifier required',
  }),
  platforms: z.array(z.string()).optional(), // Empty = all platforms
  options: z.object({
    fastMode: z.boolean().default(false),
    profilePhoto: z.boolean().default(true),
    similarity: z.boolean().default(true),
    extractMetadata: z.boolean().default(true),
  }),
  output: z.object({
    format: z.enum(['json', 'html', 'pdf']),
    includeScreenshots: z.boolean().default(false),
  }),
});

export type SocialAnalyzerConfig = z.infer<typeof SocialAnalyzerConfigSchema>;

// ============ Bittensor Configuration ============

export const BittensorConfigSchema = z.object({
  wallet: z.object({
    name: z.string(),
    hotkey: CredentialRefSchema,
    coldkey: CredentialRefSchema.optional(),
  }),
  network: z.enum(['finney', 'test', 'local']).default('finney'),
  subnet: z.number().int().min(0).optional(),
  operation: z.object({
    type: z.enum(['query', 'mine', 'validate']),
    parameters: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type BittensorConfig = z.infer<typeof BittensorConfigSchema>;

// ============ Generic Module Configuration ============
// For modules without specific schemas

export const GenericModuleConfigSchema = z.object({
  parameters: z.record(z.string(), z.unknown()),
  credentials: z.record(z.string(), CredentialRefSchema).optional(),
  environment: z.record(z.string(), z.string()).optional(),
});

export type GenericModuleConfig = z.infer<typeof GenericModuleConfigSchema>;

// ============ Module Configuration Registry ============

export const MODULE_CONFIG_SCHEMAS: Record<string, z.ZodSchema> = {
  'rhizos-hummingbot': HummingbotConfigSchema,
  'rhizos-eliza': ElizaConfigSchema,
  'rhizos-scrapy': ScrapyConfigSchema,
  'rhizos-nautilus': NautilusConfigSchema,
  'rhizos-ipfs': IpfsConfigSchema,
  'rhizos-docker': DockerRuntimeConfigSchema,
  'rhizos-polymarket': PolymarketConfigSchema,
  'rhizos-social-analyzer': SocialAnalyzerConfigSchema,
  'rhizos-bittensor': BittensorConfigSchema,
  'rhizos-summarize': LlmInferenceConfigSchema,
  'rhizos-hrm': LlmInferenceConfigSchema,
};

export const MODULE_FORM_FIELDS: Record<string, ConfigFormField[]> = {
  'rhizos-hummingbot': HUMMINGBOT_FORM_FIELDS,
  'rhizos-eliza': ELIZA_FORM_FIELDS,
  'rhizos-scrapy': SCRAPY_FORM_FIELDS,
  'rhizos-summarize': LLM_INFERENCE_FORM_FIELDS,
  'rhizos-hrm': LLM_INFERENCE_FORM_FIELDS,
};

// ============ Credential Type Metadata ============

export const CREDENTIAL_TYPE_METADATA: Record<CredentialRef['type'], {
  label: string;
  description: string;
  fields: { name: string; label: string; type: 'text' | 'password'; required: boolean }[];
}> = {
  exchange_api: {
    label: 'Exchange API',
    description: 'API credentials for cryptocurrency exchanges',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true },
      { name: 'apiSecret', label: 'API Secret', type: 'password', required: true },
      { name: 'passphrase', label: 'Passphrase', type: 'password', required: false },
    ],
  },
  llm_api: {
    label: 'LLM API',
    description: 'API keys for AI model providers',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true },
      { name: 'organizationId', label: 'Organization ID', type: 'text', required: false },
    ],
  },
  twitter_oauth: {
    label: 'Twitter OAuth',
    description: 'Twitter/X OAuth credentials',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true },
      { name: 'apiSecret', label: 'API Secret', type: 'password', required: true },
      { name: 'accessToken', label: 'Access Token', type: 'password', required: true },
      { name: 'accessTokenSecret', label: 'Access Token Secret', type: 'password', required: true },
    ],
  },
  discord_bot: {
    label: 'Discord Bot',
    description: 'Discord bot token',
    fields: [
      { name: 'botToken', label: 'Bot Token', type: 'password', required: true },
    ],
  },
  telegram_bot: {
    label: 'Telegram Bot',
    description: 'Telegram bot token',
    fields: [
      { name: 'botToken', label: 'Bot Token', type: 'password', required: true },
    ],
  },
  database_url: {
    label: 'Database',
    description: 'Database connection string',
    fields: [
      { name: 'connectionString', label: 'Connection String', type: 'password', required: true },
    ],
  },
  wallet_private_key: {
    label: 'Wallet',
    description: 'Cryptocurrency wallet private key',
    fields: [
      { name: 'privateKey', label: 'Private Key', type: 'password', required: true },
      { name: 'mnemonic', label: 'Mnemonic (optional)', type: 'password', required: false },
    ],
  },
  custom: {
    label: 'Custom',
    description: 'Custom credential type',
    fields: [
      { name: 'value', label: 'Value', type: 'password', required: true },
    ],
  },
};

// ============ Helper Functions ============

/**
 * Get the configuration schema for a module
 */
export function getModuleConfigSchema(moduleId: string): z.ZodSchema | undefined {
  return MODULE_CONFIG_SCHEMAS[moduleId];
}

/**
 * Get the form fields for a module
 */
export function getModuleFormFields(moduleId: string): ConfigFormField[] {
  return MODULE_FORM_FIELDS[moduleId] || [];
}

/**
 * Validate a module configuration
 */
export function validateModuleConfig(
  moduleId: string,
  config: unknown
): { success: true; data: unknown } | { success: false; errors: z.ZodError } {
  const schema = getModuleConfigSchema(moduleId);
  if (!schema) {
    // Use generic schema for unknown modules
    const result = GenericModuleConfigSchema.safeParse(config);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  }

  const result = schema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Get required credential types for a module
 */
export function getRequiredCredentialTypes(moduleId: string): CredentialRef['type'][] {
  const fields = MODULE_FORM_FIELDS[moduleId] || [];
  const credentialFields = fields.filter(f => f.type === 'credential' && f.required);
  return credentialFields
    .map(f => f.credentialType)
    .filter((t): t is CredentialRef['type'] => t !== undefined);
}
