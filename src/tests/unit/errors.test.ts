import { describe, it, expect } from 'vitest';
import {
  AppError,
  ProviderError,
  FetchError,
  ExtractionError,
  ConfigError,
  ValidationError,
} from '../../shared/errors.js';

describe('Errors', () => {
  describe('AppError', () => {
    it('should create an error with code and message', () => {
      const error = new AppError({ code: 'TEST_ERROR', message: 'Test error' });

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.cause).toBeUndefined();
      expect(error.name).toBe('AppError');
    });

    it('should include cause when provided', () => {
      const cause = new Error('Original error');
      const error = new AppError({ code: 'TEST', message: 'Wrapped', cause });

      expect(error.cause).toBe(cause);
    });

    it('should serialize to JSON', () => {
      const error = new AppError({ code: 'TEST', message: 'Test', statusCode: 400 });
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'AppError',
        code: 'TEST',
        message: 'Test',
        statusCode: 400,
        cause: undefined,
      });
    });
  });

  describe('ProviderError', () => {
    it('should include provider name in message', () => {
      const error = new ProviderError({ provider: 'searxng', message: 'Connection refused' });

      expect(error.message).toBe('[searxng] Connection refused');
      expect(error.provider).toBe('searxng');
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('PROVIDER_ERROR');
    });
  });

  describe('FetchError', () => {
    it('should include URL', () => {
      const error = new FetchError({ url: 'https://example.com', message: 'Timeout' });

      expect(error.url).toBe('https://example.com');
      expect(error.statusCode).toBe(502);
    });
  });

  describe('ExtractionError', () => {
    it('should have correct defaults', () => {
      const error = new ExtractionError({ message: 'Parse failed' });

      expect(error.code).toBe('EXTRACTION_ERROR');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('ConfigError', () => {
    it('should have CONFIG_ERROR code', () => {
      const error = new ConfigError({ message: 'Missing SEARXNG_BASE_URL' });

      expect(error.code).toBe('CONFIG_ERROR');
    });
  });

  describe('ValidationError', () => {
    it('should have 400 status code', () => {
      const error = new ValidationError({ message: 'Invalid query' });

      expect(error.statusCode).toBe(400);
    });
  });
});
