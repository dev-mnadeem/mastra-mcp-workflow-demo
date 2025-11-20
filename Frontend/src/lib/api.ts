import { API_BASE, endpoints } from "./config";
import type { AgentRun, McpToolDescriptor, ToolCallResult, ToolStep } from "./types";

/** Error carrying the HTTP status, so the UI can say more than "failed". */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text.length > 0 ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed with ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return body as T;
}

export async function askAgent(question: string, signal?: AbortSignal): Promise<AgentRun> {
  const response = await fetch(endpoints.chat, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });
  return readJson<AgentRun>(response);
}

export async function fetchTools(signal?: AbortSignal): Promise<McpToolDescriptor[]> {
  const response = await fetch(endpoints.tools, { signal });
  const body = await readJson<{ tools: McpToolDescriptor[] }>(response);
  return body.tools;
}

/**
 * Calls a tool by speaking JSON-RPC to `/mcp` directly, exactly as an external
 * MCP client would. The tools page uses this rather than `/api/chat` so what
 * you see on screen is the protocol, not a convenience wrapper over it.
 */
export async function callToolOverMcp(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolCallResult> {
  const response = await fetch(`${API_BASE}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
    signal,
  });
  const envelope = await readJson<{
    result?: ToolCallResult;
    error?: { code: number; message: string };
  }>(response);
  if (envelope.error) {
    throw new ApiError(200, `MCP error ${envelope.error.code}: ${envelope.error.message}`);
  }
  return envelope.result as ToolCallResult;
}

/** "1.2 s" reads better than "1240 ms" next to a tool name. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Compact single-line rendering of tool arguments for a step header. */
export function formatArguments(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "(no arguments)";
  return entries
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(", ");
}

export function summariseRun(run: AgentRun): string {
  const calls = run.steps.length;
  const noun = calls === 1 ? "tool call" : "tool calls";
  const stopped = run.stoppedBy === "step_limit" ? ", stopped at the step limit" : "";
  return `${calls} ${noun} via ${run.provider} in ${formatDuration(run.durationMs)}${stopped}`;
}

export function stepBadge(step: ToolStep): { label: string; ok: boolean } {
  return { label: step.ok ? "ok" : "error", ok: step.ok };
}
