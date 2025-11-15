"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToolTrace } from "@/components/chat/ToolTrace";
import { askAgent, summariseRun } from "@/lib/api";
import type { AgentRun } from "@/lib/types";

const EXAMPLES = [
  "What is the weather in London?",
  "How should I use social proof in an ad?",
  "List the sections you know about",
];

export default function AgentConsole() {
  const [question, setQuestion] = useState("");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const ask = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setError("Type a question first.");
      return;
    }
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setIsRunning(true);
    setError(null);
    try {
      setRun(await askAgent(trimmed, controller.signal));
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "Something went wrong");
      setRun(null);
    } finally {
      if (!controller.signal.aborted) setIsRunning(false);
    }
  }, []);

  useEffect(() => () => inFlight.current?.abort(), []);

  // `?q=...` runs a question on load, which makes a result shareable as a link.
  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("q");
    if (preset) {
      setQuestion(preset);
      void ask(preset);
    }
  }, [ask]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Ask the agent, watch the tools
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The backend discovers its tools over MCP, picks one, calls it, and answers from
          the result. The tool trace lists every <code>tools/call</code> it made.
        </p>

        <form
          className="mt-2 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
        >
          <label htmlFor="question" className="sr-only">
            Question for the agent
          </label>
          <Input
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="e.g. What is the weather in London?"
            autoComplete="off"
            maxLength={2000}
            className="sm:max-w-xl"
          />
          <Button type="submit" disabled={isRunning} className="sm:w-28">
            {isRunning ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                Running
              </span>
            ) : (
              "Run"
            )}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span id="examples-label">Try:</span>
          <ul aria-labelledby="examples-label" className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => {
                    setQuestion(example);
                    void ask(example);
                  }}
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-foreground hover:border-primary hover:text-primary"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-[#fbeeeb] px-4 py-3 text-sm"
        >
          <p className="font-medium text-destructive">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check that the backend is running on the configured API base.
          </p>
        </div>
      ) : null}

      <div
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        aria-busy={isRunning}
      >
        <Card>
          <CardHeader>
            <CardTitle>Answer</CardTitle>
            <CardDescription aria-live="polite">
              {isRunning ? "Running…" : run ? summariseRun(run) : "No run yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {run ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-md bg-muted px-4 py-3 text-sm">
                  <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    you asked
                  </span>
                  {run.question}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {run.answer}
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Badge tone="info">provider: {run.provider}</Badge>
                  <Badge>{run.providerLabel}</Badge>
                  <Badge tone={run.stoppedBy === "final" ? "success" : "danger"}>
                    stopped: {run.stoppedBy}
                  </Badge>
                </div>
              </div>
            ) : isRunning ? (
              <div className="flex flex-col gap-2" aria-hidden>
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask something above, or pick one of the examples.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tool trace</CardTitle>
            <CardDescription>
              {run
                ? `Discovered over MCP: ${run.toolsDiscovered.join(", ")}`
                : "Each tools/call the agent made, with its arguments and result."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {run ? (
              <ToolTrace steps={run.steps} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {isRunning
                  ? "Waiting for the agent to pick a tool…"
                  : "Nothing yet. The trace fills in once the agent has run."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
