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
      <p className="text-sm text-muted-foreground">
        The agent answered without calling a tool.
      </p>
    );
  }

  return (
    <ol className="relative flex flex-col gap-5 border-l-2 border-signal/30 pl-5">
      {steps.map((step) => (
        <li key={step.index} className="relative">
          <span
            aria-hidden
            className="absolute -left-[29px] top-2 flex h-4 w-4 items-center justify-center rounded-full bg-signal font-mono text-[10px] text-card"
          >
            {step.index + 1}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="sr-only">Step {step.index + 1}:</span>
            <span className="font-mono text-sm font-medium">{step.tool}</span>
            <Badge tone={step.ok ? "success" : "danger"}>{step.ok ? "ok" : "error"}</Badge>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {formatDuration(step.durationMs)}
            </span>
          </div>

          <dl className="mt-2 flex flex-col gap-2 text-xs">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                arguments
              </dt>
              <dd className="mt-0.5 break-words font-mono">
                {formatArguments(step.arguments)}
              </dd>
            </div>
            {step.rationale ? (
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  why this tool
                </dt>
                <dd className="mt-0.5">{step.rationale}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                tools/call result
              </dt>
              <dd className="mt-1">
                <pre
                  tabIndex={0}
                  className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-mono leading-relaxed"
                >
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
