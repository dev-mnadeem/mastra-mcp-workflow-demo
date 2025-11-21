import { AgentTimeoutError } from "../agent/loop";
import { Router } from "express";
import { AppContainer } from "../container";
import { PROTOCOL_VERSION } from "../mcp/protocol";
import { ApiError, asyncRoute } from "./errors";

/** Longest question accepted, to keep an unbounded body out of the prompt. */
export const MAX_QUESTION_LENGTH = 2000;

export function createRoutes(container: AppContainer): Router {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      provider: container.provider.id,
      providerLabel: container.provider.label,
      protocolVersion: PROTOCOL_VERSION,
      tools: container.mcpServer.registry.names(),
      maxToolSteps: container.config.maxToolSteps,
      warnings: container.warnings,
    });
  });

  // The tool catalogue, fetched the same way any MCP client would fetch it.
  router.get(
    "/api/tools",
    asyncRoute(async (_req, res) => {
      const tools = await container.mcpClient.listTools();
      res.json({ tools, source: container.mcpClient.label });
    }),
  );

  router.post(
    "/api/chat",
    asyncRoute(async (req, res) => {
      const { question } = (req.body ?? {}) as { question?: unknown };
      if (typeof question !== "string" || question.trim().length === 0) {
        throw ApiError.badRequest("'question' must be a non-empty string");
      }
      if (question.length > MAX_QUESTION_LENGTH) {
        throw ApiError.badRequest(
          `'question' must be at most ${MAX_QUESTION_LENGTH} characters`,
          { length: question.length },
        );
      }
      const controller = new AbortController();
      const disconnect = () => {
        if (!res.writableEnded) controller.abort(new Error("Client disconnected"));
      };
      res.once("close", disconnect);
      try {
        const result = await container.runner.run(question.trim(), {
          signal: controller.signal,
        });
        if (!res.destroyed) res.json(result);
      } catch (error) {
        if (res.destroyed) return;
        if (error instanceof AgentTimeoutError) throw new ApiError(504, error.message);
        throw error;
      } finally {
        res.off("close", disconnect);
      }
    }),
  );

  // Raw JSON-RPC. This is the endpoint an external MCP client would point at,
  // and it shares the server instance with the in-process client above.
  router.post(
    "/mcp",
    asyncRoute(async (req, res) => {
      const response = await container.mcpServer.handle(req.body);
      if (response === null) {
        res.status(202).end();
        return;
      }
      res.json(response);
    }),
  );

  return router;
}
