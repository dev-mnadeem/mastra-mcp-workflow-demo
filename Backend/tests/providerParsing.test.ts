import { describe, expect, it } from "vitest";
import { MastraOpenAiProvider, parseDecision } from "../src/agent/providers/mastraOpenAi";
import { renderToolCatalogue } from "../src/agent/provider";
import { buildToolRegistry } from "../src/mcp/tools";

describe("parseDecision", () => {
  it("reads a tool call", () => {
    expect(
      parseDecision(
        '{"tool":"get_weather","arguments":{"city":"Oslo"},"rationale":"why"}',
      ),
    ).toEqual({
      kind: "tool_call",
      rationale: "why",
      invocation: { tool: "get_weather", arguments: { city: "Oslo" } },
    });
  });

  it("reads a final answer", () => {
    expect(parseDecision('{"final":"all done"}')).toEqual({
      kind: "final",
      text: "all done",
    });
  });

  it("finds JSON inside a fenced block", () => {
    expect(parseDecision('```json\n{"final":"fenced"}\n```')).toEqual({
      kind: "final",
      text: "fenced",
    });
  });

  it("defaults missing arguments to an empty object", () => {
    expect(parseDecision('{"tool":"list_context_sections"}')).toMatchObject({
      invocation: { arguments: {} },
    });
  });

  it("degrades unparseable output to a final answer", () => {
    expect(parseDecision("I think the answer is 42")).toEqual({
      kind: "final",
      text: "I think the answer is 42",
    });
  });

  it("degrades malformed JSON to a final answer", () => {
    expect(parseDecision('{"tool": ')).toMatchObject({ kind: "final" });
  });
});

describe("MastraOpenAiProvider availability", () => {
  it("is unavailable without a key", () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      expect(new MastraOpenAiProvider({ model: "gpt-4o-mini" }).isAvailable()).toBe(
        false,
      );
    } finally {
      if (previous !== undefined) process.env.OPENAI_API_KEY = previous;
    }
  });

  it("is available when constructed with a key", () => {
    expect(
      new MastraOpenAiProvider({ model: "gpt-4o-mini", apiKey: "sk-test" }).isAvailable(),
    ).toBe(true);
  });
});

describe("renderToolCatalogue", () => {
  it("lists each tool with its schema", () => {
    const rendered = renderToolCatalogue(buildToolRegistry().describe());
    expect(rendered).toContain("- get_weather:");
    expect(rendered).toContain("input schema:");
  });
});
