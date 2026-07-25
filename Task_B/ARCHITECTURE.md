# Task B: Design for Scale — PagePulse Architecture & System Design

## 1. System Overview & Scalability Requirements

The PagePulse service must scale from a basic single-instance service to a resilient, high-throughput microservice architecture capable of handling **10,000+ audits per day**, with **burst loads of 500 concurrent requests**, while maintaining strict customer SLAs (p95 response time < 500ms for cached items, async feedback within 200ms for uncached audits).

---

## 2. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Client Layer
        C1[Mobile App / Web UI]
        C2[API Clients / Webhooks]
    end

    subgraph Edge Layer
        ALB[Application Load Balancer / NGINX]
        RL[Distributed Rate Limiter - Token Bucket / Redis]
    end

    subgraph Application Service Layer
        API1[API Instance 1 - Node.js/TS]
        API2[API Instance 2 - Node.js/TS]
        API3[API Instance N - Auto-Scaled]
    end

    subgraph Data & Queue Layer
        RC[(Redis Cluster - Cache & Rate Limits)]
        MQ[[Message Queue - BullMQ / Redis Streams]]
        DLQ[[Dead Letter Queue]]
    end

    subgraph Async Worker Layer
        W1[Audit Worker 1]
        W2[Audit Worker 2]
        WN[Audit Worker N - Auto-Scaled]
    end

    subgraph Storage & Observability Layer
        DB[(PostgreSQL Primary DB - Audit Logs)]
        PROM[Prometheus / Grafana - Metrics]
    end

    C1 -->|HTTPS| ALB
    C2 -->|HTTPS| ALB
    ALB --> RL
    RL --> API1
    RL --> API2
    RL --> API3

    API1 -->|Check Cache| RC
    API2 -->|Check Cache| RC
    API3 -->|Check Cache| RC

    API1 -->|Enqueue Async Audit| MQ
    API2 -->|Enqueue Async Audit| MQ
    API3 -->|Enqueue Async Audit| MQ

    MQ --> W1
    MQ --> W2
    MQ --> WN

    W1 -->|Audit Target URL| Target[Target External Websites]
    W2 -->|Audit Target URL| Target
    WN -->|Audit Target URL| Target

    W1 -->|Write Audit Cache & Results| RC
    W1 -->|Persist Audit Record| DB
    W1 -->|Failed Tasks| DLQ

    API1 -.->|Metrics| PROM
    W1 -.->|Metrics| PROM
```

---

## 3. Data Flow & Queueing Strategy

### 3.1 Synchronous vs. Asynchronous Read/Write Flow

1. **Cache Hit Path (Fast Path)**:
   - Request reaches Load Balancer -> Distributed Rate Limiter check in Redis.
   - API layer queries Redis Cache by normalized URL hash.
   - If present, returns `200 OK` with `X-Cache: HIT` within **< 15ms**.

2. **Cache Miss / Burst Path (Asynchronous Queueing)**:
   - If absent, API generates a `jobId` / `requestId`, publishes an audit job to **BullMQ / Redis Streams**, and registers a short-polling or WebSocket listener.
   - For synchronous API compatibility, API waits up to `3000ms` on a Redis Pub/Sub channel for worker completion.
   - If job completion exceeds synchronous threshold, returns `202 Accepted` with a status polling endpoint `GET /api/v1/jobs/:jobId`.

### 3.2 Queueing & Backpressure Management

- **Queue Isolation**: Separate queues for High Priority (Paid tier), Normal Priority, and Retry Queue.
- **Concurrency Bounds**: Each worker consumes up to 25 concurrent HTTP audit tasks utilizing an internal semaphore.
- **Rate Limit per Target Host**: Domain-level throttling (max 2 requests/sec per target domain) to avoid unintentional DDoS on audited third-party servers.

---

## 4. State Management Matrix

| State Type | Component | Tech Stack | Eviction / Persistence Policy |
| :--- | :--- | :--- | :--- |
| **Rate Limit Counters** | Edge / Middleware | Redis Cluster | Sliding Window TTL (60s) |
| **Audit Result Cache** | Fast Read Layer | Redis Cluster | LRU Eviction, Configurable TTL (60s - 3600s) |
| **Job Queue & Retry** | Task Pipeline | BullMQ / Redis | Persistence to AOF disk; DLQ after 3 failures |
| **Audit Analytics & History** | Permanent Store | PostgreSQL | Partitioned by month; indexed by URL hash & timestamp |
| **Request Correlation** | Context Middleware | Request ID Header | In-memory request context propagation |

---

## 5. System Design Principles Applied (SOLID)

1. **Single Responsibility Principle (SRP)**: Separated API ingestion, validation, queuing, execution, and persistent logging into decoupled modules.
2. **Open/Closed Principle (OCP)**: Caching layer and Worker engines use clean interface contracts (`ICacheService`, `IAuditEngine`), enabling seamless migration from Redis to Memcached or Kafka without breaking existing code.
3. **Liskov Substitution Principle (LSP)**: `RedisCache` and `InMemoryCache` strictly implement `ICacheProvider`, allowing transparent swapping in test/dev vs production environments.
4. **Interface Segregation Principle (ISP)**: Clients depend only on specific small interfaces (`IUrlValidator`, `IRateLimiter`, `IAuditReporter`) rather than monolithic interfaces.
5. **Dependency Inversion Principle (DIP)**: High-level controllers depend on abstractions (`IAuditService`), initialized via Dependency Injection.
