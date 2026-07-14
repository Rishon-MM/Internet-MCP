import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../shared/config.js';

describe('Config', () => {
  describe('loadConfig', () => {
    it('should load defaults when no env vars are set', () => {
      const config = loadConfig({});

      expect(config.provider.search).toBe('searxng');
      expect(config.searxng.baseUrl).toBe('http://localhost:8080');
      expect(config.searxng.timeout).toBe(5000);
      expect(config.searxng.safeSearch).toBe(0);
      expect(config.cache.searchTtl).toBe(300);
      expect(config.cache.pageTtl).toBe(86400);
      expect(config.cache.docTtl).toBe(86400);
      expect(config.cache.pdfTtl).toBe(2592000);
      expect(config.transport.type).toBe('stdio');
      expect(config.transport.httpPort).toBe(3000);
      expect(config.logging.level).toBe('info');
    });

    it('should load from environment variables', () => {
      const config = loadConfig({
        SEARCH_PROVIDER: 'searxng',
        SEARXNG_BASE_URL: 'http://my-searxng:9090',
        SEARXNG_TIMEOUT: '10000',
        SEARXNG_SAFE_SEARCH: '2',
        SEARCH_CACHE_TTL: '600',
        PAGE_CACHE_TTL: '3600',
        DOC_CACHE_TTL: '7200',
        PDF_CACHE_TTL: '86400',
        TRANSPORT: 'http',
        HTTP_PORT: '8080',
        LOG_LEVEL: 'debug',
      });

      expect(config.searxng.baseUrl).toBe('http://my-searxng:9090');
      expect(config.searxng.timeout).toBe(10000);
      expect(config.searxng.safeSearch).toBe(2);
      expect(config.cache.searchTtl).toBe(600);
      expect(config.cache.pageTtl).toBe(3600);
      expect(config.transport.type).toBe('http');
      expect(config.transport.httpPort).toBe(8080);
      expect(config.logging.level).toBe('debug');
    });

    it('should throw on invalid provider', () => {
      expect(() => loadConfig({ SEARCH_PROVIDER: 'invalid' })).toThrow('Invalid configuration');
    });

    it('should throw on invalid URL', () => {
      expect(() => loadConfig({ SEARXNG_BASE_URL: 'not-a-url' })).toThrow('Invalid configuration');
    });

    it('should throw on invalid transport', () => {
      expect(() => loadConfig({ TRANSPORT: 'websocket' })).toThrow('Invalid configuration');
    });

    it('should throw on invalid log level', () => {
      expect(() => loadConfig({ LOG_LEVEL: 'verbose' })).toThrow('Invalid configuration');
    });

    it('should return a frozen object', () => {
      const config = loadConfig({});
      expect(Object.isFrozen(config)).toBe(true);
    });
  });
});
