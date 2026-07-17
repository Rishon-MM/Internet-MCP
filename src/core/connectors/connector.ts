/**
 * Connector interface — the contract for all data connectors.
 *
 * Connectors provide structured data from external APIs (weather,
 * currency, crypto, etc.). Unlike retrieval services (search/fetch),
 * connectors return typed domain objects, not raw web content.
 *
 * All connectors are stateless and use free, public APIs.
 */

import type { Logger } from '../../shared/logger.js';
import type { AppConfig } from '../../shared/config.js';

export interface Connector {
  /** Unique connector name (e.g., 'weather', 'currency') */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;
}

/**
 * Base class for connectors that call external HTTP APIs.
 *
 * Provides shared fetch logic with timeout, User-Agent, and error handling.
 */
export abstract class BaseConnector implements Connector {
  abstract readonly name: string;
  abstract readonly description: string;

  constructor(
    protected readonly logger: Logger,
    protected readonly config: AppConfig,
  ) {}

  /**
   * Makes an HTTP GET request with standard timeout and headers.
   */
  protected async fetchJson<T>(
    url: string,
    options?: { userAgent?: string; timeout?: number },
  ): Promise<T> {
    const timeout = options?.timeout ?? this.config.connectors.fetchTimeout;
    const userAgent = options?.userAgent ?? this.config.connectors.userAgent;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': userAgent,
      },
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Makes an HTTP GET request and returns raw text.
   */
  protected async fetchText(
    url: string,
    options?: { userAgent?: string; timeout?: number },
  ): Promise<string> {
    const timeout = options?.timeout ?? this.config.connectors.fetchTimeout;
    const userAgent = options?.userAgent ?? this.config.connectors.userAgent;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
      },
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }

    return response.text();
  }
}
