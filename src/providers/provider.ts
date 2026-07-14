import type { SearchProvider } from '../core/search/search.types.js';
import type { AppConfig } from '../shared/config.js';
import type { Logger } from '../shared/logger.js';
import { ProviderError } from '../shared/errors.js';

/**
 * ProviderManager — selects and manages search providers.
 *
 * Selects the active provider based on config (SEARCH_PROVIDER).
 * Performs health checks and provides diagnostic information.
 *
 * Future: fallback logic when primary provider is unavailable.
 */
export class ProviderManager {
  private readonly providers = new Map<string, SearchProvider>();

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  /**
   * Registers a search provider.
   *
   * @param provider - The provider to register
   */
  register(provider: SearchProvider): void {
    this.providers.set(provider.name, provider);
    this.logger.info({ provider: provider.name }, 'Provider registered');
  }

  /**
   * Returns the active search provider based on configuration.
   *
   * @throws ProviderError if the configured provider is not registered
   */
  getActiveProvider(): SearchProvider {
    const name = this.config.provider.search;
    const provider = this.providers.get(name);

    if (!provider) {
      const available = Array.from(this.providers.keys()).join(', ');
      throw new ProviderError({
        provider: name,
        message: `Provider "${name}" is not registered. Available: ${available || 'none'}`,
        code: 'PROVIDER_NOT_FOUND',
      });
    }

    return provider;
  }

  /**
   * Checks health of the active provider.
   *
   * @returns true if the active provider is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const provider = this.getActiveProvider();
      const available = await provider.isAvailable();

      this.logger.info({
        provider: provider.name,
        available,
      }, 'Provider health check');

      return available;
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Provider health check failed');

      return false;
    }
  }

  /**
   * Returns all registered provider names.
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
