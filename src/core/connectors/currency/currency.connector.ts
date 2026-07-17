import { BaseConnector } from '../connector.js';
import { ConnectorError } from '../../../shared/errors.js';

interface FrankfurterRatesResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface FrankfurterCurrenciesResponse {
  [code: string]: string;
}

export interface CurrencyConversion {
  readonly amount: number;
  readonly from: string;
  readonly to: string;
  readonly result: number;
  readonly rate: number;
  readonly date: string;
}

export interface CurrencyInfo {
  readonly code: string;
  readonly name: string;
}

/**
 * CurrencyConnector — exchange rates and conversion via Frankfurter API.
 *
 * Free, no API key required. Data sourced from European Central Bank.
 * https://frankfurter.dev
 */
export class CurrencyConnector extends BaseConnector {
  readonly name = 'currency';
  readonly description = 'Currency exchange rates via Frankfurter API (ECB data)';

  private readonly baseUrl = 'https://api.frankfurter.dev/v1';

  async convert(amount: number, from: string, to: string): Promise<CurrencyConversion> {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();
    const url = `${this.baseUrl}/latest?amount=${amount}&base=${fromUpper}&symbols=${toUpper}`;

    try {
      const data = await this.fetchJson<FrankfurterRatesResponse>(url);
      const rate = data.rates[toUpper];

      if (rate === undefined) {
        throw new Error(`No rate found for ${toUpper}`);
      }

      return {
        amount,
        from: fromUpper,
        to: toUpper,
        result: Math.round(rate * 100) / 100,
        rate: rate / amount,
        date: data.date,
      };
    } catch (error) {
      throw new ConnectorError({
        connector: this.name,
        message: `Failed to convert ${amount} ${fromUpper} to ${toUpper}`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async listCurrencies(): Promise<CurrencyInfo[]> {
    try {
      const data = await this.fetchJson<FrankfurterCurrenciesResponse>(
        `${this.baseUrl}/currencies`,
      );

      return Object.entries(data).map(([code, name]) => ({ code, name }));
    } catch (error) {
      throw new ConnectorError({
        connector: this.name,
        message: 'Failed to fetch currency list',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
