import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as dns } from 'node:dns';

const execAsync = promisify(exec);

interface AXFRRequest {
  domain: string;
  nameserver?: string;
}

interface NameserverResult {
  nameserver: string;
  ip: string;
  vulnerable: boolean;
  recordCount?: number;
  records?: string[];
  error?: string;
  responseTime: number;
}

interface AXFRResponse {
  domain: string;
  nameservers: NameserverResult[];
  summary: {
    total: number;
    vulnerable: number;
    secure: number;
    errors: number;
  };
  timestamp: string;
}

const DOMAIN_PATTERN = /^([a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.)+[a-zA-Z]{2,}$/;
const MAX_DOMAIN_LENGTH = 253;
const AXFR_TIMEOUT_MS = 10000;
const MAX_RECORDS_DISPLAY = 50;

function validateDomain(domain: string): boolean {
  if (!domain || domain.length > MAX_DOMAIN_LENGTH) return false;
  return DOMAIN_PATTERN.test(domain);
}

async function resolveNameserverIP(nameserver: string): Promise<string> {
  try {
    const addresses = await dns.resolve4(nameserver);
    return addresses[0];
  } catch {
    try {
      const addresses = await dns.resolve6(nameserver);
      return addresses[0];
    } catch {
      throw new Error(`Failed to resolve nameserver: ${nameserver}`);
    }
  }
}

async function testAXFR(domain: string, nameserver: string, ip: string): Promise<NameserverResult> {
  const startTime = performance.now();

  try {
    // Use dig for AXFR query with timeout
    const command = `dig @${ip} ${domain} AXFR +time=5 +retry=1 +noidnout 2>&1`;

    const { stdout, stderr } = await Promise.race([
      execAsync(command, { maxBuffer: 1024 * 1024 * 5 }), // 5MB max
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AXFR query timeout')), AXFR_TIMEOUT_MS)
      ),
    ]);

    const endTime = performance.now();
    const responseTime = Math.round((endTime - startTime) * 100) / 100;

    const output = stdout + stderr;

    // Check for transfer success indicators
    if (output.includes('Transfer failed') || output.includes('failed')) {
      return {
        nameserver,
        ip,
        vulnerable: false,
        error: 'Transfer refused (secure)',
        responseTime,
      };
    }

    // Check for timeout
    if (output.includes('connection timed out') || output.includes('no servers could be reached')) {
      return {
        nameserver,
        ip,
        vulnerable: false,
        error: 'Connection timeout',
        responseTime,
      };
    }

    // Parse records from output
    const lines = output.split('\n').filter((line: string) => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !trimmed.startsWith(';') &&
        !trimmed.startsWith('<<>>') &&
        !trimmed.match(/^(DiG|global|Query|Transfer|connection|WARNING)/)
      );
    });

    // If we got actual zone records, it's vulnerable
    if (lines.length > 0) {
      // Filter out metadata lines
      const zoneRecords = lines.filter((line: string) => {
        return line.match(/^\S+\s+\d+\s+IN\s+\w+\s+/);
      });

      if (zoneRecords.length > 0) {
        return {
          nameserver,
          ip,
          vulnerable: true,
          recordCount: zoneRecords.length,
          records: zoneRecords.slice(0, MAX_RECORDS_DISPLAY),
          responseTime,
        };
      }
    }

    // No records returned - secure
    return {
      nameserver,
      ip,
      vulnerable: false,
      error: 'Transfer refused (secure)',
      responseTime,
    };
  } catch (err: any) {
    const endTime = performance.now();
    const responseTime = Math.round((endTime - startTime) * 100) / 100;

    let errorMsg = 'Unknown error';
    if (err.message?.includes('timeout')) {
      errorMsg = 'Query timeout';
    } else if (err.message?.includes('not found')) {
      errorMsg = 'Nameserver not found';
    } else if (err.code === 'ENOENT') {
      errorMsg = 'dig command not available';
    } else if (err.message) {
      errorMsg = err.message.split('\n')[0].substring(0, 100);
    }

    return {
      nameserver,
      ip,
      vulnerable: false,
      error: errorMsg,
      responseTime,
    };
  }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    let body: AXFRRequest;
    try {
      body = await request.json();
    } catch {
      throw error(400, 'Invalid JSON in request body');
    }

    const { domain, nameserver } = body;

    if (!domain || typeof domain !== 'string' || !domain.trim()) {
      throw error(400, 'Domain is required');
    }

    const trimmedDomain = domain.trim().toLowerCase();

    if (!validateDomain(trimmedDomain)) {
      throw error(400, 'Invalid domain name format');
    }

    // Get nameservers to test
    let nameserversToTest: string[] = [];

    if (nameserver && typeof nameserver === 'string' && nameserver.trim()) {
      // Single nameserver specified
      nameserversToTest = [nameserver.trim()];
    } else {
      // Get all nameservers for domain
      try {
        nameserversToTest = await dns.resolveNs(trimmedDomain);
      } catch (err: any) {
        if (err.code === 'ENOTFOUND') {
          throw error(400, 'Domain not found or has no nameservers');
        }
        throw error(500, `Failed to resolve nameservers: ${err.message}`);
      }
    }

    if (nameserversToTest.length === 0) {
      throw error(400, 'No nameservers found for domain');
    }

    // Limit to 10 nameservers for safety
    if (nameserversToTest.length > 10) {
      nameserversToTest = nameserversToTest.slice(0, 10);
    }

    // Test AXFR on all nameservers
    const results = await Promise.all(
      nameserversToTest.map(async (ns): Promise<NameserverResult> => {
        try {
          const ip = await resolveNameserverIP(ns);
          return await testAXFR(trimmedDomain, ns, ip);
        } catch (err: any) {
          return {
            nameserver: ns,
            ip: 'N/A',
            vulnerable: false,
            error: err.message || 'Failed to resolve nameserver',
            responseTime: 0,
          };
        }
      })
    );

    // Calculate summary
    const vulnerable = results.filter((r) => r.vulnerable).length;
    const secure = results.filter((r) => !r.vulnerable && !r.error).length;
    const errors = results.filter((r) => r.error).length;

    const response: AXFRResponse = {
      domain: trimmedDomain,
      nameservers: results,
      summary: {
        total: results.length,
        vulnerable,
        secure,
        errors,
      },
      timestamp: new Date().toISOString(),
    };

    return json(response);
  } catch (err) {
    console.error('AXFR test error:', err);
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    throw error(500, `AXFR test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};
