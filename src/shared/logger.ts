import pino from 'pino';
import type { AppConfig } from './config.js';

/**
 * Creates a structured Pino logger that writes to **stderr**.
 *
 * Stdout is reserved for MCP JSON-RPC communication in stdio mode.
 * Using stdout for logging would corrupt the protocol stream.
 *
 * In development (NODE_ENV !== 'production'), logs are pretty-printed.
 * In production, logs are raw newline-delimited JSON for log aggregators.
 */
export function createLogger(config: AppConfig): pino.Logger {
  const isDev = process.env['NODE_ENV'] !== 'production';

  return pino({
    name: 'internet-mcp',
    level: config.logging.level,

    // Always write to stderr — stdout is reserved for MCP protocol
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            destination: 2, // stderr file descriptor
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,

    // Base context included in every log line
    base: {
      service: 'internet-mcp',
    },

    // In production mode, explicitly target stderr
    ...(!isDev && {
      destination: pino.destination({ fd: 2 }),
    }),
  });
}

/**
 * Creates a child logger with additional context bound to every log line.
 *
 * Use this to attach per-request context like requestId, tool name,
 * provider, or cache status without repeating it in every log call.
 *
 * @example
 * ```typescript
 * const reqLogger = createChildLogger(logger, {
 *   requestId: 'abc-123',
 *   tool: 'search_web',
 * });
 * reqLogger.info('Search started'); // automatically includes requestId and tool
 * ```
 */
export function createChildLogger(
  logger: pino.Logger,
  context: Record<string, unknown>,
): pino.Logger {
  return logger.child(context);
}

export type Logger = pino.Logger;
