import express, { Express } from "express";
import cors from "cors";
import { AppContainer } from "../container";
import { errorHandler, notFoundHandler } from "./errors";
import { createRoutes } from "./routes";

/** Largest JSON body accepted, sized for a question rather than an upload. */
export const MAX_BODY_SIZE = "64kb";

/**
 * Builds the Express app without binding a port, so tests can drive it over
 * supertest and `index.ts` stays a three-line bootstrap.
 */
export function createApp(container: AppContainer): Express {
  const app = express();
  const { corsOrigins } = container.config;

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: corsOrigins.includes("*") ? true : corsOrigins,
      methods: ["GET", "POST", "OPTIONS"],
    }),
  );
  app.use(express.json({ limit: MAX_BODY_SIZE }));
  app.use(createRoutes(container));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
