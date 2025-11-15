import { describe, expect, it } from "vitest";
import {
  JsonRpcError,
  JsonRpcErrorCode,
  failure,
  isFailure,
  isJsonRpcRequest,
  isNotification,
  success,
  textOf,
} from "../src/mcp/protocol";

describe("JSON-RPC envelope", () => {
  it("accepts a well-formed request", () => {
    expect(isJsonRpcRequest({ jsonrpc: "2.0", id: 1, method: "ping" })).toBe(true);
  });

  it("rejects a wrong or missing version", () => {
    expect(isJsonRpcRequest({ jsonrpc: "1.0", id: 1, method: "ping" })).toBe(false);
    expect(isJsonRpcRequest({ id: 1, method: "ping" })).toBe(false);
  });

  it("rejects a non-scalar id and a missing method", () => {
    expect(isJsonRpcRequest({ jsonrpc: "2.0", id: {}, method: "ping" })).toBe(false);
    expect(isJsonRpcRequest({ jsonrpc: "2.0", id: 1 })).toBe(false);
  });

  it("treats a request with no id as a notification", () => {
    expect(isNotification({ jsonrpc: "2.0", method: "notifications/initialized" })).toBe(
      true,
    );
    expect(isNotification({ jsonrpc: "2.0", id: 0, method: "ping" })).toBe(false);
  });

  it("distinguishes success from failure envelopes", () => {
    expect(isFailure(success(1, { ok: true }))).toBe(false);
    expect(isFailure(failure(1, { code: -32603, message: "boom" }))).toBe(true);
  });
});

describe("JsonRpcError", () => {
  it("omits data when there is none", () => {
    expect(JsonRpcError.methodNotFound("tools/nope").toBody()).toEqual({
      code: JsonRpcErrorCode.MethodNotFound,
      message: "Unknown method: tools/nope",
    });
  });

  it("carries data when given", () => {
    expect(JsonRpcError.invalidParams("bad", { field: "city" }).toBody()).toEqual({
      code: JsonRpcErrorCode.InvalidParams,
      message: "bad",
      data: { field: "city" },
    });
  });
});

describe("textOf", () => {
  it("joins every text block with newlines", () => {
    expect(
      textOf({
        content: [
          { type: "text", text: "a" },
          { type: "text", text: "b" },
        ],
      }),
    ).toBe("a\nb");
  });
});
