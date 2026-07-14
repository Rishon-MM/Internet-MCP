# Internet MCP

A production-grade Internet access server for local LLMs using the [Model Context Protocol](https://modelcontextprotocol.io) (MCP).

Internet MCP enables local AI models such as **Qwen**, **Llama**, **DeepSeek**, **Gemma**, and **Mistral** to access reliable, up-to-date information from the web through a simple, intelligent, and model-friendly interface.

Unlike typical MCP servers that expose many low-level tools, Internet MCP focuses on providing a **small set of high-quality tools** while handling all retrieval complexity internally. The LLM expresses **what it wants**, and the server decides **how to retrieve it**.

## Features

- 🔍 **`search_web`** — Search the internet for current information
- 🌐 **`open_url`** — Fetch any webpage and return clean Markdown
- ⚡ **Smart caching** — Per-content-type TTLs (search, pages, docs, PDFs)
- 🔌 **Pluggable providers** — SearXNG now, Brave/Tavily later
- 📡 **Dual transport** — Stdio (local) + Streamable HTTP (remote)
- 🏗️ **Production architecture** — DI, typed errors, structured logging

## Quick Start

### Prerequisites

- Node.js 20+
- A [SearXNG](https://docs.searxng.org/) instance (self-hosted or public)

### Install

```bash
git clone https://github.com/your-username/internet-mcp.git
cd internet-mcp
npm install
cp .env.example .env
# Edit .env with your SearXNG URL
```

### Run (Stdio — for Claude Desktop, Open WebUI, VS Code)

```bash
npm run build
npm start
```

### Run (HTTP — for remote access)

```bash
npm run build
TRANSPORT=http npm start
# Server at http://localhost:3000/mcp
# Health check at http://localhost:3000/health
```

### Development

```bash
npm run dev    # Watch mode with hot reload
npm test       # Run tests
npm run lint   # Type check
```

## Configuration

All configuration via environment variables. See [`.env.example`](.env.example) for the full reference.

| Variable | Default | Description |
|---|---|---|
| `SEARCH_PROVIDER` | `searxng` | Active search provider |
| `SEARXNG_BASE_URL` | `http://localhost:8080` | SearXNG instance URL |
| `SEARXNG_TIMEOUT` | `5000` | SearXNG request timeout (ms) |
| `SEARXNG_SAFE_SEARCH` | `0` | Safe search level (0-2) |
| `SEARCH_CACHE_TTL` | `300` | Search results cache TTL (seconds) |
| `PAGE_CACHE_TTL` | `86400` | Web page cache TTL (seconds) |
| `DOC_CACHE_TTL` | `86400` | Document cache TTL (seconds) |
| `PDF_CACHE_TTL` | `2592000` | PDF cache TTL (seconds) |
| `TRANSPORT` | `stdio` | Transport type: `stdio` or `http` |
| `HTTP_PORT` | `3000` | HTTP server port |
| `LOG_LEVEL` | `info` | Log level |

## Tools

### `search_web`

Search the internet for current information.

```json
{
  "query": "latest MCP specification"
}
```

Returns formatted Markdown with ranked search results including titles, URLs, and snippets.

### `open_url`

Fetch a webpage and return clean Markdown.

```json
{
  "url": "https://modelcontextprotocol.io/specification/latest"
}
```

Returns the page content as clean Markdown with navigation, ads, and scripts stripped.

## Architecture

```
src/
├── index.ts              # Composition root (DI wiring)
├── mcp/                  # MCP protocol layer (thin)
│   ├── server.ts         # Server + transport setup
│   ├── registry.ts       # Tool registration
│   └── tools/            # Tool definitions
├── core/                 # Business logic
│   ├── search/           # Search service
│   ├── fetch/            # Fetch + extraction service
│   ├── extract/          # HTML → Markdown extractors
│   └── cache/            # In-memory LRU cache
├── providers/            # External service adapters
│   └── searxng/          # SearXNG provider
└── shared/               # Config, logger, errors, types
```

**Key design principle:** The MCP layer is a thin shell. All business logic lives in `core/`. Providers are pluggable behind a single interface.

See [docs/architecture.md](docs/architecture.md) for the full architecture documentation.

## Docker

```bash
# Start Internet MCP + SearXNG
docker compose up

# Internet MCP: http://localhost:3000/mcp
# SearXNG:      http://localhost:8080
```

## Client Configuration

### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "internet-mcp": {
      "command": "node",
      "args": ["/path/to/internet-mcp/dist/index.js"],
      "env": {
        "SEARXNG_BASE_URL": "http://localhost:8080"
      }
    }
  }
}
```

### Open WebUI / VS Code / Continue

Configure as an MCP server with stdio transport pointing to `dist/index.js`.

## Contributing

See [docs/architecture.md](docs/architecture.md) for architectural decisions and extension guidelines.

To add a new search provider:

1. Implement the `SearchProvider` interface from `src/core/search/search.types.ts`
2. Register it in `src/providers/provider.ts`
3. Add configuration to `src/shared/config.ts`

No business logic changes required.

## License

MIT
