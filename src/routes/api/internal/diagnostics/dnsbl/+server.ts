import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { promises as dns } from 'node:dns';

interface DNSBLRequest {
  target: string; // IP or domain
}

interface RBLResult {
  rbl: string;
  listed: boolean;
  response?: string;
  reason?: string;
  responseTime: number;
  error?: string;
  url?: string;
  description?: string;
}

interface DNSBLResponse {
  target: string;
  targetType: 'ipv4' | 'ipv6' | 'domain';
  resolvedIPs?: string[];
  results: RBLResult[];
  summary: {
    totalChecked: number;
    listedCount: number;
    cleanCount: number;
    errorCount: number;
  };
  timestamp: string;
}

// Comprehensive list of major RBLs
const RBLS = [
  // Spamhaus
  // { zone: 'zen.spamhaus.org', name: 'Spamhaus ZEN', description: 'Combined blocklist', url: 'https://www.spamhaus.org/lookup/' },
  // { zone: 'sbl.spamhaus.org', name: 'Spamhaus SBL', description: 'Spam sources', url: 'https://www.spamhaus.org/lookup/' },
  // { zone: 'xbl.spamhaus.org', name: 'Spamhaus XBL', description: 'Exploits', url: 'https://www.spamhaus.org/lookup/' },
  // { zone: 'pbl.spamhaus.org', name: 'Spamhaus PBL', description: 'Policy blocklist', url: 'https://www.spamhaus.org/lookup/' },
  { zone: 'dbl.spamhaus.org', name: 'Spamhaus DBL', description: 'Domain blocklist', url: 'https://www.spamhaus.org/lookup/' },

  // SORBS
  { zone: 'dnsbl.sorbs.net', name: 'SORBS', description: 'Spam sources', url: 'https://www.sorbs.net/lookup.shtml' },

  // SpamCop
  { zone: 'bl.spamcop.net', name: 'SpamCop', description: 'Spam reports', url: 'https://www.spamcop.net/bl.shtml' },

  // Barracuda
  { zone: 'b.barracudacentral.org', name: 'Barracuda', description: 'Reputation system', url: 'https://barracudacentral.org/lookups' },

  // UCEPROTECT
  { zone: 'dnsbl-1.uceprotect.net', name: 'UCEPROTECT L1', description: 'Single IPs', url: 'https://www.uceprotect.net/en/rblcheck.php' },
  { zone: 'dnsbl-2.uceprotect.net', name: 'UCEPROTECT L2', description: 'ISP ranges', url: 'https://www.uceprotect.net/en/rblcheck.php' },
  { zone: 'dnsbl-3.uceprotect.net', name: 'UCEPROTECT L3', description: 'Countries/ASNs', url: 'https://www.uceprotect.net/en/rblcheck.php' },

  // PSBL
  { zone: 'psbl.surriel.com', name: 'PSBL', description: 'Passive spam block', url: 'https://psbl.org/' },

  // Others
  // { zone: 'cbl.abuseat.org', name: 'CBL', description: 'Composite blocking', url: 'https://www.abuseat.org/lookup.cgi' },
  { zone: 'dnsbl.dronebl.org', name: 'DroneBL', description: 'Drones/zombies', url: 'https://dronebl.org/lookup' },
  { zone: 'spam.dnsbl.sorbs.net', name: 'SORBS Spam', description: 'Verified spam', url: 'https://www.sorbs.net/lookup.shtml' },
  { zone: 'dul.dnsbl.sorbs.net', name: 'SORBS DUL', description: 'Dynamic IPs', url: 'https://www.sorbs.net/lookup.shtml' },

  { zone: 'bl.blocklist.de', name: 'Blocklist.de', description: 'Blocklist.de (abusive mail servers)', url: 'https://www.blocklist.de/en/index.html' },
  { zone: 'bl.mailspike.net', name: 'Mailspike', description: 'Mailspike abuse list', url: 'https://mailspike.org/' },
  { zone: 'all.spamrats.com', name: 'SpamRats', description: 'SpamRats RBL', url: 'https://www.spamrats.com/' },
  { zone: 'multi.surbl.org', name: 'SURBL Multi', description: 'URI/domain lists (phishing/malware/abuse)', url: 'https://www.surbl.org/' },
  { zone: 'dnsrbl.org', name: 'DNSRBL', description: 'DNS Real-time Blackhole List', url: 'https://dnsrbl.org/' },
];

function isIPv4(str: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(str);
}

function isIPv6(str: string): boolean {
  return /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(str);
}

function reverseIPv4(ip: string): string {
  return ip.split('.').reverse().join('.');
}

function reverseIPv6(ip: string): string {
  // Expand IPv6 to full form
  const parts = ip.split(':');
  const fullParts: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '') {
      const zerosNeeded = 8 - parts.filter(p => p !== '').length;
      for (let j = 0; j <= zerosNeeded; j++) {
        fullParts.push('0000');
      }
    } else {
      fullParts.push(parts[i].padStart(4, '0'));
    }
  }

  // Convert to nibble format and reverse
  const nibbles = fullParts.slice(0, 8).join('').split('').reverse().join('.');
  return nibbles;
}

async function checkRBL(ip: string, rbl: typeof RBLS[0], isDomain: boolean): Promise<RBLResult> {
  const startTime = Date.now();

  try {
    let query: string;

    if (isDomain) {
      // For domain blacklists, query domain directly
      query = `${ip}.${rbl.zone}`;
    } else if (isIPv4(ip)) {
      query = `${reverseIPv4(ip)}.${rbl.zone}`;
    } else if (isIPv6(ip)) {
      query = `${reverseIPv6(ip)}.${rbl.zone}`;
    } else {
      throw new Error('Invalid IP format');
    }

    const addresses = await dns.resolve4(query);
    const responseTime = Date.now() - startTime;

    // Get TXT record for listing reason
    let reason: string | undefined;
    try {
      const txtRecords = await dns.resolveTxt(query);
      reason = txtRecords.flat().join(' ');
    } catch {
      // TXT record optional
    }

    // Check if this is an error response rather than actual listing
    // Many RBLs return specific codes for errors (e.g., 127.255.255.x for errors)
    const response = addresses[0];
    const isErrorResponse =
      response.startsWith('127.255.') || // Common error code range
      (reason && (
        reason.toLowerCase().includes('open resolver') ||
        reason.toLowerCase().includes('query refused') ||
        reason.toLowerCase().includes('not supported') ||
        reason.toLowerCase().includes('check.spamhaus.org') ||
        reason.toLowerCase().includes('blocked - see') ||
        reason.toLowerCase().includes('access denied') ||
        reason.toLowerCase().includes('please use')
      ));

    if (isErrorResponse) {
      return {
        rbl: rbl.name,
        listed: false,
        responseTime,
        error: reason || 'RBL query blocked or unsupported',
      };
    }

    return {
      rbl: rbl.name,
      listed: true,
      response,
      reason,
      responseTime,
      url: rbl.url,
      description: rbl.description,
    };
  } catch (err: any) {
    const responseTime = Date.now() - startTime;

    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      // Not listed
      return {
        rbl: rbl.name,
        listed: false,
        responseTime,
      };
    }

    // Actual error
    return {
      rbl: rbl.name,
      listed: false,
      responseTime,
      error: err.message,
    };
  }
}

async function resolveTarget(target: string): Promise<{ type: 'ipv4' | 'ipv6' | 'domain'; ips?: string[] }> {
  if (isIPv4(target)) {
    return { type: 'ipv4' };
  }

  if (isIPv6(target)) {
    return { type: 'ipv6' };
  }

  // It's a domain, resolve to IPs
  try {
    const ips: string[] = [];
    let lastError: Error | null = null;

    try {
      const ipv4s = await dns.resolve4(target);
      ips.push(...ipv4s);
    } catch (err) {
      lastError = err as Error;
      // No IPv4
    }

    try {
      const ipv6s = await dns.resolve6(target);
      ips.push(...ipv6s);
    } catch (err) {
      if (!lastError) lastError = err as Error;
      // No IPv6
    }

    if (ips.length === 0) {
      // Provide helpful error message based on DNS error
      if (lastError && 'code' in lastError) {
        if (lastError.code === 'ENOTFOUND') {
          throw new Error(`Domain "${target}" does not exist or could not be found`);
        } else if (lastError.code === 'ENODATA') {
          throw new Error(`Domain "${target}" exists but has no A or AAAA records`);
        } else if (lastError.code === 'ETIMEOUT') {
          throw new Error(`DNS lookup timed out for "${target}"`);
        }
      }
      throw new Error(`Could not resolve domain "${target}" to any IP addresses`);
    }

    return { type: 'domain', ips };
  } catch (err) {
    throw new Error(`Failed to resolve domain: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body: DNSBLRequest = await request.json();
    const { target } = body;

    if (!target || typeof target !== 'string' || !target.trim()) {
      throw error(400, 'Target IP or domain is required');
    }

    const trimmedTarget = target.trim().toLowerCase();

    // Resolve target
    const { type, ips } = await resolveTarget(trimmedTarget);

    let allResults: RBLResult[] = [];

    if (type === 'domain') {
      // Check domain blacklists (DBL)
      const domainRBLs = RBLS.filter(rbl => rbl.zone.includes('dbl'));
      const domainChecks = domainRBLs.map(rbl => checkRBL(trimmedTarget, rbl, true));
      const domainResults = await Promise.all(domainChecks);
      allResults.push(...domainResults);

      // Check IPs against IP blacklists
      if (ips && ips.length > 0) {
        const ipRBLs = RBLS.filter(rbl => !rbl.zone.includes('dbl'));

        for (const ip of ips) {
          const ipChecks = ipRBLs.map(rbl => checkRBL(ip, rbl, false));
          const ipResults = await Promise.all(ipChecks);
          allResults.push(...ipResults.map(r => ({ ...r, rbl: `${r.rbl} (${ip})` })));
        }
      }
    } else {
      // Check IP against all IP blacklists
      const ipRBLs = RBLS.filter(rbl => !rbl.zone.includes('dbl'));
      const checks = ipRBLs.map(rbl => checkRBL(trimmedTarget, rbl, false));
      allResults = await Promise.all(checks);
    }

    const summary = {
      totalChecked: allResults.length,
      listedCount: allResults.filter(r => r.listed).length,
      cleanCount: allResults.filter(r => !r.listed && !r.error).length,
      errorCount: allResults.filter(r => r.error).length,
    };

    const response: DNSBLResponse = {
      target: trimmedTarget,
      targetType: type,
      resolvedIPs: ips,
      results: allResults,
      summary,
      timestamp: new Date().toISOString(),
    };

    return json(response);
  } catch (err) {
    console.error('DNSBL check error:', err);
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    throw error(500, `DNSBL check failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};
