import { BaseConnector } from '../connector.js';
import { ConnectorError } from '../../../shared/errors.js';

interface CoinGeckoMarketData {
  [coinId: string]: {
    usd?: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    usd_24h_change?: number;
    last_updated_at?: number;
    [key: string]: number | undefined;
  };
}

export interface CryptoPrice {
  readonly coinId: string;
  readonly currency: string;
  readonly price: number;
  readonly marketCap: number;
  readonly volume24h: number;
  readonly change24h: number;
  readonly lastUpdated: string;
}

/**
 * CryptoConnector — cryptocurrency prices via CoinGecko API.
 *
 * Supports both keyless (public, ~10-30 calls/min) and optional
 * Demo API key (100 calls/min) via COINGECKO_API_KEY env var.
 *
 * https://docs.coingecko.com/reference/introduction
 */
export class CryptoConnector extends BaseConnector {
  readonly name = 'crypto';
  readonly description = 'Cryptocurrency prices via CoinGecko';

  private get baseUrl(): string {
    return this.config.connectors.coingeckoApiKey
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
  }

  async getPrice(coinId: string, vsCurrency: string = 'usd'): Promise<CryptoPrice> {
    const currency = vsCurrency.toLowerCase();
    const url = `${this.baseUrl}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=${currency}&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`;

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (this.config.connectors.coingeckoApiKey) {
        headers['x-cg-pro-api-key'] = this.config.connectors.coingeckoApiKey;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.config.connectors.fetchTimeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as CoinGeckoMarketData;
      const coinData = data[coinId];

      if (!coinData) {
        throw new Error(`No data found for coin "${coinId}". Use CoinGecko coin IDs (e.g., "bitcoin", "ethereum", "solana").`);
      }

      const price = coinData[currency];
      if (price === undefined) {
        throw new Error(`No price in ${currency} for "${coinId}". Try "usd", "eur", or "gbp".`);
      }

      return {
        coinId,
        currency,
        price,
        marketCap: coinData[`${currency}_market_cap`] ?? 0,
        volume24h: coinData[`${currency}_24h_vol`] ?? 0,
        change24h: coinData[`${currency}_24h_change`] ?? 0,
        lastUpdated: coinData.last_updated_at
          ? new Date(coinData.last_updated_at * 1000).toISOString()
          : new Date().toISOString(),
      };
    } catch (error) {
      throw new ConnectorError({
        connector: this.name,
        message: `Failed to fetch price for "${coinId}"`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
