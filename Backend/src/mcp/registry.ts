import { z, ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  JsonRpcError,
  JsonSchema,
  McpToolCallResult,
  McpToolDescriptor,
} from "./protocol";

/**
 * A tool as the server holds it: a name, a description the model reads, a Zod
 * schema that is both the runtime validator and the advertised JSON Schema, and
 * a handler that returns already-shaped MCP content.
 */
export interface McpToolDefinition<TInput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  handler: (input: TInput) => Promise<McpToolCallResult> | McpToolCallResult;
}

/**
 * One registry holds tools with different input types, so the map's value type
 * has to be erased. `AnyMcpTool` names that erasure in one place instead of
 * scattering casts, and `createTool` is what re-establishes the real type at
 * each call site.
 */
export type AnyMcpTool = McpToolDefinition<never>;

/** `createTool` keeps the input type inferred from the schema at the call site. */
export function createTool<TSchema extends ZodType>(definition: {
  name: string;
  description: string;
  inputSchema: TSchema;
  handler: (input: z.infer<TSchema>) => Promise<McpToolCallResult> | McpToolCallResult;
}): McpToolDefinition<z.infer<TSchema>> {
  return definition as McpToolDefinition<z.infer<TSchema>>;
}

/** MCP tool names are used as identifiers by clients, so keep them boring. */
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export class ToolRegistry {
  private readonly tools = new Map<string, AnyMcpTool>();

  register<TInput>(tool: McpToolDefinition<TInput>): this {
    if (!TOOL_NAME_PATTERN.test(tool.name)) {
      throw new Error(
        `Invalid tool name "${tool.name}": expected lower_snake_case, 2-64 chars`,
      );
    }
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool as unknown as AnyMcpTool);
    return this;
  }

  registerAll(tools: ReadonlyArray<AnyMcpTool>): this {
    for (const tool of tools) this.register(tool);
    return this;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  size(): number {
    return this.tools.size;
  }

  names(): string[] {
    return [...this.tools.keys()].sort();
  }

  /** Descriptors in the exact shape `tools/list` returns, name-sorted. */
  describe(): McpToolDescriptor[] {
    return this.names().map((name) => {
      const tool = this.tools.get(name) as AnyMcpTool;
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema, {
          $refStrategy: "none",
          target: "jsonSchema7",
        }) as JsonSchema,
      };
    });
  }

  /**
   * Validate arguments and run the tool.
   *
   * Two failure modes are deliberately kept apart. An unknown tool or invalid
   * arguments is a *protocol* error and raises `JsonRpcError`. A tool that
   * throws while doing its job is a *tool* error and comes back as content with
   * `isError: true`, which is what lets an agent read the message and retry.
   */
  async call(name: string, args: unknown): Promise<McpToolCallResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw JsonRpcError.invalidParams(`Unknown tool: ${name}`, {
        available: this.names(),
      });
    }

    const parsed = tool.inputSchema.safeParse(args ?? {});
    if (!parsed.success) {
      throw JsonRpcError.invalidParams(
        `Invalid arguments for tool "${name}"`,
        parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    try {
      return await tool.handler(parsed.data as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Tool "${name}" failed: ${message}` }],
        isError: true,
      };
    }
  }
}
