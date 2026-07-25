# Task B: Observability, Alerting & Rollback Plan

## 1. Observability Architecture & Four Golden Signals

### 1.1 Metrics Tracking (Prometheus + Grafana)
- **Latency**:
  - `pagepulse_audit_duration_seconds` (Histogram with p50, p95, p99 quantiles).
  - Target SLA: p95 < 500ms (cached), p95 < 4000ms (uncached).
- **Traffic**:
  - `pagepulse_requests_total` (Counter by endpoint, status code, client IP).
- **Errors**:
  - `pagepulse_errors_total` (Counter by error code: `SSRF_BLOCKED`, `TIMEOUT`, `RATE_LIMITED`, `5XX`).
  - Target SLA: Error rate < 0.1%.
- **Saturation**:
  - `pagepulse_queue_depth` (Gauge tracking pending BullMQ jobs).
  - `pagepulse_active_workers` (Gauge tracking concurrency semaphore state).
  - CPU & Memory utilization per container instance (Target < 70%).

### 1.2 Structured Tracing & Centralized Logging
- OpenTelemetry instrumentation propagating `X-Request-ID` and `traceparent` across API instances, Redis, and Async Workers.
- Centralized log aggregator (Elasticsearch / Datadog / Grafana Loki).

---

## 2. Alerting Rules Matrix

| Alert Name | Condition / Threshold | Severity | Notification Channel | Action |
| :--- | :--- | :--- | :--- | :--- |
| **HighErrorRate** | 5xx errors > 2% over 5m | Critical | PagerDuty / Slack | Trigger automated rollback check |
| **SlaBreachP95** | p95 latency > 2000ms for 5m | Warning | Slack Dev Channel | Auto-scale worker pool |
| **QueueBacklogSpike** | Queue depth > 1,500 jobs | Critical | PagerDuty | Enable aggressive rate limits |
| **RedisMemoryHigh** | Redis RAM usage > 85% | Critical | PagerDuty | Trigger cache eviction cleanup |

---

## 3. Automated Rollback & Deployment Plan

### 3.1 Deployment Strategy: **Canary Release (10% -> 50% -> 100%)**
1. **Stage 1 (Canary)**: Deploy new build version to 10% of API/Worker instances. Route 10% traffic via Load Balancer.
2. **Stage 2 (Validation)**: Monitor error rate and p95 latency for 10 minutes.
3. **Stage 3 (Full Rollout)**: Automatically scale canary to 100% if zero critical alerts fire.

### 3.2 Automated Rollback Triggers
An automated rollback script immediately reverts Load Balancer traffic to the previous stable release container image if:
- `pagepulse_errors_total` rate exceeds **1.5%** within 3 minutes of deployment.
- Unhandled runtime crash loops (`panic` / `uncaughtException`) exceed **5 occurrences**.
- Health check `/api/v1/health` fails on canary instances twice consecutively.
