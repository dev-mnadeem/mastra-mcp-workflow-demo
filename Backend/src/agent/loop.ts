import { McpClient } from "../mcp/client";
import { JsonRpcError, McpToolCallResult, textOf } from "../mcp/protocol";
import { ChatMessage, ModelProvider, ToolInvocation } from "./provider";

/** Hard ceiling on tool calls per question, so a bad decision cannot loop. */
export const DEFAULT_MAX_STEPS = 4;

/** Wall-clock budget for a whole run, model calls included. */
export const DEFAULT_RUN_TIMEOUT_MS = 60_000;

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
  /**
   * `deadline`: the run outlived its time budget. `cancelled`: the caller
   * aborted, which the HTTP route does when the client disconnects.
   */
  stoppedBy: "final" | "step_limit" | "deadline" | "cancelled";
  durationMs: number;
}

export interface AgentRunnerOptions {
  maxSteps?: number;
  runTimeoutMs?: number;
  systemPrompt?: string;
  now?: () => number;
}

export interface RunOptions {
  signal?: AbortSignal;
}

class RunDeadlineError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`run exceeded ${timeoutMs} ms`);
    this.name = "RunDeadlineError";
  }
}

const ABORTED = Symbol("aborted");

/** Settles with the work's value, or with ABORTED as soon as the signal fires. */
function untilAborted<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T | typeof ABORTED> {
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise((resolve, reject) => {
    const onAbort = () => resolve(ABORTED);
    signal.addEventListener("abort", onAbort, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
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
  private readonly runTimeoutMs: number;
  private readonly systemPrompt: string;
  private readonly now: () => number;

  constructor(
    private readonly client: McpClient,
    private readonly provider: ModelProvider,
    options: AgentRunnerOptions = {},
  ) {
    this.maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    this.runTimeoutMs = options.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.now = options.now ?? (() => Date.now());
  }

  async run(question: string, { signal }: RunOptions = {}): Promise<AgentRun> {
    const startedAt = this.now();
    // One signal for both ways a run can be cut short. The provider and the
    // loop only ever look at this one.
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new RunDeadlineError(this.runTimeoutMs)),
      this.runTimeoutMs,
    );
    const forwardCancel = () => controller.abort(signal?.reason);
    if (signal?.aborted) forwardCancel();
    signal?.addEventListener("abort", forwardCancel, { once: true });

    const messages: ChatMessage[] = [
      { role: "system", content: this.systemPrompt },
      { role: "user", content: question },
    ];
    const steps: ToolStep[] = [];
    let toolsDiscovered: string[] = [];
    let stoppedBy: AgentRun["stoppedBy"] = "step_limit";
    let answer = "";

    try {
      const tools = await this.client.listTools();
      toolsDiscovered = tools.map((tool) => tool.name);

      for (let index = 0; index < this.maxSteps; index++) {
        if (controller.signal.aborted) break;
        const decision = await untilAborted(
          this.provider.decide({ messages, tools, signal: controller.signal }),
          controller.signal,
        );
        if (decision === ABORTED) break;

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
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", forwardCancel);
    }

    if (controller.signal.aborted && stoppedBy !== "final") {
      stoppedBy =
        controller.signal.reason instanceof RunDeadlineError ? "deadline" : "cancelled";
      answer =
        stoppedBy === "deadline"
          ? `Stopped after ${this.runTimeoutMs} ms without a final answer (${steps.length} tool call(s) made).`
          : `Cancelled after ${steps.length} tool call(s).`;
    } else if (stoppedBy === "step_limit") {
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
      toolsDiscovered,
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
