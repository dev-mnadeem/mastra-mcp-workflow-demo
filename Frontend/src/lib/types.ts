/** Mirrors the backend's `ToolStep`. */
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

/** Mirrors the backend's `AgentRun`. */
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

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  } & Record<string, unknown>;
}

export interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}
