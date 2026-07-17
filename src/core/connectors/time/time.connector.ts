import type { Connector } from '../connector.js';

export interface TimeResult {
  readonly timezone: string;
  readonly dateTime: string;
  readonly date: string;
  readonly time: string;
  readonly dayOfWeek: string;
  readonly utcOffset: string;
  readonly iso8601: string;
}

/**
 * TimeConnector — current time and date via Node.js Intl API.
 *
 * Zero network calls. Uses the built-in Intl.DateTimeFormat for
 * timezone-aware formatting.
 */
export class TimeConnector implements Connector {
  readonly name = 'time';
  readonly description = 'Current time and date via Node.js Intl API';

  getTime(timezone: string): TimeResult {
    const now = new Date();

    // Validate timezone
    try {
      Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw new Error(`Invalid timezone: "${timezone}". Use IANA format (e.g., "America/New_York", "Europe/London").`);
    }

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
    });

    const fullFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });

    // Calculate UTC offset
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMinutes = (tzDate.getTime() - utcDate.getTime()) / 60000;
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const utcOffset = `UTC${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    return {
      timezone,
      dateTime: fullFormatter.format(now),
      date: dateFormatter.format(now),
      time: timeFormatter.format(now),
      dayOfWeek: dayFormatter.format(now),
      utcOffset,
      iso8601: now.toISOString(),
    };
  }

  /**
   * Returns all available IANA timezone identifiers.
   */
  listTimezones(): string[] {
    return Intl.supportedValuesOf('timeZone');
  }
}
