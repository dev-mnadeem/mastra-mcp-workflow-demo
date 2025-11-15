import { describe, expect, it, vi } from "vitest";
import { McpClient } from "../src/mcp/client";
import { JsonRpcError, JsonRpcErrorCode, PROTOCOL_VERSION } from "../src/mcp/protocol";
import { McpServer } from "../src/mcp/server";
import { buildToolRegistry } from "../src/mcp/tools";
import { InMemoryTransport } from "../src/mcp/transport/inMemory";
import { HttpTransport } from "../src/mcp/transport/http";

function newClient() {
  const server = new McpServer({
    name: "test-server",
    version: "0.0.1",
    registry: buildToolRegistry(),
  });
  return {
    server,
    client: new McpClient(new InMemoryTransport(server), { name: "t", version: "1" }),
  };
}

describe("McpClient over the in-memory transport", () => {
  it("initializes and marks the server initialized", async () => {
    const { server, client } = newClient();
    const result = await client.connect();
    expect(result.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(server.isInitialized).toBe(true);
  });

  it("performs the handshake only once", async () => {
    const { server, client } = newClient();
    const spy = vi.spyOn(server, "handle");
    await Promise.all([client.connect(), client.connect(), client.connect()]);
    const initializes = spy.mock.calls.filter(
      ([message]) => (message as { method: string }).method === "initialize",
    );
    expect(initializes).toHaveLength(1);
  });

  it("caches the tool list", async () => {
    const { server, client } = newClient();
    await client.listTools();
    const spy = vi.spyOn(server, "handle");
    const second = await client.listTools();
    expect(second.map((t) => t.name)).toContain("get_context");
    expect(spy).not.toHaveBeenCalled();
  });

  it("round-trips a tool call", async () => {
    const { client } = newClient();
    const result = await client.callTool("get_weather", {
      city: "Oslo",
      date: "2026-02-02",
    });
    expect(result.content[0].text).toContain("Oslo on 2026-02-02");
  });

  it("turns a JSON-RPC failure into a thrown JsonRpcError", async () => {
    const { client } = newClient();
    const error = await client.callTool("get_weather", {}).catch((e) => e);
    expect(error).toBeInstanceOf(JsonRpcError);
    expect((error as JsonRpcError).code).toBe(JsonRpcErrorCode.InvalidParams);
  });

  it("answers ping", async () => {
    const { client } = newClient();
    await expect(client.ping()).resolves.toBeUndefined();
  });

  it("rejects a response whose id does not correlate", async () => {
    const client = new McpClient(
      {
        label: "bad",
        send: async () => ({ jsonrpc: "2.0", id: 99, result: {} }),
      },
      { name: "t", version: "1" },
    );
    await expect(client.connect()).rejects.toThrow(/id mismatch/);
  });

  it("rejects an empty response", async () => {
    const client = new McpClient(
      { label: "silent", send: async () => null },
      { name: "t", version: "1" },
    );
    await expect(client.connect()).rejects.toThrow(/No response/);
  });
});

describe("HttpTransport", () => {
  it("posts JSON-RPC with the protocol header and parses the reply", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} })),
    );
    const transport = new HttpTransport({
      endpoint: "http://example.test/mcp",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const response = await transport.send({ jsonrpc: "2.0", id: 1, method: "ping" });
    expect(response).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["MCP-Protocol-Version"]).toBe(
      PROTOCOL_VERSION,
    );
  });

  it("resolves an empty accepted body to null", async () => {
    const transport = new HttpTransport({
      endpoint: "http://example.test/mcp",
      fetchImpl: (async () =>
        new Response("", { status: 202 })) as unknown as typeof fetch,
    });
    await expect(
      transport.send({ jsonrpc: "2.0", method: "notifications/initialized" }),
    ).resolves.toBeNull();
  });
});
