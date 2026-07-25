import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService';
import { auditCache } from '../services/cacheService';

export class AuditController {
  public static async auditUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUrl = req.query.url as string || req.body?.url as string;
      const customTtl = req.query.ttl ? parseInt(req.query.ttl as string, 10) : undefined;

      if (!targetUrl) {
        res.status(400).json({
          error: {
            code: 'MISSING_URL_PARAMETER',
            message: 'Query parameter "url" or JSON body field "url" is required.',
            requestId: req.headers['x-request-id'],
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { result, cached } = await AuditService.performAudit(targetUrl, customTtl);

      res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      if (err.message.includes('Invalid URL') || err.message.includes('Only HTTP')) {
        res.status(400).json({
          error: {
            code: 'INVALID_URL',
            message: err.message,
            requestId: req.headers['x-request-id'],
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (err.message.includes('Forbidden target') || err.message.includes('SSRF')) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN_TARGET',
            message: err.message,
            requestId: req.headers['x-request-id'],
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (err.message.includes('timed out')) {
        res.status(504).json({
          error: {
            code: 'GATEWAY_TIMEOUT',
            message: err.message,
            requestId: req.headers['x-request-id'],
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      next(err);
    }
  }

  public static async clearCache(req: Request, res: Response): Promise<void> {
    auditCache.clear();
    res.status(200).json({
      success: true,
      message: 'Audit cache cleared successfully.'
    });
  }
}
