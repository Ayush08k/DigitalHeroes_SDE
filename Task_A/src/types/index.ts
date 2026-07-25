export interface AuditMetrics {
  responseTimeMs: number;
  statusCode: number;
  statusText: string;
  contentLengthBytes: number;
  contentType: string;
  isSslSecure: boolean;
  serverHeader?: string;
  redirectCount: number;
}

export interface AuditResult {
  url: string;
  normalizedUrl: string;
  timestamp: string;
  cached: boolean;
  metrics: AuditMetrics;
  headers: Record<string, string>;
  securityFlags: {
    hasHsts: boolean;
    hasCsp: boolean;
    hasXContentTypeOptions: boolean;
    hasFrameOptions: boolean;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
    timestamp: string;
    details?: any;
  };
}
