import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { promises as dns } from 'node:dns';

interface DNSPerformanceRequest {
	domain: string;
	recordType?: string;
}

interface ResolverResult {
	resolver: string;
	resolverName: string;
	success: boolean;
	responseTime: number;
	records?: string[];
	error?: string;
}

interface DNSPerformanceResponse {
	domain: string;
	recordType: string;
	results: ResolverResult[];
	statistics: {
		fastest: { resolver: string; time: number };
		slowest: { resolver: string; time: number };
		average: number;
		median: number;
		successRate: number;
	};
	timestamp: string;
}

const RESOLVERS = [
	{ ip: '1.1.1.1', name: 'Cloudflare' },
	{ ip: '8.8.8.8', name: 'Google' },
	{ ip: '9.9.9.9', name: 'Quad9' },
	{ ip: '208.67.222.222', name: 'OpenDNS' },
	{ ip: '76.76.2.0', name: 'ControlD' },
	{ ip: '94.140.14.14', name: 'AdGuard' },
	{ ip: '185.228.168.9', name: 'CleanBrowsing' },
	{ ip: '77.88.8.8', name: 'Yandex' },
];

const DNS_TIMEOUT_MS = 5000;
const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'] as const;
const MAX_DOMAIN_LENGTH = 253;
const DOMAIN_PATTERN = /^([a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.)+[a-zA-Z]{2,}$/;

function withTimeout<T>(promise: Promise<T>, ms = DNS_TIMEOUT_MS): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(Object.assign(new Error('DNS query timeout'), { code: 'ETIMEOUT' })), ms)
		),
	]);
}

function validateDomain(domain: string): boolean {
	if (!domain || domain.length > MAX_DOMAIN_LENGTH) return false;
	return DOMAIN_PATTERN.test(domain);
}

async function queryResolver(
	domain: string,
	recordType: string,
	resolverIp: string
): Promise<{ records: string[]; time: number }> {
	const resolver = new dns.Resolver();
	resolver.setServers([resolverIp]);

	const startTime = performance.now();

	let records: string[];
	switch (recordType.toUpperCase()) {
		case 'A':
			records = await withTimeout(resolver.resolve4(domain));
			break;
		case 'AAAA':
			records = await withTimeout(resolver.resolve6(domain));
			break;
		case 'MX': {
			const mxRecords = (await withTimeout(resolver.resolveMx(domain))) as dns.MxRecord[];
			records = mxRecords.map((r: dns.MxRecord) => `${r.priority} ${r.exchange}`);
			break;
		}
		case 'TXT': {
			const txtRecords = (await withTimeout(resolver.resolveTxt(domain))) as string[][];
			records = txtRecords.map((r: string[]) => r.join(' '));
			break;
		}
		case 'NS':
			records = await withTimeout(resolver.resolveNs(domain));
			break;
		case 'CNAME':
			records = await withTimeout(resolver.resolveCname(domain));
			break;
		case 'SOA': {
			const soaRecord = (await withTimeout(resolver.resolveSoa(domain))) as dns.SoaRecord;
			records = [
				`${soaRecord.nsname} ${soaRecord.hostmaster} ${soaRecord.serial} ${soaRecord.refresh} ${soaRecord.retry} ${soaRecord.expire} ${soaRecord.minttl}`,
			];
			break;
		}
		default:
			throw new Error(`Unsupported record type: ${recordType}`);
	}

	const endTime = performance.now();
	return { records, time: Math.round((endTime - startTime) * 100) / 100 };
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		let body: DNSPerformanceRequest;
		try {
			body = await request.json();
		} catch {
			throw error(400, 'Invalid JSON in request body');
		}
		const { domain, recordType = 'A' } = body;

		if (!domain || typeof domain !== 'string' || !domain.trim()) {
			throw error(400, 'Domain is required');
		}

		const trimmedDomain = domain.trim().toLowerCase();

		// Validate domain format
		if (!validateDomain(trimmedDomain)) {
			throw error(400, 'Invalid domain name format');
		}

		// Validate record type
		if (!RECORD_TYPES.includes(recordType.toUpperCase() as any)) {
			throw error(400, `Invalid record type. Supported types: ${RECORD_TYPES.join(', ')}`);
		}

		// Query all resolvers in parallel
		const results = await Promise.all(
			RESOLVERS.map(async (resolver): Promise<ResolverResult> => {
				try {
					const { records, time } = await queryResolver(trimmedDomain, recordType, resolver.ip);
					return {
						resolver: resolver.ip,
						resolverName: resolver.name,
						success: true,
						responseTime: time,
						records: records.slice(0, 10), // Limit to first 10 records
					};
				} catch (err: any) {
					let errorMsg = 'Unknown error';

					if (err?.code === 'ENOTFOUND') {
						errorMsg = 'Domain not found';
					} else if (err?.code === 'ENODATA') {
						errorMsg = `No ${recordType} records`;
					} else if (err?.code === 'ETIMEOUT') {
						errorMsg = 'Query timeout (>5s)';
					} else if (err?.code === 'ESERVFAIL') {
						errorMsg = 'Server failure';
					} else if (err?.code === 'EREFUSED') {
						errorMsg = 'Query refused';
					} else if (err?.message) {
						errorMsg = err.message;
					}

					return {
						resolver: resolver.ip,
						resolverName: resolver.name,
						success: false,
						responseTime: 0,
						error: errorMsg,
					};
				}
			})
		);

		// Calculate statistics
		const successfulResults = results.filter((r) => r.success);
		const responseTimes = successfulResults.map((r) => r.responseTime).sort((a, b) => a - b);

		let statistics;
		if (successfulResults.length === 0) {
			statistics = {
				fastest: { resolver: 'N/A', time: 0 },
				slowest: { resolver: 'N/A', time: 0 },
				average: 0,
				median: 0,
				successRate: 0,
			};
		} else {
			const fastestResult = successfulResults.reduce((prev, curr) =>
				prev.responseTime < curr.responseTime ? prev : curr
			);
			const slowestResult = successfulResults.reduce((prev, curr) =>
				prev.responseTime > curr.responseTime ? prev : curr
			);
			const average = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
			const median =
				responseTimes.length % 2 === 0
					? (responseTimes[responseTimes.length / 2 - 1] + responseTimes[responseTimes.length / 2]) / 2
					: responseTimes[Math.floor(responseTimes.length / 2)];

			statistics = {
				fastest: { resolver: fastestResult.resolverName, time: fastestResult.responseTime },
				slowest: { resolver: slowestResult.resolverName, time: slowestResult.responseTime },
				average: Math.round(average * 100) / 100,
				median: Math.round(median * 100) / 100,
				successRate: Math.round((successfulResults.length / results.length) * 100),
			};
		}

		const response: DNSPerformanceResponse = {
			domain: trimmedDomain,
			recordType: recordType.toUpperCase(),
			results,
			statistics,
			timestamp: new Date().toISOString(),
		};

		return json(response);
	} catch (err) {
		console.error('DNS performance check error:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(500, `DNS performance check failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
	}
};
