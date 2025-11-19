import { AppConfig, SERVER_NAME, SERVER_VERSION } from "./config";
import { McpClient } from "./mcp/client";
import { McpServer } from "./mcp/server";
import { buildToolRegistry } from "./mcp/tools";
import { InMemoryTransport } from "./mcp/transport/inMemory";
import { AgentRunner } from "./agent/loop";
import { ModelProvider } from "./agent/provider";
import { StubModelProvider } from "./agent/providers/stub";
import { MastraOpenAiProvider } from "./agent/providers/mastraOpenAi";

export interface AppContainer {
  config: AppConfig;
  mcpServer: McpServer;
  mcpClient: McpClient;
  provider: ModelProvider;
  runner: AgentRunner;
  /** Non-fatal notes from wiring, surfaced on `/healthz`. */
  warnings: string[];
}

/**
 * Chooses the model provider.
 *
 * Selecting `openai` without a key degrades to the stub with a warning instead
 * of throwing: a misconfigured deployment should still answer requests and say
 * why it is answering them differently.
 */
export function selectProvider(config: AppConfig): {
  provider: ModelProvider;
  warnings: string[];
} {
  if (config.provider === "openai") {
    const candidate = new MastraOpenAiProvider({
      apiKey: config.openAiApiKey,
      model: config.openAiModel,
    });
    if (candidate.isAvailable()) return { provider: candidate, warnings: [] };
    return {
      provider: new StubModelProvider(),
      warnings: [
        "MODEL_PROVIDER=openai but OPENAI_API_KEY is unset - falling back to the deterministic stub.",
      ],
    };
  }
  return { provider: new StubModelProvider(), warnings: [] };
}

/**
 * Composition root. The MCP server runs in-process and is reached through the
 * same `McpClient` an external consumer would use, so the API has no privileged
 * back door into the tools.
 */
export function createContainer(config: AppConfig): AppContainer {
  const mcpServer = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    registry: buildToolRegistry(),
  });

  const mcpClient = new McpClient(new InMemoryTransport(mcpServer), {
    name: "mcp-mastra-api",
    version: SERVER_VERSION,
  });

  const { provider, warnings } = selectProvider(config);
  const runner = new AgentRunner(mcpClient, provider, {
    maxSteps: config.maxToolSteps,
  });

  return { config, mcpServer, mcpClient, provider, runner, warnings };
}
