import type { Logger } from '../../../shared/logger.js';

/**
 * BrowserRenderer — headless browser rendering via Playwright.
 *
 * Used as a fallback when plain fetch() returns thin content from
 * JS-rendered pages (SPAs, client-hydrated apps, script-gated sites).
 *
 * Design:
 * - Lazy browser launch: Chromium is only spawned on first render()
 * - Singleton browser: one process, reused across calls
 * - Isolated contexts: each render() gets a fresh BrowserContext
 * - Graceful unavailability: if Playwright isn't installed, isAvailable() = false
 * - Resource blocking: images, fonts, media blocked to speed rendering
 */

/** Playwright types imported dynamically */
type PlaywrightBrowser = import('playwright').Browser;

export class BrowserRenderer {
  private browser: PlaywrightBrowser | null = null;
  private launching: Promise<PlaywrightBrowser> | null = null;
  private static available: boolean | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly renderTimeout: number = 30_000,
  ) {}

  /**
   * Checks whether Playwright is available on this system.
   *
   * Tries a dynamic import once and caches the result.
   * Returns false if Playwright is not installed — this is expected
   * in Docker environments and when the user hasn't opted in.
   */
  static async isAvailable(): Promise<boolean> {
    if (BrowserRenderer.available !== null) {
      return BrowserRenderer.available;
    }

    try {
      await import('playwright');
      BrowserRenderer.available = true;
    } catch {
      BrowserRenderer.available = false;
    }

    return BrowserRenderer.available;
  }

  /**
   * Renders a URL in a headless Chromium browser and returns the
   * final DOM HTML after JavaScript execution.
   *
   * Each call creates an isolated BrowserContext (clean cookies,
   * no shared state) and destroys it after extraction.
   *
   * @param url - The URL to render
   * @returns The full HTML of the rendered page
   * @throws If rendering fails or times out
   */
  async render(url: string): Promise<string> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      // Disable loading images, fonts, media — we only need the DOM
      bypassCSP: true,
    });

    const page = await context.newPage();

    try {
      // Block heavy resources to speed up rendering
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
          return route.abort();
        }
        return route.continue();
      });

      // Navigate and wait for network to settle
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.renderTimeout,
      });

      // Extract the rendered HTML
      const html = await page.content();

      this.logger.debug({
        url,
        htmlLength: html.length,
      }, 'Browser render completed');

      return html;
    } finally {
      await context.close();
    }
  }

  /**
   * Closes the browser instance and releases resources.
   * Safe to call multiple times.
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.launching = null;
      this.logger.info('Browser renderer closed');
    }
  }

  /**
   * Gets or lazily launches the shared browser instance.
   *
   * Uses a launch promise to prevent concurrent launches
   * if multiple renders are requested simultaneously.
   */
  private async getBrowser(): Promise<PlaywrightBrowser> {
    if (this.browser) {
      return this.browser;
    }

    if (!this.launching) {
      this.launching = this.launchBrowser();
    }

    return this.launching;
  }

  /**
   * Launches Chromium via Playwright with minimal configuration.
   */
  private async launchBrowser(): Promise<PlaywrightBrowser> {
    this.logger.info('Launching headless Chromium for browser rendering');

    const { chromium } = await import('playwright');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',  // Prevents issues in Docker
        '--no-sandbox',             // Required for Docker
        '--disable-setuid-sandbox',
      ],
    });

    this.logger.info('Headless Chromium launched');
    return this.browser;
  }
}
