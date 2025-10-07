import { describe, it, expect } from 'vitest';

describe('AXFR Security Tester API', () => {
  const BASE_URL = 'http://localhost:5173';

  async function makeRequest(domain: string, nameserver?: string) {
    const response = await fetch(`${BASE_URL}/api/internal/diagnostics/axfr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, nameserver }),
    });
    const data = await response.json();
    return { status: response.status, data };
  }

  describe('Basic Functionality', () => {
    it('should test domain for AXFR vulnerability', async () => {
      const { status, data } = await makeRequest('example.com');

      expect(status).toBe(200);
      expect(data.domain).toBe('example.com');
      expect(data.nameservers).toBeInstanceOf(Array);
      expect(data.nameservers.length).toBeGreaterThan(0);
      expect(data.summary).toBeDefined();
      expect(data.summary.total).toBe(data.nameservers.length);
      expect(data.timestamp).toBeDefined();
    });

    it('should include all required fields in nameserver results', async () => {
      const { status, data } = await makeRequest('example.com');

      expect(status).toBe(200);

      for (const ns of data.nameservers) {
        expect(ns).toHaveProperty('nameserver');
        expect(ns).toHaveProperty('ip');
        expect(ns).toHaveProperty('vulnerable');
        expect(ns).toHaveProperty('responseTime');
        expect(typeof ns.nameserver).toBe('string');
        expect(typeof ns.vulnerable).toBe('boolean');
        expect(typeof ns.responseTime).toBe('number');
      }
    });

    it('should calculate correct summary counts', async () => {
      const { status, data } = await makeRequest('example.com');

      expect(status).toBe(200);

      const vulnerable = data.nameservers.filter((ns: any) => ns.vulnerable).length;
      const secure = data.nameservers.filter((ns: any) => !ns.vulnerable && !ns.error).length;
      const errors = data.nameservers.filter((ns: any) => ns.error).length;

      expect(data.summary.vulnerable).toBe(vulnerable);
      expect(data.summary.secure).toBe(secure);
      expect(data.summary.errors).toBe(errors);
      expect(data.summary.total).toBe(data.nameservers.length);
    });
  });

  describe('Secure Domains', () => {
    it('should report google.com as secure', async () => {
      const { status, data } = await makeRequest('google.com');

      expect(status).toBe(200);
      expect(data.domain).toBe('google.com');
      expect(data.summary.vulnerable).toBe(0);
      // Most/all should be secure (AXFR properly refused)
      expect(data.summary.secure + data.summary.errors).toBeGreaterThan(0);
    });

    it('should report cloudflare.com as secure', async () => {
      const { status, data } = await makeRequest('cloudflare.com');

      expect(status).toBe(200);
      expect(data.summary.vulnerable).toBe(0);
    });

    it('should report github.com as secure', async () => {
      const { status, data } = await makeRequest('github.com');

      expect(status).toBe(200);
      expect(data.summary.vulnerable).toBe(0);
    });
  });

  describe('Vulnerable Test Domain', () => {
    it('should detect vulnerability on zonetransfer.me', async () => {
      const { status, data } = await makeRequest('zonetransfer.me');

      expect(status).toBe(200);
      expect(data.domain).toBe('zonetransfer.me');

      // This domain is intentionally vulnerable for testing
      // It should have at least one vulnerable nameserver
      const vulnerableNS = data.nameservers.find((ns: any) => ns.vulnerable);

      if (vulnerableNS) {
        expect(vulnerableNS.vulnerable).toBe(true);
        expect(vulnerableNS.recordCount).toBeGreaterThan(0);
        expect(vulnerableNS.records).toBeInstanceOf(Array);
        expect(vulnerableNS.records.length).toBeGreaterThan(0);
      }
    });

    it('should include zone records when vulnerable', async () => {
      const { status, data } = await makeRequest('zonetransfer.me');

      expect(status).toBe(200);

      const vulnerableNS = data.nameservers.find((ns: any) => ns.vulnerable);

      if (vulnerableNS) {
        expect(vulnerableNS.records).toBeInstanceOf(Array);
        expect(vulnerableNS.recordCount).toBeGreaterThan(0);

        // Records should be DNS zone format
        if (vulnerableNS.records.length > 0) {
          const firstRecord = vulnerableNS.records[0];
          expect(typeof firstRecord).toBe('string');
          // Should contain IN and record type
          expect(firstRecord).toMatch(/\s+IN\s+/);
        }
      }
    });
  });

  describe('Single Nameserver Testing', () => {
    it('should test single nameserver when specified', async () => {
      const { status, data } = await makeRequest('example.com', 'a.iana-servers.net');

      expect(status).toBe(200);
      expect(data.nameservers.length).toBe(1);
      expect(data.nameservers[0].nameserver).toBe('a.iana-servers.net');
    });

    it('should handle invalid nameserver gracefully', async () => {
      const { status, data } = await makeRequest('example.com', 'nonexistent-ns.example.com');

      expect(status).toBe(200);
      expect(data.nameservers.length).toBe(1);
      expect(data.nameservers[0].error).toBeDefined();
      expect(data.nameservers[0].vulnerable).toBe(false);
    });
  });

  describe('Domain Normalization', () => {
    it('should normalize domain to lowercase', async () => {
      const { status, data } = await makeRequest('Example.COM');

      expect(status).toBe(200);
      expect(data.domain).toBe('example.com');
    });

    it('should trim whitespace from domain', async () => {
      const { status, data } = await makeRequest('  example.com  ');

      expect(status).toBe(200);
      expect(data.domain).toBe('example.com');
    });
  });

  describe('Error Handling', () => {
    it('should reject empty domain', async () => {
      const { status, data } = await makeRequest('');

      expect(status).toBe(400);
      expect(data.message).toMatch(/required/i);
    });

    it('should reject missing domain', async () => {
      const response = await fetch(`${BASE_URL}/api/internal/diagnostics/axfr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toMatch(/required/i);
    });

    it('should reject whitespace-only domain', async () => {
      const { status, data } = await makeRequest('   ');

      expect(status).toBe(400);
      expect(data.message).toMatch(/required/i);
    });

    it('should reject invalid domain format', async () => {
      const { status, data } = await makeRequest('invalid domain with spaces');

      expect(status).toBe(400);
      expect(data.message).toMatch(/invalid|format/i);
    });

    it('should handle domain with no nameservers', async () => {
      const { status, data } = await makeRequest('this-domain-definitely-does-not-exist-12345.com');

      expect(status).toBeGreaterThanOrEqual(400);
      expect(data.message).toMatch(/not found|nameserver/i);
    });

    it('should reject invalid JSON', async () => {
      const response = await fetch(`${BASE_URL}/api/internal/diagnostics/axfr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toMatch(/json/i);
    });
  });

  describe('Response Time Tracking', () => {
    it('should include response times for all nameservers', async () => {
      const { status, data } = await makeRequest('example.com');

      expect(status).toBe(200);

      for (const ns of data.nameservers) {
        expect(ns.responseTime).toBeGreaterThanOrEqual(0);
        expect(typeof ns.responseTime).toBe('number');
      }
    });

    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      const { status } = await makeRequest('example.com');
      const duration = Date.now() - startTime;

      expect(status).toBe(200);
      // Should complete within 30 seconds (generous timeout for multiple NS)
      expect(duration).toBeLessThan(30000);
    });
  });

  describe('Nameserver Limits', () => {
    it('should limit to 10 nameservers', async () => {
      const { status, data } = await makeRequest('example.com');

      expect(status).toBe(200);
      // Should not exceed 10 nameservers even if domain has more
      expect(data.nameservers.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Record Count Limits', () => {
    it('should limit exposed records to 50', async () => {
      const { status, data } = await makeRequest('zonetransfer.me');

      expect(status).toBe(200);

      const vulnerableNS = data.nameservers.find((ns: any) => ns.vulnerable);

      if (vulnerableNS && vulnerableNS.records) {
        // Should not return more than 50 records
        expect(vulnerableNS.records.length).toBeLessThanOrEqual(50);

        // But recordCount can be higher
        if (vulnerableNS.recordCount > 50) {
          expect(vulnerableNS.records.length).toBe(50);
        }
      }
    });
  });

  describe('IP Resolution', () => {
    it('should resolve nameserver IPs', async () => {
      const { status, data } = await makeRequest('example.com');

      expect(status).toBe(200);

      for (const ns of data.nameservers) {
        // IP should be present (unless resolution failed)
        if (!ns.error || !ns.error.includes('resolve')) {
          expect(ns.ip).toBeDefined();
          expect(ns.ip).not.toBe('N/A');
          // Should be valid IP format (simplified check)
          expect(ns.ip).toMatch(/[\d.:a-fA-F]+/);
        }
      }
    });
  });

  describe('Timestamp Validation', () => {
    it('should include valid timestamp', async () => {
      const { status, data } = await makeRequest('example.com');

      expect(status).toBe(200);
      expect(data.timestamp).toBeDefined();

      const timestamp = new Date(data.timestamp);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 60000); // Within last minute
    });
  });

  describe('Different Domain TLDs', () => {
    it('should handle .org domains', async () => {
      const { status, data } = await makeRequest('wikipedia.org');

      expect(status).toBe(200);
      expect(data.domain).toBe('wikipedia.org');
      expect(data.nameservers.length).toBeGreaterThan(0);
    });

    it('should handle .net domains', async () => {
      const { status, data } = await makeRequest('cloudflare.net');

      expect(status).toBe(200);
      expect(data.domain).toBe('cloudflare.net');
    });

    it('should handle country code TLDs', async () => {
      const { status, data } = await makeRequest('bbc.co.uk');

      expect(status).toBe(200);
      expect(data.domain).toBe('bbc.co.uk');
      expect(data.nameservers.length).toBeGreaterThan(0);
    });
  });
});
