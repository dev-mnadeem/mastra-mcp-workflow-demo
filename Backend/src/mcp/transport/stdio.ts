import { Readable, Writable } from "node:stream";
import { McpServer } from "../server";

/**
 * Newline-delimited JSON over a pipe — the transport Claude Desktop, Cursor and
 * the MCP Inspector speak when they spawn a server as a subprocess.
 *
 * Nothing but protocol may ever reach stdout: a stray `console.log` in a tool
 * would corrupt the stream, so diagnostics go to stderr.
 */
export function serveStdio(
  server: McpServer,
  input: Readable = process.stdin,
  output: Writable = process.stdout,
  diagnostics: Writable = process.stderr,
): void {
  let buffer = "";

  input.setEncoding("utf8");
  input.on("data", (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.length > 0) void handleLine(line);
      newline = buffer.indexOf("\n");
    }
  });

  async function handleLine(line: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      output.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        })}\n`,
      );
      return;
    }
    const response = await server.handle(parsed);
    if (response !== null) output.write(`${JSON.stringify(response)}\n`);
  }

  diagnostics.write(
    `${server.name} listening on stdio with ${server.registry.size()} tools\n`,
  );
}
