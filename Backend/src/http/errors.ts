import { NextFunction, Request, Response } from "express";

/** An error that already knows which HTTP status it deserves. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }
}

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: "not_found", path: req.path });
}

/** Single JSON error shape for the whole API. Stack traces never leave here. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
    return;
  }
  const message = error instanceof Error ? error.message : "Internal error";
  console.error("[api] unhandled error:", error);
  res.status(500).json({ error: "internal_error", message });
}
