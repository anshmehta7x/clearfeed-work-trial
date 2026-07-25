import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types/errors.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
