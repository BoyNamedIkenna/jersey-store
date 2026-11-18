import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";

// An error we throw on purpose, with the HTTP status the client should see.
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

// Wraps an async route so a rejected promise reaches the error handler.
// Express 5 does this itself; the wrapper keeps the code safe on Express 4 too.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

// Must have four parameters so Express recognises it as an error handler.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  // Anything else is unexpected: log it, but never leak internals to the client.
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};