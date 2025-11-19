import { McpClient } from "../mcp/client";
import { JsonRpcError, McpToolCallResult, textOf } from "../mcp/protocol";
import { ChatMessage, ModelProvider, ToolInvocation } from "./provider";

/** Hard ceiling on tool calls per question, so a bad decision cannot loop. */
export const DEFAULT_MAX_STEPS = 4;

export interface ToolStep {
  index: number;
  tool: string;
  arguments: Record<string, unknown>;
  rationale?: string;
  ok: boolean;
  output: string;
  structured?: Record<string, unknown>;
  durationMs: number;
}

export interface AgentRun {
  question: string;
  answer: string;
  provider: string;
  providerLabel: string;
  toolsDiscovered: string[];
  steps: ToolStep[];
  stoppedBy: "final" | "step_limit";
  durationMs: number;
}

export interface AgentRunnerOptions {
  maxSteps?: number;
  systemPrompt?: string;
  now?: () => number;
}

const DEFAULT_SYSTEM_PROMPT =
  "Answer using the tools discovered over MCP. Cite what the tool returned.";

/**
 * The agent loop.
 *
 * Discover tools over MCP, ask the provider what to do, run the tool it picked,
 * append the result to the transcript, repeat until the provider answers or the
 * step cap trips. Every branch is recorded in `steps`, which is what the UI
 * renders and what makes a wrong tool choice visible instead of mysterious.
 */
export class AgentRunner {
  private readonly maxSteps: number;
  private readonly systemPrompt: string;
  private readonly now: () => number;

  constructor(
    private readonly client: McpClient,
    private readonly provider: ModelProvider,
    options: AgentRunnerOptions = {},
  ) {
    this.maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.now = options.now ?? (() => Date.now());
  }

  async run(question: string): Promise<AgentRun> {
    const startedAt = this.now();
    const tools = await this.client.listTools();
    const messages: ChatMessage[] = [
      { role: "system", content: this.systemPrompt },
      { role: "user", content: question },
    ];
    const steps: ToolStep[] = [];

    let stoppedBy: AgentRun["stoppedBy"] = "step_limit";
    let answer = "";

    for (let index = 0; index < this.maxSteps; index++) {
      const decision = await this.provider.decide({ messages, tools });

      if (decision.kind === "final") {
        answer = decision.text;
        stoppedBy = "final";
        break;
      }

      const step = await this.runTool(index, decision.invocation, decision.rationale);
      steps.push(step);
      messages.push({
        role: "assistant",
        content: `Calling ${step.tool} with ${JSON.stringify(step.arguments)}`,
      });
      messages.push({
        role: "tool",
        toolName: step.tool,
        content: step.output,
      });
    }

    if (stoppedBy === "step_limit") {
      answer =
        steps.length > 0
          ? `Stopped after ${steps.length} tool call(s) without a final answer. Last tool output:\n\n${steps[steps.length - 1].output}`
          : `Stopped after ${this.maxSteps} steps without a final answer.`;
    }

    return {
      question,
      answer,
      provider: this.provider.id,
      providerLabel: this.provider.label,
      toolsDiscovered: tools.map((tool) => tool.name),
      steps,
      stoppedBy,
      durationMs: this.now() - startedAt,
    };
  }

  private async runTool(
    index: number,
    invocation: ToolInvocation,
    rationale?: string,
  ): Promise<ToolStep> {
    const startedAt = this.now();
    const base = {
      index,
      tool: invocation.tool,
      arguments: invocation.arguments,
      rationale,
    };
    try {
      const result: McpToolCallResult = await this.client.callTool(
        invocation.tool,
        invocation.arguments,
      );
      return {
        ...base,
        ok: result.isError !== true,
        output: textOf(result),
        structured: result.structuredContent,
        durationMs: this.now() - startedAt,
      };
    } catch (error) {
      // A protocol-level failure (unknown tool, bad arguments) is fed back into
      // the transcript rather than thrown, so the provider gets a chance to
      // correct itself on the next step.
      const message =
        error instanceof JsonRpcError
          ? `MCP error ${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      return {
        ...base,
        ok: false,
        output: message,
        durationMs: this.now() - startedAt,
      };
    }
  }
}
