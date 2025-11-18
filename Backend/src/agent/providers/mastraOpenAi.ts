import {
  ChatMessage,
  DecideInput,
  ModelDecision,
  ModelProvider,
  renderToolCatalogue,
} from "../provider";

/**
 * The same `ModelProvider` port, backed by a Mastra `Agent` over an OpenAI
 * model.
 *
 * Two deliberate choices:
 *
 * 1. Tool selection stays in this project's loop rather than being delegated to
 *    the framework's own tool runner. The loop is what produces the trace the
 *    UI renders and the step cap the tests assert, and it must behave
 *    identically under the stub. So the model is asked for one JSON decision at
 *    a time and the loop performs the MCP call.
 * 2. `@ai-sdk/openai` and `@mastra/core` are imported lazily. A clone with no
 *    API key never loads them, so nothing in the default path can fail on a
 *    missing credential.
 *
 * On `@mastra/core` 0.18.0 the agent's `generate()` logs a deprecation notice
 * and forwards to `generateLegacy()`. This calls `generateLegacy()` directly
 * when it exists, so the behaviour is pinned rather than inherited from
 * whichever default the installed version happens to have.
 */

export interface MastraOpenAiOptions {
  apiKey?: string;
  model: string;
  maxDecisionChars?: number;
}

const DEFAULT_MAX_DECISION_CHARS = 4000;

const SYSTEM_PROMPT = `You are a tool-using assistant wired to an MCP server.

Reply with a single JSON object and nothing else. Use exactly one of:
  {"tool": "<tool name>", "arguments": { ... }, "rationale": "<one sentence>"}
  {"final": "<the answer for the user>"}

Rules:
- Only call a tool listed below, and match its input schema exactly.
- Prefer calling a tool before answering from memory.
- Once you have a tool result in the transcript, answer with "final".`;

interface MastraAgentLike {
  generate?: (prompt: string) => Promise<{ text: string }>;
  generateLegacy?: (prompt: string) => Promise<{ text: string }>;
}

export class MastraOpenAiProvider implements ModelProvider {
  readonly id = "openai";
  readonly label: string;
  private agent: MastraAgentLike | null = null;

  constructor(private readonly options: MastraOpenAiOptions) {
    this.label = `Mastra agent on OpenAI ${options.model}`;
  }

  isAvailable(): boolean {
    return Boolean(this.options.apiKey ?? process.env.OPENAI_API_KEY);
  }

  async decide({ messages, tools }: DecideInput): Promise<ModelDecision> {
    const agent = await this.getAgent();
    const prompt = [
      "Tools available over MCP:",
      renderToolCatalogue(tools),
      "",
      "Transcript:",
      ...messages.map(renderMessage),
      "",
      "Your JSON decision:",
    ].join("\n");

    const call = agent.generateLegacy ?? agent.generate;
    if (!call) {
      throw new Error("Mastra agent exposes neither generateLegacy() nor generate()");
    }
    const { text } = await call.call(agent, prompt);
    return parseDecision(text, this.options.maxDecisionChars);
  }

  private async getAgent(): Promise<MastraAgentLike> {
    if (this.agent) return this.agent;
    const [{ Agent }, { createOpenAI }] = await Promise.all([
      import("@mastra/core/agent"),
      import("@ai-sdk/openai"),
    ]);
    const openai = createOpenAI({
      apiKey: this.options.apiKey ?? process.env.OPENAI_API_KEY,
    });
    this.agent = new Agent({
      name: "MCP Router Agent",
      instructions: SYSTEM_PROMPT,
      model: openai(this.options.model),
    }) as unknown as MastraAgentLike;
    return this.agent;
  }
}

function renderMessage(message: ChatMessage): string {
  const label =
    message.role === "tool" ? `tool:${message.toolName ?? "?"}` : message.role;
  return `[${label}] ${message.content}`;
}

/**
 * Pull a decision out of a model reply. Models wrap JSON in prose or fences
 * often enough that the first balanced object is the pragmatic thing to read,
 * and anything unparseable degrades to a final answer rather than an exception.
 */
export function parseDecision(
  raw: string,
  maxChars: number = DEFAULT_MAX_DECISION_CHARS,
): ModelDecision {
  const text = raw.trim().slice(0, maxChars);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { kind: "final", text };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { kind: "final", text };
  }
  const object = parsed as Record<string, unknown>;
  if (typeof object.tool === "string") {
    const args = object.arguments;
    return {
      kind: "tool_call",
      rationale: typeof object.rationale === "string" ? object.rationale : undefined,
      invocation: {
        tool: object.tool,
        arguments:
          typeof args === "object" && args !== null
            ? (args as Record<string, unknown>)
            : {},
      },
    };
  }
  if (typeof object.final === "string") {
    return { kind: "final", text: object.final };
  }
  return { kind: "final", text };
}
