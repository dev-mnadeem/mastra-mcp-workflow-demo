import { JsonRpcRequest, PROTOCOL_VERSION } from "../protocol";
import { McpTransport } from "../client";

export interface HttpTransportOptions {
  /** Absolute URL of the server's JSON-RPC endpoint, e.g. `http://host/mcp`. */
  endpoint: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Posts a single JSON-RPC message per HTTP request.
 *
 * A notification is answered by the server with `202 Accepted` and an empty
 * body, so an empty 2xx body is resolved as `null` rather than treated as a
 * parse failure.
 */
export class HttpTransport implements McpTransport {
  readonly label: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: HttpTransportOptions) {
    this.label = `http:${options.endpoint}`;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async send(request: JsonRpcRequest): Promise<unknown | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.options.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "MCP-Protocol-Version": PROTOCOL_VERSION,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const body = await response.text();
      if (body.length === 0) return null;
      return JSON.parse(body);
    } finally {
      clearTimeout(timer);
    }
  }
}
