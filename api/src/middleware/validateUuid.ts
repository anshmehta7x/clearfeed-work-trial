import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ApiError } from '../types/errors.js';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that the given route param names are well-formed UUIDs.
 * Throws ApiError('BAD_REQUEST') -> 400, caught by errorHandler.
 *
 * Usage: router.get('/:ticketId', validateUuidParams('companyId', 'ticketId'), handler)
 */
export function validateUuidParams(...paramNames: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (typeof value !== 'string' || !UUID_RE.test(value)) {
        return next(new ApiError('BAD_REQUEST', `'${name}' is not a well-formed UUID`));
      }
    }
    next();
  };
}
