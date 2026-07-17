import { BaseConnector } from '../connector.js';
import { ConnectorError } from '../../../shared/errors.js';

/** WMO weather codes → human-readable descriptions */
const WMO_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Slight rain showers', 81: 'Moderate rain showers',
  82: 'Violent rain showers', 85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    is_day: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weather_code: number[];
  };
}

export interface WeatherResult {
  readonly current: {
    readonly temperature: number;
    readonly humidity: number;
    readonly windSpeed: number;
    readonly condition: string;
    readonly isDay: boolean;
  };
  readonly forecast: ReadonlyArray<{
    readonly date: string;
    readonly maxTemp: number;
    readonly minTemp: number;
    readonly precipitation: number;
    readonly condition: string;
  }>;
}

/**
 * WeatherConnector — current weather and 7-day forecast via Open-Meteo.
 *
 * Free, no API key required. Up to 10,000 calls/day.
 * https://open-meteo.com/en/docs
 */
export class WeatherConnector extends BaseConnector {
  readonly name = 'weather';
  readonly description = 'Current weather and 7-day forecast via Open-Meteo';

  async getWeather(latitude: number, longitude: number): Promise<WeatherResult> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto`;

    try {
      const data = await this.fetchJson<OpenMeteoResponse>(url);

      return {
        current: {
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          windSpeed: data.current.wind_speed_10m,
          condition: WMO_CODES[data.current.weather_code] ?? 'Unknown',
          isDay: data.current.is_day === 1,
        },
        forecast: data.daily.time.map((date, i) => ({
          date,
          maxTemp: data.daily.temperature_2m_max[i]!,
          minTemp: data.daily.temperature_2m_min[i]!,
          precipitation: data.daily.precipitation_sum[i]!,
          condition: WMO_CODES[data.daily.weather_code[i]!] ?? 'Unknown',
        })),
      };
    } catch (error) {
      throw new ConnectorError({
        connector: this.name,
        message: `Failed to fetch weather for ${latitude},${longitude}`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
