import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import type { ContentExtractor, ExtractionResult } from './extractor.js';
import { cleanMarkdown } from './markdown.js';

/**
 * HTML content extractor using JSDOM + Turndown.
 *
 * Pipeline:
 * 1. Parse HTML with JSDOM
 * 2. Strip noise elements (scripts, styles, nav, ads, hidden elements)
 * 3. Extract main content area (article, main, or body fallback)
 * 4. Convert to Markdown with Turndown
 * 5. Post-process Markdown (normalize whitespace, headings, links)
 */
export class HtmlExtractor implements ContentExtractor {
  readonly name = 'html';

  private readonly turndown: TurndownService;

  /** Elements to remove before extraction */
  private static readonly NOISE_SELECTORS = [
    'script',
    'style',
    'noscript',
    'iframe',
    'nav',
    'header',
    'footer',
    'aside',
    'form',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]',
    '[role="contentinfo"]',
    '[aria-hidden="true"]',
    '.cookie-banner',
    '.cookie-consent',
    '.ad',
    '.ads',
    '.advertisement',
    '.social-share',
    '.share-buttons',
    '.comments',
    '.sidebar',
    '.popup',
    '.modal',
    '.newsletter',
  ];

  /** Selectors for main content, tried in order */
  private static readonly CONTENT_SELECTORS = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
  ];

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
    });

    // Skip images to keep output text-focused for LLMs
    this.turndown.addRule('removeImages', {
      filter: 'img',
      replacement: () => '',
    });
  }

  canHandle(_url: string, contentType: string): boolean {
    return contentType.includes('text/html') || contentType.includes('text/xhtml');
  }

  extract(html: string, url: string): ExtractionResult {
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // Extract title before stripping elements
    const title = this.extractTitle(document);

    // Remove noise elements
    this.stripNoise(document);

    // Find main content
    const contentElement = this.findMainContent(document);

    // Convert to Markdown
    const rawMarkdown = this.turndown.turndown(contentElement.innerHTML);

    // Post-process
    const markdown = cleanMarkdown(rawMarkdown);

    // Count words
    const wordCount = this.countWords(markdown);

    return { title, markdown, wordCount };
  }

  private extractTitle(document: Document): string {
    // Try <h1> first, then <title>
    const h1 = document.querySelector('h1');
    if (h1?.textContent?.trim()) {
      return h1.textContent.trim();
    }

    const titleEl = document.querySelector('title');
    if (titleEl?.textContent?.trim()) {
      return titleEl.textContent.trim();
    }

    // Try Open Graph title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.getAttribute('content')?.trim()) {
      return ogTitle.getAttribute('content')!.trim();
    }

    return 'Untitled';
  }

  private stripNoise(document: Document): void {
    for (const selector of HtmlExtractor.NOISE_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        el.remove();
      }
    }

    // Remove hidden elements
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const style = (el as HTMLElement).getAttribute('style') ?? '';
      if (style.includes('display:none') || style.includes('display: none') ||
          style.includes('visibility:hidden') || style.includes('visibility: hidden')) {
        el.remove();
      }
    }
  }

  private findMainContent(document: Document): Element {
    for (const selector of HtmlExtractor.CONTENT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && el.textContent && el.textContent.trim().length > 100) {
        return el;
      }
    }

    // Fallback to body
    return document.body ?? document.documentElement;
  }

  private countWords(text: string): number {
    return text
      .replace(/[#*\-_`\[\]()>|]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }
}
