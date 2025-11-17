import { JsonRpcRequest } from "../protocol";
import { McpServer } from "../server";
import { McpTransport } from "../client";

/**
 * Calls the server object directly, with no serialisation.
 *
 * This is the transport the API process uses: the MCP server lives in the same
 * process, so paying for JSON round-trips would buy nothing. It is also what
 * the tests use, which keeps them fast and free of port juggling.
 */
export class InMemoryTransport implements McpTransport {
  readonly label: string;

  constructor(private readonly server: McpServer) {
    this.label = `in-memory:${server.name}`;
  }

  async send(request: JsonRpcRequest): Promise<unknown | null> {
    // Round-trip through JSON so in-memory callers cannot accidentally pass
    // non-serialisable values that would break over a real transport.
    return this.server.handle(JSON.parse(JSON.stringify(request)));
  }
}
