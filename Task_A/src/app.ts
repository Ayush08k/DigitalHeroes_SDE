import express from 'express';
import cors from 'cors';
import path from 'path';
import { requestIdMiddleware } from './middleware/requestId';
import { loggerMiddleware } from './middleware/loggerMiddleware';
import { rateLimiterMiddleware } from './middleware/rateLimiter';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import { AuditController } from './controllers/auditController';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Core Middlewares
app.use(requestIdMiddleware);
app.use(loggerMiddleware);

// Serve static frontend dashboard
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'PagePulse Audit Service'
  });
});

// Audit endpoints (Rate Limited)
app.get('/api/v1/audit', rateLimiterMiddleware, AuditController.auditUrl);
app.post('/api/v1/audit', rateLimiterMiddleware, AuditController.auditUrl);
app.post('/api/v1/cache/clear', AuditController.clearCache);

// Fallback error handler
app.use(errorHandlerMiddleware);

export default app;
