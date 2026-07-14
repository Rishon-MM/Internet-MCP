import { describe, it, expect } from 'vitest';
import { HtmlExtractor } from '../../core/extract/html.extractor.js';

describe('HtmlExtractor', () => {
  const extractor = new HtmlExtractor();

  describe('canHandle', () => {
    it('should handle text/html', () => {
      expect(extractor.canHandle('https://example.com', 'text/html')).toBe(true);
    });

    it('should handle text/xhtml', () => {
      expect(extractor.canHandle('https://example.com', 'text/xhtml+xml')).toBe(true);
    });

    it('should not handle application/json', () => {
      expect(extractor.canHandle('https://example.com', 'application/json')).toBe(false);
    });
  });

  describe('extract', () => {
    it('should extract title from h1', () => {
      const html = '<html><body><h1>My Title</h1><p>Content here</p></body></html>';
      const result = extractor.extract(html, 'https://example.com');

      expect(result.title).toBe('My Title');
    });

    it('should extract title from <title> when no h1', () => {
      const html = '<html><head><title>Page Title</title></head><body><p>Content</p></body></html>';
      const result = extractor.extract(html, 'https://example.com');

      expect(result.title).toBe('Page Title');
    });

    it('should strip script and style tags', () => {
      const html = `
        <html><body>
          <script>alert('xss')</script>
          <style>.hidden { display: none }</style>
          <p>Visible content</p>
        </body></html>
      `;
      const result = extractor.extract(html, 'https://example.com');

      expect(result.markdown).not.toContain('alert');
      expect(result.markdown).not.toContain('.hidden');
      expect(result.markdown).toContain('Visible content');
    });

    it('should strip navigation elements', () => {
      const html = `
        <html><body>
          <nav><a href="/">Home</a><a href="/about">About</a></nav>
          <article><p>Article content with more than enough text to be considered real content by the extractor algorithm.</p></article>
          <footer>Footer info</footer>
        </body></html>
      `;
      const result = extractor.extract(html, 'https://example.com');

      expect(result.markdown).toContain('Article content');
      expect(result.markdown).not.toContain('Footer info');
    });

    it('should convert headings to Markdown', () => {
      const html = '<html><body><article><h2>Section</h2><p>Paragraph text with enough content for the extractor to process it correctly in testing.</p></article></body></html>';
      const result = extractor.extract(html, 'https://example.com');

      expect(result.markdown).toContain('## Section');
    });

    it('should convert links to Markdown', () => {
      const html = '<html><body><article><p>Visit <a href="https://example.com">Example Site</a> for more content about testing the extractor.</p></article></body></html>';
      const result = extractor.extract(html, 'https://example.com');

      expect(result.markdown).toContain('[Example Site](https://example.com)');
    });

    it('should count words', () => {
      const html = '<html><body><p>One two three four five</p></body></html>';
      const result = extractor.extract(html, 'https://example.com');

      expect(result.wordCount).toBeGreaterThanOrEqual(5);
    });

    it('should return "Untitled" when no title found', () => {
      const html = '<html><body><p>Just content</p></body></html>';
      const result = extractor.extract(html, 'https://example.com');

      expect(result.title).toBe('Untitled');
    });
  });
});
