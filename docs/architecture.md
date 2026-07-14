# Internet MCP — Architecture

## Overview

Internet MCP is designed as a layered architecture where each layer has clear responsibilities and strict dependency rules.

## Layers

```
┌──────────────────────────────────────────┐
│           MCP Protocol Layer             │  ← Thin shell: translates MCP ↔ core
│        (server, tools, registry)         │
├──────────────────────────────────────────┤
│           Core Business Logic            │  ← All intelligence lives here
│    (search, fetch, extract, cache)       │
├──────────────────────────────────────────┤
│              Providers                   │  ← Pluggable external services
│        (SearXNG, Brave, Tavily)          │
├──────────────────────────────────────────┤
│               Shared                     │  ← Config, logger, errors, types
│      (zero deps on other layers)         │
└──────────────────────────────────────────┘
```

## Dependency Rules

1. **Shared** depends on nothing in `src/`
2. **Core** depends only on **Shared**
3. **Providers** depend on **Shared** and **Core** interfaces
4. **MCP** depends on **Core** services and **Shared**
5. **Entry point** (`index.ts`) wires everything — the only place that knows all layers

## Design Decisions

### Thin MCP Layer

The MCP protocol layer is intentionally thin. Each tool is ~50 lines: validate input, call core service, format output. No business logic.

**Rationale:** The same core services should be reusable from REST, CLI, or SDK without changing business logic. The MCP layer is just one interface.

### Constructor Injection

Every service receives its dependencies via constructor. No global state, no service locators, no singletons.

**Rationale:** Testability, explicit dependencies, no hidden coupling.

### Per-Content-Type Cache TTL

Cache TTLs are configured per content type (search, page, doc, PDF) via environment variables, never hardcoded.

**Rationale:** Search results go stale in minutes; PDFs are immutable for months. A single TTL doesn't fit.

### Typed Error Hierarchy

All errors extend `AppError` with a machine-readable `code`, human-readable `message`, and optional `cause` chain. No generic `throw new Error()`.

**Rationale:** Structured error handling enables better logging, debugging, and error responses to the LLM.

### Stderr Logging

All logging goes to `stderr`. Stdout is reserved exclusively for MCP JSON-RPC messages in stdio mode.

**Rationale:** Logging to stdout corrupts the JSON-RPC stream and breaks MCP communication.

## Extension Guide

### Adding a New Provider

1. Create `src/providers/yourprovider/yourprovider.provider.ts`
2. Implement `SearchProvider` from `src/core/search/search.types.ts`
3. Add config fields to `src/shared/config.ts`
4. Register in `src/index.ts` composition root
5. No changes to core business logic required

### Adding a New Extractor

1. Create `src/core/extract/your.extractor.ts`
2. Implement `ContentExtractor` from `src/core/extract/extractor.ts`
3. Register in the extractor pipeline
4. Handle specific content types via `canHandle()`

### Adding a New Tool

1. Create `src/mcp/tools/your.tool.ts`
2. Register in `src/mcp/registry.ts`
3. Delegate to a core service — no business logic in the tool
