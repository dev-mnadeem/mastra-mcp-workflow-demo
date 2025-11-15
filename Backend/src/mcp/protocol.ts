/**
 * JSON-RPC 2.0 envelope plus the slice of the Model Context Protocol this
 * project implements: `initialize`, `ping`, `tools/list` and `tools/call`.
 *
 * Everything here is transport-agnostic on purpose. A transport moves strings
 * or objects; this module decides what those objects are allowed to look like.
 */

/** MCP revision this server negotiates. Sent back from `initialize`. */
export const PROTOCOL_VERSION = "2025-06-18";

/** Revisions the server will accept from a client during negotiation. */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"] as const;

export const JSONRPC_VERSION = "2.0";

/** Method names this server answers. */
export const McpMethod = {
  Initialize: "initialize",
  Initialized: "notifications/initialized",
  Ping: "ping",
  ToolsList: "tools/list",
  ToolsCall: "tools/call",
} as const;

export type McpMethodName = (typeof McpMethod)[keyof typeof McpMethod];

/** Error codes reserved by the JSON-RPC 2.0 specification. */
export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

export type JsonRpcId = string | number;

export interface JsonRpcRequest {
  jsonrpc: typeof JSONRPC_VERSION;
  /** Absent on notifications, which must never be answered. */
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcSuccess<T = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  id: JsonRpcId;
  result: T;
}

export interface JsonRpcFailure {
  jsonrpc: typeof JSONRPC_VERSION;
  id: JsonRpcId | null;
  error: JsonRpcErrorBody;
}

export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcFailure;

/** A JSON Schema object as carried in `tools/list`. */
export type JsonSchema = Record<string, unknown>;

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface McpTextContent {
  type: "text";
  text: string;
}

/**
 * Result of `tools/call`. A tool that fails sets `isError` and still returns
 * 200-equivalent content, so the model can read the failure and recover — this
 * is the part of MCP people most often get wrong by throwing a transport error
 * instead.
 */
export interface McpToolCallResult {
  content: McpTextContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: { tools: { listChanged: boolean } };
  serverInfo: { name: string; version: string };
}

export interface McpToolsListResult {
  tools: McpToolDescriptor[];
  nextCursor?: string;
}

/** Error carrying a JSON-RPC code, so handlers can fail with intent. */
export class JsonRpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "JsonRpcError";
  }

  static invalidParams(message: string, data?: unknown): JsonRpcError {
    return new JsonRpcError(JsonRpcErrorCode.InvalidParams, message, data);
  }

  static methodNotFound(method: string): JsonRpcError {
    return new JsonRpcError(JsonRpcErrorCode.MethodNotFound, `Unknown method: ${method}`);
  }

  toBody(): JsonRpcErrorBody {
    return this.data === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, data: this.data };
  }
}

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.jsonrpc !== JSONRPC_VERSION) return false;
  if (typeof candidate.method !== "string") return false;
  if ("id" in candidate && candidate.id !== undefined) {
    const idType = typeof candidate.id;
    if (idType !== "string" && idType !== "number") return false;
  }
  return true;
}

/** A request without an `id` is a notification and gets no response. */
export function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined || request.id === null;
}

export function success<T>(id: JsonRpcId, result: T): JsonRpcSuccess<T> {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

export function failure(id: JsonRpcId | null, error: JsonRpcErrorBody): JsonRpcFailure {
  return { jsonrpc: JSONRPC_VERSION, id, error };
}

export function isFailure<T>(response: JsonRpcResponse<T>): response is JsonRpcFailure {
  return "error" in response;
}

/** Collapse a tool result's text blocks into one string for logging or prompts. */
export function textOf(result: McpToolCallResult): string {
  return result.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}
