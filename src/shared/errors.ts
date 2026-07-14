/**
 * Typed error hierarchy for Internet MCP.
 *
 * Every error has a machine-readable `code` and an optional `cause`.
 * No generic `throw new Error()` — all errors flow through this hierarchy.
 */

export class AppError extends Error {
  /** Machine-readable error code (e.g., 'PROVIDER_UNAVAILABLE') */
  readonly code: string;
  /** HTTP-style status code for error categorization */
  readonly statusCode: number;
  /** Original error that caused this one */
  override readonly cause?: Error;

  constructor(params: {
    code: string;
    message: string;
    statusCode?: number;
    cause?: Error;
  }) {
    super(params.message);
    this.name = this.constructor.name;
    this.code = params.code;
    this.statusCode = params.statusCode ?? 500;
    this.cause = params.cause;

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializes error to a plain object for structured logging.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      cause: this.cause?.message,
    };
  }
}

/** Errors from search providers (SearXNG, Brave, etc.) */
export class ProviderError extends AppError {
  /** Name of the provider that failed */
  readonly provider: string;

  constructor(params: {
    provider: string;
    message: string;
    code?: string;
    cause?: Error;
  }) {
    super({
      code: params.code ?? 'PROVIDER_ERROR',
      message: `[${params.provider}] ${params.message}`,
      statusCode: 502,
      cause: params.cause,
    });
    this.provider = params.provider;
  }
}

/** Errors during HTTP fetching of web pages */
export class FetchError extends AppError {
  /** URL that failed to fetch */
  readonly url: string;

  constructor(params: {
    url: string;
    message: string;
    code?: string;
    cause?: Error;
  }) {
    super({
      code: params.code ?? 'FETCH_ERROR',
      message: params.message,
      statusCode: 502,
      cause: params.cause,
    });
    this.url = params.url;
  }
}

/** Errors during content extraction (HTML → Markdown) */
export class ExtractionError extends AppError {
  constructor(params: {
    message: string;
    code?: string;
    cause?: Error;
  }) {
    super({
      code: params.code ?? 'EXTRACTION_ERROR',
      message: params.message,
      statusCode: 500,
      cause: params.cause,
    });
  }
}

/** Configuration validation errors */
export class ConfigError extends AppError {
  constructor(params: {
    message: string;
    cause?: Error;
  }) {
    super({
      code: 'CONFIG_ERROR',
      message: params.message,
      statusCode: 500,
      cause: params.cause,
    });
  }
}

/** Input validation errors */
export class ValidationError extends AppError {
  constructor(params: {
    message: string;
    code?: string;
    cause?: Error;
  }) {
    super({
      code: params.code ?? 'VALIDATION_ERROR',
      message: params.message,
      statusCode: 400,
      cause: params.cause,
    });
  }
}
