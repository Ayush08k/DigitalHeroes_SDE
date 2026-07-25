import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

interface ClientRateLimitState {
  tokens: number;
  lastRefill: number;
}

const rateLimitStore = new Map<string, ClientRateLimitState>();

export function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const maxTokens = config.rateLimitMaxRequests;
  const windowMs = config.rateLimitWindowMs;

  let state = rateLimitStore.get(clientIp);

  if (!state) {
    state = { tokens: maxTokens, lastRefill: now };
    rateLimitStore.set(clientIp, state);
  } else {
    // Refill tokens based on elapsed time
    const elapsed = now - state.lastRefill;
    if (elapsed > windowMs) {
      state.tokens = maxTokens;
      state.lastRefill = now;
    }
  }

  res.setHeader('X-RateLimit-Limit', maxTokens.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, state.tokens - 1).toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil((state.lastRefill + windowMs) / 1000).toString());

  if (state.tokens <= 0) {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Please wait before making further requests.',
        requestId: req.headers['x-request-id'] as string || 'unknown',
        timestamp: new Date().toISOString(),
        details: {
          limit: maxTokens,
          windowMs
        }
      }
    });
    return;
  }

  state.tokens -= 1;
  next();
}
