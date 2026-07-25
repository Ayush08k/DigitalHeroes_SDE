import http from 'http';
import https from 'https';
import { URL } from 'url';
import { AuditResult } from '../types';
import { validateUrl, checkSsrf } from '../utils/validator';
import { auditCache } from './cacheService';
import { Semaphore } from '../utils/semaphore';
import { config } from '../config';
import { logger } from '../utils/logger';

const auditSemaphore = new Semaphore(config.maxConcurrentAudits);

export class AuditService {
  public static async performAudit(targetUrl: string, overrideTtl?: number): Promise<{ result: AuditResult; cached: boolean }> {
    const { valid, normalizedUrl, error } = validateUrl(targetUrl);
    if (!valid || !normalizedUrl) {
      throw new Error(error || 'Invalid URL supplied.');
    }

    // Check cache first
    const cachedData = auditCache.get(normalizedUrl);
    if (cachedData) {
      return {
        result: { ...cachedData, cached: true },
        cached: true
      };
    }

    const parsedUrl = new URL(normalizedUrl);
    const isSsrf = await checkSsrf(parsedUrl.hostname);
    if (isSsrf) {
      throw new Error('Forbidden target: IP or hostname is restricted for security (SSRF prevention).');
    }

    // Concurrency control
    await auditSemaphore.acquire();
    try {
      const startTime = Date.now();
      const rawAudit = await this.fetchUrlMetrics(normalizedUrl, config.auditTimeoutMs);
      const duration = Date.now() - startTime;

      const auditResult: AuditResult = {
        url: targetUrl,
        normalizedUrl,
        timestamp: new Date().toISOString(),
        cached: false,
        metrics: {
          responseTimeMs: duration,
          statusCode: rawAudit.statusCode,
          statusText: rawAudit.statusText,
          contentLengthBytes: rawAudit.contentLength,
          contentType: rawAudit.contentType,
          isSslSecure: parsedUrl.protocol === 'https:',
          serverHeader: rawAudit.headers['server'] || 'Unknown',
          redirectCount: rawAudit.redirectCount
        },
        headers: rawAudit.headers,
        securityFlags: {
          hasHsts: !!rawAudit.headers['strict-transport-security'],
          hasCsp: !!rawAudit.headers['content-security-policy'],
          hasXContentTypeOptions: !!rawAudit.headers['x-content-type-options'],
          hasFrameOptions: !!rawAudit.headers['x-frame-options']
        }
      };

      const ttl = overrideTtl !== undefined ? overrideTtl : config.cacheTtlSeconds;
      auditCache.set(normalizedUrl, auditResult, ttl);

      return { result: auditResult, cached: false };
    } finally {
      auditSemaphore.release();
    }
  }

  private static fetchUrlMetrics(targetUrl: string, timeoutMs: number, redirectCount = 0): Promise<{
    statusCode: number;
    statusText: string;
    contentLength: number;
    contentType: string;
    headers: Record<string, string>;
    redirectCount: number;
  }> {
    if (redirectCount > 5) {
      return Promise.reject(new Error('Too many HTTP redirects (limit: 5).'));
    }

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(targetUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.request(targetUrl, {
        method: 'GET',
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'PagePulse-AuditService/1.0 (+https://digitalheroesco.com)'
        }
      }, (res) => {
        let contentLength = 0;
        
        // Check for redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).toString();
          req.destroy();
          return this.fetchUrlMetrics(redirectUrl, timeoutMs, redirectCount + 1)
            .then(resolve)
            .catch(reject);
        }

        res.on('data', (chunk) => {
          contentLength += chunk.length;
        });

        res.on('end', () => {
          const headersMap: Record<string, string> = {};
          Object.keys(res.headers).forEach((k) => {
            const val = res.headers[k];
            if (val) {
              headersMap[k.toLowerCase()] = Array.isArray(val) ? val.join(', ') : val;
            }
          });

          resolve({
            statusCode: res.statusCode || 0,
            statusText: res.statusMessage || 'OK',
            contentLength: parseInt(res.headers['content-length'] || `${contentLength}`, 10) || contentLength,
            contentType: res.headers['content-type'] || 'unknown',
            headers: headersMap,
            redirectCount
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Audit request timed out after ${timeoutMs}ms.`));
      });

      req.on('error', (err) => {
        reject(new Error(`Network request failed: ${err.message}`));
      });

      req.end();
    });
  }
}
