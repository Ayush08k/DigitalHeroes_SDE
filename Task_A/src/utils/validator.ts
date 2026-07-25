import ipaddr from 'ipaddr.js';
import dns from 'dns';
import { URL } from 'url';

/**
 * Validates whether a URL string is syntactically valid and uses http/https.
 */
export function validateUrl(inputUrl: string): { valid: boolean; normalizedUrl?: string; error?: string } {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string.' };
  }

  let formatted = inputUrl.trim();
  if (formatted.includes('://')) {
    const scheme = formatted.split('://')[0].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are supported.' };
    }
  } else {
    formatted = 'https://' + formatted;
  }

  try {
    const parsed = new URL(formatted);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are supported.' };
    }
    return { valid: true, normalizedUrl: parsed.toString() };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format.' };
  }
}

/**
 * Checks if a given IP address belongs to private/loopback/reserved subnets (SSRF protection).
 */
export function isPrivateIp(ip: string): boolean {
  try {
    if (!ipaddr.isValid(ip)) return false;
    const parsedIp = ipaddr.parse(ip);
    const range = parsedIp.range();
    const privateRanges = [
      'loopback',
      'private',
      'linkLocal',
      'uniqueLocal',
      'carrierGradeNat',
      'unspecified',
      'broadcast'
    ];
    return privateRanges.includes(range);
  } catch (err) {
    return true; // fail closed
  }
}

/**
 * Resolves domain to IP and checks for SSRF targets.
 */
export function checkSsrf(hostname: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Direct IP check
    if (ipaddr.isValid(hostname)) {
      return resolve(isPrivateIp(hostname));
    }

    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        return resolve(true); // Fail closed if DNS resolution fails or returns nothing
      }

      for (const addr of addresses) {
        if (isPrivateIp(addr.address)) {
          return resolve(true); // Blocked!
        }
      }

      resolve(false); // Safe
    });
  });
}
