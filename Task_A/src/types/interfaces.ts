export interface IUrlValidator {
  validate(url: string): { valid: boolean; normalizedUrl?: string; error?: string };
}

export interface IIpGuard {
  isPrivateIp(ip: string): boolean;
  checkSsrf(hostname: string): Promise<boolean>;
}

export interface ICacheProvider<T> {
  get(key: string): T | null;
  set(key: string, value: T, ttlSeconds: number): void;
  clear(): void;
}

export interface IRateLimiter {
  isAllowed(clientId: string): { allowed: boolean; remaining: number; resetTime: number };
}

export interface IAuditEngine {
  executeAudit(url: string): Promise<any>;
}
