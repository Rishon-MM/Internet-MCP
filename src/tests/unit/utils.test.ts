import { describe, it, expect } from 'vitest';
import { generateRequestId, truncateText, isValidUrl, detectContentType } from '../../shared/utils.js';

describe('Utils', () => {
  describe('generateRequestId', () => {
    it('should return a string', () => {
      const id = generateRequestId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should return unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('truncateText', () => {
    it('should return text unchanged if under limit', () => {
      expect(truncateText('hello', 10)).toBe('hello');
    });

    it('should truncate at word boundary', () => {
      const result = truncateText('hello world foo bar baz', 15);
      expect(result).toBe('hello world...');
    });

    it('should handle exact length', () => {
      expect(truncateText('hello', 5)).toBe('hello');
    });
  });

  describe('isValidUrl', () => {
    it('should accept http URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should accept https URLs', () => {
      expect(isValidUrl('https://example.com/path?q=test')).toBe(true);
    });

    it('should reject ftp URLs', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('detectContentType', () => {
    it('should detect PDF from URL extension', () => {
      expect(detectContentType('https://example.com/doc.pdf')).toBe('pdf');
    });

    it('should detect PDF from content-type header', () => {
      expect(detectContentType('https://example.com/file', 'application/pdf')).toBe('pdf');
    });

    it('should detect doc from URL extension', () => {
      expect(detectContentType('https://example.com/file.docx')).toBe('doc');
    });

    it('should default to page', () => {
      expect(detectContentType('https://example.com/page')).toBe('page');
    });

    it('should default to page for HTML', () => {
      expect(detectContentType('https://example.com', 'text/html')).toBe('page');
    });
  });
});
