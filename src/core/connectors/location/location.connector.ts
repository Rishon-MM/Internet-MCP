import { execFile } from 'node:child_process';
import { BaseConnector } from '../connector.js';
import { ConnectorError } from '../../../shared/errors.js';

// ── Windows Geolocation (PowerShell) ────────────────────────

/**
 * PowerShell script that uses System.Device.Location.GeoCoordinateWatcher
 * to obtain device coordinates from Windows Location Services.
 *
 * Outputs JSON: { latitude, longitude, accuracy, timestamp }
 * or on failure: { error: "StatusString" }
 */
const WINDOWS_LOCATION_SCRIPT = `
Add-Type -AssemblyName System.Device
$w = New-Object System.Device.Location.GeoCoordinateWatcher('High')
$w.Start()
$t = [DateTime]::Now
while ($w.Status -ne 'Ready' -and $w.Permission -ne 'Denied' -and ([DateTime]::Now - $t).TotalSeconds -lt 8) {
  Start-Sleep -Milliseconds 200
}
if ($w.Status -eq 'Ready' -and -not $w.Position.Location.IsUnknown) {
  $l = $w.Position.Location
  @{ latitude=$l.Latitude; longitude=$l.Longitude; accuracy=$l.HorizontalAccuracy; timestamp=$w.Position.Timestamp.ToString('o') } | ConvertTo-Json -Compress
} else {
  @{ error=$w.Status.ToString() } | ConvertTo-Json -Compress
}
$w.Stop()
`.trim();

interface WindowsLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

interface WindowsLocationError {
  error: string;
}

// ── Nominatim Reverse Geocode ───────────────────────────────

interface NominatimReverseResponse {
  display_name: string;
  address: Record<string, string>;
}

interface ReverseGeocodeResult {
  displayAddress: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  postal?: string;
}

// ── ipwho.is (IP Geolocation) ───────────────────────────────

interface IpWhoIsResponse {
  ip: string;
  success: boolean;
  message?: string;
  type: string;
  continent: string;
  continent_code: string;
  country: string;
  country_code: string;
  region: string;
  region_code: string;
  city: string;
  latitude: number;
  longitude: number;
  is_eu: boolean;
  postal: string;
  calling_code: string;
  capital: string;
  borders: string;
  flag: {
    img: string;
    emoji: string;
    emoji_unicode: string;
  };
  connection: {
    asn: number;
    org: string;
    isp: string;
    domain: string;
  };
  timezone: {
    id: string;
    abbr: string;
    is_dst: boolean;
    offset: number;
    utc: string;
  };
}

// ── Public Result Interface ─────────────────────────────────

export interface LocationResult {
  /** Source of the location data so the LLM knows its reliability */
  readonly source: 'windows' | 'ip';
  readonly latitude: number;
  readonly longitude: number;
  /** Accuracy in meters (Windows only) */
  readonly accuracy?: number;
  readonly city?: string;
  readonly region?: string;
  readonly country?: string;
  readonly countryCode?: string;
  /** Full human-readable address from reverse geocoding */
  readonly displayAddress?: string;
  readonly postal?: string;
  readonly timezone?: string;
  readonly ip?: string;
  readonly isp?: string;
  readonly flagEmoji?: string;
  /** ISO 8601 timestamp of when the location was determined */
  readonly timestamp: string;
}

// ── Connector ───────────────────────────────────────────────

/**
 * LocationConnector — multi-strategy geolocation.
 *
 * Strategy:
 * 1. Try Windows Location Services (GPS, Wi-Fi, Bluetooth, sensors)
 * 2. If coordinates obtained → reverse geocode via Nominatim
 * 3. If Windows unavailable → fall back to IP geolocation (ipwho.is)
 * 4. Always includes `source` so the LLM knows reliability
 */
export class LocationConnector extends BaseConnector {
  readonly name = 'location';
  readonly description = 'Multi-strategy geolocation (Windows Location Services + IP fallback)';

  private readonly ipApiUrl = 'https://ipwho.is';
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org';

  /**
   * Returns the current geographic location using the best available strategy.
   */
  async getCurrentLocation(): Promise<LocationResult> {
    // Strategy 1: Try Windows Location Services
    const windowsCoords = await this.getWindowsLocation();

    if (windowsCoords) {
      this.logger.info({
        latitude: windowsCoords.latitude,
        longitude: windowsCoords.longitude,
        accuracy: windowsCoords.accuracy,
      }, 'Windows Location Services returned coordinates');

      // Reverse geocode for human-readable address
      const address = await this.reverseGeocode(windowsCoords.latitude, windowsCoords.longitude);

      return {
        source: 'windows',
        latitude: windowsCoords.latitude,
        longitude: windowsCoords.longitude,
        accuracy: windowsCoords.accuracy,
        city: address?.city,
        region: address?.region,
        country: address?.country,
        countryCode: address?.countryCode,
        displayAddress: address?.displayAddress,
        postal: address?.postal,
        timestamp: windowsCoords.timestamp,
      };
    }

    // Strategy 2: Fall back to IP geolocation
    this.logger.info('Windows Location unavailable, falling back to IP geolocation');
    return this.getIpLocation();
  }

  // ── Private: Windows Location ───────────────────────────

  /**
   * Attempts to get coordinates from Windows Location Services
   * by spawning a PowerShell child process.
   *
   * Returns null if:
   * - Not running on Windows
   * - Location Services disabled
   * - Permission denied
   * - Timeout (10s)
   * - Coordinates unknown
   * - Any other error
   */
  private async getWindowsLocation(): Promise<WindowsLocationResult | null> {
    if (process.platform !== 'win32') {
      this.logger.debug('Not Windows — skipping Windows Location Services');
      return null;
    }

    try {
      const output = await this.execPowerShell(WINDOWS_LOCATION_SCRIPT, 10_000);
      const parsed = JSON.parse(output) as WindowsLocationResult | WindowsLocationError;

      if ('error' in parsed) {
        this.logger.debug({ status: parsed.error }, 'Windows Location Services unavailable');
        return null;
      }

      if (
        typeof parsed.latitude !== 'number' ||
        typeof parsed.longitude !== 'number' ||
        Number.isNaN(parsed.latitude) ||
        Number.isNaN(parsed.longitude)
      ) {
        this.logger.debug('Windows Location returned invalid coordinates');
        return null;
      }

      return parsed;
    } catch (error) {
      this.logger.debug({
        error: error instanceof Error ? error.message : String(error),
      }, 'Windows Location Services failed');
      return null;
    }
  }

  /**
   * Executes a PowerShell script and returns stdout.
   */
  private execPowerShell(script: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`PowerShell failed: ${error.message}${stderr ? ` — ${stderr.trim()}` : ''}`));
            return;
          }
          resolve(stdout.trim());
        },
      );
    });
  }

  // ── Private: Reverse Geocode ────────────────────────────

  /**
   * Reverse geocodes coordinates via Nominatim (OpenStreetMap).
   * Returns null on failure (non-critical — we still have coordinates).
   */
  private async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
    try {
      const url = `${this.nominatimUrl}/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;

      const data = await this.fetchJson<NominatimReverseResponse>(url, {
        userAgent: this.config.connectors.userAgent,
      });

      const addr = data.address ?? {};

      return {
        displayAddress: data.display_name,
        city: addr['city'] ?? addr['town'] ?? addr['village'] ?? addr['hamlet'],
        region: addr['state'] ?? addr['county'],
        country: addr['country'],
        countryCode: addr['country_code']?.toUpperCase(),
        postal: addr['postcode'],
      };
    } catch (error) {
      this.logger.warn({
        error: error instanceof Error ? error.message : String(error),
      }, 'Reverse geocoding failed — returning coordinates only');
      return null;
    }
  }

  // ── Private: IP Geolocation ─────────────────────────────

  /**
   * Gets location from the server's public IP via ipwho.is.
   */
  private async getIpLocation(): Promise<LocationResult> {
    try {
      const data = await this.fetchJson<IpWhoIsResponse>(this.ipApiUrl);

      if (!data.success) {
        throw new Error(data.message ?? 'ipwho.is returned an unsuccessful response');
      }

      return {
        source: 'ip',
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city,
        region: data.region,
        country: data.country,
        countryCode: data.country_code,
        postal: data.postal,
        timezone: data.timezone.id,
        ip: data.ip,
        isp: data.connection.isp,
        flagEmoji: data.flag.emoji,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new ConnectorError({
        connector: this.name,
        message: 'Failed to get location via IP geolocation',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
