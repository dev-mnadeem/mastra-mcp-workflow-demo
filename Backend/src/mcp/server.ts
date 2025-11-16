import {
  JSONRPC_VERSION,
  JsonRpcError,
  JsonRpcErrorCode,
  JsonRpcRequest,
  JsonRpcResponse,
  McpInitializeResult,
  McpMethod,
  McpToolsListResult,
  PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  failure,
  isJsonRpcRequest,
  isNotification,
  success,
} from "./protocol";
import { ToolRegistry } from "./registry";

export interface McpServerOptions {
  name: string;
  version: string;
  registry: ToolRegistry;
}

/**
 * The MCP server: a pure request/response dispatcher over a tool registry.
 *
 * It owns no socket and no stream. Transports call `handle()` with a parsed
 * object and forward whatever comes back, which is what makes the same server
 * usable over stdio, over HTTP and in-process inside a test.
 */
export class McpServer {
  private initialized = false;

  constructor(private readonly options: McpServerOptions) {}

  get name(): string {
    return this.options.name;
  }

  get registry(): ToolRegistry {
    return this.options.registry;
  }

  /** True once a client has completed `initialize`. */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Handle one message. Returns `null` for notifications, which per JSON-RPC
   * must not be answered at all.
   */
  async handle(message: unknown): Promise<JsonRpcResponse | null> {
    if (!isJsonRpcRequest(message)) {
      return failure(this.idOf(message), {
        code: JsonRpcErrorCode.InvalidRequest,
        message: `Not a JSON-RPC ${JSONRPC_VERSION} request`,
      });
    }

    const request = message;
    const notification = isNotification(request);

    try {
      const result = await this.dispatch(request);
      if (notification) return null;
      return success(request.id as string | number, result);
    } catch (error) {
      if (notification) return null;
      const body =
        error instanceof JsonRpcError
          ? error.toBody()
          : {
              code: JsonRpcErrorCode.InternalError,
              message: error instanceof Error ? error.message : "Internal error",
            };
      return failure(request.id as string | number, body);
    }
  }

  private async dispatch(request: JsonRpcRequest): Promise<unknown> {
    switch (request.method) {
      case McpMethod.Initialize:
        return this.initialize(request.params);
      case McpMethod.Initialized:
        this.initialized = true;
        return {};
      case McpMethod.Ping:
        return {};
      case McpMethod.ToolsList:
        return this.listTools();
      case McpMethod.ToolsCall:
        return this.callTool(request.params);
      default:
        throw JsonRpcError.methodNotFound(request.method);
    }
  }

  private initialize(params?: Record<string, unknown>): McpInitializeResult {
    const requested = params?.protocolVersion;
    if (typeof requested === "string" && !this.supports(requested)) {
      throw JsonRpcError.invalidParams(`Unsupported protocol version: ${requested}`, {
        supported: [...SUPPORTED_PROTOCOL_VERSIONS],
      });
    }
    this.initialized = true;
    return {
      protocolVersion: typeof requested === "string" ? requested : PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: this.options.name, version: this.options.version },
    };
  }

  private listTools(): McpToolsListResult {
    return { tools: this.options.registry.describe() };
  }

  private async callTool(params?: Record<string, unknown>) {
    const name = params?.name;
    if (typeof name !== "string" || name.length === 0) {
      throw JsonRpcError.invalidParams("tools/call requires a 'name' string");
    }
    const args = params?.arguments;
    if (args !== undefined && (typeof args !== "object" || args === null)) {
      throw JsonRpcError.invalidParams(
        "tools/call 'arguments' must be an object when present",
      );
    }
    return this.options.registry.call(name, args ?? {});
  }

  private supports(version: string): boolean {
    return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version);
  }

  /** Best-effort id recovery so malformed requests still get a correlated error. */
  private idOf(message: unknown): string | number | null {
    if (typeof message !== "object" || message === null) return null;
    const id = (message as Record<string, unknown>).id;
    return typeof id === "string" || typeof id === "number" ? id : null;
  }
}
