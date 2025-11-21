import { expect, it, vi } from "vitest";
import { MastraOpenAiProvider } from "../src/agent/providers/mastraOpenAi";

const { generate } = vi.hoisted(() => ({
  generate: vi.fn(async () => ({
    text: JSON.stringify({ kind: "final", text: "Fixture answer" }),
  })),
}));
vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    generateLegacy = generate;
  },
}));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => () => ({}) }));

it("passes cancellation into the hosted-model SDK without a network call", async () => {
  const controller = new AbortController();
  const provider = new MastraOpenAiProvider({
    model: "fixture-model",
    apiKey: "test-only",
  });
  await provider.decide({
    messages: [{ role: "user", content: "fixture" }],
    tools: [],
    signal: controller.signal,
  });
  expect(generate).toHaveBeenCalledWith(expect.any(String), {
    abortSignal: controller.signal,
  });
});
