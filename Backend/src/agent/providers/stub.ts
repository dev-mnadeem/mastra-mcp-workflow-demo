import {
  ChatMessage,
  DecideInput,
  ModelDecision,
  ModelProvider,
  lastUserMessage,
  toolResultsSoFar,
} from "../provider";

/**
 * A deterministic stand-in for a tool-calling model.
 *
 * It is not pretending to be intelligent. It is a rule table: match the user's
 * words against the registered tools, call at most one of them, then write an
 * answer out of the tool output. That is enough to exercise every other part of
 * the system - MCP discovery, argument validation, the step cap, the trace, the
 * UI - with no API key, no network and no flaky assertions, which is why it is
 * the default provider rather than a fallback nobody runs.
 */

const WEATHER_WORDS = ["weather", "forecast", "temperature", "rain", "sunny", "wind"];
const CATALOGUE_WORDS = ["list", "sections", "topics", "what can you", "which tools"];

/** Words that are never a useful weather city. */
const STOPWORDS = new Set([
  "the",
  "what",
  "whats",
  "what's",
  "is",
  "in",
  "at",
  "for",
  "like",
  "today",
  "tomorrow",
  "weather",
  "forecast",
  "temperature",
  "how",
  "hot",
  "cold",
  "it",
  "a",
  "an",
  "and",
  "me",
  "tell",
  "please",
  "of",
  "on",
]);

export function extractCity(text: string): string | null {
  const explicit = text.match(/\b(?:in|for|at)\s+([A-Z][\w-]*(?:\s+[A-Z][\w-]*)*)/);
  if (explicit) return explicit[1].trim();

  // A capitalised word that is not a stopword. The stopword filter is what
  // stops a sentence-initial "What" from being read as a place name.
  const capitalised = text
    .split(/\s+/)
    .map((word) => word.replace(/[^\w-]/g, ""))
    .filter((word) => /^[A-Z][a-z-]+$/.test(word) && !STOPWORDS.has(word.toLowerCase()));
  if (capitalised.length > 0) return capitalised[0];

  const fallback = text
    .toLowerCase()
    .split(/[^a-z-]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
  return fallback.length > 0 ? fallback[fallback.length - 1] : null;
}

function mentions(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function summarise(question: string, results: ChatMessage[]): string {
  const body = results
    .map((result) => `${result.content}`)
    .join("\n\n")
    .trim();
  const used = results
    .map((r) => r.toolName)
    .filter(Boolean)
    .join(", ");
  return [
    `Here is what the ${used || "tools"} tool returned for "${question}":`,
    "",
    body,
  ].join("\n");
}

export class StubModelProvider implements ModelProvider {
  readonly id = "stub";
  readonly label = "Deterministic local stub";

  isAvailable(): boolean {
    return true;
  }

  async decide({ messages, tools }: DecideInput): Promise<ModelDecision> {
    const available = new Set(tools.map((tool) => tool.name));
    const question = lastUserMessage(messages);
    const results = toolResultsSoFar(messages);

    // One tool call per turn: once a result is in the transcript, answer.
    if (results.length > 0) {
      return { kind: "final", text: summarise(question, results) };
    }

    if (available.has("get_weather") && mentions(question, WEATHER_WORDS)) {
      const city = extractCity(question);
      if (city) {
        return {
          kind: "tool_call",
          rationale: "The question asks about weather and names a place.",
          invocation: { tool: "get_weather", arguments: { city } },
        };
      }
    }

    if (available.has("list_context_sections") && mentions(question, CATALOGUE_WORDS)) {
      return {
        kind: "tool_call",
        rationale: "The question asks what material is available.",
        invocation: { tool: "list_context_sections", arguments: {} },
      };
    }

    if (available.has("get_context") && question.trim().length >= 2) {
      return {
        kind: "tool_call",
        rationale: "Fall back to searching the playbook for the question topic.",
        invocation: {
          tool: "get_context",
          arguments: { topic: question.slice(0, 200) },
        },
      };
    }

    return {
      kind: "final",
      text: "I need a question with a little more detail before I can look anything up.",
    };
  }
}
