/**
 * Trading Adapter
 *
 * Handles trading bot operations - market data, order execution, and portfolio management.
 * Supports DEX and CEX integrations.
 */

import { z } from 'zod';
import {
  AdapterInfo,
  AdapterMethod,
  ExecutionContext,
} from '../types/index.js';
import { BaseAdapter } from './base.js';

// Trading request/response schemas
export const MarketDataRequestSchema = z.object({
  symbol: z.string(),
  exchange: z.string().optional().default('binance'),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).optional().default('1h'),
  limit: z.number().optional().default(100),
});

export const OrderRequestSchema = z.object({
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit', 'stop_loss', 'take_profit']),
  amount: z.number(),
  price: z.number().optional(),
  stop_price: z.number().optional(),
  exchange: z.string().optional().default('binance'),
  dry_run: z.boolean().optional().default(true),
});

export const PortfolioRequestSchema = z.object({
  exchange: z.string().optional(),
  include_value_usd: z.boolean().optional().default(true),
});

export const SignalRequestSchema = z.object({
  symbol: z.string(),
  strategy: z.enum(['macd', 'rsi', 'bollinger', 'ema_cross', 'custom']),
  params: z.record(z.number()).optional(),
  timeframe: z.string().optional().default('1h'),
});

export type MarketDataRequest = z.infer<typeof MarketDataRequestSchema>;
export type OrderRequest = z.infer<typeof OrderRequestSchema>;

// Simulated market data
const mockPrices: Record<string, number> = {
  'BTC/USDT': 43500,
  'ETH/USDT': 2280,
  'SOL/USDT': 98.5,
  'AVAX/USDT': 35.2,
};

export class TradingAdapter extends BaseAdapter {
  readonly info: AdapterInfo = {
    name: 'trading',
    version: '0.1.0',
    description: 'Trading bot operations - market data, orders, and portfolio management',
    capabilities: ['market-data', 'order-execution', 'portfolio-tracking', 'signals'],
    requirements: {
      memory: {
        min_mb: 1024,
      },
    },
  };

  readonly methods: Map<string, AdapterMethod> = new Map([
    [
      'get_price',
      {
        name: 'get_price',
        description: 'Get current price for a trading pair',
        parameters: z.object({
          symbol: z.string(),
          exchange: z.string().optional(),
        }),
        returns: z.object({
          symbol: z.string(),
          price: z.number(),
          change_24h: z.number(),
          volume_24h: z.number(),
        }),
      },
    ],
    [
      'get_ohlcv',
      {
        name: 'get_ohlcv',
        description: 'Get OHLCV candle data',
        parameters: MarketDataRequestSchema,
        returns: z.array(z.object({
          timestamp: z.number(),
          open: z.number(),
          high: z.number(),
          low: z.number(),
          close: z.number(),
          volume: z.number(),
        })),
      },
    ],
    [
      'place_order',
      {
        name: 'place_order',
        description: 'Place a trading order (dry_run by default)',
        parameters: OrderRequestSchema,
        returns: z.object({
          order_id: z.string(),
          status: z.string(),
          filled: z.number(),
          remaining: z.number(),
          price: z.number(),
          dry_run: z.boolean(),
        }),
      },
    ],
    [
      'get_portfolio',
      {
        name: 'get_portfolio',
        description: 'Get portfolio holdings',
        parameters: PortfolioRequestSchema,
        returns: z.object({
          total_value_usd: z.number(),
          holdings: z.array(z.object({
            asset: z.string(),
            amount: z.number(),
            value_usd: z.number(),
          })),
        }),
      },
    ],
    [
      'get_signal',
      {
        name: 'get_signal',
        description: 'Get trading signal from strategy',
        parameters: SignalRequestSchema,
        returns: z.object({
          signal: z.enum(['buy', 'sell', 'hold']),
          strength: z.number(),
          indicators: z.record(z.number()),
          reasoning: z.string(),
        }),
      },
    ],
    [
      'list_exchanges',
      {
        name: 'list_exchanges',
        description: 'List supported exchanges',
        parameters: z.object({}),
        returns: z.array(z.object({
          id: z.string(),
          name: z.string(),
          type: z.enum(['cex', 'dex']),
        })),
      },
    ],
  ]);

  async execute(
    method: string,
    params: unknown,
    context: ExecutionContext
  ): Promise<unknown> {
    switch (method) {
      case 'get_price':
        return this.getPrice(params);
      case 'get_ohlcv':
        return this.getOhlcv(params);
      case 'place_order':
        return this.placeOrder(params, context);
      case 'get_portfolio':
        return this.getPortfolio(params);
      case 'get_signal':
        return this.getSignal(params);
      case 'list_exchanges':
        return this.listExchanges();
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private getPrice(params: unknown): {
    symbol: string;
    price: number;
    change_24h: number;
    volume_24h: number;
  } {
    const { symbol } = z.object({ symbol: z.string() }).parse(params);

    console.log(`[trading] Getting price for ${symbol}`);

    const price = mockPrices[symbol] || 100 + Math.random() * 100;
    return {
      symbol,
      price,
      change_24h: (Math.random() - 0.5) * 10,
      volume_24h: Math.random() * 1000000000,
    };
  }

  private getOhlcv(params: unknown): Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> {
    const request = MarketDataRequestSchema.parse(params);

    console.log(`[trading] Getting OHLCV for ${request.symbol}`);

    const basePrice = mockPrices[request.symbol] || 100;
    const candles = [];
    const now = Date.now();
    const intervalMs = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    }[request.interval];

    for (let i = request.limit - 1; i >= 0; i--) {
      const variance = basePrice * 0.02;
      const open = basePrice + (Math.random() - 0.5) * variance;
      const close = basePrice + (Math.random() - 0.5) * variance;
      const high = Math.max(open, close) + Math.random() * variance * 0.5;
      const low = Math.min(open, close) - Math.random() * variance * 0.5;

      candles.push({
        timestamp: now - i * intervalMs,
        open,
        high,
        low,
        close,
        volume: Math.random() * 10000,
      });
    }

    return candles;
  }

  private placeOrder(params: unknown, context: ExecutionContext): {
    order_id: string;
    status: string;
    filled: number;
    remaining: number;
    price: number;
    dry_run: boolean;
  } {
    const request = OrderRequestSchema.parse(params);

    console.log(`[trading] ${request.dry_run ? 'DRY RUN' : 'PLACING'} ${request.side} order for ${request.amount} ${request.symbol}`);

    const price = request.price || mockPrices[request.symbol] || 100;

    return {
      order_id: `ord-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: request.dry_run ? 'simulated' : 'pending',
      filled: request.type === 'market' ? request.amount : 0,
      remaining: request.type === 'market' ? 0 : request.amount,
      price,
      dry_run: request.dry_run,
    };
  }

  private getPortfolio(params: unknown): {
    total_value_usd: number;
    holdings: Array<{ asset: string; amount: number; value_usd: number }>;
  } {
    console.log(`[trading] Getting portfolio`);

    const holdings = [
      { asset: 'BTC', amount: 0.5, value_usd: 0.5 * 43500 },
      { asset: 'ETH', amount: 5, value_usd: 5 * 2280 },
      { asset: 'USDT', amount: 5000, value_usd: 5000 },
    ];

    return {
      total_value_usd: holdings.reduce((sum, h) => sum + h.value_usd, 0),
      holdings,
    };
  }

  private getSignal(params: unknown): {
    signal: 'buy' | 'sell' | 'hold';
    strength: number;
    indicators: Record<string, number>;
    reasoning: string;
  } {
    const request = SignalRequestSchema.parse(params);

    console.log(`[trading] Getting ${request.strategy} signal for ${request.symbol}`);

    // Simulate strategy signals
    const signals: Array<'buy' | 'sell' | 'hold'> = ['buy', 'sell', 'hold'];
    const signal = signals[Math.floor(Math.random() * 3)];
    const strength = Math.random();

    const indicators: Record<string, number> = {
      rsi: 30 + Math.random() * 40,
      macd: (Math.random() - 0.5) * 100,
      volume_ratio: 0.5 + Math.random(),
    };

    return {
      signal,
      strength,
      indicators,
      reasoning: `${request.strategy.toUpperCase()} analysis: RSI at ${indicators.rsi.toFixed(1)}, MACD ${indicators.macd > 0 ? 'bullish' : 'bearish'}`,
    };
  }

  private listExchanges(): Array<{ id: string; name: string; type: 'cex' | 'dex' }> {
    return [
      { id: 'binance', name: 'Binance', type: 'cex' },
      { id: 'coinbase', name: 'Coinbase', type: 'cex' },
      { id: 'kraken', name: 'Kraken', type: 'cex' },
      { id: 'uniswap', name: 'Uniswap', type: 'dex' },
      { id: 'sushiswap', name: 'SushiSwap', type: 'dex' },
      { id: 'jupiter', name: 'Jupiter', type: 'dex' },
    ];
  }
}
