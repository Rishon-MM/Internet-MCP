import { BaseConnector } from '../connector.js';
import { ConnectorError } from '../../../shared/errors.js';

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  class: string;
  importance: number;
  address?: Record<string, string>;
}

export interface GeocodeResult {
  readonly latitude: number;
  readonly longitude: number;
  readonly displayName: string;
  readonly type: string;
  readonly importance: number;
}

export interface ReverseGeocodeResult {
  readonly latitude: number;
  readonly longitude: number;
  readonly displayName: string;
  readonly address: Record<string, string>;
}

/**
 * GeocodeConnector — forward and reverse geocoding via Nominatim (OpenStreetMap).
 *
 * Free, no API key required. Max 1 request/second (enforced internally).
 * https://nominatim.org/release-docs/latest/api/Overview/
 */
export class GeocodeConnector extends BaseConnector {
  readonly name = 'geocode';
  readonly description = 'Geocoding via Nominatim (OpenStreetMap)';

  private readonly baseUrl = 'https://nominatim.openstreetmap.org';
  private lastRequestTime = 0;

  /**
   * Forward geocode: query string → coordinates.
   */
  async geocode(query: string): Promise<GeocodeResult[]> {
    await this.rateLimitWait();

    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;

    try {
      const data = await this.fetchJson<NominatimResult[]>(url, {
        userAgent: this.config.connectors.userAgent,
      });

      return data.map((item) => ({
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        displayName: item.display_name,
        type: item.type,
        importance: item.importance,
      }));
    } catch (error) {
      throw new ConnectorError({
        connector: this.name,
        message: `Failed to geocode "${query}"`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Reverse geocode: coordinates → address.
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    await this.rateLimitWait();

    const url = `${this.baseUrl}/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;

    try {
      const data = await this.fetchJson<NominatimResult>(url, {
        userAgent: this.config.connectors.userAgent,
      });

      return {
        latitude: parseFloat(data.lat),
        longitude: parseFloat(data.lon),
        displayName: data.display_name,
        address: data.address ?? {},
      };
    } catch (error) {
      throw new ConnectorError({
        connector: this.name,
        message: `Failed to reverse geocode ${latitude},${longitude}`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Enforces Nominatim's 1 request/second rate limit.
   */
  private async rateLimitWait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < 1100) {
      await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
    }

    this.lastRequestTime = Date.now();
  }
}
