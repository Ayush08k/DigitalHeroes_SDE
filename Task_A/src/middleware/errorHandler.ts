import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '../types';
import { logger } from '../utils/logger';

export function errorHandlerMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error('Unhandled Application Error', {
    requestId,
    statusCode,
    message,
    stack: err.stack
  });

  const responsePayload: ApiErrorResponse = {
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message,
      requestId,
      timestamp: new Date().toISOString()
    }
  };

  res.status(statusCode).json(responsePayload);
}
