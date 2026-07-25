# Task B: Failure Mode Analysis & Resiliency Strategy

This document details the three most critical failure modes at a scale of 10,000+ daily audits with 500 concurrent request bursts, alongside concrete architectural mitigations.

---

## Failure Mode 1: Downstream Target Slowdown / Slowloris / Tar Pit Attacks

### Scenario & Impact
An audited target server intentionally or unintentionally delays responding (e.g. holds HTTP response open for 30+ seconds or streams 1 byte/sec). Under a 500-request burst, all available worker HTTP connections and event loop sockets get exhausted, leading to worker pool starvation and API timeouts.

### Architectural Mitigations
1. **Strict Multi-Layer Timeout Guard**:
   - Hard socket timeout (`AUDIT_TIMEOUT_MS = 5000ms`).
   - Response header timeout (`3000ms`).
2. **Circuit Breaker Pattern (Opossum / Resilience4j)**:
   - Tracks failure rate per target domain. If a target domain fails or times out 5 consecutive times, the Circuit Breaker trips to `OPEN` for 60 seconds, immediately short-circuiting future audits for that domain.
3. **Worker Pool Isolation & Concurrency Semaphores**:
   - Limit maximum active outbound requests per domain to 2.

---

## Failure Mode 2: Cache Stampede (Thundering Herd Problem)

### Scenario & Impact
When a high-traffic URL's cache entry expires during a burst of 500 concurrent requests, all 500 requests simultaneously miss the cache and issue duplicate outbound HTTP audit requests to the target URL. This overloads the target and spikes internal queue latency.

### Architectural Mitigations
1. **Distributed Mutex Lock (Redlock algorithm)**:
   - When a cache miss occurs, the first API worker acquires a short-lived Redis lock (`lock:audit:<url_hash>`) for 5 seconds.
   - Subsequent requests fail to acquire the lock and wait/subscribe on Redis Pub/Sub for the leader instance to write the cache entry.
2. **Probabilistic Early Eviction (XFetch Algorithm)**:
   - Recomputes cache in the background slightly before formal expiration based on request frequency.

---

## Failure Mode 3: Queue Backlog Growth & Memory Overflow

### Scenario & Impact
If external network connectivity degrades or worker instances crash, incoming audit requests accumulate rapidly in BullMQ/Redis, consuming system RAM and triggering Redis Out-Of-Memory (`OOM`) crashes.

### Architectural Mitigations
1. **Backpressure & Queue Depth Guard**:
   - API layer monitors total pending jobs in BullMQ. If queue depth exceeds 2,000 jobs, incoming non-cached audits are rejected at the edge with `429 Too Many Requests` (Header: `Retry-After: 30`).
2. **Max TTL & Eviction Policies on Queues**:
   - Unprocessed jobs automatically expire after 10 minutes.
3. **Dead Letter Queue (DLQ)**:
   - Failed jobs after 3 retries are moved to a DLQ for offline analysis, preventing queue head-of-line blocking.
