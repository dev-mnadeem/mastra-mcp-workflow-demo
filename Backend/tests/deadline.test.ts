import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { AgentRunner, AgentTimeoutError } from "../src/agent/loop";
import { ModelProvider } from "../src/agent/provider";
import { StubModelProvider } from "../src/agent/providers/stub";
import { loadConfig } from "../src/config";
import { createContainer } from "../src/container";
import { createApp } from "../src/http/app";

function stalledProvider(): ModelProvider {
  return {
    id: "stalled",
    label: "Stalled test provider",
    isAvailable: () => true,
    decide: vi.fn(() => new Promise(() => {})),
  };
}

describe("agent deadlines", () => {
  it("bounds a model that never returns and signals cancellation", async () => {
    const container = createContainer(loadConfig({}));
    const provider = stalledProvider();
    const runner = new AgentRunner(container.mcpClient, provider, { timeoutMs: 20 });
    await expect(runner.run("weather in London")).rejects.toBeInstanceOf(
      AgentTimeoutError,
    );
    expect(vi.mocked(provider.decide).mock.calls[0][0].signal?.aborted).toBe(true);
  });

  it("bounds stalled discovery", async () => {
    const container = createContainer(loadConfig({}));
    vi.spyOn(container.mcpClient, "listTools").mockImplementation(
      () => new Promise(() => {}),
    );
    await expect(
      new AgentRunner(container.mcpClient, new StubModelProvider(), {
        timeoutMs: 20,
      }).run("x"),
    ).rejects.toBeInstanceOf(AgentTimeoutError);
  });

  it("bounds a tool that never returns", async () => {
    const container = createContainer(loadConfig({}));
    const tool = vi
      .spyOn(container.mcpClient, "callTool")
      .mockImplementation(() => new Promise(() => {}));
    await expect(
      new AgentRunner(container.mcpClient, new StubModelProvider(), {
        timeoutMs: 20,
      }).run("weather in London"),
    ).rejects.toBeInstanceOf(AgentTimeoutError);
    expect(tool.mock.calls[0][2]?.signal?.aborted).toBe(true);
  });

  it("honors caller cancellation without starting another operation", async () => {
    const container = createContainer(loadConfig({}));
    const tool = vi.spyOn(container.mcpClient, "callTool");
    const controller = new AbortController();
    controller.abort(new Error("caller cancelled"));
    await expect(
      new AgentRunner(container.mcpClient, new StubModelProvider()).run("weather", {
        signal: controller.signal,
      }),
    ).rejects.toThrow("caller cancelled");
    expect(tool).not.toHaveBeenCalled();
  });

  it("reports a deadline to HTTP clients as 504", async () => {
    const container = createContainer(loadConfig({}));
    container.runner = new AgentRunner(container.mcpClient, stalledProvider(), {
      timeoutMs: 20,
    });
    const response = await request(createApp(container))
      .post("/api/chat")
      .send({ question: "weather" })
      .expect(504);
    expect(response.body.error).toContain("deadline");
  });
});
