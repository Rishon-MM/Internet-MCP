import { z } from 'zod/v4';

/**
 * Configuration schema validated from environment variables.
 *
 * All values are sourced from process.env — nothing is hardcoded.
 * Each section groups related configuration together.
 */

const SearchProviderSchema = z.enum(['searxng', 'brave', 'tavily']);

const ConfigSchema = z.object({
  /** Active search provider */
  provider: z.object({
    search: SearchProviderSchema,
  }),

  /** SearXNG provider configuration */
  searxng: z.object({
    baseUrl: z.url(),
    timeout: z.number().int().positive(),
    safeSearch: z.number().int().min(0).max(2),
  }),

  /** Cache TTLs in seconds — per content type */
  cache: z.object({
    searchTtl: z.number().int().nonnegative(),
    pageTtl: z.number().int().nonnegative(),
    docTtl: z.number().int().nonnegative(),
    pdfTtl: z.number().int().nonnegative(),
    maxEntries: z.number().int().positive(),
  }),

  /** MCP transport configuration */
  transport: z.object({
    type: z.enum(['stdio', 'http']),
    httpPort: z.number().int().min(1).max(65535),
  }),

  /** Fetch configuration */
  fetch: z.object({
    timeout: z.number().int().positive(),
    maxSize: z.number().int().positive(),
  }),

  /** Logging configuration */
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
  }),

  /** Connector configuration */
  connectors: z.object({
    userAgent: z.string().min(1),
    fetchTimeout: z.number().int().positive(),
    cacheTtl: z.number().int().nonnegative(),
    coingeckoApiKey: z.string().optional(),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
export type SearchProvider = z.infer<typeof SearchProviderSchema>;

/**
 * Loads and validates configuration from environment variables.
 *
 * Returns a frozen, immutable config object. Throws `ConfigError`
 * if any required value is missing or invalid.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const raw = {
    provider: {
      search: env['SEARCH_PROVIDER'] ?? 'searxng',
    },
    searxng: {
      baseUrl: env['SEARXNG_BASE_URL'] ?? 'http://localhost:8080',
      timeout: Number(env['SEARXNG_TIMEOUT'] ?? '5000'),
      safeSearch: Number(env['SEARXNG_SAFE_SEARCH'] ?? '0'),
    },
    cache: {
      searchTtl: Number(env['SEARCH_CACHE_TTL'] ?? '300'),
      pageTtl: Number(env['PAGE_CACHE_TTL'] ?? '86400'),
      docTtl: Number(env['DOC_CACHE_TTL'] ?? '86400'),
      pdfTtl: Number(env['PDF_CACHE_TTL'] ?? '2592000'),
      maxEntries: Number(env['CACHE_MAX_ENTRIES'] ?? '500'),
    },
    transport: {
      type: env['TRANSPORT'] ?? 'stdio',
      httpPort: Number(env['HTTP_PORT'] ?? '3000'),
    },
    fetch: {
      timeout: Number(env['FETCH_TIMEOUT'] ?? '15000'),
      maxSize: Number(env['FETCH_MAX_SIZE'] ?? '5242880'),
    },
    logging: {
      level: env['LOG_LEVEL'] ?? 'info',
    },
    connectors: {
      userAgent: env['CONNECTOR_USER_AGENT'] ?? 'internet-mcp/0.1.0',
      fetchTimeout: Number(env['CONNECTOR_FETCH_TIMEOUT'] ?? '10000'),
      cacheTtl: Number(env['CONNECTOR_CACHE_TTL'] ?? '300'),
      coingeckoApiKey: env['COINGECKO_API_KEY'] || undefined,
    },
  };

  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  return Object.freeze(result.data);
}
