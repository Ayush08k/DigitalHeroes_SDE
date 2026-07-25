import request from 'supertest';
import app from '../src/app';
import { validateUrl, isPrivateIp } from '../src/utils/validator';
import { auditCache } from '../src/services/cacheService';

describe('Task A: PagePulse Service Unit & Integration Tests', () => {
  beforeEach(() => {
    auditCache.clear();
  });

  describe('1. Validator & SSRF Protection', () => {
    test('validateUrl should validate HTTP/HTTPS URLs properly', () => {
      expect(validateUrl('https://example.com').valid).toBe(true);
      expect(validateUrl('http://example.com/test').valid).toBe(true);
      expect(validateUrl('example.com').valid).toBe(true);
      expect(validateUrl('ftp://invalid.com').valid).toBe(false);
      expect(validateUrl('').valid).toBe(false);
    });

    test('isPrivateIp should flag private/loopback/SSRF addresses', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('192.168.1.50')).toBe(true);
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
    });
  });

  describe('2. API Endpoints Resilience & Validation', () => {
    test('GET /api/v1/health should return status healthy', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    test('GET /api/v1/audit without URL parameter should return 400 Bad Request', async () => {
      const res = await request(app).get('/api/v1/audit');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_URL_PARAMETER');
      expect(res.body.error.requestId).toBeDefined();
    });

    test('GET /api/v1/audit with SSRF loopback target should return 403 Forbidden', async () => {
      const res = await request(app).get('/api/v1/audit?url=http://127.0.0.1:8080');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_TARGET');
    });
  });

  describe('3. Caching System', () => {
    test('Second request to same URL should return cached result with X-Cache HIT header', async () => {
      const target = 'https://example.com';
      
      const firstRes = await request(app).get(`/api/v1/audit?url=${encodeURIComponent(target)}`);
      expect(firstRes.status).toBe(200);
      expect(firstRes.headers['x-cache']).toBe('MISS');

      const secondRes = await request(app).get(`/api/v1/audit?url=${encodeURIComponent(target)}`);
      expect(secondRes.status).toBe(200);
      expect(secondRes.headers['x-cache']).toBe('HIT');
      expect(secondRes.body.data.cached).toBe(true);
    });
  });

  describe('4. Rate Limiting', () => {
    test('Responses should include rate limit headers', async () => {
      const res = await request(app).get('/api/v1/health');
      // rate limiter applied on /audit endpoints
      const auditRes = await request(app).get('/api/v1/audit?url=https://example.com');
      expect(auditRes.headers['x-ratelimit-limit']).toBeDefined();
      expect(auditRes.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });
});
