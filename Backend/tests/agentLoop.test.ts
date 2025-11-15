import { describe, expect, it } from "vitest";
import { AgentRunner } from "../src/agent/loop";
import { ModelDecision, ModelProvider } from "../src/agent/provider";
import { StubModelProvider } from "../src/agent/providers/stub";
import { McpClient } from "../src/mcp/client";
import { McpServer } from "../src/mcp/server";
import { buildToolRegistry } from "../src/mcp/tools";
import { InMemoryTransport } from "../src/mcp/transport/inMemory";

function newClient(): McpClient {
  const server = new McpServer({
    name: "test-server",
    version: "0.0.1",
    registry: buildToolRegistry(),
  });
  return new McpClient(new InMemoryTransport(server), { name: "t", version: "1" });
}

/** A provider that replays a fixed script, for testing loop control flow. */
class ScriptedProvider implements ModelProvider {
  readonly id = "scripted";
  readonly label = "Scripted";
  private index = 0;
  constructor(private readonly script: ModelDecision[]) {}
  isAvailable() {
    return true;
  }
  async decide(): Promise<ModelDecision> {
    const decision = this.script[Math.min(this.index, this.script.length - 1)];
    this.index += 1;
    return decision;
  }
}

describe("AgentRunner with the stub provider", () => {
  it("answers a weather question through one get_weather call", async () => {
    const run = await new AgentRunner(newClient(), new StubModelProvider()).run(
      "What is the weather in London?",
    );
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0].tool).toBe("get_weather");
    expect(run.steps[0].ok).toBe(true);
    expect(run.stoppedBy).toBe("final");
    expect(run.answer).toContain("London");
    expect(run.provider).toBe("stub");
  });

  it("answers a playbook question through get_context", async () => {
    const run = await new AgentRunner(newClient(), new StubModelProvider()).run(
      "How should I use social proof?",
    );
    expect(run.steps[0].tool).toBe("get_context");
    expect(run.answer).toContain("social proof");
  });

  it("reports every tool discovered over MCP", async () => {
    const run = await new AgentRunner(newClient(), new StubModelProvider()).run(
      "headlines",
    );
    expect(run.toolsDiscovered).toEqual([
      "get_context",
      "get_weather",
      "list_context_sections",
    ]);
  });

  it("records structured tool output for the UI", async () => {
    const run = await new AgentRunner(newClient(), new StubModelProvider()).run(
      "weather in Oslo",
    );
    expect(run.steps[0].structured).toMatchObject({ city: "Oslo", synthetic: true });
  });
});

describe("AgentRunner control flow", () => {
  it("stops at the step limit instead of looping", async () => {
    const provider = new ScriptedProvider([
      {
        kind: "tool_call",
        invocation: { tool: "get_weather", arguments: { city: "Oslo" } },
      },
    ]);
    const run = await new AgentRunner(newClient(), provider, { maxSteps: 2 }).run("x");
    expect(run.steps).toHaveLength(2);
    expect(run.stoppedBy).toBe("step_limit");
    expect(run.answer).toContain("Stopped after 2 tool call(s)");
  });

  it("feeds an unknown-tool error back instead of throwing", async () => {
    const provider = new ScriptedProvider([
      { kind: "tool_call", invocation: { tool: "no_such_tool", arguments: {} } },
      { kind: "final", text: "recovered" },
    ]);
    const run = await new AgentRunner(newClient(), provider).run("x");
    expect(run.steps[0].ok).toBe(false);
    expect(run.steps[0].output).toContain("MCP error -32602");
    expect(run.answer).toBe("recovered");
  });

  it("marks a schema violation as a failed step", async () => {
    const provider = new ScriptedProvider([
      { kind: "tool_call", invocation: { tool: "get_weather", arguments: { city: "" } } },
      { kind: "final", text: "done" },
    ]);
    const run = await new AgentRunner(newClient(), provider).run("x");
    expect(run.steps[0].ok).toBe(false);
    expect(run.steps[0].output).toContain("Invalid arguments");
  });

  it("can answer with no tool call at all", async () => {
    const provider = new ScriptedProvider([{ kind: "final", text: "no tools needed" }]);
    const run = await new AgentRunner(newClient(), provider).run("hello");
    expect(run.steps).toHaveLength(0);
    expect(run.answer).toBe("no tools needed");
  });

  it("times the run with the injected clock", async () => {
    let now = 1000;
    const provider = new ScriptedProvider([{ kind: "final", text: "ok" }]);
    const run = await new AgentRunner(newClient(), provider, {
      now: () => (now += 5),
    }).run("hello");
    expect(run.durationMs).toBeGreaterThan(0);
  });
});
