import { randomUUID } from 'node:crypto';

/**
 * Generates a unique request ID for structured logging.
 *
 * Uses crypto.randomUUID() for uniqueness without external dependencies.
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Safely truncates text to a maximum character length.
 *
 * If truncated, appends '...' indicator. Avoids cutting mid-word
 * when possible by breaking at the last space before the limit.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  // Break at word boundary if possible (within last 20% of the limit)
  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Validates whether a string is a well-formed URL.
 *
 * Accepts only http and https protocols.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Calculates elapsed time in milliseconds from a start timestamp.
 *
 * @param startTime - Value from `performance.now()` or `Date.now()`
 * @returns Elapsed time in milliseconds, rounded to 1 decimal
 */
export function elapsed(startTime: number): number {
  return Math.round((performance.now() - startTime) * 10) / 10;
}

/**
 * Detects content type from a URL and HTTP Content-Type header.
 *
 * Used to determine which cache TTL to apply.
 */
export function detectContentType(url: string, contentTypeHeader?: string): 'page' | 'doc' | 'pdf' {
  const lower = url.toLowerCase();

  if (lower.endsWith('.pdf') || contentTypeHeader?.includes('application/pdf')) {
    return 'pdf';
  }

  if (
    lower.endsWith('.doc') ||
    lower.endsWith('.docx') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.rtf') ||
    contentTypeHeader?.includes('application/msword') ||
    contentTypeHeader?.includes('application/vnd.openxmlformats')
  ) {
    return 'doc';
  }

  return 'page';
}
