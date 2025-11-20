import { describe, expect, it } from "vitest";
import request from "supertest";
import { loadConfig } from "../src/config";
import { createContainer } from "../src/container";
import { createApp } from "../src/http/app";
import { MAX_QUESTION_LENGTH } from "../src/http/routes";
import { PROTOCOL_VERSION } from "../src/mcp/protocol";

function newApp() {
  return createApp(createContainer(loadConfig({})));
}

describe("GET /healthz", () => {
  it("reports the provider, protocol version and tool names", async () => {
    const response = await request(newApp()).get("/healthz").expect(200);
    expect(response.body).toMatchObject({
      status: "ok",
      provider: "stub",
      protocolVersion: PROTOCOL_VERSION,
      tools: ["get_context", "get_weather", "list_context_sections"],
    });
  });
});

describe("GET /api/tools", () => {
  it("returns the MCP catalogue with schemas", async () => {
    const response = await request(newApp()).get("/api/tools").expect(200);
    expect(response.body.source).toBe("in-memory:mcp-mastra-tools");
    expect(response.body.tools).toHaveLength(3);
    expect(response.body.tools[0]).toHaveProperty("inputSchema");
  });
});

describe("POST /api/chat", () => {
  it("runs the loop and returns the trace", async () => {
    const response = await request(newApp())
      .post("/api/chat")
      .send({ question: "What is the weather in London?" })
      .expect(200);
    expect(response.body.steps[0]).toMatchObject({ tool: "get_weather", ok: true });
    expect(response.body.stoppedBy).toBe("final");
    expect(response.body.answer).toContain("London");
  });

  it("rejects a missing question", async () => {
    const response = await request(newApp()).post("/api/chat").send({}).expect(400);
    expect(response.body.error).toContain("non-empty string");
  });

  it("rejects a blank question", async () => {
    await request(newApp()).post("/api/chat").send({ question: "   " }).expect(400);
  });

  it("rejects an over-long question", async () => {
    const response = await request(newApp())
      .post("/api/chat")
      .send({ question: "x".repeat(MAX_QUESTION_LENGTH + 1) })
      .expect(400);
    expect(response.body.details).toMatchObject({ length: MAX_QUESTION_LENGTH + 1 });
  });
});

describe("POST /mcp", () => {
  it("serves JSON-RPC to an external client", async () => {
    const response = await request(newApp())
      .post("/mcp")
      .send({ jsonrpc: "2.0", id: 5, method: "tools/list" })
      .expect(200);
    expect(response.body.id).toBe(5);
    expect(response.body.result.tools).toHaveLength(3);
  });

  it("accepts a notification with 202 and no body", async () => {
    const response = await request(newApp())
      .post("/mcp")
      .send({ jsonrpc: "2.0", method: "notifications/initialized" })
      .expect(202);
    expect(response.text).toBe("");
  });

  it("returns a JSON-RPC error rather than an HTTP error for an unknown method", async () => {
    const response = await request(newApp())
      .post("/mcp")
      .send({ jsonrpc: "2.0", id: 6, method: "resources/list" })
      .expect(200);
    expect(response.body.error.code).toBe(-32601);
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404", async () => {
    const response = await request(newApp()).get("/api/nope").expect(404);
    expect(response.body).toEqual({ error: "not_found", path: "/api/nope" });
  });
});
