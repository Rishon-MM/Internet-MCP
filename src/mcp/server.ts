import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import type { AppConfig } from '../shared/config.js';
import type { Logger } from '../shared/logger.js';

const SERVER_NAME = 'internet-mcp';
const SERVER_VERSION = '0.1.0';

/**
 * Creates and configures the MCP server instance.
 *
 * The server is transport-agnostic at this point — the transport
 * is connected separately based on config (stdio or HTTP).
 */
export function createMcpServer(
  _config: AppConfig,
  logger: Logger,
): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
  );

  logger.info({
    serverName: SERVER_NAME,
    serverVersion: SERVER_VERSION,
  }, 'MCP server created');

  return server;
}

/**
 * Connects the MCP server to the stdio transport.
 *
 * Stdio is the standard transport for local MCP clients like
 * Claude Desktop, Open WebUI, VS Code, and Continue.
 */
export async function connectStdioTransport(
  server: McpServer,
  logger: Logger,
): Promise<{ close: () => Promise<void> }> {
  const transport = new StdioServerTransport();

  logger.info('Connecting via stdio transport');
  await server.connect(transport);
  logger.info('MCP server connected via stdio');

  return {
    close: async () => {
      await server.close();
    },
  };
}

/**
 * Starts the MCP server with Streamable HTTP transport.
 *
 * Uses the SDK's `createMcpHandler` for a production-grade HTTP endpoint
 * that handles all MCP protocol complexity (era classification, validation,
 * per-request transports, SSE streaming).
 */
export async function connectHttpTransport(
  serverFactory: () => McpServer,
  config: AppConfig,
  logger: Logger,
): Promise<{ close: () => Promise<void> }> {
  const { createMcpHandler } = await import('@modelcontextprotocol/server');
  const { createServer } = await import('node:http');

  const port = config.transport.httpPort;

  // createMcpHandler returns a Web Standard Request → Response handler
  // that manages all MCP protocol internals
  const mcpHandler = createMcpHandler(
    () => serverFactory().server,
  );

  /**
   * CORS headers — required for browser-based MCP clients
   * (Open WebUI, MCP Inspector, etc.) that connect cross-origin.
   */
  const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Protocol-Version',
    'Access-Control-Expose-Headers': 'Content-Type, Mcp-Protocol-Version',
    'Access-Control-Max-Age': '86400',
  };

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);

    // Handle CORS preflight for all endpoints
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
      });
      res.end(JSON.stringify({
        status: 'ok',
        server: SERVER_NAME,
        version: SERVER_VERSION,
      }));
      return;
    }

    // MCP endpoint — delegate to the SDK handler
    if (url.pathname === '/mcp') {
      try {
        // Convert Node.js IncomingMessage → Web Standard Request
        const headers = new Headers();
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          const key = req.rawHeaders[i];
          const value = req.rawHeaders[i + 1];
          if (key && value) {
            headers.append(key, value);
          }
        }

        const body = await new Promise<string>((resolve) => {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => resolve(Buffer.concat(chunks).toString()));
        });

        const webRequest = new Request(url.toString(), {
          method: req.method ?? 'POST',
          headers,
          body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
        });

        // Let the SDK handle all MCP protocol complexity
        const webResponse = await mcpHandler.fetch(webRequest);

        // Merge CORS headers with SDK response headers
        const responseHeaders: Record<string, string> = {
          ...Object.fromEntries(webResponse.headers.entries()),
          ...CORS_HEADERS,
        };

        // Convert Web Standard Response → Node.js ServerResponse
        res.writeHead(webResponse.status, responseHeaders);
        const responseBody = await webResponse.text();
        res.end(responseBody);
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
        }, 'HTTP handler error');

        if (!res.headersSent) {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
      return;
    }

    // 404 for everything else
    res.writeHead(404, {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      logger.info({
        port,
        endpoint: '/mcp',
        health: '/health',
      }, 'MCP server listening via Streamable HTTP');

      resolve({
        close: async () => {
          await mcpHandler.close();
          await new Promise<void>((res) => {
            httpServer.close(() => res());
          });
        },
      });
    });
  });
}
