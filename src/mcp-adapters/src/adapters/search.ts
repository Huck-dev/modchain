/**
 * Search Adapter
 *
 * Handles web and data search operations - web search, news, knowledge bases.
 * Provides structured search results for AI agents.
 */

import { z } from 'zod';
import {
  AdapterInfo,
  AdapterMethod,
  ExecutionContext,
} from '../types/index.js';
import { BaseAdapter } from './base.js';

// Search request/response schemas
export const WebSearchRequestSchema = z.object({
  query: z.string(),
  num_results: z.number().optional().default(10),
  search_type: z.enum(['web', 'news', 'images', 'academic']).optional().default('web'),
  time_range: z.enum(['day', 'week', 'month', 'year', 'all']).optional().default('all'),
  safe_search: z.boolean().optional().default(true),
});

export const WebSearchResponseSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string(),
    source: z.string().optional(),
    published_date: z.string().optional(),
  })),
  total_results: z.number(),
  search_time_ms: z.number(),
});

export const FetchPageRequestSchema = z.object({
  url: z.string().url(),
  extract: z.enum(['text', 'markdown', 'html', 'structured']).optional().default('text'),
  max_length: z.number().optional().default(10000),
});

export const KnowledgeSearchRequestSchema = z.object({
  query: z.string(),
  sources: z.array(z.enum(['wikipedia', 'wikidata', 'dbpedia'])).optional(),
  language: z.string().optional().default('en'),
});

export type WebSearchRequest = z.infer<typeof WebSearchRequestSchema>;
export type WebSearchResponse = z.infer<typeof WebSearchResponseSchema>;

export class SearchAdapter extends BaseAdapter {
  readonly info: AdapterInfo = {
    name: 'search',
    version: '0.1.0',
    description: 'Web and data search - web search, news, knowledge bases',
    capabilities: ['web-search', 'news-search', 'page-fetching', 'knowledge-search'],
    requirements: {
      memory: {
        min_mb: 512,
      },
    },
  };

  readonly methods: Map<string, AdapterMethod> = new Map([
    [
      'web',
      {
        name: 'web',
        description: 'Search the web',
        parameters: WebSearchRequestSchema,
        returns: WebSearchResponseSchema,
      },
    ],
    [
      'news',
      {
        name: 'news',
        description: 'Search news articles',
        parameters: WebSearchRequestSchema,
        returns: WebSearchResponseSchema,
      },
    ],
    [
      'fetch_page',
      {
        name: 'fetch_page',
        description: 'Fetch and extract content from a web page',
        parameters: FetchPageRequestSchema,
        returns: z.object({
          title: z.string(),
          content: z.string(),
          url: z.string(),
          extracted_at: z.string(),
        }),
      },
    ],
    [
      'knowledge',
      {
        name: 'knowledge',
        description: 'Search knowledge bases (Wikipedia, Wikidata)',
        parameters: KnowledgeSearchRequestSchema,
        returns: z.object({
          results: z.array(z.object({
            title: z.string(),
            summary: z.string(),
            url: z.string(),
            source: z.string(),
          })),
        }),
      },
    ],
    [
      'summarize',
      {
        name: 'summarize',
        description: 'Summarize search results or a URL',
        parameters: z.object({
          url: z.string().url().optional(),
          text: z.string().optional(),
          max_length: z.number().optional().default(500),
        }),
        returns: z.object({
          summary: z.string(),
          key_points: z.array(z.string()),
        }),
      },
    ],
  ]);

  async execute(
    method: string,
    params: unknown,
    context: ExecutionContext
  ): Promise<unknown> {
    switch (method) {
      case 'web':
        return this.webSearch(params, context);
      case 'news':
        return this.newsSearch(params, context);
      case 'fetch_page':
        return this.fetchPage(params, context);
      case 'knowledge':
        return this.knowledgeSearch(params, context);
      case 'summarize':
        return this.summarize(params, context);
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async webSearch(
    params: unknown,
    context: ExecutionContext
  ): Promise<WebSearchResponse> {
    const request = WebSearchRequestSchema.parse(params);
    const startTime = Date.now();

    console.log(`[search] Web search: "${request.query}"`);

    // In production, this would call a search API (Google, Bing, DuckDuckGo, etc.)
    // For now, return simulated results
    const results = this.generateMockResults(request.query, request.num_results, 'web');

    return {
      results,
      total_results: 1000000 + Math.floor(Math.random() * 9000000),
      search_time_ms: Date.now() - startTime,
    };
  }

  private async newsSearch(
    params: unknown,
    context: ExecutionContext
  ): Promise<WebSearchResponse> {
    const request = WebSearchRequestSchema.parse(params);
    const startTime = Date.now();

    console.log(`[search] News search: "${request.query}"`);

    const results = this.generateMockResults(request.query, request.num_results, 'news');

    return {
      results,
      total_results: 10000 + Math.floor(Math.random() * 90000),
      search_time_ms: Date.now() - startTime,
    };
  }

  private async fetchPage(
    params: unknown,
    context: ExecutionContext
  ): Promise<{ title: string; content: string; url: string; extracted_at: string }> {
    const request = FetchPageRequestSchema.parse(params);

    console.log(`[search] Fetching page: ${request.url}`);

    try {
      const response = await fetch(request.url, {
        headers: {
          'User-Agent': 'RhizOS-Search/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      // Simple HTML to text extraction
      const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || 'Untitled';
      let content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (content.length > request.max_length) {
        content = content.slice(0, request.max_length) + '...';
      }

      return {
        title,
        content,
        url: request.url,
        extracted_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[search] Fetch error:`, error);
      return {
        title: 'Error',
        content: `Failed to fetch: ${error instanceof Error ? error.message : String(error)}`,
        url: request.url,
        extracted_at: new Date().toISOString(),
      };
    }
  }

  private async knowledgeSearch(
    params: unknown,
    context: ExecutionContext
  ): Promise<{ results: Array<{ title: string; summary: string; url: string; source: string }> }> {
    const request = KnowledgeSearchRequestSchema.parse(params);

    console.log(`[search] Knowledge search: "${request.query}"`);

    // In production, this would query Wikipedia API, Wikidata, etc.
    try {
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(request.query)}`;
      const response = await fetch(wikiUrl);

      if (response.ok) {
        const data = await response.json() as {
          title: string;
          extract: string;
          content_urls?: { desktop?: { page?: string } };
        };

        return {
          results: [{
            title: data.title,
            summary: data.extract,
            url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(request.query)}`,
            source: 'wikipedia',
          }],
        };
      }
    } catch (error) {
      console.error(`[search] Wikipedia error:`, error);
    }

    // Return mock data if Wikipedia fails
    return {
      results: [{
        title: request.query,
        summary: `Information about ${request.query} from knowledge base.`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(request.query)}`,
        source: 'wikipedia',
      }],
    };
  }

  private async summarize(
    params: unknown,
    context: ExecutionContext
  ): Promise<{ summary: string; key_points: string[] }> {
    const { url, text, max_length } = z.object({
      url: z.string().url().optional(),
      text: z.string().optional(),
      max_length: z.number().optional().default(500),
    }).parse(params);

    let content = text || '';

    if (url && !text) {
      const page = await this.fetchPage({ url, max_length: 5000 }, context);
      content = page.content;
    }

    console.log(`[search] Summarizing ${content.length} chars`);

    // Simple extractive summary (first sentences)
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const summary = sentences.slice(0, 3).join('. ') + '.';

    const keyPoints = sentences.slice(0, 5).map(s => s.trim().slice(0, 100));

    return {
      summary: summary.slice(0, max_length),
      key_points: keyPoints,
    };
  }

  private generateMockResults(
    query: string,
    count: number,
    type: 'web' | 'news'
  ): Array<{ title: string; url: string; snippet: string; source?: string; published_date?: string }> {
    const results = [];
    const domains = type === 'news'
      ? ['reuters.com', 'bbc.com', 'cnn.com', 'nytimes.com', 'theguardian.com']
      : ['example.com', 'docs.example.com', 'blog.example.com', 'github.com', 'stackoverflow.com'];

    for (let i = 0; i < count; i++) {
      const domain = domains[i % domains.length];
      results.push({
        title: `${query} - Result ${i + 1} | ${domain}`,
        url: `https://${domain}/${query.toLowerCase().replace(/\s+/g, '-')}/${i}`,
        snippet: `This is a search result about ${query}. It contains relevant information that matches your search query...`,
        source: domain,
        published_date: type === 'news'
          ? new Date(Date.now() - Math.random() * 86400000 * 7).toISOString()
          : undefined,
      });
    }

    return results;
  }
}
