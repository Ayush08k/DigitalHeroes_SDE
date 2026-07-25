# Task A - Production-Grade PagePulse URL Audit Service

A scalable, production-grade microservice for auditing websites and web applications with real-time metrics, SSRF protection, caching, token-bucket rate limiting, structured logging, request correlation tracing, and a responsive web UI.

---

## 🌟 Features & System Design

1. **Input Validation & Resilience**:
   - Strict protocol enforcement (HTTP/HTTPS).
   - SSRF (Server-Side Request Forgery) protection blocking loopback (`127.0.0.1`), private IPv4 (`10.x`, `192.168.x`, `172.16.x`), IPv6 link-local, and reserved subnets via DNS pre-lookup.
   - Configurable audit request timeout (`AUDIT_TIMEOUT_MS`, default `5000ms`).
   - Semaphore concurrency limiter preventing resource exhaustion (`MAX_CONCURRENT_AUDITS`, default `5`).

2. **Caching Strategy**:
   - In-memory cache layer (`InMemoryCache`) with configurable TTL (`CACHE_TTL_SECONDS`).
   - Returns explicit `X-Cache: HIT` or `X-Cache: MISS` headers.

3. **Rate Limiting & Correlation Tracing**:
   - Token Bucket algorithm implementation for per-client rate limiting.
   - Headers exposed: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
   - Unique correlation Request ID (`X-Request-ID`) attached to every request and structured log entry (powered by Winston JSON logger).

4. **Responsive Web UI Dashboard**:
   - Built with modern HTML5/CSS3/JavaScript (Zero external frontend frameworks).
   - Mobile-responsive layout optimized for all viewport sizes (Desktop, Tablet, Mobile).
   - Footer contains mandatory visible credit: **[Built for Digital Heroes Training Task](https://digitalheroesco.com)**.

5. **CI/CD Pipeline**:
   - Fully automated test workflow configured under `.github/workflows/ci.yml`.

---

## 🚀 Quick Start

### 1. Installation

```bash
cd Task_A
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` (optional defaults are built-in):

```env
PORT=3000
NODE_ENV=development
CACHE_TTL_SECONDS=60
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
AUDIT_TIMEOUT_MS=5000
MAX_CONCURRENT_AUDITS=5
```

### 3. Run Development Server

```bash
npm run dev
```

Visit the dashboard in your browser at: `http://localhost:3000`

### 4. Build & Start Production Server

```bash
npm run build
npm start
```

### 5. Execute Test Suite

```bash
npm test
```

---

## 📖 API Documentation & Specifications

### 1. Audit URL

- **Endpoint**: `GET /api/v1/audit` or `POST /api/v1/audit`
- **Query Parameters**: `url` (required), `ttl` (optional, seconds)
- **Response Headers**:
  - `X-Request-ID`: `req-1784953479099-cc2deabe`
  - `X-Cache`: `HIT` | `MISS`
  - `X-RateLimit-Limit`: `10`
  - `X-RateLimit-Remaining`: `9`

#### Success Response (`200 OK`)

```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "normalizedUrl": "https://example.com/",
    "timestamp": "2026-07-25T04:24:39.209Z",
    "cached": false,
    "metrics": {
      "responseTimeMs": 110,
      "statusCode": 200,
      "statusText": "OK",
      "contentLengthBytes": 1256,
      "contentType": "text/html; charset=UTF-8",
      "isSslSecure": true,
      "serverHeader": "ECS (sjc/4E74)",
      "redirectCount": 0
    },
    "headers": {
      "content-type": "text/html; charset=UTF-8",
      "server": "ECS (sjc/4E74)"
    },
    "securityFlags": {
      "hasHsts": false,
      "hasCsp": false,
      "hasXContentTypeOptions": true,
      "hasFrameOptions": true
    }
  }
}
```

#### Error Response (`400 Bad Request` / `403 Forbidden` / `429 Rate Limit` / `504 Gateway Timeout`)

```json
{
  "error": {
    "code": "FORBIDDEN_TARGET",
    "message": "Forbidden target: IP or hostname is restricted for security (SSRF prevention).",
    "requestId": "req-1784953479083-20d7b2ef",
    "timestamp": "2026-07-25T04:24:39.086Z"
  }
}
```

### 2. Service Health Check

- **Endpoint**: `GET /api/v1/health`
- **Response (`200 OK`)**:
```json
{
  "status": "healthy",
  "timestamp": "2026-07-25T04:24:39.047Z",
  "service": "PagePulse Audit Service"
}
```

---

## 🛡️ License & Credits

Built for **Digital Heroes Training Task**.  
Live verification link: [digitalheroesco.com](https://digitalheroesco.com)
