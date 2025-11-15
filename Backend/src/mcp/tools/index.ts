import { AnyMcpTool, ToolRegistry, ToolRegistryOptions } from "../registry";
import { getContextTool, listContextSectionsTool } from "./context";
import { getWeatherTool } from "./weather";

export { getContextTool, listContextSectionsTool } from "./context";
export { getWeatherTool } from "./weather";

/**
 * The single place tools are wired in. Adding a tool to this array is the whole
 * registration step: it then appears in `tools/list`, over stdio, over HTTP, in
 * the agent's prompt, and in the UI's tool panel.
 */
export function buildToolRegistry(options: ToolRegistryOptions = {}): ToolRegistry {
  return new ToolRegistry(options).registerAll([
    getContextTool,
    listContextSectionsTool,
    getWeatherTool,
  ] as unknown as AnyMcpTool[]);
}
