import { describe, expect, it } from "vitest";
import { formatArguments, formatDuration, stepBadge, summariseRun } from "@/lib/api";
import { API_BASE, endpoints } from "@/lib/config";
import type { AgentRun, ToolStep } from "@/lib/types";

const step: ToolStep = {
  index: 0,
  tool: "get_weather",
  arguments: { city: "London" },
  ok: true,
  output: "London on 2026-01-01: snow.",
  durationMs: 4,
};

const run: AgentRun = {
  question: "What is the weather in London?",
  answer: "…",
  provider: "stub",
  providerLabel: "Deterministic local stub",
  toolsDiscovered: ["get_context", "get_weather", "list_context_sections"],
  steps: [step],
  stoppedBy: "final",
  durationMs: 1500,
};

describe("formatDuration", () => {
  it("uses milliseconds below a second", () => {
    expect(formatDuration(4)).toBe("4 ms");
  });

  it("switches to seconds at a second", () => {
    expect(formatDuration(1500)).toBe("1.5 s");
  });

  it("never renders a negative duration", () => {
    expect(formatDuration(-3)).toBe("0 ms");
  });
});

describe("formatArguments", () => {
  it("renders string arguments inline", () => {
    expect(formatArguments({ city: "London", limit: 2 })).toBe("city: London, limit: 2");
  });

  it("names the empty case", () => {
    expect(formatArguments({})).toBe("(no arguments)");
  });
});

describe("summariseRun", () => {
  it("singularises a single tool call", () => {
    expect(summariseRun(run)).toBe("1 tool call via stub in 1.5 s");
  });

  it("flags a run that hit the step limit", () => {
    expect(
      summariseRun({ ...run, steps: [step, step], stoppedBy: "step_limit" }),
    ).toContain("2 tool calls via stub in 1.5 s, stopped at the step limit");
  });
});

describe("stepBadge", () => {
  it("labels a failed step", () => {
    expect(stepBadge({ ...step, ok: false })).toEqual({ label: "error", ok: false });
  });
});

describe("config", () => {
  it("builds endpoints from the API base with no trailing slash", () => {
    expect(API_BASE.endsWith("/")).toBe(false);
    expect(endpoints.chat).toBe(`${API_BASE}/api/chat`);
    expect(endpoints.health).toBe(`${API_BASE}/healthz`);
  });
});
