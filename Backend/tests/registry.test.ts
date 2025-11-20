import { describe, expect, it } from "vitest";
import { z } from "zod";
import { JsonRpcError, JsonRpcErrorCode } from "../src/mcp/protocol";
import { ToolRegistry, createTool } from "../src/mcp/registry";

const echo = createTool({
  name: "echo",
  description: "Echo a message back",
  inputSchema: z.object({ message: z.string().min(1) }),
  handler: ({ message }) => ({ content: [{ type: "text" as const, text: message }] }),
});

const explode = createTool({
  name: "explode",
  description: "Always throws",
  inputSchema: z.object({}),
  handler: () => {
    throw new Error("disk on fire");
  },
});

describe("ToolRegistry", () => {
  it("rejects names that are not lower_snake_case", () => {
    const registry = new ToolRegistry();
    expect(() => registry.register({ ...echo, name: "Echo" })).toThrow(
      /Invalid tool name/,
    );
  });

  it("rejects a duplicate registration", () => {
    const registry = new ToolRegistry().register(echo);
    expect(() => registry.register(echo)).toThrow(/already registered/);
  });

  it("describes tools name-sorted with a JSON Schema", () => {
    const registry = new ToolRegistry().registerAll([explode, echo] as never[]);
    const described = registry.describe();
    expect(described.map((tool) => tool.name)).toEqual(["echo", "explode"]);
    expect(described[0].inputSchema).toMatchObject({
      type: "object",
      properties: { message: { type: "string" } },
    });
  });

  it("runs a tool with valid arguments", async () => {
    const registry = new ToolRegistry().register(echo);
    await expect(registry.call("echo", { message: "hi" })).resolves.toEqual({
      content: [{ type: "text", text: "hi" }],
    });
  });

  it("raises a protocol error for an unknown tool", async () => {
    const registry = new ToolRegistry().register(echo);
    await expect(registry.call("nope", {})).rejects.toMatchObject({
      code: JsonRpcErrorCode.InvalidParams,
    });
  });

  it("raises a protocol error with issue paths for bad arguments", async () => {
    const registry = new ToolRegistry().register(echo);
    const error = await registry.call("echo", { message: "" }).catch((e) => e);
    expect(error).toBeInstanceOf(JsonRpcError);
    expect((error as JsonRpcError).data).toEqual([
      expect.objectContaining({ path: "message" }),
    ]);
  });

  it("returns isError content when the handler throws", async () => {
    const registry = new ToolRegistry().register(explode);
    const result = await registry.call("explode", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("disk on fire");
  });
});
