import { McpToolDescriptor } from "../mcp/protocol";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Set on `tool` messages so the model can tell results apart. */
  toolName?: string;
}

export interface ToolInvocation {
  tool: string;
  arguments: Record<string, unknown>;
}

/** What the model decided to do next: call a tool, or answer. */
export type ModelDecision =
  | { kind: "tool_call"; invocation: ToolInvocation; rationale?: string }
  | { kind: "final"; text: string };

export interface DecideInput {
  messages: ChatMessage[];
  tools: McpToolDescriptor[];
}

/**
 * The seam between this project and any model.
 *
 * One method, because one method is all an agent loop needs: given the
 * conversation so far and the tools discovered over MCP, say what happens next.
 * Everything else - the step cap, the MCP calls, the trace - lives in the loop
 * and is identical for every implementation. `StubModelProvider` is the default
 * so a fresh clone runs, and is tested; `MastraOpenAiProvider` is the same
 * interface backed by a real model.
 */
export interface ModelProvider {
  readonly id: string;
  readonly label: string;
  /** False when the provider needs credentials it has not been given. */
  isAvailable(): boolean;
  decide(input: DecideInput): Promise<ModelDecision>;
}

/** Renders the tool catalogue the way both providers describe it to a model. */
export function renderToolCatalogue(tools: McpToolDescriptor[]): string {
  return tools
    .map(
      (tool) =>
        `- ${tool.name}: ${tool.description}\n  input schema: ${JSON.stringify(tool.inputSchema)}`,
    )
    .join("\n");
}

export function lastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

export function toolResultsSoFar(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => message.role === "tool");
}
