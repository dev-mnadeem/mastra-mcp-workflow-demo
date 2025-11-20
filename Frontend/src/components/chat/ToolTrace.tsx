"use client";

import { Badge } from "@/components/ui/badge";
import { formatArguments, formatDuration } from "@/lib/api";
import type { ToolStep } from "@/lib/types";

/**
 * Renders the agent's tool calls in order: which tool, with which arguments,
 * why, and exactly what came back. This is the part of an MCP demo worth
 * looking at, so it gets its own column rather than being folded into a blob
 * of JSON under the answer.
 */
export function ToolTrace({ steps }: { steps: ToolStep[] }) {
  if (steps.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        The agent answered without calling a tool.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step) => (
        <li key={step.index} className="rounded-lg border border-border bg-background">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="font-mono text-xs text-muted-foreground">
              {step.index + 1}
            </span>
            <span className="font-mono text-sm font-medium">{step.tool}</span>
            <Badge tone={step.ok ? "success" : "danger"}>
              {step.ok ? "ok" : "error"}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatDuration(step.durationMs)}
            </span>
          </div>

          <dl className="divide-y divide-border text-xs">
            <div className="px-4 py-2.5">
              <dt className="mb-1 uppercase tracking-wide text-muted-foreground">
                arguments
              </dt>
              <dd className="font-mono break-words">{formatArguments(step.arguments)}</dd>
            </div>
            {step.rationale ? (
              <div className="px-4 py-2.5">
                <dt className="mb-1 uppercase tracking-wide text-muted-foreground">
                  why this tool
                </dt>
                <dd>{step.rationale}</dd>
              </div>
            ) : null}
            <div className="px-4 py-2.5">
              <dt className="mb-1 uppercase tracking-wide text-muted-foreground">
                tools/call result
              </dt>
              <dd>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono leading-relaxed">
                  {step.output}
                </pre>
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}
