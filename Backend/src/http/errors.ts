import { NextFunction, Request, Response } from "express";
import { JsonRpcErrorCode, failure } from "../mcp/protocol";

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

/** The fields body-parser (and other http-errors producers) put on a 4xx. */
interface HttpClientError extends Error {
  status: number;
  type?: string;
}

function isClientError(error: unknown): error is HttpClientError {
  if (!(error instanceof Error)) return false;
  const status = (error as Partial<HttpClientError>).status;
  return typeof status === "number" && status >= 400 && status < 500;
}

const BODY_ERROR_CODES: Record<string, string> = {
  "entity.parse.failed": "invalid_json",
  "entity.too.large": "payload_too_large",
};

/** Single JSON error shape for the whole API. Stack traces never leave here. */
export function errorHandler(
  error: unknown,
  req: Request,
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
  // A body that is not JSON, or is over the size limit, is the caller's
  // mistake. On /mcp it is answered the JSON-RPC way so MCP clients can parse it.
  if (isClientError(error)) {
    if (req.path === "/mcp" && error.type === "entity.parse.failed") {
      res
        .status(400)
        .json(
          failure(null, { code: JsonRpcErrorCode.ParseError, message: "Parse error" }),
        );
      return;
    }
    res.status(error.status).json({
      error: BODY_ERROR_CODES[error.type ?? ""] ?? "bad_request",
      message: error.message,
    });
    return;
  }
  const message = error instanceof Error ? error.message : "Internal error";
  console.error("[api] unhandled error:", error);
  res.status(500).json({ error: "internal_error", message });
}
