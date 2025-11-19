/**
 * Entry point for running the tool server as a stdio MCP subprocess, which is
 * how desktop MCP clients launch servers.
 *
 *   node -r ts-node/register/transpile-only src/stdio.ts
 */
import { SERVER_NAME, SERVER_VERSION } from "./config";
import { McpServer } from "./mcp/server";
import { buildToolRegistry } from "./mcp/tools";
import { serveStdio } from "./mcp/transport/stdio";

serveStdio(
  new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    registry: buildToolRegistry(),
  }),
);
