import { describe, expect, it } from "vitest";
import { StubModelProvider, extractCity } from "../src/agent/providers/stub";
import { buildToolRegistry } from "../src/mcp/tools";
import { ChatMessage } from "../src/agent/provider";

const tools = buildToolRegistry().describe();
const provider = new StubModelProvider();

function ask(question: string, extra: ChatMessage[] = []) {
  return provider.decide({
    messages: [
      { role: "system", content: "s" },
      { role: "user", content: question },
      ...extra,
    ],
    tools,
  });
}

describe("extractCity", () => {
  it("reads a city after a preposition", () => {
    expect(extractCity("What is the weather in London today?")).toBe("London");
  });

  it("reads a capitalised city with no preposition", () => {
    expect(extractCity("Tokyo weather please")).toBe("Tokyo");
  });

  it("falls back to the last content word", () => {
    expect(extractCity("weather forecast reykjavik")).toBe("reykjavik");
  });

  it("returns null when there is nothing to use", () => {
    expect(extractCity("what is the weather")).toBeNull();
  });
});

describe("StubModelProvider", () => {
  it("is always available", () => {
    expect(provider.isAvailable()).toBe(true);
  });

  it("routes a weather question to get_weather", async () => {
    await expect(ask("What is the weather in London?")).resolves.toMatchObject({
      kind: "tool_call",
      invocation: { tool: "get_weather", arguments: { city: "London" } },
    });
  });

  it("routes a catalogue question to list_context_sections", async () => {
    await expect(ask("list the sections you know")).resolves.toMatchObject({
      kind: "tool_call",
      invocation: { tool: "list_context_sections" },
    });
  });

  it("falls back to get_context for anything else", async () => {
    await expect(ask("how do I write a headline?")).resolves.toMatchObject({
      kind: "tool_call",
      invocation: {
        tool: "get_context",
        arguments: { topic: "how do I write a headline?" },
      },
    });
  });

  it("answers once a tool result is in the transcript", async () => {
    const decision = await ask("how do I write a headline?", [
      {
        role: "tool",
        toolName: "get_context",
        content: "## Lead with one clear benefit",
      },
    ]);
    expect(decision.kind).toBe("final");
    expect(decision.kind === "final" && decision.text).toContain(
      "Lead with one clear benefit",
    );
  });

  it("asks for more detail when the question is empty", async () => {
    const decision = await ask(" ");
    expect(decision).toMatchObject({ kind: "final" });
  });

  it("never picks a tool the server did not advertise", async () => {
    const decision = await provider.decide({
      messages: [{ role: "user", content: "weather in London" }],
      tools: [],
    });
    expect(decision.kind).toBe("final");
  });
});
