# Task B: Technology Decision Record (TDR)

## 1. Message Queue & Task Orchestration

### Selected: **BullMQ + Redis Streams**
- **Justification**: Provides ultra-low latency (< 2ms job enqueueing time), built-in delay queues, rate limiting per target domain, automatic retries with exponential backoff, and seamless integration with Node.js/TypeScript.
- **Alternatives Rejected**:
  - *Apache Kafka*: Rejected due to high operational complexity, partition key management overhead, and unneeded stream replay features for simple transient URL audit jobs.
  - *AWS SQS*: Rejected due to vendor lock-in, higher polling latency (~20ms+), and lack of native support for target-domain rate limiting without complex FIFO message group orchestration.

---

## 2. Distributed Cache & In-Memory Store

### Selected: **Redis Cluster (AWS ElastiCache / Redis Enterprise)**
- **Justification**: Sub-millisecond latency for key-value retrieval, native support for atomic Token Bucket rate limiting via Lua scripts, and high availability via multi-AZ replication.
- **Alternatives Rejected**:
  - *Memcached*: Rejected because it lacks data structure support (Lists/Sorted Sets needed for rate limiting and queuing) and has no native multi-AZ failover replication.
  - *In-Memory local cache (Node.js Map)*: Rejected for multi-instance scaling as state would not be shared across load-balanced API instances, leading to cache fragmentation and rate limit bypasses.

---

## 3. Persistent Database

### Selected: **PostgreSQL (with TimescaleDB extension / Partitioning)**
- **Justification**: ACID compliance, rich indexing capabilities on JSONB security headers, declarative table partitioning by month for historical audit retention, and robust performance for relational queries.
- **Alternatives Rejected**:
  - *MongoDB*: Rejected due to higher storage overhead for structured metrics and potential data consistency trade-offs under high write concurrency.
  - *DynamoDB*: Rejected due to query flexibility limitations and unpredictable cost spikes under heavy write bursts.

---

## 4. API Runtime & Execution Framework

### Selected: **Node.js (TypeScript) + Fastify / Express**
- **Justification**: Non-blocking I/O model ideal for network-bound workloads (HTTP outbound auditing), high community ecosystem support, strong TypeScript interface safety, and low memory footprint (~50MB per instance).
- **Alternatives Rejected**:
  - *Python (Flask/Django)*: Rejected due to thread blocking overhead and slower synchronous I/O execution for high concurrency bursts.
  - *Go (Golang)*: Considered a strong candidate, but Node.js was selected for rapid development velocity and shared codebase/models between API and Worker layers.
