/**
 * Memory Adapter
 *
 * Handles vector storage and memory management for AI systems.
 * Supports embedding, storing, and retrieving contextual information.
 */

import { z } from 'zod';
import {
  AdapterInfo,
  AdapterMethod,
  ExecutionContext,
} from '../types/index.js';
import { BaseAdapter } from './base.js';

// Memory request/response schemas
export const MemoryStoreRequestSchema = z.object({
  collection: z.string(),
  documents: z.array(z.object({
    id: z.string().optional(),
    text: z.string(),
    metadata: z.record(z.unknown()).optional(),
  })),
  embed_model: z.string().optional().default('all-minilm'),
});

export const MemoryQueryRequestSchema = z.object({
  collection: z.string(),
  query: z.string(),
  top_k: z.number().optional().default(5),
  filter: z.record(z.unknown()).optional(),
  embed_model: z.string().optional().default('all-minilm'),
});

export const MemoryQueryResponseSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    text: z.string(),
    score: z.number(),
    metadata: z.record(z.unknown()).optional(),
  })),
});

export type MemoryStoreRequest = z.infer<typeof MemoryStoreRequestSchema>;
export type MemoryQueryRequest = z.infer<typeof MemoryQueryRequestSchema>;
export type MemoryQueryResponse = z.infer<typeof MemoryQueryResponseSchema>;

// In-memory vector store for demo
interface VectorDoc {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

const collections: Map<string, VectorDoc[]> = new Map();

export class MemoryAdapter extends BaseAdapter {
  readonly info: AdapterInfo = {
    name: 'memory',
    version: '0.1.0',
    description: 'Vector memory storage - embeddings, semantic search, and context retrieval',
    capabilities: ['vector-store', 'semantic-search', 'embeddings'],
    requirements: {
      memory: {
        min_mb: 2048,
      },
    },
  };

  readonly methods: Map<string, AdapterMethod> = new Map([
    [
      'store',
      {
        name: 'store',
        description: 'Store documents with embeddings in a collection',
        parameters: MemoryStoreRequestSchema,
        returns: z.object({
          stored: z.number(),
          collection: z.string(),
        }),
      },
    ],
    [
      'query',
      {
        name: 'query',
        description: 'Query similar documents from a collection',
        parameters: MemoryQueryRequestSchema,
        returns: MemoryQueryResponseSchema,
      },
    ],
    [
      'delete',
      {
        name: 'delete',
        description: 'Delete documents or entire collection',
        parameters: z.object({
          collection: z.string(),
          ids: z.array(z.string()).optional(),
        }),
        returns: z.object({ deleted: z.number() }),
      },
    ],
    [
      'list_collections',
      {
        name: 'list_collections',
        description: 'List all memory collections',
        parameters: z.object({}),
        returns: z.array(z.object({
          name: z.string(),
          count: z.number(),
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
      case 'store':
        return this.store(params, context);
      case 'query':
        return this.query(params, context);
      case 'delete':
        return this.delete(params);
      case 'list_collections':
        return this.listCollections();
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async store(
    params: unknown,
    context: ExecutionContext
  ): Promise<{ stored: number; collection: string }> {
    const request = MemoryStoreRequestSchema.parse(params);

    console.log(`[memory] Storing ${request.documents.length} documents in ${request.collection}`);

    if (!collections.has(request.collection)) {
      collections.set(request.collection, []);
    }

    const docs = collections.get(request.collection)!;

    for (const doc of request.documents) {
      const id = doc.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Generate simple embedding (in production, use actual embedding model)
      const embedding = this.simpleEmbed(doc.text);

      docs.push({
        id,
        text: doc.text,
        embedding,
        metadata: doc.metadata,
      });
    }

    return {
      stored: request.documents.length,
      collection: request.collection,
    };
  }

  private async query(
    params: unknown,
    context: ExecutionContext
  ): Promise<MemoryQueryResponse> {
    const request = MemoryQueryRequestSchema.parse(params);

    console.log(`[memory] Querying ${request.collection}: "${request.query}"`);

    const docs = collections.get(request.collection) || [];
    const queryEmbedding = this.simpleEmbed(request.query);

    // Calculate similarity scores
    const scored = docs.map(doc => ({
      ...doc,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    // Sort by score and take top_k
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, request.top_k);

    return {
      results: results.map(r => ({
        id: r.id,
        text: r.text,
        score: r.score,
        metadata: r.metadata,
      })),
    };
  }

  private delete(params: unknown): { deleted: number } {
    const { collection, ids } = z.object({
      collection: z.string(),
      ids: z.array(z.string()).optional(),
    }).parse(params);

    if (!collections.has(collection)) {
      return { deleted: 0 };
    }

    if (!ids) {
      // Delete entire collection
      const count = collections.get(collection)!.length;
      collections.delete(collection);
      return { deleted: count };
    }

    // Delete specific documents
    const docs = collections.get(collection)!;
    const before = docs.length;
    const remaining = docs.filter(d => !ids.includes(d.id));
    collections.set(collection, remaining);
    return { deleted: before - remaining.length };
  }

  private listCollections(): Array<{ name: string; count: number }> {
    return Array.from(collections.entries()).map(([name, docs]) => ({
      name,
      count: docs.length,
    }));
  }

  // Simple embedding function (word frequency based)
  private simpleEmbed(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const vocab = new Set(words);
    const embedding = new Array(128).fill(0);

    for (const word of words) {
      const hash = this.hashString(word) % 128;
      embedding[hash] += 1;
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(v => magnitude > 0 ? v / magnitude : 0);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }
}
