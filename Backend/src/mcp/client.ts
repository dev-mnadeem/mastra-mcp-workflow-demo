import {
  JsonRpcError,
  JsonRpcRequest,
  McpInitializeResult,
  McpMethod,
  McpToolCallResult,
  McpToolDescriptor,
  McpToolsListResult,
  PROTOCOL_VERSION,
  isFailure,
} from "./protocol";

/**
 * Anything that can carry one JSON-RPC message to a server and bring the answer
 * back. Notifications resolve to `null`.
 */
export interface McpTransport {
  readonly label: string;
  send(request: JsonRpcRequest): Promise<unknown | null>;
  close?(): Promise<void>;
}

export interface McpClientInfo {
  name: string;
  version: string;
}

/**
 * Thin MCP client. It numbers requests, negotiates on first use and turns
 * JSON-RPC failures back into thrown `JsonRpcError`s so callers can use
 * ordinary try/catch.
 */
export class McpClient {
  private nextId = 1;
  private handshake: Promise<McpInitializeResult> | null = null;
  private toolCache: McpToolDescriptor[] | null = null;

  constructor(
    private readonly transport: McpTransport,
    private readonly clientInfo: McpClientInfo,
  ) {}

  get label(): string {
    return this.transport.label;
  }

  /** Runs `initialize` once and memoises it, including across parallel callers. */
  async connect(): Promise<McpInitializeResult> {
    if (!this.handshake) {
      this.handshake = this.request<McpInitializeResult>(McpMethod.Initialize, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: this.clientInfo,
      }).then(async (result) => {
        await this.notify(McpMethod.Initialized);
        return result;
      });
      this.handshake.catch(() => {
        this.handshake = null;
      });
    }
    return this.handshake;
  }

  /**
   * Tool descriptors, cached after the first call. The server advertises
   * `listChanged: false`, so there is nothing to invalidate on.
   */
  async listTools(): Promise<McpToolDescriptor[]> {
    if (this.toolCache) return this.toolCache;
    await this.connect();
    const result = await this.request<McpToolsListResult>(McpMethod.ToolsList);
    this.toolCache = result.tools;
    return this.toolCache;
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<McpToolCallResult> {
    await this.connect();
    return this.request<McpToolCallResult>(McpMethod.ToolsCall, {
      name,
      arguments: args,
    });
  }

  async ping(): Promise<void> {
    await this.request(McpMethod.Ping);
  }

  async close(): Promise<void> {
    await this.transport.close?.();
  }

  private async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    await this.transport.send({ jsonrpc: "2.0", method, params });
  }

  private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = this.nextId++;
    const response = await this.transport.send({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    if (response === null || response === undefined) {
      throw new Error(`No response from ${this.transport.label} for ${method}`);
    }
    const envelope = response as { id?: unknown };
    if (envelope.id !== id) {
      throw new Error(
        `Response id mismatch on ${method}: expected ${id}, got ${String(envelope.id)}`,
      );
    }
    const typed = response as Parameters<typeof isFailure>[0];
    if (isFailure(typed)) {
      throw new JsonRpcError(typed.error.code, typed.error.message, typed.error.data);
    }
    return (typed as { result: T }).result;
  }
}
