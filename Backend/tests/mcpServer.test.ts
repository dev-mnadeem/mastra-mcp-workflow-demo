import { describe, expect, it } from "vitest";
import { JsonRpcErrorCode, McpMethod, PROTOCOL_VERSION } from "../src/mcp/protocol";
import { McpServer } from "../src/mcp/server";
import { buildToolRegistry } from "../src/mcp/tools";

function newServer(): McpServer {
  return new McpServer({
    name: "test-server",
    version: "0.0.1",
    registry: buildToolRegistry(),
  });
}

function request(
  method: string,
  params?: Record<string, unknown>,
  id: number | string = 1,
) {
  return { jsonrpc: "2.0" as const, id, method, params };
}

describe("McpServer", () => {
  it("negotiates the protocol version and reports capabilities", async () => {
    const server = newServer();
    const response = await server.handle(
      request(McpMethod.Initialize, { protocolVersion: PROTOCOL_VERSION }),
    );
    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "test-server", version: "0.0.1" },
      },
    });
    expect(server.isInitialized).toBe(true);
  });

  it("refuses an unsupported protocol version", async () => {
    const response = await newServer().handle(
      request(McpMethod.Initialize, { protocolVersion: "1999-01-01" }),
    );
    expect(response).toMatchObject({
      error: { code: JsonRpcErrorCode.InvalidParams },
    });
  });

  it("answers ping with an empty result", async () => {
    await expect(newServer().handle(request(McpMethod.Ping))).resolves.toMatchObject({
      result: {},
    });
  });

  it("lists tools with their schemas", async () => {
    const response = (await newServer().handle(request(McpMethod.ToolsList))) as {
      result: { tools: Array<{ name: string; inputSchema: unknown }> };
    };
    expect(response.result.tools.map((tool) => tool.name)).toContain("get_weather");
    expect(response.result.tools[0].inputSchema).toBeTypeOf("object");
  });

  it("calls a tool and returns content", async () => {
    const response = (await newServer().handle(
      request(McpMethod.ToolsCall, {
        name: "get_weather",
        arguments: { city: "London", date: "2026-01-01" },
      }),
    )) as { result: { content: Array<{ text: string }> } };
    expect(response.result.content[0].text).toContain("London on 2026-01-01");
  });

  it("rejects tools/call without a name", async () => {
    await expect(
      newServer().handle(request(McpMethod.ToolsCall, {})),
    ).resolves.toMatchObject({
      error: { code: JsonRpcErrorCode.InvalidParams },
    });
  });

  it("rejects tools/call with non-object arguments", async () => {
    await expect(
      newServer().handle(
        request(McpMethod.ToolsCall, { name: "get_weather", arguments: "x" }),
      ),
    ).resolves.toMatchObject({ error: { code: JsonRpcErrorCode.InvalidParams } });
  });

  it("reports an unknown method", async () => {
    await expect(newServer().handle(request("tools/delete"))).resolves.toMatchObject({
      error: { code: JsonRpcErrorCode.MethodNotFound },
    });
  });

  it("rejects a malformed envelope but keeps the id", async () => {
    await expect(newServer().handle({ id: 7, method: "ping" })).resolves.toMatchObject({
      id: 7,
      error: { code: JsonRpcErrorCode.InvalidRequest },
    });
  });

  it("never answers a notification", async () => {
    const server = newServer();
    await expect(
      server.handle({ jsonrpc: "2.0", method: McpMethod.Initialized }),
    ).resolves.toBeNull();
    expect(server.isInitialized).toBe(true);
  });

  it("stays silent on a notification for an unknown method", async () => {
    await expect(
      newServer().handle({ jsonrpc: "2.0", method: "nope/at/all" }),
    ).resolves.toBeNull();
  });
});
