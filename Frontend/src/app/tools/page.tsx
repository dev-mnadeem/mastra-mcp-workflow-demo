"use client";

import { useCallback, useEffect, useState } from "react";
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
import { callToolOverMcp, fetchTools, formatDuration } from "@/lib/api";
import type { McpToolDescriptor, ToolCallResult } from "@/lib/types";

interface Invocation {
  tool: string;
  args: Record<string, unknown>;
  result: ToolCallResult;
  durationMs: number;
}

/** Only string fields get an input box; the demo's tools take nothing else. */
function stringFields(tool: McpToolDescriptor): string[] {
  const properties = tool.inputSchema?.properties ?? {};
  return Object.entries(properties)
    .filter(([, schema]) => schema?.type === "string")
    .map(([name]) => name);
}

export default function ToolCatalogue() {
  const [tools, setTools] = useState<McpToolDescriptor[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [invocation, setInvocation] = useState<Invocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);

  useEffect(() => {
    fetchTools()
      .then((discovered) => {
        setTools(discovered);
        setSelected((current) => current ?? discovered[0]?.name ?? null);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Could not reach the server"),
      );
  }, []);

  const invoke = useCallback(
    async (tool: string, values: Record<string, string>) => {
      setIsCalling(true);
      setError(null);
      const startedAt = performance.now();
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value.trim().length > 0),
      );
      try {
        const result = await callToolOverMcp(tool, payload);
        setInvocation({
          tool,
          args: payload,
          result,
          durationMs: performance.now() - startedAt,
        });
      } catch (caught) {
        setInvocation(null);
        setError(caught instanceof Error ? caught.message : "Tool call failed");
      } finally {
        setIsCalling(false);
      }
    },
    [],
  );

  // `?tool=get_weather&city=London` calls a tool on load, so a specific call is
  // a link you can paste into an issue.
  useEffect(() => {
    if (tools.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const tool = params.get("tool");
    if (!tool || !tools.some((candidate) => candidate.name === tool)) return;
    const values: Record<string, string> = {};
    for (const field of stringFields(tools.find((t) => t.name === tool)!)) {
      const value = params.get(field);
      if (value) values[field] = value;
    }
    setSelected(tool);
    setArgs(values);
    void invoke(tool, values);
  }, [tools, invoke]);

  const active = tools.find((tool) => tool.name === selected) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Tool catalogue</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          These are the tools the server advertises through <code>tools/list</code>.
          Calling one from here sends a real <code>tools/call</code> JSON-RPC request to
          the <code>/mcp</code> endpoint — the same request an external MCP client sends.
        </p>
      </section>

      {error ? (
        <Card className="border-red-300 dark:border-red-900">
          <CardContent className="text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          {tools.map((tool) => (
            <button
              key={tool.name}
              type="button"
              onClick={() => {
                setSelected(tool.name);
                setArgs({});
              }}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                tool.name === selected
                  ? "border-foreground bg-muted"
                  : "border-border hover:bg-muted"
              }`}
            >
              <span className="block font-mono text-sm">{tool.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {tool.description}
              </span>
            </button>
          ))}
          {tools.length === 0 && !error ? (
            <p className="text-sm text-muted-foreground">Loading catalogue…</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          {active ? (
            <Card>
              <CardHeader>
                <CardTitle className="font-mono">{active.name}</CardTitle>
                <CardDescription>
                  required: {(active.inputSchema?.required ?? []).join(", ") || "none"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void invoke(active.name, args);
                  }}
                >
                  {stringFields(active).map((field) => (
                    <label key={field} className="flex flex-col gap-1 text-xs">
                      <span className="font-mono text-muted-foreground">{field}</span>
                      <Input
                        value={args[field] ?? ""}
                        onChange={(event) =>
                          setArgs((current) => ({ ...current, [field]: event.target.value }))
                        }
                        placeholder={
                          active.inputSchema?.properties?.[field]?.description ?? field
                        }
                      />
                    </label>
                  ))}
                  <Button type="submit" disabled={isCalling} className="self-start">
                    {isCalling ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Calling
                      </span>
                    ) : (
                      "Send tools/call"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Request and response</CardTitle>
              <CardDescription>
                {invocation
                  ? `tools/call returned in ${formatDuration(invocation.durationMs)}`
                  : "Send a call to see the JSON-RPC exchange."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-xs lg:grid-cols-2">
              {invocation ? (
                <>
                  <div>
                    <span className="mb-1 block uppercase tracking-wide text-muted-foreground">
                      request
                    </span>
                    <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono leading-relaxed">
                      {JSON.stringify(
                        {
                          jsonrpc: "2.0",
                          method: "tools/call",
                          params: { name: invocation.tool, arguments: invocation.args },
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                  <div>
                    <span className="mb-1 flex items-center gap-2 uppercase tracking-wide text-muted-foreground">
                      result
                      <Badge tone={invocation.result.isError ? "danger" : "success"}>
                        {invocation.result.isError ? "isError" : "ok"}
                      </Badge>
                    </span>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono leading-relaxed">
                      {invocation.result.content.map((block) => block.text).join("\n")}
                    </pre>
                  </div>
                  {invocation.result.structuredContent ? (
                    <div className="lg:col-span-2">
                      <span className="mb-1 block uppercase tracking-wide text-muted-foreground">
                        structuredContent
                      </span>
                      <pre className="overflow-auto rounded-md bg-muted p-3 font-mono leading-relaxed">
                        {JSON.stringify(invocation.result.structuredContent, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing called yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
