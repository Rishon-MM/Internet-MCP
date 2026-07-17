import { BaseConnector } from '../connector.js';
import { ConnectorError } from '../../../shared/errors.js';

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        currency: string;
        exchangeName: string;
        regularMarketPrice: number;
        previousClose: number;
        regularMarketTime: number;
      };
      indicators: {
        quote: Array<{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

export interface StockQuote {
  readonly symbol: string;
  readonly price: number;
  readonly previousClose: number;
  readonly change: number;
  readonly changePercent: number;
  readonly currency: string;
  readonly exchange: string;
  readonly lastUpdated: string;
}

/**
 * StocksConnector — stock quotes via Yahoo Finance public chart API.
 *
 * No API key required. Uses the publicly available chart endpoint.
 * Symbols should be standard ticker format (e.g., AAPL, MSFT, TSLA).
 */
export class StocksConnector extends BaseConnector {
  readonly name = 'stocks';
  readonly description = 'Stock quotes via Yahoo Finance';

  async getQuote(symbol: string): Promise<StockQuote> {
    const upperSymbol = symbol.toUpperCase();
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upperSymbol)}?interval=1d&range=1d`;

    try {
      const data = await this.fetchJson<YahooChartResponse>(url);

      if (data.chart.error) {
        throw new Error(data.chart.error.description);
      }

      const result = data.chart.result?.[0];
      if (!result) {
        throw new Error(`No data found for symbol "${upperSymbol}". Use standard ticker format (e.g., AAPL, MSFT, GOOGL).`);
      }

      const { meta } = result;
      const change = meta.regularMarketPrice - meta.previousClose;
      const changePercent = (change / meta.previousClose) * 100;

      return {
        symbol: meta.symbol,
        price: Math.round(meta.regularMarketPrice * 100) / 100,
        previousClose: Math.round(meta.previousClose * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        currency: meta.currency,
        exchange: meta.exchangeName,
        lastUpdated: new Date(meta.regularMarketTime * 1000).toISOString(),
      };
    } catch (error) {
      throw new ConnectorError({
        connector: this.name,
        message: `Failed to fetch quote for "${upperSymbol}"`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
