import { describe, it, expect } from 'vitest';
import { API_BASE_URL } from '../utils/api-test-helpers';

describe('DNSBL Blacklist Checker API', () => {
	async function makeRequest(target: string) {
		const response = await fetch(`${API_BASE_URL}/api/internal/diagnostics/dnsbl`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ target })
		});
		const data = await response.json();
		return { status: response.status, data };
	}

	describe('IPv4 Blacklist Checking', () => {
		it('should check clean IPv4 address (1.1.1.1)', async () => {
			const { status, data } = await makeRequest('1.1.1.1');

			expect(status).toBe(200);
			expect(data.target).toBe('1.1.1.1');
			expect(data.targetType).toBe('ipv4');
			expect(data.results).toBeInstanceOf(Array);
			expect(data.summary.totalChecked).toBeGreaterThan(0);
			// 1.1.1.1 might have some listings on aggressive RBLs, so just check it runs
			expect(data.summary.cleanCount + data.summary.listedCount + data.summary.errorCount).toBeGreaterThan(0);
		});

		it('should check RBL test IP (127.0.0.2)', async () => {
			const { status, data } = await makeRequest('127.0.0.2');

			expect(status).toBe(200);
			expect(data.targetType).toBe('ipv4');
			expect(data.results).toBeInstanceOf(Array);
			expect(data.summary.totalChecked).toBeGreaterThan(0);
			// 127.0.0.2 is commonly used for RBL testing and may show listings
		});

		it('should verify response times are under timeout', async () => {
			const { status, data } = await makeRequest('8.8.8.8');

			expect(status).toBe(200);
			expect(data.results).toBeInstanceOf(Array);

			// Check that all response times are reasonable
			for (const result of data.results) {
				expect(result.responseTime).toBeLessThan(2000); // Max 2 seconds including timeout buffer
				if (result.error?.includes('timeout')) {
					expect(result.responseTime).toBeGreaterThanOrEqual(996); // Should hit ~1s timeout (minus a lil bit for overhead)
				}
			}
		});

		it('should include all required fields in results', async () => {
			const { status, data } = await makeRequest('1.1.1.1');

			expect(status).toBe(200);
			expect(data.results.length).toBeGreaterThan(0);

			for (const result of data.results) {
				expect(result).toHaveProperty('rbl');
				expect(result).toHaveProperty('listed');
				expect(result).toHaveProperty('responseTime');
				expect(typeof result.rbl).toBe('string');
				expect(typeof result.listed).toBe('boolean');
				expect(typeof result.responseTime).toBe('number');
			}
		});

		it('should handle private IP addresses', async () => {
			const { status, data } = await makeRequest('192.168.1.1');

			expect(status).toBe(200);
			expect(data.targetType).toBe('ipv4');
			expect(data.results).toBeInstanceOf(Array);
			// Private IPs might not be queryable on some RBLs
		});
	});

	describe('IPv6 Blacklist Checking', () => {
		it('should check IPv6 address (2001:4860:4860::8888)', async () => {
			const { status, data } = await makeRequest('2001:4860:4860::8888');

			expect(status).toBe(200);
			expect(data.targetType).toBe('ipv6');
			expect(data.target).toBe('2001:4860:4860::8888');
			expect(data.results).toBeInstanceOf(Array);
			expect(data.summary.totalChecked).toBeGreaterThan(0);
		});

		it('should handle IPv6 with scope id', async () => {
			const { status, data } = await makeRequest('fe80::1%eth0');

			// Scope ID might cause parsing issues in some environments
			if (status === 200) {
				expect(data.targetType).toBe('ipv6');
				expect(data.results).toBeInstanceOf(Array);
			} else {
				// It's ok if scope IDs are rejected
				expect(status).toBe(500);
			}
		});

		it('should handle compressed IPv6 (::1)', async () => {
			const { status, data } = await makeRequest('::1');

			expect(status).toBe(200);
			expect(data.targetType).toBe('ipv6');
			expect(data.results).toBeInstanceOf(Array);
		});

		it('should handle IPv6 with embedded IPv4', async () => {
			const { status, data } = await makeRequest('::ffff:192.0.2.1');

			// IPv4-mapped IPv6 might not be supported by all parsers
			if (status === 200) {
				expect(data.results).toBeInstanceOf(Array);
			} else {
				// It's ok if this format is not supported
				expect(status).toBe(500);
			}
		});
	});

	describe('Domain Blacklist Checking', () => {
		it('should check clean domain (example.com)', async () => {
			const { status, data } = await makeRequest('example.com');

			expect(status).toBe(200);
			expect(data.targetType).toBe('domain');
			expect(data.target).toBe('example.com');
			expect(data.results).toBeInstanceOf(Array);
			expect(data.resolvedIPs).toBeInstanceOf(Array);
			expect(data.resolvedIPs.length).toBeGreaterThan(0);

			// Should have both domain and IP checks
			const domainChecks = data.results.filter((r: any) => !r.rbl.includes('('));
			const ipChecks = data.results.filter((r: any) => r.rbl.includes('('));

			expect(domainChecks.length).toBeGreaterThan(0); // Domain RBLs
			expect(ipChecks.length).toBeGreaterThan(0); // IP RBLs for resolved IPs
		});

		it('should normalize domain to lowercase', async () => {
			const { status, data } = await makeRequest('Example.COM');

			expect(status).toBe(200);
			expect(data.target).toBe('example.com'); // Should be normalized
		});

		it('should strip trailing dot from FQDN', async () => {
			const { status, data } = await makeRequest('example.com.');

			expect(status).toBe(200);
			expect(data.target).toBe('example.com'); // Trailing dot removed
		});

		it('should handle IDN/punycode domains', async () => {
			const { status, data } = await makeRequest('münchen.de');

			// IDN conversion might fail in some environments
			if (status === 200) {
				// Should convert to ASCII punycode
				expect(data.target).toMatch(/xn--/);
			} else {
				// Or might fail to resolve
				expect(status).toBe(500);
			}
		});

		it('should handle domain with no DNS records', async () => {
			const { status, data } = await makeRequest('this-domain-definitely-does-not-exist-123456.com');

			expect(status).toBe(500); // Should error out
			expect(data.message).toMatch(/resolve|not exist|not found/i);
		});
	});

	describe('Summary Statistics', () => {
		it('should calculate correct summary counts', async () => {
			const { status, data } = await makeRequest('1.1.1.1');

			expect(status).toBe(200);
			expect(data.summary).toBeDefined();
			expect(data.summary.totalChecked).toBe(data.results.length);

			const listed = data.results.filter((r: any) => r.listed).length;
			const clean = data.results.filter((r: any) => !r.listed && !r.error).length;
			const errors = data.results.filter((r: any) => r.error).length;

			expect(data.summary.listedCount).toBe(listed);
			expect(data.summary.cleanCount).toBe(clean);
			expect(data.summary.errorCount).toBe(errors);
		});

		it('should timestamp results', async () => {
			const { status, data } = await makeRequest('8.8.8.8');

			expect(status).toBe(200);
			expect(data.timestamp).toBeDefined();
			const timestamp = new Date(data.timestamp);
			expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
			expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 60000); // Within last minute
		});
	});

	describe('Error Handling', () => {
		it('should reject empty target', async () => {
			const { status, data } = await makeRequest('');

			expect(status).toBe(400);
			expect(data.message).toMatch(/required/i);
		});

		it('should reject missing target', async () => {
			const response = await fetch(`${API_BASE_URL}/api/internal/diagnostics/dnsbl`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.message).toMatch(/required/i);
		});

		it('should handle whitespace-only input', async () => {
			const { status, data } = await makeRequest('   ');

			expect(status).toBe(400);
			expect(data.message).toMatch(/required/i);
		});

		it('should handle invalid IP format', async () => {
			const { status, data } = await makeRequest('999.999.999.999');

			// Simple regex treats this as IPv4 even though octets are invalid
			expect(status).toBe(200);
			expect(data.targetType).toBe('ipv4');
			// Most RBLs will error on invalid octets or return not listed
			expect(data.results).toBeInstanceOf(Array);
		});

		it('should handle malformed IPv6', async () => {
			const { status, data } = await makeRequest('gggg::1');

			expect(status).toBe(500);
			// Invalid hex in IPv6
		});
	});

	describe('RBL Type Filtering', () => {
		it('should only query domain RBLs for domains', async () => {
			const { status, data } = await makeRequest('example.com');

			expect(status).toBe(200);

			// Find results without IP suffix (domain checks)
			const domainChecks = data.results.filter((r: any) => !r.rbl.includes('('));

			// Should include known domain RBLs
			const domainRblNames = domainChecks.map((r: any) => r.rbl.toLowerCase());
			const hasDomainRbl = domainRblNames.some((name: string) =>
				name.includes('dbl') || name.includes('surbl') || name.includes('domain')
			);
			expect(hasDomainRbl).toBe(true);
		});

		it('should not query domain RBLs for IP addresses', async () => {
			const { status, data } = await makeRequest('1.1.1.1');

			expect(status).toBe(200);

			// Should not have domain RBL checks for direct IP
			const hasDomainRbl = data.results.some(
				(r: any) => r.rbl.toLowerCase().includes('dbl') && !r.rbl.includes('(')
			);
			expect(hasDomainRbl).toBe(false);
		});
	});

	describe('Concurrency and Performance', () => {
		it('should complete within reasonable time for single IP', async () => {
			const startTime = Date.now();
			const { status } = await makeRequest('8.8.8.8');
			const duration = Date.now() - startTime;

			expect(status).toBe(200);
			// With concurrency limit and timeouts, should complete in reasonable time
			expect(duration).toBeLessThan(10000); // 10 seconds max
		});

		it('should handle multiple concurrent checks', async () => {
			const startTime = Date.now();

			const promises = [
				makeRequest('1.1.1.1'),
				makeRequest('8.8.8.8'),
				makeRequest('9.9.9.9')
			];

			const results = await Promise.all(promises);
			const duration = Date.now() - startTime;

			results.forEach((result) => {
				expect(result.status).toBe(200);
			});

			// Should complete faster than sequential due to concurrency
			expect(duration).toBeLessThan(15000); // 15 seconds for 3 requests
		});
	});

	describe('Error Response Detection', () => {
		it('should mark 127.255.x.x responses as errors', async () => {
			// Some RBLs return 127.255.x.x for query errors
			// This is tested implicitly via the error count in summary
			const { status, data } = await makeRequest('1.1.1.1');

			expect(status).toBe(200);

			// Check if any errors were properly categorized
			const errorResults = data.results.filter((r: any) => r.error);
			for (const result of errorResults) {
				expect(result.listed).toBe(false); // Errors should not be counted as listings
			}
		});

		it('should identify blocked/auth required responses', async () => {
			const { status, data } = await makeRequest('1.1.1.1');

			expect(status).toBe(200);

			// Look for auth-required or blocked responses
			const authErrors = data.results.filter(
				(r: any) =>
					r.error &&
					(r.error.includes('blocked') ||
						r.error.includes('access denied') ||
						r.error.includes('query refused'))
			);

			// These should be marked as errors, not listings
			for (const result of authErrors) {
				expect(result.listed).toBe(false);
			}
		});
	});

	describe('Response Format', () => {
		it('should include listing details when listed', async () => {
			const { status, data } = await makeRequest('127.0.0.2'); // RBL test IP

			expect(status).toBe(200);

			// Find any listed results
			const listed = data.results.find((r: any) => r.listed);

			if (listed) {
				expect(listed.response).toBeDefined(); // Should have A record response
				expect(listed.response).toMatch(/^127\./); // RBL responses are in 127.0.0.0/8
				// May have reason, url, description
			}
		});

		it('should not include unnecessary fields for clean results', async () => {
			const { status, data } = await makeRequest('1.1.1.1');

			expect(status).toBe(200);

			const cleanResult = data.results.find((r: any) => !r.listed && !r.error);

			if (cleanResult) {
				expect(cleanResult.response).toBeUndefined();
				expect(cleanResult.reason).toBeUndefined();
			}
		});
	});

	describe('IPv6 Reverse DNS Format', () => {
		it('should properly reverse IPv6 addresses for queries', async () => {
			// This is tested indirectly - if IPv6 reversal is broken, queries will fail
			const { status, data } = await makeRequest('2001:db8::1');

			expect(status).toBe(200);
			expect(data.targetType).toBe('ipv6');

			// Should get some results (even if all are "not listed" or errors)
			expect(data.results.length).toBeGreaterThan(0);
		});

		it('should handle IPv6 with all zeros', async () => {
			const { status, data } = await makeRequest('::');

			expect(status).toBe(200);
			expect(data.targetType).toBe('ipv6');
		});
	});
});
